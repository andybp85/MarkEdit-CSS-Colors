// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

type MenuItem = { action: () => void; state: () => { isSelected: boolean }; title: string }

// MarkEdit does not hand out an editor view until the editor itself is ready,
// and the toggle can fire before that: this mock has no `editorView` at all,
// so `MarkEdit.editorView?.dispatch(...)` in main.ts takes the empty branch.
const host: { menuItems: MenuItem[] } = { menuItems: [] }

vi.mock('markedit-api', () => ({
    MarkEdit: {
        addExtension: () => {},
        addMainMenuItem: (item: MenuItem) => {
            host.menuItems.push(item)
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

describe('a toggle with no editor view', () => {
    it('flips the checkmark without throwing', () => {
        expect(() => host.menuItems[0].action()).not.toThrow()
        expect(host.menuItems[0].state()).toEqual({ isSelected: false })
        expect(persistEnabled).toHaveBeenCalledWith(false)
    })
})
