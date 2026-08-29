import { describe, expect, it } from "vitest";
import { decodeOscPacket, encodeOscMessage, peekOscAddress } from "../src/core/osc-codec";

describe("OSC codec", () => {
  it("round-trips supported argument types", () => {
    const decoded = decodeOscPacket(encodeOscMessage("/test", [7, 0.25, "hello", true, false]));
    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.address).toBe("/test");
    expect(decoded[0]?.args[0]).toBe(7);
    expect(decoded[0]?.args[1]).toBeCloseTo(0.25);
    expect(decoded[0]?.args.slice(2)).toEqual(["hello", true, false]);
  });

  it("rejects malformed addresses", () => {
    expect(() => encodeOscMessage("test", [])).toThrow("must start with /");
  });

  it("decodes bundles", () => {
    const first = encodeOscMessage("/one", [1]);
    const second = encodeOscMessage("/two", ["ok"]);
    const size = (packet: Buffer) => { const value = Buffer.alloc(4); value.writeInt32BE(packet.length); return value; };
    const header = Buffer.alloc(16);
    Buffer.from("#bundle\0").copy(header);
    const bundle = Buffer.concat([header, size(first), first, size(second), second]);
    expect(decodeOscPacket(bundle)).toEqual([{ address: "/one", args: [1] }, { address: "/two", args: ["ok"] }]);
    expect(decodeOscPacket(bundle, (address) => address === "/two"))
      .toEqual([{ address: "/two", args: ["ok"] }]);
  });

  it("decodes the float replies emitted by Resolume", () => {
    const packet = encodeOscMessage("/composition/selectedclip/transport/position", [0.625]);
    expect(decodeOscPacket(packet)[0]?.args[0]).toBeCloseTo(0.625);
  });

  it("peeks message addresses without decoding their payload", () => {
    expect(peekOscAddress(encodeOscMessage("/composition/selectedclip/name", ["Demo"])))
      .toBe("/composition/selectedclip/name");
    expect(peekOscAddress(Buffer.from("#bundle\0"))).toBeUndefined();
  });
});
