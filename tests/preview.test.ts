// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

vi.mock('markedit-api', () => ({ MarkEdit: { editorView: undefined } }))

// Spying on the real painter is what lets the loop test count paints without the
// module carrying a counter nobody but a test would read.
vi.mock('../src/paint', async importOriginal => {
    const actual = await importOriginal<typeof import('../src/paint')>()
    return { ...actual, paintColorLiterals: vi.fn(actual.paintColorLiterals) }
})

const { paintColorLiterals, SWATCH_CLASS } = await import('../src/paint')
const { attachPreviewPainter } = await import('../src/preview')

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
const settle = async () => {
    for (const _ of [0, 1, 2]) await nextFrame()
}

function addPane(html = '') {
    const pane = document.createElement('div')
    pane.className = 'markdown-body'
    pane.style.backgroundColor = 'rgb(255, 255, 255)'
    pane.innerHTML = html
    document.body.appendChild(pane)
    return pane
}

function swatchesIn(pane: HTMLElement) {
    return pane.querySelectorAll(`.${SWATCH_CLASS}`)
}

beforeEach(() => {
    document.body.innerHTML = ''
    document.body.style.cssText = ''
    vi.mocked(paintColorLiterals).mockClear()
})

describe('attachPreviewPainter', () => {
    it('paints a pane that is already there', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()

        expect(swatchesIn(pane)).toHaveLength(1)
        painter.stop()
    })

    it('paints nothing and throws nothing when there is no pane', async () => {
        let painter: ReturnType<typeof attachPreviewPainter> | undefined
        expect(() => (painter = attachPreviewPainter(() => true))).not.toThrow()
        await settle()

        expect(paintColorLiterals).not.toHaveBeenCalled()
        painter?.stop()
    })

    it('attaches to a pane that appears later', async () => {
        const painter = attachPreviewPainter(() => true)
        await settle()

        const pane = addPane('<p>#ff0000</p>')
        await settle()

        expect(swatchesIn(pane)).toHaveLength(1)
        painter.stop()
    })

    it('repaints when the renderer refills the pane', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()

        pane.innerHTML = '<p>#0000ff and #00ff00</p>'
        await settle()

        expect(swatchesIn(pane)).toHaveLength(2)
        painter.stop()
    })

    // The loop guard. Without the disconnect-and-drain, the swatches this paint
    // writes wake the observer and the count climbs without bound.
    it('does not wake its own observer with its own swatches', async () => {
        addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()
        await settle()

        expect(paintColorLiterals).toHaveBeenCalledTimes(1)
        painter.stop()
    })

    it('paints nothing while painting is turned off', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => false)
        await settle()

        expect(swatchesIn(pane)).toHaveLength(0)
        painter.stop()
    })

    it('strips the swatches when refresh runs with painting turned off', async () => {
        const pane = addPane('<p>before #ff0000 after</p>')
        let enabled = true
        const painter = attachPreviewPainter(() => enabled)
        await settle()
        expect(swatchesIn(pane)).toHaveLength(1)

        enabled = false
        painter.refresh()
        await settle()

        expect(swatchesIn(pane)).toHaveLength(0)
        expect(pane.innerHTML).toBe('<p>before #ff0000 after</p>')
        painter.stop()
    })

    it('leaves the pane as the renderer wrote it when it stops', async () => {
        const pane = addPane('<p>before #ff0000 after</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()

        painter.stop()

        expect(pane.innerHTML).toBe('<p>before #ff0000 after</p>')
    })

    it('stops repainting once it has stopped', async () => {
        const pane = addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()
        painter.stop()
        vi.mocked(paintColorLiterals).mockClear()

        pane.innerHTML = '<p>#0000ff</p>'
        await settle()

        expect(paintColorLiterals).not.toHaveBeenCalled()
    })
})

// A pane with no background of its own, so `paneBackground` walks past it to
// whatever paints behind it — here, `document.body` — instead of stopping at
// the pane itself, the way every `addPane` pane above does.
function addPaneWithoutBackground(html: string) {
    const pane = document.createElement('div')
    pane.className = 'markdown-body'
    pane.innerHTML = html
    document.body.appendChild(pane)
    return pane
}

