import { describe, expect, it } from "vitest";
import { DurationEstimator } from "../src/core/duration-estimator";

describe("DurationEstimator", () => {
  it("estimates a full cycle from normalized position changes", () => {
    const estimator = new DurationEstimator();
    expect(estimator.sample("clip", 0.1, 1_000)).toBeUndefined();
    expect(estimator.sample("clip", 0.11, 2_000)).toBeCloseTo(100, 5);
    expect(estimator.sample("clip", 0.12, 3_000)).toBeCloseTo(100, 5);
  });

  it("ignores seeks and starts over after reset", () => {
    const estimator = new DurationEstimator();
    estimator.sample("clip", 0.1, 1_000);
    expect(estimator.sample("clip", 0.9, 1_100)).toBeUndefined();
    estimator.reset("clip");
    expect(estimator.sample("clip", 0.2, 2_000)).toBeUndefined();
  });
});
