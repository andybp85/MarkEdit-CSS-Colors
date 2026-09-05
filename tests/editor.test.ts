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

function viewOf(text: string, options: { backgrounds?: string[]; visibleRanges?: { from: number; to: number }[] } = {}): DecorationSource {
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
        expect(painted(viewOf('color: #ff0000;'))).toEqual([{ from: 7, style: style('rgba(255, 0, 0, 1)', '#000000'), to: 14 }])
    })

    it('gives a dark colour white text', () => {
        expect(painted(viewOf('color: #000080;'))[0].style).toBe(style('rgba(0, 0, 128, 1)', '#ffffff'))
    })

    it('offsets a literal on a later line by that line', () => {
        expect(painted(viewOf('one\ntwo #ff0000'))).toEqual([{ from: 8, style: style('rgba(255, 0, 0, 1)', '#000000'), to: 15 }])
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
