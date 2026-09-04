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

    it('reads rgb() in the comma syntax and the space syntax', () => {
        expect(parseColor('rgb(255, 0, 0)')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
        expect(parseColor('rgb(255 0 0)')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
    })

    it('reads a percentage channel as the equivalent number', () => {
        expect(parseColor('rgb(100%, 0%, 0%)')).toEqual(parseColor('rgb(255, 0, 0)'))
    })

    it('parses uppercase RGB()', () => {
        expect(parseColor('RGB(255, 0, 0)')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
    })

    it('reads rgba() alpha in all three spellings', () => {
        expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual({ a: 0.5, b: 0, g: 0, r: 255 })
        expect(parseColor('rgb(255 0 0 / 0.5)')).toEqual({ a: 0.5, b: 0, g: 0, r: 255 })
        expect(parseColor('rgb(255 0 0 / 50%)')).toEqual({ a: 0.5, b: 0, g: 0, r: 255 })
    })

    it('converts the hsl() primaries and secondaries', () => {
        expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
        expect(parseColor('hsl(60, 100%, 50%)')).toEqual({ a: 1, b: 0, g: 255, r: 255 })
        expect(parseColor('hsl(120, 100%, 50%)')).toEqual({ a: 1, b: 0, g: 255, r: 0 })
        expect(parseColor('hsl(240, 100%, 50%)')).toEqual({ a: 1, b: 255, g: 0, r: 0 })
    })

    it('reads zero saturation as a grey of the lightness', () => {
        expect(parseColor('hsl(0, 0%, 50%)')).toEqual({ a: 1, b: 128, g: 128, r: 128 })
        expect(parseColor('hsl(210, 0%, 0%)')).toEqual({ a: 1, b: 0, g: 0, r: 0 })
        expect(parseColor('hsl(210, 0%, 100%)')).toEqual({ a: 1, b: 255, g: 255, r: 255 })
    })

    it('wraps a hue outside 0..360 in both directions', () => {
        expect(parseColor('hsl(480, 100%, 50%)')).toEqual(parseColor('hsl(120, 100%, 50%)'))
        expect(parseColor('hsl(-120, 100%, 50%)')).toEqual(parseColor('hsl(240, 100%, 50%)'))
    })

    it('reads the hsl() space syntax, a deg hue, an alpha, and hsla()', () => {
        expect(parseColor('hsl(0deg 100% 50%)')).toEqual({ a: 1, b: 0, g: 0, r: 255 })
        expect(parseColor('hsl(0deg 100% 50% / 50%)')).toEqual({ a: 0.5, b: 0, g: 0, r: 255 })
        expect(parseColor('hsla(0, 100%, 50%, 0.5)')).toEqual({ a: 0.5, b: 0, g: 0, r: 255 })
    })

    it('reads saturation and lightness the same with or without the percent', () => {
        expect(parseColor('hsl(0 100 50)')).toEqual(parseColor('hsl(0, 100%, 50%)'))
    })

    it('reads back what getComputedStyle reports', () => {
        expect(parseColor('rgb(13, 17, 23)')).toEqual({ a: 1, b: 23, g: 17, r: 13 })
        expect(parseColor('rgba(0, 0, 0, 0)')).toEqual({ a: 0, b: 0, g: 0, r: 0 })
    })

    it('refuses a wrong argument count', () => {
        expect(parseColor('rgb(1, 2)')).toBeUndefined()
        expect(parseColor('rgb(1, 2, 3, 4, 5)')).toBeUndefined()
        expect(parseColor('rgb()')).toBeUndefined()
    })

    it('refuses an unparseable channel', () => {
        expect(parseColor('rgb(a, b, c)')).toBeUndefined()
        expect(parseColor('rgb(none, 0, 0)')).toBeUndefined()
    })

    it('refuses a word ending in rgb as a functional form', () => {
        expect(parseColor('srgb(255, 0, 0)')).toBeUndefined()
    })

    it('refuses an unparseable alpha', () => {
        expect(parseColor('rgba(255, 0, 0, half)')).toBeUndefined()
        expect(parseColor('rgb(255 0 0 / )')).toBeUndefined()
    })

    it('refuses a hue in an angle unit it does not know', () => {
        expect(parseColor('hsl(1turn, 100%, 50%)')).toBeUndefined()
        expect(parseColor('hsl(0.5turn, 100%, 50%)')).toBeUndefined()
        expect(parseColor('hsl(1rad, 100%, 50%)')).toBeUndefined()
    })

    it('refuses a percentage hue', () => {
        expect(parseColor('hsl(50%, 100%, 50%)')).toBeUndefined()
        expect(parseColor('hsl(50% 100% 50%)')).toBeUndefined()
    })

    it('refuses a form it does not recognise', () => {
        expect(parseColor('oklch(0.7 0.1 200)')).toBeUndefined()
        expect(parseColor('tomato')).toBeUndefined()
    })

    // Every source string in the list above that `parseColor` must refuse outright.
    // findColors-only refusals (a token glued to a word) do not belong here: the
    // parser reads those strings happily and it is the sweep that rejects them.
    const REFUSAL_COUNT = 19
    const REFUSALS = [
        '#',
        '#1',
        '#12345',
        '#1234567',
        'rgb(1, 2)',
        'rgb(1, 2, 3, 4, 5)',
        'rgb()',
        'rgb(a, b, c)',
        'rgb(none, 0, 0)',
        'srgb(255, 0, 0)',
        'rgba(255, 0, 0, half)',
        'rgb(255 0 0 / )',
        'hsl(1turn, 100%, 50%)',
        'hsl(0.5turn, 100%, 50%)',
        'hsl(1rad, 100%, 50%)',
        'hsl(50%, 100%, 50%)',
        'hsl(50% 100% 50%)',
        'oklch(0.7 0.1 200)',
        'tomato',
    ]

    it('refuses every form the two source suites recorded', () => {
        // The extension's suite was the only thorough description of what the parser
        // refuses and why. Dropping a case here drops a refusal from the record.
        expect(REFUSALS.filter(source => parseColor(source) !== undefined)).toEqual([])
        expect(REFUSALS).toHaveLength(REFUSAL_COUNT)
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

    it('refuses a hex glued to a leading word character', () => {
        expect(findColors('word#ff0000')).toEqual([])
        expect(findColors('a ##ff0000')).toEqual([])
        expect(findColors('page#abc')).toEqual([])
    })

    it('refuses a candidate glued to a trailing word character', () => {
        expect(findColors('#abcdefgh')).toEqual([])
        expect(findColors('a #abcdefgh')).toEqual([])
        expect(findColors('rgb(255, 0, 0)word')).toEqual([])
        expect(findColors('a rgb(255, 0, 0)word')).toEqual([])
    })

    // The last line here is the heading rule applying to hex only: a functional
    // form that opens the run is still a real colour, not a heading.
    it('refuses a hex that opens the run only when asked to', () => {
        expect(findColors('#ff0000 is red')).toHaveLength(1)
        expect(findColors('#face', { refuseLineOpeningHex: true })).toEqual([])
        expect(findColors('    #face', { refuseLineOpeningHex: true })).toEqual([])
        expect(findColors('rgb(255 0 0)', { refuseLineOpeningHex: true })).toHaveLength(1)
    })

    it('refuses a hex opening a later line when the caller passes that line alone', () => {
        expect(findColors('#ff0000', { refuseLineOpeningHex: true })).toEqual([])
    })

    it('accepts a hex after a list marker or a word', () => {
        expect(findColors('- #ff0000')).toHaveLength(1)
        expect(findColors('The brand is #ff0000')).toHaveLength(1)
        expect(findColors('color: #ff0000;')).toHaveLength(1)
    })

    it('does not find a candidate inside a nested parenthesis', () => {
        expect(findColors('a rgb(calc(1px), 0, 0)')).toEqual([])
    })

    it('finds nothing in text carrying no literal, or in the empty string', () => {
        expect(findColors('no colors here')).toEqual([])
        expect(findColors('')).toEqual([])
    })
})
