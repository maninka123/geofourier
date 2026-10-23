import { prepare, analyze, search, type Model, type Geometry } from "./engine";
const models = new Map<string, Model>(),
  results = new Map<string, ReturnType<typeof analyze>>(),
  cancelled = new Set<number>();
self.onmessage = async ({ data }) => {
  const { id, action, key } = data;
  if (action === "cancel") {
    cancelled.add(data.job);
    return;
  }
  try {
    let model = models.get(key);
    if (!model) {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/${data.resolution}-${data.country}.json`,
      );
      if (!response.ok)
        throw Error(
          "This country is unavailable at this dataset resolution. Choose 1:50m.",
        );
      model = prepare(
        (await response.json()) as Geometry,
        data.samples,
        data.mode,
      );
      models.set(key, model);
      if (models.size > 32) models.delete(models.keys().next().value!);
    }
    if (action === "search") {
      const result = await search(
        model!,
        data.target,
        data.limit,
        data.step,
        data.maxMs,
        (point, best, evaluations, elapsed) =>
          self.postMessage({
            id,
            progress: { point, best, evaluations, elapsed },
          }),
        () => cancelled.has(id),
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
  }
};
