// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

type MenuItem = { action: () => void; state: () => { isSelected: boolean }; title: string }

const host: { dispatched: unknown[]; extensions: unknown[]; menuItems: MenuItem[] } = {
    dispatched: [],
    extensions: [],
    menuItems: [],
}

vi.mock('markedit-api', () => ({
    MarkEdit: {
        addExtension: (extension: unknown) => {
            host.extensions.push(extension)
        },
        addMainMenuItem: (item: MenuItem) => {
            host.menuItems.push(item)
        },
        editorView: {
            contentDOM: undefined,
            dispatch: (spec: unknown) => {
                host.dispatched.push(spec)
            },
        },
        userSettings: {},
    },
}))

const persistEnabled = vi.fn(async () => {})
vi.mock('../src/settings', async importOriginal => {
    const actual = await importOriginal<typeof import('../src/settings')>()
    return { ...actual, persistEnabled }
})

await import('../main')

describe('the entry point', () => {
    it('adds the editor extension and the menu item', () => {
        expect(host.extensions).toHaveLength(1)
        expect(host.menuItems).toHaveLength(1)
        expect(host.menuItems[0].title).toBe('Highlight Colors')
    })

    it('injects the swatch stylesheet one time', () => {
        const sheets = Array.from(document.head.querySelectorAll('style')).filter(style => style.textContent?.includes('.color-literal'))
        expect(sheets).toHaveLength(1)
    })

    it('is on by default', () => {
        expect(host.menuItems[0].state()).toEqual({ isSelected: true })
    })

    it('a toggle flips the state, dispatches the repaint effect, and persists', () => {
        host.menuItems[0].action()

        expect(host.menuItems[0].state()).toEqual({ isSelected: false })
        expect(host.dispatched).toHaveLength(1)
        expect(persistEnabled).toHaveBeenCalledWith(false)
    })
})
