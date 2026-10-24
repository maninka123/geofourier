import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { constructionAt, constructionSequence } from "./construction";
import { rankTermsFor99 } from "./rankingData";
import { compareColors } from "./compareColors";
import { termAxisPosition, termAxisTicks } from "./chartScale";
import { PLAYBACK_SPEEDS, nearestPlaybackSpeed } from "./playbackSpeed";
import { parseCSV, parseGeoJSON, ringsToBoundary } from "./customBoundary";
import {
  retainedEnergy,
  nearestOnBoundary,
  componentResults,
  validate,
} from "./validation";
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

test("playback speed snaps to slow options and two-times steps through eight", () => {
  assert.deepEqual(PLAYBACK_SPEEDS.slice(2), [2, 4, 6, 8]);
  for (const speed of PLAYBACK_SPEEDS)
    assert.equal(nearestPlaybackSpeed(speed), speed);
  assert.equal(nearestPlaybackSpeed(3.9), 4);
  assert.equal(nearestPlaybackSpeed(6.1), 6);
  assert.equal(nearestPlaybackSpeed(100), 8);
  assert.equal(nearestPlaybackSpeed(-10), 0.5);
  assert.equal(nearestPlaybackSpeed(NaN), 2);
});

test("custom CSV preserves disconnected outlines, reports open paths and validates coordinates", () => {
  const input = parseCSV(
    "x,y\n0,0\n1000,0\n1000,500\n0,500\n0,0\n\n2000,0\n2100,0\n2100,100",
  );
  assert.equal(input.openPaths, 1);
  assert.equal(input.geometry.type, "MultiPolygon");
  const model = prepare(input.geometry, 256, "full");
  assert.equal(model.components, 2);
  assert.ok(
    model.contours.every((c) =>
      c.points.every((p) => p.every(Number.isFinite)),
    ),
  );
  assert.throws(() => parseCSV("x,y\n0,0\nNaN,2\n3,4"), /numeric/);
  assert.throws(() => parseCSV("0,0\n1,1\n2,2"), /zero area/);
});
test("custom GeoJSON retains feature names and holes without accepting out-of-range geography", () => {
  const feature = {
    type: "Feature",
    properties: { name: "Outer profile" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [3, 0],
          [3, 3],
          [0, 3],
          [0, 0],
        ],
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [2, 1],
          [1, 1],
        ],
      ],
    },
  };
  const input = parseGeoJSON(JSON.stringify(feature));
  const model = prepare(input.geometry, 256, "full");
  assert.equal(input.openPaths, 0);
  assert.equal(model.components, 1);
  assert.equal(model.contours.filter((c) => c.hole).length, 1);
  assert.equal(model.contours[0].name, "Outer profile");
  assert.throws(() => parseGeoJSON("{"), /valid JSON/);
  assert.throws(
    () =>
      parseGeoJSON(
        JSON.stringify({
          type: "Polygon",
          coordinates: [
            [
              [181, 0],
              [182, 1],
              [183, 0],
              [181, 0],
            ],
          ],
        }),
      ),
    /longitude/,
  );
});
test("drawn nested contours become holes and disconnected strokes remain independent", () => {
  const input = ringsToBoundary(
    [
      {
        closed: true,
        points: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
      },
      {
        closed: true,
        points: [
          [2, 2],
          [4, 2],
          [4, 4],
          [2, 4],
        ],
      },
      {
        closed: true,
        points: [
          [20, 0],
          [22, 0],
          [22, 2],
          [20, 2],
        ],
      },
    ],
    "Drawn",
  );
  const m = prepare(input.geometry, 256, "full");
  assert.equal(m.components, 2);
  assert.equal(m.contours.filter((c) => c.hole).length, 1);
});
test("boundary distances use edges, including the closing segment", () => {
  const hit = nearestOnBoundary(
    [0.5, 0.5],
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
  );
  assert.equal(hit.distance, 0.5);
  assert.ok(hit.point[0] === 0.5 || hit.point[1] === 0.5);
  assert.equal(
    nearestOnBoundary(
      [0, 1],
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
    ).distance,
    0,
  );
});
test("SVG and drawn screen coordinates keep their orientation while x/y CSV uses an upward y axis", () => {
  const shape = ringsToBoundary(
    [
      {
        closed: true,
        points: [
          [0, 0],
          [10, 0],
          [10, 3],
          [3, 3],
          [3, 10],
          [0, 10],
        ],
      },
    ],
    "Profile",
  );
  assert.equal(shape.geometry.coordinateSystem, "screen");
  assert.equal(
    parseGeoJSON(JSON.stringify(shape.geometry)).geometry.coordinateSystem,
    "screen",
  );
  assert.ok(prepare(shape.geometry, 256, "full").contours[0].source![0][1] < 0);
  assert.ok(
    prepare(parseCSV("0,0\n10,0\n10,3\n3,3\n3,10\n0,10").geometry, 256, "full")
      .contours[0].source![0][1] > 0,
  );
  const geographic = parseCSV("longitude,latitude\n0,0\n2,0\n2,1\n0,0");
  assert.equal(geographic.geometry.coordinateSystem, undefined);
});
test("custom input rejects excessive coordinates and unsafe magnitudes", () => {
  assert.throws(() => parseCSV("0,0\n1e300,0\n0,1"), /magnitude/);
  assert.throws(
    () =>
      ringsToBoundary(
        [
          {
            closed: true,
            points: Array.from(
              { length: 50001 },
              (_, i) =>
                [
                  Math.cos((i / 50001) * Math.PI * 2),
                  Math.sin((i / 50001) * Math.PI * 2),
                ] as Point,
            ),
          },
        ],
        "Large",
      ),
    /50,000/,
  );
});
test("retained energy excludes translation and converges to 100 percent", () => {
  const m = prepare(geometry("ZAF"), 256, "full");
  assert.equal(retainedEnergy(m, 256), 100);
  assert.ok(retainedEnergy(m, 10) < retainedEnergy(m, 50));
  assert.ok(m.contours.every((c) => c.source && c.source.length >= 3));
  const a = analyze(m, 40),
    rows = componentResults(a);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].area >= rows[1].area);
  assert.ok(rows.every((r) => Number.isFinite(r.metrics.mean)));
});
test("validation distinguishes the sampled and original dataset contours and measures sampling sensitivity", async () => {
  const m = prepare(geometry("LKA"), 32, "main"),
    r = await validate(m, 32, 32);
  assert.ok(r.sampled.similarity > 99.999);
  assert.ok(r.source.mean > r.sampled.mean);
  assert.equal(r.energy, 100);
  assert.deepEqual(
    r.sensitivity.map((s) => s.samples),
    [256, 512, 1024, 2048],
  );
  assert.ok(r.curve.some((p) => p.n === 32));
  assert.ok(r.errors[0].max.distance > 0);
  await assert.rejects(() => validate(m, 20, 32, () => true), /cancelled/);
});

