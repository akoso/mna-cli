import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadSettings, saveSettings, setSetting, settingsPath, skillsPromptEnabled } from './settings'

let tmpHome: string
let originalXdg: string | undefined

beforeEach(async () => {
    originalXdg = process.env.XDG_CONFIG_HOME
    tmpHome = await mkdtemp(join(tmpdir(), 'mna-settings-test-'))
    process.env.XDG_CONFIG_HOME = tmpHome
})

afterEach(async () => {
    process.env.XDG_CONFIG_HOME = originalXdg
    await rm(tmpHome, { recursive: true, force: true })
})

describe('settings', () => {
    test('loadSettings returns {} when the file is missing', async () => {
        expect(await loadSettings()).toEqual({})
    })

    test('roundtrips through save/load', async () => {
        await saveSettings({ 'skills.prompt': false })
        expect(await loadSettings()).toEqual({ 'skills.prompt': false })
    })

    test('setSetting preserves other keys', async () => {
        await saveSettings({ 'skills.prompt': true })
        await setSetting('skills.prompt', false)
        expect(await loadSettings()).toEqual({ 'skills.prompt': false })
    })

    test('malformed settings file degrades to defaults instead of throwing', async () => {
        await mkdir(join(tmpHome, 'mna'), { recursive: true })
        await writeFile(settingsPath(), 'not json')
        expect(await loadSettings()).toEqual({})
        expect(await skillsPromptEnabled()).toBe(true)
    })

    test('skillsPromptEnabled defaults to true and honours an explicit false', async () => {
        expect(await skillsPromptEnabled()).toBe(true)
        await setSetting('skills.prompt', false)
        expect(await skillsPromptEnabled()).toBe(false)
    })
})
