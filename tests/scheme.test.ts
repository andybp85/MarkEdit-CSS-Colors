// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('markedit-api', () => ({ MarkEdit: { editorView: undefined } }))

const { onSchemeChange } = await import('../src/scheme')

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
const settle = async () => {
    for (const _ of [0, 1, 2]) await nextFrame()
}

let editor: HTMLElement

beforeEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''

    editor = document.createElement('div')
    editor.className = 'cm-editor'
    editor.style.backgroundColor = 'rgb(255, 255, 255)'
    document.body.appendChild(editor)
})

describe('onSchemeChange', () => {
    it('reports a scheme that actually changed', async () => {
        const listener = vi.fn()
        onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('stays quiet for a mutation burst that changes nothing', async () => {
        const listener = vi.fn()
        onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(254, 254, 254)'
        document.body.setAttribute('class', 'busy')
        await settle()

        expect(listener).not.toHaveBeenCalled()
    })

    it('coalesces a burst into one report', async () => {
        const listener = vi.fn()
        onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        document.head.appendChild(document.createElement('style'))
        document.documentElement.setAttribute('class', 'dark')
        await settle()

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('stops reporting once its release is called', async () => {
        const listener = vi.fn()
        const release = onSchemeChange(listener)
        release()

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()

        expect(listener).not.toHaveBeenCalled()
    })
})
