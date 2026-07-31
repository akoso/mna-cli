import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildMcpEntry, CLIENTS, detectionPath, findClient, isClientInstalled, skillDir } from './clients'
import type { HostEnv } from './host-env'
import { MCP_SERVER_URL } from './payload'

let fakeHome: string

function env(overrides: Partial<HostEnv> = {}): HostEnv {
    return { home: fakeHome, platform: 'darwin', cwd: join(fakeHome, 'project'), ...overrides }
}

beforeEach(async () => {
    fakeHome = await mkdtemp(join(tmpdir(), 'mna-home-'))
})

afterEach(async () => {
    await rm(fakeHome, { recursive: true, force: true })
})

describe('client detection', () => {
    test('nothing is detected in an empty home', async () => {
        for (const client of CLIENTS) {
            expect(await isClientInstalled(client, env())).toBe(false)
        }
    })

    test('detects Claude Code from ~/.claude', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        const detected = []
        for (const client of CLIENTS) {
            if (await isClientInstalled(client, env())) detected.push(client.id)
        }
        expect(detected).toEqual(['claude-code'])
    })

    test('detects Cursor and Claude Code independently', async () => {
        await mkdir(join(fakeHome, '.cursor'), { recursive: true })
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        expect(await isClientInstalled(findClient('cursor')!, env())).toBe(true)
        expect(await isClientInstalled(findClient('claude-code')!, env())).toBe(true)
        expect(await isClientInstalled(findClient('windsurf')!, env())).toBe(false)
    })

    test('detects Claude Desktop from its macOS application-support directory', async () => {
        await mkdir(join(fakeHome, 'Library', 'Application Support', 'Claude'), { recursive: true })
        expect(await isClientInstalled(findClient('claude-desktop')!, env())).toBe(true)
    })

    test('detects a client from its config file even without the directory probe', async () => {
        await mkdir(join(fakeHome, 'Library', 'Application Support', 'Code', 'User'), { recursive: true })
        await writeFile(join(fakeHome, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'), '{}')
        expect(await isClientInstalled(findClient('vscode')!, env())).toBe(true)
    })

    test('a file (not a directory) at the probe path does not count as installed', async () => {
        await writeFile(join(fakeHome, '.claude'), 'not a directory')
        expect(await isClientInstalled(findClient('claude-code')!, env())).toBe(false)
    })
})

describe('platform-specific paths', () => {
    test('Claude Desktop config differs per OS', () => {
        const desktop = findClient('claude-desktop')!
        expect(desktop.mcp!.configPath(env({ platform: 'darwin' }))).toBe(
            join(fakeHome, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        )
        expect(desktop.mcp!.configPath(env({ platform: 'linux' }))).toBe(
            join(fakeHome, '.config', 'Claude', 'claude_desktop_config.json'),
        )
        expect(
            desktop.mcp!.configPath(env({ platform: 'win32', appData: 'C:\\Users\\me\\AppData\\Roaming' })),
        ).toBe(join('C:\\Users\\me\\AppData\\Roaming', 'Claude', 'claude_desktop_config.json'))
    })

    test('detectionPath points at the probe directory', () => {
        expect(detectionPath(findClient('claude-code')!, env())).toBe(join(fakeHome, '.claude'))
    })
})

describe('skillDir', () => {
    test('user scope resolves under home', () => {
        expect(skillDir(findClient('claude-code')!, env(), 'user')).toBe(
            join(fakeHome, '.claude', 'skills', 'mna'),
        )
    })

    test('project scope resolves under cwd', () => {
        expect(skillDir(findClient('cursor')!, env(), 'project')).toBe(
            join(fakeHome, 'project', '.cursor', 'skills', 'mna'),
        )
    })

    test('returns null for clients without skill support', () => {
        expect(skillDir(findClient('claude-desktop')!, env(), 'user')).toBeNull()
    })
})

describe('buildMcpEntry', () => {
    test('http style uses the native remote transport', () => {
        expect(buildMcpEntry('http')).toEqual({ type: 'http', url: MCP_SERVER_URL })
    })

    test('http style adds the X-API-Key header when a key is known', () => {
        expect(buildMcpEntry('http', { apiKey: 'k' })).toEqual({
            type: 'http',
            url: MCP_SERVER_URL,
            headers: { 'X-API-Key': 'k' },
        })
    })

    test('cursor style omits the type field', () => {
        expect(buildMcpEntry('url', { apiKey: 'k' })).toEqual({
            url: MCP_SERVER_URL,
            headers: { 'X-API-Key': 'k' },
        })
    })

    test('gemini style selects streamable HTTP via the httpUrl key', () => {
        expect(buildMcpEntry('httpUrl', { apiKey: 'k' })).toEqual({
            httpUrl: MCP_SERVER_URL,
            headers: { 'X-API-Key': 'k' },
        })
    })

    test('windsurf style uses serverUrl', () => {
        expect(buildMcpEntry('serverUrl')).toEqual({ serverUrl: MCP_SERVER_URL })
    })

    test('every registered client has a style buildMcpEntry can render', () => {
        for (const client of CLIENTS) {
            if (!client.mcp) continue
            const entry = buildMcpEntry(client.mcp.style)
            expect(JSON.stringify(entry)).toContain(MCP_SERVER_URL)
        }
    })

    test('mcp-remote style bridges over stdio and keeps the key in env', () => {
        expect(buildMcpEntry('mcp-remote', { apiKey: 'k' })).toEqual({
            command: 'npx',
            args: ['-y', 'mcp-remote', MCP_SERVER_URL, '--header', 'X-API-Key:${MNA_API_KEY}'],
            env: { MNA_API_KEY: 'k' },
        })
    })

    test('mcp-remote without a key falls back to plain OAuth', () => {
        expect(buildMcpEntry('mcp-remote')).toEqual({
            command: 'npx',
            args: ['-y', 'mcp-remote', MCP_SERVER_URL],
        })
    })
})

describe('vendor-verification flags', () => {
    test('every registered skill directory is vendor-documented', () => {
        // If a future client is added on convention alone, mark it
        // skillPathVerified: false so the CLI can say so out loud.
        for (const client of CLIENTS) {
            if (!client.userSkillsDir) continue
            expect({ id: client.id, verified: client.skillPathVerified ?? true }).toEqual({
                id: client.id,
                verified: true,
            })
        }
    })

    test('Claude Desktop on Linux is flagged: the config path is not vendor-documented', () => {
        const desktop = findClient('claude-desktop')!
        expect(desktop.mcpPathUnverifiedOn).toEqual(['linux'])
    })

    test('Codex resolves to ~/.agents/skills, the only path OpenAI documents', () => {
        // ~/.codex/skills is a third-party compatibility claim, not an OpenAI one.
        const codex = findClient('codex')!
        expect(codex.id).toBe('agents')
        expect(skillDir(codex, env(), 'user')).toBe(join(fakeHome, '.agents', 'skills', 'mna'))
        expect(CLIENTS.some((c) => c.userSkillsDir === '.codex/skills')).toBe(false)
    })

    test('unknown client names still resolve to undefined', () => {
        expect(findClient('not-a-client')).toBeUndefined()
    })
})

describe('every documented path cites its source', () => {
    // The guard behind the README's claim that every path comes from the
    // vendor's own docs. A new client cannot be added without a citation.
    test('each client with a skill directory links the vendor page', () => {
        for (const client of CLIENTS) {
            if (!client.userSkillsDir) continue
            expect({ id: client.id, cited: Boolean(client.skillPathDocs) }).toEqual({
                id: client.id,
                cited: true,
            })
            expect(client.skillPathDocs).toMatch(/^https:\/\//)
        }
    })

    test('clients without skill support do not claim a skills citation', () => {
        for (const client of CLIENTS) {
            if (client.userSkillsDir) continue
            expect(client.skillPathDocs).toBeUndefined()
        }
    })
})
