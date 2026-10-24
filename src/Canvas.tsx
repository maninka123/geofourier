import { useEffect, useRef } from "react";
import type { Analysis, Point } from "./engine";
export type Appearance = {
  fullTrace?: boolean;
  circles: boolean;
  arms: boolean;
  trail: boolean;
  silhouette: boolean;
  reference: boolean;
  guides: boolean;
  tip: boolean;
  grid: boolean;
  glow: boolean;
  fading: boolean;
  heatmap: boolean;
  color: string;
  stroke: number;
  opacity: number;
  trailLength: number;
  zoom: number;
  inspector: number;
};
export const defaultAppearance: Appearance = {
  circles: true,
  arms: true,
  trail: true,
  silhouette: true,
  reference: true,
  guides: false,
  tip: true,
  grid: true,
  glow: false,
  fading: false,
  heatmap: false,
  color: "#4358ce",
  stroke: 2.3,
  opacity: 0.46,
  trailLength: 100,
  zoom: 1,
  inspector: -1,
};
export type Clock = {
  elapsed: number;
  playing: boolean;
  duration: number;
  speed: number;
  loops: number;
};
export function phase(clock: Clock) {
  const cycles = clock.elapsed / clock.duration;
  if (cycles >= clock.loops) return 1;
  if (
    !clock.playing &&
    cycles > 0 &&
    Math.abs(cycles - Math.round(cycles)) < 1e-9
  )
    return 1;
  return cycles % 1;
}
function path(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  scale: number,
  close = true,
) {
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale),
  );
  if (close) ctx.closePath();
}
export function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  a: Analysis,
  appearance: Appearance,
  t: number,
  dark = false,
) {
  const o = appearance,
    scale = Math.min(width * 0.4, height * 0.45) * o.zoom;
  ctx.clearRect(0, 0, width, height);
  if (o.grid) {
    ctx.strokeStyle = dark ? "#ffffff08" : "#7680920c";
    ctx.lineWidth = 0.6;
    const step = 40;
    for (let x = (width / 2) % step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = (height / 2) % step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(width / 2, height / 2);
  if (o.guides) {
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = dark ? "#ffffff28" : "#53607525";
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.moveTo(0, -height / 2);
    ctx.lineTo(0, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (o.silhouette) {
    const groups = new Map<number, number[]>();
    a.model.contours.forEach((c, i) =>
      groups.set(c.group, [...(groups.get(c.group) || []), i]),
    );
    ctx.fillStyle = dark ? "#ffffff06" : "#6b7b9b07";
    for (const indices of groups.values()) {
      ctx.beginPath();
      for (const i of indices) {
        a.model.contours[i].points.forEach(([x, y], j) =>
          j
            ? ctx.lineTo(x * scale, y * scale)
            : ctx.moveTo(x * scale, y * scale),
        );
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
  }
  if (o.reference) {
    ctx.strokeStyle = dark ? "#dce5f085" : "#727f94a0";
    ctx.lineWidth = 1.15;
    for (const c of a.model.contours) {
      path(ctx, c.points, scale);
      ctx.stroke();
    }
  }
  for (let index = 0; index < a.paths.length; index++) {
    const contour = a.model.contours[index],
      points = a.paths[index],
      end = o.fullTrace
        ? points.length - 1
        : Math.min(points.length - 1, Math.floor(t * points.length));
    // A quiet full approximation stays visible while the brighter pen traces its path.
    ctx.strokeStyle = o.color + "32";
    ctx.lineWidth = o.stroke * 0.65;
    path(ctx, points, scale);
    ctx.stroke();
    if (o.trail) {
      const start = o.fading
        ? Math.max(0, end - Math.floor((points.length * o.trailLength) / 100))
        : 0;
      if (o.glow) {
        ctx.shadowColor = o.color + "60";
        ctx.shadowBlur = 3;
      }
      ctx.lineWidth = o.stroke;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (o.heatmap) {
        for (let j = Math.max(1, start); j <= end; j++) {
          const e =
            Math.hypot(
              points[j][0] - contour.points[j][0],
              points[j][1] - contour.points[j][1],
            ) / a.model.diagonal;
          ctx.strokeStyle =
            e < 0.01 ? o.color : e < 0.035 ? "#d8a04d" : "#d56868";
          path(ctx, [points[j - 1], points[j]], scale, false);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = o.color;
        path(
          ctx,
          points.slice(start, end + 1),
          scale,
          (t === 1 || o.fullTrace === true) && start === 0,
        );
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    let x = 0,
      y = 0;
    const cs = contour.coefficients.slice(0, a.terms);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i],
        angle = 2 * Math.PI * c.frequency * t + c.phase,
        nx = x + c.amplitude * Math.cos(angle),
        ny = y + c.amplitude * Math.sin(angle),
        selected = o.inspector === i && index === 0;
      if (o.circles && c.frequency !== 0 && c.amplitude * scale > 0.4) {
        ctx.strokeStyle = selected ? "#dd9a40" : o.color;
        ctx.globalAlpha = selected ? 0.85 : o.opacity;
        ctx.lineWidth = selected ? 1.8 : 0.95;
        ctx.beginPath();
        ctx.arc(x * scale, y * scale, c.amplitude * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (o.arms) {
        ctx.strokeStyle = selected ? "#dd9a40" : o.color;
        ctx.globalAlpha = selected ? 0.9 : o.opacity * 1.5;
        ctx.lineWidth = selected ? 1.5 : 0.9;
        ctx.beginPath();
        ctx.moveTo(x * scale, y * scale);
        ctx.lineTo(nx * scale, ny * scale);
        ctx.stroke();
      }
      x = nx;
      y = ny;
    }
    ctx.globalAlpha = 1;
    if (o.tip) {
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = o.glow ? 12 : 0;
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = dark ? "#fff" : "#fff";
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
export default function FourierCanvas({
  analysis,
  appearance,
  clock,
  dark = false,
  id,
  label,
}: {
  analysis?: Analysis;
  appearance: Appearance;
  clock: React.RefObject<Clock>;
  dark?: boolean;
  id?: string;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    current = useRef({ analysis, appearance, dark });
  current.current = { analysis, appearance, dark };
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let frame = 0,
      width = 0,
      height = 0;
    const ctx = el.getContext("2d")!;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      el.width = width * ratio;
      el.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    });
    observer.observe(el);
    const render = () => {
      const { analysis: a, appearance: o, dark: d } = current.current;
      if (a && width && height)
        draw(ctx, width, height, a, o, phase(clock.current), d);
      else ctx.clearRect(0, 0, width, height);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [clock]);
  return <canvas ref={canvas} id={id} aria-label={label} role="img" />;
}
