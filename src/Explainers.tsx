import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Layers3,
  Waves,
} from "lucide-react";
import FourierCanvas, { defaultAppearance, type Clock } from "./Canvas";
import { Slider } from "./Controls";
import { useAnalysis, type Config } from "./client";
import type { Analysis, Point } from "./engine";
const svgPath = (p: Point[]) =>
  p
    .map(([x, y], i) => `${i ? "L" : "M"}${150 + x * 110},${135 + y * 110}`)
    .join(" ") + " Z";
export function SimilarityExplainer({ analysis }: { analysis?: Analysis }) {
  const [view, setView] = useState("Overlay");
  return (
    <div className="similarity-explainer">
      <p className="explainer-intro">Two checks. One honest score.</p>
      <div className="score-explainer-grid">
        <div className="shape-explainer">
          <div className="segmented">
            {["Original", "Fourier", "Overlay"].map((v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <svg
            viewBox="0 0 300 270"
            role="img"
            aria-label="Compare the original boundary and Fourier reconstruction"
          >
            {view !== "Fourier" &&
              analysis?.model.contours.map((c, i) => (
                <path
                  key={`original-${i}`}
                  d={svgPath(c.source || c.points)}
                  fill="none"
                  stroke="#9aa3b4"
                  strokeWidth="1.5"
                />
              ))}
            {view !== "Original" &&
              analysis?.paths.map((p, i) => (
                <motion.path
                  key={`fourier-${i}-${view}`}
                  d={svgPath(p)}
                  fill={view === "Overlay" ? "#5368dc12" : "none"}
                  stroke="#4358ce"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
              ))}
          </svg>
          <span className="note">Same coordinates. Complete outlines.</span>
        </div>
        <div className="score-equation">
          <div>
            <span className="score-weight">70%</span>
            <span>
              Shape overlap<small>How much land is shared?</small>
            </span>
            <b>{analysis?.metrics.iou.toFixed(2) ?? "—"}%</b>
          </div>
          <span className="equation-plus">+</span>
          <div>
            <span className="score-weight">30%</span>
            <span>
              Boundary match<small>How close are the borders?</small>
            </span>
            <b>{analysis?.metrics.boundary.toFixed(2) ?? "—"}%</b>
          </div>
          <div className="score-total">
            <span>Similarity</span>
            <strong>
              {analysis?.metrics.similarity.toFixed(2) ?? "—"}
              <small>%</small>
            </strong>
          </div>
        </div>
      </div>
      <p className="explainer-note">
        <Waves size={17} />
        Drawing progress tells you how much has been traced. Similarity measures
        the quality of the whole shape.
      </p>
      <details className="technical-details">
        <summary>
          The precise mathematics & data <ChevronDown size={16} />
        </summary>
        <div>
          <h3>Shape overlap · IoU</h3>
          <p>
            Intersection ÷ union of silhouettes on a common 192 × 192 scanline
            grid. The raster extent expands to contain the reconstruction,
            preventing clipping. Polygon holes use even–odd filling; separate
            polygons are unioned.
          </p>
          <h3>Boundary score</h3>
          <p>
            100 × exp(−20d / D). d is the bidirectional nearest-point Chamfer
            distance from arc-length samples; D is the reference bounding-box
            diagonal. Small islands may be below raster resolution, so boundary
            distance complements overlap.
          </p>
          <div className="metric-detail">
            <span>
              Mean error<b>{analysis?.metrics.mean.toFixed(2)}% D</b>
            </span>
            <span>
              RMS error<b>{analysis?.metrics.rms.toFixed(2)}% D</b>
            </span>
            <span>
              Sampled max<b>{analysis?.metrics.max.toFixed(2)}% D</b>
            </span>
          </div>
          <h3>What is being compared?</h3>
          <p>
            The original boundary in the selected map dataset. Evenly spaced
            points are used to calculate the Fourier series; scores are checked
            against the original boundary. N applies separately to each ring.
            Increasing-N search tests measured values without assuming
            monotonicity; the first match is limited by the chosen search step
            and budget.
          </p>
          <h3>Geographic assumptions</h3>
          <p>
            Natural Earth Admin 0, de facto boundaries. Longitudes are unwrapped
            at the antimeridian, projected using local equirectangular longitude
            scaling at the principal boundary’s mean latitude, and uniformly
            centered and scaled. Projected aspect ratio is preserved; projection
            distortion grows over very extensive countries. This app does not
            endorse territorial claims.
          </p>
          <a
            className="text-button"
            href="https://github.com/nvkelso/natural-earth-vector"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth source <ExternalLink size={14} />
          </a>
        </div>
      </details>
    </div>
  );
}
export function LearningExplainer({
  config,
  onUse,
}: {
  config: Config;
  onUse: (n: number) => void;
}) {
  const [terms, setTerms] = useState(5),
    { analysis, busy } = useAnalysis(config, terms);
  const clock = useRef<Clock>({
    elapsed: 7,
    playing: false,
    duration: 10,
    speed: 1,
    loops: Infinity,
  });
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0,
      last = performance.now();
    clock.current.playing = true;
    const tick = (now: number) => {
      clock.current.elapsed += Math.min(0.1, (now - last) / 1000);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="learning-explainer">
      <p className="explainer-intro">Small circles. Remarkable detail.</p>
      <div className="learn-visual">
        <FourierCanvas
          analysis={analysis}
          appearance={{
            ...defaultAppearance,
            fullTrace: true,
            grid: false,
            reference: true,
            zoom: 0.9,
          }}
          clock={clock}
          label={`Interactive Fourier explanation, ${terms} terms`}
        />
        <span>N = {terms}</span>
      </div>
      <Slider
        label="Try adding more circles"
        min={1}
        max={100}
        value={terms}
        onChange={setTerms}
      />
      <div className="learning-caption" aria-live="polite">
        <b>
          {busy
            ? "Measuring…"
            : `${analysis?.metrics.similarity.toFixed(2)}% similarity`}
        </b>
        <span>
          {terms < 10
            ? "A few big circles capture the broad shape."
            : terms < 40
              ? "Smaller circles start recovering the border’s details."
              : "More frequencies reveal finer details in the coastline."}
        </span>
      </div>
      <div className="learning-mini-steps">
        <div>
          <span>01</span>
          <Layers3 size={20} />
          <b>A real border</b>
          <p>Evenly sample its coordinates.</p>
        </div>
        <div>
          <span>02</span>
          <Waves size={20} />
          <b>A set of circles</b>
          <p>The FFT finds their sizes and speeds.</p>
        </div>
        <div>
          <span>03</span>
          <ArrowRight size={20} />
          <b>One drawing tip</b>
          <p>Add the rotating vectors to trace it.</p>
        </div>
      </div>
      <button
        className="button primary full-width"
        onClick={() => onUse(terms)}
      >
        Try N = {terms} in the Studio <ArrowRight size={16} />
      </button>
    </div>
  );
}
