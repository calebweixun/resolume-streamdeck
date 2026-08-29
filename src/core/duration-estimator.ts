type Sample = {
  position: number;
  timestampMs: number;
  estimateSeconds?: number;
  measurements: number[];
};

const MIN_SAMPLE_INTERVAL_MS = 120;
const MAX_MEASUREMENTS = 7;

/** Estimates one full playback cycle from normalized position changes. */
export class DurationEstimator {
  private readonly samples = new Map<string, Sample>();

  reset(key: string): void {
    this.samples.delete(key);
  }

  sample(key: string, position: number, timestampMs: number): number | undefined {
    const previous = this.samples.get(key);
    if (!previous) {
      this.samples.set(key, { position, timestampMs, measurements: [] });
      return undefined;
    }

    const elapsedSeconds = (timestampMs - previous.timestampMs) / 1000;
    if (elapsedSeconds > 0 && timestampMs - previous.timestampMs < MIN_SAMPLE_INTERVAL_MS) {
      return previous.estimateSeconds;
    }
    const positionDelta = Math.abs(position - previous.position);
    const next: Sample = {
      position,
      timestampMs,
      estimateSeconds: previous.estimateSeconds,
      measurements: previous.measurements
    };
    this.samples.set(key, next);
    if (elapsedSeconds <= 0 || elapsedSeconds > 1 || positionDelta < 0.00001 || positionDelta > 0.25) {
      return previous.estimateSeconds;
    }

    const measured = elapsedSeconds / positionDelta;
    if (!Number.isFinite(measured) || measured < 0.25 || measured > 86_400) return previous.estimateSeconds;

    const measurements = [...previous.measurements, measured].slice(-MAX_MEASUREMENTS);
    const sorted = [...measurements].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const smoothed = previous.estimateSeconds === undefined
      ? median
      : previous.estimateSeconds * 0.9 + median * 0.1;
    next.measurements = measurements;
    next.estimateSeconds = Math.round(smoothed * 10) / 10;
    return next.estimateSeconds;
  }
}
