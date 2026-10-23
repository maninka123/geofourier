import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Gauge, X } from "lucide-react";
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
            <div className="control-label">
              <label>Playback speed</label>
              <b className="speed-value">{speed}×</b>
            </div>
            <div className="speed-options">
              {[0.25, 0.5, 1, 2, 4].map((v) => (
                <button
                  key={v}
                  className={speed === v ? "active" : ""}
                  onClick={() => onSpeed(v)}
                >
                  {v}×
                </button>
              ))}
            </div>
            <input
              className="range speed-range"
              type="range"
              aria-label="Custom animation speed"
              min={0.1}
              max={4}
              step={0.05}
              value={speed}
              onChange={(e) => onSpeed(Number(e.target.value))}
            />
            <div className="inline-selects">
              <label>
                Cycle duration
                <select
                  aria-label="Cycle duration"
                  value={duration}
                  onChange={(e) => onDuration(Number(e.target.value))}
                >
                  {[5, 10, 20, 30, 60, 120].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
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
