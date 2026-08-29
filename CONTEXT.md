# Resolume Monitor Domain Language

Use these terms consistently in product copy, documentation, and code discussions.

- **Resolume Monitor** — the Stream Deck plugin product.
- **Arena Connection** — the shared OSC host, Arena input port, and plugin reply port.
- **Monitoring Rule** — selected/specific clip or layer rule used to identify playback state.
- **Monitored Clip** — the clip resolved by a Monitoring Rule.
- **Clip Monitor** — the unified live Remaining Time action with circle, bar, and square countdown styles.
- **Remaining Time** — calculated time from the current position to the direction-appropriate playback endpoint.
- **Signal Status** — trust state of incoming playback information: Connecting, No Signal, No Clip, or Port In Use.
- **Warning Threshold** — Remaining Time at which presentation becomes yellow.
- **Critical Threshold** — Remaining Time at which presentation becomes red.
- **Control Action** — an action that sends a product-defined Arena command.
- **Clip Transport Action** — Play/Pause or Restart operating on a monitored or overridden target.
- **Selected Preview Clip** — the clip represented by Resolume's `/composition/selectedclip` relative OSC path.
- **Adjustment Action** — selected-clip Speed or Volume increment/decrement with read-before-write behavior.
- **Adjustment Step** — normalized amount added to or subtracted from the current parameter value.
- **Hold Repeat** — repeated Adjustment Actions after the configured hold delay.
- **Custom OSC Action** — advanced action with a user-defined OSC address and typed arguments.
- **Press Message** — OSC message emitted when Custom OSC is pressed.
- **Release Message** — optional OSC message emitted when Custom OSC is released.
- **Sent Feedback** — momentary confirmation that UDP accepted a message; not proof Arena applied it.

Avoid calling Remaining Time a timecode, the Neo hardware Info Bar a plugin display target, or Sent Feedback a confirmed Arena result.
