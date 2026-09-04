# MarkEdit CSS Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace two independent colour-literal painters — one in `markedit-extensions`, one in `MarkEdit-preview` —
with a single `MarkEdit-CSS-Colors` extension that paints the CodeMirror editor and the rendered preview pane, and
whose parser and painter are importable as a library.

**Architecture:** One repository, built like `MarkEdit-bidirectional-preview-sync`: TypeScript, vite with
`markedit-vite`, one drop-in user script. The script paints the editor through a CodeMirror `ViewPlugin` and paints the
preview from outside, by querying `.markdown-body` and watching it with a `MutationObserver` — no cooperation from
MarkEdit-preview and no API between them. A second build output, `dist/lib/`, exports the parser and the DOM painter so
MarkEdit-preview's Quick Look host — a separate WebView that user scripts never reach — keeps painting from the same
code.

**Tech Stack:** TypeScript 5, vite 6 + `markedit-vite`, `tsc` for the library output, vitest 4 + happy-dom, oxlint +
oxfmt, `markedit-api`, `@codemirror/state`, `@codemirror/view`.

**Spec:** `docs/superpowers/specs/2026-09-04-markedit-css-colors-design.md`

## Global Constraints

- Package name `markedit-css-colors`; extension and registry display name **CSS Colors**; menu item **Highlight
  Colors**, a checkbox.
- Settings namespace `extension.cssColors`, holding `enabled`. It replaces `extension.colorHighlight` and
  `extension.markeditPreview.colorHighlight`, which both go away. No migration code.
- Formatting is `markedit-extensions`' config, verbatim: `.oxfmtrc.json` with `semi: false`, `arrowParens: "avoid"`,
  `singleQuote: true`, `tabWidth: 4`, `printWidth: 140`, `trailingComma: "all"`; `.oxlintrc.json` with
  `curly: ["error", "multi"]`, `no-console` (warn/error allowed), `no-unused-vars`, `no-var`, `prefer-const`,
  `typescript/no-explicit-any`. Every file moved into this repository is reformatted to it.
- oxlint and oxfmt are pinned exactly: `oxlint@1.78.0`, `oxfmt@0.63.0`.
- Node >= 20.
- Two committed build outputs: `dist/markedit-css-colors.js` (vite) and `dist/lib/` (tsc, with `.d.ts`). `.gitignore`
  ignores `dist/*` and un-ignores exactly those two paths.
- The parser's rules, refusals and numbers do not change. The extraction is a move; the commentary explaining why each
  refusal exists travels with the code.
- No new colour support: no named colours, no `lab()`, no `oklch()`.
- The preview half is best-effort. When `.markdown-body` is absent the editor half is unaffected and nothing throws.
- Steps 1 to 3 of the sequencing need no network. Nothing is deleted from `markedit-extensions` or `MarkEdit-preview`
  until the new extension is green.

## Deviation from the spec, already settled

The spec's MarkEdit-preview change list misses `src/quicklook/ui.ts`, which also calls `paintColorLiterals`. Quick Look
runs in its own WebView loading only `markedit-preview.js` from the App Group shared container, so the new user script
can never load there. Deleting the fork's painter outright would silently drop colour painting from Quick Look.

**Resolution (approved):** the library exports the DOM painter as well as the parser. `src/features/colorHighlight.ts`
and `styles/color-literal.css` are still deleted from the fork; `src/quicklook/ui.ts` imports the painter from
`markedit-css-colors`, and the fork keeps `previewBackground` in `src/support/colorScheme.ts` (the spec's plan to
delete it, and the `BLACK`/`WHITE` constants it uses, is dropped — Quick Look is its remaining caller).

Consequently the library surface is the spec's list plus `paintColorLiterals`, `removeSwatches`, `surfaceBackground`,
`SWATCH_CLASS` and `SWATCH_CSS`.

## File structure

New repository `MarkEdit-CSS-Colors`:

| Path | Responsibility |
| ------------------------- | ------------------------------------------------------------------------------ |
| `main.ts`                 | Wiring: settings, style injection, menu, editor extension, preview painter      |
| `src/color.ts`            | The parser, luminance, and the contrast choice. No DOM.                         |
| `src/paint.ts`            | `SWATCH_CLASS`, `SWATCH_CSS`, the DOM painter, and the background walk          |
| `src/index.ts`            | Library entry; re-exports the public surface of `color.ts` and `paint.ts`       |
| `src/editor.ts`           | The CodeMirror `ViewPlugin`, the repaint effect, the editor background          |
| `src/preview.ts`          | Pane discovery, attach/detach, and the repaint observers                        |
| `src/scheme.ts`           | A scheme-change signal, for repainting swatches with alpha                      |
| `src/menu.ts`             | The menu item                                                                   |
| `src/settings.ts`         | Reading the toggle and persisting it to `settings.json`                         |
| `src/constants.ts`        | Names, settings keys, selectors                                                 |
| `tests/*.test.ts`         | One suite per module                                                            |

`src/color.ts` and `src/paint.ts` are the only modules the library entry reaches, so `tsc` compiling `src/index.ts`
never pulls in `markedit-api` or CodeMirror.

Existing repositories:

| Path | Change |
| ------------------------------------------------- | ------------------------------------------- |
| `markedit-extensions/extensions/color-highlight/`  | Deleted, with README, script and tests      |
| `markedit-extensions/README.md`, `CHANGELOG.md`    | Row removed; removal recorded; scope fixed  |
| `markedit-extensions/package.json`                 | Version 2.0.0                               |
| `MarkEdit-preview/src/features/colorHighlight.ts`  | Deleted                                     |
| `MarkEdit-preview/src/shared/color.ts`             | Deleted                                     |
| `MarkEdit-preview/styles/color-literal.css`        | Deleted                                     |
| `MarkEdit-preview/tests/color*.test.ts`            | Deleted                                     |
| `MarkEdit-preview/src/view.ts`                     | Loses the live-pane paint calls             |
| `MarkEdit-preview/src/quicklook/ui.ts`             | Paints through `markedit-css-colors`        |
| `MarkEdit-preview/src/styling.ts`                  | Loses `colorLiteralCss`                     |
| `MarkEdit-preview/src/support/settings.ts`         | Reads `extension.cssColors`                 |
| `MarkEdit-preview/src/support/colorScheme.ts`      | Import path only                            |
| `MarkEdit-preview/package.json`, `README.md`       | Dependency added; docs point at the package |

---

## Code rules

> These rules outrank this plan. Where a code sample below contradicts one, follow the rule and say so in your report.

**Dispatcher: paste this whole section verbatim into the body of every subagent brief.** A brief that points at "the
Code rules section of the plan" resolves to nothing in a fresh context. Re-run the matcher with
`~/.claude/python/bin/python3 ~/.claude/hooks/rules_inject.py src/color.ts tests/color.test.ts main.ts package.json README.md`.

The user's standing code rules for this file type, from ~/.claude/rules/.
They outrank any task brief, plan, or surrounding code that contradicts them:
if a brief specifies code that breaks a rule below, follow the rule and say so.

--- general.md ---

# General code style

Cross-language principles. Language rules stack on top; CLAUDE.md holds architecture (functional paradigms, YAGNI, Pike, DRY).

## Mindset

- readability over writability — hard thinking at write-time makes reading cheap
- simple (cheap to reason about) over easy (cheap to write)
- minimize accidental complexity; spend the budget on the problem itself
- structure every unit to fit in working memory: small, labeled, composable pieces
- fix small messes before they rot

## Functions

- one concept per function; do exactly what the name says — a name that feels dumb to type means it shouldn't be a function
- build a vocabulary of small, composable functions
- aim short; split over ~20 lines or high cognitive complexity — never split a single concept to hit a number
- entry points (`main`, scripts) may stay long once pure logic is factored out — locality wins there
- <=3 heterogeneous positional params (hard max 4); beyond that, named/keyword args
- explicit inputs and outputs over hidden state mutation

## Control flow & shape

- flatten: guard clauses / early returns; isolate unavoidably deep logic in its own function
- short conditionals; never mix `&&` and `||` in one test — extract or split
- declarative over imperative; `map`/`filter`/`reduce` (pure) over `forEach`/loops (side-effecting)
- break long call/method chains into well-named intermediates
- familiar, consistent patterns over exotic syntax/sugar (least surprise)

## State & effects

- treat data as immutable — mutate during construction, then freeze
- no action-at-a-distance: no global mutable state; behavior readable locally
- isolate side effects (I/O) at the edges; keep core logic pure
- declare near first use, minimize liveness span; no long-lived cross-function mutable vars (use an object or refactor)
- acquire returns release: `open`/`attach`/`subscribe`/`lock` hands back its own undo — no "am I open" flag to keep in sync

## Naming

- name by purpose — never `value`, `data`, `temp`
- functions are verbs, variables nouns, collections plural; single letters only in tight iteration
- visually distinct names (no `i`/`j`, `item`/`items` pairs); never shadow
- descriptive names don't excuse bad design; over-long names are bloat too
- alphabetize wherever order is otherwise arbitrary

## Abstractions

- abstractions must be lawful — obey what they imply (consistent equality, no surprising special cases); a leaky or misleading one
  explodes cognitive load, a lawful one reduces it

## Errors

- never pass silently, unless explicitly silenced
- throw to let the caller decide — don't swallow at the point of occurrence
- catch only the specific condition you can handle; re-throw the rest
- an essential missing value throws — never returns empty/`undefined`

## Comments & docs

- comment the *why*; a needed "what" means unclear code — clarify first (hard math/algorithms/perf excepted)
- comment the non-obvious: what a reader would ask, what you had to re-derive, non-specific catches, unrefactored hacks
- staleness-fear doesn't excuse omission — names go stale too; prefer assertions over comments documenting assumptions
- colocate docs with what they describe; read nearby commentary before editing
- cite what a URL is *for*; mark workarounds with removal criteria; flag cross-file coupling on both sides
- generate API docs from source, never hand-maintain a parallel copy; tests are documentation

## Testing

- CLAUDE.md holds the strategy (test-first, regression tests, mock boundaries); code-level additions below
- a bug signals excess complexity — fix the root cause and structure, not just the symptom
- set up mocks/spies in the test that uses them (locality over DRY)

## Hygiene

- no dead or vestigial code (unused imports, params, variables)
- no stray debug output in committed code (`console.log`, `print`); error logging is fine
- LF line endings

## Tooling

- the formatter owns formatting; if it's wrong, fix the config, not the file
- a suppression names its one rule and states the invariant that earns it — narrowest scope; never bare, never file-wide where a line does
- the same rule suppressed everywhere = wrong rule for the project — off in config, once, with the reason
- stdout is a tool's product in a CLI entry point and debug noise everywhere else; suppress the print rule at the site, not repo-wide

--- js.md ---

# JavaScript style

- omit optional syntax: no semicolons (ASI), no parens on single-param arrows, no braces on single-statement blocks
- const by default; let only when reassigned; never var
- prefer `undefined` over `null` (use `null` only when an API requires it); avoid `undefined` as a meaningful value
- general.md's acquire-returns-release: wrap `addEventListener` in a closure returning the `removeEventListener`, or an `AbortSignal` for
  a whole group
- ES modules; root-relative import paths (`/api.js`)
- module-private means not exported — no `_`-prefix convention; `#name` fields for genuinely private class state
- prefer modern built-ins/DOM APIs, destructuring, and shorthand over manual equivalents

--- markdown.md ---

# Markdown style

markdownlint enforces most of this, once a repo has a `.markdownlint-cli2.jsonc`, and `--fix` takes most of what it finds
(run it twice — one pass is not a fixpoint). Deliberately *not* oxfmt, though it reads markdown: it reformats the code
inside a fence, which restyles dated design records and agent-written `.beans/` issues. What no tool decides for you is
the line length, whether a fence has a language, and whether the link text says anything.

- 140-char line limit; exempt code blocks, tables, and unbreakable tokens (long URLs, link refs)
- ATX headers (`#`), never Setext (`===`/`---`); one H1 per doc; don't skip levels
- blank line around headers, lists, code blocks, and tables
- fenced code blocks, always language-tagged; never indented blocks
- `-` for unordered lists; `1.` lazy numbering for ordered (let the renderer count)
- descriptive link text, never "click here"; no bare URLs — wrap in `<...>` or a link
- reference-style links when a URL repeats or inline would blow the line limit
- no trailing whitespace; single trailing newline; no consecutive blank lines
- tables only when data is genuinely tabular; pad the cells to a common width — MD060 expects it and `--fix` writes it,
  so hand-trimmed cells are the thing that drifts
- comment the *why* for non-obvious structure via HTML comments

--- objects.md ---

# Object and collection style

- alphabetize all object properties to the extent possible
- prefer objects with semantically-relevant keys to arrays, unless modeling an actual list

--- ts.md ---

# TypeScript style

- inherits js.md/objects.md (shared globs); TS-only additions below
- never `any` — default to `unknown`, then narrow
- strongly type everything; assume strict; precise types over loose
- lean on inference for locals; annotate boundaries (exported signatures, public APIs) — strong typing != noisy annotations
- never cast (`as`, `<T>`, `!`) to paper over a type — narrow, guard, or fix the source type instead; cast only when the existing type is
  genuinely wrong or invalid
