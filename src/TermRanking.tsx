import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownUp, ArrowUp } from "lucide-react";
import { Flag } from "./CountryPicker";
import { rankTermsFor99, type TermResult } from "./rankingData";
import type { Country } from "./engine";

export default function TermRanking({
  rows,
  countries,
  step,
  onSelect,
}: {
  rows: TermResult[];
  countries: Country[];
  step: number;
  onSelect: (id: string) => void;
}) {
  const [order, setOrder] = useState("fewer"),
    [active, setActive] = useState("");
  const ranked = useMemo(
    () => rankTermsFor99(rows, order === "more"),
    [rows, order],
  );
  const reduced = useReducedMotion(),
    gradient = useId().replace(/:/g, "");
  const plot = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(760);
  useEffect(() => {
    if (!plot.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, []);
  const maximum = Math.max(1, ...ranked.map((r) => r.terms ?? r.row.cap));
  const tickStep =
    maximum <= 50 ? 10 : maximum <= 100 ? 25 : maximum <= 250 ? 50 : 100;
  const ceiling = Math.max(tickStep, Math.ceil(maximum / tickStep) * tickStep);
  const left = 48,
    right = 22,
    top = 30,
    bottom = 214;
  const x = (i: number) =>
    left +
    (ranked.length > 1 ? i / (ranked.length - 1) : 0.5) *
      (width - left - right);
  const y = (n: number) => bottom - (n / ceiling) * (bottom - top);
  const points = ranked.map((r, i) => ({
    ...r,
    x: x(i),
    y: y(r.terms ?? r.row.cap),
    country: countries.find((c) => c.id === r.row.id),
  }));
  const selected = points.find((p) => p.row.id === active) || points.at(-1);
  const animationKey = `${order}-${ranked.map((r) => `${r.row.id}:${r.terms ?? `>${r.row.cap}`}`).join("-")}`;
  const segments: (typeof points)[] = [];
  for (const point of points) {
    if (point.terms === undefined) {
      if (segments.at(-1)?.length) segments.push([]);
    } else {
      if (!segments.length) segments.push([]);
      segments.at(-1)!.push(point);
    }
  }
  const paths = segments
    .filter((s) => s.length)
    .map((s) => ({
      line: s.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
      area: `${s.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")} L${s.at(-1)!.x},${bottom} L${s[0].x},${bottom} Z`,
    }));
  return (
    <section
      className="surface term-ranking"
      aria-label="Countries ordered by terms to reach 99 percent"
    >
      <div className="card-heading">
        <div>
          <span className="section-eyebrow">TERMS FOR 99%</span>
          <h2>Detail, by the numbers.</h2>
        </div>
        <label className="term-order">
          <ArrowDownUp size={15} />
          <select
            aria-label="Country term order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="fewer">Fewer terms first</option>
            <option value="more">More terms first</option>
          </select>
        </label>
      </div>
      <p className="term-ranking-intro">
        First tested N to reach 99% similarity · {ranked.length} countries
      </p>
      <div className="ranking-chart-detail" aria-live="polite">
        {selected ? (
          <>
            <Flag country={selected.country} />
            <span>{selected.country?.name || selected.row.id}</span>
            <strong>
              {selected.terms ?? `>${selected.row.cap}`}
              <small> N</small>
            </strong>
            {selected.terms === undefined && (
              <span className="ranking-budget-label">Budget limit</span>
            )}
          </>
        ) : (
          <span>Calculate remaining to build this chart.</span>
        )}
      </div>
      <div
        className="ranking-chart-scroll"
        tabIndex={0}
        aria-label="Country ranking plot; scroll horizontally on small screens"
      >
        <div className="ranking-chart-plot" ref={plot}>
          <svg
            viewBox={`0 0 ${width} 238`}
            role="img"
            aria-label={`Line chart of Fourier terms to reach 99 percent, ${order === "fewer" ? "ascending" : "descending"} country order`}
          >
            <defs>
              <linearGradient
                id={`ranking-fill-${gradient}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".18" />
                <stop
                  offset="100%"
                  stopColor="var(--accent)"
                  stopOpacity=".015"
                />
              </linearGradient>
            </defs>
            <text x={left} y="13" className="ranking-axis-title">
              Fourier terms (N)
            </text>
            {Array.from(
              { length: Math.round(ceiling / tickStep) + 1 },
              (_, i) => i * tickStep,
            ).map((n) => (
              <g key={n}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(n)}
                  y2={y(n)}
                  stroke="var(--border)"
                  strokeDasharray={n ? "3 5" : undefined}
                />
                <text x={left - 12} y={y(n) + 4} textAnchor="end">
                  {n}
                </text>
              </g>
            ))}
            {selected && (
              <line
                x1={selected.x}
                x2={selected.x}
                y1={top}
                y2={bottom + 7}
                stroke="var(--accent)"
                opacity=".25"
                strokeDasharray="3 4"
              />
            )}
            {paths.map((path, i) => (
              <g key={`${animationKey}-${i}`}>
                <motion.path
                  d={path.area}
                  fill={`url(#ranking-fill-${gradient})`}
                  initial={{ opacity: reduced ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduced ? 0 : 0.8 }}
                />
                <motion.path
                  d={path.line}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduced ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: reduced ? 0 : 1.1,
                    ease: "easeInOut",
                  }}
                />
              </g>
            ))}
            {points.map((p, i) => (
              <motion.g
                key={`${animationKey}-${p.row.id}`}
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: reduced ? 0 : i * 0.035 }}
                onMouseEnter={() => setActive(p.row.id)}
                className="ranking-chart-point"
              >
                <title>
                  {p.country?.name || p.row.id}:{" "}
                  {p.terms ?? `over ${p.row.cap}`} Fourier terms
                </title>
                {p.terms === undefined ? (
                  <>
                    <path
                      d={`M${p.x - 4},${p.y - 5}L${p.x},${p.y - 10}L${p.x + 4},${p.y - 5} M${p.x},${p.y - 10}V${p.y + 4}`}
                      stroke="#a87b32"
                      strokeWidth="1.8"
                      fill="none"
                    />
                    <circle
                      cx={p.x}
                      cy={p.y + 7}
                      r="3"
                      stroke="#a87b32"
                      fill="var(--surface)"
                    />
                  </>
                ) : (
                  <>
                    <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={selected?.row.id === p.row.id ? 5.5 : 4}
                      fill="var(--surface)"
                      stroke="var(--accent)"
                      strokeWidth="2.4"
                    />
                  </>
                )}
              </motion.g>
            ))}
          </svg>
          <div className="ranking-chart-flags">
            {points.map((p) => (
              <button
                key={p.row.id}
                style={{ left: `${(p.x / width) * 100}%` }}
                className={selected?.row.id === p.row.id ? "selected" : ""}
                aria-label={`${p.country?.name || p.row.id}: ${p.terms ?? `over ${p.row.cap}`} terms; view country`}
                title={p.country?.name || p.row.id}
                onPointerEnter={() => setActive(p.row.id)}
                onFocus={() => setActive(p.row.id)}
                onClick={() => onSelect(p.row.id)}
              >
                <Flag country={p.country} />
                <small>{p.row.id}</small>
              </button>
            ))}
          </div>
          {!points.length && (
            <div className="ranking-line-empty">
              Your measured country curve will appear here.
            </div>
          )}
        </div>
      </div>
      <div className="ranking-chart-key">
        <span>
          <i />
          Measured N at 99%
        </span>
        <span>
          <ArrowUp size={12} />
          99% not reached within budget
        </span>
        <span className="ranking-swipe-hint">Swipe to explore →</span>
      </div>
      <p className="term-ranking-note">
        Countries ordered by N · search step {step}. Hover a point or flag to
        inspect; select a flag to view its country.
      </p>
    </section>
  );
}
