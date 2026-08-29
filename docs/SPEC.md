# Resolume Monitor — Current Product Specification

Status: **v0.1.0 release candidate**

## Identity and platform

- Product: **Resolume Monitor**
- Plugin UUID: `com.calebweixun.resolume-monitor`
- Manifest version: `0.1.0.0`
- Release tag: `v0.1.0`
- Stream Deck 7.1+, macOS 13+, Windows 10+
- Node.js 24 for development and plugin runtime
- Resolume Arena and Avenue with OSC enabled

The plugin is independent and does not require the Resolume Timecode Monitor desktop application or another companion process.

## Connection model

One global Arena Connection is shared by all actions. Defaults are:

- Host: `127.0.0.1`
- Arena input port: `7000`
- Plugin reply port: `7001`

The plugin opens its reply listener while monitoring or while a read-before-write control is active. A reply-port collision is presented as `PORT IN USE`; it is never silently moved to another port.

No telemetry, cloud service, or automatic update check is used.

## Monitoring

Monitoring Rules support:

- Selected clip
- Specific clip
- Selected layer
- Specific layer, following the connected clip

A shared Monitoring Rule is configurable globally. Monitor and Clip Transport Actions may override it individually.

Transport position is queried approximately every 60 ms and metadata approximately once per second. Resolume duration values are decoded from their seven-day normalized range. If duration metadata is absent, normalized-position timing provides a fallback estimate.

Monitor Actions render no faster than approximately 16 frames per second.

## Monitor Actions

### Clip Monitor

- Circle, bar, and square countdown styles represent the remaining fraction.
- Numeric Remaining Time is shown in every style.
- Clip name may be shown or hidden per action.
- Hours, milliseconds, and the `T−` sign are configurable.

Pressing Clip Monitor forces an immediate refresh without changing playback. Legacy Clip Name and Clip Progress UUIDs remain hidden for existing profiles.

## Status and alert presentation

- `CONNECTING`: waiting for the first valid reply.
- `NO SIGNAL`: no trustworthy recent playback state.
- `NO CLIP`: the Monitoring Rule has no connected clip.
- `PORT IN USE`: the configured reply port could not be bound.

Default alert thresholds are yellow below 30 seconds and red below 10 seconds. Thresholds use calculated Remaining Time and account for playback direction.

## Control Actions

### Clip transport

- **Play / Pause Clip** toggles according to current play direction and changes its key image accordingly.
- **Restart Clip** returns the monitored clip to its direction-appropriate starting edge.
- **Trigger Clip** targets the selected preview clip by default or an explicitly configured Layer and Clip.

### Composition

- Clear Composition: `/composition/disconnectall`
- Previous Column: `/composition/connectprevcolumn`
- Next Column: `/composition/connectnextcolumn`

### Selected-clip adjustment

- Speed: `/composition/selectedclip/transport/position/behaviour/speed`
- Volume: `/composition/selectedclip/audio/volume`

Each adjustment queries the current normalized value, applies the configured positive or negative step, clamps the result to `0–1`, and sends the new absolute value. Operations are serialized to preserve rapid presses.

Short press adjusts once. Holding starts after a configurable delay (default 400 ms) and repeats at a configurable interval (default 120 ms). A slow Arena reply prevents overlapping operations rather than creating an unbounded queue.

### Custom OSC

Custom OSC supports ordered integer, float, string, and boolean arguments. A Press Message is required and a Release Message is optional.

## Device behavior

- Key-based devices render dynamic SVG images on LCD keys.
- Stream Deck+ uses supported encoder/touch-strip feedback layouts for Monitor Actions.
- Stream Deck Neo's hardware Info Bar is not writable by third-party Plugin SDK actions.

## Localization

Manifest metadata, action names, statuses, and the Property Inspector support English and Traditional Chinese.

## Verification

Release validation requires:

1. Unit tests for OSC encoding, Remaining Time, duration decoding, display rendering, and hold repetition.
2. UDP integration tests for queries, replies, read-before-write adjustments, and outgoing controls.
3. TypeScript checking with no emitted files.
4. Production Rollup build.
5. Stream Deck CLI manifest validation.
6. Successful `.streamDeckPlugin` packaging.

Physical Stream Deck and Resolume field testing remains the final source of truth for OSC behavior across Resolume versions.

## References

- [Resolume Timecode Monitor](https://github.com/calebweixun/resolume-timecode)
- [Resolume OSC documentation](https://www.resolume.com/support/en/osc)
- [Stream Deck SDK actions](https://docs.elgato.com/streamdeck/sdk/guides/actions/)
- [Stream Deck SDK dials](https://docs.elgato.com/streamdeck/sdk/guides/dials/)
