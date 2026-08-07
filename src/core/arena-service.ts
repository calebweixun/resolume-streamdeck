import dgram from "node:dgram";
import streamDeck from "@elgato/streamdeck";
import { DurationEstimator } from "./duration-estimator";
import { decodeOscPacket, encodeOscMessage, type OscMessage, type OscValue } from "./osc-codec";
import { calculateRemaining, decodeDurationSeconds } from "./time";
import {
  basePathForRule,
  isLayerRule,
  resolveGlobalSettings,
  ruleKey,
  type GlobalSettings,
  type MonitoringRule,
  type PlaybackState,
  type ResolvedSettings
} from "./types";

type Subscriber = { rule: MonitoringRule; update: (state: PlaybackState) => void };
type PendingNumberQuery = { resolve: (value: number) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout };

const emptyState = (): PlaybackState => ({
  status: "connecting",
  clipName: "",
  durationSeconds: 0,
  position: 0,
  direction: "forward",
  remainingSeconds: 0,
  activePath: "",
  lastReplyAt: Date.now()
});

export class ArenaService {
  private config: ResolvedSettings = resolveGlobalSettings({});
  private socket?: dgram.Socket;
  private pollTimer?: NodeJS.Timeout;
  private staleTimer?: NodeJS.Timeout;
  private metadataTick = 0;
  private subscribers = new Map<string, Subscriber>();
  private states = new Map<string, PlaybackState>();
  private lastDirections = new Map<string, PlaybackState["direction"]>();
  private durationEstimator = new DurationEstimator();
  private explicitDurations = new Set<string>();
  private pendingNumberQueries = new Map<string, PendingNumberQuery>();
  private nudgeQueues = new Map<string, Promise<void>>();
  private hasLoggedFirstReply = false;

  async configure(settings: GlobalSettings): Promise<void> {
    const next = resolveGlobalSettings(settings);
    const needsRebind = next.replyPort !== this.config.replyPort;
    this.config = next;
    if (needsRebind && this.socket) await this.stopSocket();
    if (this.subscribers.size > 0) await this.ensureRunning();
  }

  get settings(): ResolvedSettings {
    return this.config;
  }

  async subscribe(id: string, rule: MonitoringRule, update: (state: PlaybackState) => void): Promise<void> {
    this.subscribers.set(id, { rule, update });
    const key = ruleKey(rule);
    const state = this.states.get(key) ?? emptyState();
    this.states.set(key, state);
    update(state);
    await this.ensureRunning();
    this.refresh(rule);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
    if (this.subscribers.size === 0) void this.stopSocket();
  }

  async shutdown(): Promise<void> {
    this.subscribers.clear();
    await this.stopSocket();
  }

  refresh(rule: MonitoringRule): void {
    const key = ruleKey(rule);
    const state = this.states.get(key) ?? emptyState();
    state.status = "connecting";
    this.states.set(key, state);
    this.queryRule(rule, true);
    this.publish(key);
  }

  send(address: string, args: OscValue[] = []): Promise<void> {
    const packet = encodeOscMessage(address, args);
    return new Promise((resolve, reject) => {
      const socket = this.socket ?? dgram.createSocket("udp4");
      socket.send(packet, this.config.arenaPort, this.config.host, (error) => {
        if (!this.socket) socket.close();
        if (error) reject(error); else resolve();
      });
    });
  }

  activePath(rule: MonitoringRule): string {
    const state = this.states.get(ruleKey(rule));
    if (state?.activePath) return state.activePath;
    const base = basePathForRule(rule);
    return isLayerRule(rule) ? `${base}/clips/playing` : base;
  }

  async play(rule: MonitoringRule): Promise<void> {
    const path = this.activePath(rule);
    const remembered = this.lastDirections.get(ruleKey(rule));
    const value = remembered === "reverse" ? 0 : 2;
    await this.send(`${path}/transport/position/behaviour/playdirection`, [value]);
  }

  async pause(rule: MonitoringRule): Promise<void> {
    const key = ruleKey(rule);
    const state = this.states.get(key);
    if (state && state.direction !== "paused" && state.direction !== "random") this.lastDirections.set(key, state.direction);
    await this.send(`${this.activePath(rule)}/transport/position/behaviour/playdirection`, [1]);
  }

  async togglePlayPause(rule: MonitoringRule): Promise<void> {
    const state = this.states.get(ruleKey(rule));
    if (state?.direction === "paused") await this.play(rule);
    else await this.pause(rule);
  }

