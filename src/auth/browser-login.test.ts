import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { browserLogin } from './browser-login'
import { loadCredentials } from './credentials-store'

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

describe('browserLogin', () => {
    test('resolves when the callback hits /cb with matching state', async () => {
        const promise = browserLogin({
            apiBaseUrl: 'https://api.example.invalid',
            webAppBaseUrl: 'https://app.example.invalid',
            openBrowser: (url) => {
                const u = new URL(url)
                const port = u.searchParams.get('port')!
                const state = u.searchParams.get('state')!
                // Simulate the browser hitting our loopback after consent
                setImmediate(async () => {
                    const res = await fetch(`http://127.0.0.1:${port}/cb?state=${state}&key=mna_test_key`)
                    expect(res.status).toBe(200)
                })
            },
        })

        const { credentials } = await promise
        expect(credentials.apiKey).toBe('mna_test_key')

        const loaded = await loadCredentials()
        expect(loaded?.apiKey).toBe('mna_test_key')
    }, 10_000)

    test('rejects when state does not match', async () => {
        const promise = browserLogin({
            apiBaseUrl: 'https://api.example.invalid',
            webAppBaseUrl: 'https://app.example.invalid',
            openBrowser: (url) => {
                const port = new URL(url).searchParams.get('port')!
                setImmediate(() => {
                    fetch(`http://127.0.0.1:${port}/cb?state=wrong&key=anything`).catch(() => {})
                })
            },
        })

        await expect(promise).rejects.toThrow(/state mismatch/)
    }, 10_000)
})
