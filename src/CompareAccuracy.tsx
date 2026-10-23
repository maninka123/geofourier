import { useEffect, useRef, useState } from "react";
import { ArrowRight, Square } from "lucide-react";
import Chart from "./Chart";
import { Flag } from "./CountryPicker";
import { runSearch, type Config } from "./client";
import type { Country, CurvePoint } from "./engine";
import type { Settings } from "./Controls";
export default function CompareAccuracy({
  ids,
  countries,
  config,
  settings,
  colors,
}: {
  ids: string[];
  countries: Country[];
  config: Config;
  settings: Settings;
  colors: string[];
}) {
  const key = `${ids.join(":")}-${config.resolution}-${config.samples}-${config.mode}-${settings.cap}-${settings.step}-${settings.maxTime}`;
  const [data, setData] = useState<{
      key: string;
      curves: Record<string, CurvePoint[]>;
    }>(),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const jobs = useRef<ReturnType<typeof runSearch>[]>([]),
    version = useRef(0);
  useEffect(() => {
    setRunning(false);
    setError("");
    return () => {
      version.current++;
      jobs.current.forEach((j) => j.cancel());
    };
  }, [key]);
  const calculate = async () => {
    if (running) {
      jobs.current.forEach((j) => j.cancel());
      return;
    }
    const v = ++version.current;
    setRunning(true);
    setError("");
    const curves: Record<string, CurvePoint[]> = {};
    jobs.current = [];
    setData({ key, curves: {} });
    try {
      await Promise.all(
        [...new Set(ids)].map(async (id) => {
          const points: CurvePoint[] = [];
          const job = runSearch(
            { ...config, country: id },
            101,
            Math.min(settings.cap, settings.samples),
            settings.step,
            settings.maxTime * 1000,
            (p) => {
              if (v !== version.current) return;
              points.push(p.point);
              curves[id] = [...points];
              setData({ key, curves: { ...curves } });
            },
          );
          jobs.current.push(job);
          const result = await job.promise;
          if (v === version.current) {
            curves[id] = result.curve;
            setData({ key, curves: { ...curves } });
          }
        }),
      );
    } catch (e) {
      if (v === version.current)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (v === version.current) setRunning(false);
    }
  };
  const curves = data?.key === key ? data.curves : {};
  const series = ids.map((id, i) => ({
    id: `${id}-${i}`,
    label: countries.find((c) => c.id === id)?.name || id,
    color: colors[i % colors.length],
    points: curves[id] || [],
  }));
  return (
    <section
      className="surface compare-accuracy"
      aria-label="Accuracy curves for all selected countries"
    >
      <div className="card-heading">
        <div>
          <span className="section-eyebrow">ACCURACY AS DETAIL GROWS</span>
          <h2>Every country. The same scale.</h2>
        </div>
        <button className="button secondary" onClick={() => void calculate()}>
          {running ? (
            <>
              <Square size={13} />
              Stop curves
            </>
          ) : (
            <>
              Calculate curves
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
      <div className="compare-curve-legend">
        {series.map((s, i) => (
          <span key={s.id}>
            <i style={{ background: s.color }} />
            <Flag country={countries.find((c) => c.id === ids[i])} />
            {s.label}
          </span>
        ))}
      </div>
      <Chart
        key={key}
        points={[]}
        series={series}
        target={99}
        max={settings.cap}
        label="Measured similarity versus Fourier terms for all selected countries"
      />
      <p className="note">
        Measured similarity (%) versus Fourier terms per contour. All selected
        countries use the same dataset, sampling and {settings.step}-term search
        grid. Hover a point for its value.
      </p>
      {error && (
        <p className="note" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
