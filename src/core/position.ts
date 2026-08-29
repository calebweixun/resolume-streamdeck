import type { PlaybackState } from "./types";

/** Filters tiny out-of-order OSC regressions while preserving seeks and loops. */
export function stabilizePosition(current: number, incoming: number, direction: PlaybackState["direction"]): number {
  const next = Math.max(0, Math.min(1, incoming));
  if (direction === "paused" || direction === "random") return next;
  const delta = next - current;
  if (direction === "forward" && delta < 0 && delta >= -0.02) return current;
  if (direction === "reverse" && delta > 0 && delta <= 0.02) return current;
  return next;
}
