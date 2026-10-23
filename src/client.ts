import { useEffect, useRef, useState } from "react";
import type { Analysis, CurvePoint, SearchResult } from "./engine";
export type Config = {
  country: string;
  resolution: string;
  samples: number;
  mode: string;
};
let worker: Worker | undefined;
let serial = 0;
const callbacks = new Map<
  number,
  {
    resolve: (v: any) => void;
    reject: (e: Error) => void;
    progress?: (v: Progress) => void;
  }
>();
export type Progress = {
  preview?: Pick<Analysis, "paths" | "metrics" | "terms">;
  point: CurvePoint;
  best: CurvePoint;
  evaluations: number;
  elapsed: number;
};
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      const cb = callbacks.get(data.id);
      if (!cb) return;
      if (data.progress) {
        cb.progress?.(data.progress);
        return;
      }
      if (data.error) cb.reject(new Error(data.error));
      else cb.resolve(data.result);
      callbacks.delete(data.id);
    };
    worker.onerror = () => {
      for (const cb of callbacks.values())
        cb.reject(
          new Error("The calculation worker stopped. Please try again."),
        );
      callbacks.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return worker;
}
export function request<T>(
  action: string,
  config: Config,
  params: Record<string, unknown>,
  progress?: (v: Progress) => void,
) {
  const id = ++serial,
    key = Object.values(config).join(":");
  const promise = new Promise<T>((resolve, reject) => {
    callbacks.set(id, { resolve, reject, progress });
    getWorker().postMessage({ id, action, key, ...config, ...params });
  });
  return {
    id,
    promise,
    cancel: () => getWorker().postMessage({ action: "cancel", job: id }),
  };
}
export function useAnalysis(config: Config, terms: number) {
  const [data, setData] = useState<{ key: string; analysis: Analysis }>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const version = useRef(0);
  const key = Object.values(config).join(":");
  useEffect(() => {
    const v = ++version.current;
    setBusy(true);
    setError("");
    const job = request<Analysis>("analyze", config, { terms });
    job.promise
      .then((a) => {
        if (v === version.current) {
          setData({ key, analysis: a });
          setBusy(false);
        }
      })
      .catch((e) => {
        if (v === version.current) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => {
      version.current++;
    };
  }, [key, terms]);
  return {
    analysis: data?.key === key ? data.analysis : undefined,
    error,
    busy,
  };
}
export function runSearch(
  config: Config,
  target: number,
  limit: number,
  step: number,
  maxMs: number,
  progress: (p: Progress) => void,
  includePreview = false,
  denseEarly = false,
) {
  return request<SearchResult>(
    "search",
    config,
    { target, limit, step, maxMs, includePreview, denseEarly },
    progress,
  );
}
