import { afterEach, describe, expect, it, vi } from "vitest";
import { ArenaService } from "../src/core/arena-service";
import { encodeOscMessage } from "../src/core/osc-codec";
import type { MonitoringRule, PlaybackState } from "../src/core/types";

type ArenaInternals = {
  subscribers: Map<string, { rule: MonitoringRule; followGlobal: boolean; update: (state: PlaybackState) => void }>;
  monitoredRules: Map<string, MonitoringRule>;
  states: Map<string, PlaybackState>;
  lastPacketAt: number;
  rebuildMonitoredRules(): void;
  handlePacket(packet: Buffer): void;
  updateStaleStates(): void;
};

function internals(service: ArenaService): ArenaInternals {
  return service as unknown as ArenaInternals;
}

describe("ArenaService high-volume input", () => {
  afterEach(() => vi.useRealTimers());

  it("drops unrelated Output All messages before state processing", () => {
    const service = new ArenaService();
    const arena = internals(service);
    let updates = 0;
    arena.subscribers.set("monitor", {
      rule: { mode: "selectedClip", layer: 1, clip: 1 },
      followGlobal: false,
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
    arena.subscribers.set("first", { rule, followGlobal: false, update: () => { firstUpdates += 1; } });
    arena.subscribers.set("second", { rule, followGlobal: false, update: () => { secondUpdates += 1; } });
    arena.rebuildMonitoredRules();

    arena.handlePacket(encodeOscMessage("/composition/selectedclip/transport/position", [0.25]));

    expect(firstUpdates).toBe(1);
    expect(secondUpdates).toBe(1);
  });

  it("does not treat clip 10 wildcard replies as clip 1 disconnecting", () => {
    const service = new ArenaService();
    const arena = internals(service);
    const rule: MonitoringRule = { mode: "specificLayer", layer: 4, clip: 1 };
    const updates: PlaybackState[] = [];
    arena.subscribers.set("monitor", {
      rule,
      followGlobal: false,
      update: (state) => { updates.push(state); }
    });
    arena.rebuildMonitoredRules();

    arena.handlePacket(encodeOscMessage("/composition/layers/4/clips/1/connected", [4]));
    for (let clip = 2; clip <= 27; clip += 1) {
      arena.handlePacket(encodeOscMessage(`/composition/layers/4/clips/${clip}/connected`, [clip < 6 ? 0 : 1]));
    }

    expect(arena.states.get("specificLayer:4:1")?.activePath)
      .toBe("/composition/layers/4/clips/1");
    expect(updates.at(-1)?.status).toBe("ok");
    expect(updates.some(({ status }) => status === "no-clip")).toBe(false);
  });

  it("clears a layer only when the exact active clip disconnects", () => {
    const service = new ArenaService();
    const arena = internals(service);
    const rule: MonitoringRule = { mode: "specificLayer", layer: 4, clip: 1 };
    arena.subscribers.set("monitor", { rule, followGlobal: false, update: () => undefined });
    arena.rebuildMonitoredRules();

    arena.handlePacket(encodeOscMessage("/composition/layers/4/clips/1/connected", [4]));
    arena.handlePacket(encodeOscMessage("/composition/layers/4/clips/1/connected", [1]));

    expect(arena.states.get("specificLayer:4:1")?.activePath).toBe("");
    expect(arena.states.get("specificLayer:4:1")?.status).toBe("no-clip");
  });

  it("does not flash no-signal during a short reply gap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(4_000);
    const service = new ArenaService();
    const arena = internals(service);
    const rule: MonitoringRule = { mode: "selectedClip", layer: 1, clip: 1 };
    const state: PlaybackState = {
      status: "ok", clipName: "Demo", durationSeconds: 10, position: 0.5,
      direction: "forward", remainingSeconds: 5, activePath: "", lastReplyAt: 0
    };
    arena.subscribers.set("monitor", { rule, followGlobal: false, update: () => undefined });
    arena.states.set("selectedClip:1:1", state);
    arena.lastPacketAt = 0;

    arena.updateStaleStates();
    expect(state.status).toBe("ok");
    vi.setSystemTime(5_000);
    arena.updateStaleStates();
    expect(state.status).toBe("no-signal");
  });

  it("uses incoming OSC traffic as the connection heartbeat", () => {
    vi.useFakeTimers();
    const service = new ArenaService();
    const arena = internals(service);
    const rule: MonitoringRule = { mode: "selectedClip", layer: 1, clip: 1 };
    const state: PlaybackState = {
      status: "ok", clipName: "Demo", durationSeconds: 10, position: 0.5,
      direction: "forward", remainingSeconds: 5, activePath: "", lastReplyAt: 0
    };
    arena.subscribers.set("monitor", { rule, followGlobal: false, update: () => undefined });
    arena.rebuildMonitoredRules();
    arena.states.set("selectedClip:1:1", state);
    arena.lastPacketAt = 0;

    vi.setSystemTime(4_500);
    arena.handlePacket(encodeOscMessage("/composition/video/opacity", [0.5]));
    vi.setSystemTime(8_000);
    arena.updateStaleStates();

    expect(state.status).toBe("ok");
  });

  it("moves shared subscribers to global settings loaded after startup", async () => {
    const service = new ArenaService();
    const arena = internals(service);
    const defaultRule: MonitoringRule = { mode: "specificLayer", layer: 1, clip: 1 };
    arena.subscribers.set("monitor", {
      rule: defaultRule,
      followGlobal: true,
      update: () => undefined
    });
    arena.rebuildMonitoredRules();

    await service.configure({ replyPort: 0, monitorMode: "specificLayer", layer: 4, clip: 1 });

    expect(arena.monitoredRules.has("specificLayer:4:1")).toBe(true);
    expect(arena.monitoredRules.has("specificLayer:1:1")).toBe(false);

    await service.subscribe("late-monitor", defaultRule, () => undefined, true);
    expect(arena.monitoredRules.has("specificLayer:4:1")).toBe(true);
    expect(arena.subscribers.get("late-monitor")?.rule.layer).toBe(4);
    await service.shutdown();
  });
});
