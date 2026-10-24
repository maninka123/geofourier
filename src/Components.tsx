import { memo, useMemo, useState } from "react";
import { ArrowUpRight, Layers3 } from "lucide-react";
import Modal from "./Modal";
import type { Analysis, Point } from "./engine";
import { componentResults } from "./validation";
function Thumbnail({ points, path }: { points: Point[]; path: Point[] }) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    ymin = Math.min(...ys),
    ymax = Math.max(...ys);
  const scale = 46 / Math.max(xmax - xmin, ymax - ymin, 1e-9),
    cx = (xmax + xmin) / 2,
    cy = (ymax + ymin) / 2;
  const d = (ps: Point[]) =>
    ps
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${28 + (p[0] - cx) * scale},${28 + (p[1] - cy) * scale}`,
      )
      .join(" ") + "Z";
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true">
      <path d={d(points)} fill="var(--accent-soft)" stroke="var(--muted)" />
      <path d={d(path)} fill="none" stroke="var(--accent)" strokeWidth="1.2" />
    </svg>
  );
}
function Components({
  analysis,
  label = "Components",
  tile = false,
}: {
  analysis?: Analysis;
  label?: string;
  tile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [captured, setCaptured] = useState<Analysis>();
  const detail = captured || analysis;
  const count = analysis?.model.contours.filter((c) => !c.hole).length || 0;
  // Computing the individual scores is deferred until the popup is opened.
  const rows = useMemo(
    () => (open && detail ? componentResults(detail) : []),
    [open, detail],
  );
  return (
    <>
      <button
        className={
          tile ? "main-stat component-stat" : "component-details-button"
        }
        disabled={!analysis}
        onClick={() => {
          setCaptured(analysis);
          setOpen(true);
        }}
        aria-label={`View ${count} components`}
      >
        {tile ? (
          <>
            <span className="stat-label">
              Components <Layers3 size={12} />
            </span>
            <strong>{count}</strong>
            <span className="stat-description">
              View land areas <ArrowUpRight size={12} />
            </span>
          </>
        ) : (
          <>
            <Layers3 size={14} />
            <span>{label}</span>
            <b>{count}</b>
            <ArrowUpRight size={12} />
          </>
        )}
      </button>
      {open && detail && (
        <Modal
          title="Land areas, in detail"
          wide
          onClose={() => setOpen(false)}
        >
          <div className="component-dialog-intro">
            <span>
              <b>{count}</b> land {count === 1 ? "area" : "areas"} · N ={" "}
              {detail.terms} per contour
            </span>
            <small>
              {detail.model.contours.filter((c) => c.hole).length} interior{" "}
              {detail.model.contours.filter((c) => c.hole).length === 1
                ? "hole"
                : "holes"}
            </small>
          </div>
          <p className="note">
            Each land area has its own series. Similarity is measured
            separately; boundary errors use the country diagonal.
          </p>
          <div className="component-table-wrap">
            <table className="component-table">
              <thead>
                <tr>
                  <th>Land area</th>
                  <th>Terms used</th>
                  <th>Similarity</th>
                  <th>Mean error</th>
                  <th>Max error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.group}>
                    <td>
                      <div className="component-name">
                        <Thumbnail points={r.points} path={r.path} />
                        <span>
                          <b>
                            {r.name ||
                              (i === 0
                                ? "Main outline"
                                : "Land area " + (i + 1))}
                          </b>
                          <small>
                            {i === 0
                              ? "Largest land area"
                              : r.name
                                ? "Separate land area"
                                : "Name unavailable"}
                            {r.holes
                              ? ` · ${r.holes} interior ${r.holes === 1 ? "hole" : "holes"}`
                              : ""}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{r.terms}</td>
                    <td>{r.metrics.similarity.toFixed(2)}%</td>
                    <td>{r.metrics.mean.toFixed(2)}%</td>
                    <td>{r.metrics.max.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.some((r) => !r.name) && (
            <p className="note">
              Names appear where available; other areas keep neutral labels.
            </p>
          )}
          {detail.model.namesSource && (
            <p className="note">
              Island names:{" "}
              <a
                href="https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/"
                target="_blank"
                rel="noreferrer"
              >
                Natural Earth physical labels
              </a>
              .
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
export default memo(Components);