- never `@ts-ignore`; suppress only when the type is genuinely wrong/invalid, and then use `@ts-expect-error` with a comment explaining why
- keep types modular and colocated: function-arg types above the function, module-internal types at module level, app-wide types at top
  level
- prefer optional params (`x?: T`) over `x: T | undefined` — same effect, less noise

### Note on the moved code

`MarkEdit-preview/src/shared/color.ts` and `src/features/colorHighlight.ts` are written in that repository's style:
semicolons, two-space indent, braces on single-statement blocks. Moving them into this repository means reformatting
to the rules above. `npx oxlint --fix` removes the braces (`curly: multi`) and `npx oxfmt` does the rest; read the
result before committing, because a brace removal that changes which statement a guard governs is a silent bug.

---

## Task 1: Repository scaffolding, tooling and gates

Per house rules the gates land on `main` before any worktree exists. **The controller runs this task itself, commits
it on `main`, and only then creates worktrees for Tasks 2 onward.**

**Files:**

- Create: `package.json`, `tsconfig.json`, `tsconfig.lib.json`, `vite.config.mts`, `vitest.config.ts`,
  `.oxlintrc.json`, `.oxfmtrc.json`, `.gitignore`, `.claudeignore`
- Test: `tests/scaffolding.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `npm test` (vitest), `npm run lint` (oxlint), `npm run format:check` (oxfmt), `npm run build` (vite),
  `npm run build:lib` (tsc), `npm run typecheck`.

- [ ] **Step 1: Write `package.json`**

```json
{
    "name": "markedit-css-colors",
    "version": "1.0.0",
    "description": "Paints CSS colour literals in the MarkEdit editor and in the MarkEdit-preview pane.",
    "license": "MIT",
    "main": "dist/lib/index.js",
    "types": "dist/lib/index.d.ts",
    "exports": {
        ".": {
            "import": "./dist/lib/index.js",
            "require": "./dist/lib/index.js",
            "types": "./dist/lib/index.d.ts"
        }
    },
    "files": [
        "dist/lib",
        "dist/markedit-css-colors.js"
    ],
    "markeditRegistry": {
        "id": "markedit-css-colors",
        "name": "CSS Colors"
    },
    "engines": {
        "node": ">=20"
    },
    "scripts": {
        "build": "vite build",
        "build:lib": "tsc -p tsconfig.lib.json",
        "format": "oxfmt",
        "format:check": "oxfmt --check",
        "lint": "oxlint",
        "reload": "osascript -e 'quit app \"MarkEdit\"' -e 'delay 1' -e 'launch app \"MarkEdit\"'",
        "test": "vitest run",
        "typecheck": "tsc --noEmit",
        "uninstall": "rm ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/$(node -p \"require('./package.json').name\").js"
    },
    "devDependencies": {
        "@codemirror/state": "^6.0.0",
        "@codemirror/view": "^6.0.0",
        "@types/node": "^22.0.0",
        "happy-dom": "^20.8.9",
        "markedit-api": "https://github.com/MarkEdit-app/MarkEdit-api#v0.35.0",
        "markedit-vite": "https://github.com/MarkEdit-app/MarkEdit-vite#v0.5.0",
        "oxfmt": "0.63.0",
        "oxlint": "1.78.0",
        "typescript": "^5.0.0",
        "vite": "^6.4.3",
        "vitest": "^4.0.18"
    },
    "allowScripts": {
        "esbuild@0.25.12": true
    }
}
```

- [ ] **Step 2: Write the tooling configs**

`.oxlintrc.json` and `.oxfmtrc.json` are copied from `markedit-extensions` unchanged, except that `.oxfmtrc.json`
gains `dist/` to its ignore list.

```json
{
    "rules": {
        "curly": ["error", "multi"],
        "no-console": ["error", { "allow": ["warn", "error"] }],
        "no-unused-vars": "error",
        "no-var": "error",
        "prefer-const": "error",
        "typescript/no-explicit-any": "error"
    }
}
```

```json
{
    "semi": false,
    "arrowParens": "avoid",
    "singleQuote": true,
    "tabWidth": 4,
    "printWidth": 140,
    "trailingComma": "all",
    "ignorePatterns": ["package.json", "package-lock.json", "dist/", "**/*.md", "**/*.toml"]
}
```

- [ ] **Step 3: Write `tsconfig.json` and `tsconfig.lib.json`**

`tsconfig.json` typechecks everything and emits nothing; `tsconfig.lib.json` emits the library. Compiling
`src/index.ts` alone keeps `markedit-api` and CodeMirror out of the library output, because nothing `index.ts` reaches
imports them.

```json
{
    "compilerOptions": {
        "typeRoots": ["./node_modules/@types"],
        "module": "esnext",
        "target": "esnext",
        "lib": ["es2020", "dom"],
        "moduleResolution": "node",
        "strict": true,
        "importHelpers": true,
        "noEmit": true,
        "skipLibCheck": true
    },
    "include": ["main.ts", "src/**/*.ts", "tests/**/*.ts"]
}
```

```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "declaration": true,
        "noEmit": false,
        "outDir": "dist/lib",
        "rootDir": "src"
    },
    "include": ["src/index.ts"]
}
```

- [ ] **Step 4: Write `vite.config.mts` and `vitest.config.ts`**

```typescript
import { defineConfig } from 'vite'
import { defaultViteConfig } from 'markedit-vite'

export default defineConfig({
    ...defaultViteConfig(),
})
```

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
    },
})
```

- [ ] **Step 5: Write `.gitignore` and `.claudeignore`**

`dist/*` excludes the directory's entries; the two negations put back exactly the committed artifacts. `!dist/lib/`
re-includes the directory, and once a directory is not excluded git considers the files inside it again.

```gitignore
node_modules/
dist/*
!dist/markedit-css-colors.js
!dist/lib/
```

```gitignore
node_modules/
dist/
```

- [ ] **Step 6: Install and write the smoke test**

Run: `npm install`

`tests/scaffolding.test.ts` proves the runner works and that the two environments the later suites need are both
reachable — a plain Node environment and happy-dom in the same run.

```typescript
import { describe, expect, it } from 'vitest'

describe('the test runner', () => {
    it('runs in a plain node environment by default', () => {
        expect(typeof globalThis.document).toBe('undefined')
    })
})
```

```typescript
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

describe('happy-dom', () => {
    it('supplies the DOM the painter needs', () => {
        const element = document.createElement('div')
        element.style.backgroundColor = 'rgb(255, 255, 255)'
        document.body.appendChild(element)

        expect(getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)')
        expect(typeof MutationObserver).toBe('function')
        expect(typeof requestAnimationFrame).toBe('function')
    })
})
```

Put the second block in `tests/scaffolding.dom.test.ts`, because the environment comment governs a whole file.

- [ ] **Step 7: Run the gates and the tests**

Run: `npm test && npm run lint && npm run format:check && npm run typecheck`
Expected: all four pass. If `format:check` fails, run `npm run format` and read the diff.

- [ ] **Step 8: Install the repo-local commit guards**

The global hooks dispatcher at `~/.claude/git-hooks` already runs the lint and secrets guards in every repository. The
spec asks for repo-local copies, which survive without `~/.claude`. Use the `superpowers`-adjacent skills rather than
hand-rolling them:

- `secrets-commit-guard` — installs the repo-local secrets guard
- `repo-tooling` — installs the repo-local lint guard against the oxlint/oxfmt pair above

Prove each one fails before trusting it: stage a file with a deliberate formatting violation, attempt a commit, and
confirm the commit is refused. Then revert the violation.

- [ ] **Step 9: Commit**

```bash
git add .gitignore .claudeignore .oxfmtrc.json .oxlintrc.json package.json package-lock.json \
    tsconfig.json tsconfig.lib.json vite.config.mts vitest.config.ts tests/scaffolding.test.ts \
    tests/scaffolding.dom.test.ts
git commit -m "chore: scaffold the extension, its tooling and its gates"
```

Commit the guard files in a second commit if the skills wrote them outside those paths. Stage explicit paths; never
`git add -A`.

---

## Task 2: The parser

**Files:**

- Create: `src/color.ts`
- Test: `tests/color.test.ts`
- Source of the move: `MarkEdit-preview/src/shared/color.ts` (348 lines)
- Sources of the test cases: `markedit-extensions/extensions/color-highlight/test/color-highlight.test.mjs` and
  `MarkEdit-preview/tests/color.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:

```typescript
export interface RGBA {
    a: number
    b: number
    g: number
    r: number
}

export interface ColorMatch {
    color: RGBA
    from: number
    to: number
}

export interface FindColorsOptions {
    refuseLineOpeningHex?: boolean
}

export const BLACK: RGBA
export const WHITE: RGBA

export function parseColor(source: string): RGBA | undefined
export function findColors(text: string, options?: FindColorsOptions): ColorMatch[]
export function luminance(color: RGBA): number
export function contrastColor(color: RGBA, background: RGBA): '#000000' | '#ffffff'
export function isDarkColor(color: RGBA): boolean
export function toCssColor(color: RGBA): string
```

`BLACK` and `WHITE` are exported for `src/editor.ts` and `src/preview.ts`. They are **not** part of the library
surface — `src/index.ts` in Task 4 does not re-export them. `LUMINANCE_THRESHOLD` stays module-private: nothing outside
reads it, and `contrastColor` and `isDarkColor` are the interface to it.

- [ ] **Step 1: Write the failing test**

Create `tests/color.test.ts` importing from `../src/color`. Below is the shape and a representative slice; Step 2 lists
every case that must be present.

```typescript
import { describe, expect, it } from 'vitest'
import { BLACK, contrastColor, findColors, isDarkColor, luminance, parseColor, toCssColor, WHITE } from '../src/color'

