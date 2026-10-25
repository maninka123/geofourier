import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import Chart from "./Chart";
import { Flag } from "./CountryPicker";
import { runSearch, type Config } from "./client";
import type { Country, CurvePoint } from "./engine";
import type { Settings } from "./Controls";
import {
  curveCachePrefix,
  labCachePrefix,
  readAnalysisCache,
  writeAnalysisCache,
} from "./analysisCache";
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
  const key = `${curveCachePrefix}${Object.values(config).join("-")}-${settings.cap}-${settings.step}`;
  const [data, setData] = useState<{ key: string; points: CurvePoint[] }>(),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    let job: ReturnType<typeof runSearch> | undefined;
    const calculate = async () => {
      const cached = await readAnalysisCache<CurvePoint[]>(key);
      if (!active) return;
      if (Array.isArray(cached) && cached.length) {
        setData({ key, points: cached });
        setRunning(false);
        return;
      }
      let seed: CurvePoint[] = [];
      const labKey = `${labCachePrefix}${config.resolution}-${config.samples}-${config.mode}-${settings.cap}-${settings.step}`;
      const labRows =
        (await readAnalysisCache<{ id: string; curve: CurvePoint[] }[]>(
          labKey,
        )) || [];
      if (!active) return;
      seed =
        labRows.find(
          (r: { id: string; curve: CurvePoint[] }) => r.id === config.country,
        )?.curve || [];
      setData({ key, points: seed });
      setRunning(true);
      const points: CurvePoint[] = [...seed];
      job = runSearch(
        config,
        101,
        Math.min(settings.cap, settings.samples),
        settings.step,
        settings.maxTime ? settings.maxTime * 1000 : Infinity,
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
      await job.promise
        .then((result) => {
          if (!active) return;
          setData({ key, points: result.curve });
          if (result.reason === "budget") {
            void writeAnalysisCache(key, result.curve);
          } else if (result.reason === "time") {
            setError(
              `Partial curve: time limit reached at N = ${result.curve.at(-1)?.terms || 0}. Increase calculation time in Advanced to finish.`,
            );
          }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (active) setRunning(false);
        });
    };
    void calculate().catch((e) => {
      if (active) {
        setError(e instanceof Error ? e.message : String(e));
        setRunning(false);
      }
    });
    return () => {
      active = false;
      job?.cancel();
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
