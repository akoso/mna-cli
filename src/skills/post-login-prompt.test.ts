import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HostEnv } from './host-env'
import { maybeOfferSkillInstall } from './post-login-prompt'
import { setSetting } from '../util/settings'

let fakeHome: string
let originalXdg: string | undefined
let asked: string[]
let output: string

function env(): HostEnv {
    return { home: fakeHome, platform: 'darwin', cwd: join(fakeHome, 'project') }
}

function options(overrides: Record<string, unknown> = {}) {
    return {
        interactive: true,
        env: env(),
        write: (s: string) => {
            output += s
        },
        confirmFn: async (message: string) => {
            asked.push(message)
            return true
        },
        ...overrides,
    }
}

beforeEach(async () => {
    originalXdg = process.env.XDG_CONFIG_HOME
    fakeHome = await mkdtemp(join(tmpdir(), 'mna-postlogin-'))
    process.env.XDG_CONFIG_HOME = join(fakeHome, '.config')
    asked = []
    output = ''
})

afterEach(async () => {
    process.env.XDG_CONFIG_HOME = originalXdg
    await rm(fakeHome, { recursive: true, force: true })
})

describe('maybeOfferSkillInstall', () => {
    test('never prompts in --json mode', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        expect(await maybeOfferSkillInstall(options({ json: true }))).toBe('skipped-json')
        expect(asked).toEqual([])
    })

    test('never prompts on a non-interactive terminal', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        expect(await maybeOfferSkillInstall(options({ interactive: false }))).toBe(
            'skipped-non-interactive',
        )
        expect(asked).toEqual([])
    })

    test('respects `mna config set skills.prompt false`', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        await setSetting('skills.prompt', false)
        expect(await maybeOfferSkillInstall(options())).toBe('skipped-disabled')
        expect(asked).toEqual([])
    })

    test('stays quiet when no supported client is installed', async () => {
        expect(await maybeOfferSkillInstall(options())).toBe('skipped-none-detected')
        expect(asked).toEqual([])
    })

    test('offers, then installs the skill on accept', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        expect(await maybeOfferSkillInstall(options())).toBe('installed')
        expect(asked).toEqual(['Install the mna skill for Claude Code?'])
        const installed = await readFile(join(fakeHome, '.claude', 'skills', 'mna', 'SKILL.md'), 'utf8')
        expect(installed.startsWith('---\nname: mna\n')).toBe(true)
    })

    test('writes nothing on decline and points at the opt-out', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        const result = await maybeOfferSkillInstall(options({ confirmFn: async () => false }))
        expect(result).toBe('declined')
        await expect(
            readFile(join(fakeHome, '.claude', 'skills', 'mna', 'SKILL.md'), 'utf8'),
        ).rejects.toThrow()
        expect(output).toContain('mna config set skills.prompt false')
    })

    test('does not nag once the skill is already up to date', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        expect(await maybeOfferSkillInstall(options())).toBe('installed')
        asked = []
        expect(await maybeOfferSkillInstall(options())).toBe('skipped-up-to-date')
        expect(asked).toEqual([])
    })

    test('never touches MCP configs — the post-login offer is skill-only', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        await maybeOfferSkillInstall(options())
        await expect(readFile(join(fakeHome, '.claude.json'), 'utf8')).rejects.toThrow()
    })

    test('offers every detected client in one prompt', async () => {
        await mkdir(join(fakeHome, '.claude'), { recursive: true })
        await mkdir(join(fakeHome, '.cursor'), { recursive: true })
        expect(await maybeOfferSkillInstall(options())).toBe('installed')
        expect(asked).toEqual(['Install the mna skill for Claude Code, Cursor?'])
        expect(
            (await readFile(join(fakeHome, '.cursor', 'skills', 'mna', 'SKILL.md'), 'utf8')).length,
        ).toBeGreaterThan(100)
    })
})
