import dgram from "node:dgram";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ArenaService } from "../src/core/arena-service";
import { decodeOscPacket, encodeOscMessage } from "../src/core/osc-codec";
import type { PlaybackState } from "../src/core/types";

const sockets: dgram.Socket[] = [];
const services: ArenaService[] = [];

async function bindRandom(socket: dgram.Socket): Promise<number> {
  await new Promise<void>((resolve) => { socket.bind(0, "127.0.0.1", resolve); });
  return (socket.address() as AddressInfo).port;
}

async function availablePort(): Promise<number> {
  const socket = dgram.createSocket("udp4");
  const port = await bindRandom(socket);
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return port;
}

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.shutdown()));
  await Promise.all(sockets.splice(0).map((socket) => new Promise<void>((resolve) => socket.close(() => resolve()))));
});

describe("ArenaService UDP integration", () => {
  it("reads current values before adjusting selected-clip parameters", async () => {
    const simulator = dgram.createSocket("udp4");
    sockets.push(simulator);
    const arenaPort = await bindRandom(simulator);
    const replyPort = await availablePort();
    const received: ReturnType<typeof decodeOscPacket> = [];
    let speed = 0.6;
    let volume = 0.5;
    let finish: (() => void) | undefined;
    const allMessages = new Promise<void>((resolve) => { finish = resolve; });
    simulator.on("message", (packet, remote) => {
      const messages = decodeOscPacket(packet);
      received.push(...messages);
      for (const message of messages) {
        const isSpeed = message.address.endsWith("/speed");
        if (message.args[0] === "?") {
          simulator.send(encodeOscMessage(message.address, [isSpeed ? speed : volume]), remote.port, remote.address);
        } else if (typeof message.args[0] === "number") {
          if (isSpeed) speed = message.args[0];
          else if (message.address.endsWith("/volume")) volume = message.args[0];
        }
      }
      if (received.length === 9) finish?.();
    });

    const service = new ArenaService();
    services.push(service);
    await service.configure({ host: "127.0.0.1", arenaPort, replyPort });
    await service.disconnectAll();
    await service.connectPreviousColumn();
    await service.connectNextColumn();
    await Promise.all([
      service.nudgeSelectedClip("speed", "+", 0.05),
      service.nudgeSelectedClip("speed", "+", 0.05)
    ]);
    await service.nudgeSelectedClip("volume", "-", 0.1);
    await allMessages;

    expect(received.map(({ address }) => address)).toEqual([
      "/composition/disconnectall",
      "/composition/connectprevcolumn",
      "/composition/connectnextcolumn",
      "/composition/selectedclip/transport/position/behaviour/speed",
      "/composition/selectedclip/transport/position/behaviour/speed",
      "/composition/selectedclip/transport/position/behaviour/speed",
      "/composition/selectedclip/transport/position/behaviour/speed",
      "/composition/selectedclip/audio/volume",
      "/composition/selectedclip/audio/volume"
    ]);
    expect(received[3].args).toEqual(["?"]);
    expect(received[4].args[0]).toBeCloseTo(0.65, 5);
    expect(received[5].args).toEqual(["?"]);
    expect(received[6].args[0]).toBeCloseTo(0.7, 5);
    expect(received[7].args).toEqual(["?"]);
    expect(received[8].args[0]).toBeCloseTo(0.4, 5);
  });

  it("polls a clip and turns replies into playback state", async () => {
    const simulator = dgram.createSocket("udp4");
    sockets.push(simulator);
    const arenaPort = await bindRandom(simulator);
    const replyPort = await availablePort();
    const path = "/composition/layers/1/clips/2";

    simulator.on("message", (packet, remote) => {
      for (const message of decodeOscPacket(packet)) {
        let reply: Buffer | undefined;
        if (message.address.endsWith("/name")) reply = encodeOscMessage(message.address, ["Demo Clip"]);
        else if (message.address.endsWith("/duration")) reply = encodeOscMessage(message.address, [100.0]);
        else if (message.address.endsWith("/playdirection")) reply = encodeOscMessage(message.address, [2]);
        else if (message.address.endsWith("/position")) reply = encodeOscMessage(message.address, [0.25]);
        if (reply) simulator.send(reply, remote.port, remote.address);
      }
    });

    const service = new ArenaService();
    services.push(service);
    await service.configure({ host: "127.0.0.1", arenaPort, replyPort });

    const state = await new Promise<PlaybackState>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for simulated Arena state")), 2000);
      void service.subscribe("test", { mode: "specificClip", layer: 1, clip: 2 }, (next) => {
        if (next.clipName === "Demo Clip" && next.durationSeconds === 100 && next.position === 0.25) {
          clearTimeout(timeout);
          resolve(next);
        }
      });
    });

    expect(service.activePath({ mode: "specificClip", layer: 1, clip: 2 })).toBe(path);
    expect(state.status).toBe("ok");
    expect(state.remainingSeconds).toBe(75);
  });
});
