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

The reference is the original projected boundary from the selected map dataset (or imported shape), before uniform arc-length resampling for the FFT. Studio, Compare, components, searches and sensitivity checks all use this one scoring basis. The entire reconstructed outline is measured, independently of how much has been drawn. Old sampled-reference curve caches are versioned out.

1. **Overlap:** silhouettes are scan-converted onto a common 192 × 192 grid. A shared symmetric raster extent contains both the normalized reference and reconstruction, expanding when necessary to avoid clipping overshoots. Interior rings use even–odd filling within their polygon; independent polygons are unioned. `IoU = 100 × intersection / union`.
2. **Boundary distance:** approximately 768 arc-length samples are distributed by contour perimeter, with a minimum of eight per ring. A k-d tree measures nearest-point distances in both directions. Their mean is `d`; the reference bounding-box diagonal is `D`. `Boundary score = 100 × exp(−20d / D)`.
3. **Composite:** `Similarity = 0.70 × IoU + 0.30 × Boundary score`.

Mean, RMS, and sampled maximum boundary errors are reported as percentages of D. The sampled maximum is not a continuous Hausdorff-distance guarantee. Small islands may lie below the raster resolution; boundary distance complements overlap. Finite contour sampling and rasterization limit measurement resolution. The same formula and configuration are used across countries.

## Target searches and difficulty

Search evaluates increasing term counts on the configured grid, includes the term cap, tracks the actual best score, and stops at the target, term budget, time budget, or cancellation. It does not assume monotonic similarity or use binary search. The first qualifying value is the smallest on the **tested grid**, not necessarily the smallest integer unless the search step is one.

“Not reached” describes the tested budget, not theoretical impossibility. A complete finite Fourier basis can reconstruct its own sampled contour.

Studio and Compare accuracy curves use a logarithmic term axis starting at N = 1, so early changes have more space. These curve calculations additionally measure every integer N from 1–25 (within the term cap), then retain the configured search grid and final cap. Displayed percentages and the linear 0–100% similarity axis are unchanged.

Difficulty Lab scans the configured grid up to its budget. Its score is:

`80 × min(N95 / term cap, 1) + 20 × normalized spectral energy entropy`

The spectral entropy uses the first selected contour's nonconstant coefficient energies, normalized by the logarithm of the number of components. When 95% is not reached, the first score component is 80 and the result is censored by the budget. Disconnected-component count is reported separately; area is not a difficulty input. Unmeasured countries remain unranked. Results are cached locally by dataset, geometry mode, sample count, term cap, and search step.

## Animation

Full construction uses eight distinct increasing N levels by default. Users can select 2–20 levels, limited by the available integer N values. Levels are spaced approximately logarithmically. Every level completes one entire contour cycle before advancing. Once the final N is reached, subsequent cycles retain it. Playback defaults to 2× (10 seconds per outline with the standard 20-second base); one speed control displays the resulting duration. Repeat limits apply to the final level. Shared URLs can retain a previously chosen base duration.

Fixed-N tracing uses the selected N on every loop. Final-shape mode presents the completed reconstruction immediately. Reduced-motion preferences default to final-shape mode.

## Performance & exports

Calculation times in Compare measure Fourier reconstruction and scoring, excluding fetch and preparation. Cached results retain their original timing. Difficulty Lab reports the complete curve-search elapsed time, including scoring and scheduling yields. These are device-specific observations, not portable benchmark rankings.

Projection, FFTs, scoring, and optimization run in a Web Worker. Geometry and measured reconstructions use bounded in-memory caches. Stale UI responses are ignored; searches support cancellation. All geographic data and fonts are served locally. Flags have a neutral fallback.

PNG and WebM use the Canvas renderer, with stroke widths scaled independently of export resolution. SVG exports completed vector paths. Settings and coefficients are JSON; accuracy results are CSV. WebM is offered only where the browser supports recording. No MP4 or GIF encoding is claimed.

## Validation and individual components

The Studio validation panel uses the selected final N, independently of the current animation construction level. Boundary similarity compares the reconstruction with the original projected map rings, using the same approximate raster overlap and bidirectional boundary scoring as the rest of the app. Sampling remains an input to the Fourier calculation, rather than a second displayed similarity score. These are not geodesic or real-coastline accuracy estimates.

The heatmap measures reconstructed vertices against the closest original boundary segments. Maximum-deviation markers also check the reverse direction using up to 1,024 uniform samples per reference contour. Values are percentages of the projected country diagonal. These sampled maximum deviations are not an exact continuous Hausdorff distance.

The convergence plots show mean error against the original boundary and retained nonconstant Fourier energy. Translation coefficients are excluded from energy. The small-gains indicator reports average error reduction per ten terms over the last three plotted levels through the selected N; fluctuations can occur. Sampling sensitivity repeats the same N at 256, 512, 1,024 and 2,048 longest-contour samples against the same dataset reference. Each contour can use only as many terms as it has coefficients.

The Components popup lists exterior land areas and associates their interior holes with them. Component similarity is scored in a local frame so small islands remain visible to the raster calculation; mean and maximum distances are converted back to percentages of the whole-country diagonal. Source-provided names are preserved for custom shapes. Country land areas use Natural Earth's 1:10m physical island labels where an 18×18 spatial check finds at least 90% coverage in both directions, with compatible bounding-box areas. This conservative label join does not change the reconstruction geometry; unmatched or partial islands retain neutral labels. `npm run data:names` rebuilds the 234 bundled labels (across both resolutions); the source URL and SHA-256 are recorded in `land-area-names.json`.

Numbered boxes locate two separated high-error regions on the map. Adjacent close-ups use the same original and reconstructed vertices, clipped to those boxes; they do not add geographic detail. The largest-deviation close-up also accounts for the reverse original-to-reconstruction check.

## Custom boundaries

Custom Shapes accepts GeoJSON polygons/multipolygons and line outlines, SVG paths and basic shapes, and two-column CSV. SVG is parsed as geometry and is never inserted as executable markup. SVG transforms are applied; nested outlines use even-odd containment. CSV blank lines separate paths. GeoJSON preserves its polygon/hole structure and feature names. Open paths are closed only after user confirmation, with a straight final edge.

Uploads are limited to 2 MB, 50,000 points and 128 exterior areas; invalid, nonfinite and degenerate coordinates are rejected. SVG curves are discretized to at most 2,048 points per subpath before Fourier resampling. SVG and drawings preserve screen orientation; x,y CSV uses a positive-up y axis, and longitude,latitude CSV uses geographic projection. Drawings support separate closed outlines, nested holes and reversible editing. Geometry remains local to the browser.
