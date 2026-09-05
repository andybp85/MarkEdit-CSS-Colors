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
    a: number;
    b: number;
    g: number;
    r: number;
}
export interface ColorMatch {
    color: RGBA;
    from: number;
    to: number;
}
export interface FindColorsOptions {
    /**
     * Refuse a hex token with nothing but whitespace before it. In Markdown
     * *source* that position belongs to a heading far more often than a color,
     * which is why the editor extension sets it. Rendered HTML has no such
     * ambiguity — the renderer already ate the `#` of a heading — so the preview
     * leaves it off and paints a literal that opens a paragraph or a table cell.
     */
    refuseLineOpeningHex?: boolean;
}
/** The two extremes, for compositing and for a background walk that finds nothing. */
export declare const BLACK: RGBA;
export declare const WHITE: RGBA;
/**
 * Returns the color a literal names, or nothing when the token is not one this
 * parser recognizes.
 */
export declare function parseColor(source: string): RGBA | undefined;
export declare function luminance({ b, g, r }: RGBA): number;
/**
 * Black or white, whichever reads on `color` once it is laid over `background`.
 */
export declare function contrastColor(color: RGBA, background: RGBA): "#000000" | "#ffffff";
export declare function isDarkColor(color: RGBA): boolean;
export declare function toCssColor({ a, b, g, r }: RGBA): string;
/**
 * Every color literal in one run of text, in order, with the offsets it spans.
 *
 * The rules that reject a candidate read the neighbouring characters, so the
 * caller decides what one run is: the editor extension sweeps a line at a time,
 * and the preview sweeps a text node.
 */
export declare function findColors(text: string, options?: FindColorsOptions): ColorMatch[];
