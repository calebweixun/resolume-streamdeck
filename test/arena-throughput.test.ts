import { describe, expect, it } from "vitest";
import { ArenaService } from "../src/core/arena-service";
import { encodeOscMessage } from "../src/core/osc-codec";
import type { MonitoringRule, PlaybackState } from "../src/core/types";

type ArenaInternals = {
  subscribers: Map<string, { rule: MonitoringRule; update: (state: PlaybackState) => void }>;
  rebuildMonitoredRules(): void;
  handlePacket(packet: Buffer): void;
};

function internals(service: ArenaService): ArenaInternals {
  return service as unknown as ArenaInternals;
}

describe("ArenaService high-volume input", () => {
  it("drops unrelated Output All messages before state processing", () => {
    const service = new ArenaService();
    const arena = internals(service);
    let updates = 0;
    arena.subscribers.set("monitor", {
      rule: { mode: "selectedClip", layer: 1, clip: 1 },
      update: () => { updates += 1; }
    });
    arena.rebuildMonitoredRules();

    for (let index = 0; index < 1_000; index += 1) {
      arena.handlePacket(encodeOscMessage(`/composition/layers/9/clips/${index}/video/opacity`, [0.5]));
    }

    expect(updates).toBe(0);
  });

  it("processes a shared monitoring rule only once per packet", () => {
    const service = new ArenaService();
    const arena = internals(service);
    const rule: MonitoringRule = { mode: "selectedClip", layer: 1, clip: 1 };
    let firstUpdates = 0;
    let secondUpdates = 0;
    arena.subscribers.set("first", { rule, update: () => { firstUpdates += 1; } });
    arena.subscribers.set("second", { rule, update: () => { secondUpdates += 1; } });
    arena.rebuildMonitoredRules();

    arena.handlePacket(encodeOscMessage("/composition/selectedclip/transport/position", [0.25]));

    expect(firstUpdates).toBe(1);
    expect(secondUpdates).toBe(1);
  });
});
