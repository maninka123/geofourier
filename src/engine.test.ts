import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { constructionAt, constructionSequence } from "./construction";
import {
  coefficients,
  fft,
  prepare,
  reconstruct,
  measure,
  analyze,
  raster,
  search,
  type Geometry,
  type Point,
  type Contour,
} from "./engine";
const geometry = (id: string) =>
  JSON.parse(fs.readFileSync(`public/data/50m-${id}.json`, "utf8")) as Geometry;
test("radix-2 FFT round-trips a complex signal", () => {
  const re = Array.from({ length: 256 }, (_, i) => Math.sin(i * 0.4) + i / 100),
    im = re.map((_, i) => Math.cos(i * 0.17)),
    a = [...re],
    b = [...im];
  fft(a, b);
  fft(a, b, true);
  assert.ok(a.every((v, i) => Math.abs(v - re[i]) < 1e-11));
  assert.ok(b.every((v, i) => Math.abs(v - im[i]) < 1e-11));
});
test("signed frequencies identify clockwise and counterclockwise circles", () => {
  for (const f of [-7, 5]) {
    const points: Point[] = Array.from({ length: 128 }, (_, i) => [
      Math.cos((2 * Math.PI * f * i) / 128),
      Math.sin((2 * Math.PI * f * i) / 128),
    ]);
    const cs = coefficients(points);
    assert.equal(cs[0].frequency, f);
    assert.ok(Math.abs(cs[0].amplitude - 1) < 1e-12);
  }
});
for (const id of [
  "BGD",
  "EGY",
  "JPN",
  "IDN",
  "CHL",
  "NOR",
  "CAN",
  "FJI",
  "RUS",
  "ZAF",
])
  test(`${id}: complete Fourier basis reproduces every sampled point`, () => {
    const model = prepare(
      geometry(id),
      256,
      id === "ZAF" ? "full" : id === "FJI" ? "exterior" : "main",
    );
    for (const contour of model.contours) {
      const restored = reconstruct(contour, contour.points.length);
      for (let i = 0; i < restored.length; i++)
        assert.ok(
          Math.hypot(
            restored[i][0] - contour.points[i][0],
            restored[i][1] - contour.points[i][1],
          ) < 1e-10,
        );
    }
    const result = analyze(model, 256);
    assert.ok(result.metrics.similarity > 99.999999);
  });
