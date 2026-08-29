import { describe, expect, it } from "vitest";
import { stabilizePosition } from "../src/core/position";

describe("stabilizePosition", () => {
  it("ignores tiny backward jitter during forward playback", () => {
    expect(stabilizePosition(0.5, 0.49, "forward")).toBe(0.5);
  });

  it("preserves seeks, loop wraps, and paused scrubbing", () => {
    expect(stabilizePosition(0.5, 0.4, "forward")).toBe(0.4);
    expect(stabilizePosition(0.99, 0.01, "forward")).toBe(0.01);
    expect(stabilizePosition(0.5, 0.49, "paused")).toBe(0.49);
  });

  it("mirrors jitter filtering for reverse playback", () => {
    expect(stabilizePosition(0.5, 0.51, "reverse")).toBe(0.5);
    expect(stabilizePosition(0.5, 0.6, "reverse")).toBe(0.6);
  });
});
