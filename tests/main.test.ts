// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { StateEffect } from '@codemirror/state'

import { repaintEffect } from '../src/editor'
import { SWATCH_CLASS } from '../src/paint'

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

// A real .markdown-body, in place before main.ts runs, is what makes the
// preview leg of the toggle observable rather than assumed: attachPreviewPainter
// finds it synchronously on attach, and its repaint is one requestAnimationFrame
// away, which settle() below waits out.
const pane = document.createElement('div')
pane.className = 'markdown-body'
pane.style.backgroundColor = 'rgb(255, 255, 255)'
pane.innerHTML = '<p>#ff0000</p>'
document.body.appendChild(pane)

function swatchCount() {
    return pane.querySelectorAll(`.${SWATCH_CLASS}`).length
}

// `host.dispatched` stays `unknown[]`: it is a generic recorder for whatever
// main.ts hands the mocked `dispatch`. This is the one place that has to assume
// the shape main.ts actually produces, and the guard above is what earns it.
function effectOf(spec: unknown): StateEffect<unknown> {
    if (typeof spec !== 'object' || spec === null || !('effects' in spec)) throw new Error('expected a spec with effects')

    return (spec as { effects: StateEffect<unknown> }).effects
}

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
const settle = async () => {
    for (const _ of [0, 1, 2]) await nextFrame()
}

await import('../main')
await settle()

// Captured once, before the toggle below runs, so a shuffled test order can
// never read post-toggle state back as if it were the default.
const initialMenuState = host.menuItems[0].state()
const initialSwatchCount = swatchCount()

host.menuItems[0].action()
await settle()

describe('the entry point', () => {
    it('adds the editor extension and the menu item', () => {
        expect(host.extensions).toHaveLength(1)
        expect(host.menuItems).toHaveLength(1)
        expect(host.menuItems[0].title).toBe('Highlight Colors')
    })

    it('injects the swatch stylesheet one time', () => {
        const sheets = Array.from(document.head.querySelectorAll('style')).filter(style => style.textContent?.includes('.color-literal'))
        expect(sheets).toHaveLength(1)
    })

    it('is on by default, and paints a preview pane that was already there', () => {
        expect(initialMenuState).toEqual({ isSelected: true })
        expect(initialSwatchCount).toBe(1)
    })
})

describe('a toggle', () => {
    it('flips the menu checkmark and persists the new state', () => {
        expect(host.menuItems[0].state()).toEqual({ isSelected: false })
        expect(persistEnabled).toHaveBeenCalledWith(false)
    })

    it('dispatches one transaction, carrying the repaint effect and not an unrelated one', () => {
        expect(host.dispatched).toHaveLength(1)
        expect(effectOf(host.dispatched[0]).is(repaintEffect)).toBe(true)
    })

    it('reaches the preview pane: its swatch is gone', () => {
        expect(swatchCount()).toBe(0)
    })
})
