import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findClient } from './clients'
import type { HostEnv } from './host-env'
import { SKILL_FILES } from './payload'
import { applyPlan, mcpState, planForClient, planForClients, skillState, toApplyError } from './plan'
import { ApplyFailedError } from './changes'

let fakeHome: string

function env(overrides: Partial<HostEnv> = {}): HostEnv {
    return { home: fakeHome, platform: 'darwin', cwd: join(fakeHome, 'project'), ...overrides }
}

const claudeCode = () => findClient('claude-code')!

beforeEach(async () => {
    fakeHome = await mkdtemp(join(tmpdir(), 'mna-plan-'))
    await mkdir(join(fakeHome, '.claude'), { recursive: true })
})

afterEach(async () => {
    await rm(fakeHome, { recursive: true, force: true })
})

describe('planForClient', () => {
    test('plans every shipped skill file plus the MCP entry', async () => {
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: true })
        expect(plan.installed).toBe(true)
        expect(plan.changes.filter((c) => c.label === 'skill')).toHaveLength(SKILL_FILES.length)
        expect(plan.changes.filter((c) => c.label === 'mcp')).toHaveLength(1)
        expect(skillState(plan)).toBe('missing')
        expect(mcpState(plan)).toBe('missing')
    })

    test('--no-mcp drops the config change entirely', async () => {
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: false })
        expect(plan.mcpPath).toBeNull()
        expect(plan.changes.some((c) => c.label === 'mcp')).toBe(false)
        expect(mcpState(plan)).toBe('n/a')
    })

    test('an unparseable client config blocks the MCP entry only, never the skill', async () => {
        const configPath = join(fakeHome, '.claude.json')
        await writeFile(configPath, '{ "mcpServers": oops')
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: true })
        expect(plan.mcpBlocked).toMatch(/not valid JSON/)
        expect(plan.mcpPath).toBeNull()
        // The skill files are independent of that config and must survive.
        expect(plan.changes.filter((c) => c.label === 'skill')).toHaveLength(SKILL_FILES.length)

        const applied = await applyPlan(plan, false)
        // Corrupt config untouched...
        expect(await readFile(configPath, 'utf8')).toBe('{ "mcpServers": oops')
        // ...but the skill still landed, and is reported as such.
        expect(applied.applied.filter((a) => a.result === 'created')).toHaveLength(SKILL_FILES.length)
        expect(applied.errors).toEqual([])
        expect(
            (await readFile(join(fakeHome, '.claude', 'skills', 'mna', 'SKILL.md'), 'utf8')).length,
        ).toBeGreaterThan(100)
    })

    test('a non-object at mcpServers is a hard stop, not a silent replacement', async () => {
        const configPath = join(fakeHome, '.claude.json')
        await writeFile(configPath, JSON.stringify({ mcpServers: 'not an object', keep: 1 }))
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: true })
        expect(plan.mcpBlocked).toMatch(/non-object value at "mcpServers"/)
        expect(plan.mcpPath).toBeNull()

        await applyPlan(plan, false)
        expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
            mcpServers: 'not an object',
            keep: 1,
        })
    })

    test('reports up-to-date once the skill is installed', async () => {
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: false })
        await applyPlan(plan, false)
        const replan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: false })
        expect(skillState(replan)).toBe('up-to-date')
        expect(replan.changes.every((c) => c.status === 'unchanged')).toBe(true)
    })

    test('reports outdated when an installed skill file drifts', async () => {
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: false })
        await applyPlan(plan, false)
        await writeFile(join(fakeHome, '.claude', 'skills', 'mna', 'SKILL.md'), 'edited by hand')
        const replan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: false })
        expect(skillState(replan)).toBe('outdated')
    })
})

