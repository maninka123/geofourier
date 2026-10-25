export function hasCalculationTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
export function formatCalculationTime(value: unknown) {
  return hasCalculationTime(value) ? `${(value / 1000).toFixed(2)}s` : "—";
}
export function compareCalculationTimes(
  a: unknown,
  b: unknown,
  descending = false,
) {
  if (!hasCalculationTime(a)) return hasCalculationTime(b) ? 1 : 0;
  if (!hasCalculationTime(b)) return -1;
  return descending ? b - a : a - b;
}
export function normalizeTimedResult<
  T extends {
    calculationMs?: number;
    timeDemand?: number;
    difficulty?: number;
    complete: boolean;
  },
>(row: T): T {
  if (
    hasCalculationTime(row.calculationMs) &&
    hasCalculationTime(row.timeDemand) &&
    (!row.complete || hasCalculationTime(row.difficulty))
  )
    return row;
  return {
    ...row,
    calculationMs: undefined,
    timeDemand: undefined,
    difficulty: undefined,
    complete: false,
  };
}
