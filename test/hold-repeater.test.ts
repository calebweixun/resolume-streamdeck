import { afterEach, describe, expect, it, vi } from "vitest";
import { HoldRepeater } from "../src/core/hold-repeater";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HoldRepeater", () => {
  it("runs immediately, repeats after the delay, and stops on release", async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockResolvedValue(undefined);
    const repeater = new HoldRepeater();

    repeater.start(task, 400, 120);
    await vi.advanceTimersByTimeAsync(399);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(240);
    expect(task).toHaveBeenCalledTimes(4);

    repeater.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(4);
  });

  it("does not overlap a slow operation", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const repeater = new HoldRepeater();

    repeater.start(task, 100, 50);
    await vi.advanceTimersByTimeAsync(300);
    expect(task).toHaveBeenCalledTimes(1);
    finish?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50);
    expect(task).toHaveBeenCalledTimes(2);
    repeater.stop();
  });
});
