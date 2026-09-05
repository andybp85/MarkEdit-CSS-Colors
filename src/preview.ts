import { BLACK, isDarkColor, WHITE } from './color'
import { PREVIEW_SELECTOR } from './constants'
import { paintColorLiterals, removeSwatches, surfaceBackground } from './paint'
import { onSchemeChange } from './scheme'

export interface PreviewPainter {
    /** Repaint now, or strip the swatches when painting has been turned off. */
    refresh(): void
    /** Release every observer and leave the pane as the renderer wrote it. */
    stop(): void
}

const CONTENT = { characterData: true, childList: true, subtree: true }

/**
 * Paints MarkEdit-preview's live pane from outside, with no cooperation from it.
 *
 * `.markdown-body` and the `innerHTML` replacement on every render are
 * implementation details of MarkEdit-preview, not an interface it publishes. That
 * is a deliberate bet, the same one MarkEdit-bidirectional-preview-sync makes: it
 * works against upstream as well as any fork, and it degrades to painting nothing
 * when the pane is absent, the app is in edit-only mode, or a future release
 * changes the markup.
 */
export function attachPreviewPainter(isEnabled: () => boolean): PreviewPainter {
    const paneObserver = new MutationObserver(scheduleRepaint)
    const bodyObserver = new MutationObserver(scheduleAttach)
    const releaseScheme = onSchemeChange(scheduleRepaint)

    let attached: HTMLElement | undefined
    let pendingFrame: number | undefined

    function repaint() {
        if (attached === undefined) return

        // Our own swatches mutate the pane, which would wake our own observer and
        // repaint for ever. Disconnecting for the duration and draining the queue
        // before reconnecting is what breaks that loop.
        paneObserver.disconnect()

        if (isEnabled()) paintColorLiterals(attached, paneBackground(attached))
        else removeSwatches(attached)

        paneObserver.takeRecords()
        paneObserver.observe(attached, CONTENT)
    }

    function scheduleRepaint() {
        if (pendingFrame !== undefined) return

        pendingFrame = requestAnimationFrame(() => {
            pendingFrame = undefined
            repaint()
        })
    }

    function scheduleAttach() {
        const pane = findPreviewPane()
        if (pane === attached) return

        paneObserver.disconnect()
        attached = pane
        if (pane !== undefined) paneObserver.observe(pane, CONTENT)

        scheduleRepaint()
    }

    bodyObserver.observe(document.body, { attributeFilter: ['class', 'style'], attributes: true, childList: true, subtree: true })
    scheduleAttach()

    return {
        refresh: scheduleRepaint,
        stop: () => {
            bodyObserver.disconnect()
            paneObserver.disconnect()
            releaseScheme()

            if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
            if (attached !== undefined) removeSwatches(attached)

            attached = undefined
            pendingFrame = undefined
        },
    }
}

// Prefer a pane that is actually on the screen; a hidden one is what edit-only
// mode leaves behind, and painting it costs nothing but tells nobody anything.
function findPreviewPane() {
    const panes = Array.from(document.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR))
    return panes.find(isDisplayed) ?? panes[0]
}

function isDisplayed(element: HTMLElement) {
    return getComputedStyle(element).display !== 'none'
}

// The background a swatch with alpha shows through. Falls back to the extreme of
// the current scheme when nothing above the pane paints.
function paneBackground(pane: HTMLElement) {
    const background = surfaceBackground(pane)
    if (background !== undefined) return background

    return isDarkColor(surfaceBackground(document.body) ?? WHITE) ? BLACK : WHITE
}
