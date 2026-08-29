# Resolume Monitor for Stream Deck

Monitor and control Resolume Arena or Avenue over OSC from Elgato Stream Deck.

[Download the latest release](https://github.com/calebweixun/resolume-streamdeck/releases/latest)

## Features

- Unified Clip Monitor with circle, bar, and square countdown styles
- Selected, specific-clip, selected-layer, and specific-layer monitoring
- Play/pause toggle, restart, selected-preview-clip trigger, and direct clip trigger
- Clear Composition and previous/next Column controls
- Selected-clip speed and volume adjustment with configurable steps
- Short press for one adjustment; configurable hold-to-repeat behavior
- Custom OSC messages with typed press and optional release arguments
- English and Traditional Chinese interface

Stream Deck Neo's hardware Info Bar is not writable through the third-party Plugin SDK. Monitor Actions use its LCD keys instead. Stream Deck+ actions can also provide touch-strip feedback.

## Install

1. Download `com.calebweixun.resolume-monitor.streamDeckPlugin` from the [latest GitHub Release](https://github.com/calebweixun/resolume-streamdeck/releases/latest).
2. Double-click the downloaded file and approve installation in Stream Deck.
3. Add a Resolume Monitor action to a Stream Deck profile.

Requirements:

- Stream Deck 7.1 or later
- macOS 13+ or Windows 10+
- Resolume Arena or Avenue with OSC enabled

## Resolume setup

The defaults assume Resolume and Stream Deck run on the same computer:

- Arena OSC input: `127.0.0.1:7000`
- Plugin OSC reply listener: `127.0.0.1:7001`

In Resolume Preferences:

1. Enable OSC input on port `7000`.
2. Enable OSC output to `127.0.0.1` on port `7001`.
3. Use a different matching reply port in both applications if `7001` is already occupied.

The plugin actively queries required values, so Resolume's **Output All OSC Messages** preset is not required.

## Included actions

| Group | Actions |
| --- | --- |
| Monitor | Clip Monitor with selectable circle, bar, or square countdown |
| Transport | Play / Pause Clip, Restart Clip, Trigger Clip |
| Composition | Clear Composition, Previous Column, Next Column |
| Adjustment | Clip Speed +/−, Clip Volume +/− |
| Advanced | Custom OSC |

Clip Monitor can hide the clip name. Clip Speed and Clip Volume read the current normalized Arena value before applying each increment or decrement, including while held.

## Development

```bash
nvm use
npm install
npm test
npm run build
npm run validate
```

For live development:

```bash
npx streamdeck link com.calebweixun.resolume-monitor.sdPlugin
npm run watch
```

Create a side-loadable package with `npm run pack`.

## Documentation

- [Current product specification](docs/SPEC.md)
- [Domain language](CONTEXT.md)
- [Changelog](CHANGELOG.md)

This is an independent community plugin and is not affiliated with Resolume or Elgato.

## License

MIT
