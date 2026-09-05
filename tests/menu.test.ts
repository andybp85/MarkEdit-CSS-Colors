import { beforeEach, describe, expect, it, vi } from 'vitest'

type MenuItem = { action: () => void; state: () => { isSelected: boolean }; title: string }

const registered: MenuItem[] = []

vi.mock('markedit-api', () => ({
    MarkEdit: {
        addMainMenuItem: (item: MenuItem) => {
            registered.push(item)
        },
    },
}))

const { installMenu } = await import('../src/menu')

beforeEach(() => {
    registered.length = 0
})

function controllerOver(enabled: boolean) {
    let current = enabled
    return {
        isEnabled: () => current,
        toggle: vi.fn(() => {
            current = !current
        }),
    }
}

describe('installMenu', () => {
    it('registers one item with the exact title', () => {
        installMenu(controllerOver(true))

        expect(registered).toHaveLength(1)
        expect(registered[0].title).toBe('Highlight Colors')
    })

    it('draws its checkmark from the controller', () => {
        installMenu(controllerOver(false))
        expect(registered[0].state()).toEqual({ isSelected: false })
    })

    it('asks the controller to toggle, and the checkmark follows', () => {
        const controller = controllerOver(true)
        installMenu(controller)

        registered[0].action()

        expect(controller.toggle).toHaveBeenCalledTimes(1)
        expect(registered[0].state()).toEqual({ isSelected: false })
    })
})
