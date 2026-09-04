import { contrastColor, findColors, parseColor, toCssColor } from './color';
/** The class every painted literal carries, so a user can restyle a swatch. */
export const SWATCH_CLASS = 'color-literal';
/** The whole of the swatch stylesheet. The colours themselves are inline, per literal. */
export const SWATCH_CSS = `.${SWATCH_CLASS} { border-radius: 3px; }\n`;
// A rendered diagram and rendered math both carry text nodes that look like
// prose and are not: their positions come from a layout engine, and wrapping one
// in a span moves it. Script and style hold source, not reading text.
const UNPAINTABLE = `script, style, svg, .mermaid, .katex, .${SWATCH_CLASS}`;
/**
 * Paints `container` in place, replacing whatever it painted before. Repainting
 * is how a scheme change reaches a swatch that has alpha: the text colour of such
 * a swatch depends on the background showing through it.
 */
export function paintColorLiterals(container, background) {
    removeSwatches(container);
    paintableText(container).forEach(node => paintTextNode(node, background));
}
/**
 * Unwrapping leaves the literal as its own text node next to its neighbours;
 * `normalize` joins them back so the next sweep sees the same text a fresh render
 * would, and a literal never straddles two nodes.
 */
export function removeSwatches(container) {
    const swatches = container.querySelectorAll(`.${SWATCH_CLASS}`);
    if (swatches.length === 0)
        return;
    swatches.forEach(swatch => swatch.replaceWith(document.createTextNode(swatch.textContent ?? '')));
    container.normalize();
}
/**
 * The first background an element or one of its ancestors actually paints.
 *
 * A content element is usually transparent and the colour lives on an ancestor,
 * so the walk continues past an answer `parseColor` does not recognise (the
 * keyword `transparent`) and past one that parses but is fully see-through.
 */
export function surfaceBackground(element) {
    for (let node = element; node !== undefined; node = node.parentElement ?? undefined) {
        const color = parseColor(getComputedStyle(node).backgroundColor);
        if (color !== undefined && color.a > 0)
            return color;
    }
    return undefined;
}
function paintableText(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: node => (isPaintable(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
        if (node instanceof Text)
            nodes.push(node);
    return nodes;
}
function isPaintable(node) {
    const parent = node.parentElement;
    return parent !== null && parent.closest(UNPAINTABLE) === null;
}
function paintTextNode(node, background) {
    const text = node.data;
    const matches = findColors(text);
    if (matches.length === 0)
        return;
    const painted = document.createDocumentFragment();
    let index = 0;
    for (const { color, from, to } of matches) {
        if (from > index)
            painted.appendChild(document.createTextNode(text.slice(index, from)));
        painted.appendChild(createSwatch(text.slice(from, to), color, background));
        index = to;
    }
    if (index < text.length)
        painted.appendChild(document.createTextNode(text.slice(index)));
    node.replaceWith(painted);
}
function createSwatch(literal, color, background) {
    const swatch = document.createElement('span');
    swatch.className = SWATCH_CLASS;
    swatch.textContent = literal;
    swatch.style.backgroundColor = toCssColor(color);
    swatch.style.color = contrastColor(color, background);
    return swatch;
}
