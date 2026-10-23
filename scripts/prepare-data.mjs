import fs from "node:fs/promises";
await fs.mkdir("public/data", { recursive: true });
for (const resolution of ["50m", "110m"]) {
  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_${resolution}_admin_0_countries.geojson`;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Dataset: ${response.status}`);
  const data = await response.json();
  const countries = [];
  for (const f of data.features) {
    const p = f.properties,
      id = p.ADM0_A3;
    const country = {
      id,
      name: p.ADMIN,
      code: p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : p.ISO_A2,
      continent: p.CONTINENT,
    };
    countries.push(country);
    await fs.writeFile(
      `public/data/${resolution}-${id}.json`,
      JSON.stringify({
        type: f.geometry.type,
        coordinates: f.geometry.coordinates,
      }),
    );
  }
  countries.sort((a, b) => a.name.localeCompare(b.name));
  await fs.writeFile(
    `public/data/countries-${resolution}.json`,
    JSON.stringify(countries),
  );
  console.log(
    `${resolution}: ${countries.length} real country / territory geometries`,
  );
}
await fs.writeFile(
  "public/data/SOURCE.txt",
  "Natural Earth Admin 0 Countries, 1:50m and 1:110m. Public domain. Source: https://github.com/nvkelso/natural-earth-vector . De facto boundaries, no endorsement. Downloaded 2026-10-23. No geometric simplification is applied by Forma.",
);
