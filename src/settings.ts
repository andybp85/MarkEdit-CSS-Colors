import { MarkEdit } from 'markedit-api'

import { MENU_TITLE, SETTINGS_FILE, SETTINGS_NAMESPACE } from './constants'

const PARSE_FAILURE =
    `${SETTINGS_FILE} could not be read, so the setting was not saved. ` +
    'Correct the file, or the toggle will reset when you quit MarkEdit.'
const READ_FAILURE = `${SETTINGS_FILE} could not be opened, so the setting was not saved. The toggle will reset when you quit MarkEdit.`
const WRITE_FAILURE = `${SETTINGS_FILE} could not be written, so the setting was not saved. The toggle will reset when you quit MarkEdit.`

// One alert for each session. A user who toggles the item against a broken file
// does not need one alert for each attempt.
let alerted = false

/** Painting is on unless the settings say otherwise. Read once, at load. */
export function loadEnabled(): boolean {
    const root = MarkEdit.userSettings?.[SETTINGS_NAMESPACE]
    if (!isPlainObject(root)) return true

    return typeof root.enabled === 'boolean' ? root.enabled : true
}

/**
 * Read, merge one key, write back, so every unrelated setting survives. Each half
 * has its own try/catch: a rejected API call is a failure of that half, and it
 * must alert with that message instead of escaping as an unhandled rejection.
 */
export async function persistEnabled(enabled: boolean): Promise<void> {
    const read = await readSettings()
    if (read === undefined) return

    try {
        const current = isPlainObject(read.settings[SETTINGS_NAMESPACE]) ? read.settings[SETTINGS_NAMESPACE] : {}
        const merged = { ...read.settings, [SETTINGS_NAMESPACE]: { ...current, enabled } }
        const written = await MarkEdit.createFile({ overwrites: true, path: read.path, string: JSON.stringify(merged, null, 2) })
        if (!written) alertOnce(WRITE_FAILURE)
    } catch {
        alertOnce(WRITE_FAILURE)
    }
}

// Returns the path to write and the settings to merge into, or nothing when a
// write would be unsafe — in which case the alert has already been raised.
async function readSettings(): Promise<{ path: string; settings: Record<string, unknown> } | undefined> {
    try {
        const directory = MarkEdit.getDirectoryPath('documents')
        const path = `${directory}/${SETTINGS_FILE}`
        const raw = await MarkEdit.getFileContent(path)

        if (typeof raw !== 'string') {
            // undefined means the read failed, which is not proof that the file is
            // absent. A write now could replace a real settings.json with this one
            // key, so refuse until a listing proves that the file is not there.
            if (await settingsAbsent(directory)) return { path, settings: {} }

            alertOnce(READ_FAILURE)
            return undefined
        }

        if (raw.trim() === '') return { path, settings: {} }

        const parsed = parseSettings(raw)
        if (!isPlainObject(parsed)) {
            // Writing now would replace every MarkEdit setting with this one key.
            alertOnce(PARSE_FAILURE)
            return undefined
        }

        return { path, settings: parsed }
    } catch {
        alertOnce(READ_FAILURE)
        return undefined
    }
}

// Proof that the file is not there, which only a successful listing gives. A
// listing that fails, or that holds the file, proves nothing.
async function settingsAbsent(directory: string) {
    const listing = await MarkEdit.listFiles(directory)
    return Array.isArray(listing) && !listing.some(entry => entry === SETTINGS_FILE || entry.endsWith(`/${SETTINGS_FILE}`))
}

function parseSettings(raw: string): unknown {
    try {
        return JSON.parse(raw)
    } catch {
        return undefined
    }
}

// typeof null is 'object', so the null test is not redundant. JSON.parse is what
// produces null here; the rest of the file uses undefined.
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function alertOnce(message: string) {
    if (alerted) return
    alerted = true
    void MarkEdit.showAlert({ message, title: MENU_TITLE })
}
