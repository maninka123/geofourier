import { memo, useEffect, useState } from "react";
import { LoaderCircle, ScanLine } from "lucide-react";
import { request, type Config } from "./client";
import type { ValidationReport } from "./validation";
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
                <span>Spectral energy retained</span>
                <strong>
                  {report.energy.toFixed(2)}
                  <small>%</small>
                </strong>
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
              title="Spectral energy retained"
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
                  <th>Energy</th>
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
