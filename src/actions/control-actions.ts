import { action, type DidReceiveSettingsEvent, type KeyDownEvent, type KeyUpEvent, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { arena } from "../core/arena-service";
import { HoldRepeater } from "../core/hold-repeater";
import type { OscValue } from "../core/osc-codec";
import { resolveRule, type ActionSettings, type ClearSettings, type CustomOscSettings, type NudgeSettings, type OscArgument, type TriggerSettings } from "../core/types";

async function runWithFeedback(ev: KeyDownEvent, operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
    if (ev.action.isKey()) await ev.action.showOk();
  } catch {
    await ev.action.showAlert();
  }
}

abstract class TransportAction extends SingletonAction<ActionSettings> {
  protected abstract execute(rule: ReturnType<typeof resolveRule>): Promise<void>;
  override onKeyDown(ev: KeyDownEvent<ActionSettings>): Promise<void> {
    const rule = resolveRule(arena.settings, ev.payload.settings);
    return runWithFeedback(ev, () => this.execute(rule));
  }
}

@action({ UUID: "com.calebweixun.resolume-monitor.play" })
export class PlayPauseAction extends SingletonAction<ActionSettings> {
  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    await this.attach(ev);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ActionSettings>): Promise<void> {
    arena.unsubscribe(ev.action.id);
    await this.attach(ev);
  }

  override onWillDisappear(ev: WillDisappearEvent<ActionSettings>): void {
    arena.unsubscribe(ev.action.id);
  }

  override onKeyDown(ev: KeyDownEvent<ActionSettings>): Promise<void> {
    const rule = resolveRule(arena.settings, ev.payload.settings);
    return runWithFeedback(ev, () => arena.togglePlayPause(rule));
  }

  private async attach(ev: WillAppearEvent<ActionSettings> | DidReceiveSettingsEvent<ActionSettings>): Promise<void> {
    const rule = resolveRule(arena.settings, ev.payload.settings);
    await arena.subscribe(ev.action.id, rule, (state) => {
      if (ev.action.isKey()) void ev.action.setState(state.direction === "paused" ? 0 : 1);
    }, !ev.payload.settings.overrideMonitoring);
  }
}

@action({ UUID: "com.calebweixun.resolume-monitor.pause" })
export class PauseAction extends TransportAction { protected execute(rule: ReturnType<typeof resolveRule>) { return arena.pause(rule); } }

@action({ UUID: "com.calebweixun.resolume-monitor.restart" })
export class RestartAction extends TransportAction { protected execute(rule: ReturnType<typeof resolveRule>) { return arena.restart(rule); } }

@action({ UUID: "com.calebweixun.resolume-monitor.trigger" })
export class TriggerClipAction extends SingletonAction<TriggerSettings> {
  override onKeyDown(ev: KeyDownEvent<TriggerSettings>): Promise<void> {
    if ((ev.payload.settings.triggerMode ?? "selectedClip") === "selectedClip") {
      return runWithFeedback(ev, () => arena.triggerSelectedClip());
    }
    const layer = Number(ev.payload.settings.layer ?? 1);
    const clip = Number(ev.payload.settings.clip ?? 1);
    return runWithFeedback(ev, () => arena.trigger(layer, clip));
  }
}

abstract class CommonCommandAction extends SingletonAction {
  protected abstract execute(): Promise<void>;
  override onKeyDown(ev: KeyDownEvent): Promise<void> {
    return runWithFeedback(ev, () => this.execute());
  }
}

@action({ UUID: "com.calebweixun.resolume-monitor.clear-composition" })
export class ClearCompositionAction extends SingletonAction<ClearSettings> {
  override onKeyDown(ev: KeyDownEvent<ClearSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const operation = settings.clearTarget === "layer"
      ? () => arena.clearLayer(Number(settings.layer ?? 1))
      : () => arena.disconnectAll();
    return runWithFeedback(ev, operation);
  }
}

@action({ UUID: "com.calebweixun.resolume-monitor.previous-column" })
export class PreviousColumnAction extends CommonCommandAction { protected execute() { return arena.connectPreviousColumn(); } }

@action({ UUID: "com.calebweixun.resolume-monitor.next-column" })
export class NextColumnAction extends CommonCommandAction { protected execute() { return arena.connectNextColumn(); } }

