import { memo, useEffect, useMemo, useState } from "react";
import { LoaderCircle, ScanLine } from "lucide-react";
import { request, type Config } from "./client";
import type { ValidationReport } from "./validation";
import { nearestOnBoundary } from "./validation";
import ScienceChart from "./ScienceChart";
import type { Point } from "./engine";
function StudioValidation({
  config,
  terms,
  cap,
}: {
  config: Config;
  terms: number;
  cap: number;
}) {
  const key = JSON.stringify([config, terms, cap]);
  const [data, setData] = useState<{ key: string; report: ValidationReport }>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [overlay, setOverlay] = useState(true),
    [heat, setHeat] = useState(true),
    [markers, setMarkers] = useState(true);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    let job: { cancel: () => void } | undefined;
    const timer = setTimeout(() => {
      const work = request<ValidationReport>("validate", config, {
        terms,
        cap,
      });
      job = work;
      work.promise
        .then((report) => {
          if (active) setData({ key, report });
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
      job?.cancel();
    };
  }, [key]);
  const report = data?.key === key ? data.report : undefined;
  const closeups = useMemo(() => {
    if (!report) return [];
    const largest = report.errors.reduce((a, b) =>
      a.max.distance > b.max.distance ? a : b,
    ).max;
    const span = Math.max(
      0.12,
      Math.min(
        0.45,
        Math.hypot(
          largest.from[0] - largest.to[0],
          largest.from[1] - largest.to[1],
        ) * 10,
      ),
    );
    const candidates = report.errors
      .flatMap((e) => [
        {
          point: [
            (e.max.from[0] + e.max.to[0]) / 2,
            (e.max.from[1] + e.max.to[1]) / 2,
          ] as Point,
          distance: e.max.distance,
          from: e.max.from,
          to: e.max.to,
          reference: e.reference,
        },
        ...e.path.map((point, j) => ({
          point,
          distance: e.distances[j],
          from: point,
          to: undefined as Point | undefined,
          reference: e.reference,
        })),
      ])
      .sort((a, b) => b.distance - a.distance);
    const selected: {
      point: Point;
      distance: number;
      span: number;
      from: Point;
      to: Point;
    }[] = [];
    for (const candidate of candidates) {
      if (
        selected.every(
          (p) =>
            Math.hypot(
              p.point[0] - candidate.point[0],
              p.point[1] - candidate.point[1],
            ) >
            span * 1.25,
        )
      ) {
        selected.push({
          ...candidate,
          span,
          to:
            candidate.to ||
            nearestOnBoundary(candidate.from, candidate.reference).point,
        });
        if (selected.length === 2) break;
      }
    }
    return selected;
  }, [report]);
  const max = Math.max(
    0.001,
    ...(report?.errors.map((e) => e.max.distance) || []),
  );
  const path = (ps: Point[]) =>
    ps
      .map((p, i) => `${i ? "L" : "M"}${220 + p[0] * 148},${178 + p[1] * 148}`)
      .join(" ") + "Z";
  const color = (v: number) =>
    `hsl(${220 - 220 * Math.min(1, v / max)} 70% 55%)`;
  const tail = report?.curve.filter((p) => p.n <= terms).slice(-3) || [];
  const gain =
    tail.length > 1
      ? ((tail[0].error - tail.at(-1)!.error) /
          Math.max(1, tail.at(-1)!.n - tail[0].n)) *
        10
      : undefined;
  return (
    <section
      className="surface studio-validation"
      aria-label="Reconstruction validation"
    >
      <div className="card-heading">
        <div>
          <span className="section-eyebrow">RECONSTRUCTION CHECK</span>
          <h2>Where detail makes a difference.</h2>
        </div>
        <span className="small-tag">N = {terms}</span>
      </div>
      {busy && (
        <p className="analysis-status" role="status">
          <LoaderCircle size={14} className="spin" /> Measuring boundaries and
          convergence…
        </p>
      )}
      {error && (
        <p className="note" role="alert">
          {error}
        </p>
      )}
      {report && (
        <>
          <div className="validation-grid">
            <div className="error-map-panel">
              <div className="error-map-controls">
                {[
                  ["Original overlay", overlay, setOverlay],
                  ["Error colours", heat, setHeat],
                  ["Max deviation", markers, setMarkers],
                ].map(([label, value, set]) => (
                  <label key={String(label)}>
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) =>
                        (set as (v: boolean) => void)(e.target.checked)
                      }
                    />
                    {String(label)}
                  </label>
                ))}
              </div>
              <svg
                viewBox="0 0 440 356"
                role="img"
                aria-label="Boundary error heatmap with maximum deviation markers"
              >
                {report.errors.map((e, i) => (
                  <g key={i}>
                    {overlay && (
                      <path
                        d={path(e.reference)}
                        fill="none"
                        stroke="var(--muted)"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    )}
                    {heat ? (
                      e.path.map((p, j) => {
                        const q = e.path[(j + 1) % e.path.length];
                        return (
                          <line
                            key={j}
                            x1={220 + p[0] * 148}
                            y1={178 + p[1] * 148}
                            x2={220 + q[0] * 148}
                            y2={178 + q[1] * 148}
                            stroke={color(e.distances[j])}
                            strokeWidth="2.2"
                          />
                        );
                      })
                    ) : (
                      <path
                        d={path(e.path)}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2"
                      />
                    )}
                    {markers && e.max.distance >= max * 0.8 && (
                      <g>
                        <line
                          x1={220 + e.max.from[0] * 148}
                          y1={178 + e.max.from[1] * 148}
                          x2={220 + e.max.to[0] * 148}
                          y2={178 + e.max.to[1] * 148}
                          stroke="#d75a53"
                          strokeWidth="2"
                        />
                        <circle
                          cx={220 + e.max.from[0] * 148}
                          cy={178 + e.max.from[1] * 148}
                          r="5"
                          fill="var(--surface)"
                          stroke="#d75a53"
                          strokeWidth="2"
                        >
                          <title>
                            Maximum deviation {e.max.distance.toFixed(2)}% of
                            diagonal
                          </title>
                        </circle>
                      </g>
                    )}
                  </g>
                ))}
                {closeups.map((p, i) => (
                  <g key={`focus-${i}`} className="error-map-focus">
                    <rect
                      x={220 + (p.point[0] - p.span / 2) * 148}
                      y={178 + (p.point[1] - p.span / 2) * 148}
                      width={p.span * 148}
                      height={p.span * 148}
                      rx="2"
                    />
                    <circle
                      cx={220 + (p.point[0] - p.span / 2) * 148}
                      cy={178 + (p.point[1] - p.span / 2) * 148}
                      r="8"
                    />
                    <text
                      x={220 + (p.point[0] - p.span / 2) * 148}
                      y={181 + (p.point[1] - p.span / 2) * 148}
                      textAnchor="middle"
                    >
                      {i + 1}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="error-map-key">
                <span>Lower error</span>
                <i />
                <span>Higher error</span>
                <b>Max {max.toFixed(2)}%</b>
              </div>
              <p className="note">
                Distance to the original dataset boundary · % of country
                diagonal. Markers show the largest sampled deviations.
              </p>
            </div>
            <aside
              className="error-closeups"
              aria-label="Magnified boundary details"
            >
              {closeups.map((p, i) => (
                <figure key={i}>
                  <figcaption>
                    <b>{i + 1}</b>{" "}
                    {i === 0 ? "Largest deviation" : "Another detail"}
                  </figcaption>
                  <svg
                    viewBox={`${220 + (p.point[0] - p.span / 2) * 148} ${178 + (p.point[1] - p.span / 2) * 148} ${p.span * 148} ${p.span * 148}`}
                    role="img"
                    aria-label={`Close-up ${i + 1}: original and reconstructed boundary`}
                  >
                    {report.errors.map((e, j) => (
                      <g key={j}>
                        <path
                          d={path(e.reference)}
                          className="closeup-original"
                        />
                        <path
                          d={path(e.path)}
                          className="closeup-reconstruction"
                        />
                      </g>
                    ))}
                    <line
                      x1={220 + p.from[0] * 148}
                      y1={178 + p.from[1] * 148}
                      x2={220 + p.to[0] * 148}
                      y2={178 + p.to[1] * 148}
                      className="closeup-deviation"
                    />
                    {[p.from, p.to].map((point, j) => (
                      <circle
                        key={j}
                        cx={220 + point[0] * 148}
                        cy={178 + point[1] * 148}
                        r={((p.span * 148) / 112) * 2}
                        className="closeup-deviation"
                      />
                    ))}
                  </svg>
                  <p>{p.distance.toFixed(2)}% deviation</p>
                </figure>
              ))}
              <div className="closeup-key">
                <span>Original</span>
                <span>Reconstructed</span>
                <span>Gap</span>
              </div>
            </aside>
            <div className="validation-summary">
              <div className="validation-metric">
                <span>Sampled contour similarity</span>
                <strong>
                  {report.sampled.similarity.toFixed(2)}
                  <small>%</small>
                </strong>
              </div>
              <div className="validation-metric">
                <span>Original dataset similarity</span>
                <strong>
                  {report.source.similarity.toFixed(2)}
                  <small>%</small>
                </strong>
              </div>
              <div className="validation-metric">
                <span>Shape detail captured</span>
                <strong>
                  {report.energy.toFixed(2)}
                  <small>%</small>
                </strong>
                <div
                  className="detail-captured-meter"
                  role="meter"
                  aria-label="Shape detail captured: retained spectral energy"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={report.energy}
                >
                  <i style={{ width: `${report.energy}%` }} />
                </div>
                <p className="detail-captured-note">
                  Contour variation kept by these terms. Use similarity to check
                  the boundary match.
                </p>
                <details className="detail-captured-definition">
                  <summary>How it’s measured</summary>
                  Spectral energy: the share of squared Fourier coefficients
                  retained, excluding the position term.
                </details>
              </div>
              <div className="validation-metric">
                <span>Mean dataset boundary error</span>
                <strong>
                  {report.source.mean.toFixed(2)}
                  <small>%</small>
                </strong>
              </div>
              <p className="validation-context">
                <ScanLine size={17} /> Sampled: resampled input. Dataset:
                original map boundaries. Both use approximate scoring, not
                real-world coastline accuracy.
              </p>
            </div>
          </div>
          <div className="convergence-grid">
            <ScienceChart
              points={report.curve}
              field="error"
              title="Boundary error as N grows"
              current={terms}
            />
            <ScienceChart
              points={report.curve}
              field="energy"
              title="Shape detail captured as N grows"
              explanation="How much of the sampled shape’s variation these terms retain. Higher means more is captured; boundary accuracy is shown by similarity."
              current={terms}
              color="#329779"
            />
          </div>
          <div className="convergence-summary">
            <b>
              {gain !== undefined && gain >= 0 && gain < 0.01
                ? "Small gains at this N"
                : "Detail is still changing"}
            </b>
            <span>
              {gain === undefined
                ? "Increase N to compare more levels."
                : gain < 0
                  ? "Measured boundary error fluctuates at these levels."
                  : `${gain.toFixed(3)} percentage points less boundary error per 10 added terms near N = ${terms}.`}
            </span>
          </div>
          <details className="sampling-validation">
            <summary>
              Contour sampling sensitivity <span>Same shape · same N</span>
            </summary>
            <table>
              <thead>
                <tr>
                  <th>Longest contour samples</th>
                  <th>Sampled similarity</th>
                  <th>Sampled error</th>
                  <th>Dataset error</th>
                  <th>Detail captured</th>
                </tr>
              </thead>
              <tbody>
                {report.sensitivity.map((s) => (
                  <tr
                    key={s.samples}
                    className={s.samples === config.samples ? "selected" : ""}
                  >
                    <td>
                      {s.samples}
                      {s.samples === config.samples ? " · current" : ""}
                    </td>
                    <td>{s.similarity.toFixed(2)}%</td>
                    <td>{s.error.toFixed(2)}%</td>
                    <td>{s.sourceError.toFixed(2)}%</td>
                    <td>{s.energy.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              N is capped by the available coefficients on each contour. Finer
              sampling can resolve detail the coarser input cannot represent.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
export default memo(
  StudioValidation,
  (a, b) =>
    a.terms === b.terms &&
    a.cap === b.cap &&
    a.config.country === b.config.country &&
    a.config.mode === b.config.mode &&
    a.config.samples === b.config.samples &&
    a.config.resolution === b.config.resolution,
);
