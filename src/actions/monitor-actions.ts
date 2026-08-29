import streamDeck, {
  action,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent
} from "@elgato/streamdeck";
import { arena } from "../core/arena-service";
import { formatRemaining } from "../core/time";
import { resolveRule, type ActionSettings, type PlaybackState } from "../core/types";
import { renderMonitorSvg, stateColor, type MonitorView } from "../render/monitor-svg";

abstract class MonitorAction extends SingletonAction<ActionSettings> {
  protected abstract readonly view: MonitorView;
  private readonly lastRenderAt = new Map<string, number>();
  private readonly pendingRenders = new Map<string, NodeJS.Timeout>();

  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    await this.attach(ev.action.id, ev.payload.settings, ev.action);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ActionSettings>): Promise<void> {
    arena.unsubscribe(ev.action.id);
    await this.attach(ev.action.id, ev.payload.settings, ev.action);
  }

  override onWillDisappear(ev: WillDisappearEvent<ActionSettings>): void {
    arena.unsubscribe(ev.action.id);
    const pending = this.pendingRenders.get(ev.action.id);
    if (pending) clearTimeout(pending);
    this.pendingRenders.delete(ev.action.id);
    this.lastRenderAt.delete(ev.action.id);
  }

  override onKeyDown(ev: KeyDownEvent<ActionSettings>): void {
    arena.refresh(resolveRule(arena.settings, ev.payload.settings));
  }

  private async attach(id: string, settings: ActionSettings, actionInstance: WillAppearEvent<ActionSettings>["action"]): Promise<void> {
    const rule = resolveRule(arena.settings, settings);
    await arena.subscribe(id, rule, (state) => this.scheduleRender(id, actionInstance, state, settings));
  }

  private scheduleRender(id: string, actionInstance: WillAppearEvent<ActionSettings>["action"], state: PlaybackState, settings: ActionSettings): void {
    const elapsed = Date.now() - (this.lastRenderAt.get(id) ?? 0);
    const existing = this.pendingRenders.get(id);
    if (existing) clearTimeout(existing);
    const render = () => {
      this.pendingRenders.delete(id);
      this.lastRenderAt.set(id, Date.now());
      void this.render(actionInstance, state, settings).catch((error) => {
        streamDeck.logger.error(`Monitor render failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    };
    if (elapsed >= 60) render();
    else this.pendingRenders.set(id, setTimeout(render, 60 - elapsed));
  }

  private async render(actionInstance: WillAppearEvent<ActionSettings>["action"], state: PlaybackState, settings: ActionSettings): Promise<void> {
    if (actionInstance.isKey()) {
      const svg = renderMonitorSvg(this.view, state, arena.settings, { showClipName: settings.showClipName ?? true });
      await actionInstance.setImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
      // The title is a separate Stream Deck overlay. Clear it so it does not
      // cover the SVG's deliberately positioned name, time and progress text.
      await actionInstance.setTitle("");
      return;
    }
    const status = state.status === "ok" ? undefined : state.status.replaceAll("-", " ").toUpperCase();
    const value = status ?? (this.view === "name" ? state.clipName : formatRemaining(state.remainingSeconds, arena.settings));
    await actionInstance.setFeedback({
      title: this.view === "time" && settings.showClipName === false ? "Resolume" : state.clipName || "Resolume",
      value,
      indicator: { value: Math.round(state.position * 100), bar_fill_c: stateColor(state, arena.settings) }
    });
  }
}

@action({ UUID: "com.calebweixun.resolume-monitor.time-remaining" })
export class TimeRemainingAction extends MonitorAction { protected readonly view = "time" as const; }

@action({ UUID: "com.calebweixun.resolume-monitor.clip-name" })
export class ClipNameAction extends MonitorAction { protected readonly view = "name" as const; }

@action({ UUID: "com.calebweixun.resolume-monitor.clip-progress" })
export class ClipProgressAction extends MonitorAction { protected readonly view = "progress" as const; }
