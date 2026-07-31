import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findClient } from './clients'
import type { HostEnv } from './host-env'
import { SKILL_FILES } from './payload'
import { applyPlan, mcpState, planForClient, planForClients, skillState } from './plan'

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

    test('an unparseable client config blocks that client instead of clobbering it', async () => {
        const configPath = join(fakeHome, '.claude.json')
        await writeFile(configPath, '{ "mcpServers": oops')
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: true })
        expect(plan.blocked).toMatch(/not valid JSON/)
        expect(plan.mcpPath).toBeNull()

        await applyPlan(plan, false)
        expect(await readFile(configPath, 'utf8')).toBe('{ "mcpServers": oops')
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

    test('a blocked plan is a no-op', async () => {
        await writeFile(join(fakeHome, '.claude.json'), 'nope')
        const plan = await planForClient(claudeCode(), { env: env(), scope: 'user', includeMcp: true })
        const applied = await applyPlan(plan, false)
        expect(applied.applied).toEqual([])
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
