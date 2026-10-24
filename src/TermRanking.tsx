import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownUp, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { Flag } from "./CountryPicker";
import { rankTermsFor99, type TermResult } from "./rankingData";
import type { Country } from "./engine";

export default function TermRanking({
  rows,
  countries,
  step,
  selectedId,
  onSelect,
}: {
  rows: TermResult[];
  countries: Country[];
  step: number;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [order, setOrder] = useState("more"),
    [active, setActive] = useState("");
  const ranked = useMemo(
    () => rankTermsFor99(rows, order === "more"),
    [rows, order],
  );
  const reduced = useReducedMotion(),
    gradient = useId().replace(/:/g, "");
  const plot = useRef<HTMLDivElement>(null),
    scroller = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(760);
  const scrolledSelection = useRef(selectedId);
  useEffect(() => {
    if (scrolledSelection.current === selectedId) return;
    const flag = plot.current?.querySelector<HTMLButtonElement>(
      `button[data-country="${selectedId}"]`,
    );
    if (!flag || !scroller.current) return;
    scrolledSelection.current = selectedId;
    setActive(selectedId);
    scroller.current.scrollTo({
      left: Math.max(0, flag.offsetLeft - scroller.current.clientWidth / 2),
      behavior: reduced ? "instant" : "smooth",
    });
  }, [selectedId, ranked, reduced]);
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
  const left = 64,
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
  const selected =
    points.find((p) => p.row.id === active) ||
    points.find((p) => p.row.id === selectedId) ||
    points[0];
  const scrollCountries = (direction: number) =>
    scroller.current?.scrollBy({
      left: direction * scroller.current.clientWidth * 0.75,
      behavior: reduced ? "instant" : "smooth",
    });
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
        First tested N to reach 99% similarity · all {ranked.length} measured
        countries
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
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label="Country ranking plot; scroll horizontally to explore all countries"
      >
        <div className="ranking-chart-axis" aria-hidden="true">
          <svg viewBox="0 0 54 224">
            <text x="3" y="13" className="ranking-fixed-axis-title">
              Terms (N)
            </text>
            {Array.from(
              { length: Math.round(ceiling / tickStep) + 1 },
              (_, i) => i * tickStep,
            ).map((n) => (
              <text key={n} x="44" y={y(n) + 4} textAnchor="end">
                {n}
              </text>
            ))}
          </svg>
        </div>
        <div
          className="ranking-chart-plot"
          ref={plot}
          style={{
            minWidth: ranked.length
              ? Math.max(700, ranked.length * 56 + 70)
              : 0,
          }}
        >
          <svg
            viewBox={`0 0 ${width} 238`}
            role="img"
            aria-label={`Line chart of Fourier terms to reach 99 percent, ${order === "fewer" ? "ascending" : "descending"} country order`}
            onPointerMove={(event) => {
              if (!points.length) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const position =
                (((event.clientX - rect.left) / rect.width) * width - left) /
                (width - left - right);
              setActive(
                points[
                  Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      Math.round(position * (points.length - 1)),
                    ),
                  )
                ].row.id,
              );
            }}
            onPointerLeave={() => setActive("")}
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
                transition={{
                  duration: 0.2,
                  delay: reduced ? 0 : Math.min(i * 0.02, 0.5),
                }}
                onMouseEnter={() => setActive(p.row.id)}
                onClick={() => onSelect(p.row.id)}
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
                data-country={p.row.id}
                style={{ left: `${(p.x / width) * 100}%` }}
                className={`${selected?.row.id === p.row.id ? "selected" : ""} ${selectedId === p.row.id ? "current-country" : ""}`}
                aria-pressed={selectedId === p.row.id}
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
        <div className="ranking-scroll-controls">
          <span>Scroll to explore all countries</span>
          <button
            className="icon-button"
            aria-label="Scroll countries left"
            onClick={() => scrollCountries(-1)}
            disabled={!points.length}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Scroll countries right"
            onClick={() => scrollCountries(1)}
            disabled={!points.length}
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <p className="term-ranking-note">
        Countries ordered by N · search step {step}. Hover a point or flag to
        inspect; select a flag to view its country.
      </p>
    </section>
  );
}
