import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Gauge, X } from "lucide-react";
import { PLAYBACK_SPEEDS, nearestPlaybackSpeed } from "./playbackSpeed";
export default function Playback({
  speed,
  onSpeed,
  duration,
  onDuration,
  loops,
  onLoops,
}: {
  speed: number;
  onSpeed: (n: number) => void;
  duration: number;
  onDuration: (n: number) => void;
  loops: number;
  onLoops: (n: number) => void;
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const speedIndex = PLAYBACK_SPEEDS.indexOf(nearestPlaybackSpeed(speed));
  useEffect(() => {
    if (!open) return;
    const pointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="playback-settings" ref={root}>
      <button
        ref={trigger}
        className={`playback-settings-trigger ${open ? "active" : ""}`}
        aria-label="Playback settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Gauge size={15} />
        <b>{speed}×</b>
        <ChevronDown size={12} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="playback-popover"
            role="dialog"
            aria-label="Playback settings"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="playback-popover-heading">
              <h3>Make time your own.</h3>
              <button
                className="icon-button"
                aria-label="Close playback settings"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="speed-dial">
              <div className="speed-dial-heading">
                <label htmlFor="playback-speed-control">Playback speed</label>
                <output>
                  <Gauge size={16} />
                  {speed}×
                </output>
              </div>
              <input
                id="playback-speed-control"
                className="range speed-step-range"
                type="range"
                aria-label="Playback speed"
                aria-valuetext={`${speed} times playback speed`}
                min={0}
                max={PLAYBACK_SPEEDS.length - 1}
                step={1}
                value={speedIndex}
                onChange={(e) =>
                  onSpeed(PLAYBACK_SPEEDS[Number(e.target.value)])
                }
                style={
                  {
                    "--fill": `${(speedIndex / (PLAYBACK_SPEEDS.length - 1)) * 100}%`,
                  } as React.CSSProperties
                }
              />
              <div className="speed-dial-marks">
                {PLAYBACK_SPEEDS.map((value, i) => (
                  <button
                    key={value}
                    aria-label={`Set playback speed to ${value} times`}
                    aria-pressed={i === speedIndex}
                    onClick={() => onSpeed(value)}
                  >
                    <i />
                    {value}×
                  </button>
                ))}
              </div>
              <label className="speed-cycle-reference">
                At 1×
                <select
                  aria-label="Cycle time at normal speed"
                  value={duration}
                  onChange={(e) => onDuration(Number(e.target.value))}
                >
                  {[5, 10, 20, 30, 60, 120].map((seconds) => (
                    <option value={seconds} key={seconds}>
                      {seconds}s / outline
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inline-selects">
              <label>
                Cycle time
                <select
                  aria-label="Cycle duration"
                  value={speedIndex}
                  onChange={(e) =>
                    onSpeed(PLAYBACK_SPEEDS[Number(e.target.value)])
                  }
                >
                  {PLAYBACK_SPEEDS.map((value, index) => (
                    <option key={value} value={index}>
                      {Number((duration / value).toFixed(2))} seconds
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Final N repeats
                <select
                  aria-label="Loop count"
                  value={Number.isFinite(loops) ? loops : 0}
                  onChange={(e) => onLoops(Number(e.target.value) || Infinity)}
                >
                  {[1, 3, 5, 10, 0].map((n) => (
                    <option key={n} value={n}>
                      {n ? `${n} loop${n > 1 ? "s" : ""}` : "Forever"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
