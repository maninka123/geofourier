import {
  analyze,
  coefficients,
  measure,
  reconstruct,
  resample,
  type Analysis,
  type Model,
  type Point,
} from "./engine";

export function retainedEnergy(model: Model, n: number) {
  let total = 0,
    kept = 0;
  for (const c of model.contours) {
    // Translation is excluded: moving a shape does not add geometric detail.
    c.coefficients.forEach((v, i) => {
      if (v.frequency) {
        total += v.amplitude ** 2;
        if (i < n) kept += v.amplitude ** 2;
      }
    });
  }
  return total ? (100 * kept) / total : 100;
}
export function nearestOnBoundary(
  p: Point,
  ring: Point[],
): { point: Point; distance: number } {
  let best = Infinity;
  let point: Point = ring[0] || [0, 0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    const q: Point = [a[0] + t * dx, a[1] + t * dy],
      d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best) {
      best = d;
      point = q;
    }
  }
  return { point, distance: best };
}
export function componentResults(a: Analysis) {
  const groups = [
    ...new Set(a.model.contours.filter((c) => !c.hole).map((c) => c.group)),
  ];
  const area = (ps: Point[]) =>
    Math.abs(
      ps.reduce((s, p, i) => {
        const q = ps[(i + 1) % ps.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2;
  return groups
    .map((group) => {
      const indices = a.model.contours.flatMap((c, i) =>
        c.group === group ? [i] : [],
      );
      const contours = indices.map((i) => a.model.contours[i]);
      const exterior = contours.find((c) => !c.hole)!;
      const points = contours.flatMap((c) => c.points),
        xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      const xmin = Math.min(...xs),
        xmax = Math.max(...xs),
        ymin = Math.min(...ys),
        ymax = Math.max(...ys),
        cx = (xmin + xmax) / 2,
        cy = (ymin + ymax) / 2;
      const scale = 2 / Math.max(xmax - xmin, ymax - ymin, 1e-9),
        diagonal = Math.hypot(xmax - xmin, ymax - ymin);
      const shift = (ps: Point[]): Point[] =>
        ps.map((p) => [(p[0] - cx) * scale, (p[1] - cy) * scale]);
      const metrics = measure(
        {
          ...a.model,
          diagonal: diagonal * scale,
          contours: contours.map((c) => ({
            ...c,
            points: shift(c.points),
            perimeter: c.perimeter * scale,
          })),
        },
        indices.map((i) => shift(a.paths[i])),
      );
      // Similarity uses a local frame; distance percentages share the country diagonal.
      const factor = diagonal / a.model.diagonal;
      metrics.mean *= factor;
      metrics.max *= factor;
      metrics.rms *= factor;
      return {
        group,
        name: exterior.name,
        area: area(exterior.points),
        holes: contours.filter((c) => c.hole).length,
        terms: Math.min(a.terms, exterior.coefficients.length),
        metrics,
        points: exterior.points,
        path: a.paths[indices.find((i) => !a.model.contours[i].hole)!],
      };
    })
    .sort((a, b) => b.area - a.area);
}
export type ValidationPoint = {
  n: number;
  error: number;
  similarity: number;
  energy: number;
};
export type ValidationReport = Awaited<ReturnType<typeof validate>>;
export async function validate(
  model: Model,
  terms: number,
  cap: number,
  cancelled = () => false,
) {
  const a = analyze(model, terms);
  const sourceModel: Model = {
    ...model,
    contours: model.contours.map((c) => ({
      ...c,
      points: c.source || c.points,
    })),
  };
  const sourceMetrics = measure(sourceModel, a.paths);
  const errors = a.paths.map((path, i) => {
    const reference = model.contours[i].source || model.contours[i].points;
    const hits = path.map((p) => nearestOnBoundary(p, reference));
    let max = { from: path[0], to: hits[0].point, distance: hits[0].distance };
    hits.forEach((h, j) => {
      if (h.distance > max.distance)
        max = { from: path[j], to: h.point, distance: h.distance };
    });
    // Include deviations in both directions, not only reconstruction → source.
    for (const p of resample(
      reference,
      Math.min(1024, Math.max(64, path.length)),
    )) {
      const h = nearestOnBoundary(p, path);
      if (h.distance > max.distance)
        max = { from: h.point, to: p, distance: h.distance };
    }
    return {
      path,
      reference,
      distances: hits.map((h) => (100 * h.distance) / model.diagonal),
      max: { ...max, distance: (100 * max.distance) / model.diagonal },
    };
  });
  const curve: ValidationPoint[] = [];
  for (const n of [
    ...new Set([
      1,
      2,
      3,
      5,
      8,
      12,
      16,
      25,
      40,
      60,
      100,
      150,
      250,
      500,
      1000,
      terms,
      cap,
    ]),
  ]
    .filter((n) => n <= cap)
    .sort((a, b) => a - b)) {
    if (cancelled()) throw Error("Validation cancelled");
    const result = n === terms ? a : analyze(model, n);
    curve.push({
      n,
      error: result.metrics.mean,
      similarity: result.metrics.similarity,
      energy: retainedEnergy(model, n),
    });
    await new Promise((r) => setTimeout(r, 0));
  }
  const sensitivity = [];
  for (const samples of [256, 512, 1024, 2048]) {
    if (cancelled()) throw Error("Validation cancelled");
    const longest = Math.max(...model.contours.map((c) => c.perimeter));
    const contours = model.contours.map((c) => {
      const count =
        model.mode === "main"
          ? samples
          : Math.min(
              samples,
              2 **
                Math.ceil(
                  Math.log2(Math.max(32, (samples * c.perimeter) / longest)),
                ),
            );
      const points = resample(c.source || c.points, count);
      return { ...c, points, coefficients: coefficients(points) };
    });
    const m = { ...model, contours, samples },
      result = analyze(m, terms);
    sensitivity.push({
      samples,
      similarity: result.metrics.similarity,
      error: result.metrics.mean,
      sourceError: measure(sourceModel, result.paths).mean,
      energy: retainedEnergy(m, terms),
    });
    await new Promise((r) => setTimeout(r, 0));
  }
  return {
    terms,
    sampled: a.metrics,
    source: sourceMetrics,
    energy: retainedEnergy(model, terms),
    errors,
    curve,
    sensitivity,
  };
}
