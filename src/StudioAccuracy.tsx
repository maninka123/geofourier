import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
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
}: {
  config: Config;
  settings: Settings;
  country?: Country;
  current: number;
}) {
  const key = `forma-studio-curve-v3-${Object.values(config).join("-")}-${settings.cap}-${settings.step}`;
  const [data, setData] = useState<{ key: string; points: CurvePoint[] }>(),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    let cached: CurvePoint[] | undefined;
    try {
      cached = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      /* Storage is optional. */
    }
    if (Array.isArray(cached) && cached.length) {
      setData({ key, points: cached });
      setRunning(false);
      return;
    }
    let seed: CurvePoint[] = [];
    try {
      const labKey = `forma-lab-v4-${config.resolution}-${config.samples}-${config.mode}-${settings.cap}-${settings.step}`;
      const labRows = JSON.parse(localStorage.getItem(labKey) || "[]");
      seed =
        labRows.find(
          (r: { id: string; curve: CurvePoint[] }) => r.id === config.country,
        )?.curve || [];
    } catch {
      /* Calculate normally without a cached lab result. */
    }
    setData({ key, points: seed });
    setRunning(true);
    const points: CurvePoint[] = [...seed];
    const job = runSearch(
      config,
      101,
      Math.min(settings.cap, settings.samples),
      settings.step,
      settings.maxTime * 1000,
      (p) => {
        if (!active) return;
        points.push(p.point);
        setData({
          key,
          points: [...new Map(points.map((p) => [p.terms, p])).values()].sort(
            (a, b) => a.terms - b.terms,
          ),
        });
      },
      false,
      true,
    );
    void job.promise
      .then((result) => {
        if (!active) return;
        setData({ key, points: result.curve });
        if (result.reason === "budget") {
          try {
            localStorage.setItem(key, JSON.stringify(result.curve));
          } catch {
            /* Storage is optional. */
          }
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setRunning(false);
      });
    return () => {
      active = false;
      job.cancel();
    };
  }, [key, settings.maxTime]);
  const points = data?.key === key ? data.points : [];
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
        {running && (
          <span className="auto-curve-status" role="status">
            <LoaderCircle size={13} className="spin" /> Updating curve
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="note">
          {error}
        </p>
      )}
    </section>
  );
}
