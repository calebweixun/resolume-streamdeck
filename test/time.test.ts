import { describe, expect, it } from "vitest";
import { calculateRemaining, decodeDurationSeconds, formatRemaining } from "../src/core/time";

describe("Remaining Time", () => {
  it("decodes Resolume's seven-day normalized duration", () => {
    expect(decodeDurationSeconds(60 / 604_800)).toBeCloseTo(60.001, 3);
    expect(decodeDurationSeconds(100)).toBe(100);
  });

  it("calculates forward and reverse playback", () => {
    expect(calculateRemaining(100, 0.25, "forward")).toBe(75);
    expect(calculateRemaining(100, 0.25, "reverse")).toBe(25);
  });

  it("clamps invalid positions", () => {
    expect(calculateRemaining(10, 2, "forward")).toBe(0);
    expect(calculateRemaining(10, -1, "reverse")).toBe(0);
  });

  it("formats compact and detailed displays", () => {
    expect(formatRemaining(65.432, { showHours: false, showMilliseconds: false, showSign: true })).toBe("T−01:05");
    expect(formatRemaining(3665.432, { showHours: true, showMilliseconds: true, showSign: false })).toBe("01:01:05.431");
  });
});
