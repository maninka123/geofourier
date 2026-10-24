import type { CurvePoint } from "./engine";
export type TermResult = {
  id: string;
  curve: CurvePoint[];
  complete: boolean;
  cap: number;
};
export function rankTermsFor99<T extends TermResult>(
  rows: T[],
  moreFirst = false,
) {
  return rows
    .map((row) => ({
      row,
      terms: row.curve.find((p) => p.similarity >= 99)?.terms,
    }))
    .filter((entry) => entry.terms !== undefined || entry.row.complete)
    .sort(
      (a, b) =>
        ((a.terms ?? a.row.cap + 1) - (b.terms ?? b.row.cap + 1)) *
          (moreFirst ? -1 : 1) || a.row.id.localeCompare(b.row.id),
    );
}
