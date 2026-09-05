# CSS Colors

A [MarkEdit](https://github.com/MarkEdit-app/MarkEdit) extension that paints CSS colour literals with the colour they
name.

## What it does

Paints hex, `rgb()`/`rgba()` and `hsl()`/`hsla()` literals in the editor and, when
[MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview) is installed, in the preview pane too. Each
literal gets a swatch in its own colour, with the text set to black or white by WCAG relative luminance, so it stays
readable against whatever it names.

## Install

Copy the built script into MarkEdit's scripts folder and restart the app:

```bash
cp dist/markedit-css-colors.js ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/
```

MarkEdit's Extension Manager also lists this extension under its registry entry, `markeditRegistry`, id
`markedit-css-colors`, name **CSS Colors** — use whichever install path the manager offers if you added this
repository there instead of copying the file by hand.

## What paints

| Literal                             | Examples                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Hex, 3, 4, 6 or 8 digits            | `#f00`, `#f00c`, `#ff0000`, `#ff000080`                                        |
| `rgb()` / `rgba()`, comma or space  | `rgb(255, 0, 0)`, `rgb(255 0 0)`, `rgba(255, 0, 0, 0.5)`, `rgb(255 0 0 / 50%)` |
| `hsl()` / `hsla()`, comma or space  | `hsl(0, 100%, 50%)`, `hsl(0deg 100% 50%)`, `hsla(0, 100%, 50%, 0.5)`           |

A channel can be written as a percentage as well as a plain number (`rgb(100%, 0%, 0%)` reads the same as
`rgb(255, 0, 0)`), and alpha can be a fourth comma-separated argument or a value after a slash. Matching is
case-insensitive, so `RGB(255, 0, 0)` paints too.

## Configure

**Extensions → Highlight CSS Colors** is a checkbox that turns painting on and off in both the editor and the preview
pane at once. Its state lives in `settings.json`, under the `extension.cssColors` key's `enabled` field.

This extension replaces two settings that both go away: `extension.colorHighlight` and
`extension.markeditPreview.colorHighlight`. Neither is migrated — set `extension.cssColors` instead.

## What does not paint

- Named colours (`tomato`), `lab()` and `oklch()`. The parser is deliberately conservative: a token it does not
  recognise is left unpainted rather than painted with a guessed colour.
- A hex literal outside the four lengths CSS defines (3, 4, 6 or 8 digits): `#12345`, `#1`, `#1234567`.
- A functional form with the wrong argument count, or an argument that is not a number in a form this parser
  understands: `rgb(1, 2)`, `rgb(a, b, c)`, `rgba(255, 0, 0, half)`.
- An `hsl()` hue in a unit other than bare degrees or `deg` (`hsl(1turn, 100%, 50%)`, `hsl(1rad, 100%, 50%)`), and a
  percentage hue (`hsl(50%, 100%, 50%)`) — a percentage is valid for saturation and lightness only.
- A candidate glued to a leading or trailing word character: `word#ff0000`, `#abcdefgh`, `rgb(255, 0, 0)word`. It
  reads as part of a longer token, not a colour literal standing on its own.
- A colour nested inside another call's parentheses: `rgb(calc(1px), 0, 0)`.
- **The heading rule, editor only:** a hex literal with nothing but whitespace before it does not paint, because in
  Markdown *source* that position belongs to a heading far more often than a colour — `# face` is a level-one
  heading, not the colour `#face`. A functional form opening the same line still paints; the ambiguity is a `#`
  problem only. The preview does not apply this rule: the renderer has already consumed the `#` that would have
  opened a heading, so a literal opening a paragraph or a table cell in rendered HTML is unambiguously a colour.
- Wherever the DOM painter runs — the preview pane, and any other host that imports this package as a library, such
  as Quick Look — text inside `<script>`, `<style>`, `<svg>`, a Mermaid diagram or KaTeX math. Those nodes hold source
  or layout-derived text rather than prose, and wrapping one in a swatch would move it. The editor is unaffected: it
  paints through CodeMirror decorations, not this DOM walk.

## The preview pane

The preview half paints [MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview)'s live pane from the
outside, with no cooperation from it and no API between the two extensions. It finds the pane by querying
`.markdown-body` — MarkEdit-preview's markup, not an interface it publishes — and repaints it with a
`MutationObserver` whenever the rendered content changes.

This is a bet, the same one [MarkEdit-bidirectional-preview-sync](https://github.com/MarkEdit-app/MarkEdit-bidirectional-preview-sync)
makes: it works against the upstream preview as well as any fork, and it costs nothing when it is wrong. When
`.markdown-body` is absent — the app is in edit-only mode, MarkEdit-preview is not installed, or a future release
changes the markup — the preview half paints nothing and the editor half is unaffected.

## Quick Look

MarkEdit-preview's Quick Look extension renders Markdown files in Finder, in its own WebView that a user script never
reaches. It paints colour literals by importing this package as a library instead, from the `dist/lib` entry point,
which exports:

- `contrastColor`, `findColors`, `isDarkColor`, `luminance`, `parseColor`, `toCssColor` — the parser.
- `ColorMatch`, `FindColorsOptions`, `RGBA` — the parser's types.
- `paintColorLiterals`, `removeSwatches`, `surfaceBackground`, `SWATCH_CLASS`, `SWATCH_CSS` — the DOM painter and its
  stylesheet.

## Develop

```bash
npm test              # vitest
npm run lint          # oxlint
npm run format        # oxfmt
npm run build         # the user script, dist/markedit-css-colors.js
npm run build:lib     # the library entry point, dist/lib
```

Both `dist` artifacts are committed. This package is installed as a git dependency, which has no publish step to run
a build on the consumer's behalf, so the build output has to already be in the repository.

`dist/lib` is real ESM — Node's own `import()` needs to resolve it directly, not just a bundler. `src/package.json`
marks the source tree as a module scope so `tsc -p tsconfig.lib.json` requires and emits explicit `.js` extensions on
relative imports (`nodenext` module resolution), and `postbuild:lib` copies it into `dist/lib` so Node treats the
built files the same way at run time. The root `package.json` stays typeless on purpose: `npm run build`'s CommonJS
user script would otherwise be renamed `dist/markedit-css-colors.cjs`, which is not the path this repository commits
to.
