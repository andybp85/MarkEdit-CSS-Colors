// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
