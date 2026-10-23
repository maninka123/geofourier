import palettes from "./flagPalettes.json";
type RGB = [number, number, number];
const rgb = (hex: string): RGB =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const hex = (c: RGB) =>
  "#" +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
function luminance(c: RGB) {
  const v = c.map((n) => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function stroke(c: RGB, dark: boolean): RGB {
  let out = [...c] as RGB;
  for (let i = 0; i < 15 && luminance(out) > 0.28; i++)
    out = out.map((n) => n * 0.94) as RGB;
  if (dark)
    for (let i = 0; i < 20 && luminance(out) < 0.14; i++)
      out = out.map((n) => n + (255 - n) * 0.06) as RGB;
  return out;
}
const distance = (a: RGB, b: RGB) =>
  Math.sqrt(
    2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2,
  );
export function compareColors(ids: string[], dark = false): string[] {
  const used: RGB[] = [];
  return ids.map((id) => {
    const palette = ((palettes as Record<string, string[]>)[id] || []).map(rgb);
    const vivid = palette.filter((c) => Math.max(...c) - Math.min(...c) > 25);
    const base = vivid.length
      ? vivid
      : palette.filter((c) => luminance(c) < 0.6);
    if (!base.length) base.push([67, 88, 206]);
    const primary = base.map((c) => stroke(c, dark));
    const variants = base.flatMap((c) =>
      [0.7, 0.45, 0.2]
        .map((f) => stroke(c.map((n) => n * f) as RGB, dark))
        .concat(
          [0.2, 0.4, 0.6].map((f) =>
            stroke(c.map((n) => n + (255 - n) * f) as RGB, dark),
          ),
        ),
    );
    const candidates = [...primary, ...variants];
    const separation = (c: RGB) =>
      used.length ? Math.min(...used.map((u) => distance(c, u))) : Infinity;
    const available = candidates.filter(
      (c) => !used.some((u) => hex(u) === hex(c)),
    );
    const chosen =
      available.find((c) => separation(c) >= 115) ||
      available.sort((a, b) => separation(b) - separation(a))[0] ||
      stroke([95 + used.length * 25, 60, 170], dark);
    used.push(chosen);
    return hex(chosen);
  });
}
