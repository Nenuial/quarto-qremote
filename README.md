# QRemote: slide timing and remote control for Quarto reveal.js

A [Quarto](https://quarto.org) extension for [reveal.js](https://quarto.org/docs/presentations/revealjs/) presentations:

- **Time each slide** (optional): `## My slide {timing="45"}`.
- **Speaker view countdown** (press <kbd>S</kbd>): time left on the slide, a progress bar that turns red when time is up, and where you should be by the end of the slide.
- **Pause and reset** the countdown with <kbd>P</kbd> and <kbd>R</kbd>, handy for rehearsals.
- **Remote control from an iPhone or Apple Watch** with the QRemote apps (separate download). Double tap on the watch for the next slide, feel a buzz when a slide's time is up, and read your notes on the iPhone.

Nothing is shown to the audience. Without the apps, the extension works on its own as a speaker-view timer.

## Installing

```bash
quarto add Nenuial/quarto-qremote
```

This installs the extension under the `_extensions` subdirectory. If you're using version control, you will want to check in this directory.

To start a new presentation from the example instead:

```bash
quarto use template Nenuial/quarto-qremote
```

## Using

Add the plugin to your presentation's YAML header:

```yaml
format:
  revealjs:
    revealjs-plugins: [qremote]
```

Then give slides a time with the `timing` attribute:

```markdown
## Why it matters {timing="45"}

## The plan {timing="1:30"}

## Questions
```

- `timing` accepts seconds (`45`, `45s`) or minutes (`1:30`, `2m`, `1m30s`). It is reveal.js's own `data-timing` attribute, so `{data-timing="45"}` works too.
- **Slides without a timing count up**: the speaker view and the remotes show the time spent on the slide, without a countdown or alerts. To time every slide by default, set `default-timing` (below).
- The **title slide** and any slide with the class `.standby` are not timed. The presentation clock starts when you leave them.

### Keyboard

| Key | Effect |
|---|---|
| <kbd>S</kbd> | Speaker view, with the slide countdown under reveal.js's clock |
| <kbd>P</kbd> | Pause / resume the slide countdown (instead of reveal.js's “previous slide”) |
| <kbd>R</kbd> | Reset: total clock and current slide start over |

Clicking reveal.js's clock in the speaker view (“Click to Reset”) also restarts the current slide.

### Options

All options are optional. Set them at the top level of the YAML header:

```yaml
qremote:
  default-timing: 30              # seconds (or "m:ss") for slides without `timing`; default: none (count up)
  relay: "http://localhost:8765"  # address of QRemote Relay; false to turn remote control off
  title-slide-standby: true       # false: the title slide is timed like the others
  speaker-view: true              # false: no countdown in the speaker view
```

| Option | Default | Description |
|---|---|---|
| `default-timing` | none | Time for slides without a `timing` attribute. Unset: those slides count up. |
| `relay` | `http://localhost:8765` | Where the presentation finds QRemote Relay. `false` turns remote control off. |
| `title-slide-standby` | `true` | The title slide is not timed; the clock starts when you leave it. |
| `speaker-view` | `true` | Shows the countdown in the speaker view. |

The speaker view labels are in English or French, following the document's `lang`.

#### Colors

The countdown uses your theme's link color, and red when time is up. To change them, set these CSS variables in your theme:

```scss
/*-- scss:rules --*/
:root {
  --qremote-accent: #c4a7e7;
  --qremote-warn: #eb6f92;
}
```

## Remote control

With the QRemote apps:

1. **QRemote Relay** runs in the Mac's menu bar, on the Mac that shows the presentation.
2. Open the rendered presentation in a browser on that Mac. It connects to the relay on its own.
3. Open **QRemote** on your iPhone: it finds the Mac on the local network. The Apple Watch app uses the Mac chosen on the iPhone.

| On the remote | Effect |
|---|---|
| Next (double tap on Apple Watch) | Next fragment or slide |
| Back | Previous |
| Light buzz | A few seconds before the end of a timed slide |
| Two strong buzzes | Time's up |

The iPhone also shows the speaker notes, the next slide's title, and whether you are ahead of or behind schedule.

Chrome may ask to allow the page to access devices on your local network: allow it, since the presentation talks to the relay on `localhost`.

### Protocol

The relay is a small HTTP server; you can write your own remote. The presentation:

- posts its state to `POST {relay}/state` (JSON sent as `text/plain`) on every change and every 3 seconds;
- receives commands as Server-Sent Events from `GET {relay}/events?client=<id>`: `{"cmd": "next" | "prev" | "pause" | "reset"}`.

State fields: `index`, `total`, `duration` (seconds, `0` = untimed), `slideStart`, `paused`, `pausedAt`, `standby`, `presentationStart` (epoch ms), `plannedEnd`, `plannedTotal` (seconds), `fragment`, `fragments`, `title`, `slideTitle`, `nextTitle`, `notes`.

## Troubleshooting

| Problem | Solution |
|---|---|
| `Cannot convert undefined or null to object` when rendering | The YAML header has a `qremote:` key with nothing under it (all options commented out). Remove the key or keep one option. |
| `YAML file qremote/plugin.yml not found` | The folder you run `quarto` from contains a folder named `qremote` (in any case). Quarto takes it for the plugin. Run `quarto` from another folder. Also check that `_extensions/qremote` is next to the presentation, or in the root of its Quarto project. |
| No countdown in the speaker view | The speaker view must be opened from the presentation (<kbd>S</kbd>). If the presentation was reloaded, close the speaker view and press <kbd>S</kbd> again. |

## Example

[example.qmd](example.qmd) shows timed and untimed slides, fragments and notes. Render it with `quarto render example.qmd`.

## License

MIT. See [LICENSE](LICENSE).
