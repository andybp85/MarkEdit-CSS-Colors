/**
 * CSS colour literal parsing.
 *
 * The parser is deliberately conservative: a token it does not recognise is
 * reported as nothing rather than painted with a guessed colour. It also reads
 * back what `getComputedStyle` reports, which is the old comma syntax, so it
 * doubles as the reader for element background colours.
 */

/** Channels in 0..255, alpha in 0..1. */
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
    /**
     * Refuse a hex token with nothing but whitespace before it. In Markdown
     * *source* that position belongs to a heading far more often than a color,
     * which is why the editor extension sets it. Rendered HTML has no such
     * ambiguity — the renderer already ate the `#` of a heading — so the preview
     * leaves it off and paints a literal that opens a paragraph or a table cell.
     */
    refuseLineOpeningHex?: boolean
}

/**
 * The contrast ratio against white is 1.05 / (L + 0.05) and against black is
 * (L + 0.05) / 0.05. They are equal at L = 0.17912878, so above that black
 * reads better and below it white does. Doubles as the light/dark threshold
 * for a surface background.
 */
const LUMINANCE_THRESHOLD = 0.179

/** The two extremes, for compositing and for a background walk that finds nothing. */
export const BLACK: RGBA = { a: 1, b: 0, g: 0, r: 0 }
export const WHITE: RGBA = { a: 1, b: 255, g: 255, r: 255 }

// A candidate is a shape that could be a color. It is deliberately loose:
// parseColor is what decides. The run of hex digits is greedy, so a candidate
// is never a prefix cut out of the middle of a longer run — it always takes the
// whole run, however long, and parseColor rejects the lengths it does not
// recognize. `\b` before the functional forms stops `srgb(` from matching, and
// `[^()\n]*` keeps a candidate inside one line and refuses a nested
// parenthesis such as `calc()`.
const CANDIDATE = /#[0-9a-f]+|\b(?:rgb|hsl)a?\([^()\n]*\)/gi

const HEX_LENGTHS = new Set([3, 4, 6, 8])

// One argument of a functional form: an optional sign, digits with an optional
// decimal point, and an optional percent. Anything else — `none`, a unit this
// parser does not know, a nested call — is not a number here, and a token that
// is not a color is left alone rather than painted wrongly.
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(%?)$/

/**
 * Returns the color a literal names, or nothing when the token is not one this
 * parser recognizes.
 */
export function parseColor(source: string): RGBA | undefined {
    if (source.startsWith('#')) return parseHex(source)

    const open = source.indexOf('(')
    if (open === -1 || !source.endsWith(')')) return undefined

    const args = parseArgs(source.slice(open + 1, -1))
    if (args === undefined) return undefined

    const a = parseAlpha(args.alpha)
    if (a === undefined) return undefined

    const form = source.slice(0, open).toLowerCase()
    if (form === 'rgb' || form === 'rgba') return parseRgbChannels(args.channels, a)

    if (form === 'hsl' || form === 'hsla') return parseHslChannels(args.channels, a)

    return undefined
}

