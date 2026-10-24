import { useEffect, useId, useState } from "react";
import type { Geometry } from "./engine";

const resolutions = ["50m", "110m"];
function coastline(geometry: Geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  // The same projected window around Norway's Lofoten coast in both datasets.
  return (polygons as number[][][][])
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          ring
            .map(
              ([lon, lat], index) =>
                `${index ? "L" : "M"}${(70 + (lon - 13.5) * Math.cos((68 * Math.PI) / 180) * 30).toFixed(2)},${(50 - (lat - 68) * 30).toFixed(2)}`,
            )
            .join(" ") + "Z",
      ),
    )
    .join(" ");
}
export default function ResolutionPreview({
  resolution,
  onChange,
}: {
  resolution: string;
  onChange: (resolution: string) => void;
}) {
  const [paths, setPaths] = useState<Record<string, string>>({}),
    [error, setError] = useState(false);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(
      resolutions.map(async (resolution) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/${resolution}-NOR.json`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Preview unavailable");
        return [
          resolution,
          coastline((await response.json()) as Geometry),
        ] as const;
      }),
    )
      .then((entries) => setPaths(Object.fromEntries(entries)))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <aside
      className="resolution-preview"
      aria-label="Geographic detail comparison"
    >
      <div className="resolution-preview-options">
        {resolutions.map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`Preview and select Natural Earth 1:${value}`}
            aria-pressed={resolution === value}
            onClick={() => onChange(value)}
          >
            <strong>1:{value}</strong>
            <svg
              viewBox="0 0 140 100"
              role="img"
              aria-label={`Norway coast at Natural Earth 1:${value}; same area and scale`}
            >
              <defs>
                <clipPath id={`${id}-${value}`}>
                  <rect width="140" height="100" rx="5" />
                </clipPath>
              </defs>
              {paths[value] ? (
                <path
                  d={paths[value]}
                  clipPath={`url(#${id}-${value})`}
                  fill="var(--accent-soft)"
                  fillRule="evenodd"
                  stroke="var(--accent)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              ) : (
                <text x="70" y="55" textAnchor="middle">
                  {error ? "Unavailable" : "Loading…"}
                </text>
              )}
            </svg>
            <span>
              {value === "50m" ? "More coastal detail" : "Simpler outline"}
            </span>
          </button>
        ))}
      </div>
      <p>Norway coast · same area and scale</p>
    </aside>
  );
}
