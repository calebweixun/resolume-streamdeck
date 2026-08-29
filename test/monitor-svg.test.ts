import { describe, expect, it } from "vitest";
import { renderMonitorSvg } from "../src/render/monitor-svg";
import type { PlaybackState, ResolvedSettings } from "../src/core/types";

const settings: ResolvedSettings = {
  host: "127.0.0.1", arenaPort: 7000, replyPort: 7001,
  monitorRule: { mode: "specificLayer", layer: 1, clip: 1 },
  warningSeconds: 30, criticalSeconds: 10,
  showHours: false, showMilliseconds: false, showSign: true
};

const state: PlaybackState = {
  status: "ok", clipName: "A very long selected clip name",
  durationSeconds: 100, position: 0.5, direction: "forward", remainingSeconds: 50,
  activePath: "/composition/selectedclip", lastReplyAt: Date.now()
};

describe("monitor SVG layouts", () => {
  it("renders a circular countdown and can hide the clip name", () => {
    const hidden = renderMonitorSvg("circle", state, settings, { showClipName: false });
    expect(hidden).toContain("stroke-dasharray");
    expect(hidden).not.toContain("A very long");

    const visible = renderMonitorSvg("circle", state, settings, { showClipName: true });
    expect(visible).toContain("A very long");
  });

  it("renders bar and square countdown styles", () => {
    const bar = renderMonitorSvg("bar", state, settings);
    expect(bar).toContain('width="58.0"');

    const square = renderMonitorSvg("square", state, settings);
    expect(square).toContain('pathLength="100"');
    expect(square).toContain('stroke-dasharray="50.0 100"');
  });
});