abstract class NudgeAction extends SingletonAction<NudgeSettings> {
  protected abstract readonly parameter: "speed" | "volume";
  protected abstract readonly direction: "+" | "-";
  private readonly repeaters = new Map<string, HoldRepeater>();

  override onKeyDown(ev: KeyDownEvent<NudgeSettings>): void {
    const id = ev.action.id;
    this.stopRepeating(id);
    const configuredDelay = Number(ev.payload.settings.holdDelayMs ?? 400);
    const configuredInterval = Number(ev.payload.settings.repeatIntervalMs ?? 120);
    const delay = Number.isFinite(configuredDelay) ? Math.max(100, Math.min(2000, configuredDelay)) : 400;
    const interval = Number.isFinite(configuredInterval) ? Math.max(50, Math.min(1000, configuredInterval)) : 120;
    let first = true;
    const repeater = new HoldRepeater();
    this.repeaters.set(id, repeater);
    repeater.start(async () => {
      const showSuccess = first;
      first = false;
      await this.performNudge(ev, showSuccess);
    }, delay, interval);
  }

  override onKeyUp(ev: KeyUpEvent<NudgeSettings>): void {
    this.stopRepeating(ev.action.id);
  }

  override onWillDisappear(ev: WillDisappearEvent<NudgeSettings>): void {
    this.stopRepeating(ev.action.id);
  }

  private async performNudge(ev: KeyDownEvent<NudgeSettings>, showSuccess: boolean): Promise<void> {
    const configured = Number(ev.payload.settings.step ?? 0.05);
    const step = Number.isFinite(configured) && configured > 0 ? configured : 0.05;
    try {
      await arena.nudgeSelectedClip(this.parameter, this.direction, step);
      if (showSuccess && ev.action.isKey()) await ev.action.showOk();
    } catch {
      await ev.action.showAlert();
    }
  }

  private stopRepeating(id: string): void {
    this.repeaters.get(id)?.stop();
    this.repeaters.delete(id);
  }
}

@action({ UUID: "com.calebweixun.resolume-monitor.speed-increase" })
export class SpeedIncreaseAction extends NudgeAction { protected readonly parameter = "speed"; protected readonly direction = "+"; }

@action({ UUID: "com.calebweixun.resolume-monitor.speed-decrease" })
export class SpeedDecreaseAction extends NudgeAction { protected readonly parameter = "speed"; protected readonly direction = "-"; }

@action({ UUID: "com.calebweixun.resolume-monitor.volume-increase" })
export class VolumeIncreaseAction extends NudgeAction { protected readonly parameter = "volume"; protected readonly direction = "+"; }

@action({ UUID: "com.calebweixun.resolume-monitor.volume-decrease" })
export class VolumeDecreaseAction extends NudgeAction { protected readonly parameter = "volume"; protected readonly direction = "-"; }

function parseArguments(json: string | undefined): OscValue[] {
  if (!json?.trim()) return [];
  const values = JSON.parse(json) as OscArgument[];
  if (!Array.isArray(values)) throw new Error("OSC arguments must be an array");
  return values.map(({ type, value }) => {
    if (type === "boolean") return value === true || value === "true";
    if (type === "string") return String(value);
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Invalid ${type} argument`);
    return type === "int" ? Math.trunc(number) : number;
  });
}

@action({ UUID: "com.calebweixun.resolume-monitor.custom-osc" })
export class CustomOscAction extends SingletonAction<CustomOscSettings> {
  override onKeyDown(ev: KeyDownEvent<CustomOscSettings>): Promise<void> {
    const address = ev.payload.settings.pressAddress ?? "/composition/bypassed";
    return runWithFeedback(ev, () => arena.send(address, parseArguments(ev.payload.settings.pressArguments)));
  }

  override async onKeyUp(ev: KeyUpEvent<CustomOscSettings>): Promise<void> {
    const settings = ev.payload.settings;
    if (!settings.releaseEnabled || !settings.releaseAddress) return;
    try {
      await arena.send(settings.releaseAddress, parseArguments(settings.releaseArguments));
    } catch {
      await ev.action.showAlert();
    }
  }
}
