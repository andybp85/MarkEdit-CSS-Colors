import type { RGBA } from './color.js';
/** The class every painted literal carries, so a user can restyle a swatch. */
export declare const SWATCH_CLASS = "color-literal";
/** The whole of the swatch stylesheet. The colours themselves are inline, per literal. */
export declare const SWATCH_CSS = ".color-literal { border-radius: 3px; }\n";
/**
 * Paints `container` in place, replacing whatever it painted before. Repainting
 * is how a scheme change reaches a swatch that has alpha: the text colour of such
 * a swatch depends on the background showing through it.
 */
export declare function paintColorLiterals(container: HTMLElement, background: RGBA): void;
/**
 * Unwrapping leaves the literal as its own text node next to its neighbours;
 * `normalize` joins them back so the next sweep sees the same text a fresh render
 * would, and a literal never straddles two nodes.
 */
export declare function removeSwatches(container: HTMLElement): void;
/**
 * The first background an element or one of its ancestors actually paints.
 *
 * A content element is usually transparent and the colour lives on an ancestor,
 * so the walk continues past an answer `parseColor` does not recognise (the
 * keyword `transparent`) and past one that parses but is fully see-through.
 */
export declare function surfaceBackground(element?: Element): RGBA | undefined;
