import streamDeck from "@elgato/streamdeck";
import { ClipNameAction, ClipProgressAction, TimeRemainingAction } from "./actions/monitor-actions";
import { ClearCompositionAction, CustomOscAction, NextColumnAction, PlayPauseAction, PreviousColumnAction, RestartAction, SpeedDecreaseAction, SpeedIncreaseAction, TriggerClipAction, VolumeDecreaseAction, VolumeIncreaseAction } from "./actions/control-actions";
import { arena } from "./core/arena-service";
import type { GlobalSettings } from "./core/types";

// Keep production logging at errors only; high-volume OSC paths do not log.
streamDeck.logger.setLevel("error");

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((event) => {
  void arena.configure(event.settings);
});

streamDeck.actions.registerAction(new TimeRemainingAction());
streamDeck.actions.registerAction(new ClipNameAction());
streamDeck.actions.registerAction(new ClipProgressAction());
streamDeck.actions.registerAction(new PlayPauseAction());
streamDeck.actions.registerAction(new RestartAction());
streamDeck.actions.registerAction(new TriggerClipAction());
streamDeck.actions.registerAction(new ClearCompositionAction());
streamDeck.actions.registerAction(new PreviousColumnAction());
streamDeck.actions.registerAction(new NextColumnAction());
streamDeck.actions.registerAction(new SpeedIncreaseAction());
streamDeck.actions.registerAction(new SpeedDecreaseAction());
streamDeck.actions.registerAction(new VolumeIncreaseAction());
streamDeck.actions.registerAction(new VolumeDecreaseAction());
streamDeck.actions.registerAction(new CustomOscAction());

await streamDeck.connect();
await arena.configure(await streamDeck.settings.getGlobalSettings<GlobalSettings>());
