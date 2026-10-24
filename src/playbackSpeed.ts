export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 6, 8] as const;
export function nearestPlaybackSpeed(value: number) {
  if (!Number.isFinite(value)) return 2;
  return PLAYBACK_SPEEDS.reduce((closest, speed) =>
    Math.abs(speed - value) < Math.abs(closest - value) ? speed : closest,
  );
}
