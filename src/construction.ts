export type BuildMode = "construction" | "trace" | "final" | "target";
export function constructionSequence(goal: number, count: number) {
  const levels = Math.max(1, Math.min(Math.round(goal), Math.round(count))),
    sequence: number[] = [];
  if (levels === 1) return [goal];
  for (let i = 0; i < levels; i++) {
    const raw = Math.round(Math.exp((Math.log(goal) * i) / (levels - 1)));
    sequence.push(
      i === 0
        ? 1
        : Math.max(sequence[i - 1] + 1, Math.min(goal - (levels - 1 - i), raw)),
    );
  }
  return sequence;
}
export function constructionAt(
  goal: number,
  steps: number,
  enabled: boolean,
  elapsed: number,
  duration: number,
  playing = true,
) {
  const sequence = constructionSequence(goal, steps);
  const cycles = Math.max(0, elapsed / duration);
  const index = Math.min(
    sequence.length - 1,
    Math.max(0, Math.floor(cycles - (!playing && cycles > 0 ? 1e-9 : 0))),
  );
  return {
    terms: enabled ? sequence[index] : goal,
    stage: enabled ? index + 1 : sequence.length,
    total: sequence.length,
    building: enabled && cycles < sequence.length,
    sequence,
  };
}
