import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Copy,
  Expand,
  ExternalLink,
  Focus,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  Maximize2,
  Minus,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Share2,
  SlidersHorizontal,
  Smile,
  Sun,
  Waves,
  X,
} from "lucide-react";
import CountryPicker, { Flag } from "./CountryPicker";
import FourierCanvas, {
  defaultAppearance,
  phase,
  type Appearance,
  type Clock,
} from "./Canvas";
import Controls, {
  AppearanceControls,
  defaults,
  SearchSummary,
  Slider,
  Toggle,
  type Settings,
} from "./Controls";
import Chart from "./Chart";
import { DifficultyLab, CompareView } from "./Views";
import { runSearch, useAnalysis, type Config, type Progress } from "./client";
import type { Analysis, Country, CurvePoint, SearchResult } from "./engine";
import { csv, download, exportPng, exportSvg, exportWebm } from "./exports";
import { SimilarityExplainer, LearningExplainer } from "./Explainers";
import Playback from "./Playback";
import Equation from "./Equation";
import { constructionAt, type BuildMode } from "./construction";
type Saved = {
  inputMode?: "terms" | "similarity";
  buildMode?: BuildMode;
  buildSteps?: number;
  country: string;
  terms: number;
  target: number;
  appearance: Appearance;
  settings: Settings;
  speed: number;
  duration: number;
  loops: number;
};
function readState(): Partial<Saved> {
  try {
    const raw = new URLSearchParams(location.search).get("state");
    if (!raw) return {};
    const s = JSON.parse(raw);
    return {
      inputMode: s.inputMode === "similarity" ? "similarity" : "terms",
      buildMode: ["construction", "trace", "final", "target"].includes(
        s.buildMode,
      )
        ? s.buildMode
        : "construction",
      buildSteps: Math.max(2, Math.min(20, Number(s.buildSteps) || 8)),
      country: /^[A-Z0-9]{3}$/.test(s.country) ? s.country : "LKA",
      terms: Math.max(1, Math.min(1000, Number(s.terms) || 150)),
      target: Math.max(70, Math.min(99.9, Number(s.target) || 98)),
      speed: Math.max(0.1, Math.min(4, Number(s.speed) || 1)),
      duration: [5, 10, 20, 30, 60, 120].includes(s.duration) ? s.duration : 20,
      loops: [1, 3, 5, 10].includes(s.loops) ? s.loops : 0,
      settings: {
        ...defaults,
        ...s.settings,
        resolution: ["50m", "110m"].includes(s.settings?.resolution)
          ? s.settings.resolution
          : "50m",
        samples: [256, 512, 1024, 2048].includes(s.settings?.samples)
          ? s.settings.samples
          : 1024,
        mode: ["main", "exterior", "full"].includes(s.settings?.mode)
          ? s.settings.mode
          : "main",
        cap: [100, 250, 500, 1000].includes(s.settings?.cap)
          ? s.settings.cap
          : 500,
        step: [1, 2, 5, 10, 20].includes(s.settings?.step)
          ? s.settings.step
          : 5,
        maxTime: [5, 15, 30, 60].includes(s.settings?.maxTime)
          ? s.settings.maxTime
          : 30,
      },
      appearance: {
        ...defaultAppearance,
        ...s.appearance,
        color: /^#[0-9a-f]{6}$/i.test(s.appearance?.color)
          ? s.appearance.color
          : defaultAppearance.color,
        zoom: Math.max(0.4, Math.min(3, Number(s.appearance?.zoom) || 1)),
      },
    };
  } catch {
    return {};
  }
}
const initial = readState();
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button,input,select,a[href],[tabindex="0"]',
        ) || [],
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = focusables(),
          first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, []);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panel}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </motion.div>
  );
}
function FormulaMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle
        cx="14"
        cy="17"
        r="10.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="22" cy="10" r="5.9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 22L14 17L22 10L26 6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="26" cy="6" r="2.2" fill="currentColor" />
    </svg>
  );
}
export default function App() {
  const [countries, setCountries] = useState<Country[]>([]),
    [country, setCountry] = useState(initial.country || "LKA"),
    [terms, setTerms] = useState(initial.terms || 150),
    [target, setTarget] = useState(initial.target || 98),
    [settings, setSettings] = useState<Settings>(initial.settings || defaults),
    [appearance, setAppearance] = useState<Appearance>(
      initial.appearance || defaultAppearance,
    ),
    [speed, setSpeed] = useState(initial.speed || 1),
    [duration, setDuration] = useState(initial.duration || 20),
    [loops, setLoops] = useState(initial.loops || Infinity),
    [tab, setTab] = useState("Studio"),
    [inputMode, setInputMode] = useState<"terms" | "similarity">(
      initial.inputMode || "terms",
    ),
    [buildMode, setBuildMode] = useState<BuildMode>(
      initial.buildMode ||
        (matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "final"
          : "construction"),
    ),
    [buildSteps, setBuildSteps] = useState(initial.buildSteps || 8),
    [dark, setDark] = useState(false),
    [controls, setControls] = useState(true),
    [clean, setClean] = useState(false),
    [modal, setModal] = useState(""),
    [equationAnalysis, setEquationAnalysis] = useState<Analysis>(),
    [toast, setToast] = useState(""),
    [playing, setPlaying] = useState(
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [elapsed, setElapsed] = useState(duration * 0.62),
    [searching, setSearching] = useState(false),
    [progress, setProgress] = useState<Progress>(),
    [result, setResult] = useState<SearchResult>(),
    [curve, setCurve] = useState<CurvePoint[]>([]),
    [exporting, setExporting] = useState(false),
    [exportOptions, setExportOptions] = useState({
      transparent: false,
      label: true,
      stats: true,
      epicycles: true,
      size: 1600,
      seconds: 10,
    }),
    [presets, setPresets] = useState<{ name: string; state: Saved }[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("forma-presets") || "[]");
      } catch {
        return [];
      }
    });
  const clock = useRef<Clock>({
      elapsed: duration * 0.62,
      playing,
      duration,
      speed,
      loops,
    }),
    searchJob = useRef<ReturnType<typeof runSearch> | undefined>(undefined),
    searchVersion = useRef(0),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  clock.current.playing = playing;
  clock.current.duration = duration;
  clock.current.speed = speed;
  clock.current.loops =
    buildMode === "construction" && Number.isFinite(loops)
      ? Math.min(buildSteps, terms) - 1 + loops
      : loops;
  const config: Config = {
    country,
    resolution: settings.resolution,
    samples: settings.samples,
    mode: settings.mode,
  };
  const construction = constructionAt(
    terms,
    buildSteps,
    buildMode === "construction" && tab === "Studio",
    elapsed,
    duration,
    playing,
  );
  const { analysis, busy, error } = useAnalysis(config, construction.terms);
  const selected = countries.find((c) => c.id === country),
    fraction = phase(clock.current),
    cycle = Math.max(1, Math.ceil(elapsed / duration));
  const notify = useCallback((s: string) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/countries-50m.json`)
      .then((r) => {
        if (!r.ok) throw Error("Country list could not be loaded.");
        return r.json();
      })
      .then(setCountries)
      .catch((e) => notify(e.message));
  }, [notify]);
  useEffect(() => {
    let frame = 0,
      previous = performance.now(),
      lastUI = 0;
    const tick = (now: number) => {
      const c = clock.current;
      if (c.playing) {
        c.elapsed +=
          Math.max(0, Math.min((now - previous) / 1000, 0.15)) * c.speed;
        if (c.elapsed >= c.duration * c.loops) {
          c.elapsed = c.duration * c.loops;
          c.playing = false;
          setPlaying(false);
        }
      }
      previous = now;
      if (now - lastUI > 90) {
        setElapsed(c.elapsed);
        lastUI = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  const seek = (seconds: number) => {
    clock.current.elapsed = Math.max(0, seconds);
    setElapsed(clock.current.elapsed);
  };
  useEffect(() => {
    seek(buildMode === "final" ? duration : 0);
    setPlaying(buildMode !== "final");
  }, [
    terms,
    buildSteps,
    country,
    settings.resolution,
    settings.samples,
    settings.mode,
    buildMode,
  ]);
  const changeCountry = (id: string) => {
    setCountry(id);
    seek(0);
  };
  useEffect(() => {
    searchVersion.current++;
    searchJob.current?.cancel();
    setSearching(false);
    setResult(undefined);
    setProgress(undefined);
    setCurve([]);
  }, [
    country,
    settings.resolution,
    settings.samples,
    settings.mode,
    settings.cap,
    settings.step,
    target,
  ]);
  useEffect(() => {
    if (terms > Math.min(settings.cap, settings.samples))
      setTerms(Math.min(settings.cap, settings.samples));
  }, [settings.cap, settings.samples]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          'input,select,textarea,button,[role="dialog"]',
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "Escape") {
        setClean(false);
        setModal("");
      }
      if (e.key.toLowerCase() === "r") seek(0);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const search = async () => {
    if (searching) {
      searchJob.current?.cancel();
      return;
    }
    const v = ++searchVersion.current;
    setSearching(true);
    setResult(undefined);
    setCurve([]);
    setProgress(undefined);
    const job = runSearch(
      config,
      target,
      Math.min(settings.cap, settings.samples),
      settings.step,
      settings.maxTime * 1000,
      (p) => {
        if (v !== searchVersion.current) return;
        setProgress(p);
        setCurve((c) => [...c, p.point]);
      },
    );
    searchJob.current = job;
    try {
      const res = await job.promise;
      if (v === searchVersion.current) {
        setResult(res);
        setCurve(res.curve);
        if (res.best.similarity >= 0) setTerms(res.best.terms);
      }
    } catch (e) {
      if (v === searchVersion.current)
        notify(e instanceof Error ? e.message : String(e));
    } finally {
      if (v === searchVersion.current) setSearching(false);
    }
  };
  useEffect(() => {
    if (inputMode !== "similarity" || tab !== "Studio") return;
    const timeout = setTimeout(() => {
      void search();
    }, 450);
    return () => clearTimeout(timeout);
  }, [
    inputMode,
    target,
    country,
    settings.resolution,
    settings.samples,
    settings.mode,
    settings.cap,
    settings.step,
    tab,
  ]);
  const state = (): Saved => ({
    inputMode,
    buildMode,
    buildSteps,
    country,
    terms,
    target,
    settings,
    appearance,
    speed,
    duration,
    loops: Number.isFinite(loops) ? loops : 0,
  });
  const share = async () => {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("state", JSON.stringify(state()));
    try {
      await navigator.clipboard.writeText(url.href);
      notify("Link copied. Your country and settings travel with it.");
    } catch {
      download(url.href, "forma-share-link.txt");
      notify("Share link saved as a text file.");
    }
  };
  const savePreset = () => {
    const name = `${selected?.name || country} · ${terms} terms · ${speed}×`;
    const next = [{ name, state: state() }, ...presets].slice(0, 12);
    setPresets(next);
    localStorage.setItem("forma-presets", JSON.stringify(next));
    notify("Preset saved to this browser.");
  };
  const loadPreset = (s: Saved) => {
    setInputMode(s.inputMode || "terms");
    setBuildMode(s.buildMode || "construction");
    setBuildSteps(s.buildSteps || 8);
    setCountry(s.country);
    setTerms(s.terms);
    setTarget(s.target);
    setSettings(s.settings);
    setAppearance(s.appearance);
    setSpeed(s.speed);
    setDuration(s.duration);
    setLoops(s.loops || Infinity);
    seek(0);
    setModal("");
    notify("Preset restored.");
  };
  const exportFile = async (type: string) => {
    if (!analysis || !selected) return;
    const o = {
      ...appearance,
      circles: exportOptions.epicycles && appearance.circles,
      arms: exportOptions.epicycles && appearance.arms,
    };
    try {
      if (type === "png")
        await exportPng(
          analysis,
          selected,
          o,
          exportOptions.transparent,
          exportOptions.label,
          exportOptions.stats,
          exportOptions.size,
        );
      if (type === "svg")
        exportSvg(
          analysis,
          selected,
          o,
          exportOptions.transparent,
          exportOptions.label,
          exportOptions.stats,
          exportOptions.size,
        );
      if (type === "json")
        download(
          JSON.stringify({ version: 1, ...state() }, null, 2),
          "forma-settings.json",
          "application/json",
        );
      if (type === "coefficients")
        download(
          JSON.stringify(
            {
              country: country,
              source: "Natural Earth",
              resolution: settings.resolution,
              samples: settings.samples,
              mode: settings.mode,
              ordering: "descending amplitude, signed frequencies",
              contours: analysis.model.contours.map((c) => ({
                hole: c.hole,
                group: c.group,
                coefficients: c.coefficients,
              })),
            },
            null,
            2,
          ),
          `${country}-fourier-coefficients.json`,
          "application/json",
        );
      if (type === "csv")
        download(
          csv(
            curve.length
              ? curve
              : [
                  {
                    terms,
                    similarity: analysis.metrics.similarity,
                    iou: analysis.metrics.iou,
                    mean: analysis.metrics.mean,
                  },
                ],
            country,
          ),
          `${country}-accuracy.csv`,
          "text/csv",
        );
      if (type === "webm") {
        setExporting(true);
        await exportWebm(
          analysis,
          selected,
          o,
          exportOptions.seconds,
          Math.min(1200, exportOptions.size),
          notify,
        );
      }
      if (type !== "webm") notify("Your export is ready.");
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };
  const mainCoefficient =
      analysis?.model.contours[0]?.coefficients[appearance.inspector],
    totalEnergy =
      analysis?.model.contours[0]?.coefficients.reduce(
        (s, c) => s + c.amplitude ** 2,
        0,
      ) || 1;
  const fmtTime = (time: number) =>
    `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(Math.floor(time % 60)).padStart(2, "0")}.${String(Math.floor(time * 10) % 10)}`;
  return (
    <div className={`app ${clean ? "clean-mode" : ""}`}>
      {!clean && (
        <>
          <header className="site-header">
            <a
              className="brand"
              href="#"
              aria-label="Forma home"
              onClick={(e) => {
                e.preventDefault();
                setTab("Studio");
              }}
            >
              <FormulaMark />
              <span>
                forma<span className="brand-period">.</span>
              </span>
            </a>
            <nav aria-label="Main navigation">
              {["Studio", "Difficulty Lab", "Compare"].map((t, i) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {i === 0 ? (
                    <Waves size={16} />
                  ) : i === 1 ? (
                    <Activity size={16} />
                  ) : (
                    <Layers3 size={16} />
                  )}
                  <span>{t}</span>
                </button>
              ))}
            </nav>
            <div className="header-actions">
              <button
                className="learn-button"
                onClick={() => setModal("learn")}
              >
                <CircleHelp size={16} />
                <span>How it works</span>
              </button>
              <div className="header-divider" />
              <button
                className="icon-button"
                aria-label={
                  dark ? "Switch to light theme" : "Switch to dark theme"
                }
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={18} /> : <Sun size={18} />}
              </button>
              <button
                className="icon-button"
                aria-label="Advanced settings"
                onClick={() => setModal("settings")}
              >
                <Settings2 size={18} />
              </button>
            </div>
          </header>
        </>
      )}
      <main>
        {tab === "Studio" ? (
          <>
            {!clean && (
              <div className="studio-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" /> THE MATHEMATICS OF BORDERS
                  </div>
                  <h1>Every border is a wave.</h1>
                  <p>A little geography. A beautiful amount of mathematics.</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button secondary share-button"
                    onClick={share}
                  >
                    <Share2 size={15} /> Share
                  </button>
                  <button
                    className="button ink"
                    onClick={() => setModal("export")}
                  >
                    <ArrowDownToLine size={16} /> Export{" "}
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            )}
            <div className={`studio-grid ${!controls ? "panel-hidden" : ""}`}>
              <section className="studio-surface surface">
                <div className="canvas-header">
                  <div className="country-heading">
                    <CountryPicker
                      countries={countries}
                      selected={country}
                      onChange={changeCountry}
                    />
                  </div>
                  <div className="canvas-status">
                    <span className={`live-badge ${!playing ? "paused" : ""}`}>
                      <span className="status-dot" />
                      {busy
                        ? "COMPUTING"
                        : !playing
                          ? "PAUSED"
                          : construction.building
                            ? "BUILDING"
                            : playing
                              ? "DRAWING"
                              : "PAUSED"}
                    </span>
                    <span className="timer">{fmtTime(elapsed)}</span>
                  </div>
                </div>
                <div className="canvas-legend">
                  <span>
                    <i className="legend-line reference" /> Reference border
                  </span>
                  <span>
                    <i
                      className="legend-line"
                      style={{ background: appearance.color }}
                    />{" "}
                    Fourier reconstruction
                  </span>
                </div>

                <div className="drawing-space">
                  <FourierCanvas
                    id="studio-canvas"
                    analysis={analysis}
                    appearance={{
                      ...appearance,
                      fullTrace: buildMode === "final",
                      circles: buildMode !== "final" && appearance.circles,
                      arms: buildMode !== "final" && appearance.arms,
                      tip: buildMode !== "final" && appearance.tip,
                    }}
                    clock={clock}
                    dark={dark}
                    label={`${selected?.name || country} reconstructed using ${construction.terms} Fourier terms per contour. Similarity ${!busy ? analysis?.metrics.similarity.toFixed(2) : "calculating"} percent.`}
                  />
                  {busy && (
                    <span className="computing-badge">
                      <LoaderCircle size={13} className="spin" /> Computing
                      geometry
                    </span>
                  )}
                  {error && (
                    <div className="canvas-error" role="alert">
                      <Info size={18} />
                      {error}
                      <button
                        className="text-button"
                        onClick={() =>
                          setSettings({ ...settings, resolution: "50m" })
                        }
                      >
                        Use 1:50m dataset
                      </button>
                    </div>
                  )}
                  <div className="canvas-tools">
                    <button
                      className="icon-button"
                      aria-label="Zoom in"
                      onClick={() =>
                        setAppearance({
                          ...appearance,
                          zoom: Math.min(3, appearance.zoom + 0.15),
                        })
                      }
                    >
                      <Plus size={17} />
                    </button>
                    <span>{Math.round(appearance.zoom * 100)}%</span>
                    <button
                      className="icon-button"
                      aria-label="Zoom out"
                      onClick={() =>
                        setAppearance({
                          ...appearance,
                          zoom: Math.max(0.4, appearance.zoom - 0.15),
                        })
                      }
                    >
                      <Minus size={17} />
                    </button>
                    <div />
                    <button
                      className="icon-button"
                      aria-label="Fit drawing to canvas"
                      onClick={() => setAppearance({ ...appearance, zoom: 1 })}
                    >
                      <Focus size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Presentation mode"
                      onClick={() => setClean(true)}
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                  <div className="coordinate-label">z(t) = x(t) + iy(t)</div>
                  <div className="geometry-tag">
                    <Globe2 size={12} />
                    {settings.mode === "main"
                      ? "Main outline"
                      : settings.mode === "exterior"
                        ? "All exterior components"
                        : "Full geometry"}
                    <span>·</span> Natural Earth {settings.resolution}
                  </div>
                </div>
                <div className="stats-row">
                  <button
                    className="main-stat equation-stat"
                    aria-label="View Fourier equation for the current N"
                    disabled={busy || !analysis}
                    onClick={() => {
                      setEquationAnalysis(analysis);
                      setModal("equation");
                    }}
                  >
                    <span className="stat-label">
                      Fourier terms{" "}
                      <span title="View the equation and graphs for this N">
                        <Info size={12} />
                      </span>
                    </span>
                    <strong>
                      {analysis?.terms ?? construction.terms}
                      <small>N</small>
                    </strong>
                    <span className="stat-description">
                      {construction.building
                        ? `Building toward N = ${terms}`
                        : "View equation & graphs ↗"}
                    </span>
                  </button>
                  <div className="main-stat">
                    <span className="stat-label">
                      Similarity{" "}
                      <button
                        className="inline-icon"
                        aria-label="Explain similarity"
                        onClick={() => setModal("method")}
                      >
                        <Info size={12} />
                      </button>
                    </span>
                    <strong className="accent-text" aria-live="polite">
                      {busy
                        ? "—"
                        : analysis?.metrics.similarity.toFixed(2) || "—"}
                      <small>%</small>
                    </strong>
                    <span className="stat-description">
                      <span className="status-dot" />
                      {analysis && analysis.metrics.similarity >= target
                        ? "Target reached"
                        : "Measured from geometry"}
                    </span>
                  </div>
                  <div className="main-stat">
                    <span className="stat-label">Drawing progress</span>
                    <strong>
                      {Math.floor(fraction * 100)}
                      <small>%</small>
                    </strong>
                    <span className="stat-description">
                      loop {Math.min(cycle, loops)} of{" "}
                      {Number.isFinite(loops) ? loops : "∞"}
                    </span>
                  </div>
                  <div className="main-stat boundary-stat">
                    <span className="stat-label">Boundary error</span>
                    <strong>
                      {busy ? "—" : analysis?.metrics.mean.toFixed(2) || "—"}
                      <small>%</small>
                    </strong>
                    <span className="stat-description">
                      normalized mean distance
                    </span>
                  </div>
                </div>
                <div className="playback">
                  <input
                    type="range"
                    className="progress-range"
                    aria-label="Playback progress"
                    min={0}
                    max={1000}
                    value={fraction * 1000}
                    onChange={(e) => {
                      setPlaying(false);
                      seek(
                        (Math.max(0, Math.ceil(elapsed / duration) - 1) +
                          Number(e.target.value) / 1000) *
                          duration,
                      );
                    }}
                    style={
                      { "--fill": `${fraction * 100}%` } as React.CSSProperties
                    }
                  />
                  <div className="playback-inner">
                    <div className="playback-secondary">
                      <button
                        className="icon-button"
                        aria-label="Restart drawing"
                        onClick={() => {
                          seek(0);
                        }}
                      >
                        <RotateCcw size={16} />
                      </button>
                      <Playback
                        speed={speed}
                        onSpeed={setSpeed}
                        duration={duration}
                        onDuration={(n) => {
                          setDuration(n);
                          seek(buildMode === "final" ? n : 0);
                        }}
                        loops={loops}
                        onLoops={(n) => {
                          setLoops(n);
                          seek(buildMode === "final" ? duration : 0);
                        }}
                      />
                      <span className="cycle-caption">{duration}s / cycle</span>
                    </div>
                    <div className="transport">
                      <button
                        className="icon-button"
                        aria-label="Step backward"
                        onClick={() => {
                          setPlaying(false);
                          seek(Math.max(0, elapsed - duration / 200));
                        }}
                      >
                        <ChevronsLeft size={18} />
                      </button>
                      <button
                        className="play-button"
                        aria-label={
                          playing ? "Pause animation" : "Play animation"
                        }
                        onClick={() => {
                          if (buildMode === "final") {
                            setBuildMode(
                              inputMode === "similarity" ? "target" : "trace",
                            );
                            seek(0);
                            setPlaying(true);
                            return;
                          }
                          if (
                            clock.current.elapsed >=
                            duration * clock.current.loops
                          )
                            seek(0);
                          setPlaying(!playing);
                        }}
                      >
                        {playing ? (
                          <Pause size={17} fill="currentColor" />
                        ) : (
                          <Play size={17} fill="currentColor" />
                        )}
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Step forward"
                        onClick={() => {
                          setPlaying(false);
                          seek(
                            Math.min(
                              duration * clock.current.loops,
                              elapsed + duration / 200,
                            ),
                          );
                        }}
                      >
                        <ChevronsRight size={18} />
                      </button>
                    </div>
                    <div className="playback-secondary right">
                      <kbd>space</kbd>
                      <span>to {playing ? "pause" : "play"}</span>
                      {!clean && (
                        <button
                          className="icon-button"
                          aria-label={
                            controls
                              ? "Hide control panel"
                              : "Show control panel"
                          }
                          onClick={() => setControls(!controls)}
                        >
                          {controls ? (
                            <PanelRightClose size={17} />
                          ) : (
                            <PanelRightOpen size={17} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
              {!clean && controls && (
                <Controls
                  onOpenAppearance={() => setModal("appearance")}
                  terms={terms}
                  onTerms={(n) => {
                    setTerms(n);
                    if (buildMode !== "final") setPlaying(true);
                  }}
                  speed={speed}
                  onSpeed={setSpeed}
                  duration={duration}
                  onDuration={(v) => {
                    setDuration(v);
                    seek(0);
                  }}
                  loops={loops}
                  onLoops={(v) => {
                    setLoops(v);
                    seek(0);
                  }}
                  target={target}
                  onTarget={setTarget}
                  appearance={appearance}
                  onAppearance={setAppearance}
                  settings={settings}
                  onSettings={setSettings}
                  onSearch={search}
                  searching={searching}
                  progress={progress}
                  result={result}
                  onClose={() => setControls(false)}
                  inputMode={inputMode}
                  onInputMode={(mode) => {
                    setInputMode(mode);
                    if (mode === "similarity" && buildMode === "trace")
                      setBuildMode("target");
                    if (mode === "terms" && buildMode === "target")
                      setBuildMode("trace");
                  }}
                  buildMode={buildMode}
                  onBuildMode={(mode) => {
                    setBuildMode(mode);
                    if (mode !== "final") {
                      setPlaying(true);
                      seek(0);
                    } else {
                      setPlaying(false);
                      seek(duration);
                    }
                  }}
                  buildSteps={buildSteps}
                  onBuildSteps={(n) => {
                    setBuildSteps(n);
                    setPlaying(true);
                  }}
                  buildStage={construction.stage}
                  buildTotal={construction.total}
                  building={construction.building}
                  currentTerms={construction.terms}
                  onReplay={() => {
                    setPlaying(true);
                    seek(0);
                  }}
                />
              )}
            </div>
            {!clean && !controls && (
              <button
                className="button secondary floating-controls"
                onClick={() => setControls(true)}
              >
                <SlidersHorizontal size={16} /> Show controls
              </button>
            )}
            {!clean && (
              <>
                <div className="studio-bottom">
                  <section className="surface spectrum-card">
                    <div className="card-heading">
                      <div>
                        <span className="section-eyebrow">
                          THE SHAPE OF A SIGNAL
                        </span>
                        <h2>Every circle has a part to play.</h2>
                      </div>
                      <span className="small-tag">FREQUENCY SPECTRUM</span>
                    </div>
                    <div className="spectrum-layout">
                      <div className="spectrum">
                        <div className="spectrum-bars">
                          {analysis?.model.contours[0]?.coefficients
                            .filter((c) => c.frequency !== 0)
                            .slice(0, 48)
                            .map((c) => {
                              const idx =
                                  analysis.model.contours[0].coefficients.indexOf(
                                    c,
                                  ),
                                max =
                                  analysis.model.contours[0].coefficients.filter(
                                    (k) => k.frequency !== 0,
                                  )[0].amplitude;
                              return (
                                <button
                                  key={idx}
                                  className={
                                    appearance.inspector === idx
                                      ? "selected"
                                      : ""
                                  }
                                  style={{
                                    height: `${Math.max(3, Math.sqrt(c.amplitude / max) * 100)}%`,
                                    opacity: idx < construction.terms ? 1 : 0.2,
                                  }}
                                  aria-label={`Inspect frequency ${c.frequency}, amplitude ${c.amplitude.toFixed(2)}`}
                                  title={`f = ${c.frequency} · A = ${c.amplitude.toFixed(2)}`}
                                  onClick={() =>
                                    setAppearance({
                                      ...appearance,
                                      inspector:
                                        appearance.inspector === idx ? -1 : idx,
                                    })
                                  }
                                />
                              );
                            })}
                        </div>
                        <div className="spectrum-labels">
                          <span>DOMINANT FREQUENCIES</span>
                          <span>FINER DETAILS →</span>
                        </div>
                      </div>
                      <div className="spectrum-description">
                        {mainCoefficient ? (
                          <>
                            <span className="section-eyebrow">
                              COMPONENT {appearance.inspector + 1}
                            </span>
                            <p>
                              <b>f = {mainCoefficient.frequency}</b> ·{" "}
                              {mainCoefficient.frequency >= 0
                                ? "Clockwise"
                                : "Counterclockwise"}
                            </p>
                            <p>
                              A {mainCoefficient.amplitude.toFixed(2)} · φ{" "}
                              {mainCoefficient.phase.toFixed(2)} rad
                              <br />
                              {(
                                (mainCoefficient.amplitude ** 2 / totalEnergy) *
                                100
                              ).toFixed(2)}
                              % of spectral energy
                            </p>
                          </>
                        ) : (
                          <>
                            <p>
                              Big circles set the shape.
                              <br />
                              Small circles tell the story.
                            </p>
                            <button
                              className="text-button"
                              onClick={() => setModal("learn")}
                            >
                              Explore the mathematics <ArrowRight size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </section>
                  <section className="surface insight-card">
                    <div className="insight-icon">
                      <Waves size={24} />
                    </div>
                    <span className="section-eyebrow">
                      A MOMENT OF DISCOVERY
                    </span>
                    <h3>Complexity isn’t about size.</h3>
                    <p>
                      A tiny, intricate coastline can need more circles than an
                      entire continent.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setTab("Difficulty Lab")}
                    >
                      Step into the Difficulty Lab <ArrowRight size={14} />
                    </button>
                  </section>
                </div>
                {(curve.length > 0 || searching) && (
                  <section className="surface search-chart">
                    <div className="card-heading">
                      <div>
                        <span className="section-eyebrow">
                          YOUR OPTIMIZATION
                        </span>
                        <h2>Finding the right number of circles.</h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => exportFile("csv")}
                      >
                        <DownloadIcon /> Export CSV
                      </button>
                    </div>
                    <Chart
                      points={curve}
                      target={target}
                      max={Math.min(settings.cap, settings.samples)}
                      current={terms}
                    />
                    <p className="note">
                      Ascending measured search · first qualifying count on a{" "}
                      {settings.step}-term grid · no monotonicity assumption ·{" "}
                      {settings.maxTime}s time budget.
                    </p>
                  </section>
                )}
              </>
            )}
          </>
        ) : tab === "Difficulty Lab" ? (
          <DifficultyLab
            countries={countries}
            config={config}
            settings={settings}
            terms={terms}
            onTerms={setTerms}
            appearance={appearance}
            clock={clock}
            dark={dark}
          />
        ) : (
          <CompareView
            countries={countries}
            config={config}
            settings={settings}
            terms={terms}
            onTerms={setTerms}
            target={target}
            onTarget={setTarget}
            appearance={appearance}
            clock={clock}
            dark={dark}
            onPlay={() => setPlaying((p) => !p)}
            onRestart={() => seek(0)}
          />
        )}
      </main>
      {!clean && (
        <footer>
          <span>
            <FormulaMark /> Made of circles. Full of possibility.
          </span>
          <div>
            <span className="status-dot" /> REAL GEOGRAPHY. REAL MATHEMATICS.
            <button onClick={() => setModal("method")}>
              About the data <ExternalLink size={12} />
            </button>
          </div>
        </footer>
      )}
      {clean && (
        <button
          className="button secondary exit-presentation"
          onClick={() => setClean(false)}
        >
          <MinimizeIcon /> Exit presentation <kbd>esc</kbd>
        </button>
      )}
      <AnimatePresence>
        {modal && (
          <Modal
            title={
              modal === "appearance"
                ? "Appearance"
                : modal === "settings"
                  ? "Make it your own."
                  : modal === "export"
                    ? "Take your mathematics with you."
                    : modal === "method"
                      ? "Measured, not made up."
                      : modal === "equation"
                        ? "The equation behind your border."
                        : "A world made of circles."
            }
            onClose={() => setModal("")}
            wide={
              modal === "learn" || modal === "method" || modal === "equation"
            }
          >
            {modal === "appearance" && (
              <div className="appearance-popup">
                <div className="appearance-popup-heading">
                  <p>Fine-tune your canvas.</p>
                  <button
                    className="icon-button appearance-reset"
                    title="Reset appearance to defaults"
                    aria-label="Reset appearance to defaults"
                    onClick={() => {
                      setAppearance({ ...defaultAppearance });
                      notify("Default appearance restored.");
                    }}
                  >
                    <RotateCcw size={17} />
                  </button>
                </div>
                <AppearanceControls
                  appearance={appearance}
                  onChange={setAppearance}
                />
              </div>
            )}
            {modal === "settings" && (
              <>
                <p className="modal-intro">
                  Fine-tune the geometry and computation behind your drawing.
                </p>
                <label className="select-label">
                  Geographic detail
                  <select
                    value={settings.resolution}
                    onChange={(e) =>
                      setSettings({ ...settings, resolution: e.target.value })
                    }
                  >
                    <option value="50m">
                      Natural Earth 1:50m · 242 countries / territories
                    </option>
                    <option value="110m">
                      Natural Earth 1:110m · 177 countries / territories
                    </option>
                  </select>
                </label>
                <label className="select-label">
                  Contour sampling
                  <select
                    value={settings.samples}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        samples: Number(e.target.value),
                      })
                    }
                  >
                    {[256, 512, 1024, 2048].map((n) => (
                      <option value={n} key={n}>
                        {n} samples · uniform arc length
                      </option>
                    ))}
                  </select>
                </label>
                <label className="select-label">
                  Geometry mode
                  <select
                    value={settings.mode}
                    onChange={(e) =>
                      setSettings({ ...settings, mode: e.target.value })
                    }
                  >
                    <option value="main">
                      Main outline · largest exterior ring
                    </option>
                    <option value="exterior">
                      All exterior components · independent paths
                    </option>
                    <option value="full">
                      Full geometry · exteriors and interior holes
                    </option>
                  </select>
                </label>
                <p className="note">
                  Each ring draws separately. Smaller rings use fewer
                  power-of-two samples in proportion to perimeter. No lines
                  connect separate islands. {analysis?.model.excluded || 0}{" "}
                  rings excluded in the current mode.
                </p>
                <label className="select-label">
                  Maximum Fourier terms
                  <select
                    value={settings.cap}
                    onChange={(e) =>
                      setSettings({ ...settings, cap: Number(e.target.value) })
                    }
                  >
                    {[100, 250, 500, 1000].map((n) => (
                      <option key={n} value={n}>
                        {n} terms per contour
                      </option>
                    ))}
                  </select>
                </label>
                <div className="settings-divider" />
                <div className="card-heading">
                  <h3>Saved presets</h3>
                  <button className="text-button" onClick={savePreset}>
                    <Bookmark size={14} /> Save current
                  </button>
                </div>
                {presets.length ? (
                  presets.map((p, i) => (
                    <div className="preset-row" key={i}>
                      <button onClick={() => loadPreset(p.state)}>
                        {p.name}
                        <ArrowRight size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${p.name} preset`}
                        onClick={() => {
                          const next = presets.filter((_, j) => j !== i);
                          setPresets(next);
                          localStorage.setItem(
                            "forma-presets",
                            JSON.stringify(next),
                          );
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="note">
                    Save a favorite country and its settings here.
                  </p>
                )}
                <button
                  className="button secondary full-width"
                  onClick={() => {
                    setSettings(defaults);
                    setAppearance(defaultAppearance);
                    setTerms(150);
                    setSpeed(1);
                    setDuration(20);
                    setLoops(Infinity);
                    notify("Default instrument settings restored.");
                  }}
                >
                  Restore defaults
                </button>
              </>
            )}
            {modal === "export" && (
              <>
                <p className="modal-intro">
                  A still moment, an entire cycle, or the numbers behind it.
                </p>
                <div className="export-preview">
                  <Flag country={selected} />
                  <div>
                    <b>{selected?.name}</b>
                    <span>
                      {analysis?.terms ?? terms} terms ·{" "}
                      {analysis?.metrics.similarity.toFixed(2)}% similarity
                    </span>
                  </div>
                  <Waves size={35} />
                </div>
                <div className="inline-selects">
                  <label>
                    Output size
                    <select
                      value={exportOptions.size}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          size: Number(e.target.value),
                        })
                      }
                    >
                      {[800, 1600, 2400].map((n) => (
                        <option key={n} value={n}>
                          {n} × {n} px
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Video duration
                    <select
                      value={exportOptions.seconds}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          seconds: Number(e.target.value),
                        })
                      }
                    >
                      {[5, 10, 20, 30].map((n) => (
                        <option key={n} value={n}>
                          {n} seconds
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="export-toggles">
                  <Toggle
                    label="Transparent background (PNG / SVG)"
                    value={exportOptions.transparent}
                    onChange={(v) =>
                      setExportOptions({ ...exportOptions, transparent: v })
                    }
                  />
                  <Toggle
                    label="Include country label (PNG / SVG)"
                    value={exportOptions.label}
                    onChange={(v) =>
                      setExportOptions({ ...exportOptions, label: v })
                    }
                  />
                  <Toggle
                    label="Include statistics (PNG / SVG)"
                    value={exportOptions.stats}
                    onChange={(v) =>
                      setExportOptions({ ...exportOptions, stats: v })
                    }
                  />
                  <Toggle
                    label="Include epicycles"
                    value={exportOptions.epicycles}
                    onChange={(v) =>
                      setExportOptions({ ...exportOptions, epicycles: v })
                    }
                  />
                </div>
                <div className="export-buttons">
                  {[
                    ["png", "PNG image", "A high-resolution still"],
                    ["svg", "SVG artwork", "A scalable vector drawing"],
                    [
                      "webm",
                      "WebM animation",
                      "One real-time cycle · up to 1200px",
                    ],
                    ["json", "Settings JSON", "Your complete instrument setup"],
                    [
                      "coefficients",
                      "Fourier data",
                      "All complex coefficients",
                    ],
                    ["csv", "Accuracy CSV", "Measured results & error"],
                  ].map(([type, name, sub]) => (
                    <button
                      key={type}
                      disabled={
                        busy ||
                        exporting ||
                        (type === "webm" &&
                          typeof MediaRecorder === "undefined")
                      }
                      onClick={() => exportFile(type)}
                    >
                      <span>
                        <b>{name}</b>
                        <small>{sub}</small>
                      </span>
                      {exporting && type === "webm" ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <ArrowDownToLine size={17} />
                      )}
                    </button>
                  ))}
                </div>
                <p className="note">
                  PNG and WebM use the canvas renderer. SVG includes the
                  completed reconstruction and epicycles at t = 0. Exports
                  preserve the current color and stroke. Video uses an opaque
                  light background.
                </p>
              </>
            )}
            {modal === "equation" && <Equation analysis={equationAnalysis} />}
            {modal === "method" && <SimilarityExplainer analysis={analysis} />}
            {modal === "learn" && (
              <LearningExplainer
                config={config}
                onUse={(n) => {
                  setTerms(n);
                  setTab("Studio");
                  setModal("");
                  setPlaying(true);
                  seek(0);
                }}
              />
            )}
          </Modal>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Check size={17} />
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function DownloadIcon() {
  return <ArrowDownToLine size={14} />;
}
function MinimizeIcon() {
  return <Expand size={15} />;
}