export function luminance({ b, g, r }: RGBA) {
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Black or white, whichever reads on `color` once it is laid over `background`.
 */
export function contrastColor(color: RGBA, background: RGBA) {
    return luminance(over(color, background)) > LUMINANCE_THRESHOLD ? '#000000' : '#ffffff'
}

export function isDarkColor(color: RGBA) {
    return luminance(color) <= LUMINANCE_THRESHOLD
}

export function toCssColor({ a, b, g, r }: RGBA) {
    return `rgba(${r}, ${g}, ${b}, ${a})`
}

/**
 * Every color literal in one run of text, in order, with the offsets it spans.
 *
 * The rules that reject a candidate read the neighbouring characters, so the
 * caller decides what one run is: the editor extension sweeps a line at a time,
 * and the preview sweeps a text node.
 */
export function findColors(text: string, options: FindColorsOptions = {}): ColorMatch[] {
    const found: ColorMatch[] = []
    CANDIDATE.lastIndex = 0

    for (let match = CANDIDATE.exec(text); match !== null; match = CANDIDATE.exec(text)) {
        const source = match[0]
        const from = match.index
        const to = from + source.length

        if (source.startsWith('#') && refusesHexLead(text, from, options)) continue

        // Asked of every candidate, hex or functional: `\b` in CANDIDATE anchors
        // only the left of `rgb`/`hsl` and says nothing about what follows the
        // closing parenthesis, and a color token glued to trailing identifier text
        // is not a color literal in either form. A hex match ends on its own —
        // CANDIDATE matches only hex digits, so #abcdefgh matches #abcdef and stops
        // at "g" rather than absorbing it — and that is exactly the case this
        // rejects: the digit run continues a word instead of standing on its own.
        if (isWordish(text[to])) continue

        const color = parseColor(source)
        if (color !== undefined) found.push({ color, from, to })
    }

    return found
}

// What the eye sees: a transparent color laid over what is behind it. An opaque
// color is already what the eye sees, so that branch copies the three channels.
// Neither branch carries an alpha: the return is a final composited value, not
// a color still waiting to be laid over something.
function over(color: RGBA, background: RGBA) {
    if (color.a >= 1) return { a: 1, b: color.b, g: color.g, r: color.r }

    return {
        a: 1,
        b: color.b * color.a + background.b * (1 - color.a),
        g: color.g * color.a + background.g * (1 - color.a),
        r: color.r * color.a + background.r * (1 - color.a),
    }
}

function linearize(value: number) {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function clamp(value: number, low: number, high: number) {
    return Math.min(high, Math.max(low, value))
}

// Every alpha computed from a parsed number passes through here, so the number
// in the CSS stays short: 0x80 / 255 is 0.5019607843137255 and becomes 0.502.
// The default for a color that states no alpha is a bare 1, which has nothing
// to round.
function roundAlpha(alpha: number) {
    return Math.round(alpha * 1000) / 1000
}

function parseNumber(token: string) {
    const match = NUMBER.exec(token)
    if (match === null) return undefined

    return { isPercent: match[1] === '%', value: Number.parseFloat(token) }
}

// Split the inside of a functional form into three channels and an alpha. The
// alpha comes after a slash in the current syntax and as a fourth comma
// argument in the old one, and both are accepted.
function parseArgs(inner: string) {
    const slash = inner.indexOf('/')
    const head = slash === -1 ? inner : inner.slice(0, slash)
    let alpha = slash === -1 ? undefined : inner.slice(slash + 1).trim()

    const source = head.includes(',') ? head.split(',') : head.trim().split(/\s+/)
    const channels = source.map(part => part.trim())
    if (channels.length === 4 && alpha === undefined) alpha = channels.pop()

    if (channels.length !== 3 || channels.some(part => part === '') || alpha === '') return undefined

    return { alpha, channels }
}

function parseAlpha(token?: string) {
    if (token === undefined) return 1

    const number = parseNumber(token)
    if (number === undefined) return undefined

    return roundAlpha(clamp(number.isPercent ? number.value / 100 : number.value, 0, 1))
}

// A percentage is of 255; a plain number is already 0..255.
function rgbChannel(token: string) {
    const number = parseNumber(token)
    if (number === undefined) return undefined

    return Math.round(clamp(number.isPercent ? (number.value / 100) * 255 : number.value, 0, 255))
}

function parseRgbChannels(channels: string[], a: number): RGBA | undefined {
    const [r, g, b] = channels.map(rgbChannel)
    if (r === undefined || g === undefined || b === undefined) return undefined

    return { a, b, g, r }
}

function parseHslChannels(channels: string[], a: number): RGBA | undefined {
    const hue = parseHue(channels[0])
    const saturation = parseNumber(channels[1])
    const lightness = parseNumber(channels[2])
    if (hue === undefined || saturation === undefined || lightness === undefined) return undefined

    // Saturation and lightness are read as 0..100 whether or not the percent is
    // written, so `hsl(0 100 50)` is the color `hsl(0, 100%, 50%)` names.
    return {
        a,
        ...hslToRgb(hue.value, clamp(saturation.value, 0, 100) / 100, clamp(lightness.value, 0, 100) / 100),
    }
}

function parseHex(source: string): RGBA | undefined {
    const digits = source.slice(1)
    if (!HEX_LENGTHS.has(digits.length)) return undefined

    // The short forms double each digit: #f8c is #ff88cc, #f8c4 is #ff88cc44.
    const full = digits.length <= 4 ? [...digits].map(digit => digit + digit).join('') : digits
    const channel = (index: number) => Number.parseInt(full.slice(index * 2, index * 2 + 2), 16)

    return {
        a: full.length === 8 ? roundAlpha(channel(3) / 255) : 1,
        b: channel(2),
        g: channel(1),
        r: channel(0),
    }
}

// A hue is degrees, written bare or with `deg`. Stripping that suffix leaves a
// bare number; any other angle unit stays in the token and NUMBER refuses it,
// so `rad`, `grad` and `turn` — rare in a hand-written color — leave the token
// unpainted rather than painted as some other color. NUMBER does accept a
// trailing percent, because the other two hsl() arguments are percentages; a
// hue is not one in any CSS syntax, so it is refused here.
function parseHue(token: string) {
    const hue = parseNumber(token.replace(/deg$/i, ''))
    return hue?.isPercent === true ? undefined : hue
}

// The chroma form of the CSS conversion. `h` is degrees, `s` and `l` are 0..1.
// `chroma` is the spread between the largest and the smallest channel, `sector`
// places the hue on one of the six ramps between the primaries and the
// secondaries, and `second` is the middle channel, which rises or falls across
// the sector the hue landed on. Adding `base` to all three puts the midpoint of
// the largest and the smallest back at `l`.
function hslToRgb(h: number, s: number, l: number) {
    const chroma = (1 - Math.abs(2 * l - 1)) * s
    const sector = (((h % 360) + 360) % 360) / 60
    const second = chroma * (1 - Math.abs((sector % 2) - 1))
    const base = l - chroma / 2

    const ramps = [
        [chroma, second, 0],
        [second, chroma, 0],
        [0, chroma, second],
        [0, second, chroma],
        [second, 0, chroma],
        [chroma, 0, second],
    ]

    const [r, g, b] = ramps[Math.min(Math.floor(sector), 5)]
    return {
        b: Math.round((b + base) * 255),
        g: Math.round((g + base) * 255),
        r: Math.round((r + base) * 255),
    }
}

// Everything before `index` is whitespace, so the token opens the run.
function opensLine(text: string, index: number) {
    return text.slice(0, index).trim() === ''
}

// A lookbehind in CANDIDATE would be shorter than reading the neighbour out of
// the text, but the WebView that runs this is not guaranteed to have one. A
// missing neighbour is the start or the end of the run.
function isWordish(character?: string) {
    return /[\w#]/.test(character ?? '')
}

// What disqualifies a hex candidate on its left: it continues a word, or — when
// the caller asks — it opens the run. Both are `#` phenomena, so neither is
// asked of a functional form: one that opens a line is a real color, not a
// heading.
function refusesHexLead(text: string, index: number, options: FindColorsOptions) {
    if (isWordish(text[index - 1])) return true

    return options.refuseLineOpeningHex === true && opensLine(text, index)
}
