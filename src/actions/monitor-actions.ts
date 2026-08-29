import {
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

type MonitorActionInstance = WillAppearEvent<ActionSettings>["action"];
type PendingRender = { actionInstance: MonitorActionInstance; state: PlaybackState; settings: ActionSettings };

abstract class MonitorAction extends SingletonAction<ActionSettings> {
  protected abstract readonly view: MonitorView;
  private readonly lastRenderAt = new Map<string, number>();
  private readonly pendingRenders = new Map<string, NodeJS.Timeout>();
  private readonly latestRenders = new Map<string, PendingRender>();
  private readonly renderInFlight = new Set<string>();

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
    this.latestRenders.delete(ev.action.id);
    this.lastRenderAt.delete(ev.action.id);
  }

  override onKeyDown(ev: KeyDownEvent<ActionSettings>): void {
    arena.refresh(resolveRule(arena.settings, ev.payload.settings));
  }

  private async attach(id: string, settings: ActionSettings, actionInstance: MonitorActionInstance): Promise<void> {
    const rule = resolveRule(arena.settings, settings);
    // The title never changes; clearing it once avoids a second SDK command on
    // every progress frame.
    if (actionInstance.isKey()) await actionInstance.setTitle("");
    await arena.subscribe(
      id,
      rule,
      (state) => this.scheduleRender(id, actionInstance, state, settings),
      !settings.overrideMonitoring
    );
  }

  private scheduleRender(id: string, actionInstance: MonitorActionInstance, state: PlaybackState, settings: ActionSettings): void {
    this.latestRenders.set(id, { actionInstance, state, settings });
    if (this.renderInFlight.has(id)) return;
    const elapsed = Date.now() - (this.lastRenderAt.get(id) ?? 0);
    const existing = this.pendingRenders.get(id);
    if (existing) clearTimeout(existing);
    const render = () => {
      this.pendingRenders.delete(id);
      const latest = this.latestRenders.get(id);
      if (!latest) return;
      this.latestRenders.delete(id);
      this.lastRenderAt.set(id, Date.now());
      this.renderInFlight.add(id);
      void this.render(latest.actionInstance, latest.state, latest.settings)
        .catch(() => undefined)
        .finally(() => {
          this.renderInFlight.delete(id);
          const queued = this.latestRenders.get(id);
          if (queued) this.scheduleRender(id, queued.actionInstance, queued.state, queued.settings);
        });
    };
    if (elapsed >= 60) render();
    else this.pendingRenders.set(id, setTimeout(render, 60 - elapsed));
  }

  private async render(actionInstance: MonitorActionInstance, state: PlaybackState, settings: ActionSettings): Promise<void> {
    if (actionInstance.isKey()) {
      const svg = renderMonitorSvg(this.view, state, arena.settings, { showClipName: settings.showClipName ?? true });
      await actionInstance.setImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
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
