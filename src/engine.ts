export type Point = [number, number];
export type Geometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};
export type Country = {
  id: string;
  name: string;
  code: string;
  continent: string;
};
export type Component = {
  frequency: number;
  re: number;
  im: number;
  amplitude: number;
  phase: number;
};
export type Contour = {
  points: Point[];
  coefficients: Component[];
  hole: boolean;
  group: number;
  perimeter: number;
};
export type Model = {
  contours: Contour[];
  components: number;
  excluded: number;
  samples: number;
  mode: string;
  diagonal: number;
};
export type Metrics = {
  similarity: number;
  iou: number;
  boundary: number;
  mean: number;
  max: number;
  rms: number;
};
export type Analysis = {
  model: Model;
  paths: Point[][];
  metrics: Metrics;
  terms: number;
};
export type CurvePoint = {
  terms: number;
  similarity: number;
  iou: number;
  mean: number;
};
export type SearchResult = {
  curve: CurvePoint[];
  best: CurvePoint;
  reached: boolean;
  elapsed: number;
  evaluations: number;
  reason: "target" | "budget" | "time" | "cancelled";
  granularity: number;
};
export function fft(re: number[], im: number[], inverse = false) {
  const n = re.length;
  if (n < 1 || n & (n - 1))
    throw Error("FFT requires a power-of-two sample count.");
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    for (let start = 0; start < n; start += len) {
      for (let j = 0; j < len / 2; j++) {
        const c = Math.cos(angle * j),
          s = Math.sin(angle * j),
          a = start + j,
          b = a + len / 2,
          tr = c * re[b] - s * im[b],
          ti = s * re[b] + c * im[b];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
}
export function resample(points: Point[], count: number): Point[] {
  const lengths = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    lengths.push(lengths[i] + Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  const total = lengths.at(-1)!;
  if (!total)
    return Array.from({ length: count }, () => [...points[0]] as Point);
  let edge = 0;
  return Array.from({ length: count }, (_, i) => {
    const t = (i * total) / count;
    while (edge < points.length - 1 && lengths[edge + 1] < t) edge++;
    const a = points[edge],
      b = points[(edge + 1) % points.length],
      u = (t - lengths[edge]) / (lengths[edge + 1] - lengths[edge] || 1);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  });
}
export function coefficients(points: Point[]): Component[] {
  const n = points.length,
    re = points.map((p) => p[0]),
    im = points.map((p) => p[1]);
  fft(re, im);
  return re
    .map((v, k) => ({
      frequency: k <= n / 2 ? k : k - n,
      re: v / n,
      im: im[k] / n,
      amplitude: Math.hypot(v, im[k]) / n,
      phase: Math.atan2(im[k], v),
    }))
    .sort((a, b) => b.amplitude - a.amplitude || a.frequency - b.frequency);
}
export function reconstruct(contour: Contour, terms: number): Point[] {
  const n = contour.points.length,
    re = Array(n).fill(0),
    im = Array(n).fill(0);
  for (const c of contour.coefficients.slice(0, terms)) {
    const k = (c.frequency + n) % n;
    re[k] = c.re * n;
    im[k] = c.im * n;
  }
  fft(re, im, true);
  return re.map((x, i) => [x, im[i]]);
}
function area(ring: Point[]) {
  return Math.abs(
    ring.reduce((a, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2,
  );
}
export function prepare(
  geometry: Geometry,
  samples = 1024,
  mode = "main",
): Model {
  const polygons = (
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  ) as number[][][][];
  const all = polygons.map((poly, group) =>
    poly.map((r, index) => ({ raw: r, hole: index > 0, group })),
  );
  // Unwrap each ring continuously, then place it near the largest exterior's longitude.
  const largest = polygons.reduce(
    (a, b) => (b[0].length > a[0].length ? b : a),
    polygons[0],
  );
  const seed = largest[0][0][0];
  const centerLat =
    largest[0].reduce((s, p) => s + p[1], 0) / largest[0].length;
  const project = (raw: number[][]): Point[] => {
    let prev = seed;
    const out: Point[] = [];
    for (const p of raw) {
      let lon = p[0];
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
      prev = lon;
      out.push([
        (lon - seed) * Math.max(0.05, Math.cos((centerLat * Math.PI) / 180)),
        -p[1],
      ]);
    }
    const avg = out.reduce((s, p) => s + p[0], 0) / out.length,
      period = 360 * Math.max(0.05, Math.cos((centerLat * Math.PI) / 180)),
      shift = Math.round(avg / period) * period;
    return out.map(([x, y]) => [x - shift, y]);
  };
  let rings = all
    .flat()
    .map((r) => ({ ...r, points: project(r.raw) }))
    .filter((r) => r.points.length >= 4);
  const exterior = rings
    .filter((r) => !r.hole)
    .sort((a, b) => area(b.points) - area(a.points));
  if (mode === "main") rings = exterior.slice(0, 1);
  else if (mode === "exterior") rings = rings.filter((r) => !r.hole);
  const points = rings.flatMap((r) => r.points);
  let xmin = Infinity,
    ymin = Infinity,
    xmax = -Infinity,
    ymax = -Infinity;
  for (const [x, y] of points) {
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  const scale = 2 / Math.max(xmax - xmin, ymax - ymin, 1e-9),
    cx = (xmin + xmax) / 2,
    cy = (ymin + ymax) / 2;
  const perimeters = rings.map((r) =>
    r.points.reduce((s, p, i) => {
      const q = r.points[(i + 1) % r.points.length];
      return s + Math.hypot(p[0] - q[0], p[1] - q[1]);
    }, 0),
  );
  const longest = Math.max(...perimeters);
  const contours = rings.map((r, i) => {
    const n =
      mode === "main"
        ? samples
        : Math.min(
            samples,
            2 **
              Math.ceil(
                Math.log2(Math.max(32, (samples * perimeters[i]) / longest)),
              ),
          );
    const p = resample(
      r.points.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale]),
      n,
    );
    return {
      points: p,
      coefficients: coefficients(p),
      group: r.group,
      hole: r.hole,
      perimeter: perimeters[i] * scale,
    };
  });
  return {
    contours,
    components: exterior.length,
    excluded: all.flat().length - rings.length,
    samples,
    mode,
    diagonal: Math.hypot(xmax - xmin, ymax - ymin) * scale,
  };
}
// Scan-convert each polygon with even-odd interior rings. Union independent polygons.
export function raster(
  paths: Point[][],
  contours: Contour[],
  size = 192,
  extent = 1.2,
): Uint8Array {
  const mask = new Uint8Array(size * size),
    groups = new Map<number, number[]>();
  contours.forEach((c, i) =>
    groups.set(c.group, [...(groups.get(c.group) || []), i]),
  );
  for (const indices of groups.values())
    for (let row = 0; row < size; row++) {
      const y = ((row + 0.5) / size) * (2 * extent) - extent,
        crossings: number[] = [];
      for (const index of indices) {
        const p = paths[index];
        for (let j = 0; j < p.length; j++) {
          const a = p[j],
            b = p[(j + 1) % p.length];
          if (a[1] > y !== b[1] > y)
            crossings.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let j = 0; j + 1 < crossings.length; j += 2) {
        const x1 = Math.max(
            0,
            Math.ceil(((crossings[j] + extent) / (2 * extent)) * size - 0.5),
          ),
          x2 = Math.min(
            size - 1,
            Math.floor(
              ((crossings[j + 1] + extent) / (2 * extent)) * size - 0.5,
            ),
          );
        for (let x = x1; x <= x2; x++) mask[row * size + x] = 1;
      }
    }
  return mask;
}
type KD = { point: Point; axis: number; left?: KD; right?: KD };
function tree(points: Point[], depth = 0): KD | undefined {
  if (!points.length) return;
  const axis = depth % 2;
  points.sort((a, b) => a[axis] - b[axis]);
  const m = points.length >> 1;
  return {
    point: points[m],
    axis,
    left: tree(points.slice(0, m), depth + 1),
    right: tree(points.slice(m + 1), depth + 1),
  };
}
function nearest(node: KD | undefined, p: Point, best = Infinity): number {
  if (!node) return best;
  const d = (p[0] - node.point[0]) ** 2 + (p[1] - node.point[1]) ** 2;
  best = Math.min(best, d);
  const delta = p[node.axis] - node.point[node.axis];
  best = nearest(delta < 0 ? node.left : node.right, p, best);
  if (delta * delta < best)
    best = nearest(delta < 0 ? node.right : node.left, p, best);
  return best;
}
export function measure(model: Model, paths: Point[][]): Metrics {
  const source = model.contours.map((c) => c.points);
  let extent = 1.2;
  for (const path of paths)
    for (const [x, y] of path)
      extent = Math.max(extent, Math.abs(x) + 0.01, Math.abs(y) + 0.01);
  const a = raster(source, model.contours, 192, extent),
    b = raster(paths, model.contours, 192, extent);
  let intersection = 0,
    union = 0;
  for (let i = 0; i < a.length; i++) {
    intersection += a[i] & b[i];
    union += a[i] | b[i];
  }
  const total = model.contours.reduce((s, c) => s + c.perimeter, 0);
  const samples = (ps: Point[][]) =>
    ps.flatMap((p, i) =>
      resample(
        p,
        Math.max(8, Math.ceil((768 * model.contours[i].perimeter) / total)),
      ),
    );
  const pa = samples(source),
    pb = samples(paths),
    ta = tree([...pa]),
    tb = tree([...pb]);
  const errors = [
    ...pa.map((p) => Math.sqrt(nearest(tb, p))),
    ...pb.map((p) => Math.sqrt(nearest(ta, p))),
  ];
  const mean = errors.reduce((s, d) => s + d, 0) / errors.length,
    max = Math.max(...errors),
    rms = Math.sqrt(errors.reduce((s, d) => s + d * d, 0) / errors.length);
  const iou = union ? (intersection / union) * 100 : 0,
    boundary = 100 * Math.exp((-20 * mean) / model.diagonal);
  return {
    similarity: 0.7 * iou + 0.3 * boundary,
    iou,
    boundary,
    mean: (mean / model.diagonal) * 100,
    max: (max / model.diagonal) * 100,
    rms: (rms / model.diagonal) * 100,
  };
}
export function analyze(model: Model, terms: number): Analysis {
  const paths = model.contours.map((c) => reconstruct(c, terms));
  return { model, paths, metrics: measure(model, paths), terms };
}
export async function search(
  model: Model,
  target: number,
  limit: number,
  step: number,
  maxMs: number,
  onPoint: (
    point: CurvePoint,
    best: CurvePoint,
    evaluations: number,
    elapsed: number,
  ) => void,
  isCancelled = () => false,
): Promise<SearchResult> {
  const start = performance.now(),
    curve: CurvePoint[] = [];
  let best: CurvePoint = { terms: 1, similarity: -1, iou: 0, mean: 0 },
    reason: SearchResult["reason"] = "budget";
  const counts = [];
  for (let n = 1; n <= limit; n += step) counts.push(n);
  if (counts.at(-1) !== limit) counts.push(limit);
  for (const terms of counts) {
    if (isCancelled()) {
      reason = "cancelled";
      break;
    }
    if (performance.now() - start >= maxMs) {
      reason = "time";
      break;
    }
    const a = analyze(model, terms),
      point = {
        terms,
        similarity: a.metrics.similarity,
        iou: a.metrics.iou,
        mean: a.metrics.mean,
      };
    curve.push(point);
    if (point.similarity > best.similarity) best = point;
    onPoint(point, best, curve.length, performance.now() - start);
    if (point.similarity >= target) {
      reason = "target";
      break;
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  return {
    curve,
    best,
    reached: reason === "target",
    elapsed: performance.now() - start,
    evaluations: curve.length,
    reason,
    granularity: step,
  };
}
