/** A true logarithmic term axis: equal space for equal multiplicative changes in N. */
export function termAxisPosition(terms: number, maximum: number) {
  const limit = Math.max(1, maximum);
  if (limit === 1) return 0;
  return Math.log(Math.max(1, Math.min(limit, terms))) / Math.log(limit);
}

/** Keep readable 1–2–5 ticks, always retaining both endpoints on small charts. */
export function termAxisTicks(maximum: number, width: number) {
  const limit = Math.max(1, Math.floor(maximum));
  if (limit === 1) return [1];
  const candidates = new Set([1, limit]);
  for (let power = 1; power <= limit; power *= 10) {
    for (const factor of [1, 2, 5])
      if (power * factor <= limit) candidates.add(power * factor);
  }
  const labels: number[] = [];
  const fits = (a: number, b: number) =>
    (termAxisPosition(b, limit) - termAxisPosition(a, limit)) * width >=
    (String(a).length + String(b).length) * 3.5 + 12;
  for (const tick of [...candidates].sort((a, b) => a - b)) {
    if (tick === limit) {
      while (labels.length > 1 && !fits(labels.at(-1)!, tick)) labels.pop();
      labels.push(tick);
    } else if (!labels.length || fits(labels.at(-1)!, tick)) labels.push(tick);
  }
  return labels;
}
