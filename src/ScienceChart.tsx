import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { termAxisPosition, termAxisTicks } from "./chartScale";
export default function ScienceChart({
  points,
  field,
  title,
  color = "var(--accent)",
  unit = "%",
  current,
  explanation,
}: {
  points: { n: number; [key: string]: number }[];
  field: string;
  title: string;
  color?: string;
  unit?: string;
  current?: number;
  explanation?: string;
}) {
  const [active, setActive] = useState<number>();
  const [explaining, setExplaining] = useState(false);
  const explanationId = useId();
  const [w, setWidth] = useState(620),
    root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, entry.contentRect.width)),
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const h = 190,
    l = 52,
    r = 16,
    t = 20,
    b = 32,
    maxN = Math.max(2, ...points.map((p) => p.n)),
    ymax = Math.max(0.01, ...points.map((p) => p[field]));
  const top = field === "energy" ? 100 : ymax * 1.12;
  const x = (n: number) => l + termAxisPosition(n, maxN) * (w - l - r),
    y = (v: number) => t + (1 - v / top) * (h - t - b);
  const currentIndex = points.findIndex((p) => p.n === current);
  const selectedIndex =
    active ?? (currentIndex >= 0 ? currentIndex : points.length - 1);
  const p = points[selectedIndex];
  return (
    <div className="science-chart" ref={root}>
      <div className="science-chart-heading">
        <div className="science-chart-title">
          <b>{title}</b>
          {explanation && (
            <button
              className="chart-info-button"
              aria-label={`Explain ${title}`}
              aria-expanded={explaining}
              aria-controls={explanationId}
              onClick={() => setExplaining((value) => !value)}
              title="What does this mean?"
            >
              <Info size={14} />
            </button>
          )}
        </div>
        <output>
          {p ? `${p[field].toFixed(2)}${unit} · N ${p.n}` : "Preparing…"}
        </output>
      </div>
      {explanation && explaining && (
        <p id={explanationId} className="science-chart-explanation">
          {explanation}
        </p>
      )}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${title} against Fourier terms`}
        onPointerMove={(e) => {
          if (!points.length) return;
          const rect = e.currentTarget.getBoundingClientRect(),
            px = ((e.clientX - rect.left) / rect.width) * w;
          setActive(
            points.reduce(
              (best, p, i) =>
                Math.abs(x(p.n) - px) < Math.abs(x(points[best].n) - px)
                  ? i
                  : best,
              0,
            ),
          );
        }}
        onPointerLeave={() => setActive(undefined)}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={l}
              x2={w - r}
              y1={y(f * top)}
              y2={y(f * top)}
              stroke="var(--border)"
            />
            <text x={l - 9} y={y(f * top) + 4} textAnchor="end">
              {(f * top).toFixed(top < 1 ? 2 : 1)}
              {unit}
            </text>
          </g>
        ))}
        {termAxisTicks(maxN, w - l - r).map((n) => (
          <text x={x(n)} y={h - 8} textAnchor="middle" key={n}>
            {n}
          </text>
        ))}
        <path
          d={points
            .map((p, i) => `${i ? "L" : "M"}${x(p.n)},${y(p[field])}`)
            .join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
        />
        {current !== undefined && (
          <line
            x1={x(current)}
            x2={x(current)}
            y1={t}
            y2={h - b}
            stroke="var(--accent)"
            strokeDasharray="3 4"
            opacity=".4"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={p.n}
            cx={x(p.n)}
            cy={y(p[field])}
            r={selectedIndex === i ? 5 : 3}
            fill="var(--surface)"
            stroke={color}
            strokeWidth="2"
            tabIndex={0}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(undefined)}
          >
            <title>
              N {p.n}: {p[field].toFixed(2)}
              {unit}
            </title>
          </circle>
        ))}
      </svg>
      <small className="chart-axis-label">FOURIER TERMS (N)</small>
    </div>
  );
}
