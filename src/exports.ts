import { draw, type Appearance } from "./Canvas";
import type { Analysis, Country, CurvePoint } from "./engine";
export function download(
  content: Blob | string,
  name: string,
  type = "text/plain",
) {
  const blob =
      typeof content === "string" ? new Blob([content], { type }) : content,
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportSvg(
  a: Analysis,
  country: Country,
  o: Appearance,
  transparent: boolean,
  label: boolean,
  stats: boolean,
  size: number,
) {
  const scale = size * 0.37,
    unit = size / 800,
    cx = size / 2,
    cy = size / 2;
  let body = transparent
    ? ""
    : `<rect width="100%" height="100%" fill="#f8f9fb"/>`;
  if (o.reference)
    body += a.model.contours
      .map(
        (c) =>
          `<path d="${(c.source || c.points).map(([x, y], i) => `${i ? "L" : "M"}${cx + x * scale},${cy + y * scale}`).join(" ")}Z" fill="none" stroke="#8793a6" stroke-width="${unit}"/>`,
      )
      .join("");
  body += a.paths
    .map(
      (p) =>
        `<path d="${p.map(([x, y], i) => `${i ? "L" : "M"}${cx + x * scale},${cy + y * scale}`).join(" ")}Z" fill="none" stroke="${o.color}" stroke-width="${o.stroke * unit}"/>`,
    )
    .join("");
  if (o.circles || o.arms)
    for (const c of a.model.contours) {
      let x = 0,
        y = 0;
      for (const k of c.coefficients.slice(0, a.terms)) {
        const nx = x + k.amplitude * Math.cos(k.phase),
          ny = y + k.amplitude * Math.sin(k.phase);
        if (o.circles && k.frequency)
          body += `<circle cx="${cx + x * scale}" cy="${cy + y * scale}" r="${k.amplitude * scale}" fill="none" stroke="${o.color}" opacity="${o.opacity}" stroke-width="${unit * 0.95}"/>`;
        if (o.arms)
          body += `<path d="M${cx + x * scale} ${cy + y * scale}L${cx + nx * scale} ${cy + ny * scale}" stroke="${o.color}" opacity="${o.opacity}"/>`;
        x = nx;
        y = ny;
      }
    }
  const safe = country.name.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
  if (label)
    body += `<text x="${size * 0.05}" y="${size * 0.07}" font-family="sans-serif" font-size="${size * 0.025}" fill="#242b3b">${safe} · FORMA</text>`;
  if (stats)
    body += `<text x="${size * 0.05}" y="${size * 0.95}" font-family="sans-serif" font-size="${size * 0.018}" fill="#687284">${a.terms} terms / contour · ${a.metrics.similarity.toFixed(2)}% similarity</text>`;
  download(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
    `${country.id}-forma.svg`,
    "image/svg+xml",
  );
}
export async function exportPng(
  a: Analysis,
  country: Country,
  o: Appearance,
  transparent: boolean,
  label: boolean,
  stats: boolean,
  size: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.scale(size / 800, size / 800);
  draw(ctx, 800, 800, a, { ...o, grid: false, fullTrace: true }, 1);
  ctx.restore();
  if (!transparent) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#f8f9fb";
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.fillStyle = "#242b3b";
  ctx.font = `500 ${size * 0.025}px system-ui`;
  if (label) ctx.fillText(`${country.name} · FORMA`, size * 0.05, size * 0.07);
  ctx.fillStyle = "#687284";
  ctx.font = `${size * 0.018}px system-ui`;
  if (stats)
    ctx.fillText(
      `${a.terms} terms / contour · ${a.metrics.similarity.toFixed(2)}% similarity`,
      size * 0.05,
      size * 0.95,
    );
  return new Promise<void>((resolve) =>
    canvas.toBlob((blob) => {
      if (blob) download(blob, `${country.id}-forma.png`);
      resolve();
    }),
  );
}
export function csv(points: CurvePoint[], country: string) {
  return (
    "country,terms,similarity_percent,overlap_percent,mean_boundary_error_percent\n" +
    points
      .map((p) => `${country},${p.terms},${p.similarity},${p.iou},${p.mean}`)
      .join("\n")
  );
}
export async function exportWebm(
  a: Analysis,
  country: Country,
  o: Appearance,
  duration: number,
  size: number,
  onStatus: (s: string) => void,
) {
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime)
    throw Error(
      "This browser does not support WebM recording. Use PNG or SVG.",
    );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!,
    stream = canvas.captureStream(30),
    recorder = new MediaRecorder(stream, { mimeType: mime }),
    chunks: BlobPart[] = [];
  const done = new Promise<void>((resolve, reject) => {
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onerror = () =>
      reject(Error("The browser could not record this animation."));
    recorder.onstop = () => {
      download(new Blob(chunks, { type: mime }), `${country.id}-forma.webm`);
      stream.getTracks().forEach((t) => t.stop());
      resolve();
    };
  });
  onStatus("Recording… keep this tab open.");
  recorder.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = Math.min(1, (performance.now() - start) / (duration * 1000));
      ctx.save();
      ctx.scale(size / 800, size / 800);
      draw(ctx, 800, 800, a, { ...o, grid: false, fullTrace: false }, t);
      ctx.restore();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#f8f9fb";
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = "source-over";
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    frame();
  });
  recorder.stop();
  await done;
  onStatus("WebM exported.");
}
