import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Check } from "lucide-react";
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
  const version = useRef(0),
    cache = useRef(new Map<string, CurvePoint[]>());
  useEffect(() => {
    const v = ++version.current;
    const jobs: ReturnType<typeof runSearch>[] = [];
    setError("");
    const curves: Record<string, CurvePoint[]> = {};
    const countryKey = (id: string) =>
      `${id}-${config.resolution}-${config.samples}-${config.mode}-${settings.cap}-${settings.step}-${settings.maxTime}`;
    for (const id of ids) {
      const saved = cache.current.get(countryKey(id));
      if (saved) curves[id] = saved;
    }
    setData({ key, curves: { ...curves } });
    setRunning(ids.some((id) => !curves[id]));
    const calculate = async () => {
      try {
        await Promise.all(
          [...new Set(ids)].map(async (id) => {
            if (curves[id]) return;
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
              false,
              true,
            );
            jobs.push(job);
            const result = await job.promise;
            if (v === version.current) {
              curves[id] = result.curve;
              if (result.reason === "budget") {
                cache.current.set(countryKey(id), result.curve);
                if (cache.current.size > 32)
                  cache.current.delete(cache.current.keys().next().value!);
              }
              setData({ key, curves: { ...curves } });
            }
          }),
        );
      } catch (e) {
        if (v === version.current) {
          setError(e instanceof Error ? e.message : String(e));
          jobs.forEach((j) => j.cancel());
        }
      } finally {
        if (v === version.current) setRunning(false);
      }
    };
    void calculate();
    return () => {
      version.current++;
      jobs.forEach((j) => j.cancel());
    };
  }, [key]);
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
        <span className="auto-curve-status" role="status">
          {running ? (
            <>
              <LoaderCircle size={14} className="spin" />
              Updating curves…
            </>
          ) : (
            <>
              <Check size={14} />
              Updates automatically
            </>
          )}
        </span>
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
        max={Math.min(settings.cap, settings.samples)}
        label="Measured similarity versus Fourier terms for all selected countries"
      />
      <p className="note">Similarity by terms · same dataset and sampling.</p>
      {error && (
        <p className="note" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
