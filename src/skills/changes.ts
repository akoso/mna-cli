import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type ChangeStatus = 'create' | 'overwrite' | 'unchanged'

/** Write a whole file (skill markdown). */
export interface FileChange {
    kind: 'file'
    path: string
    content: string
    status: ChangeStatus
    /** Human label, e.g. "skill" or "rule". */
    label: string
}

/** Merge a single value into a JSON config at `keyPath`, leaving siblings alone. */
export interface JsonChange {
    kind: 'json'
    path: string
    keyPath: string[]
    value: unknown
    status: ChangeStatus
    label: string
}

export type PlannedChange = FileChange | JsonChange

export interface AppliedChange {
    path: string
    result: 'created' | 'updated' | 'unchanged'
    backup?: string
}

export class UnparseableConfigError extends Error {
    constructor(
        readonly path: string,
        readonly reason: string,
    ) {
        super(`${path} is not valid JSON (${reason}).`)
        this.name = 'UnparseableConfigError'
    }
}

async function readIfExists(path: string): Promise<string | null> {
    try {
        return await readFile(path, 'utf8')
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw err
    }
}

/**
 * Reads a JSON config that we intend to merge into. Missing file → `null`
 * (we will create it). Present but unparseable → throw, so callers can refuse
 * politely instead of destroying a config we do not understand.
 */
export async function readMergeableJson(path: string): Promise<Record<string, unknown> | null> {
    const raw = await readIfExists(path)
    if (raw === null) return null
    if (raw.trim() === '') return {}

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (err) {
        throw new UnparseableConfigError(path, (err as Error).message)
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new UnparseableConfigError(path, `expected an object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`)
    }
    return parsed as Record<string, unknown>
}

function getAtPath(root: Record<string, unknown>, keyPath: string[]): unknown {
    let node: unknown = root
    for (const key of keyPath) {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined
        node = (node as Record<string, unknown>)[key]
    }
    return node
}

function setAtPath(root: Record<string, unknown>, keyPath: string[], value: unknown): void {
    let node = root
    for (const key of keyPath.slice(0, -1)) {
        const next = node[key]
        if (next === null || typeof next !== 'object' || Array.isArray(next)) {
            node[key] = {}
        }
        node = node[key] as Record<string, unknown>
    }
    node[keyPath[keyPath.length - 1]!] = value
}

function sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

/** Decide create/overwrite/unchanged for a file write without touching disk. */
export async function planFileChange(
    path: string,
    content: string,
    label: string,
): Promise<FileChange> {
    const existing = await readIfExists(path)
    const status: ChangeStatus =
        existing === null ? 'create' : existing === content ? 'unchanged' : 'overwrite'
    return { kind: 'file', path, content, status, label }
}

/** Decide create/overwrite/unchanged for a JSON merge without touching disk. */
export async function planJsonChange(
    path: string,
    keyPath: string[],
    value: unknown,
    label: string,
): Promise<JsonChange> {
    const existing = await readMergeableJson(path)
    let status: ChangeStatus = 'create'
    if (existing !== null) {
        const current = getAtPath(existing, keyPath)
        status = current === undefined ? 'create' : sameJson(current, value) ? 'unchanged' : 'overwrite'
    }
    return { kind: 'json', path, keyPath, value, status, label }
}

function backupSuffix(now = new Date()): string {
    return now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
}

/** Copy `path` aside before we modify it. Returns the backup path. */
export async function backupFile(path: string, now?: Date): Promise<string> {
    const target = `${path}.mna-backup-${backupSuffix(now)}`
    await copyFile(path, target)
    return target
}

/**
 * Performs a planned change. `unchanged` changes are no-ops. Anything that
 * modifies an existing file makes a timestamped backup next to it first.
 */
export async function applyChange(change: PlannedChange): Promise<AppliedChange> {
    if (change.status === 'unchanged') {
        return { path: change.path, result: 'unchanged' }
    }

    await mkdir(dirname(change.path), { recursive: true })

    if (change.kind === 'file') {
        const backup = change.status === 'overwrite' ? await backupFile(change.path) : undefined
        await writeFile(change.path, change.content, 'utf8')
        return { path: change.path, result: change.status === 'create' ? 'created' : 'updated', backup }
    }

    const existing = await readMergeableJson(change.path)
    const backup = existing === null ? undefined : await backupFile(change.path)
    const next = existing ?? {}
    setAtPath(next, change.keyPath, change.value)
    await writeFile(change.path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    return { path: change.path, result: existing === null ? 'created' : 'updated', backup }
}
