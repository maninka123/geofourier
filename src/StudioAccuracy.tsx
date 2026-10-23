import { useEffect, useRef, useState } from "react";
import { ArrowRight, Square } from "lucide-react";
import Chart from "./Chart";
import { Flag } from "./CountryPicker";
import { runSearch, type Config } from "./client";
import type { Country, CurvePoint } from "./engine";
import type { Settings } from "./Controls";
export default function StudioAccuracy({
  config,
  settings,
  country,
  current,
  searchCurve,
}: {
  config: Config;
  settings: Settings;
  country?: Country;
  current: number;
  searchCurve: CurvePoint[];
}) {
  const key = `forma-studio-curve-v2-${Object.values(config).join("-")}-${settings.cap}-${settings.step}`;
  const [data, setData] = useState<{ key: string; points: CurvePoint[] }>(),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const job = useRef<ReturnType<typeof runSearch> | undefined>(undefined),
    version = useRef(0);
  useEffect(() => {
    setRunning(false);
    setError("");
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      const labKey = `forma-lab-v3-${config.resolution}-${config.samples}-${config.mode}-${settings.cap}-${settings.step}`;
      const labRows = JSON.parse(localStorage.getItem(labKey) || "[]");
      const points: CurvePoint[] | undefined =
        saved ??
        JSON.parse(
          localStorage.getItem(key.replace("-v2-", "-v1-")) || "null",
        ) ??
        labRows.find(
          (r: { id: string; curve: CurvePoint[] }) => r.id === config.country,
        )?.curve;
      setData(points ? { key, points } : undefined);
      if (points?.length && !saved) {
        const v = ++version.current;
        setRunning(true);
        const early = runSearch(
          config,
          101,
          Math.min(25, settings.cap, settings.samples),
          1,
          settings.maxTime * 1000,
          () => {},
        );
        job.current = early;
        void early.promise
          .then((result) => {
            if (v !== version.current) return;
            const merged = [
              ...new Map(
                [...points, ...result.curve].map((p) => [p.terms, p]),
              ).values(),
            ].sort((a, b) => a.terms - b.terms);
            setData({ key, points: merged });
            if (result.reason === "budget")
              localStorage.setItem(key, JSON.stringify(merged));
          })
          .catch((e) => {
            if (v === version.current)
              setError(e instanceof Error ? e.message : String(e));
          })
          .finally(() => {
            if (v === version.current) setRunning(false);
          });
      }
    } catch {
      setData(undefined);
    }
    return () => {
      version.current++;
      job.current?.cancel();
    };
  }, [key]);
  const calculate = async () => {
    if (running) {
      job.current?.cancel();
      return;
    }
    const v = ++version.current;
    setRunning(true);
    setError("");
    setData({ key, points: [] });
    const points: CurvePoint[] = [];
    try {
      job.current = runSearch(
        config,
        101,
        Math.min(settings.cap, settings.samples),
        settings.step,
        settings.maxTime * 1000,
        (p) => {
          if (v !== version.current) return;
          points.push(p.point);
          setData({ key, points: [...points] });
        },
        false,
        true,
      );
      const result = await job.current.promise;
      if (v !== version.current) return;
      setData({ key, points: result.curve });
      if (result.reason === "budget")
        localStorage.setItem(key, JSON.stringify(result.curve));
    } catch (e) {
      if (v === version.current)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (v === version.current) setRunning(false);
    }
  };
  const points = data?.key === key ? data.points : searchCurve;
  return (
    <section
      className="surface studio-accuracy"
      aria-label="Studio accuracy curve"
    >
      <div className="card-heading">
        <div>
          <span className="section-eyebrow">THE ACCURACY CURVE</span>
          <h2>Detail vs. similarity.</h2>
        </div>
        <span className="studio-accuracy-country">
          <Flag country={country} />
          {country?.name || config.country}
        </span>
      </div>
      <Chart
        key={key}
        compact
        points={points}
        max={Math.min(settings.cap, settings.samples)}
        current={current}
        target={99}
      />
      <div className="studio-accuracy-foot">
        <span>Measured similarity · N per contour</span>
        <button className="text-button" onClick={() => void calculate()}>
          {running ? (
            <>
              <Square size={12} />
              Stop
            </>
          ) : (
            <>
              {points.length ? "Recalculate" : "Calculate curve"}
              <ArrowRight size={13} />
            </>
          )}
        </button>
      </div>
      {error && (
        <p role="alert" className="note">
          {error}
        </p>
      )}
    </section>
  );
}
