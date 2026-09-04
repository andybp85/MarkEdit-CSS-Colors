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
