import { memo, useEffect, useRef, useState } from "react";
import {
  Upload,
  PenLine,
  Pentagon,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Play,
  Pause,
  Download,
  X,
} from "lucide-react";
import {
  MAX_FILE_BYTES,
  parseCSV,
  parseGeoJSON,
  parseSVG,
  ringsToBoundary,
  type BoundaryInput,
} from "./customBoundary";
import { nearestOnBoundary } from "./validation";
import { request } from "./client";
import type { Analysis, Point } from "./engine";
import FourierCanvas, { type Appearance, type Clock } from "./Canvas";
import Components from "./Components";
import Modal from "./Modal";
import { Slider } from "./Controls";
import { download } from "./exports";

function DrawingPad({
  onUse,
  onClose,
}: {
  onUse: (input: BoundaryInput) => void;
  onClose: () => void;
}) {
  const [paths, setPaths] = useState<Point[][]>([]),
    [undo, setUndo] = useState<Point[][][]>([]),
    [redo, setRedo] = useState<Point[][][]>([]),
    [draft, setDraft] = useState<Point[]>([]),
    [tool, setTool] = useState("pen"),
    [error, setError] = useState("");
  const drawing = useRef(false);
  const commit = (next: Point[][]) => {
    setUndo((u) => [...u.slice(-49), paths]);
    setPaths(next);
    setRedo([]);
  };
  const point = (e: React.PointerEvent<SVGSVGElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * 800,
      ((e.clientY - r.top) / r.height) * 480,
    ];
  };
  const erase = (p: Point) => {
    const next = paths.filter((r) => nearestOnBoundary(p, r).distance > 14);
    if (next.length !== paths.length) commit(next);
  };
  return (
    <Modal title="Draw your boundary" wide onClose={onClose}>
      <div className="drawing-tools" role="toolbar" aria-label="Drawing tools">
        <button
          className={tool === "pen" ? "active" : ""}
          aria-pressed={tool === "pen"}
          onClick={() => {
            setTool("pen");
            setDraft([]);
          }}
        >
          <PenLine size={16} /> Pen
        </button>
        <button
          className={tool === "polygon" ? "active" : ""}
          aria-pressed={tool === "polygon"}
          onClick={() => {
            setTool("polygon");
            setDraft([]);
          }}
        >
          <Pentagon size={16} /> Polygon
        </button>
        <button
          className={tool === "eraser" ? "active" : ""}
          aria-pressed={tool === "eraser"}
          onClick={() => {
            setTool("eraser");
            setDraft([]);
          }}
        >
          <Eraser size={16} /> Erase outline
        </button>
        <button
          disabled={!undo.length}
          onClick={() => {
            setRedo([...redo, paths]);
            setPaths(undo.at(-1)!);
            setUndo(undo.slice(0, -1));
          }}
        >
          <Undo2 size={16} /> Undo
        </button>
        <button
          disabled={!redo.length}
          onClick={() => {
            setUndo([...undo, paths]);
            setPaths(redo.at(-1)!);
            setRedo(redo.slice(0, -1));
          }}
        >
          <Redo2 size={16} /> Redo
        </button>
        <button
          disabled={!paths.length}
          onClick={() => {
            commit([]);
            setDraft([]);
          }}
        >
          <Trash2 size={16} /> Clear
        </button>
        {tool === "polygon" && (
          <button
            disabled={draft.length < 3}
            onClick={() => {
              commit([...paths, draft]);
              setDraft([]);
            }}
          >
            Close polygon
          </button>
        )}
      </div>
      <svg
        className={`drawing-pad ${tool}`}
        viewBox="0 0 800 480"
        role="img"
        aria-label="Draw closed outlines here with a pointer or touch"
        onPointerDown={(e) => {
          e.preventDefault();
          if (tool === "polygon") {
            const p = point(e);
            setDraft((d) => [...d, p]);
            setError("");
            return;
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          setError("");
          const p = point(e);
          if (tool === "eraser") erase(p);
          else setDraft([p]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = point(e);
          if (tool === "eraser") erase(p);
          else
            setDraft((d) =>
              d.length < 10000 &&
              Math.hypot(p[0] - d.at(-1)![0], p[1] - d.at(-1)![1]) > 2
                ? [...d, p]
                : d,
            );
        }}
        onPointerUp={(e) => {
          if (tool === "polygon") return;
          drawing.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (tool === "pen" && draft.length >= 3) {
            commit([...paths, draft]);
          }
          setDraft([]);
        }}
        onPointerCancel={() => {
          drawing.current = false;
          setDraft([]);
        }}
      >
        <defs>
          <pattern
            id="drawing-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="var(--border)" />
          </pattern>
        </defs>
        <rect width="800" height="480" fill="url(#drawing-grid)" />
        {paths.map((ps, i) => (
          <path
            key={i}
            d={
              ps.map((p, j) => `${j ? "L" : "M"}${p.join(",")}`).join(" ") + "Z"
            }
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        ))}
        <polyline
          points={draft.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        {!paths.length && !draft.length && (
          <text x="400" y="240" textAnchor="middle">
            Draw an outline · add more strokes for separate shapes
          </text>
        )}
      </svg>
      <div className="drawing-pad-footer">
        <p className="note">
          Gaps close with a straight edge. Nested outlines become holes.
        </p>
        <button
          className="button primary"
          disabled={!paths.length}
          onClick={() => {
            try {
              onUse(
                ringsToBoundary(
                  paths.map((points) => ({ points, closed: true })),
                  "Drawn shape",
                ),
              );
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Use closed outlines
        </button>
      </div>
      {error && (
        <p className="note" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
function CustomShapes({
  appearance,
  dark,
}: {
  appearance: Appearance;
  dark: boolean;
}) {
  const [input, setInput] = useState<BoundaryInput>(),
    [pending, setPending] = useState<BoundaryInput>(),
    [error, setError] = useState(""),
    [drawing, setDrawing] = useState(false),
    [terms, setTerms] = useState(30),
    [samples, setSamples] = useState(512),
    [analysis, setAnalysis] = useState<Analysis>(),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(
      () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const file = useRef<HTMLInputElement>(null),
    serial = useRef(0),
    instance = useRef(crypto.randomUUID()),
    clock = useRef<Clock>({
      elapsed: 0,
      playing: true,
      duration: 20,
      speed: 2,
      loops: Infinity,
    });
  const useInput = (next: BoundaryInput) => {
    serial.current++;
    setInput(next);
    setPending(undefined);
    setError("");
  };
  useEffect(() => {
    if (!input) return;
    let active = true;
    setBusy(true);
    setError("");
    const job = request<Analysis>(
      "analyze",
      {
        country: `custom-${instance.current}-${serial.current}`,
        resolution: "custom",
        samples,
        mode: "full",
      },
      { geometry: input.geometry, terms },
    );
    job.promise
      .then((a) => {
        if (active) setAnalysis(a);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      job.cancel();
    };
  }, [input, terms, samples]);
  useEffect(() => {
    clock.current.playing = playing;
    if (!playing) return;
    let frame = 0,
      last = performance.now();
    const tick = (now: number) => {
      clock.current.elapsed += ((now - last) / 1000) * 2;
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  const load = async (f: File) => {
    setError("");
    setPending(undefined);
    if (f.size > MAX_FILE_BYTES) {
      setError("Use a file smaller than 2 MB.");
      return;
    }
    try {
      const text = await f.text();
      const ext = f.name.split(".").at(-1)?.toLowerCase();
      const result =
        ext === "svg"
          ? parseSVG(text, f.name)
          : ext === "csv"
            ? parseCSV(text, f.name)
            : ext === "geojson" || ext === "json"
              ? parseGeoJSON(text, f.name)
              : (() => {
                  throw Error("Choose GeoJSON, SVG or CSV.");
                })();
      if (result.openPaths) setPending(result);
      else useInput(result);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="custom-shapes-view">
      <div className="view-heading">
        <div>
          <span className="section-eyebrow">YOUR OWN GEOMETRY</span>
          <h1>Every outline has a rhythm.</h1>
          <p>Upload a boundary or draw one.</p>
        </div>
        <div className="view-actions">
          <button
            className="button secondary"
            onClick={() => file.current?.click()}
          >
            <Upload size={16} /> Upload boundary
          </button>
          <button className="button primary" onClick={() => setDrawing(true)}>
            <PenLine size={16} /> Draw a shape
          </button>
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept=".geojson,.json,.svg,.csv"
        aria-label="Upload GeoJSON SVG or CSV boundary"
        className="visually-hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="info-banner" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="surface open-path-confirm">
          <div>
            <b>
              {pending.openPaths} open{" "}
              {pending.openPaths === 1 ? "path" : "paths"} found
            </b>
            <p>
              Fourier drawing needs closed outlines. Close each gap with a
              straight edge?
            </p>
          </div>
          <button
            className="button primary"
            onClick={() => useInput({ ...pending, openPaths: 0 })}
          >
            Close paths & use
          </button>
          <button
            className="icon-button"
            aria-label="Cancel import"
            onClick={() => setPending(undefined)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {input ? (
        <div className="custom-shape-workspace">
          <section className="surface custom-shape-stage">
            <div className="card-heading">
              <h2>{input.name}</h2>
              <span className="small-tag">
                {input.points.toLocaleString()} input points
              </span>
              <button
                className="icon-button"
                aria-label="Remove shape"
                onClick={() => {
                  setInput(undefined);
                  setAnalysis(undefined);
                }}
              >
                <X size={17} />
              </button>
            </div>
            <div className="custom-shape-canvas">
              <FourierCanvas
                analysis={analysis}
                appearance={{
                  ...appearance,
                  color: dark ? "#50c79b" : "#21805e",
                  heatmap: false,
                  fullTrace: true,
                  grid: true,
                }}
                clock={clock}
                dark={dark}
                label={`${input.name}, ${terms} Fourier terms per contour`}
              />
              {busy && (
                <span className="canvas-loading">Updating outline…</span>
              )}
            </div>
            <div className="custom-shape-transport">
              <button
                className="play-button"
                aria-label={playing ? "Pause shape" : "Play shape"}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span>2× · 10s per outline</span>
              <button
                className="text-button"
                disabled={!analysis}
                onClick={() =>
                  download(
                    JSON.stringify(input.geometry, null, 2),
                    "forma-boundary.json",
                    "application/json",
                  )
                }
              >
                <Download size={14} /> Boundary JSON
              </button>
            </div>
          </section>
          <aside className="surface custom-shape-controls">
            <h2>Shape parameters</h2>
            <Slider
              label="Fourier terms"
              value={terms}
              min={1}
              max={samples}
              onChange={setTerms}
            />
            <label className="select-label">
              Contour sampling
              <select
                value={samples}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSamples(n);
                  setTerms(Math.min(n, terms));
                }}
              >
                {[256, 512, 1024, 2048].map((n) => (
                  <option key={n} value={n}>
                    {n} samples
                  </option>
                ))}
              </select>
            </label>
            <div className="experiment-stats">
              <div>
                <small>Boundary similarity</small>
                <b>
                  {analysis?.metrics.similarity.toFixed(2)}
                  <em>%</em>
                </b>
              </div>
              <div>
                <small>Boundary error</small>
                <b>
                  {analysis?.metrics.mean.toFixed(2)}
                  <em>%</em>
                </b>
              </div>
            </div>
            <Components analysis={analysis} />
            <p className="note">
              GeoJSON and longitude/latitude CSV use a geographic projection.
              Other coordinates are planar. Separate outlines stay separate.
            </p>
          </aside>
        </div>
      ) : (
        <section
          className="surface custom-empty"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void load(f);
          }}
        >
          <div className="custom-empty-icons">
            <Upload size={30} />
            <PenLine size={30} />
          </div>
          <h2>A coastline, a profile, a shape.</h2>
          <p>Drop GeoJSON, SVG or CSV here, or draw with the pen.</p>
          <span>Up to 2 MB · 50,000 points · closed outlines</span>
          <div className="custom-examples">
            <span>Try an example</span>
            <button
              onClick={() => {
                try {
                  useInput(
                    parseSVG(
                      '<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(30 25) scale(1.2)"><path aria-label="Engineering profile" d="M0 0 H220 V60 H120 V160 H0 Z"/><path aria-label="Outer profile" d="m260 20 h40 v40 h-40 z m70 0 h30 v30 h-30z"/></g></svg>',
                      "Engineering profiles",
                    ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              SVG profile
            </button>
            <button
              onClick={() =>
                useInput(
                  parseGeoJSON(
                    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Main area"},"geometry":{"type":"Polygon","coordinates":[[[0,0],[4,0],[4,3],[0,3],[0,0]],[[1,1],[1,2],[2,2],[2,1],[1,1]]]}},{"type":"Feature","properties":{"name":"Outer island"},"geometry":{"type":"Polygon","coordinates":[[[6,0],[7,0],[7,1],[6,1],[6,0]]]}}]}',
                    "Islands and an interior hole",
                  ),
                )
              }
            >
              GeoJSON islands
            </button>
            <button
              onClick={() =>
                setPending(
                  parseCSV(
                    "x,y\n0,0\n240,0\n240,60\n140,60\n140,160\n0,160",
                    "CSV profile",
                  ),
                )
              }
            >
              CSV outline
            </button>
          </div>
          <details>
            <summary>File formats</summary>
            <p>
              GeoJSON: Polygon, MultiPolygon and line boundaries. SVG: paths,
              polygons and basic shapes. CSV: x,y columns; blank lines separate
              paths. Open paths need your confirmation before closing.
            </p>
          </details>
        </section>
      )}
      {drawing && (
        <DrawingPad onUse={useInput} onClose={() => setDrawing(false)} />
      )}
    </div>
  );
}
export default memo(CustomShapes);
