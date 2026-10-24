import type { Geometry, Point } from "./engine";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_BOUNDARY_POINTS = 50000;
export type BoundaryInput = {
  geometry: Geometry;
  name: string;
  openPaths: number;
  points: number;
};
type Ring = { points: Point[]; name?: string; closed: boolean };
const equal = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9;
function clean(raw: unknown, geo: boolean): Point[] {
  if (!Array.isArray(raw))
    throw Error("Each boundary must contain coordinate pairs.");
  const out: Point[] = [];
  for (const pair of raw) {
    if (
      !Array.isArray(pair) ||
      pair.length < 2 ||
      typeof pair[0] !== "number" ||
      typeof pair[1] !== "number" ||
      !Number.isFinite(pair[0]) ||
      !Number.isFinite(pair[1])
    )
      throw Error(
        "Coordinates must be finite x/y or longitude/latitude numbers.",
      );
    const p: Point = [pair[0], pair[1]];
    if (Math.abs(p[0]) > 1e12 || Math.abs(p[1]) > 1e12)
      throw Error(
        "Coordinate magnitude is too large. Rescale the shape before importing.",
      );
    if (geo && (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90))
      throw Error(
        "GeoJSON coordinates must use longitude −180…180 and latitude −90…90.",
      );
    if (!out.length || !equal(out.at(-1)!, p)) out.push(p);
  }
  const unique =
    out.length - (out.length > 1 && equal(out[0], out.at(-1)!) ? 1 : 0);
  if (unique < 3)
    throw Error("Each outline needs at least three distinct points.");
  const area = Math.abs(
    out.reduce((s, p, i) => {
      const q = out[(i + 1) % out.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
  if (area < 1e-12)
    throw Error(
      "An outline has zero area. Draw or upload a closed two-dimensional shape.",
    );
  return out;
}
function finish(
  polygons: Point[][][],
  names: string[],
  geo: boolean,
  name: string,
  openPaths: number,
): BoundaryInput {
  // Store an explicit closing vertex, including for triangular input paths.
  polygons = polygons.map((poly) =>
    poly.map((r) => (equal(r[0], r.at(-1)!) ? r : [...r, [...r[0]] as Point])),
  );
  const points = polygons.flat(2).length;
  if (!polygons.length)
    throw Error("No supported boundary outlines were found.");
  if (polygons.length > 128)
    throw Error("Use at most 128 disconnected land areas per file.");
  if (points > MAX_BOUNDARY_POINTS)
    throw Error("Use at most 50,000 boundary points.");
  return {
    geometry: {
      type: "MultiPolygon",
      coordinates: polygons,
      names,
      ...(!geo ? { coordinateSystem: "cartesian" as const } : {}),
    },
    name,
    openPaths,
    points,
  };
}
export function parseGeoJSON(
  text: string,
  name = "Custom boundary",
): BoundaryInput {
  let root: any;
  try {
    root = JSON.parse(text);
  } catch {
    throw Error("This file is not valid JSON.");
  }
  const coordinateSystem = root?.coordinateSystem;
  const geographic =
    coordinateSystem !== "cartesian" && coordinateSystem !== "screen";
  const polygons: Point[][][] = [],
    names: string[] = [];
  let openPaths = 0;
  const ring = (r: unknown) => {
    const p = clean(r, geographic);
    if (!equal(p[0], p.at(-1)!)) {
      openPaths++;
    }
    return p;
  };
  const add = (g: any, label: string) => {
    if (!g) return;
    if (g.type === "FeatureCollection") {
      if (!Array.isArray(g.features))
        throw Error("GeoJSON features must be an array.");
      g.features.forEach((f: any) => add(f, label));
    } else if (g.type === "Feature")
      add(
        g.geometry,
        String(g.properties?.name || g.properties?.NAME || label),
      );
    else if (g.type === "GeometryCollection")
      g.geometries?.forEach((v: any) => add(v, label));
    else if (g.type === "Polygon") {
      if (!Array.isArray(g.coordinates) || !g.coordinates.length)
        throw Error("Polygon coordinates are empty.");
      polygons.push(g.coordinates.map((r: unknown) => ring(r)));
      names.push(label);
    } else if (g.type === "MultiPolygon") {
      if (!Array.isArray(g.coordinates))
        throw Error("MultiPolygon coordinates are invalid.");
      g.coordinates.forEach((p: any, i: number) =>
        add(
          { type: "Polygon", coordinates: p },
          typeof g.names?.[i] === "string" ? g.names[i] : label,
        ),
      );
    } else if (g.type === "LineString") {
      polygons.push([ring(g.coordinates)]);
      names.push(label);
    } else if (g.type === "MultiLineString")
      g.coordinates?.forEach((r: any) =>
        add({ type: "LineString", coordinates: r }, label),
      );
    else
      throw Error(
        "Use Polygon, MultiPolygon or closed line geometry. Point geometry cannot form a boundary.",
      );
  };
  add(root, "");
  const result = finish(polygons, names, geographic, name, openPaths);
  if (coordinateSystem === "screen")
    result.geometry.coordinateSystem = "screen";
  return result;
}
export function parseCSV(
  text: string,
  name = "Coordinate outline",
): BoundaryInput {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/),
    rings: Point[][] = [];
  let current: Point[] = [],
    geo = false;
  const end = () => {
    if (current.length) {
      rings.push(clean(current, geo));
      current = [];
    }
  };
  let first = true;
  for (const line of lines) {
    if (!line.trim()) {
      end();
      continue;
    }
    if (line.trim().startsWith("#")) continue;
    const values = line.trim().split(/[,;\t ]+/);
    if (
      first &&
      /^(x|lon|longitude)$/i.test(values[0]) &&
      /^(y|lat|latitude)$/i.test(values[1])
    ) {
      geo = /^(lon|longitude)$/i.test(values[0]);
      first = false;
      continue;
    }
    first = false;
    if (
      values.length !== 2 ||
      values.some((v) => v === "" || !Number.isFinite(Number(v)))
    )
      throw Error(
        "CSV needs two numeric columns: x,y. Separate disconnected paths with a blank line.",
      );
    current.push([Number(values[0]), Number(values[1])]);
  }
  end();
  return finish(
    rings.map((r) => [r]),
    [],
    geo,
    name,
    rings.filter((r) => !equal(r[0], r.at(-1)!)).length,
  );
}
function inside(p: Point, ring: Point[]) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
export function ringsToBoundary(rings: Ring[], name: string): BoundaryInput {
  const area = (ps: Point[]) =>
    Math.abs(
      ps.reduce((s, p, i) => {
        const q = ps[(i + 1) % ps.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0),
    );
  const sorted = rings
    .map((r) => ({ ...r, points: clean(r.points, false) }))
    .sort((a, b) => area(b.points) - area(a.points));
  const polygons: Point[][][] = [],
    names: string[] = [];
  const used: { points: Point[]; depth: number; polygon: number }[] = [];
  for (const r of sorted) {
    const parent = [...used]
      .reverse()
      .find((p) => inside(r.points[0], p.points));
    const depth = parent ? parent.depth + 1 : 0;
    let polygon: number;
    if (depth % 2 === 1) {
      polygon = parent!.polygon;
      polygons[polygon].push(r.points);
    } else {
      polygon = polygons.length;
      polygons.push([r.points]);
      names.push(r.name || "");
    }
    used.push({ points: r.points, depth, polygon });
  }
  const result = finish(
    polygons,
    names,
    false,
    name,
    sorted.filter((r) => !r.closed && !equal(r.points[0], r.points.at(-1)!))
      .length,
  );
  result.geometry.coordinateSystem = "screen";
  return result;
}
export function parseSVG(text: string, name = "SVG outline"): BoundaryInput {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw Error("This file is not a valid SVG.");
  const rings: Ring[] = [];
  let pointCount = 0;
  const matrix = (e: Element) => {
    const chain: Element[] = [];
    for (let node: Element | null = e; node; node = node.parentElement)
      chain.unshift(node);
    let m = new DOMMatrix();
    for (const el of chain) {
      const raw = el.getAttribute("transform") || "";
      for (const part of raw.matchAll(
        /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g,
      )) {
        const v = part[2].trim().split(/[ ,]+/).map(Number);
        if (v.some((n) => !Number.isFinite(n)))
          throw Error("SVG transform contains invalid numbers.");
        switch (part[1]) {
          case "matrix":
            if (v.length !== 6) throw Error("Invalid SVG matrix.");
            m = m.multiply(new DOMMatrix(v));
            break;
          case "translate":
            m = m.translate(v[0], v[1] || 0);
            break;
          case "scale":
            m = m.scale(v[0], v[1] ?? v[0]);
            break;
          case "rotate":
            if (v.length === 3)
              m = m.translate(v[1], v[2]).rotate(v[0]).translate(-v[1], -v[2]);
            else m = m.rotate(v[0]);
            break;
          case "skewX":
            m = m.skewX(v[0]);
            break;
          case "skewY":
            m = m.skewY(v[0]);
            break;
        }
      }
    }
    return m;
  };
  for (const e of doc.querySelectorAll(
    "path,polygon,polyline,rect,circle,ellipse",
  )) {
    if (e.closest("defs,clipPath,mask,symbol")) continue;
    if (e.getAttribute("display") === "none") continue;
    const attr = (key: string, fallback = 0) => {
      const v = Number(e.getAttribute(key) ?? fallback);
      if (!Number.isFinite(v))
        throw Error("SVG shape coordinates must be finite numbers.");
      return v;
    };
    const paths: { points: Point[]; closed: boolean }[] = [];
    if (e.localName === "path") {
      const d = e.getAttribute("d") || "";
      if (/[^MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]/.test(d))
        throw Error("SVG path contains unsupported or invalid commands.");
      if (d.length > 300000)
        throw Error("SVG path is too complex. Simplify it before importing.");
      // Independent subpaths remain disconnected; no SVG is inserted into the page.
      let previousEnd: Point = [0, 0];
      for (const sub of d.match(/[Mm][^Mm]*/g) || []) {
        const p = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        let normalized = sub;
        if (sub[0] === "m") {
          const values = [
            ...sub
              .slice(1)
              .matchAll(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi),
          ].slice(0, 2);
          if (values.length !== 2)
            throw Error("An SVG move command is incomplete.");
          const rest = sub.slice(1 + values[1].index! + values[1][0].length);
          normalized = `M${previousEnd[0] + Number(values[0][0])},${previousEnd[1] + Number(values[1][0])} ${/^[\s,]*[+\-.\d]/.test(rest) ? "l" : ""}${rest}`;
        }
        p.setAttribute("d", normalized);
        let length: number;
        try {
          length = p.getTotalLength();
        } catch {
          throw Error("An SVG path could not be read.");
        }
        if (!length) continue;
        const end = p.getPointAtLength(length);
        previousEnd = [end.x, end.y];
        const count = Math.min(2048, Math.max(64, Math.ceil(length / 2)));
        paths.push({
          closed: /[zZ]\s*$/.test(sub),
          points: Array.from({ length: count + 1 }, (_, i) => {
            const q = p.getPointAtLength((length * i) / count);
            return [q.x, q.y];
          }),
        });
      }
    } else if (e.localName === "polygon" || e.localName === "polyline") {
      const values = (e.getAttribute("points") || "")
        .trim()
        .split(/[ ,\s]+/)
        .map(Number);
      if (values.length % 2) throw Error("SVG points must be x/y pairs.");
      paths.push({
        closed: e.localName === "polygon",
        points: Array.from({ length: values.length / 2 }, (_, i) => [
          values[i * 2],
          values[i * 2 + 1],
        ]),
      });
    } else if (e.localName === "rect") {
      const x = attr("x"),
        y = attr("y"),
        w = attr("width"),
        h = attr("height");
      paths.push({
        closed: true,
        points: [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ],
      });
    } else {
      const cx = attr("cx"),
        cy = attr("cy"),
        rx = attr(e.localName === "circle" ? "r" : "rx"),
        ry = attr(e.localName === "circle" ? "r" : "ry");
      paths.push({
        closed: true,
        points: Array.from({ length: 256 }, (_, i) => [
          cx + rx * Math.cos((i / 256) * Math.PI * 2),
          cy + ry * Math.sin((i / 256) * Math.PI * 2),
        ]),
      });
    }
    const m = matrix(e);
    for (const p of paths) {
      pointCount += p.points.length;
      if (pointCount > MAX_BOUNDARY_POINTS)
        throw Error("Use at most 50,000 boundary points.");
      rings.push({
        name:
          e.getAttribute("aria-label") ||
          e.querySelector("title")?.textContent ||
          undefined,
        closed: p.closed,
        points: p.points.map(([x, y]) => {
          const q = m.transformPoint({ x, y });
          return [q.x, q.y];
        }),
      });
    }
  }
  return ringsToBoundary(rings, name);
}
