import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { reconstruct, type Analysis } from "./engine";

const decimal = (value: number) =>
  (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);

export default function Equation({ analysis }: { analysis?: Analysis }) {
  const [ring, setRing] = useState(0);
  const reduced = useReducedMotion();
  if (!analysis) return <p>Choose a country to see its equation.</p>;
  const contour = analysis.model.contours[ring] || analysis.model.contours[0];
  const terms = contour.coefficients.slice(0, analysis.terms);
  const points = reconstruct(contour, analysis.terms);
  const extent = Math.max(
    0.01,
    ...points.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]),
  );
  const top = terms.filter((c) => c.frequency !== 0).slice(0, 12);
  const highest = Math.max(0.01, ...top.map((c) => c.amplitude));
  return (
    <div className="fourier-equation">
      <div className="equation-context">
        <span className="equation-n">N = {analysis.terms}</span>
        <span>{terms.length} terms in this contour · t from 0 to 1</span>
      </div>
      {analysis.model.contours.length > 1 && (
        <label className="select-label">
          Contour
          <select
            aria-label="Equation contour"
            value={ring}
            onChange={(e) => setRing(Number(e.target.value))}
          >
            {analysis.model.contours.map((c, i) => (
              <option key={i} value={i}>
                Contour {i + 1}
                {c.hole ? " · hole" : " · border"}
              </option>
            ))}
          </select>
        </label>
      )}
      <div
        className="equation-formula"
        aria-label="Fourier reconstruction equation"
      >
        <div>
          z<sub>{analysis.terms}</sub>(t) = x(t) + iy(t)
        </div>
        <div className="equation-sum">
          ={" "}
          <span>
            ∑<small>j = 1…{terms.length}</small>
          </span>{" "}
          A<sub>j</sub> e<sup>i(2πfⱼt + φⱼ)</sup>
        </div>
        <p>
          {terms.slice(0, 3).map((c, i) => (
            <span key={c.frequency}>
              {i > 0 && " + "}
              {decimal(c.amplitude)} e
              <sup>
                i(2π × {c.frequency}t {c.phase < 0 ? "−" : "+"}{" "}
                {decimal(Math.abs(c.phase))})
              </sup>
            </span>
          ))}
          {terms.length > 3 && (
            <span>
              {" "}
              + … <small>({terms.length - 3} more terms)</small>
            </span>
          )}
        </p>
      </div>
      <div className="equation-graphs">
        {([0, 1] as const).map((axis) => {
          const path = points
            .map(
              (p, i) =>
                `${i ? "L" : "M"}${30 + (i / (points.length - 1)) * 280},${86 - (p[axis] / extent) * 54}`,
            )
            .join(" ");
          return (
            <div className="equation-wave" key={axis}>
              <h3>
                <span className={axis ? "teal-dot" : "blue-dot"} />
                {axis
                  ? "y(t) · vertical position"
                  : "x(t) · horizontal position"}
              </h3>
              <svg
                viewBox="0 0 330 176"
                role="img"
                aria-label={`${axis ? "y" : "x"} position over one complete Fourier loop`}
              >
                <path
                  d="M30 28V145H310 M30 86H310"
                  fill="none"
                  stroke="var(--border)"
                />
                <text x="7" y="35">
                  {decimal(extent)}
                </text>
                <text x="7" y="144">
                  {decimal(-extent)}
                </text>
                <text x="29" y="165">
                  0
                </text>
                <text x="293" y="165">
                  1 · t
                </text>
                <motion.path
                  d={path}
                  fill="none"
                  stroke={axis ? "#168d91" : "#4358ce"}
                  strokeWidth="2.5"
                  initial={{ pathLength: reduced ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2 }}
                />
              </svg>
            </div>
          );
        })}
      </div>
      <div className="equation-amplitudes">
        <h3>The largest rotating circles</h3>
        <div className="equation-bars">
          {top.map((c, i) => (
            <div
              key={c.frequency}
              title={`Frequency ${c.frequency} · amplitude ${decimal(c.amplitude)}`}
            >
              <span>{decimal(c.amplitude)}</span>
              <div>
                <motion.i
                  initial={{
                    height: reduced ? `${(c.amplitude / highest) * 100}%` : 0,
                  }}
                  animate={{ height: `${(c.amplitude / highest) * 100}%` }}
                  transition={{ duration: 0.5, delay: reduced ? 0 : i * 0.025 }}
                />
              </div>
              <small>f {c.frequency}</small>
            </div>
          ))}
        </div>
      </div>
      <details className="technical-details equation-coefficients">
        <summary>
          All {terms.length} terms · actual coefficients{" "}
          <ChevronDown size={16} />
        </summary>
        <p>
          Each row contributes A · e<sup>i(2πft + φ)</sup>. Phases are radians.
          Values are displayed to two decimal places; the drawing uses full
          precision.
        </p>
        <div className="equation-table">
          <table>
            <thead>
              <tr>
                <th>Term</th>
                <th>Frequency f</th>
                <th>Amplitude A</th>
                <th>Phase φ</th>
                <th>Real</th>
                <th>Imaginary</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((c, i) => (
                <tr key={c.frequency}>
                  <td>{i + 1}</td>
                  <td>{c.frequency}</td>
                  <td>{decimal(c.amplitude)}</td>
                  <td>{decimal(c.phase)}</td>
                  <td>{decimal(c.re)}</td>
                  <td>{decimal(c.im)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="equation-footnote">
        One full turn in t traces the border. Every contour has its own
        independent equation.
      </p>
    </div>
  );
}
