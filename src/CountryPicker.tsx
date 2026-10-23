import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Star, Shuffle, Check, X } from "lucide-react";
import type { Country } from "./engine";
export function Flag({ country }: { country?: Country }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [country?.code]);
  return country && !failed && /^[A-Z]{2}$/.test(country.code) ? (
    <img
      className="flag"
      src={`https://flagcdn.com/w80/${country.code.toLowerCase()}.png`}
      alt={`${country.name} flag`}
      onError={() => setFailed(true)}
    />
  ) : null;
}
export default function CountryPicker({
  countries,
  selected,
  onChange,
  compact = false,
}: {
  countries: Country[];
  selected: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0),
    [favorites, setFavorites] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("forma-favorites") || "[]");
      } catch {
        return [];
      }
    }),
    [recent, setRecent] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("forma-recent") || "[]");
      } catch {
        return [];
      }
    });
  const root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const country = countries.find((c) => c.id === selected),
    filtered = countries.filter((c) =>
      `${c.name} ${c.id} ${c.code} ${c.continent}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const ordered = query
    ? filtered
    : [...filtered].sort((a, b) => {
        const score = (c: Country) =>
          favorites.includes(c.id) ? -2 : recent.includes(c.id) ? -1 : 0;
        return score(a) - score(b) || a.name.localeCompare(b.name);
      });
  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    const next = [id, ...recent.filter((r) => r !== id)].slice(0, 6);
    setRecent(next);
    localStorage.setItem("forma-recent", JSON.stringify(next));
  };
  useEffect(() => {
    if (open) {
      input.current?.focus();
      setActive(0);
    }
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    root.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div className={`country-picker ${compact ? "compact" : ""}`} ref={root}>
      <button
        className="country-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
      >
        <Flag country={country} />
        <span>
          <b>{country?.name || "Select country"}</b>
          {!compact && (
            <small>
              {country?.continent} <span>·</span> {country?.id}
            </small>
          )}
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="country-menu">
          <div className="search-input">
            <Search size={17} />
            <input
              ref={input}
              placeholder="Search countries…"
              aria-label="Search countries"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive(Math.min(ordered.length - 1, active + 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(0, active - 1));
                }
                if (e.key === "Enter" && ordered[active])
                  choose(ordered[active].id);
                if (e.key === "Escape") setOpen(false);
              }}
            />
            <button
              className="icon-button"
              aria-label="Close country selector"
              onClick={() => setOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
          <button
            className="random-option"
            onClick={() =>
              choose(countries[Math.floor(Math.random() * countries.length)].id)
            }
          >
            <Shuffle size={15} /> Take me somewhere new
          </button>
          <div className="country-list" role="listbox" aria-label="Countries">
            {ordered.map((c, i) => (
              <div
                className={`country-option ${active === i ? "focused" : ""}`}
                key={c.id}
                data-index={i}
              >
                <button
                  role="option"
                  aria-selected={selected === c.id}
                  onClick={() => choose(c.id)}
                >
                  <Flag country={c} />
                  <span>
                    {c.name}
                    <small>
                      {c.id} · {c.continent}
                      {!query && recent.includes(c.id) ? " · Recent" : ""}
                    </small>
                  </span>
                  {selected === c.id && <Check size={15} />}
                </button>
                <button
                  className="favorite"
                  aria-label={`${favorites.includes(c.id) ? "Remove" : "Add"} ${c.name} ${favorites.includes(c.id) ? "from" : "to"} favorites`}
                  onClick={() => {
                    const next = favorites.includes(c.id)
                      ? favorites.filter((id) => id !== c.id)
                      : [...favorites, c.id];
                    setFavorites(next);
                    localStorage.setItem(
                      "forma-favorites",
                      JSON.stringify(next),
                    );
                  }}
                >
                  <Star
                    size={14}
                    fill={favorites.includes(c.id) ? "currentColor" : "none"}
                  />
                </button>
              </div>
            ))}
            {!ordered.length && <p className="empty">No matching countries.</p>}
          </div>
          <div className="menu-footer">
            {countries.length} countries & territories · Natural Earth
          </div>
        </div>
      )}
    </div>
  );
}
