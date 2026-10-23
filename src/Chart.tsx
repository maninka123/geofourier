import { useEffect, useRef, useState } from "react";
import type { CurvePoint } from "./engine";
export default function Chart({
  points,
  target = 98,
  current,
  max = 500,
  label = "Measured reconstruction accuracy",
}: {
  points: CurvePoint[];
  target?: number;
  current?: number;
  max?: number;
  label?: string;
}) {
  const [hover, setHover] = useState<CurvePoint>();
  const container = useRef<HTMLDivElement>(null);
  const [w, setWidth] = useState(700);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const h = 245,
    left = 50,
    right = 24,
    top = 24,
    bottom = 38,
    x = (n: number) => left + (n / max) * (w - left - right),
    y = (n: number) => top + ((100 - n) / 100) * (h - top - bottom);
  return (
    <div className="chart" ref={container}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {[0, 25, 50, 75, 100].map((n) => (
          <g key={n}>
            <line
              x1={left}
              y1={y(n)}
              x2={w - right}
              y2={y(n)}
              stroke="var(--border)"
            />
            <text x={left - 10} y={y(n) + 4} textAnchor="end">
              {n}%
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <text key={p} x={x(max * p)} y={h - 10} textAnchor="middle">
            {Math.round(max * p)}
          </text>
        ))}
        <line
          x1={left}
          x2={w - right}
          y1={y(target)}
          y2={y(target)}
          stroke="#c1a168"
          strokeDasharray="4 5"
        />
        <text x={w - right} y={y(target) + 15} textAnchor="end" fill="#a27f3d">
          {target}% target
        </text>
        {current !== undefined && (
          <line
            x1={x(current)}
            x2={x(current)}
            y1={top}
            y2={h - bottom}
            stroke="var(--accent)"
            strokeDasharray="3 4"
            opacity=".4"
          />
        )}
        {points.length > 0 && (
          <>
            <path
              d={`M ${x(points[0].terms)} ${y(points[0].similarity)} ${points
                .slice(1)
                .map((p) => `L ${x(p.terms)} ${y(p.similarity)}`)
                .join(
                  " ",
                )} L ${x(points.at(-1)!.terms)} ${y(0)} L ${x(points[0].terms)} ${y(0)} Z`}
              fill="var(--accent)"
              opacity=".05"
            />
            <polyline
              points={points
                .map((p) => `${x(p.terms)},${y(p.similarity)}`)
                .join(" ")}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {points.map((p) => (
              <circle
                key={p.terms}
                cx={x(p.terms)}
                cy={y(p.similarity)}
                r={hover === p ? 5 : 3}
                fill="var(--accent)"
                tabIndex={0}
                role="img"
                aria-label={`${p.terms} terms: ${p.similarity.toFixed(2)}%`}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(undefined)}
                onFocus={() => setHover(p)}
                onBlur={() => setHover(undefined)}
              />
            ))}
          </>
        )}
      </svg>
      {points.length === 0 && (
        <div className="chart-empty">
          Run an analysis to reveal the measured accuracy curve.
        </div>
      )}
      {hover && (
        <div className="chart-tooltip">
          N = {hover.terms} <b>{hover.similarity.toFixed(2)}%</b>
        </div>
      )}
      <span className="axis-label">FOURIER TERMS</span>
    </div>
  );
}
