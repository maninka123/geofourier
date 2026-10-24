import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const source =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_regions_polys.geojson";
export function inside(point, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
export function polygons(geometry) {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}
function contains(point, areas) {
  return areas.some(
    (rings) =>
      inside(point, rings[0]) &&
      !rings.slice(1).some((hole) => inside(point, hole)),
  );
}
function bounds(areas) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const rings of areas)
    for (const [x, y] of rings[0]) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  return box;
}
export function matchIsland(area, islands) {
  const box = bounds([area]);
  // A wrapped polygon cannot safely be matched in this planar label join.
  if (box[2] - box[0] > 180) return undefined;
  let best;
  for (const island of islands) {
    const b = island.box || bounds(island.areas);
    if (b[2] < box[0] || b[0] > box[2] || b[3] < box[1] || b[1] > box[3])
      continue;
    let land = 0,
      shared = 0;
    const cells = 18;
    for (let x = 0; x < cells; x++)
      for (let y = 0; y < cells; y++) {
        const p = [
          box[0] + ((x + 0.5) / cells) * (box[2] - box[0]),
          box[1] + ((y + 0.5) / cells) * (box[3] - box[1]),
        ];
        if (contains(p, [area])) {
          land++;
          if (contains(p, island.areas)) shared++;
        }
      }
    const coverage = land ? shared / land : 0;
    const extentRatio =
      ((box[2] - box[0]) * (box[3] - box[1])) / ((b[2] - b[0]) * (b[3] - b[1]));
    if (land < 8 || coverage < 0.9 || extentRatio < 0.65 || extentRatio > 1.4)
      continue;
    let islandLand = 0,
      islandShared = 0;
    for (let x = 0; x < cells; x++)
      for (let y = 0; y < cells; y++) {
        const p = [
          b[0] + ((x + 0.5) / cells) * (b[2] - b[0]),
          b[1] + ((y + 0.5) / cells) * (b[3] - b[1]),
        ];
        if (contains(p, island.areas)) {
          islandLand++;
          if (contains(p, [area])) islandShared++;
        }
      }
    const reverse = islandLand ? islandShared / islandLand : 0;
    if (
      islandLand >= 8 &&
      reverse >= 0.9 &&
      (!best || coverage + reverse > best.score)
    ) {
      best = { name: island.name, score: coverage + reverse };
    }
  }
  return best?.name;
}
async function main() {
  const response = await fetch(source);
  if (!response.ok) throw Error(`Island labels: ${response.status}`);
  const body = await response.text();
  const data = JSON.parse(body);
  const islands = data.features
    .filter((f) => f.properties.FEATURECLA === "Island")
    .map((f) => {
      const areas = polygons(f.geometry);
      return {
        name: f.properties.NAME_EN || f.properties.NAME,
        areas,
        box: bounds(areas),
      };
    });
  const names = {};
  let count = 0;
  for (const file of (await fs.readdir("public/data")).sort()) {
    if (!/^(50m|110m)-[A-Z]+\.json$/.test(file)) continue;
    const geometry = JSON.parse(
      await fs.readFile(`public/data/${file}`, "utf8"),
    );
    const matches = polygons(geometry).map(
      (area) => matchIsland(area, islands) || "",
    );
    if (matches.some(Boolean)) {
      names[file.slice(0, -5)] = matches;
      count += matches.filter(Boolean).length;
    }
  }
  await fs.writeFile(
    "public/data/land-area-names.json",
    JSON.stringify({
      source,
      sha256: createHash("sha256").update(body).digest("hex"),
      names,
    }),
  );
  console.log(
    `${count} named land areas across ${Object.keys(names).length} country-resolution pairs.`,
  );
  for (const id of ["50m-JPN", "50m-AUS", "50m-GBR", "50m-ITA"])
    console.log(id, names[id]?.filter(Boolean));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
