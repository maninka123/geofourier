import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Flag } from "./CountryPicker";
import { rankTermsFor99, type TermResult } from "./rankingData";
import type { Country } from "./engine";
export default function TermRanking({
  rows,
  countries,
  step,
  onSelect,
}: {
  rows: TermResult[];
  countries: Country[];
  step: number;
  onSelect: (id: string) => void;
}) {
  const [order, setOrder] = useState("fewer");
  const ranked = useMemo(
    () => rankTermsFor99(rows, order === "more"),
    [rows, order],
  );
  const max = Math.max(1, ...ranked.map((r) => r.terms ?? r.row.cap));
  return (
    <section
      className="surface term-ranking"
      aria-label="Countries ordered by terms to reach 99 percent"
    >
      <div className="card-heading">
        <div>
          <span className="section-eyebrow">TERMS FOR 99%</span>
          <h2>Detail, by the numbers.</h2>
        </div>
        <label className="term-order">
          <ArrowDownUp size={15} />
          <select
            aria-label="Country term order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="fewer">Fewer terms first</option>
            <option value="more">More terms first</option>
          </select>
        </label>
      </div>
      <p className="term-ranking-intro">
        First tested N to reach 99% similarity · showing {ranked.length}{" "}
        countries
      </p>
      {ranked.length ? (
        <ol
          className="term-ranking-list"
          style={
            {
              "--ranking-rows": Math.ceil(ranked.length / 2),
            } as React.CSSProperties
          }
        >
          {ranked.map(({ row, terms }, i) => {
            const country = countries.find((c) => c.id === row.id);
            return (
              <li key={row.id}>
                <button
                  onClick={() => onSelect(row.id)}
                  title={`${country?.name || row.id}: ${terms ?? `over ${row.cap}`} terms on the tested grid`}
                >
                  <span className="term-ranking-country">
                    <small>{i + 1}</small>
                    <Flag country={country} />
                    <span>{country?.name || row.id}</span>
                    <strong>{terms ?? `>${row.cap}`}</strong>
                  </span>
                  <span
                    className={`term-ranking-track ${terms === undefined ? "censored" : ""}`}
                  >
                    <i
                      style={{ width: `${((terms ?? row.cap) / max) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="term-ranking-empty">
          Calculate countries to reveal their term counts and flags.
        </div>
      )}
      <p className="term-ranking-note">
        N per contour · search step {step}. “&gt;” means 99% was not reached
        within the tested budget.
      </p>
    </section>
  );
}
