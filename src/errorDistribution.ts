export function errorDistribution(values: number[], count = 12) {
  const points = values
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const max = Math.max(0.12, Math.ceil((points.at(-1) || 0) * 100) / 100);
  const bins = Array.from({ length: count }, (_, i) => ({
    from: (i * max) / count,
    to: ((i + 1) * max) / count,
    count: 0,
    percent: 0,
  }));
  for (const value of points)
    bins[Math.min(count - 1, Math.floor((value / max) * count))].count++;
  for (const bin of bins)
    bin.percent = points.length ? (100 * bin.count) / points.length : 0;
  return {
    bins,
    max,
    total: points.length,
    p90: points[Math.max(0, Math.ceil(points.length * 0.9) - 1)] || 0,
  };
}
