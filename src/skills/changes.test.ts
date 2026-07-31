import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chmod, stat } from 'node:fs/promises'
import {
    applyChange,
    BACKUP_RETENTION,
    backupFile,
    ConfigConflictError,
    planFileChange,
    planJsonChange,
    readMergeableJson,
    UnparseableConfigError,
    writeFileAtomic,
} from './changes'

let dir: string

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mna-changes-test-'))
})

afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
})

describe('planFileChange', () => {
    test('create when the file does not exist', async () => {
        const change = await planFileChange(join(dir, 'a', 'SKILL.md'), 'hello', 'skill')
        expect(change.status).toBe('create')
    })

    test('unchanged when content is byte-identical', async () => {
        const path = join(dir, 'SKILL.md')
        await writeFile(path, 'hello')
        expect((await planFileChange(path, 'hello', 'skill')).status).toBe('unchanged')
    })

    test('overwrite when content differs', async () => {
        const path = join(dir, 'SKILL.md')
        await writeFile(path, 'user edited this')
        expect((await planFileChange(path, 'hello', 'skill')).status).toBe('overwrite')
    })
})

describe('planJsonChange', () => {
    test('create when the config file is absent', async () => {
        const change = await planJsonChange(join(dir, 'mcp.json'), ['mcpServers', 'mna'], { url: 'u' }, 'mcp')
        expect(change.status).toBe('create')
    })

    test('create when the file exists but our key is absent', async () => {
        const path = join(dir, 'mcp.json')
        await writeFile(path, JSON.stringify({ mcpServers: { other: { url: 'x' } } }))
        expect((await planJsonChange(path, ['mcpServers', 'mna'], { url: 'u' }, 'mcp')).status).toBe('create')
    })

    test('unchanged when our key already holds the same value', async () => {
        const path = join(dir, 'mcp.json')
        await writeFile(path, JSON.stringify({ mcpServers: { mna: { url: 'u' } } }))
        expect((await planJsonChange(path, ['mcpServers', 'mna'], { url: 'u' }, 'mcp')).status).toBe('unchanged')
    })

    test('overwrite when our key holds a different value', async () => {
        const path = join(dir, 'mcp.json')
        await writeFile(path, JSON.stringify({ mcpServers: { mna: { url: 'old' } } }))
        expect((await planJsonChange(path, ['mcpServers', 'mna'], { url: 'u' }, 'mcp')).status).toBe('overwrite')
    })

    test('throws UnparseableConfigError on malformed JSON instead of clobbering', async () => {
        const path = join(dir, 'mcp.json')
        await writeFile(path, '{ "mcpServers": ')
        await expect(planJsonChange(path, ['mcpServers', 'mna'], {}, 'mcp')).rejects.toBeInstanceOf(
            UnparseableConfigError,
        )
    })
})

describe('readMergeableJson', () => {
    test('returns null for a missing file', async () => {
        expect(await readMergeableJson(join(dir, 'nope.json'))).toBeNull()
    })

    test('treats an empty file as an empty object', async () => {
        const path = join(dir, 'empty.json')
        await writeFile(path, '   \n')
        expect(await readMergeableJson(path)).toEqual({})
    })

    test('rejects a top-level array', async () => {
        const path = join(dir, 'arr.json')
        await writeFile(path, '[]')
        await expect(readMergeableJson(path)).rejects.toBeInstanceOf(UnparseableConfigError)
    })
})

describe('applyChange', () => {
    test('creates nested directories for a new skill file', async () => {
        const path = join(dir, 'skills', 'mna', 'references', 'x.md')
        const applied = await applyChange(await planFileChange(path, 'body', 'skill'))
        expect(applied.result).toBe('created')
        expect(await readFile(path, 'utf8')).toBe('body')
        expect(applied.backup).toBeUndefined()
    })

    test('backs up a file before overwriting it', async () => {
        const path = join(dir, 'SKILL.md')
        await writeFile(path, 'old content')
        const applied = await applyChange(await planFileChange(path, 'new content', 'skill'))
        expect(applied.result).toBe('updated')
        expect(applied.backup).toBeDefined()
        expect(await readFile(applied.backup!, 'utf8')).toBe('old content')
        expect(await readFile(path, 'utf8')).toBe('new content')
    })

    test('does nothing when the change is unchanged', async () => {
        const path = join(dir, 'SKILL.md')
        await writeFile(path, 'same')
        const applied = await applyChange(await planFileChange(path, 'same', 'skill'))
        expect(applied.result).toBe('unchanged')
        expect(await readdir(dir)).toEqual(['SKILL.md'])
    })

    test('merges into mcpServers without dropping sibling servers or other keys', async () => {
        const path = join(dir, 'config.json')
        await writeFile(
            path,
            JSON.stringify({ theme: 'dark', mcpServers: { filesystem: { command: 'npx' } } }, null, 2),
        )
        await applyChange(await planJsonChange(path, ['mcpServers', 'mna'], { url: 'u' }, 'mcp'))
        const after = JSON.parse(await readFile(path, 'utf8'))
        expect(after).toEqual({
            theme: 'dark',
            mcpServers: { filesystem: { command: 'npx' }, mna: { url: 'u' } },
        })
    })

    test('backs up a JSON config before merging into it', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, JSON.stringify({ mcpServers: {} }))
        const applied = await applyChange(await planJsonChange(path, ['mcpServers', 'mna'], { url: 'u' }, 'mcp'))
        expect(applied.backup).toBeDefined()
        expect(JSON.parse(await readFile(applied.backup!, 'utf8'))).toEqual({ mcpServers: {} })
    })

    test('creates the JSON config (with its parent key) when absent', async () => {
        const path = join(dir, 'nested', 'config.json')
        const applied = await applyChange(await planJsonChange(path, ['mcpServers', 'mna'], { url: 'u' }, 'mcp'))
        expect(applied.result).toBe('created')
        expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ mcpServers: { mna: { url: 'u' } } })
    })
})