test("logarithmic term axis expands early detail without changing N values", () => {
  assert.equal(termAxisPosition(1, 1000), 0);
  assert.equal(termAxisPosition(1000, 1000), 1);
  assert.ok(Math.abs(termAxisPosition(10, 1000) - 1 / 3) < 1e-12);
  assert.ok(Math.abs(termAxisPosition(100, 1000) - 2 / 3) < 1e-12);
  assert.ok(
    termAxisPosition(10, 500) - termAxisPosition(1, 500) >
      termAxisPosition(500, 500) - termAxisPosition(400, 500),
  );
  assert.equal(termAxisPosition(0, 500), 0);
  assert.equal(termAxisPosition(1001, 500), 1);
  assert.equal(termAxisPosition(1, 1), 0);
});

test("logarithmic term ticks retain endpoints and avoid label collisions", () => {
  for (const limit of [1, 100, 250, 500, 1000])
    for (const width of [186, 300, 700, 1400]) {
      const ticks = termAxisTicks(limit, width);
      assert.equal(ticks[0], 1);
      assert.equal(ticks.at(-1), limit);
      assert.equal(new Set(ticks).size, ticks.length);
      assert.ok(
        ticks.every((n) => Number.isInteger(n) && n >= 1 && n <= limit),
      );
      for (let i = 1; i < ticks.length; i++)
        assert.ok(
          (termAxisPosition(ticks[i], limit) -
            termAxisPosition(ticks[i - 1], limit)) *
            width >=
            (String(ticks[i]).length + String(ticks[i - 1]).length) * 3.5 + 12,
        );
    }
});