  async restart(rule: MonitoringRule): Promise<void> {
    const direction = this.lastDirections.get(ruleKey(rule)) ?? this.states.get(ruleKey(rule))?.direction;
    await this.send(`${this.activePath(rule)}/transport/position`, [direction === "reverse" ? 1 : 0]);
  }

  async trigger(layer: number, clip: number): Promise<void> {
    await this.send(`/composition/layers/${layer}/clips/${clip}/connect`, [1]);
  }

  async triggerSelectedClip(): Promise<void> {
    await this.send("/composition/selectedclip/connect", [1]);
  }

  async disconnectAll(): Promise<void> {
    await this.send("/composition/disconnectall", [1]);
  }

  async connectPreviousColumn(): Promise<void> {
    await this.send("/composition/connectprevcolumn", [1]);
  }

  async connectNextColumn(): Promise<void> {
    await this.send("/composition/connectnextcolumn", [1]);
  }

  async nudgeSelectedClip(parameter: "speed" | "volume", direction: "+" | "-", step: number): Promise<void> {
    const address = parameter === "speed"
      ? "/composition/selectedclip/transport/position/behaviour/speed"
      : "/composition/selectedclip/audio/volume";
    const previous = this.nudgeQueues.get(address) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await this.queryNumber(address);
      const delta = direction === "+" ? step : -step;
      const next = Math.max(0, Math.min(1, current + delta));
      await this.send(address, [next]);
    });
    this.nudgeQueues.set(address, operation);
    try {
      await operation;
    } finally {
      if (this.nudgeQueues.get(address) === operation) this.nudgeQueues.delete(address);
    }
  }

  private async queryNumber(address: string): Promise<number> {
    const startedForQuery = !this.socket;
    await this.ensureRunning();
    if (!this.socket) throw new Error("OSC reply listener is unavailable");

    try {
      return await new Promise<number>((resolve, reject) => {
        const existing = this.pendingNumberQueries.get(address);
        if (existing) {
          clearTimeout(existing.timeout);
          existing.reject(new Error(`Superseded OSC query: ${address}`));
        }
        const timeout = setTimeout(() => {
          this.pendingNumberQueries.delete(address);
          reject(new Error(`Timed out reading OSC value: ${address}`));
        }, 1000);
        this.pendingNumberQueries.set(address, { resolve, reject, timeout });
        void this.send(address, ["?"]).catch((error) => {
          clearTimeout(timeout);
          this.pendingNumberQueries.delete(address);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });
    } finally {
      if (startedForQuery && this.subscribers.size === 0) await this.stopSocket();
    }
  }

  private async ensureRunning(): Promise<void> {
    if (this.socket) return;
    const socket = dgram.createSocket("udp4");
    this.socket = socket;
    socket.on("message", (packet) => this.handlePacket(packet));
    socket.on("error", (error) => {
      streamDeck.logger.error(`OSC listener error: ${error.message}`);
      this.markAll("port-in-use", error.message);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("listening", resolve);
        socket.once("error", reject);
        socket.bind(this.config.replyPort);
      });
    } catch (error) {
      this.socket = undefined;
      try { socket.close(); } catch { /* already closed */ }
      this.markAll("port-in-use", error instanceof Error ? error.message : String(error));
      return;
    }
    this.pollTimer = setInterval(() => this.poll(), 110);
    this.staleTimer = setInterval(() => this.updateStaleStates(), 250);
  }

  private async stopSocket(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.pollTimer = undefined;
    this.staleTimer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    if (socket) await new Promise<void>((resolve) => socket.close(() => resolve()));
  }

  private poll(): void {
    const rules = new Map<string, MonitoringRule>();
    for (const { rule } of this.subscribers.values()) rules.set(ruleKey(rule), rule);
    this.metadataTick = (this.metadataTick + 1) % 9;
    for (const rule of rules.values()) this.queryRule(rule, this.metadataTick === 0);
  }

  private queryRule(rule: MonitoringRule, metadata: boolean): void {
    const path = this.activePath(rule);
    void this.send(`${path}/transport/position`, ["?"]).catch((error) => this.logSendError(error));
    if (!metadata) return;
    void this.send(`${path}/name`, ["?"]).catch((error) => this.logSendError(error));
    void this.send(`${path}/transport/position/behaviour/duration`, ["?"]).catch((error) => this.logSendError(error));
    void this.send(`${path}/transport/position/behaviour/playdirection`, ["?"]).catch((error) => this.logSendError(error));
    if (isLayerRule(rule)) {
      void this.send(`${basePathForRule(rule)}/clips/*/connected`, ["?"]).catch((error) => this.logSendError(error));
    }
  }

  private logSendError(error: unknown): void {
    streamDeck.logger.warn(`OSC send failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  private handlePacket(packet: Buffer): void {
    try {
      for (const message of decodeOscPacket(packet)) {
        const pending = this.pendingNumberQueries.get(message.address);
        const queriedValue = message.args[0];
        if (pending && typeof queriedValue === "number") {
          clearTimeout(pending.timeout);
          this.pendingNumberQueries.delete(message.address);
          pending.resolve(queriedValue);
        }
        if (!this.hasLoggedFirstReply) {
          this.hasLoggedFirstReply = true;
          streamDeck.logger.info(`OSC replies active; first address: ${message.address}`);
        }
        this.handleMessage(message);
      }
    } catch (error) {
      streamDeck.logger.warn(`Ignored invalid OSC packet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleMessage(message: OscMessage): void {
    const now = Date.now();
    for (const subscriber of this.subscribers.values()) {
      const key = ruleKey(subscriber.rule);
      const base = basePathForRule(subscriber.rule);
      const state = this.states.get(key) ?? emptyState();

      if (isLayerRule(subscriber.rule) && message.address.startsWith(`${base}/clips/`) && message.address.endsWith("/connected")) {
        const code = Number(message.args[0]);
        if (code === 3 || code === 4 || message.args[0] === true) {
          const activePath = message.address.slice(0, -"/connected".length);
          if (state.activePath !== activePath) {
            state.activePath = activePath;
            state.clipName = "";
            state.durationSeconds = 0;
            state.position = 0;
            this.durationEstimator.reset(key);
            this.explicitDurations.delete(key);
          }
          state.status = "ok";
          state.lastReplyAt = now;
        } else if (!state.activePath || message.address.startsWith(state.activePath)) {
          state.activePath = "";
          state.status = "no-clip";
          state.lastReplyAt = now;
          this.states.set(key, state);
          this.publish(key);
        }
      }

      const expected = state.activePath || (isLayerRule(subscriber.rule) ? `${base}/clips/playing` : base);
      if (!message.address.startsWith(expected)) continue;

      const first = message.args[0];
      state.lastReplyAt = now;
      state.status = "ok";
      if (message.address.endsWith("/name") && typeof first === "string") {
        if (state.clipName && state.clipName !== first) {
          state.durationSeconds = 0;
          this.durationEstimator.reset(key);
          this.explicitDurations.delete(key);
        }
        state.clipName = first;
      }
      else if (message.address.endsWith("/duration") && typeof first === "number" && first > 0) {
        state.durationSeconds = decodeDurationSeconds(first);
        this.explicitDurations.add(key);
      }
      else if (message.address.endsWith("/position") && typeof first === "number") {
        state.position = first;
        if (!this.explicitDurations.has(key)) {
          const estimate = this.durationEstimator.sample(key, first, now);
          if (estimate !== undefined) state.durationSeconds = estimate;
        }
      }
      else if ((message.address.endsWith("/playdirection") || message.address.endsWith("/direction")) && typeof first === "number") {
        state.direction = first === 0 ? "reverse" : first === 1 ? "paused" : first === 3 ? "random" : "forward";
        if (state.direction !== "paused" && state.direction !== "random") this.lastDirections.set(key, state.direction);
      }
      state.remainingSeconds = calculateRemaining(state.durationSeconds, state.position, state.direction);
      this.states.set(key, state);
      this.publish(key);
    }
  }

  private updateStaleStates(): void {
    const now = Date.now();
    for (const [key, state] of this.states) {
      const age = now - state.lastReplyAt;
      const next = age >= 2000 ? "no-signal" : state.status;
      if (next !== state.status && state.status !== "port-in-use") {
        state.status = next;
        this.publish(key);
      }
    }
  }

  private markAll(status: PlaybackState["status"], error?: string): void {
    for (const [key, state] of this.states) {
      state.status = status;
      state.error = error;
      this.publish(key);
    }
  }

  private publish(key: string): void {
    const state = this.states.get(key);
    if (!state) return;
    for (const subscriber of this.subscribers.values()) {
      if (ruleKey(subscriber.rule) === key) subscriber.update({ ...state });
    }
  }
}

export const arena = new ArenaService();
