import type { Point } from "./engine";
type Edge = { a: Point; b: Point; x: number; y: number };
type Node = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  edges?: Edge[];
  left?: Node;
  right?: Node;
};
const cache = new WeakMap<Point[], Node>();
function build(edges: Edge[]): Node {
  const node: Node = {
    xmin: Infinity,
    ymin: Infinity,
    xmax: -Infinity,
    ymax: -Infinity,
  };
  for (const e of edges) {
    node.xmin = Math.min(node.xmin, e.a[0], e.b[0]);
    node.xmax = Math.max(node.xmax, e.a[0], e.b[0]);
    node.ymin = Math.min(node.ymin, e.a[1], e.b[1]);
    node.ymax = Math.max(node.ymax, e.a[1], e.b[1]);
  }
  if (edges.length <= 8) node.edges = edges;
  else {
    const axis = node.xmax - node.xmin > node.ymax - node.ymin ? "x" : "y";
    edges.sort((a, b) => a[axis] - b[axis]);
    const mid = edges.length >> 1;
    node.left = build(edges.slice(0, mid));
    node.right = build(edges.slice(mid));
  }
  return node;
}
function lowerBound(n: Node, p: Point) {
  const dx = Math.max(n.xmin - p[0], 0, p[0] - n.xmax),
    dy = Math.max(n.ymin - p[1], 0, p[1] - n.ymax);
  return dx * dx + dy * dy;
}
function nearest(n: Node, p: Point, best: number): number {
  if (lowerBound(n, p) >= best) return best;
  if (n.edges) {
    for (const { a, b } of n.edges) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
      best = Math.min(
        best,
        (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2,
      );
    }
    return best;
  }
  const [first, second] =
    lowerBound(n.left!, p) < lowerBound(n.right!, p)
      ? [n.left!, n.right!]
      : [n.right!, n.left!];
  return nearest(second, p, nearest(first, p, best));
}
export function boundaryDistance(point: Point, ring: Point[]) {
  if (!ring.length) return Infinity;
  let node = cache.get(ring);
  if (!node) {
    node = build(
      ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length];
        return { a, b, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
      }),
    );
    cache.set(ring, node);
  }
  return Math.sqrt(nearest(node, point, Infinity));
}
