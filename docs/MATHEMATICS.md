# Mathematics & measurement

## Geographic geometry

Forma bundles Natural Earth Admin 0 country geometry at 1:50 million and 1:110 million. The files are public domain and retain the dataset's de facto boundary policy. This project does not endorse territorial claims.

Polygon and MultiPolygon features are supported. Three modes select the largest exterior ring, all exterior rings, or full geometry including interior holes. Rings are independent paths: no artificial segments connect islands. Excluded rings are reported in advanced settings.

Longitudes are unwrapped across the antimeridian. A local equirectangular projection scales longitude by the cosine of the principal boundary's mean latitude; projected coordinates are then uniformly centered and scaled. Projected aspect ratio is retained. Projection distortion grows for geographically extensive countries, so these are projected-shape comparisons, not geodesic area calculations.

## Fourier reconstruction

Each closed ring is resampled at uniform arc-length intervals into complex points `z = x + iy`. A radix-2 FFT yields normalized complex coefficients, signed frequency, amplitude, and phase. Components are ordered by descending amplitude, with deterministic frequency tie-breaking. Positive and negative frequencies retain their actual rotation directions.

`z_N(t) = Σ c_k exp(2πi k t)` for the selected N coefficients. The renderer sums precisely these vectors to draw the epicycle chain and its endpoint. Reconstructed contour samples use an inverse FFT. A complete basis reproduces the reference sample points within floating-point precision.

N is a **per-contour** budget. The longest ring uses the selected sample count; smaller rings use power-of-two sample counts proportional to perimeter, with a minimum of 32. N is capped by each ring's own sample count. Multiple-contour comparisons must use the same geometry mode and sampling settings.

## Similarity

The reference is the selected, sampled geometry. The entire reconstructed outline is measured, independently of how much has been drawn.

1. **Overlap:** silhouettes are scan-converted onto a common 192 × 192 grid. A shared symmetric raster extent contains both the normalized reference and reconstruction, expanding when necessary to avoid clipping overshoots. Interior rings use even–odd filling within their polygon; independent polygons are unioned. `IoU = 100 × intersection / union`.
2. **Boundary distance:** approximately 768 arc-length samples are distributed by contour perimeter, with a minimum of eight per ring. A k-d tree measures nearest-point distances in both directions. Their mean is `d`; the reference bounding-box diagonal is `D`. `Boundary score = 100 × exp(−20d / D)`.
3. **Composite:** `Similarity = 0.70 × IoU + 0.30 × Boundary score`.

Mean, RMS, and sampled maximum boundary errors are reported as percentages of D. The sampled maximum is not a continuous Hausdorff-distance guarantee. Small islands may lie below the raster resolution; boundary distance complements overlap. Finite contour sampling and rasterization limit measurement resolution. The same formula and configuration are used across countries.

## Target searches and difficulty

Search evaluates increasing term counts on the configured grid, includes the term cap, tracks the actual best score, and stops at the target, term budget, time budget, or cancellation. It does not assume monotonic similarity or use binary search. The first qualifying value is the smallest on the **tested grid**, not necessarily the smallest integer unless the search step is one.

“Not reached” describes the tested budget, not theoretical impossibility. A complete finite Fourier basis can reconstruct its own sampled contour.

Difficulty Lab scans the configured grid up to its budget. Its score is:

`80 × min(N95 / term cap, 1) + 20 × normalized spectral energy entropy`

The spectral entropy uses the first selected contour's nonconstant coefficient energies, normalized by the logarithm of the number of components. When 95% is not reached, the first score component is 80 and the result is censored by the budget. Disconnected-component count is reported separately; area is not a difficulty input. Unmeasured countries remain unranked. Results are cached locally by dataset, geometry mode, sample count, term cap, and search step.

## Animation

Full construction uses eight distinct increasing N levels by default. Users can select 2–20 levels, limited by the available integer N values. Levels are spaced approximately logarithmically. Every level completes one entire contour cycle before advancing. Once the final N is reached, subsequent cycles retain it. Cycle duration and playback speed remain independent; repeat limits apply to the final level.

Fixed-N tracing uses the selected N on every loop. Final-shape mode presents the completed reconstruction immediately. Reduced-motion preferences default to final-shape mode.

## Performance & exports

Projection, FFTs, scoring, and optimization run in a Web Worker. Geometry and measured reconstructions use bounded in-memory caches. Stale UI responses are ignored; searches support cancellation. All geographic data and fonts are served locally. Flags have a neutral fallback.

PNG and WebM use the Canvas renderer, with stroke widths scaled independently of export resolution. SVG exports completed vector paths. Settings and coefficients are JSON; accuracy results are CSV. WebM is offered only where the browser supports recording. No MP4 or GIF encoding is claimed.