describe('JSONC configs', () => {
    // VS Code's mcp.json and Gemini CLI's settings.json are JSONC by
    // convention. Treating a commented config as corrupt would send the user
    // down a dead end, and rewriting it with JSON.stringify would silently eat
    // their comments.
    const jsonc = `{
  // servers I actually use
  "servers": {
    "local": { "command": "npx" }, // trailing comma next
  },
  /* block comment */
  "other": true
}
`

    test('parses comments and trailing commas instead of refusing', async () => {
        const path = join(dir, 'mcp.json')
        await writeFile(path, jsonc)
        expect(await readMergeableJson(path)).toEqual({
            servers: { local: { command: 'npx' } },
            other: true,
        })
    })

    test('merging preserves comments, key order, and untouched formatting', async () => {
        const path = join(dir, 'mcp.json')
        await writeFile(path, jsonc)
        await applyChange(await planJsonChange(path, ['servers', 'mna'], { type: 'http' }, 'mcp'))
        const after = await readFile(path, 'utf8')
        expect(after).toContain('// servers I actually use')
        expect(after).toContain('/* block comment */')
        expect(after).toContain('"local"')
        expect(after).toContain('"mna"')
        expect(JSON.parse(JSON.stringify(await readMergeableJson(path)))).toMatchObject({
            servers: { local: { command: 'npx' }, mna: { type: 'http' } },
            other: true,
        })
    })

    test('re-planning after a JSONC merge reports unchanged (idempotent)', async () => {
        const path = join(dir, 'mcp.json')
        await writeFile(path, jsonc)
        const value = { type: 'http' }
        await applyChange(await planJsonChange(path, ['servers', 'mna'], value, 'mcp'))
        expect((await planJsonChange(path, ['servers', 'mna'], value, 'mcp')).status).toBe('unchanged')
    })
})

describe('non-object intermediates', () => {
    test('planJsonChange refuses when the container key holds a string', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, JSON.stringify({ mcpServers: 'nope' }))
        await expect(planJsonChange(path, ['mcpServers', 'mna'], {}, 'mcp')).rejects.toBeInstanceOf(
            ConfigConflictError,
        )
    })

    test('planJsonChange refuses when the container key holds an array', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, JSON.stringify({ mcpServers: [] }))
        await expect(planJsonChange(path, ['mcpServers', 'mna'], {}, 'mcp')).rejects.toBeInstanceOf(
            ConfigConflictError,
        )
    })

    test('planJsonChange refuses when the container key holds null', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, JSON.stringify({ mcpServers: null }))
        await expect(planJsonChange(path, ['mcpServers', 'mna'], {}, 'mcp')).rejects.toBeInstanceOf(
            ConfigConflictError,
        )
    })

    test('an absent container is fine — that is a create, not a conflict', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, JSON.stringify({ unrelated: 1 }))
        expect((await planJsonChange(path, ['mcpServers', 'mna'], {}, 'mcp')).status).toBe('create')
    })
})

describe('atomic writes', () => {
    test('a failed write leaves the original intact and cleans up the temp file', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, '{"original": true}')
        // A circular value makes JSON.stringify throw *after* we have started,
        // standing in for ENOSPC / an interrupt mid-write.
        await expect(writeFileAtomic(join(dir, 'nonexistent-dir', 'x.json'), 'data')).rejects.toThrow()
        expect(await readFile(path, 'utf8')).toBe('{"original": true}')
        expect((await readdir(dir)).filter((f) => f.includes('mna-tmp'))).toEqual([])
    })

    test('leaves no temp files behind on success', async () => {
        const path = join(dir, 'config.json')
        await writeFileAtomic(path, 'hello')
        expect(await readFile(path, 'utf8')).toBe('hello')
        expect((await readdir(dir)).filter((f) => f.includes('mna-tmp'))).toEqual([])
    })

    test('preserves the existing file mode when not forcing one', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, 'a')
        await chmod(path, 0o640)
        await writeFileAtomic(path, 'b')
        expect((await stat(path)).mode & 0o777).toBe(0o640)
    })
})

describe('credential handling', () => {
    test('a config carrying an API key ends up owner-only (0600)', async () => {
        const path = join(dir, 'config.json')
        const change = await planJsonChange(
            path,
            ['mcpServers', 'mna'],
            { url: 'u', headers: { 'X-API-Key': 'secret' } },
            'mcp',
            true,
        )
        await applyChange(change)
        expect((await stat(path)).mode & 0o777).toBe(0o600)
    })

    test('a config without a key keeps default permissions', async () => {
        const path = join(dir, 'config.json')
        await applyChange(await planJsonChange(path, ['mcpServers', 'mna'], { url: 'u' }, 'mcp', false))
        expect((await stat(path)).mode & 0o777).not.toBe(0o600)
    })

    test('backups are owner-only even when the original was world-readable', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, '{"oauth":"token"}')
        await chmod(path, 0o644)
        const backup = await backupFile(path)
        expect((await stat(backup)).mode & 0o777).toBe(0o600)
    })

    test('only the most recent backups are kept', async () => {
        const path = join(dir, 'config.json')
        await writeFile(path, '{}')
        for (let i = 0; i < BACKUP_RETENTION + 3; i++) {
            await backupFile(path, new Date(Date.UTC(2026, 0, 1, 0, 0, i)))
        }
        const backups = (await readdir(dir)).filter((f) => f.includes('.mna-backup-'))
        expect(backups).toHaveLength(BACKUP_RETENTION)
        // The survivors are the newest ones.
        expect(backups.sort().at(-1)).toContain('20260101T000005')
    })
})
