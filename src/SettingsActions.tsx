import { useEffect, useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
export default function SettingsActions({
  onRestore,
  onClear,
}: {
  onRestore: () => void;
  onClear: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) cancel.current?.focus();
  }, [confirming]);
  const dismiss = () => {
    setConfirming(false);
    trigger.current?.focus();
  };
  return (
    <div className="settings-data-actions">
      <div className="settings-action-buttons">
        <button
          className="button secondary"
          disabled={busy}
          onClick={onRestore}
        >
          <RotateCcw size={15} /> Restore defaults
        </button>
        <button
          ref={trigger}
          className="button danger-outline"
          disabled={busy}
          aria-expanded={confirming}
          aria-controls="clear-results-confirmation"
          onClick={() => {
            setError("");
            setConfirming(!confirming);
          }}
        >
          <Trash2 size={15} /> Clear calculated results
        </button>
      </div>
      {confirming && (
        <div
          id="clear-results-confirmation"
          className="clear-results-confirmation"
          role="group"
          aria-labelledby="clear-results-title"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong id="clear-results-title">
              Clear all calculated results?
            </strong>
            <p>
              Stops country scans and removes saved results for every
              configuration. Recalculate any time. Presets and shapes are kept.
            </p>
            <div className="clear-results-buttons">
              <button
                ref={cancel}
                className="button secondary"
                disabled={busy}
                onClick={dismiss}
              >
                Cancel
              </button>
              <button
                className="button danger-solid"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await onClear();
                    dismiss();
                  } catch {
                    setError(
                      "Saved results could not be fully cleared. Please try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                {busy ? "Clearing…" : "Yes, clear results"}
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
