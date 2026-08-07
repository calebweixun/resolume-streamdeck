export function calculateRemaining(durationSeconds: number, position: number, direction: "reverse" | "paused" | "forward" | "random"): number {
  const normalized = Math.max(0, Math.min(1, position));
  if (direction === "reverse") return durationSeconds * normalized;
  return durationSeconds * (1 - normalized);
}

/** Resolume exposes duration as a normalized value whose full range is seven days. */
export function decodeDurationSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value <= 1 ? value * 604_800 + 0.001 : value;
}

export type TimeFormat = { showHours: boolean; showMilliseconds: boolean; showSign: boolean };

export function formatRemaining(seconds: number, format: TimeFormat): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000);
  const prefix = format.showSign ? "T−" : "";
  const hourPart = format.showHours ? `${String(hours).padStart(2, "0")}:` : "";
  const msPart = format.showMilliseconds ? `.${String(milliseconds).padStart(3, "0")}` : "";
  return `${prefix}${hourPart}${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}${msPart}`;
}
