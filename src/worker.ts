import { prepare, analyze, search, type Model, type Geometry } from "./engine";
import { validate } from "./validation";
const models = new Map<string, Model>(),
  results = new Map<string, ReturnType<typeof analyze>>(),
  active = new Set<number>(),
  cancelled = new Set<number>();
self.onmessage = async ({ data }) => {
  const { id, action, key } = data;
  if (action === "cancel") {
    if (active.has(data.job)) cancelled.add(data.job);
    return;
  }
  active.add(id);
  try {
    let model = models.get(key);
    if (!model) {
      let geometry: Geometry | undefined = data.geometry;
      if (!geometry) {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/${data.resolution}-${data.country}.json`,
        );
        if (!response.ok)
          throw Error(
            "This country is unavailable at this dataset resolution. Choose 1:50m.",
          );
        geometry = (await response.json()) as Geometry;
      }
      model = prepare(geometry, data.samples, data.mode);
      models.set(key, model);
      if (models.size > 32) models.delete(models.keys().next().value!);
    }
    if (action === "validate") {
      const result = await validate(
        model,
        data.terms,
        Math.min(data.cap, data.samples),
        () => cancelled.has(id),
      );
      cancelled.delete(id);
      self.postMessage({ id, result });
    } else if (action === "search") {
      let lastPreview = -Infinity;
      const result = await search(
        model!,
        data.target,
        data.limit,
        data.step,
        data.maxMs,
        (point, best, evaluations, elapsed, analysis) => {
          const includePreview =
            data.includePreview &&
            (elapsed - lastPreview >= 75 || point.terms === data.limit);
          if (includePreview) lastPreview = elapsed;
          self.postMessage({
            id,
            progress: {
              point,
              best,
              evaluations,
              elapsed,
              ...(includePreview
                ? {
                    preview: {
                      paths: analysis.paths,
                      metrics: analysis.metrics,
                      terms: analysis.terms,
                    },
                  }
                : {}),
            },
          });
        },
        () => cancelled.has(id),
        data.denseEarly,
      );
      cancelled.delete(id);
      self.postMessage({ id, result });
    } else {
      const cacheKey = `${key}:${data.terms}`;
      let result = results.get(cacheKey);
      if (!result) {
        result = analyze(model!, data.terms);
        results.set(cacheKey, result);
        if (results.size > 80) results.delete(results.keys().next().value!);
      }
      self.postMessage({ id, result });
    }
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    active.delete(id);
    cancelled.delete(id);
  }
};
