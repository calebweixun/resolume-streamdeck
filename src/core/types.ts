type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };

export type MonitorMode = "selectedClip" | "specificClip" | "selectedLayer" | "specificLayer";

export type MonitoringRule = {
  mode: MonitorMode;
  layer: number;
  clip: number;
};

export type GlobalSettings = JsonObject & {
  host?: string;
  arenaPort?: number;
  replyPort?: number;
  monitorMode?: MonitorMode;
  layer?: number;
  clip?: number;
  warningSeconds?: number;
  criticalSeconds?: number;
  showHours?: boolean;
  showMilliseconds?: boolean;
  showSign?: boolean;
};

export const DEFAULT_GLOBAL_SETTINGS: Required<Omit<GlobalSettings, keyof JsonObject>> & GlobalSettings = {
  host: "127.0.0.1",
  arenaPort: 7000,
  replyPort: 7001,
  monitorMode: "specificLayer",
  layer: 1,
  clip: 1,
  warningSeconds: 30,
  criticalSeconds: 10,
  showHours: false,
  showMilliseconds: false,
  showSign: true
};

export type ActionSettings = JsonObject & {
  overrideMonitoring?: boolean;
  monitorMode?: MonitorMode;
  layer?: number;
  clip?: number;
  showClipName?: boolean;
};

export type TriggerSettings = ActionSettings & {
  triggerMode?: "selectedClip" | "specificClip";
  layer?: number;
  clip?: number;
};

export type NudgeSettings = JsonObject & {
  step?: number;
  holdDelayMs?: number;
  repeatIntervalMs?: number;
};

export type OscArgumentType = "int" | "float" | "string" | "boolean";
export type OscArgument = { type: OscArgumentType; value: JsonValue };

export type CustomOscSettings = JsonObject & {
  pressAddress?: string;
  pressArguments?: string;
  releaseEnabled?: boolean;
  releaseAddress?: string;
  releaseArguments?: string;
};

export type SignalStatus = "connecting" | "ok" | "no-clip" | "no-signal" | "port-in-use";

export type PlaybackState = {
  status: SignalStatus;
  clipName: string;
  durationSeconds: number;
  position: number;
  direction: "reverse" | "paused" | "forward" | "random";
  remainingSeconds: number;
  activePath: string;
  lastReplyAt: number;
  error?: string;
};

export type ResolvedSettings = {
  host: string;
  arenaPort: number;
  replyPort: number;
  monitorRule: MonitoringRule;
  warningSeconds: number;
  criticalSeconds: number;
  showHours: boolean;
  showMilliseconds: boolean;
  showSign: boolean;
};

export function resolveGlobalSettings(settings: GlobalSettings): ResolvedSettings {
  const merged = { ...DEFAULT_GLOBAL_SETTINGS, ...settings };
  return {
    host: String(merged.host),
    arenaPort: Number(merged.arenaPort),
    replyPort: Number(merged.replyPort),
    monitorRule: {
      mode: merged.monitorMode as MonitorMode,
      layer: Number(merged.layer),
      clip: Number(merged.clip)
    },
    warningSeconds: Number(merged.warningSeconds),
    criticalSeconds: Number(merged.criticalSeconds),
    showHours: Boolean(merged.showHours),
    showMilliseconds: Boolean(merged.showMilliseconds),
    showSign: Boolean(merged.showSign)
  };
}

export function resolveRule(global: ResolvedSettings, action: ActionSettings = {}): MonitoringRule {
  if (!action.overrideMonitoring) return global.monitorRule;
  return {
    mode: action.monitorMode ?? global.monitorRule.mode,
    layer: Number(action.layer ?? global.monitorRule.layer),
    clip: Number(action.clip ?? global.monitorRule.clip)
  };
}

export function ruleKey(rule: MonitoringRule): string {
  return `${rule.mode}:${rule.layer}:${rule.clip}`;
}

export function basePathForRule(rule: MonitoringRule): string {
  switch (rule.mode) {
    case "selectedClip": return "/composition/selectedclip";
    case "specificClip": return `/composition/layers/${rule.layer}/clips/${rule.clip}`;
    case "selectedLayer": return "/composition/selectedlayer";
    case "specificLayer": return `/composition/layers/${rule.layer}`;
  }
}

export function isLayerRule(rule: MonitoringRule): boolean {
  return rule.mode === "selectedLayer" || rule.mode === "specificLayer";
}
