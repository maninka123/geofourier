import { useState } from "react";
import {
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Info,
  Sparkles,
  ArrowRight,
  Square,
} from "lucide-react";
import type { Appearance } from "./Canvas";
import type { BuildMode } from "./construction";
import type { SearchResult } from "./engine";
import type { Progress } from "./client";
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = "",
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  suffix?: string;
  help?: string;
}) {
  return (
    <div className="slider-control">
      <div className="control-label">
        <label>
          {label}
          {help && (
            <span className="help" title={help}>
              <Info size={13} />
            </span>
          )}
        </label>
        <div className="number-field">
          <input
            aria-label={label}
            type="number"
            value={Number(value.toFixed(2))}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              if (e.target.value !== "")
                onChange(Math.min(max, Math.max(min, Number(e.target.value))));
            }}
          />
          {suffix && <span>{suffix}</span>}
        </div>
      </div>
      <input
        className="range"
        aria-label={`${label} slider`}
        type="range"
        style={
          {
            "--fill": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="range-labels">
        <span>
          {min}
          {suffix}
        </span>
        <span>
          {max}
          {suffix}
        </span>
      </div>
    </div>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        {help && (
          <span title={help} className="help">
            <Info size={13} />
          </span>
        )}
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}
export type Settings = {
  resolution: string;
  samples: number;
  mode: string;
  cap: number;
  step: number;
  maxTime: number;
  progressive: boolean;
  fps: number;
};
export const defaults: Settings = {
  resolution: "50m",
  samples: 1024,
  mode: "main",
  cap: 500,
  step: 5,
  maxTime: 30,
  progressive: false,
  fps: 60,
};
export function AppearanceControls({
  appearance: a,
  onChange,
}: {
  appearance: Appearance;
  onChange: (a: Appearance) => void;
}) {
  const update = (k: keyof Appearance, v: unknown) =>
    onChange({ ...a, [k]: v });
  return (
    <>
      <div className="color-row">
        <label>Trace color</label>
        <div className="swatches">
          {["#536ce9", "#00a2a2", "#d88d56", "#a572cd", "#df698a"].map(
            (color) => (
              <button
                key={color}
                className={a.color === color ? "selected" : ""}
                style={{ background: color }}
                aria-label={`Trace color ${color}`}
                onClick={() => update("color", color)}
              />
            ),
          )}
          <input
            type="color"
            aria-label="Custom trace color"
            value={a.color}
            onChange={(e) => update("color", e.target.value)}
          />
        </div>
      </div>
      {(
        [
          ["circles", "Epicycle circles"],
          ["arms", "Radius arms"],
          ["reference", "Ghost outline"],
          ["silhouette", "Country silhouette"],
          ["trail", "Drawing trail"],
          ["tip", "Drawing tip"],
          ["grid", "Canvas grid"],
          ["guides", "Center guides"],
          ["glow", "Soft glow"],
          ["fading", "Trail fading"],
          ["heatmap", "Error heatmap"],
        ] as const
      ).map(([key, label]) => (
        <Toggle
          key={key}
          label={label}
          value={a[key]}
          onChange={(v) => update(key, v)}
        />
      ))}
      {a.heatmap && (
        <p className="note">
          Blue: &lt;1% normalized local error · amber: 1–3.5% · red: &gt;3.5%.
          Error is measured at corresponding contour samples.
        </p>
      )}
      <Slider
        label="Stroke width"
        min={0.5}
        max={4}
        step={0.1}
        value={a.stroke}
        onChange={(v) => update("stroke", v)}
        suffix="px"
      />
      <Slider
        label="Circle opacity"
        min={0}
        max={1}
        step={0.01}
        value={a.opacity}
        onChange={(v) => update("opacity", v)}
      />
      <Slider
        label="Trail length"
        min={1}
        max={100}
        value={a.trailLength}
        onChange={(v) => update("trailLength", v)}
        suffix="%"
      />
    </>
  );
}
export function SearchSummary({
  result,
  progress,
  target,
  onApply,
}: {
  result?: SearchResult;
  progress?: Progress;
  target: number;
  onApply: (n: number) => void;
}) {
  return (
    <>
      {progress && !result && (
        <div className="search-progress" aria-live="polite">
          <div>
            <span className="pulse" /> Testing {progress.point.terms} terms{" "}
            <b>{progress.point.similarity.toFixed(2)}%</b>
          </div>
          <small>
            Best {progress.best.similarity.toFixed(2)}% · {progress.evaluations}{" "}
            evaluations · {(progress.elapsed / 1000).toFixed(1)}s
          </small>
        </div>
      )}
      {result && (
        <div
          className={`search-result ${result.reached ? "success" : "warning"}`}
          aria-live="polite"
        >
          <b>
            {result.evaluations === 0
              ? "No reconstruction was evaluated before the search stopped."
              : result.reached
                ? "Target reached"
                : result.reason === "cancelled"
                  ? "Search stopped"
                  : "Target not reached within limits"}
          </b>
          <p>
            {result.evaluations === 0
              ? "Try starting the search again."
              : result.reached
                ? `${result.best.terms} terms reached ${result.best.similarity.toFixed(2)}% similarity.`
                : `Requested ${target.toFixed(2)}%. Best measured: ${result.best.similarity.toFixed(2)}% at ${result.best.terms} terms.`}
          </p>
          <small>
            {result.evaluations} measured values ·{" "}
            {(result.elapsed / 1000).toFixed(2)}s · step {result.granularity}
            {result.reason === "time" ? " · Time limit reached" : ""}
          </small>
          {!result.reached && (
            <p className="note">
              Try a higher term budget, finer search step, or higher sample
              count. This is a measured limit for this search, not a theoretical
              maximum.
            </p>
          )}
          <button
            className="text-button"
            disabled={result.evaluations === 0}
            onClick={() => onApply(result.best.terms)}
          >
            Use best reconstruction <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
export default function Controls({
  terms,
  onTerms,
  speed,
  onSpeed,
  duration,
  onDuration,
  loops,
  onLoops,
  target,
  onTarget,
  appearance,
  onAppearance,
  settings,
  onSettings,
  onSearch,
  searching,
  progress,
  result,
  onClose,
  inputMode,
  onInputMode,
  buildMode,
  onBuildMode,
  buildSteps,
  onBuildSteps,
  buildStage,
  buildTotal,
  building,
  currentTerms,
  onReplay,
}: {
  terms: number;
  onTerms: (n: number) => void;
  speed: number;
  onSpeed: (n: number) => void;
  duration: number;
  onDuration: (n: number) => void;
  loops: number;
  onLoops: (n: number) => void;
  target: number;
  onTarget: (n: number) => void;
  appearance: Appearance;
  onAppearance: (a: Appearance) => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onSearch: () => void;
  searching: boolean;
  progress?: Progress;
  result?: SearchResult;
  onClose: () => void;
  inputMode: "terms" | "similarity";
  onInputMode: (v: "terms" | "similarity") => void;
  buildMode: BuildMode;
  onBuildMode: (v: BuildMode) => void;
  buildSteps: number;
  onBuildSteps: (n: number) => void;
  buildStage: number;
  buildTotal: number;
  building: boolean;
  currentTerms: number;
  onReplay: () => void;
}) {
  const [tab, setTab] = useState("Parameters");
  return (
    <aside className="controls-panel">
      <div className="panel-heading">
        <div>
          <SlidersHorizontal size={17} />
          <h2>Your instrument</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Collapse controls"
        >
          <ChevronDown size={17} />
        </button>
      </div>
      <div className="segmented">
        {["Parameters", "Appearance"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="controls-content">
        {tab === "Parameters" ? (
          <>
            <section>
              <div className="segmented input-mode">
                <button
                  className={inputMode === "terms" ? "active" : ""}
                  onClick={() => onInputMode("terms")}
                >
                  By terms (N)
                </button>
                <button
                  className={inputMode === "similarity" ? "active" : ""}
                  onClick={() => onInputMode("similarity")}
                >
                  By similarity
                </button>
              </div>
              {inputMode === "terms" ? (
                <Slider
                  label="Final Fourier terms"
                  min={1}
                  max={Math.min(settings.cap, settings.samples)}
                  value={terms}
                  onChange={onTerms}
                  help="N coefficients per independent contour, ordered by amplitude with signed frequencies."
                />
              ) : (
                <>
                  <Slider
                    label="Target similarity"
                    min={70}
                    max={99.9}
                    step={0.1}
                    value={target}
                    onChange={onTarget}
                    suffix="%"
                  />
                  <p className="note">
                    Automatically finds the first measured qualifying N within
                    your search budget.
                  </p>
                </>
              )}
              {inputMode === "similarity" && (
                <div className="goal-summary">
                  <span>Calculated terms</span>
                  <b>N = {terms}</b>
                </div>
              )}
              {inputMode === "similarity" && (
                <>
                  <details className="search-details">
                    <summary>
                      Search details <ChevronDown size={14} />
                    </summary>
                    <button className="text-button" onClick={onSearch}>
                      {searching ? (
                        <>
                          <Square size={13} />
                          Stop search
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Recalculate target
                        </>
                      )}
                    </button>
                    <SearchSummary
                      result={result}
                      progress={progress}
                      target={target}
                      onApply={onTerms}
                    />
                  </details>
                </>
              )}
            </section>
            <section className="construction-controls">
              <label className="select-label animation-style">
                Show me
                <select
                  aria-label="Animation style"
                  value={buildMode}
                  onChange={(e) => onBuildMode(e.target.value as BuildMode)}
                >
                  <option value="construction">
                    Full construction · increasing N
                  </option>
                  {inputMode === "similarity" ? (
                    <option value="target">Animate final target result</option>
                  ) : (
                    <option value="trace">Trace at the selected N</option>
                  )}
                  <option value="final">Final shape only</option>
                </select>
              </label>
              {buildMode === "construction" ? (
                <>
                  <div className="construction-stepper">
                    <label htmlFor="construction-steps">
                      Construction levels
                    </label>
                    <div>
                      <button
                        aria-label="Fewer construction levels"
                        disabled={buildSteps <= 2}
                        onClick={() => onBuildSteps(buildSteps - 1)}
                      >
                        −
                      </button>
                      <input
                        id="construction-steps"
                        aria-label="Construction steps"
                        type="number"
                        min={2}
                        max={20}
                        value={buildSteps}
                        onChange={(e) => {
                          if (e.target.value)
                            onBuildSteps(
                              Math.max(2, Math.min(20, Number(e.target.value))),
                            );
                        }}
                      />
                      <button
                        aria-label="More construction levels"
                        disabled={buildSteps >= 20}
                        onClick={() => onBuildSteps(buildSteps + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="build-status">
                    <span>
                      {building
                        ? `Step ${buildStage} of ${buildTotal}`
                        : `Looping at N = ${terms}`}
                    </span>
                    <button
                      className="icon-button"
                      title="Replay construction"
                      aria-label="Replay construction"
                      onClick={onReplay}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                  <div className="build-track">
                    <i
                      style={{ width: `${(buildStage / buildTotal) * 100}%` }}
                    />
                  </div>
                  <p className="note">
                    One complete outline at each N. The final N keeps looping.
                  </p>
                </>
              ) : (
                <p className="note">
                  {buildMode === "trace" || buildMode === "target"
                    ? `Trace with N = ${terms} on every loop. No intermediate levels.`
                    : `Show the completed N = ${terms} reconstruction immediately.`}
                </p>
              )}
            </section>
            <details className="advanced-inline">
              <summary>
                Advanced <ChevronDown size={14} />
              </summary>
              <label className="select-label">
                Term budget
                <select
                  value={settings.cap}
                  onChange={(e) =>
                    onSettings({ ...settings, cap: Number(e.target.value) })
                  }
                >
                  {[100, 250, 500, 1000].map((n) => (
                    <option key={n} value={n}>
                      {n} terms / contour
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-label">
                Search granularity
                <select
                  value={settings.step}
                  onChange={(e) =>
                    onSettings({ ...settings, step: Number(e.target.value) })
                  }
                >
                  {[1, 2, 5, 10, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} term{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-label">
                Time budget
                <select
                  value={settings.maxTime}
                  onChange={(e) =>
                    onSettings({ ...settings, maxTime: Number(e.target.value) })
                  }
                >
                  {[5, 15, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </select>
              </label>
            </details>
          </>
        ) : (
          <section className="appearance-section">
            <AppearanceControls
              appearance={appearance}
              onChange={onAppearance}
            />
          </section>
        )}
      </div>
      <div className="panel-foot">
        <span className="status-dot" /> Calculated, never approximated by eye.
      </div>
    </aside>
  );
}
