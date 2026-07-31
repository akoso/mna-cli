import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    applyChange,
    planFileChange,
    planJsonChange,
    readMergeableJson,
    UnparseableConfigError,
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
