import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadCredentials, saveCredentials, deleteCredentials, resolveApiKey, type Credentials } from './credentials-store'

let tmpHome: string
let originalXdg: string | undefined

beforeEach(async () => {
    originalXdg = process.env.XDG_CONFIG_HOME
    tmpHome = await mkdtemp(join(tmpdir(), 'mna-cli-test-'))
    process.env.XDG_CONFIG_HOME = tmpHome
})

afterEach(async () => {
    process.env.XDG_CONFIG_HOME = originalXdg
    await rm(tmpHome, { recursive: true, force: true })
})

const sampleCreds: Credentials = {
    version: 1,
    apiKey: 'mna_live_test',
    user: { id: 'usr_1', email: 'test@example.com', name: 'Test User' },
    apiBaseUrl: 'https://mynextadventure.com',
    createdAt: '2026-05-22T00:00:00.000Z',
}

describe('credentials store', () => {
    test('loadCredentials returns null when file missing', async () => {
        const result = await loadCredentials()
        expect(result).toBeNull()
    })

    test('saveCredentials writes JSON and chmods 0600', async () => {
        await saveCredentials(sampleCreds)
        const path = join(tmpHome, 'mna', 'credentials')
        const stats = await stat(path)
        expect(stats.mode & 0o777).toBe(0o600)
    })

    test('saveCredentials then loadCredentials roundtrips', async () => {
        await saveCredentials(sampleCreds)
        const loaded = await loadCredentials()
        expect(loaded).toEqual(sampleCreds)
    })

    test('loadCredentials returns null on malformed JSON without throwing', async () => {
        const path = join(tmpHome, 'mna', 'credentials')
        await Bun.write(path, 'this is not json')
        const loaded = await loadCredentials()
        expect(loaded).toBeNull()
    })

    test('deleteCredentials removes the file', async () => {
        await saveCredentials(sampleCreds)
        await deleteCredentials()
        const loaded = await loadCredentials()
        expect(loaded).toBeNull()
    })

    test('MNA_API_KEY env var overrides file when set', async () => {
        await saveCredentials(sampleCreds)
        const before = process.env.MNA_API_KEY
        process.env.MNA_API_KEY = 'mna_live_override'
        try {
            expect(resolveApiKey(await loadCredentials())).toBe('mna_live_override')
        } finally {
            if (before === undefined) {
                // biome-ignore lint/performance/noDelete: must actually unset
                delete process.env.MNA_API_KEY
            } else {
                process.env.MNA_API_KEY = before
            }
        }
    })
})
