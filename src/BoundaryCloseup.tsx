import type { Point } from "./engine";
import type { ValidationReport } from "./validation";

export type BoundaryPatch = {
  point: Point;
  distance: number;
  span: number;
  from: Point;
  to: Point;
};

export default function BoundaryCloseup({
  patch,
  errors,
  index,
  large = false,
}: {
  patch: BoundaryPatch;
  errors: ValidationReport["errors"];
  index: number;
  large?: boolean;
}) {
  const path = (points: Point[]) =>
    points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ") + "Z";
  const radius = (patch.span / (large ? 340 : 140)) * 2.5;
  return (
    <svg
      className={large ? "boundary-closeup-large" : undefined}
      viewBox={`${patch.point[0] - patch.span / 2} ${patch.point[1] - patch.span / 2} ${patch.span} ${patch.span}`}
      role="img"
      aria-label={`Close-up ${index + 1}: original and reconstructed boundary`}
    >
      {errors.map((e, j) => (
        <g key={j}>
          <path d={path(e.reference)} className="closeup-original" />
          <path d={path(e.path)} className="closeup-reconstruction" />
        </g>
      ))}
      <line
        x1={patch.from[0]}
        y1={patch.from[1]}
        x2={patch.to[0]}
        y2={patch.to[1]}
        className="closeup-deviation"
      />
      {[patch.from, patch.to].map((point, j) => (
        <circle
          key={j}
          cx={point[0]}
          cy={point[1]}
          r={radius}
          className="closeup-deviation"
        />
      ))}
    </svg>
  );
}
