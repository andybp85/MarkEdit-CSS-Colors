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
