import { beforeEach, describe, expect, it, vi } from 'vitest'

type Alert = { message: string; title: string }
type Created = { overwrites?: boolean; path: string; string: string }

const host: {
    alerts: Alert[]
    created: Created[]
    createFileResult: boolean
    directoryPaths: string[]
    files: Record<string, string>
    getFileContentError?: Error
    listFilesError?: Error
    listed: string[]
    listing?: string[] | false
    userSettings: Record<string, unknown>
} = resetHost()

function resetHost() {
    return {
        alerts: [],
        created: [],
        createFileResult: true,
        directoryPaths: [],
        files: {},
        getFileContentError: undefined,
        listFilesError: undefined,
        listed: [],
        listing: undefined,
        userSettings: {},
    }
}

vi.mock('markedit-api', () => ({
    MarkEdit: {
        createFile: async (args: Created) => {
            host.created.push({ ...args })
            return host.createFileResult
        },
        getDirectoryPath: (name: string) => {
            host.directoryPaths.push(name)
            return '/docs'
        },
        getFileContent: async (path: string) => {
            if (host.getFileContentError !== undefined) throw host.getFileContentError
            return host.files[path]
        },
        listFiles: async (path: string) => {
            host.listed.push(path)
            if (host.listFilesError !== undefined) throw host.listFilesError
            return host.listing === undefined ? Object.keys(host.files).map(key => key.slice('/docs/'.length)) : host.listing
        },
        showAlert: (alert: Alert) => {
            host.alerts.push(alert)
        },
        get userSettings() {
            return host.userSettings
        },
    },
}))

beforeEach(() => {
    Object.assign(host, resetHost())
    vi.resetModules()
})

// The module keeps one "already alerted" flag per session, so each case that
// exercises it needs a fresh module instance.
async function settings() {
    return import('../src/settings')
}

describe('loadEnabled', () => {
    it('is on when the settings key is absent', async () => {
        expect((await settings()).loadEnabled()).toBe(true)
    })

    it('is off when the settings key says so', async () => {
        host.userSettings = { 'extension.cssColors': { enabled: false } }
        expect((await settings()).loadEnabled()).toBe(false)
    })

    it('is on when the settings key holds something that is not a boolean', async () => {
        host.userSettings = { 'extension.cssColors': { enabled: 'yes' } }
        expect((await settings()).loadEnabled()).toBe(true)
    })
})

describe('persistEnabled', () => {
    it('writes settings.json and keeps every unrelated key', async () => {
        host.files['/docs/settings.json'] = JSON.stringify({
            'editor.fontSize': 14,
            'extension.copyOnSelect': { enabled: true },
        })

        await (await settings()).persistEnabled(false)

        expect(host.created).toHaveLength(1)
        expect(host.created[0].path).toBe('/docs/settings.json')
        expect(host.created[0].overwrites).toBe(true)

        const written = JSON.parse(host.created[0].string)
        expect(written['extension.cssColors']).toEqual({ enabled: false })
        expect(written['editor.fontSize']).toBe(14)
        expect(written['extension.copyOnSelect']).toEqual({ enabled: true })
        expect(host.alerts).toEqual([])
    })

    it('keeps the unrelated keys inside its own settings object', async () => {
        host.files['/docs/settings.json'] = JSON.stringify({ 'extension.cssColors': { enabled: true, note: 'keep me' } })

        await (await settings()).persistEnabled(false)

        expect(JSON.parse(host.created[0].string)['extension.cssColors']).toEqual({ enabled: false, note: 'keep me' })
    })

    it('writes an empty settings.json as holding just the one key', async () => {
        host.files['/docs/settings.json'] = ''
        await (await settings()).persistEnabled(false)
        expect(JSON.parse(host.created[0].string)).toEqual({ 'extension.cssColors': { enabled: false } })
    })

    it('writes an absent settings.json as a new file', async () => {
        await (await settings()).persistEnabled(false)
        expect(JSON.parse(host.created[0].string)).toEqual({ 'extension.cssColors': { enabled: false } })
    })

    it('takes the path from the documents directory', async () => {
        await (await settings()).persistEnabled(false)
        expect(host.directoryPaths).toEqual(['documents'])
        expect(host.listed).toEqual(['/docs'])
        expect(host.created[0].path).toBe('/docs/settings.json')
    })

    it('alerts and writes nothing for a malformed settings.json', async () => {
        host.files['/docs/settings.json'] = '{ this is not json'
        await (await settings()).persistEnabled(false)

        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
        expect(host.alerts[0].message).toMatch(/settings\.json/)
        expect(host.alerts[0].title).toBe('Highlight Colors')
    })

    it('alerts and writes nothing for a settings.json holding a non-object', async () => {
        host.files['/docs/settings.json'] = '[1, 2, 3]'
        await (await settings()).persistEnabled(false)
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    // undefined means the read failed, which is not proof that the file is absent.
    // A write then would replace every MarkEdit setting with this one key.
    it('alerts and writes nothing when a listing shows the unreadable file is present', async () => {
        host.listing = ['settings.json']
        await (await settings()).persistEnabled(false)
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts and writes nothing when the listing itself fails', async () => {
        host.listing = false
        await (await settings()).persistEnabled(false)
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts and does not throw when the file API rejects', async () => {
        host.getFileContentError = new Error('disk error')
        await expect((await settings()).persistEnabled(false)).resolves.toBeUndefined()
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts and writes nothing when listFiles rejects', async () => {
        host.listFilesError = new Error('no such directory')
        await expect((await settings()).persistEnabled(false)).resolves.toBeUndefined()
        expect(host.created).toEqual([])
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts when the write fails', async () => {
        host.createFileResult = false
        await (await settings()).persistEnabled(false)
        expect(host.alerts).toHaveLength(1)
    })

    it('alerts one time for each session', async () => {
        host.files['/docs/settings.json'] = '{ nope'
        const module = await settings()
        await module.persistEnabled(false)
        await module.persistEnabled(true)
        expect(host.alerts).toHaveLength(1)
    })
})
