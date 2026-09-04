# MarkEdit-CSS-Colors — design

Date: 2026-09-04

## Problem

Colour-literal painting exists twice, in two languages, in two repositories.

`markedit-extensions/extensions/color-highlight/color-highlight.js` (417 lines) paints the CodeMirror editor: a candidate
regular expression, hex and functional-form parsers, an HSL conversion, a relative-luminance contrast choice, a
`ViewPlugin`, and a menu item.

`MarkEdit-preview` paints the rendered preview with a TypeScript port of that parser — `src/shared/color.ts` (348 lines)
under `src/features/colorHighlight.ts` (95 lines). The port says in its header that it is a port, and it has already
drifted: it added a `refuseLineOpeningHex` option the original lacks, because a hex literal that opens a line is a
Markdown heading in source and is not one in rendered HTML.

Two implementations, two toggles in two settings namespaces, one feature.

## Goal

One extension, `MarkEdit-CSS-Colors`, that paints colour literals in the editor and — when MarkEdit-preview is there —
in the preview as well, and that does nothing about the preview when it is not.

`markedit-extensions` loses `color-highlight` entirely. `MarkEdit-preview` loses its painter and keeps only the parser
it still needs for resolving light and dark, which it takes from this package.

## How the preview is reached

`MarkEdit-bidirectional-preview-sync` is the precedent, and it does not use an API. It queries `.markdown-body`
(`src/sync.ts:34`), attaches a `MutationObserver`, and does nothing when the pane never appears.

That works because MarkEdit-preview is itself a user script in the same WebView. Its live pane is exactly
`.markdown-body` (`src/shared/const.ts:5`), and every render refills it with `previewPane.innerHTML = html`
(`src/view.ts:218`).

So this extension paints the preview from outside, with no cooperation from it. It therefore works against *upstream*
MarkEdit-preview, not only the fork in this working tree, and it degrades to editor-only painting when the preview is
absent, is in edit-only mode, or changes its markup in a future release.

## The extension

Repository `MarkEdit-CSS-Colors`, package `markedit-css-colors`, built like `MarkEdit-bidirectional-preview-sync`:
TypeScript, vite with `markedit-vite`, one drop-in script.

### Layout

```text
main.ts             wiring: settings, menu, editor extension, preview watcher
src/color.ts        the parser and the contrast choice
src/index.ts        library entry; re-exports the public surface of color.ts
src/editor.ts       the CodeMirror ViewPlugin and the editor background walk
src/preview.ts      pane discovery, the DOM painter, and the repaint observers
src/scheme.ts       a scheme-change signal, for repainting swatches with alpha
src/menu.ts         the menu item
src/settings.ts     reading and persisting the toggle
src/constants.ts    names, settings keys, selectors
```

### Two build outputs

```text
dist/markedit-css-colors.js   the drop-in user script (vite)
dist/lib/index.js             the parser, importable (tsc)
dist/lib/index.d.ts
```

Both are committed. `.gitignore` ignores `dist/*` and un-ignores exactly these, the way
`MarkEdit-bidirectional-preview-sync` commits its single artifact. A git dependency has no publish step to run a build,
and the release asset has to be in the tree.

`package.json` points `main`, `types` and `exports` at `dist/lib/index.js`, and carries a `markeditRegistry` block so
MarkEdit's Extension Manager can install it.

### Library surface

```text
parseColor(source)                          -> RGBA | undefined
findColors(text, { refuseLineOpeningHex })  -> ColorMatch[]
luminance(rgba)                             -> number
contrastColor(color, background)            -> '#000000' | '#ffffff'
isDarkColor(color)                          -> boolean
toCssColor(rgba)                            -> string
```

Types: `RGBA` (`{ a, b, g, r }`, channels 0..255, alpha 0..1), `ColorMatch` (`{ color, from, to }`),
`FindColorsOptions`.

`refuseLineOpeningHex` defaults to `false`. `src/editor.ts` passes `true`, because a line that opens with `#` in
Markdown source is a heading; `src/preview.ts` passes nothing, because the renderer has already eaten that `#`. This is
what each side does today and it does not change.

`LUMINANCE_THRESHOLD`, exported by `shared/color.ts` today, is not exported here. Nothing outside the module reads it,
and `contrastColor` and `isDarkColor` are the interface to it.

