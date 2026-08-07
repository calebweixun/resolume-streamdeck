type Sample = {
  position: number;
  timestampMs: number;
  estimateSeconds?: number;
};

/** Estimates one full playback cycle from normalized position changes. */
export class DurationEstimator {
  private readonly samples = new Map<string, Sample>();

  reset(key: string): void {
    this.samples.delete(key);
  }

  sample(key: string, position: number, timestampMs: number): number | undefined {
    const previous = this.samples.get(key);
    const next: Sample = { position, timestampMs, estimateSeconds: previous?.estimateSeconds };
    this.samples.set(key, next);
    if (!previous) return undefined;

    const elapsedSeconds = (timestampMs - previous.timestampMs) / 1000;
    const positionDelta = Math.abs(position - previous.position);
    if (elapsedSeconds <= 0 || elapsedSeconds > 1 || positionDelta < 0.00001 || positionDelta > 0.25) {
      return previous.estimateSeconds;
    }

    const measured = elapsedSeconds / positionDelta;
    if (!Number.isFinite(measured) || measured < 0.25 || measured > 86_400) return previous.estimateSeconds;

    const estimate = previous.estimateSeconds === undefined
      ? measured
      : previous.estimateSeconds * 0.8 + measured * 0.2;
    next.estimateSeconds = estimate;
    return estimate;
  }
}
