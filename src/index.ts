/**
 * The library half of this package: the parser and the DOM painter, for a host
 * that cannot load the user script. MarkEdit-preview's Quick Look extension runs
 * in its own WebView and is the reason this entry point exists.
 */
export { contrastColor, findColors, isDarkColor, luminance, parseColor, toCssColor } from './color'
export type { ColorMatch, FindColorsOptions, RGBA } from './color'
export { paintColorLiterals, removeSwatches, surfaceBackground, SWATCH_CLASS, SWATCH_CSS } from './paint'