The parser text comes from `MarkEdit-preview/src/shared/color.ts`: it is the superset of the two, it is already
TypeScript, and its `findColors` already takes the option that serves both callers. The extraction is a move. The
parsing rules, the refusals and the numbers stay as they are, and the commentary explaining why each refusal exists
travels with the code.

### Names and settings

- Extension and registry name: **CSS Colors**
- Menu item: **Highlight Colors**, a checkbox, as today
- Settings namespace: `extension.cssColors`, holding `enabled`

The namespace follows MarkEdit's convention — the package name without the `markedit-` prefix, camel-cased — as
`markedit-bidirectional-preview-sync` uses `extension.bidirectionalPreviewSync`. It replaces two keys that both go
away: `extension.colorHighlight` and `extension.markeditPreview.colorHighlight`. The README and CHANGELOG say so; there
is no automatic migration for a one-line settings edit.

One toggle governs both panes. Today's two independent toggles exist only because the two implementations were
unrelated.

### Painting the editor

Unchanged from `color-highlight.js`: a `ViewPlugin` builds decorations over the visible ranges only, reads the editor
background once per build by walking up from `view.contentDOM`, and rebuilds on a document change, a viewport change,
or the repaint effect the menu dispatches.

### Painting the preview

Attach: find `.markdown-body`, preferring a displayed one, as `findPreviewPane` does. A `MutationObserver` on
`document.body` notices the pane appearing or being replaced and re-attaches.

Paint: walk text nodes with a `TreeWalker`, skipping `script, style, svg, .mermaid, .katex, .color-literal`, and
replace each literal with `<span class="color-literal">` carrying an inline background and text colour. A `<style>`
element injected once carries `border-radius: 3px` — the whole of `MarkEdit-preview/styles/color-literal.css`. This is
`features/colorHighlight.ts` moved, including `removeSwatches` and its `normalize` call.

Repaint: on any mutation inside the pane, coalesced to one animation frame.

**The feedback loop.** Our own swatches mutate `.markdown-body`, which wakes our own observer.
`MarkEdit-bidirectional-preview-sync` never mutates and so never meets this. The observer is disconnected for the
duration of a paint and reconnected after, and reconnecting takes the queued records first so the paint's own
mutations are dropped rather than delivered.

**Scheme changes.** A swatch with alpha shows the pane background through it, so its text colour is right only for the
scheme it was painted in. `MarkEdit-preview` handles this through `onColorSchemeChange`; outside it, `src/scheme.ts`
watches the same signals — `document.head` childList, the root and body attributes, and the `prefers-color-scheme`
media query — coalesces to a frame, and repaints when the resolved scheme actually changed.

**Detach.** Turning the toggle off removes the swatches, disconnects the observers, and leaves the pane as the renderer
wrote it. Turning it on attaches and paints.

### Tests

vitest with happy-dom, which is what `MarkEdit-preview` already uses.

- **Parser.** The merged suites: roughly 200 lines of the extension's 544 test the parser through CodeMirror
  decorations, and `MarkEdit-preview/tests/color.test.ts` covers the same ground in 103 less thorough lines. Both
  become direct calls on `parseColor`, `findColors`, `luminance` and `contrastColor`. Every case that exists today must
  exist after: the extension's suite is the only thorough description of what the parser refuses and why.
- **Editor.** The wiring the extension's suite proves, against the existing stub `Decoration`, `RangeSetBuilder`,
  `StateEffect` and `ViewPlugin`: a literal paints with the expected style string, a dark colour takes white text,
  offsets track a later line, a range outside the viewport is not scanned, the background walk reads an ancestor and
  falls back to white, and `refuseLineOpeningHex: true` reaches `findColors`.
- **Preview.** Adapted from `MarkEdit-preview/tests/colorHighlight.test.ts`: literals are wrapped, the skip list is
  honoured, repainting replaces rather than nests, and `removeSwatches` restores the original text. Plus what is new
  here: an absent pane paints nothing and throws nothing, a re-render repaints, and a paint does not trigger its own
  observer.
- **Menu and settings.** Ported unchanged from the extension's suite, against a stub `MarkEdit`: the alert-once
  behaviour, the read-merge-write of `settings.json`, and every failure path.

### Tooling

oxlint and oxfmt, pinned exactly, with the `.oxlintrc.json` and `.oxfmtrc.json` of `markedit-extensions`: 4-space
indent, 140 columns, no semicolons, single quotes, avoided arrow parentheses. The moved files are reformatted to this
style as part of the extraction. `.oxfmtrc.json` ignores `dist/`.