describe('applyPlan', () => {
    test('dry run writes nothing at all', async () => {
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: true })
        const applied = await applyPlan(plan, true)
        expect(applied.applied).toEqual([])
        expect(await readdir(join(fakeHome, '.claude'))).toEqual([])
        await expect(readFile(join(fakeHome, '.claude.json'), 'utf8')).rejects.toThrow()
    })

    test('installs the skill tree with the shipped content', async () => {
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: false })
        await applyPlan(plan, false)
        const skillMd = await readFile(join(fakeHome, '.claude', 'skills', 'mna', 'SKILL.md'), 'utf8')
        expect(skillMd).toBe(SKILL_FILES.find((f) => f.path === 'SKILL.md')!.content)
        expect(skillMd.startsWith('---\nname: mna\n')).toBe(true)
        const reference = await readFile(
            join(fakeHome, '.claude', 'skills', 'mna', 'references', 'cli-and-schemas.md'),
            'utf8',
        )
        expect(reference.length).toBeGreaterThan(100)
    })

    test('merges into an existing config, preserving unrelated keys and servers', async () => {
        const configPath = join(fakeHome, '.claude.json')
        await writeFile(
            configPath,
            JSON.stringify({ numStartups: 7, mcpServers: { other: { command: 'npx' } } }),
        )
        const plan = await planForClient(claudeCode(), {
            env: env(),
            scope: 'user',
            includeMcp: true,
            apiKey: 'secret',
        })
        await applyPlan(plan, false)
        const after = JSON.parse(await readFile(configPath, 'utf8'))
        expect(after.numStartups).toBe(7)
        expect(after.mcpServers.other).toEqual({ command: 'npx' })
        expect(after.mcpServers['my-next-adventure']).toEqual({
            type: 'http',
            url: 'https://mcp.mynextadventure.cloud/mcp',
            headers: { 'X-API-Key': 'secret' },
        })
    })

    test('one unwritable path does not abandon the other files', async () => {
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: false })
        // Make the references directory un-creatable by putting a file in its place.
        await mkdir(join(fakeHome, '.claude', 'skills', 'mna'), { recursive: true })
        await writeFile(join(fakeHome, '.claude', 'skills', 'mna', 'references'), 'in the way')

        const applied = await applyPlan(plan, false)
        expect(applied.errors.length).toBeGreaterThan(0)
        // SKILL.md is not under the blocked directory, so it still installs.
        expect(applied.applied.some((a) => a.result === 'created')).toBe(true)
    })
})

describe('planForClients', () => {
    test('only the clients present on the machine report installed', async () => {
        const plans = await planForClients(
            [claudeCode(), findClient('cursor')!, findClient('windsurf')!],
            { env: env(), scope: 'user', includeMcp: false },
        )
        expect(plans.filter((p) => p.installed).map((p) => p.id)).toEqual(['claude-code'])
    })

    test('project scope targets the working directory, not home', async () => {
        const plans = await planForClients([claudeCode()], {
            env: env(),
            scope: 'project',
            includeMcp: false,
        })
        expect(plans[0]!.skillPath).toBe(join(fakeHome, 'project', '.claude', 'skills', 'mna'))
    })
})

describe('path verification is surfaced, not hidden', () => {
    test('a convention-only skill path is marked unverified on the plan', async () => {
        const madeUp = { ...claudeCode(), id: 'madeup', skillPathVerified: false }
        const plan = await planForClient(madeUp, { env: env(), scope: 'user', includeMcp: false })
        expect(plan.skillPathVerified).toBe(false)
    })

    test('Claude Desktop config is flagged unverified on Linux but not on macOS', async () => {
        const desktop = findClient('claude-desktop')!
        const onLinux = await planForClient(desktop, {
            env: env({ platform: 'linux' }),
            scope: 'user',
            includeMcp: true,
        })
        const onMac = await planForClient(desktop, {
            env: env({ platform: 'darwin' }),
            scope: 'user',
            includeMcp: true,
        })
        expect(onLinux.mcpPathVerified).toBe(false)
        expect(onMac.mcpPathVerified).toBe(true)
    })
})

describe('failure reporting', () => {
    test('a failed write after a backup reports where the original went', () => {
        // What the install command renders as "your original is at <path>".
        // Unreachable through the filesystem once an atomic rename is in play
        // (a writable directory makes the rename succeed), so it is proved here
        // with the error a full disk would produce.
        const err = new ApplyFailedError(
            '/home/u/.claude.json',
            new Error('ENOSPC: no space left on device'),
            '/home/u/.claude.json.mna-backup-20260731T070037105',
        )
        expect(toApplyError('/home/u/.claude.json', err)).toEqual({
            path: '/home/u/.claude.json',
            message: 'ENOSPC: no space left on device',
            backup: '/home/u/.claude.json.mna-backup-20260731T070037105',
        })
    })

    test('an ordinary error reports no backup', () => {
        expect(toApplyError('/p', new Error('EACCES: permission denied'))).toEqual({
            path: '/p',
            message: 'EACCES: permission denied',
            backup: undefined,
        })
    })

    test('a non-Error throw is still reportable', () => {
        expect(toApplyError('/p', 'kaboom').message).toBe('kaboom')
    })
})
