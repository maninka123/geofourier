import type { CurvePoint, Model } from "./engine";
import { hasCalculationTime } from "./calculationTime";
export function difficultyScore(
  model: Model,
  curve: CurvePoint[],
  cap: number,
  complete: boolean,
  calculationMs?: number,
  evaluations = curve.length,
) {
  const total = model.contours.reduce((sum, c) => sum + c.perimeter, 0);
  const entropy = model.contours.reduce((sum, c) => {
    const energies = c.coefficients
      .filter((k) => k.frequency !== 0)
      .map((k) => k.amplitude ** 2);
    const energy = energies.reduce((s, e) => s + e, 0);
    const h =
      energy && energies.length > 1
        ? -energies.reduce((s, e) => {
            const p = e / energy;
            return s + (p > 0 ? p * Math.log(p) : 0);
          }, 0) / Math.log(energies.length)
        : 0;
    return sum + (h * c.perimeter) / (total || 1);
  }, 0);
  const n95 = curve.find((p) => p.similarity >= 95)?.terms;
  const validTiming =
    hasCalculationTime(calculationMs) &&
    Number.isFinite(evaluations) &&
    evaluations > 0;
  const timeDemand = validTiming
    ? 10 * Math.min(1, calculationMs / evaluations / 10)
    : undefined;
  return {
    entropy,
    timeDemand,
    difficulty:
      !complete || timeDemand === undefined
        ? undefined
        : 70 * Math.min(1, (n95 ?? cap) / cap) + 20 * entropy + timeDemand,
  };
}
