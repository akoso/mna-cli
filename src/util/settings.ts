import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mnaConfigDir } from './xdg'

/**
 * Non-secret local preferences. Kept separate from the credentials file so
 * settings survive `mna logout` and can be written before a first login.
 */
export interface Settings {
    /** Offer to install the mna skill into detected AI clients after `mna login`. */
    'skills.prompt'?: boolean
}

export function settingsPath(): string {
    return join(mnaConfigDir(), 'settings.json')
}

export async function loadSettings(): Promise<Settings> {
    try {
        const raw = await readFile(settingsPath(), 'utf8')
        const parsed = JSON.parse(raw) as unknown
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return parsed as Settings
    } catch {
        return {}
    }
}

export async function saveSettings(settings: Settings): Promise<void> {
    const path = settingsPath()
    await mkdir(mnaConfigDir(), { recursive: true, mode: 0o700 })
    await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const settings = await loadSettings()
    settings[key] = value
    await saveSettings(settings)
}

/** Defaults to true — the post-login offer is opt-out. */
export async function skillsPromptEnabled(): Promise<boolean> {
    const settings = await loadSettings()
    return settings['skills.prompt'] !== false
}
