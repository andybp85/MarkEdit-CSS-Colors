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
