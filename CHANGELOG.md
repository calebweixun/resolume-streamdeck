# Changelog

All notable changes to Resolume Monitor are documented here.

## v0.2.2 — 2026-08-29

- Fixed Layer 1–9 monitoring being incorrectly cleared by similarly prefixed clip numbers such as 10–19.
- Fixed shared monitoring actions using the default layer when Stream Deck started before global settings finished loading.
- Automatically migrated active subscribers when the saved global monitoring rule became available.
- Reduced false No Signal flashes during short gaps between relevant OSC replies.
- Unified clip-state displays into Clip Monitor with circle, bar, and square countdown styles.

## v0.2.1 — 2026-08-29

- Reduced command latency under high-volume OSC output by filtering unrelated messages before payload decoding.
- Deduplicated monitoring-rule processing and coalesced state publishing per OSC packet.
- Prevented Stream Deck image-update backlogs by keeping only the latest pending frame.
- Removed logging from OSC and rendering hot paths.

## v0.2.0 — 2026-08-29

- Added configurable clearing for the entire composition or a specific layer.
- Improved playback progress smoothness with faster sampling and OSC jitter filtering.

## v0.1.0 — 2026-08-08

Initial public release.

- Added circular Remaining Time, large wrapped Clip Name, and Clip Progress Monitor Actions.
- Added selected, specific-clip, selected-layer, and specific-layer monitoring.
- Added Play/Pause toggle, Restart, selected-preview and direct Clip Trigger controls.
- Added Clear Composition and Previous/Next Column controls.
- Added selected-clip Speed and Volume adjustments with read-before-write increments.
- Added configurable hold-to-repeat for Speed and Volume.
- Added Custom OSC press and release messages with typed arguments.
- Added English and Traditional Chinese interfaces.
