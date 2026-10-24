import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { matchIsland } from "./name-land-areas.mjs";

const square = (x, y, size) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];
test("island names require matching land in both directions", () => {
  const islands = [{ name: "Example Island", areas: [[square(0, 0, 2)]] }];
  assert.equal(matchIsland([square(0, 0, 2)], islands), "Example Island");
  assert.equal(matchIsland([square(0, 0, 0.5)], islands), undefined);
  assert.equal(matchIsland([square(0, 0, 5)], islands), undefined);
  assert.equal(matchIsland([square(8, 8, 2)], islands), undefined);
});
test("matching envelopes alone do not assign a name across holes", () => {
  const islands = [
    { name: "Ring Island", areas: [[square(0, 0, 2), square(0.1, 0.1, 1.8)]] },
  ];
  assert.equal(matchIsland([square(0, 0, 2)], islands), undefined);
});
test("known island names remain attached to the original polygon group", async () => {
  const data = JSON.parse(
    await fs.readFile("public/data/land-area-names.json", "utf8"),
  );
  for (const [key, expected] of [
    ["50m-JPN", ["Honshu", "Kyushu", "Shikoku", "Hokkaidō"]],
    ["50m-ITA", ["Sicily", "Sardinia"]],
    ["50m-GBR", ["Great Britain"]],
  ]) {
    const geometry = JSON.parse(
      await fs.readFile(`public/data/${key}.json`, "utf8"),
    );
    assert.equal(data.names[key].length, geometry.coordinates.length);
    for (const name of expected) assert.ok(data.names[key].includes(name));
  }
});
