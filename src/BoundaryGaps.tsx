import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { errorDistribution } from "./errorDistribution";
import type { ValidationReport } from "./validation";
export default function BoundaryGaps({
  errors,
}: {
  errors: ValidationReport["errors"];
}) {
  const data = useMemo(
    () => errorDistribution(errors.flatMap((e) => e.distances)),
    [errors],
  );
  const [active, setActive] = useState<number>(),
    [help, setHelp] = useState(false);
  const helpId = useId();
  const [width, setWidth] = useState(480);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, entry.contentRect.width)),
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const w = width,
    h = 136,
    left = 34,
    right = 12,
    top = 14,
    bottom = 28;
  const peak = Math.max(1, ...data.bins.map((b) => b.percent));
  const barWidth = (w - left - right) / data.bins.length;
  const selected = active === undefined ? undefined : data.bins[active];
  return (
    <section
      ref={root}
      className="boundary-gaps"
      aria-label="Boundary gap distribution"
    >
      <div className="boundary-gaps-heading">
        <h3>Where the gaps fall</h3>
        <button
          className="chart-info-button"
          aria-label="Explain boundary gap distribution"
          aria-expanded={help}
          aria-controls={helpId}
          onClick={() => setHelp(!help)}
        >
          <Info size={13} />
        </button>
        <output>
          {selected
            ? `${selected.percent.toFixed(2)}% of samples`
            : `90% of samples ≤ ${(Math.ceil(data.p90 * 100) / 100).toFixed(2)}%`}
        </output>
      </div>
      {help && (
        <p id={helpId} className="boundary-gaps-help">
          Each bar groups reconstructed outline points by their distance from
          the original boundary. Left means closer. Gap values use the country
          diagonal; counts reflect contour sampling.
        </p>
      )}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Distribution of reconstructed outline point distances to the original map boundary"
        onPointerLeave={() => setActive(undefined)}
      >
        {[0, 1].map((f) => (
          <g key={f}>
            <line
              x1={left}
              x2={w - right}
              y1={h - bottom - f * (h - top - bottom)}
              y2={h - bottom - f * (h - top - bottom)}
              stroke="var(--border)"
            />
            <text
              x={left - 7}
              y={h - bottom - f * (h - top - bottom) + 4}
              textAnchor="end"
            >
              {Math.round(f * peak)}%
            </text>
          </g>
        ))}
        {data.bins.map((bin, i) => {
          const height = (bin.percent / peak) * (h - top - bottom);
          return (
            <rect
              key={i}
              x={left + i * barWidth + 2}
              y={h - bottom - height}
              width={barWidth - 4}
              height={Math.max(bin.count ? 2 : 0, height)}
              rx="3"
              fill={`hsl(${220 - (i / (data.bins.length - 1)) * 220} 65% 55%)`}
              opacity={active === undefined || active === i ? 0.85 : 0.35}
              tabIndex={bin.count ? 0 : -1}
              role="img"
              aria-label={`${bin.percent.toFixed(2)} percent of samples have a gap from ${bin.from.toFixed(2)} to ${bin.to.toFixed(2)} percent`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(undefined)}
            >
              <title>{`${bin.from.toFixed(2)}–${bin.to.toFixed(2)}% gap · ${bin.count} samples`}</title>
            </rect>
          );
        })}
        {[0, 0.5, 1].map((f) => (
          <text
            key={f}
            x={left + f * (w - left - right)}
            y={h - 8}
            textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
          >
            {(f * data.max).toFixed(2)}%
          </text>
        ))}
      </svg>
      <div className="boundary-gaps-foot">
        <span>Closer to the original</span>
        <span>
          {selected
            ? `${selected.from.toFixed(2)}–${selected.to.toFixed(2)}% gap`
            : "Larger gaps →"}
        </span>
      </div>
    </section>
  );
}
