import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Beaker,
  Check,
  Download,
  Globe2,
  Info,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import FourierCanvas, { type Appearance, type Clock } from "./Canvas";
import { runSearch, useAnalysis, request, type Config } from "./client";
import {
  type Analysis,
  type Country,
  type CurvePoint,
  type SearchResult,
} from "./engine";
import CountryPicker, { Flag } from "./CountryPicker";
import { Slider, type Settings } from "./Controls";
import TermRanking from "./TermRanking";
import CompareAccuracy from "./CompareAccuracy";
import { compareColors } from "./compareColors";
import { csv, download } from "./exports";
type Row = {
  id: string;
  curve: CurvePoint[];
  best: number;
  difficulty: number;
  entropy: number;
  components: number;
  elapsed: number;
  complete: boolean;
  cap: number;
  step: number;
};
function first(curve: CurvePoint[], threshold: number) {
  return curve.find((p) => p.similarity >= threshold)?.terms;
}
export function DifficultyLab({
  countries,
  config,
  settings,
  terms,
  onTerms,
  appearance,
  clock,
  dark,
}: {
  countries: Country[];
  config: Config;
  settings: Settings;
  terms: number;
  onTerms: (n: number) => void;
  appearance: Appearance;
  clock: React.RefObject<Clock>;
  dark: boolean;
}) {
  const cacheKey = `forma-lab-v3-${Object.values(config).slice(1).join("-")}-${settings.cap}-${settings.step}`,
    [rows, setRows] = useState<Row[]>([]),
    [country, setCountry] = useState(config.country),
    [filter, setFilter] = useState(""),
    [sort, setSort] = useState("difficulty"),
    [running, setRunning] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [batch, setBatch] = useState<string[]>([]),
    [batchDone, setBatchDone] = useState<string[]>([]),
    [activeCountry, setActiveCountry] = useState(""),
    [live, setLive] = useState<{
      country: string;
      curve: CurvePoint[];
      analysis?: Analysis;
    }>({ country: "", curve: [] }),
    [datasetCountries, setDatasetCountries] = useState(countries);
  const liveClock = useRef<Clock>({
    elapsed: 0,
    playing: true,
    duration: 4,
    speed: 1,
    loops: Infinity,
  });
  useEffect(() => {
    if (!running || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let previous = performance.now(),
      frame = 0;
    const animate = (now: number) => {
      liveClock.current.elapsed += Math.max(
        0,
        Math.min((now - previous) / 1000, 0.15),
      );
      previous = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/countries-${config.resolution}.json`)
      .then((r) => r.json())
      .then(setDatasetCountries)
      .catch(() => setError("Country list could not be loaded."));
  }, [config.resolution]);
  const runVersion = useRef(0);
  const job = useRef<ReturnType<typeof runSearch> | undefined>(undefined),
    cancel = useRef(false);
  const modelConfig = { ...config, country },
    preview = useAnalysis(modelConfig, terms),
    selected = rows.find((r) => r.id === country);
  useEffect(() => {
    try {
      setRows(JSON.parse(localStorage.getItem(cacheKey) || "[]"));
    } catch {
      setRows([]);
    }
    return () => {
      runVersion.current++;
      cancel.current = true;
      job.current?.cancel();
    };
  }, [cacheKey]);
  const compute = async (ids: string[], includeExisting = false) => {
    const v = ++runVersion.current;
    cancel.current = false;
    setBatch(includeExisting ? datasetCountries.map((c) => c.id) : ids);
    setBatchDone(includeExisting ? rows.map((r) => r.id) : []);
    setRunning(true);
    setError("");
    let current = [...rows];
    try {
      for (let index = 0; index < ids.length; index++) {
        if (cancel.current || v !== runVersion.current) break;
        const id = ids[index],
          name = countries.find((c) => c.id === id)?.name || id;
        setStatus(`${name} · ${index + 1} of ${ids.length}`);
        setActiveCountry(id);
        setLive({ country: id, curve: [] });
        liveClock.current.elapsed = 0;
        const configFor = { ...config, country: id };
        const analyzed = await request<Analysis>("analyze", configFor, {
          terms: settings.cap,
        }).promise;
        if (cancel.current || v !== runVersion.current) break;
        const liveCurve: CurvePoint[] = [];
        job.current = runSearch(
          configFor,
          101,
          Math.min(settings.cap, settings.samples),
          settings.step,
          settings.maxTime * 1000,
          (p) => {
            if (cancel.current || v !== runVersion.current) return;
            liveCurve.push(p.point);
            setLive((previous) => ({
              country: id,
              curve: [...liveCurve],
              analysis: p.preview
                ? { model: analyzed.model, ...p.preview }
                : previous.country === id
                  ? previous.analysis
                  : undefined,
            }));
            setStatus(
              `${name} · N ${p.point.terms} · ${p.point.similarity.toFixed(2)}% · ${index + 1}/${ids.length}`,
            );
          },
          true,
        );
        const result = await job.current.promise;
        if (cancel.current || v !== runVersion.current) break;
        const energies = analyzed.model.contours[0].coefficients
            .filter((c) => c.frequency !== 0)
            .map((c) => c.amplitude ** 2),
          total = energies.reduce((s, v) => s + v, 0),
          entropy =
            -energies.reduce((s, v) => {
              const p = v / total;
              return s + (p > 0 ? p * Math.log(p) : 0);
            }, 0) / Math.log(energies.length || 2),
          t95 = first(result.curve, 95),
          difficulty =
            80 * Math.min(1, (t95 ?? settings.cap) / settings.cap) +
            20 * entropy;
        const row: Row = {
          id,
          curve: result.curve,
          best: result.best.similarity,
          difficulty,
          entropy,
          components: analyzed.model.components,
          elapsed: result.elapsed,
          complete: result.reason === "budget",
          cap: settings.cap,
          step: settings.step,
        };
        current = [...current.filter((r) => r.id !== id), row];
        setRows(current);
        setBatchDone((done) => [...done.filter((key) => key !== id), id]);
        localStorage.setItem(cacheKey, JSON.stringify(current));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (v === runVersion.current) {
        setRunning(false);
        setActiveCountry("");
        setStatus("");
      }
    }
  };
  const sorted = useMemo(
    () =>
      datasetCountries
        .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
        .map((c) => ({ country: c, row: rows.find((r) => r.id === c.id) }))
        .sort((a, b) => {
          if (sort === "name")
            return a.country.name.localeCompare(b.country.name);
          if (!a.row && !b.row)
            return a.country.name.localeCompare(b.country.name);
          if (!a.row) return 1;
          if (!b.row) return -1;
          return sort === "accuracy"
            ? b.row.best - a.row.best
            : b.row.difficulty - a.row.difficulty;
        }),
    [rows, datasetCountries, filter, sort],
  );
  const liveCountry = datasetCountries.find((c) => c.id === activeCountry),
    showingLive = running && Boolean(activeCountry),
    liveAnalysis = live.country === activeCountry ? live.analysis : undefined,
    displayAnalysis = showingLive ? liveAnalysis : preview.analysis,
    displayTerms = showingLive ? liveAnalysis?.terms : terms,
    displayBusy = showingLive ? !liveAnalysis : preview.busy,
    limit = Math.min(settings.cap, settings.samples);
  const remaining = useMemo(
    () => datasetCountries.filter((c) => !rows.some((r) => r.id === c.id)),
    [datasetCountries, rows],
  );
  return (
    <div className="lab-view">
      <div className="view-heading">
        <div>
          <div className="eyebrow">LOOK A LITTLE CLOSER</div>
          <h1>Complexity has a shape.</h1>
          <p>Explore what makes a border harder to reconstruct.</p>
        </div>
        <div className="view-actions">
          <button
            className="button primary"
            disabled={!running && !remaining.length}
            onClick={() => {
              if (running) {
                cancel.current = true;
                job.current?.cancel();
              } else
                void compute(
                  remaining.map((c) => c.id),
                  true,
                );
            }}
          >
            {running ? (
              <>
                <SquareIcon />
                Stop calculation
              </>
            ) : remaining.length ? (
              <>
                <Globe2 size={16} />
                Calculate remaining
                <span className="button-count">{remaining.length}</span>
              </>
            ) : (
              <>
                <Check size={16} />
                All countries calculated
              </>
            )}
          </button>
          <button
            className="button secondary"
            onClick={() =>
              download(
                JSON.stringify({ config, settings, rows }, null, 2),
                "forma-difficulty-analysis.json",
                "application/json",
              )
            }
          >
            <Download size={16} /> Export analysis
          </button>
        </div>
      </div>
      {batch.length > 0 && (
        <section
          className={`surface country-progress ${running ? "is-running" : ""}`}
          aria-label="Country analysis progress"
        >
          <div className="country-progress-heading">
            <div>
              <h3>
                {running
                  ? "Mapping the mathematics."
                  : batchDone.length >= batch.length
                    ? "Every result, measured."
                    : "Analysis paused."}
              </h3>
              <p>
                {running
                  ? countries.find((c) => c.id === activeCountry)?.name ||
                    "Preparing…"
                  : `${batchDone.length} countries analyzed under the current limits`}
              </p>
            </div>
            <strong>
              {batchDone.length}
              <span> / {batch.length}</span>
            </strong>
          </div>
          <div
            className="country-progress-track"
            role="progressbar"
            aria-label="Countries analyzed"
            aria-valuenow={batchDone.length}
            aria-valuemin={0}
            aria-valuemax={batch.length}
          >
            <i
              style={{ width: `${(batchDone.length / batch.length) * 100}%` }}
            />
          </div>
          <div className="flag-progress-strip">
            {batch
              .filter((id) =>
                /^[A-Z]{2}$/.test(
                  datasetCountries.find((c) => c.id === id)?.code || "",
                ),
              )
              .map((id) => (
                <span
                  key={id}
                  className={`${batchDone.includes(id) ? "done" : ""} ${activeCountry === id ? "current" : ""}`}
                  title={`${countries.find((c) => c.id === id)?.name}: ${batchDone.includes(id) ? "analyzed" : activeCountry === id ? "calculating" : "waiting"}`}
                >
                  <Flag country={countries.find((c) => c.id === id)} />
                </span>
              ))}
          </div>
          <p className="note">
            Flags fill as each country finishes. Results are cached in this
            browser. You can stop and resume with Calculate remaining.
          </p>
        </section>
      )}
      <div
        className={`lab-top ${showingLive ? "is-calculating" : ""}`}
        aria-busy={showingLive && !liveAnalysis}
      >
        <TermRanking
          rows={rows}
          countries={datasetCountries}
          step={settings.step}
          onSelect={setCountry}
        />
        <div className="surface experiment">
          <div className="card-heading">
            <h2>{showingLive ? "Building the border" : "Your experiment"}</h2>
            <span
              className={`small-tag ${showingLive ? "live-calculation-tag" : ""}`}
            >
              {showingLive ? "CALCULATING" : "LIVE"}
            </span>
          </div>
          <div className="experiment-canvas">
            {showingLive && (
              <div className="live-drawing-caption">
                <Flag country={liveCountry} />
                <strong>{liveCountry?.name || activeCountry}</strong>
                <span>
                  {displayTerms ? `N = ${displayTerms}` : "Preparing…"}
                </span>
              </div>
            )}
            <FourierCanvas
              analysis={displayAnalysis}
              appearance={{
                ...appearance,
                grid: false,
                zoom: showingLive ? 1 : 0.85,
                fullTrace: true,
                ...(showingLive
                  ? { circles: true, arms: true, tip: true, reference: true }
                  : {}),
              }}
              clock={showingLive ? liveClock : clock}
              dark={dark}
              label={
                showingLive
                  ? `${liveCountry?.name || activeCountry} building with ${displayTerms ?? 0} Fourier terms`
                  : `${country} reconstruction experiment`
              }
            />
            {showingLive && !liveAnalysis && (
              <div className="live-drawing-loading">
                <LoaderCircle size={24} />
                <span>Preparing this outline</span>
              </div>
            )}
          </div>
          {showingLive ? (
            <div className="live-term-progress">
              <div>
                <span>Adding Fourier detail</span>
                <strong>
                  {displayTerms ? `N = ${displayTerms}` : "—"}
                  <small> / {limit}</small>
                </strong>
              </div>
              <div className="live-term-track">
                <i
                  style={{ width: `${((displayTerms ?? 0) / limit) * 100}%` }}
                />
              </div>
              <p>Each shape is the actual result at this N.</p>
            </div>
          ) : (
            <Slider
              label="Term budget"
              value={terms}
              min={1}
              max={Math.min(settings.cap, settings.samples)}
              onChange={onTerms}
            />
          )}
          <div className="experiment-stats">
            <div>
              <small>Similarity</small>
              <b>
                {displayBusy
                  ? "…"
                  : displayAnalysis?.metrics.similarity.toFixed(2)}
                <em>%</em>
              </b>
            </div>
            <div>
              <small>Mean boundary error</small>
              <b>
                {displayBusy ? "…" : displayAnalysis?.metrics.mean.toFixed(2)}
                <em>%</em>
              </b>
            </div>
          </div>
        </div>
      </div>
      <div className="surface ranking">
        <div className="card-heading">
          <div>
            <span className="section-eyebrow">A FAIR COMPARISON</span>
            <h2>The geography of difficulty</h2>
          </div>
          <div className="ranking-tools">
            <div className="search-input">
              <Search size={16} />
              <input
                aria-label="Search difficulty table"
                placeholder="Find a country…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <label className="sort-select">
              <ArrowDownUp size={15} />
              <select
                aria-label="Sort difficulty ranking"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="difficulty">Difficulty</option>
                <option value="accuracy">Accuracy</option>
                <option value="name">Country A–Z</option>
              </select>
            </label>
          </div>
        </div>
        {(running || error) && (
          <div className="analysis-status" role="status">
            {running && <LoaderCircle className="spin" size={15} />}{" "}
            {error || status}
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>
                  Difficulty <Info size={12} />
                </th>
                <th>90% terms</th>
                <th>95% terms</th>
                <th>99% terms</th>
                <th>Best tested</th>
                <th>
                  <span className="components-heading">
                    Components{" "}
                    <span
                      className="help"
                      tabIndex={0}
                      role="img"
                      aria-label="Separate land areas in the map dataset, such as mainland and islands. Counts all land areas even when only the main outline is drawn. Not Fourier terms."
                      title="Separate land areas in the dataset: mainland and islands. Includes all areas even in Main outline mode. This is not the number of Fourier terms."
                    >
                      <Info size={12} />
                    </span>
                  </span>
                  <small className="components-caption">
                    Separate land areas
                  </small>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ country: c, row }) => (
                <tr key={c.id} className={c.id === country ? "selected" : ""}>
                  <td>
                    <button
                      className="table-country"
                      onClick={() => setCountry(c.id)}
                    >
                      <Flag country={c} />
                      <span>
                        {c.name}
                        <small>{c.id}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {row ? (
                      <>
                        <span className="difficulty-number">
                          {row.difficulty.toFixed(1)}
                        </span>
                        <span className="difficulty-bar">
                          <i style={{ width: `${row.difficulty}%` }} />
                        </span>
                      </>
                    ) : (
                      <span className="unavailable">Not analyzed</span>
                    )}
                  </td>
                  {[90, 95, 99].map((t) => (
                    <td key={t}>
                      {row
                        ? (first(row.curve, t) ?? (
                            <span className="unavailable">Not reached</span>
                          ))
                        : "—"}
                    </td>
                  ))}
                  <td>{row ? `${row.best.toFixed(2)}%` : "—"}</td>
                  <td>{row ? row.components : "—"}</td>
                  <td>
                    <button
                      className="text-button"
                      disabled={running || Boolean(row)}
                      onClick={() => {
                        setCountry(c.id);
                        compute([c.id]);
                      }}
                    >
                      {row ? (
                        <>
                          <Check size={13} />
                          Calculated
                        </>
                      ) : (
                        <>
                          Calculate <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          {rows.length} analyzed ·{" "}
          {settings.resolution === "50m" ? "1:50 million" : "1:110 million"} ·{" "}
          {settings.samples} samples for longest contour · {settings.cap}-term
          cap · step {settings.step}
        </div>
      </div>
      <details className="methodology surface">
        <summary>
          <Info size={18} />
          How difficulty is measured
        </summary>
        <div>
          <h3>Difficulty, with the workings shown.</h3>
          <p>
            Score = 80 × min(terms for 95% ÷ term cap, 1) + 20 × normalized
            spectral energy entropy. If 95% was not reached, its budget
            component is 80 and the result is censored by this budget.
            Categories: 0–20 low, 20–40 moderate, 40–60 high, 60–80 very high,
            80–100 extreme within this configuration. Uncomputed countries stay
            unranked.
          </p>
          <p>
            Thresholds are the first measured qualifying term count on the
            selected search grid. All rows share the same dataset, projection,
            contour mode, sample count, score, and search budget. Area is not a
            difficulty input. Island count is reported separately; main-outline
            mode excludes disconnected land.
          </p>
        </div>
      </details>
    </div>
  );
}
function SquareIcon() {
  return <span className="square-icon" />;
}
function CompareCard({
  color,
  id,
  countries,
  onChange,
  onRemove,
  config,
  terms,
  appearance,
  clock,
  dark,
  onMetric,
  independent,
  onTerm,
  result,
}: {
  color: string;
  id: string;
  countries: Country[];
  onChange: (id: string) => void;
  onRemove?: () => void;
  config: Config;
  terms: number;
  appearance: Appearance;
  clock: React.RefObject<Clock>;
  dark: boolean;
  onMetric: (id: string, value: number) => void;
  independent: boolean;
  onTerm: (n: number) => void;
  result?: SearchResult;
}) {
  const { analysis, busy, error } = useAnalysis(
    { ...config, country: id },
    terms,
  );
  useEffect(() => {
    if (analysis && !busy) onMetric(id, analysis.metrics.similarity);
  }, [analysis, busy, id]);
  return (
    <article className="surface compare-card">
      <div className="compare-card-heading">
        <CountryPicker
          countries={countries}
          selected={id}
          onChange={onChange}
          compact
        />
        {onRemove && (
          <button
            className="icon-button"
            aria-label="Remove comparison country"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <div className="compare-canvas">
        <FourierCanvas
          analysis={analysis}
          appearance={{ ...appearance, color, zoom: 0.9, fullTrace: true }}
          clock={clock}
          dark={dark}
          label={`${id}, ${terms} Fourier terms`}
        />
        {busy && <span className="canvas-loading">Calculating…</span>}
        {error && <span className="canvas-error">{error}</span>}
      </div>
      <div className="compare-card-stats">
        <div>
          <small>Similarity</small>
          <strong>
            {busy ? "…" : analysis?.metrics.similarity.toFixed(2)}
            <em>%</em>
          </strong>
        </div>
        <div>
          <small>Fourier terms / contour</small>
          <strong>{terms}</strong>
        </div>
      </div>
      {independent && (
        <Slider
          label={`${id} terms`}
          value={terms}
          min={1}
          max={500}
          onChange={onTerm}
        />
      )}
      <div className="compare-card-foot">
        {result ? (
          <>
            <Check size={13} />
            {result.reached
              ? "Target reached"
              : `Best within tested limits · ${result.evaluations} evaluations`}
          </>
        ) : (
          <>
            <span className="status-dot" /> Same source. Same scoring.
          </>
        )}
      </div>
    </article>
  );
}
export function CompareView({
  countries,
  config,
  settings,
  terms,
  onTerms,
  target,
  onTarget,
  appearance,
  clock,
  dark,
  onPlay,
  onRestart,
}: {
  countries: Country[];
  config: Config;
  settings: Settings;
  terms: number;
  onTerms: (n: number) => void;
  target: number;
  onTarget: (n: number) => void;
  appearance: Appearance;
  clock: React.RefObject<Clock>;
  dark: boolean;
  onPlay: () => void;
  onRestart: () => void;
}) {
  const [ids, setIds] = useState(["LKA", "AUS"]),
    [mode, setMode] = useState("terms"),
    [metrics, setMetrics] = useState<Record<string, number>>({}),
    [results, setResults] = useState<Record<string, SearchResult>>({}),
    [ownTerms, setOwnTerms] = useState<Record<string, number>>({}),
    [independent, setIndependent] = useState(false),
    [running, setRunning] = useState(false),
    [status, setStatus] = useState("");
  const jobs = useRef<ReturnType<typeof runSearch>[]>([]),
    version = useRef(0);
  useEffect(() => {
    version.current++;
    jobs.current.forEach((j) => j.cancel());
    setResults({});
    setRunning(false);
  }, [ids.join(), JSON.stringify(config), target, settings.cap, settings.step]);
  useEffect(
    () => () => {
      version.current++;
      jobs.current.forEach((j) => j.cancel());
    },
    [],
  );
  const run = async () => {
    const v = ++version.current;
    setRunning(true);
    setStatus("");
    const next: Record<string, SearchResult> = {};
    try {
      for (const id of ids) {
        if (v !== version.current) break;
        setStatus(`Analyzing ${countries.find((c) => c.id === id)?.name}…`);
        const job = runSearch(
          { ...config, country: id },
          target,
          Math.min(settings.cap, settings.samples),
          settings.step,
          settings.maxTime * 1000,
          (p) => {
            if (v === version.current)
              setStatus(
                `${id} · ${p.point.terms} terms · ${p.point.similarity.toFixed(2)}%`,
              );
          },
        );
        jobs.current.push(job);
        next[id] = await job.promise;
        if (v === version.current) setResults({ ...next });
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      if (v === version.current) {
        setRunning(false);
        setStatus("");
      }
    }
  };
  const value = (id: string) =>
      mode === "accuracy" ? results[id]?.best.terms : metrics[id],
    maxValue = mode === "accuracy" ? settings.cap : 100;
  const colors = useMemo(() => compareColors(ids, dark), [ids.join(":"), dark]);
  return (
    <div className="compare-view">
      <div className="view-heading">
        <div>
          <div className="eyebrow">SAME CIRCLES. DIFFERENT STORIES.</div>
          <h1>A world of difference.</h1>
          <p>See how different borders respond to the same mathematics.</p>
        </div>
        <button
          className="button secondary"
          disabled={ids.length >= 4}
          onClick={() =>
            setIds([
              ...ids,
              ["NOR", "AUS", "BRA", "IND"].find((c) => !ids.includes(c))!,
            ])
          }
        >
          <Plus size={16} /> Add country{" "}
          <span className="button-count">{ids.length}/4</span>
        </button>
      </div>
      <div className="surface compare-controls">
        <div className="segmented">
          <button
            className={mode === "terms" ? "active" : ""}
            onClick={() => setMode("terms")}
          >
            Equal terms
          </button>
          <button
            className={mode === "accuracy" ? "active" : ""}
            onClick={() => {
              setMode("accuracy");
              setIndependent(false);
            }}
          >
            Equal accuracy
          </button>
        </div>
        {mode === "terms" ? (
          <Slider
            label="Shared Fourier terms"
            value={terms}
            min={1}
            max={Math.min(settings.cap, settings.samples)}
            onChange={onTerms}
          />
        ) : (
          <Slider
            label="Shared target similarity"
            value={target}
            min={70}
            max={99.9}
            step={0.1}
            suffix="%"
            onChange={onTarget}
          />
        )}
        {mode === "accuracy" ? (
          <button className="button primary" disabled={running} onClick={run}>
            {running ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Beaker size={16} />
            )}{" "}
            Find required terms
          </button>
        ) : (
          <label className="check-label">
            <input
              type="checkbox"
              checked={independent}
              onChange={(e) => setIndependent(e.target.checked)}
            />{" "}
            Independent term counts
          </label>
        )}
      </div>
      <div className="compare-playback-bar">
        <div>
          <button
            className="play-button"
            aria-label={
              clock.current.playing
                ? "Pause synchronized playback"
                : "Play synchronized playback"
            }
            onClick={onPlay}
          >
            {clock.current.playing ? (
              <Pause size={17} fill="currentColor" />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Restart synchronized playback"
            onClick={onRestart}
          >
            <RotateCcw size={17} />
          </button>
          <span>One clock. Every country in sync.</span>
        </div>
        <span>
          {clock.current.duration}s per cycle · {clock.current.speed}×
        </span>
      </div>
      {running && (
        <div role="status" className="analysis-status">
          <LoaderCircle size={15} className="spin" />
          {status}
        </div>
      )}
      {mode === "accuracy" && !Object.keys(results).length && !running && (
        <p className="info-banner">
          <Info size={16} /> Run the search to measure the first qualifying
          count on your search grid. Results are limited to the configured
          budget.
        </p>
      )}
      <div className={`compare-grid count-${ids.length}`}>
        {ids.map((id, i) => (
          <CompareCard
            color={colors[i]}
            key={i}
            id={id}
            countries={countries}
            config={config}
            terms={
              mode === "accuracy"
                ? (results[id]?.best.terms ?? terms)
                : independent
                  ? (ownTerms[id] ?? terms)
                  : terms
            }
            appearance={appearance}
            clock={clock}
            dark={dark}
            independent={independent}
            onTerm={(n) => setOwnTerms({ ...ownTerms, [id]: n })}
            onChange={(next) => {
              const all = [...ids];
              all[i] = next;
              setIds(all);
            }}
            onRemove={
              ids.length > 2
                ? () => setIds(ids.filter((_, j) => i !== j))
                : undefined
            }
            onMetric={(key, v) =>
              setMetrics((m) => (m[key] === v ? m : { ...m, [key]: v }))
            }
            result={results[id]}
          />
        ))}
      </div>
      <CompareAccuracy
        colors={colors}
        ids={ids}
        countries={countries}
        config={config}
        settings={settings}
      />
      <div className="surface comparison-chart">
        <div className="card-heading">
          <div>
            <span className="section-eyebrow">THE MEASURED DIFFERENCE</span>
            <h2>
              {mode === "terms"
                ? "One budget. Different levels of detail."
                : "One target. Different numbers of circles."}
            </h2>
          </div>
          <button
            className="text-button"
            onClick={() =>
              setIds([...ids].sort((a, b) => (value(b) || 0) - (value(a) || 0)))
            }
          >
            <ArrowDownUp size={14} /> Sort by result
          </button>
        </div>
        <div className="bar-chart">
          {ids.map((id, i) => (
            <div className="bar-row" key={`${id}-${i}`}>
              <span>{countries.find((c) => c.id === id)?.name}</span>
              <div className="bar-track">
                <div
                  className="bar-value"
                  style={{
                    width: `${((value(id) || 0) / maxValue) * 100}%`,
                    opacity: 1 - i * 0.12,
                    background: colors[i],
                  }}
                />
              </div>
              <b>
                {value(id) !== undefined
                  ? mode === "terms"
                    ? `${value(id)!.toFixed(2)}%`
                    : `${value(id)} terms`
                  : "Not measured"}
              </b>
            </div>
          ))}
        </div>
        <p className="note">
          {settings.resolution === "50m" ? "1:50m" : "1:110m"} Natural Earth ·{" "}
          {config.mode === "main"
            ? "Largest exterior only"
            : config.mode === "exterior"
              ? "All exteriors"
              : "Full geometry with holes"}{" "}
          · {settings.samples} maximum samples per contour · 70% IoU + 30%
          boundary score
          {mode === "accuracy"
            ? ` · ${target}% target · search step ${settings.step}`
            : ""}
        </p>
      </div>
    </div>
  );
}