describe('parseColor', () => {
    it('reads hex in every length CSS defines', () => {
        expect(parseColor('#f00')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
        expect(parseColor('#ff0000')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
        expect(parseColor('#f8c')).toEqual({ a: 1, b: 204, g: 136, r: 255 })
        expect(parseColor('#f00c')).toEqual({ a: 0.8, b: 0, g: 0, r: 255 })
        expect(parseColor('#ff000080')).toEqual({ a: 0.502, b: 0, g: 0, r: 255 })
        expect(parseColor('#FF0000')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
    })

    it('refuses hex at a length CSS does not define', () => {
        expect(parseColor('#12345')).toBeUndefined()
        expect(parseColor('#1234567')).toBeUndefined()
        expect(parseColor('#1')).toBeUndefined()
        expect(parseColor('#')).toBeUndefined()
    })

    it('clamps a channel out of range rather than refusing it', () => {
        expect(parseColor('rgb(300, -20, 0)')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
    })

    it('clamps an alpha out of range', () => {
        expect(parseColor('rgba(255, 0, 0, 7)')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
    })
})

describe('contrastColor', () => {
    // The contrast ratios against black and white are equal at L = 0.17912878.
    // #757575 sits just below it and #767676 just above.
    it('flips black and white at the luminance threshold', () => {
        expect(contrastColor({ a: 1, b: 117, g: 117, r: 117 }, WHITE)).toBe('#ffffff')
        expect(contrastColor({ a: 1, b: 118, g: 118, r: 118 }, WHITE)).toBe('#000000')
    })

    // White at one tenth opacity is nearly the background. On a light surface it
    // needs black text; on a dark surface the very same token needs white.
    it('composites a transparent colour over its background before choosing', () => {
        const faint = { a: 0.1, b: 255, g: 255, r: 255 }
        expect(contrastColor(faint, WHITE)).toBe('#000000')
        expect(contrastColor(faint, BLACK)).toBe('#ffffff')
    })

    it('ignores the background for an opaque colour', () => {
        expect(contrastColor({ a: 1, b: 0, g: 0, r: 255 }, BLACK)).toBe('#000000')
    })
})

describe('toCssColor', () => {
    it('writes the rgba() form the swatch style uses', () => {
        expect(toCssColor({ a: 0.5, b: 0, g: 0, r: 255 })).toBe('rgba(255, 0, 0, 0.5)')
    })
})

describe('isDarkColor', () => {
    it('answers for the two extremes', () => {
        expect(isDarkColor(BLACK)).toBe(true)
        expect(isDarkColor(WHITE)).toBe(false)
    })
})

describe('luminance', () => {
    it('places white at the top of the range and black at the bottom', () => {
        expect(luminance(WHITE)).toBeCloseTo(1, 5)
        expect(luminance(BLACK)).toBeCloseTo(0, 5)
    })
})

describe('findColors', () => {
    it('finds each literal with its offsets, in order', () => {
        expect(findColors('bg #ff0000 and rgb(0 0 255)')).toEqual([
            { color: { a: 1, b: 0, g: 0, r: 255 }, from: 3, to: 10 },
            { color: { a: 1, b: 255, g: 0, r: 0 }, from: 15, to: 27 },
        ])
    })

    it('refuses a hex that opens the run only when asked to', () => {
        expect(findColors('#ff0000 is red')).toHaveLength(1)
        expect(findColors('#face', { refuseLineOpeningHex: true })).toEqual([])
        expect(findColors('    #face', { refuseLineOpeningHex: true })).toEqual([])
        expect(findColors('rgb(255 0 0)', { refuseLineOpeningHex: true })).toHaveLength(1)
    })
})
```

- [ ] **Step 2: Port every remaining case, and count**

This is the plan's largest risk: a case dropped in translation is a refusal that silently stops being checked. Work
the list below top to bottom, tick each one, and assert the total at the end.

The 29 cases that must exist in `tests/color.test.ts`, on top of the five blocks written in Step 1:

1. Hex, 3 and 6 digits, and the digit doubling of the short form (`#f8c` is `#ff88cc`).
1. Hex with alpha, 4 and 8 digits (`#f00c` is `a: 0.8`; `#ff000080` is `a: 0.502`).
1. Uppercase hex parses.
1. Hex at an undefined length refuses: `#12345`, `#1234567`, `#1`, `#`.
1. `findColors` refuses a hex glued to a leading word character: `word#ff0000`, `a ##ff0000`, `page#abc`.
1. `findColors` refuses a candidate glued to a trailing word character: `#abcdefgh`, `a #abcdefgh`,
   `rgb(255, 0, 0)word`, `a rgb(255, 0, 0)word`.
1. `findColors` with `refuseLineOpeningHex: true` refuses `#face` and `    #face`, and refuses a hex opening a later
   line when the caller passes that line alone.
1. `findColors` accepts a hex after a list marker or a word: `- #ff0000`, `The brand is #ff0000`, `color: #ff0000;`.
1. `findColors` accepts a functional form that opens the run even with `refuseLineOpeningHex: true` — the heading rule
   is for hex only.
1. `rgb()` in the comma syntax and the space syntax.
1. Percentage channels give the same colour as the equivalent numbers: `rgb(100%, 0%, 0%)` equals `rgb(255, 0, 0)`.
1. A channel out of range is clamped: `rgb(300, -20, 0)`.
1. Wrong argument count refuses: `rgb(1, 2)`, `rgb(1, 2, 3, 4, 5)`, `rgb()`.
1. An unparseable channel refuses: `rgb(a, b, c)`, `rgb(none, 0, 0)`.
1. A nested parenthesis is not a candidate at all: `findColors('a rgb(calc(1px), 0, 0)')` is empty.
1. A word ending in `rgb` is not a functional form: `srgb(255, 0, 0)`.
1. Uppercase `RGB(...)` parses.
1. `rgba()` alpha in all three spellings: fourth comma argument, `/ 0.5`, `/ 50%`.
1. An unparseable alpha refuses: `rgba(255, 0, 0, half)`, `rgb(255 0 0 / )`.
1. An alpha out of range is clamped: `rgba(255, 0, 0, 7)`.
1. `hsl()` converts the primaries and the secondaries: hues 0, 60, 120, 240.
1. Zero saturation is a grey of the lightness: `hsl(0, 0%, 50%)`, `hsl(210, 0%, 0%)`, `hsl(210, 0%, 100%)`.
1. A hue outside 0..360 wraps in both directions: 480 equals 120, -120 equals 240.
1. `hsl()` space syntax, a `deg` hue, an alpha, and `hsla()`; saturation and lightness read the same with or without
   the percent (`hsl(0 100 50)` equals `hsl(0, 100%, 50%)`).
1. A hue in an angle unit the parser does not know refuses: `1turn`, `0.5turn`, `1rad`.
1. A percentage hue refuses: `hsl(50%, 100%, 50%)`, `hsl(50% 100% 50%)`.
1. Forms the parser does not recognise refuse: `oklch(0.7 0.1 200)`, `tomato`.
1. `parseColor` reads back what `getComputedStyle` reports: `rgb(13, 17, 23)`, `rgba(0, 0, 0, 0)`.
1. `findColors` on text with no literal, and on the empty string, returns an empty array.

Add a final guard so the count cannot silently shrink:

```typescript
// Every source string in the list above that `parseColor` must refuse outright.
// findColors-only refusals (a token glued to a word) do not belong here: the
// parser reads those strings happily and it is the sweep that rejects them.
const REFUSALS = ['#', '#1', '#12345', 'rgb(1, 2)', 'tomato' /* ...the rest... */]

it('refuses every form the two source suites recorded', () => {
    // The extension's suite was the only thorough description of what the parser
    // refuses and why. Dropping a case here drops a refusal from the record.
    expect(REFUSALS.filter(source => parseColor(source) !== undefined)).toEqual([])
    expect(REFUSALS).toHaveLength(REFUSAL_COUNT)
})
```

Build `REFUSALS` from the list above, count it once it is complete, and write that number as `REFUSAL_COUNT`. The
assertion is not about the value: it is what makes a later deletion from the list fail the suite instead of passing
quietly.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/color.test.ts`
Expected: FAIL — `Failed to resolve import "../src/color"`.

- [ ] **Step 4: Move the parser**

```bash
cp ../MarkEdit-preview/src/shared/color.ts src/color.ts
```

Then apply exactly these edits, and nothing else:

1. Replace the file header comment. It currently says the parser is a port from the `color-highlight` script in
   `markedit-extensions`. That script is being deleted; this file is now the original. New header:

    ```typescript
    /**
     * CSS colour literal parsing.
     *
     * The parser is deliberately conservative: a token it does not recognise is
     * reported as nothing rather than painted with a guessed colour. It also reads
     * back what `getComputedStyle` reports, which is the old comma syntax, so it
     * doubles as the reader for element background colours.
     */
    ```

1. Add the two shared constants next to `LUMINANCE_THRESHOLD`:

    ```typescript
    /** The two extremes, for compositing and for a background walk that finds nothing. */
    export const BLACK: RGBA = { a: 1, b: 0, g: 0, r: 0 }
    export const WHITE: RGBA = { a: 1, b: 255, g: 255, r: 255 }
    ```

1. Remove `export` from `LUMINANCE_THRESHOLD`, keeping its doc comment.
1. Reformat: `npx oxlint --fix && npx oxfmt`. This removes semicolons, converts to 4-space indent, and strips the
   braces from single-statement `if` blocks. **Read every brace removal.** A guard such as

    ```typescript
    if (args === undefined) {
        return undefined
    }
    ```

    becomes `if (args === undefined) return undefined`, which is correct; a multi-statement block must keep its braces.

1. The `FindColorsOptions.refuseLineOpeningHex` doc comment mentions "the editor extension" and "the preview" — both
   are now this package. Leave the wording; it still describes the two callers correctly.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/color.test.ts`
Expected: PASS, with the count guard green.

- [ ] **Step 6: Run the gates**

Run: `npm test && npm run lint && npm run format:check && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/color.ts tests/color.test.ts
git commit -m "feat: the CSS colour parser, with the merged test suite"
```

---

## Task 3: The DOM painter

**Files:**

- Create: `src/paint.ts`
- Test: `tests/paint.test.ts`
- Sources of the move: `MarkEdit-preview/src/features/colorHighlight.ts` (95 lines),
  `MarkEdit-preview/styles/color-literal.css` (4 lines), and the `surfaceBackground` half of
  `MarkEdit-preview/src/support/colorScheme.ts`
- Source of the test cases: `MarkEdit-preview/tests/colorHighlight.test.ts`

**Interfaces:**

- Consumes: `RGBA`, `contrastColor`, `findColors`, `toCssColor`, `parseColor` from `src/color.ts` (Task 2).
- Produces:

```typescript
export const SWATCH_CLASS = 'color-literal'
export const SWATCH_CSS: string
export function paintColorLiterals(container: HTMLElement, background: RGBA): void
export function removeSwatches(container: HTMLElement): void
export function surfaceBackground(element: Element | undefined): RGBA | undefined
```

`paintColorLiterals` takes the background as an argument rather than resolving it. That is what keeps this module free
of scheme resolution, so `src/editor.ts`, `src/preview.ts` and MarkEdit-preview's Quick Look host can each supply the
background their own surface actually paints.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { paintColorLiterals, removeSwatches, surfaceBackground, SWATCH_CLASS } from '../src/paint'
import { WHITE } from '../src/color'

let pane: HTMLElement

function swatches() {
    return Array.from(pane.querySelectorAll<HTMLElement>(`.${SWATCH_CLASS}`))
}

function paint(html: string) {
    pane.innerHTML = html
    paintColorLiterals(pane, WHITE)
    return swatches()
}

beforeEach(() => {
    document.body.innerHTML = ''
    pane = document.createElement('div')
    pane.className = 'markdown-body'
    pane.style.backgroundColor = 'rgb(255, 255, 255)'
    document.body.appendChild(pane)
})

describe('paintColorLiterals', () => {
    it('wraps a literal in prose and paints it with itself', () => {
        const [swatch] = paint('<p>The brand colour is #ff0000 today.</p>')

        expect(swatch.textContent).toBe('#ff0000')
        expect(swatch.style.backgroundColor).toBe('rgba(255, 0, 0, 1)')
    })

    it('paints inside inline code and fenced blocks alike', () => {
        expect(paint('<p><code>#00ff00</code></p><pre><code>a { color: #0000ff; }</code></pre>')).toHaveLength(2)
    })

    it('leaves the surrounding text intact', () => {
        paint('<p>before #ff0000 after</p>')
        expect(pane.textContent).toBe('before #ff0000 after')
    })

    it('paints a literal that opens a block, which no longer reads as a heading', () => {
        expect(paint('<td>#ff0000</td>')).toHaveLength(1)
    })

    it('picks the text colour that reads on the swatch', () => {
        const [dark, light] = paint('<p>#000000 and #ffffff</p>')
        expect(dark.style.color).toBe('#ffffff')
        expect(light.style.color).toBe('#000000')
    })

    it('composites a transparent swatch over the background it is given', () => {
        pane.innerHTML = '<p>rgba(255, 255, 255, 0.1)</p>'
        paintColorLiterals(pane, { a: 1, b: 0, g: 0, r: 0 })
        expect(swatches()[0].style.color).toBe('#ffffff')
    })

    it('skips rendered diagrams and math', () => {
        expect(paint('<div class="mermaid"><svg><text>#ff0000</text></svg></div>')).toHaveLength(0)
        expect(paint('<span class="katex"><span>#ff0000</span></span>')).toHaveLength(0)
    })

    it('leaves a document with no literal untouched', () => {
        const html = '<p>nothing to paint</p>'
        pane.innerHTML = html
        paintColorLiterals(pane, WHITE)
        expect(pane.innerHTML).toBe(html)
    })

    it('repaints in place rather than nesting swatches', () => {
        pane.innerHTML = '<p>#ff0000</p>'
        paintColorLiterals(pane, WHITE)
        paintColorLiterals(pane, WHITE)

        expect(swatches()).toHaveLength(1)
        expect(pane.textContent).toBe('#ff0000')
    })
})

describe('removeSwatches', () => {
    it('restores the text a fresh render would have produced', () => {
        pane.innerHTML = '<p>before #ff0000 after</p>'
        paintColorLiterals(pane, WHITE)
        removeSwatches(pane)

        expect(swatches()).toHaveLength(0)
        expect(pane.innerHTML).toBe('<p>before #ff0000 after</p>')
    })

    it('does nothing to a container it never painted', () => {
        pane.innerHTML = '<p>plain</p>'
        removeSwatches(pane)
        expect(pane.innerHTML).toBe('<p>plain</p>')
    })
})

describe('surfaceBackground', () => {
    it('reads the first ancestor that actually paints', () => {
        const inner = document.createElement('div')
        inner.style.backgroundColor = 'rgba(0, 0, 0, 0)'
        pane.style.backgroundColor = 'rgb(0, 0, 0)'
        pane.appendChild(inner)

        expect(surfaceBackground(inner)).toEqual({ a: 1, b: 0, g: 0, r: 0 })
    })

    it('answers nothing when nothing above the element paints', () => {
        const orphan = document.createElement('div')
        expect(surfaceBackground(orphan)).toBeUndefined()
    })

    it('answers nothing for no element at all', () => {
        expect(surfaceBackground(undefined)).toBeUndefined()
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/paint.test.ts`
Expected: FAIL — `Failed to resolve import "../src/paint"`.

- [ ] **Step 3: Write `src/paint.ts`**

The body of `paintColorLiterals`, `paintableText`, `isPaintable`, `paintTextNode`, `createSwatch` and `removeSwatches`
is `MarkEdit-preview/src/features/colorHighlight.ts` moved, with three changes: the background is a parameter rather
than a `previewBackground(container)` call, `removeSwatches` is exported, and the file is reformatted to this
repository's style. `surfaceBackground` is `MarkEdit-preview/src/support/colorScheme.ts`'s function moved, retyped to
accept `undefined`.

```typescript
import { contrastColor, findColors, parseColor, toCssColor } from './color'
import type { RGBA } from './color'

/** The class every painted literal carries, so a user can restyle a swatch. */
export const SWATCH_CLASS = 'color-literal'

/** The whole of the swatch stylesheet. The colours themselves are inline, per literal. */
export const SWATCH_CSS = `.${SWATCH_CLASS} { border-radius: 3px; }\n`

// A rendered diagram and rendered math both carry text nodes that look like
// prose and are not: their positions come from a layout engine, and wrapping one
// in a span moves it. Script and style hold source, not reading text.
const UNPAINTABLE = `script, style, svg, .mermaid, .katex, .${SWATCH_CLASS}`

/**
 * Paints `container` in place, replacing whatever it painted before. Repainting
 * is how a scheme change reaches a swatch that has alpha: the text colour of such
 * a swatch depends on the background showing through it.
 */
export function paintColorLiterals(container: HTMLElement, background: RGBA) {
    removeSwatches(container)
    paintableText(container).forEach(node => paintTextNode(node, background))
}

/**
 * Unwrapping leaves the literal as its own text node next to its neighbours;
 * `normalize` joins them back so the next sweep sees the same text a fresh render
 * would, and a literal never straddles two nodes.
 */
export function removeSwatches(container: HTMLElement) {
    const swatches = container.querySelectorAll<HTMLElement>(`.${SWATCH_CLASS}`)
    if (swatches.length === 0) return

    swatches.forEach(swatch => swatch.replaceWith(document.createTextNode(swatch.textContent ?? '')))
    container.normalize()
}

/**
 * The first background an element or one of its ancestors actually paints.
 *
 * A content element is usually transparent and the colour lives on an ancestor,
 * so the walk continues past an answer `parseColor` does not recognise (the
 * keyword `transparent`) and past one that parses but is fully see-through.
 */
export function surfaceBackground(element?: Element): RGBA | undefined {
    for (let node = element ?? undefined; node !== undefined; node = node.parentElement ?? undefined) {
        const color = parseColor(getComputedStyle(node).backgroundColor)
        if (color !== undefined && color.a > 0) return color
    }

    return undefined
}

function paintableText(container: HTMLElement) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: node => (isPaintable(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    })

    const nodes: Text[] = []
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) if (node instanceof Text) nodes.push(node)

    return nodes
}

function isPaintable(node: Node) {
    const parent = node.parentElement
    return parent !== null && parent.closest(UNPAINTABLE) === null
}

function paintTextNode(node: Text, background: RGBA) {
    const text = node.data
    const matches = findColors(text)
    if (matches.length === 0) return

    const painted = document.createDocumentFragment()
    let index = 0

    for (const { color, from, to } of matches) {
        if (from > index) painted.appendChild(document.createTextNode(text.slice(index, from)))

        painted.appendChild(createSwatch(text.slice(from, to), color, background))
        index = to
    }

    if (index < text.length) painted.appendChild(document.createTextNode(text.slice(index)))

    node.replaceWith(painted)
}

function createSwatch(literal: string, color: RGBA, background: RGBA) {
    const swatch = document.createElement('span')
    swatch.className = SWATCH_CLASS
    swatch.textContent = literal
    swatch.style.backgroundColor = toCssColor(color)
    swatch.style.color = contrastColor(color, background)
    return swatch
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/paint.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the gates**

Run: `npm test && npm run lint && npm run format:check && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/paint.ts tests/paint.test.ts
git commit -m "feat: the DOM painter and the swatch stylesheet"
```

---

## Task 4: The library entry and its build

**Files:**

- Create: `src/index.ts`
- Test: `tests/index.test.ts`
- Modify: nothing (`tsconfig.lib.json` and `build:lib` already exist from Task 1)

**Interfaces:**

- Consumes: everything Tasks 2 and 3 produced.
- Produces: `dist/lib/index.js` and `dist/lib/index.d.ts`; the exact public surface below, which MarkEdit-preview
  imports in Task 12.

```typescript
export { contrastColor, findColors, isDarkColor, luminance, parseColor, toCssColor } from './color'
export type { ColorMatch, FindColorsOptions, RGBA } from './color'
export { paintColorLiterals, removeSwatches, surfaceBackground, SWATCH_CLASS, SWATCH_CSS } from './paint'
```

- [ ] **Step 1: Write the failing test**

The surface is the contract MarkEdit-preview depends on, so a test pins it. It also pins what is *not* exported:
`BLACK`, `WHITE` and `LUMINANCE_THRESHOLD` are internal, and adding them later is a decision, not an accident.

```typescript
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import * as library from '../src/index'

describe('the library surface', () => {
    it('exports exactly the names MarkEdit-preview depends on', () => {
        expect(Object.keys(library).sort()).toEqual([
            'SWATCH_CLASS',
            'SWATCH_CSS',
            'contrastColor',
            'findColors',
            'isDarkColor',
            'luminance',
            'paintColorLiterals',
            'parseColor',
            'removeSwatches',
            'surfaceBackground',
            'toCssColor',
        ])
    })

    it('reaches the parser through the entry point', () => {
        expect(library.parseColor('#ff0000')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
    })

    it('reaches the painter through the entry point', () => {
        const pane = document.createElement('div')
        pane.innerHTML = '<p>#ff0000</p>'
        library.paintColorLiterals(pane, { a: 1, b: 255, g: 255, r: 255 })

        expect(pane.querySelectorAll(`.${library.SWATCH_CLASS}`)).toHaveLength(1)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/index.test.ts`
Expected: FAIL — `Failed to resolve import "../src/index"`.

- [ ] **Step 3: Write `src/index.ts`**

```typescript
/**
 * The library half of this package: the parser and the DOM painter, for a host
 * that cannot load the user script. MarkEdit-preview's Quick Look extension runs
 * in its own WebView and is the reason this entry point exists.
 */
export { contrastColor, findColors, isDarkColor, luminance, parseColor, toCssColor } from './color'
export type { ColorMatch, FindColorsOptions, RGBA } from './color'
export { paintColorLiterals, removeSwatches, surfaceBackground, SWATCH_CLASS, SWATCH_CSS } from './paint'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the library and check what it emitted**

Run: `npm run build:lib && ls dist/lib`
Expected: `color.d.ts`, `color.js`, `index.d.ts`, `index.js`, `paint.d.ts`, `paint.js` — and nothing else. If
`editor.js` or `main.js` appears, `tsconfig.lib.json` is reaching past `src/index.ts`; fix the `include`.

Run: `grep -rn "markedit-api\|@codemirror" dist/lib`
Expected: no matches. The library must not pull the host API into a consumer's bundle.

- [ ] **Step 6: Run the gates**

Run: `npm test && npm run lint && npm run format:check && npm run typecheck`

- [ ] **Step 7: Commit**

`dist/lib` is committed, because a git dependency has no publish step that could build it.

```bash
git add src/index.ts tests/index.test.ts dist/lib
git commit -m "feat: the library entry point and its committed build output"
```

---

## Task 5: Constants and settings

**Files:**

- Create: `src/constants.ts`, `src/settings.ts`
- Test: `tests/settings.test.ts`
- Source of the move: the `persistEnabled` half of
  `markedit-extensions/extensions/color-highlight/color-highlight.js` (lines 300-400)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:

```typescript
// src/constants.ts
export const EXTENSION_NAME = 'CSS Colors'
export const MENU_TITLE = 'Highlight Colors'
export const PREVIEW_SELECTOR = '.markdown-body'
export const SETTINGS_FILE = 'settings.json'
export const SETTINGS_NAMESPACE = 'extension.cssColors'

// src/settings.ts
export function loadEnabled(): boolean
export function persistEnabled(enabled: boolean): Promise<void>
```

`loadEnabled` defaults to `true`: painting is on unless the settings say otherwise, and the setting is read once, at
load. `persistEnabled` never throws — it reports every failure through one alert per session.

- [ ] **Step 1: Write the failing test**

`markedit-api` is a boundary, so it is mocked. The mock is a mutable object the test rebuilds per case, matching the
`load()` helper of the extension's node:test suite.

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Alert = { message: string; title: string }
type Created = { overwrites?: boolean; path: string; string: string }

const host: {
    alerts: Alert[]
    created: Created[]
    createFileResult: boolean
    directoryPaths: string[]
    files: Record<string, string>
    getFileContentError?: Error
    listFilesError?: Error
    listed: string[]
    listing?: string[] | false
    userSettings: Record<string, unknown>
} = resetHost()

function resetHost() {
    return {
        alerts: [],
        created: [],
        createFileResult: true,
        directoryPaths: [],
        files: {},
        getFileContentError: undefined,
        listFilesError: undefined,
        listed: [],
        listing: undefined,
        userSettings: {},
    }
}

vi.mock('markedit-api', () => ({
    MarkEdit: {
        createFile: async (args: Created) => {
            host.created.push({ ...args })
            return host.createFileResult
        },
        getDirectoryPath: (name: string) => {
            host.directoryPaths.push(name)
            return '/docs'
        },
        getFileContent: async (path: string) => {
            if (host.getFileContentError !== undefined) throw host.getFileContentError
            return host.files[path]
        },
        listFiles: async (path: string) => {
            host.listed.push(path)
            if (host.listFilesError !== undefined) throw host.listFilesError
            return host.listing === undefined ? Object.keys(host.files).map(key => key.slice('/docs/'.length)) : host.listing
        },
        showAlert: (alert: Alert) => {
            host.alerts.push(alert)
        },
        get userSettings() {
            return host.userSettings
        },
    },
}))

beforeEach(() => {
    Object.assign(host, resetHost())
    vi.resetModules()
})

// The module keeps one "already alerted" flag per session, so each case that
// exercises it needs a fresh module instance.
async function settings() {
    return import('../src/settings')
}

describe('loadEnabled', () => {
    it('is on when the settings key is absent', async () => {
        expect((await settings()).loadEnabled()).toBe(true)
    })

    it('is off when the settings key says so', async () => {
        host.userSettings = { 'extension.cssColors': { enabled: false } }
        expect((await settings()).loadEnabled()).toBe(false)
    })

    it('is on when the settings key holds something that is not a boolean', async () => {
        host.userSettings = { 'extension.cssColors': { enabled: 'yes' } }
        expect((await settings()).loadEnabled()).toBe(true)
    })
})

describe('persistEnabled', () => {
    it('writes settings.json and keeps every unrelated key', async () => {
        host.files['/docs/settings.json'] = JSON.stringify({
            'editor.fontSize': 14,
            'extension.copyOnSelect': { enabled: true },
        })

        await (await settings()).persistEnabled(false)

        expect(host.created).toHaveLength(1)
        expect(host.created[0].path).toBe('/docs/settings.json')
        expect(host.created[0].overwrites).toBe(true)

        const written = JSON.parse(host.created[0].string)
        expect(written['extension.cssColors']).toEqual({ enabled: false })
        expect(written['editor.fontSize']).toBe(14)
        expect(written['extension.copyOnSelect']).toEqual({ enabled: true })
        expect(host.alerts).toEqual([])
    })

    it('keeps the unrelated keys inside its own settings object', async () => {
        host.files['/docs/settings.json'] = JSON.stringify({ 'extension.cssColors': { enabled: true, note: 'keep me' } })

        await (await settings()).persistEnabled(false)

        expect(JSON.parse(host.created[0].string)['extension.cssColors']).toEqual({ enabled: false, note: 'keep me' })
    })

    it('writes an empty settings.json as holding just the one key', async () => {
        host.files['/docs/settings.json'] = ''
        await (await settings()).persistEnabled(false)
        expect(JSON.parse(host.created[0].string)).toEqual({ 'extension.cssColors': { enabled: false } })
    })

    it('writes an absent settings.json as a new file', async () => {
        await (await settings()).persistEnabled(false)
        expect(JSON.parse(host.created[0].string)).toEqual({ 'extension.cssColors': { enabled: false } })
    })

    it('takes the path from the documents directory', async () => {
        await (await settings()).persistEnabled(false)
        expect(host.directoryPaths).toEqual(['documents'])
        expect(host.listed).toEqual(['/docs'])
        expect(host.created[0].path).toBe('/docs/settings.json')
    })

    it('alerts and writes nothing for a malformed settings.json', async () => {
        host.files['/docs/settings.json'] = '{ this is not json'
        await (await settings()).persistEnabled(false)

        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
        expect(host.alerts[0].message).toMatch(/settings\.json/)
        expect(host.alerts[0].title).toBe('Highlight Colors')
    })

    it('alerts and writes nothing for a settings.json holding a non-object', async () => {
        host.files['/docs/settings.json'] = '[1, 2, 3]'
        await (await settings()).persistEnabled(false)
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    // undefined means the read failed, which is not proof that the file is absent.
    // A write then would replace every MarkEdit setting with this one key.
    it('alerts and writes nothing when a listing shows the unreadable file is present', async () => {
        host.listing = ['settings.json']
        await (await settings()).persistEnabled(false)
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts and writes nothing when the listing itself fails', async () => {
        host.listing = false
        await (await settings()).persistEnabled(false)
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts and does not throw when the file API rejects', async () => {
        host.getFileContentError = new Error('disk error')
        await expect((await settings()).persistEnabled(false)).resolves.toBeUndefined()
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts and writes nothing when listFiles rejects', async () => {
        host.listFilesError = new Error('no such directory')
        await expect((await settings()).persistEnabled(false)).resolves.toBeUndefined()
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts when the write fails', async () => {
        host.createFileResult = false
        await (await settings()).persistEnabled(false)
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts one time for each session', async () => {
        host.files['/docs/settings.json'] = '{ nope'
        const module = await settings()
        await module.persistEnabled(false)
        await module.persistEnabled(true)
        expect(host.alerts).toHaveLength(1)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/settings.test.ts`
Expected: FAIL — `Failed to resolve import "../src/settings"`.

- [ ] **Step 3: Write `src/constants.ts`**

```typescript
/** Extension display name, and the registry name the Extension Manager shows. */
export const EXTENSION_NAME = 'CSS Colors'

/** The menu item, a checkbox. It is also the title of every alert this extension raises. */
export const MENU_TITLE = 'Highlight Colors'

/**
 * MarkEdit-preview's live pane. Not an interface it publishes — it is the class
 * the renderer refills on every render — so the preview half degrades to painting
 * nothing when this finds nothing.
 */
export const PREVIEW_SELECTOR = '.markdown-body'

export const SETTINGS_FILE = 'settings.json'

/**
 * settings.json key holding this extension's settings. The `extension.` prefix is
 * required by MarkEdit's settings schema, and the rest is the package name
 * without `markedit-`, camel-cased, which is MarkEdit's convention.
 */
export const SETTINGS_NAMESPACE = 'extension.cssColors'
```

- [ ] **Step 4: Write `src/settings.ts`**

This is `persistEnabled`, `settingsAbsent`, `parseSettings`, `isPlainObject` and `alertOnce` from
`color-highlight.js`, moved and typed. The read-merge-write, the two try/catch halves, the listing proof and the
one-alert-per-session flag are unchanged in behaviour.

```typescript
import { MarkEdit } from 'markedit-api'

import { MENU_TITLE, SETTINGS_FILE, SETTINGS_NAMESPACE } from './constants'

const PARSE_FAILURE =
    `${SETTINGS_FILE} could not be read, so the setting was not saved. ` +
    'Correct the file, or the toggle will reset when you quit MarkEdit.'
const READ_FAILURE = `${SETTINGS_FILE} could not be opened, so the setting was not saved. The toggle will reset when you quit MarkEdit.`
const WRITE_FAILURE = `${SETTINGS_FILE} could not be written, so the setting was not saved. The toggle will reset when you quit MarkEdit.`

// One alert for each session. A user who toggles the item against a broken file
// does not need one alert for each attempt.
let alerted = false

/** Painting is on unless the settings say otherwise. Read once, at load. */
export function loadEnabled(): boolean {
    const root = MarkEdit.userSettings?.[SETTINGS_NAMESPACE]
    if (!isPlainObject(root)) return true

    return typeof root.enabled === 'boolean' ? root.enabled : true
}

/**
 * Read, merge one key, write back, so every unrelated setting survives. Each half
 * has its own try/catch: a rejected API call is a failure of that half, and it
 * must alert with that message instead of escaping as an unhandled rejection.
 */
export async function persistEnabled(enabled: boolean): Promise<void> {
    const read = await readSettings()
    if (read === undefined) return

    try {
        const current = isPlainObject(read.settings[SETTINGS_NAMESPACE]) ? read.settings[SETTINGS_NAMESPACE] : {}
        const merged = { ...read.settings, [SETTINGS_NAMESPACE]: { ...current, enabled } }
        const written = await MarkEdit.createFile({ overwrites: true, path: read.path, string: JSON.stringify(merged, null, 2) })
        if (!written) alertOnce(WRITE_FAILURE)
    } catch {
        alertOnce(WRITE_FAILURE)
    }
}

// Returns the path to write and the settings to merge into, or nothing when a
// write would be unsafe — in which case the alert has already been raised.
async function readSettings(): Promise<{ path: string; settings: Record<string, unknown> } | undefined> {
    try {
        const directory = MarkEdit.getDirectoryPath('documents')
        const path = `${directory}/${SETTINGS_FILE}`
        const raw = await MarkEdit.getFileContent(path)

        if (typeof raw !== 'string') {
            // undefined means the read failed, which is not proof that the file is
            // absent. A write now could replace a real settings.json with this one
            // key, so refuse until a listing proves that the file is not there.
            if (await settingsAbsent(directory)) return { path, settings: {} }

            alertOnce(READ_FAILURE)
            return undefined
        }

        if (raw.trim() === '') return { path, settings: {} }

        const parsed = parseSettings(raw)
        if (!isPlainObject(parsed)) {
            // Writing now would replace every MarkEdit setting with this one key.
            alertOnce(PARSE_FAILURE)
            return undefined
        }

        return { path, settings: parsed }
    } catch {
        alertOnce(READ_FAILURE)
        return undefined
    }
}

// Proof that the file is not there, which only a successful listing gives. A
// listing that fails, or that holds the file, proves nothing.
async function settingsAbsent(directory: string) {
    const listing = await MarkEdit.listFiles(directory)
    return Array.isArray(listing) && !listing.some(entry => entry === SETTINGS_FILE || entry.endsWith(`/${SETTINGS_FILE}`))
}

function parseSettings(raw: string): unknown {
    try {
        return JSON.parse(raw)
    } catch {
        return undefined
    }
}

// typeof null is 'object', so the null test is not redundant. JSON.parse is what
// produces null here; the rest of the file uses undefined.
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function alertOnce(message: string) {
    if (alerted) return
    alerted = true
    void MarkEdit.showAlert({ message, title: MENU_TITLE })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/settings.test.ts`
Expected: PASS. If the "listing shows the file is present" case fails, check that `settingsAbsent` throwing is caught
by `readSettings`' outer `try`, which is what turns a rejecting `listFiles` into `READ_FAILURE`.

- [ ] **Step 6: Run the gates**

Run: `npm test && npm run lint && npm run format:check && npm run typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/constants.ts src/settings.ts tests/settings.test.ts
git commit -m "feat: the settings namespace, its reader and its writer"
```

---

## Task 6: The menu item

**Files:**

- Create: `src/menu.ts`
- Test: `tests/menu.test.ts`

**Interfaces:**

- Consumes: `MENU_TITLE` from `src/constants.ts` (Task 5).
- Produces:

```typescript
export interface ColorsController {
    isEnabled(): boolean
    toggle(): void
}

export function installMenu(controller: ColorsController): void
```

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

type MenuItem = { action: () => void; state: () => { isSelected: boolean }; title: string }

const registered: MenuItem[] = []

vi.mock('markedit-api', () => ({
    MarkEdit: {
        addMainMenuItem: (item: MenuItem) => {
            registered.push(item)
        },
    },
}))

const { installMenu } = await import('../src/menu')

beforeEach(() => {
    registered.length = 0
})

function controllerOver(enabled: boolean) {
    let current = enabled
    return {
        isEnabled: () => current,
        toggle: vi.fn(() => {
            current = !current
        }),
    }
}

describe('installMenu', () => {
    it('registers one item with the exact title', () => {
        installMenu(controllerOver(true))

        expect(registered).toHaveLength(1)
        expect(registered[0].title).toBe('Highlight Colors')
    })

    it('draws its checkmark from the controller', () => {
        installMenu(controllerOver(false))
        expect(registered[0].state()).toEqual({ isSelected: false })
    })

    it('asks the controller to toggle, and the checkmark follows', () => {
        const controller = controllerOver(true)
        installMenu(controller)

        registered[0].action()

        expect(controller.toggle).toHaveBeenCalledTimes(1)
        expect(registered[0].state()).toEqual({ isSelected: false })
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/menu.test.ts`
Expected: FAIL — `Failed to resolve import "../src/menu"`.

- [ ] **Step 3: Write `src/menu.ts`**

```typescript
import { MarkEdit } from 'markedit-api'
import type { MenuItem } from 'markedit-api'

import { MENU_TITLE } from './constants'

/**
 * What the menu item needs from the extension. The item owns no state of its own:
 * the checkmark and the painters read the same boolean, and a second copy here
 * would be a second place for "is this on?" to live.
 */
export interface ColorsController {
    isEnabled(): boolean
    toggle(): void
}

export function installMenu(controller: ColorsController): void {
    MarkEdit.addMainMenuItem({
        action: () => controller.toggle(),
        state: () => ({ isSelected: controller.isEnabled() }),
        title: MENU_TITLE,
    } satisfies MenuItem)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/menu.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the gates and commit**

```bash
npm test && npm run lint && npm run format:check && npm run typecheck
git add src/menu.ts tests/menu.test.ts
git commit -m "feat: the Highlight Colors menu item"
```

---

## Task 7: The editor half

**Files:**

- Create: `src/editor.ts`
- Test: `tests/editor.test.ts`
- Source of the move: the `mark`, `editorBackground`, `buildDecorations`, `repaint` and `rebuilds` section of
  `markedit-extensions/extensions/color-highlight/color-highlight.js` (lines 250-320)

**Interfaces:**

- Consumes: `RGBA`, `WHITE`, `contrastColor`, `findColors`, `toCssColor` from `src/color.ts` (Task 2);
  `surfaceBackground` from `src/paint.ts` (Task 3).
- Produces:

```typescript
import type { DecorationSet, EditorView } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import type { Extension, StateEffectType } from '@codemirror/state'

/** A view, reduced to what the decoration build actually reads. `EditorView` satisfies it. */
export interface DecorationSource {
    contentDOM: HTMLElement
    state: EditorState
    visibleRanges: readonly { from: number; to: number }[]
}

export const repaintEffect: StateEffectType<undefined>
export function buildDecorations(view: DecorationSource, isEnabled: boolean): DecorationSet
export function colorEditorExtension(isEnabled: () => boolean): Extension
```

`buildDecorations` is exported so the test can read the decorations without constructing a real `EditorView`, which
needs a layout. It is not part of the library surface — `src/index.ts` does not re-export it.

- [ ] **Step 1: Write the failing test**

Real `@codemirror/state` and `@codemirror/view` are used: `EditorState`, `Decoration`, `RangeSetBuilder` and
`StateEffect` are all pure and run headless. The view is a fake carrying a real `EditorState` and real DOM elements,
which is what the background walk reads.

```typescript
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { buildDecorations, repaintEffect } from '../src/editor'
import type { DecorationSource } from '../src/editor'

// The exact style string the extension writes, so a test names a colour once.
const style = (rgba: string, text: string) => `background-color: ${rgba}; color: ${text}; border-radius: 3px;`

function contentDOM(backgrounds: string[]) {
    let element: HTMLElement | undefined
    for (const backgroundColor of [...backgrounds].reverse()) {
        const parent = document.createElement('div')
        parent.style.backgroundColor = backgroundColor
        if (element !== undefined) parent.appendChild(element)
        element = parent
    }

    // getComputedStyle answers only for an element in the document.
    document.body.appendChild(element ?? document.createElement('div'))
    return deepest(element ?? document.createElement('div'))
}

function deepest(element: HTMLElement): HTMLElement {
    const child = element.firstElementChild
    return child instanceof HTMLElement ? deepest(child) : element
}

function viewOf(
    text: string,
    options: { backgrounds?: string[]; visibleRanges?: { from: number; to: number }[] } = {},
): DecorationSource {
    return {
        contentDOM: contentDOM(options.backgrounds ?? ['rgb(255, 255, 255)']),
        state: EditorState.create({ doc: text }),
        visibleRanges: options.visibleRanges ?? [{ from: 0, to: text.length }],
    }
}

function painted(view: DecorationSource, isEnabled = true) {
    const ranges: { from: number; style: string; to: number }[] = []
    const cursor = buildDecorations(view, isEnabled).iter()

    while (cursor.value !== null) {
        const attributes = cursor.value.spec.attributes
        ranges.push({ from: cursor.from, style: attributes.style, to: cursor.to })
        cursor.next()
    }

    return ranges
}

beforeEach(() => {
    document.body.innerHTML = ''
})

describe('buildDecorations', () => {
    it('paints a literal with its own colour', () => {
        expect(painted(viewOf('color: #ff0000;'))).toEqual([
            { from: 7, style: style('rgba(255, 0, 0, 1)', '#000000'), to: 14 },
        ])
    })

    it('gives a dark colour white text', () => {
        expect(painted(viewOf('color: #000080;'))[0].style).toBe(style('rgba(0, 0, 128, 1)', '#ffffff'))
    })

    it('offsets a literal on a later line by that line', () => {
        expect(painted(viewOf('one\ntwo #ff0000'))).toEqual([
            { from: 8, style: style('rgba(255, 0, 0, 1)', '#000000'), to: 15 },
        ])
    })

    it('does not scan a line outside the visible ranges', () => {
        const view = viewOf('a #ff0000\nb #0000ff', { visibleRanges: [{ from: 0, to: 9 }] })
        expect(painted(view).map(range => range.from)).toEqual([2])
    })

    it('refuses a hex that opens a line, because that position is a heading', () => {
        expect(painted(viewOf('#face'))).toEqual([])
        expect(painted(viewOf('    #face'))).toEqual([])
        expect(painted(viewOf('one\n#ff0000'))).toEqual([])
    })

    it('paints a functional form that opens a line', () => {
        expect(painted(viewOf('rgb(255, 0, 0)'))).toHaveLength(1)
    })

    it('reads the background from the first ancestor that paints', () => {
        const view = viewOf('a rgba(255, 255, 255, 0.1)', { backgrounds: ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 0)'] })
        expect(painted(view)[0].style).toBe(style('rgba(255, 255, 255, 0.1)', '#ffffff'))
    })

    it('treats an editor with no usable background as white', () => {
        const view = viewOf('a rgba(255, 255, 255, 0.1)', { backgrounds: ['transparent'] })
        expect(painted(view)[0].style).toBe(style('rgba(255, 255, 255, 0.1)', '#000000'))
    })

    it('paints nothing while the extension is off', () => {
        expect(painted(viewOf('a #ff0000'), false)).toEqual([])
    })
})

describe('repaintEffect', () => {
    it('is recognised only by itself', () => {
        const effect = repaintEffect.of(undefined)
        expect(effect.is(repaintEffect)).toBe(true)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor.test.ts`
Expected: FAIL — `Failed to resolve import "../src/editor"`.

- [ ] **Step 3: Write `src/editor.ts`**

```typescript
import { Decoration, ViewPlugin } from '@codemirror/view'
import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import type { EditorState, Extension } from '@codemirror/state'

import { contrastColor, findColors, toCssColor, WHITE } from './color'
import { surfaceBackground } from './paint'
import type { RGBA } from './color'

/**
 * A view, reduced to what the decoration build actually reads. `EditorView`
 * satisfies it, and a test can supply a real `EditorState` and real elements
 * without the layout a real view needs.
 */
export interface DecorationSource {
    contentDOM: HTMLElement
    state: EditorState
    visibleRanges: readonly { from: number; to: number }[]
}

/**
 * A ViewPlugin repaints only when an update gives it a reason to, and a flip of
 * the switch changes neither the document nor the viewport. This effect is that
 * reason and nothing else: it carries no value, and `of` takes one, so it is
 * handed an undefined.
 */
export const repaintEffect = StateEffect.define<undefined>()

/**
 * Only the visible ranges are walked, so the work is bounded by the screen and
 * not by the size of the document. The background is read one time for each build
 * that paints, not one time for each colour.
 *
 * Exported for the test: reading decorations back out of a real `EditorView`
 * would mean giving the test a layout.
 */
export function buildDecorations(view: DecorationSource, isEnabled: boolean): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()

    // Off is an empty set rather than an absent plugin: this script adds its
    // extension one time, at load, and never takes it back, so the switch has to
    // sit where the work is.
    if (!isEnabled) return builder.finish()

    const background = surfaceBackground(view.contentDOM) ?? WHITE

    for (const { from, to } of view.visibleRanges) {
        let pos = from
        while (pos <= to) {
            const line = view.state.doc.lineAt(pos)
            // A sweep runs over one line, which is what makes the heading rule
            // expressible at all: "first on the line" means nothing against a slice
            // of arbitrary text.
            for (const found of findColors(line.text, { refuseLineOpeningHex: true }))
                builder.add(line.from + found.from, line.from + found.to, mark(found.color, background))

            pos = line.to + 1
        }
    }

    return builder.finish()
}

export function colorEditorExtension(isEnabled: () => boolean): Extension {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet

            constructor(view: EditorView) {
                this.decorations = buildDecorations(view, isEnabled())
            }

            update(update: ViewUpdate) {
                if (rebuilds(update)) this.decorations = buildDecorations(update.view, isEnabled())
            }
        },
        { decorations: instance => instance.decorations },
    )
}

function mark(color: RGBA, background: RGBA) {
    return Decoration.mark({
        attributes: {
            style: `background-color: ${toCssColor(color)}; color: ${contrastColor(color, background)}; border-radius: 3px;`,
        },
    })
}

function rebuilds(update: ViewUpdate) {
    if (update.docChanged) return true
    if (update.viewportChanged) return true

    return update.transactions.some(transaction => transaction.effects.some(effect => effect.is(repaintEffect)))
}
```

Note the one behaviour change forced by the move: the extension's `mark` built its style string by hand
(`rgba(${color.r}, ...)`), and `toCssColor` produces the identical string. Confirm the test's `style()` helper still
matches character for character.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/editor.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the gates and commit**

```bash
npm test && npm run lint && npm run format:check && npm run typecheck
git add src/editor.ts tests/editor.test.ts
git commit -m "feat: the editor half, as a CodeMirror view plugin"
```

---

## Task 8: The scheme-change signal

**Files:**

- Create: `src/scheme.ts`
- Test: `tests/scheme.test.ts`
- Source of the pattern: `MarkEdit-preview/src/support/colorScheme.ts` (the tracking half)

**Interfaces:**

- Consumes: `isDarkColor` from `src/color.ts` (Task 2); `surfaceBackground` from `src/paint.ts` (Task 3).
- Produces:

```typescript
export function onSchemeChange(listener: () => void): () => void
```

Acquire returns release: the subscription hands back its own unsubscribe, and the last unsubscribe tears down every
observer and listener.

Why this exists: a swatch with alpha shows the pane background through it, so its text colour is right only for the
scheme it was painted in. MarkEdit-preview handles this through its own `onColorSchemeChange`; outside it, this module
watches the same signals.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('markedit-api', () => ({ MarkEdit: { editorView: undefined } }))

const { onSchemeChange } = await import('../src/scheme')

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
const settle = async () => {
    for (const _ of [0, 1, 2]) await nextFrame()
}

let editor: HTMLElement

beforeEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''

    editor = document.createElement('div')
    editor.className = 'cm-editor'
    editor.style.backgroundColor = 'rgb(255, 255, 255)'
    document.body.appendChild(editor)
})

describe('onSchemeChange', () => {
    it('reports a scheme that actually changed', async () => {
        const listener = vi.fn()
        onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('stays quiet for a mutation burst that changes nothing', async () => {
        const listener = vi.fn()
        onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(254, 254, 254)'
        document.body.setAttribute('class', 'busy')
        await settle()

        expect(listener).not.toHaveBeenCalled()
    })

    it('coalesces a burst into one report', async () => {
        const listener = vi.fn()
        onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        document.head.appendChild(document.createElement('style'))
        document.documentElement.setAttribute('class', 'dark')
        await settle()

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('stops reporting once its release is called', async () => {
        const listener = vi.fn()
        const release = onSchemeChange(listener)
        release()

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()

        expect(listener).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/scheme.test.ts`
Expected: FAIL — `Failed to resolve import "../src/scheme"`.

- [ ] **Step 3: Write `src/scheme.ts`**

```typescript
import { MarkEdit } from 'markedit-api'

import { isDarkColor } from './color'
import { surfaceBackground } from './paint'

type Scheme = 'dark' | 'light'

const ATTRIBUTES = { attributeFilter: ['class', 'style'], attributes: true }
const DARK_QUERY = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

const tracking: {
    observer?: MutationObserver
    observedEditor?: Element
    pendingFrame?: number
    reported?: Scheme
} = {}

/**
 * Subscribe to a change in the resolved colour scheme. Returns its own release.
 *
 * The scheme is resolved from what the editor actually looks like: MarkEdit's
 * editor theme and the native window appearance move independently, and a user
 * script that swaps the editor theme never reaches `prefers-color-scheme`. With
 * no editor in the document, the media query is the answer.
 */
export function onSchemeChange(listener: () => void): () => void {
    listeners.add(listener)
    startTracking()

    return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stopTracking()
    }
}

function resolveScheme(): Scheme {
    const background = surfaceBackground(editorSurface())
    if (background !== undefined) return isDarkColor(background) ? 'dark' : 'light'

    return matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function editorSurface() {
    return MarkEdit.editorView?.contentDOM ?? document.querySelector('.cm-content') ?? document.querySelector('.cm-editor') ?? undefined
}

function startTracking() {
    if (tracking.observer !== undefined) return

    const observer = new MutationObserver(scheduleUpdate)
    tracking.observer = observer
    tracking.reported = resolveScheme()

    // A theme swap reconfigures CodeMirror's theme compartment, which appends the
    // new rules to <head> and puts a freshly generated class on `.cm-editor`. The
    // app appearance instead restyles the document root and body. Watching all
    // four, plus the media query for a host with no editor at all, covers every
    // route a scheme can change by.
    observer.observe(document.head, { childList: true })
    observer.observe(document.documentElement, ATTRIBUTES)
    observer.observe(document.body, { ...ATTRIBUTES, childList: true })
    matchMedia(DARK_QUERY).addEventListener('change', scheduleUpdate)

    observeEditor(observer)
}

function stopTracking() {
    tracking.observer?.disconnect()
    matchMedia(DARK_QUERY).removeEventListener('change', scheduleUpdate)

    if (tracking.pendingFrame !== undefined) cancelAnimationFrame(tracking.pendingFrame)

    tracking.observer = undefined
    tracking.observedEditor = undefined
    tracking.pendingFrame = undefined
    tracking.reported = undefined
}

// `.cm-editor` is absent until MarkEdit builds the editor, and the body childList
// observer above is what brings the walk back here once it appears.
function observeEditor(observer: MutationObserver) {
    const editor = document.querySelector('.cm-editor')
    if (editor === null || editor === tracking.observedEditor) return

    tracking.observedEditor = editor
    observer.observe(editor, ATTRIBUTES)
}

// Style recalculation is what answers `resolveScheme`, and a theme swap lands as
// a burst of mutations. Coalescing to one frame asks the question one time for
// the whole burst.
function scheduleUpdate() {
    if (tracking.pendingFrame !== undefined) return

    tracking.pendingFrame = requestAnimationFrame(() => {
        tracking.pendingFrame = undefined
        report()
    })
}

function report() {
    if (tracking.observer !== undefined) observeEditor(tracking.observer)

    const scheme = resolveScheme()
    if (scheme === tracking.reported) return

    tracking.reported = scheme
    listeners.forEach(listener => listener())
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/scheme.test.ts`
Expected: PASS. If the "burst that changes nothing" case fires, check that `report` compares against
`tracking.reported` and returns before notifying.

- [ ] **Step 5: Run the gates and commit**

```bash
npm test && npm run lint && npm run format:check && npm run typecheck
git add src/scheme.ts tests/scheme.test.ts
git commit -m "feat: a scheme-change signal for repainting swatches with alpha"
```

---

## Task 9: The preview half

**Files:**

- Create: `src/preview.ts`
- Test: `tests/preview.test.ts`

**Interfaces:**

- Consumes: `PREVIEW_SELECTOR` from `src/constants.ts` (Task 5); `BLACK`, `WHITE`, `isDarkColor` from `src/color.ts`
  (Task 2); `paintColorLiterals`, `removeSwatches`, `surfaceBackground` from `src/paint.ts` (Task 3); `onSchemeChange`
  from `src/scheme.ts` (Task 8).
- Produces:

```typescript
export interface PreviewPainter {
    /** Repaint now, or strip the swatches when painting has been turned off. */
    refresh(): void
    /** Release every observer and leave the pane as the renderer wrote it. */
    stop(): void
}

export function attachPreviewPainter(isEnabled: () => boolean): PreviewPainter
```

The two hard parts:

**The feedback loop.** Our own swatches mutate `.markdown-body`, which wakes our own observer. The observer is
disconnected for the duration of a paint and reconnected after; `takeRecords()` before reconnecting drops anything the
paint itself queued. Getting this wrong is an infinite repaint, which presents as the app going unresponsive rather
than as a failing test — hence the paint-counting test below.

**Pane discovery.** A `MutationObserver` on `document.body` notices the pane appearing or being replaced, and the
painter re-attaches. An absent pane paints nothing and throws nothing.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('markedit-api', () => ({ MarkEdit: { editorView: undefined } }))

// Spying on the real painter is what lets the loop test count paints without the
// module carrying a counter nobody but a test would read.
vi.mock('../src/paint', async importOriginal => {
    const actual = await importOriginal<typeof import('../src/paint')>()
    return { ...actual, paintColorLiterals: vi.fn(actual.paintColorLiterals) }
})

const { paintColorLiterals, SWATCH_CLASS } = await import('../src/paint')
const { attachPreviewPainter } = await import('../src/preview')

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
const settle = async () => {
    for (const _ of [0, 1, 2]) await nextFrame()
}

function addPane(html = '') {
    const pane = document.createElement('div')
    pane.className = 'markdown-body'
    pane.style.backgroundColor = 'rgb(255, 255, 255)'
    pane.innerHTML = html
    document.body.appendChild(pane)
    return pane
}

function swatchesIn(pane: HTMLElement) {
    return pane.querySelectorAll(`.${SWATCH_CLASS}`)
}

beforeEach(() => {
    document.body.innerHTML = ''
    vi.mocked(paintColorLiterals).mockClear()
})

describe('attachPreviewPainter', () => {
    it('paints a pane that is already there', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()

        expect(swatchesIn(pane)).toHaveLength(1)
        painter.stop()
    })

    it('paints nothing and throws nothing when there is no pane', async () => {
        expect(() => attachPreviewPainter(() => true)).not.toThrow()
        await settle()
        expect(paintColorLiterals).not.toHaveBeenCalled()
    })

    it('attaches to a pane that appears later', async () => {
        const painter = attachPreviewPainter(() => true)
        await settle()

        const pane = addPane('<p>#ff0000</p>')
        await settle()

        expect(swatchesIn(pane)).toHaveLength(1)
        painter.stop()
    })

    it('repaints when the renderer refills the pane', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()

        pane.innerHTML = '<p>#0000ff and #00ff00</p>'
        await settle()

        expect(swatchesIn(pane)).toHaveLength(2)
        painter.stop()
    })

    // The loop guard. Without the disconnect-and-drain, the swatches this paint
    // writes wake the observer and the count climbs without bound.
    it('does not wake its own observer with its own swatches', async () => {
        addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()
        await settle()

        expect(paintColorLiterals).toHaveBeenCalledTimes(1)
        painter.stop()
    })

    it('paints nothing while painting is turned off', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => false)
        await settle()

        expect(swatchesIn(pane)).toHaveLength(0)
        painter.stop()
    })

    it('strips the swatches when refresh runs with painting turned off', async () => {
        const pane = addPane('<p>before #ff0000 after</p>')
        let enabled = true
        const painter = attachPreviewPainter(() => enabled)
        await settle()
        expect(swatchesIn(pane)).toHaveLength(1)

        enabled = false
        painter.refresh()
        await settle()

        expect(swatchesIn(pane)).toHaveLength(0)
        expect(pane.innerHTML).toBe('<p>before #ff0000 after</p>')
        painter.stop()
    })

    it('leaves the pane as the renderer wrote it when it stops', async () => {
        const pane = addPane('<p>before #ff0000 after</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()

        painter.stop()

        expect(pane.innerHTML).toBe('<p>before #ff0000 after</p>')
    })

    it('stops repainting once it has stopped', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()
        painter.stop()
        vi.mocked(paintColorLiterals).mockClear()

        pane.innerHTML = '<p>#0000ff</p>'
        await settle()

        expect(paintColorLiterals).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/preview.test.ts`
Expected: FAIL — `Failed to resolve import "../src/preview"`.

- [ ] **Step 3: Write `src/preview.ts`**

```typescript
import { BLACK, isDarkColor, WHITE } from './color'
import { PREVIEW_SELECTOR } from './constants'
import { paintColorLiterals, removeSwatches, surfaceBackground } from './paint'
import { onSchemeChange } from './scheme'

export interface PreviewPainter {
    /** Repaint now, or strip the swatches when painting has been turned off. */
    refresh(): void
    /** Release every observer and leave the pane as the renderer wrote it. */
    stop(): void
}

const CONTENT = { characterData: true, childList: true, subtree: true }

/**
 * Paints MarkEdit-preview's live pane from outside, with no cooperation from it.
 *
 * `.markdown-body` and the `innerHTML` replacement on every render are
 * implementation details of MarkEdit-preview, not an interface it publishes. That
 * is a deliberate bet, the same one MarkEdit-bidirectional-preview-sync makes: it
 * works against upstream as well as any fork, and it degrades to painting nothing
 * when the pane is absent, the app is in edit-only mode, or a future release
 * changes the markup.
 */
export function attachPreviewPainter(isEnabled: () => boolean): PreviewPainter {
    const paneObserver = new MutationObserver(scheduleRepaint)
    const bodyObserver = new MutationObserver(scheduleAttach)
    const releaseScheme = onSchemeChange(scheduleRepaint)

    let attached: HTMLElement | undefined
    let pendingFrame: number | undefined

    function repaint() {
        if (attached === undefined) return

        // Our own swatches mutate the pane, which would wake our own observer and
        // repaint for ever. Disconnecting for the duration and draining the queue
        // before reconnecting is what breaks that loop.
        paneObserver.disconnect()

        if (isEnabled()) paintColorLiterals(attached, paneBackground(attached))
        else removeSwatches(attached)

        paneObserver.takeRecords()
        paneObserver.observe(attached, CONTENT)
    }

    function scheduleRepaint() {
        if (pendingFrame !== undefined) return

        pendingFrame = requestAnimationFrame(() => {
            pendingFrame = undefined
            repaint()
        })
    }

    function scheduleAttach() {
        const pane = findPreviewPane()
        if (pane === attached) return

        paneObserver.disconnect()
        attached = pane
        if (pane !== undefined) paneObserver.observe(pane, CONTENT)

        scheduleRepaint()
    }

    bodyObserver.observe(document.body, { attributeFilter: ['class', 'style'], attributes: true, childList: true, subtree: true })
    scheduleAttach()

    return {
        refresh: scheduleRepaint,
        stop: () => {
            bodyObserver.disconnect()
            paneObserver.disconnect()
            releaseScheme()

            if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
            if (attached !== undefined) removeSwatches(attached)

            attached = undefined
            pendingFrame = undefined
        },
    }
}

// Prefer a pane that is actually on the screen; a hidden one is what edit-only
// mode leaves behind, and painting it costs nothing but tells nobody anything.
function findPreviewPane() {
    const panes = Array.from(document.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR))
    return panes.find(isDisplayed) ?? panes[0]
}

function isDisplayed(element: HTMLElement) {
    return getComputedStyle(element).display !== 'none'
}

// The background a swatch with alpha shows through. Falls back to the extreme of
// the current scheme when nothing above the pane paints.
function paneBackground(pane: HTMLElement) {
    const background = surfaceBackground(pane)
    if (background !== undefined) return background

    return isDarkColor(surfaceBackground(document.body) ?? WHITE) ? BLACK : WHITE
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/preview.test.ts`
Expected: PASS. If the loop test reports more than one paint, the disconnect is happening after the mutation rather
than before it, or `takeRecords()` is missing.

- [ ] **Step 5: Run the gates and commit**

```bash
npm test && npm run lint && npm run format:check && npm run typecheck
git add src/preview.ts tests/preview.test.ts
git commit -m "feat: the preview half, painting .markdown-body from outside"
```

---

## Task 10: Wiring, the drop-in build, and the documentation

**Files:**

- Create: `main.ts`, `README.md`, `CHANGELOG.md`
- Test: `tests/main.test.ts`
- Build: `dist/markedit-css-colors.js`, `dist/lib/`

**Interfaces:**

- Consumes: `colorEditorExtension` and `repaintEffect` from `src/editor.ts` (Task 7); `installMenu` from `src/menu.ts`
  (Task 6); `attachPreviewPainter` from `src/preview.ts` (Task 9); `loadEnabled` and `persistEnabled` from
  `src/settings.ts` (Task 5); `SWATCH_CSS` from `src/paint.ts` (Task 3).
- Produces: the installable user script.

- [ ] **Step 1: Write the failing test**

`main.ts` is the entry point, so the test asserts the wiring rather than any logic: the extension is added, the menu
is installed, and a toggle reaches all three places that care.

```typescript
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

type MenuItem = { action: () => void; state: () => { isSelected: boolean }; title: string }

const host: { dispatched: unknown[]; extensions: unknown[]; menuItems: MenuItem[] } = {
    dispatched: [],
    extensions: [],
    menuItems: [],
}

vi.mock('markedit-api', () => ({
    MarkEdit: {
        addExtension: (extension: unknown) => {
            host.extensions.push(extension)
        },
        addMainMenuItem: (item: MenuItem) => {
            host.menuItems.push(item)
        },
        editorView: {
            contentDOM: undefined,
            dispatch: (spec: unknown) => {
                host.dispatched.push(spec)
            },
        },
        userSettings: {},
    },
}))

const persistEnabled = vi.fn(async () => {})
vi.mock('../src/settings', async importOriginal => {
    const actual = await importOriginal<typeof import('../src/settings')>()
    return { ...actual, persistEnabled }
})

await import('../main')

describe('the entry point', () => {
    it('adds the editor extension and the menu item', () => {
        expect(host.extensions).toHaveLength(1)
        expect(host.menuItems).toHaveLength(1)
        expect(host.menuItems[0].title).toBe('Highlight Colors')
    })

    it('injects the swatch stylesheet one time', () => {
        const sheets = Array.from(document.head.querySelectorAll('style')).filter(style =>
            style.textContent?.includes('.color-literal'),
        )
        expect(sheets).toHaveLength(1)
    })

    it('is on by default', () => {
        expect(host.menuItems[0].state()).toEqual({ isSelected: true })
    })

    it('a toggle flips the state, dispatches the repaint effect, and persists', () => {
        host.menuItems[0].action()

        expect(host.menuItems[0].state()).toEqual({ isSelected: false })
        expect(host.dispatched).toHaveLength(1)
        expect(persistEnabled).toHaveBeenCalledWith(false)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/main.test.ts`
Expected: FAIL — `Failed to resolve import "../main"`.

- [ ] **Step 3: Write `main.ts`**

```typescript
import { MarkEdit } from 'markedit-api'

import { colorEditorExtension, repaintEffect } from './src/editor'
import { installMenu } from './src/menu'
import { SWATCH_CSS } from './src/paint'
import { attachPreviewPainter } from './src/preview'
import { loadEnabled, persistEnabled } from './src/settings'

// The checkmark, the editor plugin and the preview painter all read this one
// boolean. A CodeMirror StateField holding it was considered and rejected: it
// would be a second place where "is this on?" lives, and the menu item would
// still need the module value to draw its checkmark.
let enabled = loadEnabled()

appendSwatchStyle()

const preview = attachPreviewPainter(() => enabled)
MarkEdit.addExtension(colorEditorExtension(() => enabled))

installMenu({
    isEnabled: () => enabled,
    toggle: () => {
        enabled = !enabled

        // The optional call is defensive: with no view there is nothing to
        // dispatch to, and the flip stands on its own. The write is started and
        // not awaited — the repaint is what the user is waiting on, and
        // persistEnabled reports its own failures through an alert.
        MarkEdit.editorView?.dispatch({ effects: repaintEffect.of(undefined) })
        preview.refresh()
        void persistEnabled(enabled)
    },
})

function appendSwatchStyle() {
    const style = document.createElement('style')
    style.textContent = SWATCH_CSS
    document.head.appendChild(style)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/main.test.ts`
Expected: PASS.

- [ ] **Step 5: Build both artifacts and check the bundle**

Run: `npm run build && npm run build:lib`
Run: `grep -c "require(" dist/markedit-css-colors.js`
Expected: at least one — `markedit-vite` leaves `require('markedit-api')` and the CodeMirror requires in place, which
is how the MarkEdit script runtime resolves them. If the bundle inlines them instead, the script will not load.

- [ ] **Step 6: Write `README.md`**

Sections, in order:

1. **What it does** — paints hex, `rgb()`/`rgba()` and `hsl()`/`hsla()` literals in the editor and, when
   MarkEdit-preview is installed, in the preview pane; text set to black or white by WCAG relative luminance.
1. **Install** — copy `dist/markedit-css-colors.js` into
   `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`, restart MarkEdit. Mention the Extension Manager
   entry (`markeditRegistry`).
1. **What paints** — the table from `markedit-extensions/extensions/color-highlight/README.md`, unchanged.
1. **Configure** — **Extensions → Highlight Colors**; the `extension.cssColors` key with `enabled`; note that it
   replaces `extension.colorHighlight` and `extension.markeditPreview.colorHighlight`, neither of which is migrated.
   One toggle governs both panes.
1. **What does not paint** — the refusals section from that README, unchanged, including the heading rule and why it
   is for hex only.
1. **The preview pane** — state the bet plainly, as `MarkEdit-bidirectional-preview-sync`'s README does: the pane is
   found by querying `.markdown-body`, which is MarkEdit-preview's markup rather than an interface it publishes. A
   future release may change it; the editor half is unaffected when it does. Painting is absent in edit-only mode.
1. **Quick Look** — MarkEdit-preview's Quick Look extension runs in its own WebView that user scripts never reach. It
   paints by importing this package as a library. Point at the `dist/lib` entry point and list the exported names.
1. **Develop** — `npm test`, `npm run lint`, `npm run format`, `npm run build`, `npm run build:lib`; note that both
   `dist` artifacts are committed because a git dependency has no publish step.

Delete the paragraph in the old README claiming a user script cannot reach the preview pane. It is wrong, and this
extension is the counter-example.

- [ ] **Step 7: Write `CHANGELOG.md`**

Keep a Changelog format, adhering to Semantic Versioning, matching `markedit-extensions/CHANGELOG.md`'s preamble
style. One entry:

```markdown
## [1.0.0] - 2026-09-04

### Added

- Paints CSS colour literals in the MarkEdit editor and in the MarkEdit-preview pane, with the colour they name, and
  sets the text of the literal to black or white by WCAG relative luminance. A menu item turns it on and off, and the
  state is kept in the `extension.cssColors` key of `settings.json`.
- A library entry point, `dist/lib`, exporting the parser and the DOM painter for a host that cannot load a user
  script.

### Changed

- Replaces the `color-highlight` extension of `markedit-extensions` and the colour painting of the `MarkEdit-preview`
  fork. Neither `extension.colorHighlight` nor `extension.markeditPreview.colorHighlight` is migrated; set
  `extension.cssColors` instead.
```

- [ ] **Step 8: Run every gate**

Run: `npm test && npm run lint && npm run format:check && npm run typecheck && npm run build && npm run build:lib`
Expected: all pass.

- [ ] **Step 9: Install it and look at it**

Run: `cp dist/markedit-css-colors.js ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/ && npm run reload`

Open a document holding `#ff0000`, `rgb(0 0 255)`, `hsl(120, 100%, 50%)` and `rgba(255, 255, 255, 0.1)`. Check, in
order:

1. The editor paints all four; the transparent one takes readable text.
1. Switch to side-by-side. The preview paints the same four.
1. Type in the editor. The preview repaints and the app stays responsive — an infinite repaint loop presents as the
   window locking up, not as a failing test.
1. **Extensions → Highlight Colors** off: both panes lose their swatches, and the preview text is unchanged.
1. Toggle back on, quit, reopen. The state survived, and `settings.json` holds `extension.cssColors`.

Report what you saw. If step 3 locks up, stop and fix `src/preview.ts` before committing.

- [ ] **Step 10: Commit**

```bash
git add main.ts tests/main.test.ts README.md CHANGELOG.md dist/markedit-css-colors.js dist/lib
git commit -m "feat: wire the extension, build the drop-in script, and document it"
```

---

## Task 11: Remove the extension from markedit-extensions

Repository: `../markedit-extensions`. Nothing here starts until Task 10 is green.

**Files:**

- Delete: `extensions/color-highlight/` (script, README, `test/color-highlight.test.mjs`)
- Modify: `README.md`, `CHANGELOG.md`, `package.json`

**Interfaces:**

- Consumes: the new repository exists and is green.
- Produces: nothing other repositories depend on.

- [ ] **Step 1: Confirm the repository invariants are what will judge the removal**

Run: `cd ../markedit-extensions && npm test`
Expected: PASS. `test/repo.test.mjs` asserts that every directory under `extensions/` has a README, a top-level `.js`
and a `test/` directory; that the root README links `extensions/<name>/` for every one; and that the CHANGELOG holds a
heading for the version in `package.json`. Removing the directory and its README row keeps the first two true; the
version bump is what the third one needs.

- [ ] **Step 2: Delete the extension**

```bash
git rm -r extensions/color-highlight
```

- [ ] **Step 3: Update the root README**

1. Remove the `color-highlight` row from the extensions table.
1. Rewrite the last paragraph of **Scope and limits**. It currently says a user script "cannot reach the Markdown
   preview pane", which is wrong: MarkEdit-preview renders into the same WebView, and the CSS Colors extension paints
   it from a user script. Replacement:

    ```markdown
    ## Scope and limits

    MarkEdit gives a user script the editor surface and the menu bar. It does not give the script the native window
    appearance, so an extension can change the CodeMirror editing surface but not the window chrome.

    The Markdown preview pane is a different matter. MarkEdit-preview is itself a user script rendering into the same
    WebView, so a script can find its pane and change it — with no API between them, and no promise that the markup
    stays put. [MarkEdit-CSS-Colors](https://github.com/andybp85/MarkEdit-CSS-Colors) does exactly that, and it is
    where the `color-highlight` extension went.
    ```

- [ ] **Step 4: Update the CHANGELOG and the version**

Set `"version": "2.0.0"` in `package.json`. Removing a shipped extension breaks anyone who installed it, so this is a
major bump against the repository's stated public interface — the layout of an extension directory, `install.sh`, and
the `settings.json` keys the extensions read.

```markdown
## [2.0.0] - 2026-09-04

### Removed

- `extensions/color-highlight`. It moved to its own repository,
  [MarkEdit-CSS-Colors](https://github.com/andybp85/MarkEdit-CSS-Colors), where it paints the Markdown preview pane as
  well as the editor. The settings key changed with the move: `extension.colorHighlight` is no longer read, and
  `extension.cssColors` takes its place. There is no automatic migration.

### Changed

- The **Scope and limits** section of the README said a user script cannot reach the Markdown preview pane. It can,
  because MarkEdit-preview renders into the same WebView. The paragraph is corrected.
```

- [ ] **Step 5: Run the gates**

Run: `npm test && npm run lint && npm run format:check`
Expected: PASS, with three test files fewer and no extension named `color-highlight` anywhere.

Run: `grep -rn 'color-highlight\|colorHighlight' --include='*.js' --include='*.mjs' --include='*.md' \
    --include='*.json' --include='*.sh' . | grep -v node_modules`
Expected: only the CHANGELOG entries, which are history and stay.

- [ ] **Step 6: Commit**

```bash
git add -u
git add README.md CHANGELOG.md package.json
git commit -m "feat!: remove color-highlight, which moved to MarkEdit-CSS-Colors"
```

---

## Task 12: Wire MarkEdit-preview to the package

Repository: `../MarkEdit-preview`. Nothing here starts until Task 10 is green.

**Files:**

- Delete: `src/features/colorHighlight.ts`, `src/shared/color.ts`, `styles/color-literal.css`, `tests/color.test.ts`,
  `tests/colorHighlight.test.ts`
- Modify: `package.json`, `src/quicklook/ui.ts`, `src/styling.ts`, `src/support/colorScheme.ts`,
  `src/support/settings.ts`, `src/view.ts`, `tests/view.hiddenSyntaxMode.test.ts`, `README.md`

**Interfaces:**

- Consumes: the package's public surface — `contrastColor`, `findColors`, `isDarkColor`, `luminance`,
  `paintColorLiterals`, `parseColor`, `removeSwatches`, `surfaceBackground`, `toCssColor`, `SWATCH_CLASS`,
  `SWATCH_CSS`, and the types `ColorMatch`, `FindColorsOptions`, `RGBA`.
- Produces: a fork roughly 440 lines closer to upstream, with Quick Look still painting.

- [ ] **Step 1: Add the dependency**

Add to `dependencies` in `package.json`, next to the `markedit-katex` git dependency that sets the precedent:

```json
"markedit-css-colors": "file:../MarkEdit-CSS-Colors"
```

Run: `npm install`
Run: `node -e "console.log(Object.keys(require('markedit-css-colors')).sort().join(' '))"`
Expected: the eleven exported names. If this fails, `dist/lib` was not committed in Task 4 or `exports` in the
package's `package.json` is wrong.

- [ ] **Step 2: Rewire `src/support/colorScheme.ts`**

Only the import paths change. `surfaceBackground`, `previewBackground`, `BLACK` and `WHITE` all stay: Quick Look is
`previewBackground`'s remaining caller, and `surfaceBackground` is the fork's own light/dark resolution used by
`view.ts`, `render.ts`, `search.ts`, `mermaid.ts` and `quicklook/ui.ts`.

```typescript
import { isDarkColor, parseColor } from 'markedit-css-colors'
import type { RGBA } from 'markedit-css-colors'
```

The fork keeps its own `surfaceBackground` — it is four lines, it is already there, and replacing it with the
package's identical function is a change for its own sake. Leave it.

- [ ] **Step 3: Rewire `src/support/settings.ts`**

Replace the `colorHighlight` export. The setting moved out of `extension.markeditPreview` and into the extension's own
namespace, so it is read from a second root.

```typescript
const cssColors = toObject(userSettings['extension.cssColors'])

/**
 * Whether the Quick Look host paints colour literals. The MarkEdit-CSS-Colors
 * extension owns this setting and paints the main window; Quick Look runs in its
 * own WebView that user scripts never reach, so it reads the same key and paints
 * with the same library.
 */
export const cssColorsEnabled = toBoolean(cssColors.enabled)
```

Remove `export const colorHighlight = toBoolean(rootValue.colorHighlight)`.

- [ ] **Step 4: Rewire `src/quicklook/ui.ts`**

```typescript
import { paintColorLiterals } from 'markedit-css-colors'
import { onColorSchemeChange, previewBackground } from '../support/colorScheme'
import { cssColorsEnabled } from '../support/settings'
```

Both call sites (the `onColorSchemeChange` handler at line 56 and `ensureRendered` at line 123) become:

```typescript
if (cssColorsEnabled) {
    paintColorLiterals(previewPane, previewBackground(previewPane));
}
```

Note the semicolons: this repository's style is its own, and the moved code is not moving here — it is being called
from here. Follow `MarkEdit-preview`'s existing style in `MarkEdit-preview`.

- [ ] **Step 5: Rewire `src/view.ts`**

1. Delete the `paintColorLiterals` import (line 8).
1. Remove `colorHighlight` from the `./support/settings` import (line 6), leaving `hidePreviewButtons, viewModes`.
1. Remove `colorLiteralCss` from the `./styling` import (line 20), and add `import { SWATCH_CSS } from
   'markedit-css-colors';`.
1. Line 45 becomes `appendStyle(SWATCH_CSS);`. This stays because `setUp()` runs for the Quick Look host too
   (`main.ts:44`, before `setUpQuickLook` at `main.ts:53`), and the swatch needs its border radius there.
1. Delete the `if (colorHighlight) { paintColorLiterals(previewPane); }` block in the `onColorSchemeChange` handler
   (lines 97-99), and its comment about a swatch with alpha. The extension owns the live pane now, and it has its own
   scheme watcher.
1. Delete the same block in `renderHtmlPreview` (lines 220-222).

- [ ] **Step 6: Rewire `src/styling.ts`**

Delete `import colorLiteralBase from '../styles/color-literal.css?raw';` (line 36) and the `colorLiteralCss` function
(lines 131-133).

- [ ] **Step 7: Delete the moved files and update the one test that named the setting**

```bash
git rm src/features/colorHighlight.ts src/shared/color.ts styles/color-literal.css tests/color.test.ts tests/colorHighlight.test.ts
```

In `tests/view.hiddenSyntaxMode.test.ts` line 32, the settings mock lists `colorHighlight: false`. Rename it to
`cssColorsEnabled: false`.

- [ ] **Step 8: Update the README**

1. Rewrite the **Color literals** section. Keep the table of what paints; replace the prose with a pointer:

    ```markdown
    ### Color literals

    Colour-literal painting moved to [MarkEdit-CSS-Colors](https://github.com/andybp85/MarkEdit-CSS-Colors), a separate
    user script that paints the editor and this preview pane from one toggle. Install it and set `enabled` under
    `extension.cssColors`; the `colorHighlight` key under `extension.markeditPreview` is no longer read.

    Quick Look previews still paint here, because the Quick Look extension runs in its own WebView that a user script
    cannot reach. They use the same library and read the same `extension.cssColors` key.
    ```

1. Remove `"colorHighlight": true,` from the `extension.markeditPreview` settings block.
1. Remove the `- colorHighlight:` bullet from the settings list.

- [ ] **Step 9: Run the gates**

Run: `npm test && npm run lint`
Expected: PASS, with two test files fewer.

Run: `grep -rn "colorHighlight\|colorLiteral\|shared/color" src tests styles README.md | grep -v node_modules`
Expected: no matches. Any hit is a call site the list above missed.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 10: Look at it**

Run: `npm run build`

Install both scripts, restart MarkEdit, and check that the preview paints exactly once — the extension paints it, and
the fork no longer does. Then open a Quick Look preview of a Markdown file holding a colour literal and check it
paints there too. Report what you saw.

- [ ] **Step 11: Commit**

```bash
git add -u
git add package.json package-lock.json README.md
git commit -m "feat!: take colour painting from markedit-css-colors"
```

---

## After the plan: the two steps that need a network

These are not tasks; they are done by hand, in this order, once every task above is green and committed.

1. Create `https://github.com/andybp85/MarkEdit-CSS-Colors` and push `main`.
1. Tag the extension `v1.0.0` and push the tag.
1. In `MarkEdit-preview/package.json`, change the dependency from `file:../MarkEdit-CSS-Colors` to
   `https://github.com/andybp85/MarkEdit-CSS-Colors#v1.0.0`, run `npm install`, run `npm test`, and commit. One line,
   one repository.

---

## Self-review against the spec

| Spec section | Where it lands |
| ------------------------------ | ---------------------------------------------------------- |
| Layout                         | Task 1 (scaffolding), Tasks 2-9 (one module each)           |
| Two build outputs              | Task 1 (`tsconfig.lib.json`, `.gitignore`), Tasks 4 and 10  |
| Library surface                | Task 4, pinned by a test; extended per the approved change  |
| Names and settings             | Task 5 (`src/constants.ts`), Tasks 10-12 (docs)             |
| Painting the editor            | Task 7                                                      |
| Painting the preview           | Task 9                                                      |
| The feedback loop              | Task 9, Step 1's paint-counting test                        |
| Scheme changes                 | Task 8                                                      |
| Detach                         | Task 9 (`stop`), Task 10 (the toggle path)                  |
| Tests: parser                  | Task 2, with the 29-case checklist and the count guard      |
| Tests: editor                  | Task 7                                                      |
| Tests: preview                 | Tasks 3 and 9                                               |
| Tests: menu and settings       | Tasks 5 and 6                                               |
| Tooling                        | Task 1                                                      |
| markedit-extensions            | Task 11                                                     |
| MarkEdit-preview               | Task 12                                                     |
| Sequencing 1-3                 | Tasks 1-12                                                  |
| Sequencing 4-5                 | The manual steps above                                      |
| Risk: coverage lost            | Task 2, Step 2 — case list, then a count assertion          |
| Risk: preview markup           | Task 9's module comment and Task 10's README section        |
| Risk: observer feedback loop   | Task 9, the paint-counting test and the Task 10 smoke check |
| Risk: two artifacts, one dist  | Task 1's `.gitignore`, Task 4 Step 5's emitted-file check   |