// `MediaQueryList#addEventListener('change', ...)` is `onSchemeChange`'s fallback
// wiring when no editor is in the document (see tests/scheme.test.ts, which
// established this technique): matchMedia() hands back a fresh instance on every
// call, so the only reliable way to find the one a subscription actually attached
// to is to spy on the shared prototype and read back which instance each call
// landed on.
function changeTargetsOf(addEventListenerSpy: MockInstance<EventTarget['addEventListener']>) {
    return addEventListenerSpy.mock.calls
        .map((call, index) => (call[0] === 'change' ? addEventListenerSpy.mock.contexts[index] : undefined))
        .filter((target): target is EventTarget => target !== undefined)
}

// matchMedia() hands back a fresh MediaQueryList on every call, but happy-dom (and
// browsers) put its `addEventListener` on one shared prototype — the only stable
// place to spy from, since a freshly obtained instance is never the one a
// subscription actually attached its listener to.
function mediaQueryListPrototype(): EventTarget {
    return Object.getPrototypeOf(matchMedia('(prefers-color-scheme: dark)'))
}

describe('scheme changes', () => {
    // scheme.ts keeps one shared observer/listener registry (see tests/scheme.test.ts's
    // own convention), and startTracking() is a no-op while it is already live. A
    // leaked subscription from a previous test would silently swallow a later test's
    // own subscribe rather than failing it — resetting per test is what makes each
    // one prove something about its own attach/stop cycle rather than about whichever
    // cycle happened to run first.
    beforeEach(() => {
        vi.resetModules()
    })

    async function preview() {
        return import('../src/preview')
    }

    it('repaints an alpha swatch to match a scheme change', async () => {
        const { attachPreviewPainter } = await preview()

        const editor = document.createElement('div')
        editor.className = 'cm-editor'
        editor.style.backgroundColor = 'rgb(255, 255, 255)'
        document.body.appendChild(editor)
        document.body.style.backgroundColor = 'rgb(255, 255, 255)'

        // 50% gray composites to a light gray on white (dark text reads) and a dark
        // gray on black (light text reads) — an observable, not a stubbed, effect.
        const pane = addPaneWithoutBackground('<p>rgba(128, 128, 128, 0.5)</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()

        const swatchOnLight = pane.querySelector<HTMLElement>(`.${SWATCH_CLASS}`)
        expect(swatchOnLight?.style.color).toBe('#000000')

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        document.body.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()

        const swatchOnDark = pane.querySelector<HTMLElement>(`.${SWATCH_CLASS}`)
        expect(swatchOnDark?.style.color).toBe('#ffffff')

        painter.stop()
    })

    it('releases the scheme subscription so a later scheme change schedules no work', async () => {
        // No editor: resolveScheme falls back to the media query, the one signal
        // `onSchemeChange` always wires regardless of what else is in the document.
        const addEventListenerSpy = vi.spyOn(mediaQueryListPrototype(), 'addEventListener')

        const { attachPreviewPainter } = await preview()
        addPane('<p>#ff0000</p>')
        const painter = attachPreviewPainter(() => true)
        await settle()
        painter.stop()

        // dispatchEvent runs the listener synchronously, so a requestAnimationFrame
        // spy checked right after is untainted by settle()'s own frame-waiting calls.
        const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame')
        changeTargetsOf(addEventListenerSpy).forEach(target => target.dispatchEvent(new Event('change')))

        expect(requestAnimationFrameSpy).not.toHaveBeenCalled()

        requestAnimationFrameSpy.mockRestore()
        addEventListenerSpy.mockRestore()
    })

    it('a second attach-then-stop cycle leaves nothing subscribed either', async () => {
        const addEventListenerSpy = vi.spyOn(mediaQueryListPrototype(), 'addEventListener')

        const { attachPreviewPainter } = await preview()
        addPane('<p>#ff0000</p>')

        const first = attachPreviewPainter(() => true)
        await settle()
        first.stop()

        const second = attachPreviewPainter(() => true)
        await settle()
        second.stop()

        // Two cycles, two fresh MediaQueryList instances (one per subscribe): dispatch
        // on every instance either cycle attached to, and none should schedule work.
        const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame')
        changeTargetsOf(addEventListenerSpy).forEach(target => target.dispatchEvent(new Event('change')))

        expect(requestAnimationFrameSpy).not.toHaveBeenCalled()

        requestAnimationFrameSpy.mockRestore()
        addEventListenerSpy.mockRestore()
    })
})
