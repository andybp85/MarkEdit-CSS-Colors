// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('markedit-api', () => ({ MarkEdit: { editorView: undefined } }))

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

    // The module keeps one shared observer/listener registry, so a subscription a
    // case forgets to release would otherwise leak into the next one. Matches
    // tests/settings.test.ts's convention for a module with singleton state.
    vi.resetModules()
})

async function scheme() {
    return import('../src/scheme')
}

describe('onSchemeChange', () => {
    it('reports a scheme that actually changed', async () => {
        const { onSchemeChange } = await scheme()
        const listener = vi.fn()
        const release = onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()

        expect(listener).toHaveBeenCalledTimes(1)
        release()
    })

    it('stays quiet for a mutation burst that changes nothing', async () => {
        const { onSchemeChange } = await scheme()
        const listener = vi.fn()
        const release = onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(254, 254, 254)'
        document.body.setAttribute('class', 'busy')
        await settle()

        expect(listener).not.toHaveBeenCalled()
        release()
    })

    it('coalesces a burst into one report', async () => {
        const { onSchemeChange } = await scheme()
        const listener = vi.fn()
        const release = onSchemeChange(listener)

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        document.head.appendChild(document.createElement('style'))
        document.documentElement.setAttribute('class', 'dark')
        await settle()

        expect(listener).toHaveBeenCalledTimes(1)
        release()
    })

    it('stops reporting once its release is called', async () => {
        const { onSchemeChange } = await scheme()
        const listener = vi.fn()
        const release = onSchemeChange(listener)
        release()

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()

        expect(listener).not.toHaveBeenCalled()
    })
})

describe('teardown accounting', () => {
    it('the last of several releases tears tracking down, not just the count', async () => {
        const { onSchemeChange } = await scheme()
        const first = vi.fn()
        const second = vi.fn()
        const releaseFirst = onSchemeChange(first)
        const releaseSecond = onSchemeChange(second)

        // One subscriber remains: tracking is still live, so a real change reports.
        releaseFirst()
        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()
        expect(second).toHaveBeenCalledTimes(1)

        // The last release brings the count to zero: nothing should report again.
        second.mockClear()
        releaseSecond()
        editor.style.backgroundColor = 'rgb(255, 255, 255)'
        await settle()
        expect(second).not.toHaveBeenCalled()
    })

    it('a subscribe after a full teardown starts fresh', async () => {
        const { onSchemeChange } = await scheme()
        const first = vi.fn()

        // Subscribe and release with nothing else happening: a full teardown, not a
        // partial one — this is the last (and only) release.
        onSchemeChange(first)()

        // The prior tracking is torn down, so this mutation is unobserved.
        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()
        expect(first).not.toHaveBeenCalled()

        // A fresh subscribe builds its own observer from the current (now dark)
        // editor, so this transition back to light is the only one it should see.
        const second = vi.fn()
        const release = onSchemeChange(second)
        editor.style.backgroundColor = 'rgb(255, 255, 255)'
        await settle()

        expect(second).toHaveBeenCalledTimes(1)
        release()
    })

    it('a second release call is a harmless no-op', async () => {
        const { onSchemeChange } = await scheme()
        const listener = vi.fn()
        const release = onSchemeChange(listener)

        release()
        expect(() => release()).not.toThrow()

        editor.style.backgroundColor = 'rgb(0, 0, 0)'
        await settle()
        expect(listener).not.toHaveBeenCalled()
    })

    it('after the last release, a media-query change schedules no work and notifies nobody', async () => {
        // No editor in the document: resolveScheme falls back to the media query,
        // the only path the change listener above ever actually exercises.
        document.body.innerHTML = ''

        // matchMedia() hands back a new MediaQueryList on every call (CSSOM: "return
        // a new MediaQueryList object"), so a test can't dispatch on a freshly
        // obtained one and expect to reach a listener the module attached to a
        // different instance. happy-dom implements MediaQueryList#addEventListener on
        // its own prototype rather than inheriting EventTarget's, so that prototype —
        // shared by every instance matchMedia() hands out — is the one spot a spy can
        // sit to observe (without altering; the spy calls through) which instance
        // actually receives the 'change' listener, via Vitest's own call/context
        // record rather than by aliasing `this`.
        const mediaQueryListPrototype: EventTarget = Object.getPrototypeOf(matchMedia('(prefers-color-scheme: dark)'))
        const addEventListenerSpy = vi.spyOn(mediaQueryListPrototype, 'addEventListener')

        const { onSchemeChange } = await scheme()
        const listener = vi.fn()
        const release = onSchemeChange(listener)
        release()

        const changeCallIndex = addEventListenerSpy.mock.calls.findIndex(call => call[0] === 'change')
        // `EventTarget#addEventListener`'s declared type carries no explicit `this`
        // parameter, so Vitest's mock.contexts infers `{}` here instead of the actual
        // caller — genuinely too weak, since the runtime value is always the
        // MediaQueryList instance the call was made on.
        const changeTarget = changeCallIndex === -1 ? undefined : (addEventListenerSpy.mock.contexts[changeCallIndex] as EventTarget)

        // requestAnimationFrame is scheduleUpdate's only observable effect, and the
        // 'change' listener (if any) runs synchronously inside dispatchEvent — check
        // before settle(), whose own polling would otherwise call rAF regardless.
        const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame')
        changeTarget?.dispatchEvent(new Event('change'))
        expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
        requestAnimationFrameSpy.mockRestore()

        await settle()
        expect(listener).not.toHaveBeenCalled()

        addEventListenerSpy.mockRestore()
    })
})
