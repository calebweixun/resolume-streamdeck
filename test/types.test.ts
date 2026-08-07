import { describe, expect, it } from "vitest";
import { basePathForRule, resolveGlobalSettings, resolveRule } from "../src/core/types";

describe("Monitoring rules", () => {
  it("maps each rule to its Resolume path", () => {
    expect(basePathForRule({ mode: "selectedClip", layer: 1, clip: 1 })).toBe("/composition/selectedclip");
    expect(basePathForRule({ mode: "selectedLayer", layer: 1, clip: 1 })).toBe("/composition/selectedlayer");
    expect(basePathForRule({ mode: "specificLayer", layer: 3, clip: 1 })).toBe("/composition/layers/3");
    expect(basePathForRule({ mode: "specificClip", layer: 3, clip: 7 })).toBe("/composition/layers/3/clips/7");
  });

  it("uses global rule unless an action opts into an override", () => {
    const global = resolveGlobalSettings({ monitorMode: "specificLayer", layer: 2 });
    expect(resolveRule(global, { layer: 9 }).layer).toBe(2);
    expect(resolveRule(global, { overrideMonitoring: true, monitorMode: "specificClip", layer: 9, clip: 4 })).toEqual({ mode: "specificClip", layer: 9, clip: 4 });
  });
});
