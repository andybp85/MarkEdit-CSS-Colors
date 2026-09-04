import { MarkEdit } from 'markedit-api'

import { isDarkColor } from './color'
import { surfaceBackground } from './paint'

type Scheme = 'dark' | 'light'

const ATTRIBUTES = { attributeFilter: ['class', 'style'], attributes: true }
const DARK_QUERY = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

const tracking: {
    observer?: MutationObserver
    observedEditor?: Element
    pendingFrame?: number
    reported?: Scheme
} = {}

/**
 * Subscribe to a change in the resolved colour scheme. Returns its own release.
 *
 * The scheme is resolved from what the editor actually looks like: MarkEdit's
 * editor theme and the native window appearance move independently, and a user
 * script that swaps the editor theme never reaches `prefers-color-scheme`. With
 * no editor in the document, the media query is the answer.
 */
export function onSchemeChange(listener: () => void): () => void {
    listeners.add(listener)
    startTracking()

    // A subscriber should hear about a change from here on, never one already in
    // flight (mutated, not yet reported) when it joined: resync the baseline on
    // every subscribe, not only the one that starts tracking.
    tracking.reported = resolveScheme()

    return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stopTracking()
    }
}

function resolveScheme(): Scheme {
    const background = surfaceBackground(editorSurface())
    if (background !== undefined) return isDarkColor(background) ? 'dark' : 'light'

    return matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function editorSurface() {
    return MarkEdit.editorView?.contentDOM ?? document.querySelector('.cm-content') ?? document.querySelector('.cm-editor') ?? undefined
}

function startTracking() {
    if (tracking.observer !== undefined) return

    const observer = new MutationObserver(scheduleUpdate)
    tracking.observer = observer

    // A theme swap reconfigures CodeMirror's theme compartment, which appends the
    // new rules to <head> and puts a freshly generated class on `.cm-editor`. The
    // app appearance instead restyles the document root and body. Watching all
    // four, plus the media query for a host with no editor at all, covers every
    // route a scheme can change by.
    observer.observe(document.head, { childList: true })
    observer.observe(document.documentElement, ATTRIBUTES)
    observer.observe(document.body, { ...ATTRIBUTES, childList: true })
    matchMedia(DARK_QUERY).addEventListener('change', scheduleUpdate)

    observeEditor(observer)
}

function stopTracking() {
    tracking.observer?.disconnect()
    matchMedia(DARK_QUERY).removeEventListener('change', scheduleUpdate)

    if (tracking.pendingFrame !== undefined) cancelAnimationFrame(tracking.pendingFrame)

    tracking.observer = undefined
    tracking.observedEditor = undefined
    tracking.pendingFrame = undefined
    tracking.reported = undefined
}

// `.cm-editor` is absent until MarkEdit builds the editor, and the body childList
// observer above is what brings the walk back here once it appears.
function observeEditor(observer: MutationObserver) {
    const editor = document.querySelector('.cm-editor')
    if (editor === null || editor === tracking.observedEditor) return

    tracking.observedEditor = editor
    observer.observe(editor, ATTRIBUTES)
}

// Style recalculation is what answers `resolveScheme`, and a theme swap lands as
// a burst of mutations. Coalescing to one frame asks the question one time for
// the whole burst.
function scheduleUpdate() {
    if (tracking.pendingFrame !== undefined) return

    tracking.pendingFrame = requestAnimationFrame(() => {
        tracking.pendingFrame = undefined
        report()
    })
}

function report() {
    if (tracking.observer !== undefined) observeEditor(tracking.observer)

    const scheme = resolveScheme()
    if (scheme === tracking.reported) return

    tracking.reported = scheme
    listeners.forEach(listener => listener())
}