The lint and secrets guards are installed and committed before any code lands.

## markedit-extensions

`extensions/color-highlight/` is deleted — script, tests and README. The README loses its table row, and the CHANGELOG
records the removal with a pointer to the new repository.

Two consequences worth noting:

- The repository's claim that it has "no build step and there are no runtime dependencies" stays **true**. Nothing is
  added to it.
- Its "Scope and limits" section says a user script "cannot reach the Markdown preview pane". That is wrong —
  MarkEdit-preview renders into the same WebView, which is the whole basis of this design — and the paragraph is
  rewritten rather than left standing.

Removing a shipped extension is a breaking change for anyone who installed it, so the version moves to 2.0.0.

## MarkEdit-preview

Deleted:

- `src/features/colorHighlight.ts`
- `src/shared/color.ts`
- `tests/colorHighlight.test.ts`
- `tests/color.test.ts`
- `styles/color-literal.css`

Changed:

- `src/view.ts` — the `colorLiteralCss` import, the `appendStyle(colorLiteralCss())` call at line 45, and the two
  `paintColorLiterals` calls (the `onColorSchemeChange` handler and `renderHtmlPreview`)
- `src/styling.ts` — the `colorLiteralBase` import and the `colorLiteralCss` function
- `src/support/settings.ts` — the `colorHighlight` export
- `src/support/colorScheme.ts` — `previewBackground` and the `BLACK`/`WHITE` constants that only it uses; the import
  moves to `markedit-css-colors`, keeping `parseColor`, `isDarkColor` and the `RGBA` type for `surfaceBackground` and
  `resolveColorScheme`
- `package.json` — `markedit-css-colors` as a dependency
- `README.md` — the "Color literals" section and the `colorHighlight` settings entry become a pointer to the extension

`surfaceBackground` stays. It is the fork's own light/dark resolution, used by `view.ts`, `render.ts`, `search.ts`,
`mermaid.ts` and `quicklook/ui.ts`, and it has nothing to do with painting literals.

The fork ends up closer to upstream by 500-odd lines, which is the point of the arrangement.

## Sequencing

1. `MarkEdit-CSS-Colors`: tooling and gates, committed. Then the parser and its tests, then the editor half, then the
   preview half.
2. `markedit-extensions`: delete the extension, update the docs, bump the version.
3. `MarkEdit-preview`: wired to `file:../MarkEdit-CSS-Colors`, brought green.
4. The GitHub repository is created and pushed by hand.
5. The extension is tagged `v1.0.0` and `MarkEdit-preview` moves to
   `https://github.com/andybp85/MarkEdit-CSS-Colors#v1.0.0`.

Steps 1 to 3 need no network. Step 5 is a one-line change in one repository.

Nothing is deleted from `markedit-extensions` or `MarkEdit-preview` until the new extension is green, so there is no
window in which the feature exists nowhere.

## Risks

**Coverage lost in the test port.** The largest single piece of work is moving 300 lines of parser tests written
against CodeMirror decorations into tests written against functions. A case dropped in translation is a refusal that
silently stops being checked. Mitigation: port case by case, and count.

**The preview's markup is not an interface.** `.markdown-body` and `innerHTML` replacement are implementation details
of MarkEdit-preview, and a future release may change them. This is the same bet `MarkEdit-bidirectional-preview-sync`
makes, and its README says so plainly. Mitigation: the preview half is best-effort by construction — when the selector
finds nothing, the editor half is unaffected — and the README says the same thing.

**The observer feedback loop.** Getting the disconnect-and-drain wrong is an infinite repaint, which in a
`MutationObserver` presents as the app going unresponsive rather than as a failing test. Mitigation: a test that counts
paints across one render.

**Two artifacts from one build.** `vite build` and `tsc` write into the same `dist/`. Mitigation: separate
subdirectories, and a `.gitignore` that names both committed paths explicitly.

## Not doing

- An SPI in MarkEdit-preview. DOM discovery needs no changes there, works against upstream, and keeps the fork
  shrinking rather than growing.
- Sharing `src/scheme.ts` with the fork's `support/colorScheme.ts`. They resolve the same question from the same
  signals, but one is a fork's internal module with five callers and the other is 20 lines in an extension. Unifying
  them is a change to two behaviours rather than a move.
- Named colours, `lab()`, `oklch()`. Not supported today; a move is not the moment to add them.
- Painting anything in MarkEdit's own UI outside the editor and the preview pane.