test("changing the Fourier budget changes geometry and measured score", () => {
  const model = prepare(geometry("BGD"), 512);
  const low = analyze(model, 5),
    high = analyze(model, 150);
  assert.notDeepEqual(low.paths, high.paths);
  assert.ok(high.metrics.similarity > low.metrics.similarity + 5);
  assert.ok(high.metrics.similarity <= 100);
});
test("antimeridian unwrapping preserves Fiji as a compact country", () => {
  const model = prepare(geometry("FJI"), 256, "exterior");
  const [width, height] = [0, 1].map((axis) => {
    const v = model.contours.flatMap((c) => c.points.map((p) => p[axis]));
    return Math.max(...v) - Math.min(...v);
  });
  assert.ok(width / height < 5 && width / height > 0.2);
  assert.ok(model.contours.length > 1);
});
test("independent islands have distinct paths and no connecting segments", () => {
  const model = prepare(geometry("JPN"), 256, "exterior"),
    analysis = analyze(model, 50);
  assert.ok(analysis.paths.length > 3);
  assert.equal(analysis.paths.length, model.contours.length);
  for (let i = 0; i < analysis.paths.length; i++)
    assert.equal(analysis.paths[i].length, model.contours[i].points.length);
});
test("holes remove fill and disconnected polygons are unioned", () => {
  const outer: Point[] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    inner: Point[] = [
      [-0.4, -0.4],
      [0.4, -0.4],
      [0.4, 0.4],
      [-0.4, 0.4],
    ];
  const cs = [outer, inner].map((points, i) => ({
    points,
    hole: i > 0,
    group: 0,
    coefficients: [],
    perimeter: 1,
  })) as Contour[];
  const mask = raster([outer, inner], cs, 120);
  assert.equal(mask[60 * 120 + 60], 0);
  assert.equal(mask[60 * 120 + 20], 1);
  assert.equal(mask[0], 0);
});
test("measured similarity penalizes a shifted shape", () => {
  const model = prepare(geometry("EGY"), 256);
  const perfect = analyze(model, 256),
    shifted = perfect.paths.map((p) =>
      p.map(([x, y]) => [x + 0.15, y] as Point),
    );
  const result = measure(model, shifted);
  assert.ok(result.similarity < 95);
  assert.ok(result.mean > 0);
  assert.ok(result.max >= result.mean);
  assert.ok(result.rms >= result.mean);
});
test("unreachable target returns the actual best measured result within its budget", async () => {
  const model = prepare(geometry("BGD"), 256),
    result = await search(model, 100.1, 25, 3, 5000, () => {});
  assert.equal(result.reached, false);
  assert.equal(result.reason, "budget");
  assert.equal(result.curve.at(-1)?.terms, 25);
  assert.equal(
    result.best.similarity,
    Math.max(...result.curve.map((p) => p.similarity)),
  );
  assert.equal(
    result.best.similarity,
    analyze(model, result.best.terms).metrics.similarity,
  );
});
test("target search verifies first qualifying count on the entire tested grid", async () => {
  const model = prepare(geometry("EGY"), 128),
    result = await search(model, 90, 100, 2, 5000, () => {});
  assert.ok(result.reached);
  assert.ok(result.best.similarity >= 90);
  assert.ok(result.curve.slice(0, -1).every((p) => p.similarity < 90));
});
test("search observes cancellation and computation time limits", async () => {
  const model = prepare(geometry("BGD"), 128),
    cancelled = await search(
      model,
      101,
      100,
      1,
      1000,
      () => {},
      () => true,
    ),
    timed = await search(model, 101, 100, 1, 0, () => {});
  assert.equal(cancelled.reason, "cancelled");
  assert.equal(cancelled.evaluations, 0);
  assert.equal(timed.reason, "time");
  assert.equal(timed.evaluations, 0);
});
test("all bundled countries have valid finite prepared geometry", () => {
  const countries = JSON.parse(
    fs.readFileSync("public/data/countries-50m.json", "utf8"),
  );
  for (const c of countries) {
    const model = prepare(geometry(c.id), 64);
    assert.ok(model.contours.length > 0, c.id);
    assert.ok(
      model.contours[0].points.every((p) => p.every(Number.isFinite)),
      c.id,
    );
  }
});

test("construction defaults to eight strictly increasing levels ending at the selected N", () => {
  const sequence = constructionSequence(150, 8);
  assert.equal(sequence.length, 8);
  assert.equal(sequence[0], 1);
  assert.equal(sequence.at(-1), 150);
  assert.ok(
    sequence.every(
      (n, i) => Number.isInteger(n) && (!i || n > sequence[i - 1]),
    ),
  );
});
test("each construction level completes an entire contour cycle before advancing", () => {
  const sequence = constructionSequence(150, 8);
  for (let i = 0; i < sequence.length; i++) {
    assert.equal(
      constructionAt(150, 8, true, i * 10 + 0.001, 10).terms,
      sequence[i],
    );
    assert.equal(
      constructionAt(150, 8, true, (i + 1) * 10 - 0.001, 10).terms,
      sequence[i],
    );
  }
});
test("the final N keeps looping instead of restarting the construction", () => {
  for (const time of [70, 80, 100, 1000])
    assert.equal(constructionAt(150, 8, true, time, 10).terms, 150);
  assert.equal(constructionAt(150, 8, false, 0, 10).terms, 150);
});
test("construction handles N smaller than the requested number of levels", () => {
  assert.deepEqual(constructionSequence(1, 8), [1]);
  assert.deepEqual(constructionSequence(3, 8), [1, 2, 3]);
  assert.equal(constructionAt(150, 8, true, 10, 10, false).terms, 1);
});
