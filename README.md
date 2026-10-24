# Forma

**The mathematics of borders.** Real country outlines, reconstructed with rotating Fourier epicycles.

### [Open the live app ↗](https://maninka123.github.io/geofourier/)

![Forma Studio — Sri Lanka](docs/screenshots/studio.jpg)

| Difficulty Lab                                                      | Country Compare                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ![Measured country difficulty](docs/screenshots/difficulty-lab.jpg) | ![Accuracy curves for every selected country](docs/screenshots/compare-curves.jpg) |

- **Studio:** choose N or target similarity, watch eight construction levels by default, and explore a compact measured accuracy curve. Each level completes a loop; the final N keeps looping.
- **Equation explorer:** click the N statistic for the actual Fourier equation, animated x(t)/y(t) graphs, and coefficients displayed to two decimal places. [Preview](docs/screenshots/equation.jpg).
- **Difficulty Lab:** watch intermediate reconstructions beside the chart, then explore all measured countries in a full-width scrolling flag chart. Select table countries in a fixed side preview and open them in Studio. [Country preview](docs/screenshots/country-preview.jpg).
- **Visual settings:** compact controls with matching coastline resolution previews, Japan’s islands, and South Africa’s interior hole. [Preview](docs/screenshots/settings-previews.jpg).
- **Playback:** drag between marked speeds up to 8×; cycle time stays linked in both directions. [Preview](docs/screenshots/playback.jpg).
- **Studio accuracy:** a full-width curve below a shallow spectrum panel updates automatically for the selected country and computation settings, with no calculate button. [Preview](docs/screenshots/studio-accuracy.jpg).
- **Compare:** two to four countries with synchronized playback and distinct flag-derived colours. Accuracy curves update automatically; logarithmic N axes and every N from 1–25 in Studio and Compare reveal early detail. [Curve preview](docs/screenshots/compare-curves.jpg).
- **Export:** PNG, SVG, WebM, settings, coefficients, and measured CSV data. Shareable URLs and local presets included.

```sh
npm ci
npm run dev
```

`npm test` runs the mathematics and construction tests. `npm run build` produces the static app in `dist/`. Pushes to `main` test, build, and deploy through GitHub Actions to GitHub Pages.

**Built with:** React, strict TypeScript, Vite, Motion, Canvas 2D, and a Web Worker FFT engine. No backend or API key required.

**Data & scoring:** [Natural Earth](https://github.com/nvkelso/natural-earth-vector), public domain; 242 countries/territories at 1:50m and 177 at 1:110m. Similarity combines measured silhouette overlap (70%) and normalized bidirectional boundary distance (30%). [Mathematics and limitations →](docs/MATHEMATICS.md) Flags: [FlagCDN](https://flagcdn.com/).
