import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJsonObject } from './json-file'

let dir: string

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mna-json-test-'))
})

afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
})

describe('readJsonObject', () => {
    test('reads and parses a JSON object via node:fs (no Bun global needed)', async () => {
        const path = join(dir, 'body.json')
        await writeFile(path, JSON.stringify({ name: 'Hotel', nights: 3 }))
        expect(await readJsonObject(path)).toEqual({ name: 'Hotel', nights: 3 })
    })

    test('throws a clear error when the file is missing', async () => {
        await expect(readJsonObject(join(dir, 'nope.json'))).rejects.toThrow(/JSON file not found/)
    })

    test('throws on invalid JSON', async () => {
        const path = join(dir, 'bad.json')
        await writeFile(path, '{ not json')
        await expect(readJsonObject(path)).rejects.toThrow(/Invalid JSON/)
    })

    test('rejects arrays and non-objects', async () => {
        const path = join(dir, 'arr.json')
        await writeFile(path, '[1, 2, 3]')
        await expect(readJsonObject(path)).rejects.toThrow(/Expected JSON object.*got array/)
    })
})