test("comparison colours stay distinct when flags share their dominant colour", () => {
  for (const ids of [
    ["CAN", "JPN", "POL", "IDN"],
    ["AUS", "NZL", "GBR", "FRA"],
    ["LKA", "AUS", "NOR", "BRA"],
    ["LKA", "LKA", "LKA", "LKA"],
  ]) {
    for (const dark of [false, true]) {
      const colors = compareColors(ids, dark);
      assert.equal(new Set(colors).size, ids.length);
      assert.ok(colors.every((c) => /^#[0-9a-f]{6}$/.test(c)));
      assert.deepEqual(colors, compareColors(ids, dark));
    }
  }
});

test("99-percent term ranking sorts measured counts and distinguishes budget limits", () => {
  const p = (terms: number, similarity: number) => ({
    terms,
    similarity,
    iou: similarity,
    mean: 0,
  });
  const rows = [
    {
      id: "AAA",
      curve: [p(1, 70), p(21, 99.1), p(31, 98.9)],
      cap: 100,
      complete: true,
    },
    { id: "BBB", curve: [p(1, 80), p(11, 99.2)], cap: 100, complete: true },
    { id: "CCC", curve: [p(1, 60), p(100, 98.5)], cap: 100, complete: true },
    { id: "DDD", curve: [p(1, 50), p(21, 90)], cap: 100, complete: false },
  ];
  assert.deepEqual(
    rankTermsFor99(rows).map((r) => [r.row.id, r.terms]),
    [
      ["BBB", 11],
      ["AAA", 21],
      ["CCC", undefined],
    ],
  );
  assert.deepEqual(
    rankTermsFor99(rows, true).map((r) => r.row.id),
    ["CCC", "AAA", "BBB"],
  );
  assert.equal(
    rankTermsFor99(
      Array.from({ length: 30 }, (_, i) => ({ ...rows[0], id: String(i) })),
    ).length,
    30,
  );
});

test("search previews contain the exact geometry and metrics of each tested N", async () => {
  const model = prepare(geometry("LKA"), 256, "main");
  const seen: number[] = [];
  const result = await search(
    model,
    101,
    31,
    10,
    10000,
    (point, _best, evaluations, _elapsed, preview) => {
      seen.push(preview.terms);
      assert.equal(preview.model, model);
      assert.equal(preview.terms, point.terms);
      assert.equal(preview.metrics.similarity, point.similarity);
      assert.equal(evaluations, seen.length);
      assert.deepEqual(
        preview.paths,
        model.contours.map((c) => reconstruct(c, point.terms)),
      );
    },
  );
  assert.deepEqual(
    seen,
    result.curve.map((p) => p.terms),
  );
  assert.deepEqual(seen, [1, 11, 21, 31]);
});
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
test("accuracy curves measure every early N and retain the later grid and cap", async () => {
  const model = prepare(geometry("EGY"), 64);
  for (const limit of [12, 34]) {
    const result = await search(
      model,
      101,
      limit,
      10,
      5000,
      () => {},
      () => false,
      true,
    );
    const counts = result.curve.map((p) => p.terms);
    assert.deepEqual(
      counts.filter((n) => n <= 25),
      Array.from({ length: Math.min(25, limit) }, (_, i) => i + 1),
    );
    assert.equal(counts.at(-1), limit);
    assert.equal(new Set(counts).size, counts.length);
    if (limit > 25)
      assert.deepEqual(
        counts.filter((n) => n > 25),
        [31, 34],
      );
    for (const point of result.curve)
      assert.equal(
        point.similarity,
        analyze(model, point.terms).metrics.similarity,
      );
  }
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
