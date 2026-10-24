import { memo, useEffect, useMemo, useState } from "react";
import { prepare, type Geometry, type Point } from "./engine";

const examples = [
  { id: "JPN", name: "Japan", flag: "jp" },
  { id: "ZAF", name: "South Africa", flag: "za" },
];
const area = (points: Point[]) =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + p[0] * next[1] - next[0] * p[1];
    }, 0),
  );
const path = (
  points: Point[],
  frame: { cx: number; cy: number; scale: number },
) =>
  points
    .map(
      ([x, y], i) =>
        `${i ? "L" : "M"}${(70 + (x - frame.cx) * frame.scale).toFixed(2)},${(68 + (y - frame.cy) * frame.scale).toFixed(2)}`,
    )
    .join(" ") + "Z";

export default memo(function GeometryPreview({
  mode,
  resolution,
}: {
  mode: string;
  resolution: string;
}) {
  const [data, setData] = useState<{
      resolution: string;
      geometries: Geometry[];
    }>(),
    [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void Promise.all(
      examples.map(async ({ id }) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/${resolution}-${id}.json`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Preview unavailable");
        return (await response.json()) as Geometry;
      }),
    )
      .then((geometries) => setData({ resolution, geometries }))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [resolution]);
  const models = useMemo(
    () =>
      data?.resolution === resolution
        ? data.geometries.map((g) => prepare(g, 256, "full"))
        : [],
    [data, resolution],
  );
  return (
    <aside className="geometry-preview" aria-label="Geometry mode examples">
      <span className="section-eyebrow">GEOMETRY PREVIEW</span>
      <div className="geometry-preview-examples">
        {examples.map((example, i) => {
          const model = models[i];
          const exteriors = model?.contours.filter((c) => !c.hole) || [];
          const main = exteriors.reduce<(typeof exteriors)[number] | undefined>(
            (largest, c) =>
              !largest || area(c.points) > area(largest.points) ? c : largest,
            undefined,
          );
          const selected =
            mode === "main"
              ? main
                ? [main]
                : []
              : mode === "exterior"
                ? exteriors
                : model?.contours || [];
          const holes = selected.filter((c) => c.hole).length;
          const positions = model?.contours.flatMap((c) => c.points) || [];
          const xs = positions.map((p) => p[0]),
            ys = positions.map((p) => p[1]);
          const xmin = Math.min(...xs),
            xmax = Math.max(...xs),
            ymin = Math.min(...ys),
            ymax = Math.max(...ys);
          const frame = positions.length
            ? {
                cx: (xmin + xmax) / 2,
                cy: (ymin + ymax) / 2,
                scale: Math.min(
                  120 / Math.max(xmax - xmin, 1e-9),
                  116 / Math.max(ymax - ymin, 1e-9),
                ),
              }
            : { cx: 0, cy: 0, scale: 61 };
          return (
            <figure key={example.id}>
              <figcaption>
                <img src={`https://flagcdn.com/${example.flag}.svg`} alt="" />
                {example.name}
              </figcaption>
              <svg
                viewBox="0 0 140 136"
                role="img"
                aria-label={`${example.name}: ${mode === "main" ? "main outline" : mode === "exterior" ? "all exterior land areas" : "full geometry including interior holes"}`}
              >
                <g key={mode} className="geometry-preview-shape">
                  <path
                    d={selected.map((c) => path(c.points, frame)).join(" ")}
                    fill="var(--accent-soft)"
                    fillRule="evenodd"
                    stroke="var(--accent)"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  {selected
                    .filter((c) => c.hole)
                    .map((c, index) => (
                      <path
                        key={index}
                        d={path(c.points, frame)}
                        fill="var(--surface)"
                        stroke="#ba7c21"
                        strokeWidth="1.8"
                      />
                    ))}
                </g>
                {!model && (
                  <text x="70" y="72" textAnchor="middle">
                    {error ? "Unavailable" : "Loading…"}
                  </text>
                )}
              </svg>
              <small>
                {model
                  ? `${selected.filter((c) => !c.hole).length} land ${selected.filter((c) => !c.hole).length === 1 ? "area" : "areas"}${holes ? ` · ${holes} interior ${holes === 1 ? "hole" : "holes"}` : ""}`
                  : ""}
              </small>
            </figure>
          );
        })}
      </div>
      <p>
        {mode === "main"
          ? "One main outline. Islands and holes excluded."
          : mode === "exterior"
            ? "Separate islands included. Interior holes filled."
            : "Islands and interior holes included. Holes outlined in gold."}
      </p>
    </aside>
  );
});
