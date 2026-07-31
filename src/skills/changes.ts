import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { chmod, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
// Import the ESM build explicitly: the package's `main` is a UMD bundle whose
// lazy `require('./impl/format')` survives bundling and blows up at runtime in
// dist/mna.js. The ESM entry uses static imports and bundles cleanly.
import {
    applyEdits,
    modify,
    parse as parseJsonc,
    printParseErrorCode,
    type ParseError,
} from 'jsonc-parser/lib/esm/main.js'

export type ChangeStatus = 'create' | 'overwrite' | 'unchanged'

/** Write a whole file (skill markdown). */
export interface FileChange {
    kind: 'file'
    path: string
    content: string
    status: ChangeStatus
    /** Human label, e.g. "skill" or "mcp". */
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
    /** The value embeds a credential — the file must end up owner-only. */
    secret: boolean
}

export type PlannedChange = FileChange | JsonChange

export interface AppliedChange {
    path: string
    /** Mirrors PlannedChange.label ("skill" | "mcp") so callers can report accurately. */
    label: string
    result: 'created' | 'updated' | 'unchanged'
    backup?: string
}

/**
 * A write that failed *after* we had already taken a backup. Carries the
 * backup path so the user is told where their original went.
 */
export class ApplyFailedError extends Error {
    constructor(
        readonly path: string,
        override readonly cause: unknown,
        readonly backup?: string,
    ) {
        super(cause instanceof Error ? cause.message : String(cause))
        this.name = 'ApplyFailedError'
    }
}

/** The config exists but we cannot parse it — refuse rather than replace it. */
export class UnparseableConfigError extends Error {
    constructor(
        readonly path: string,
        readonly reason: string,
    ) {
        super(`${path} is not valid JSON (${reason}).`)
        this.name = 'UnparseableConfigError'
    }
}

/**
 * The config parses, but the key we need to merge into holds something that is
 * not an object (a string, array, or null). Overwriting it would destroy data,
 * so we refuse just as loudly as for a parse failure.
 */
export class ConfigConflictError extends Error {
    constructor(
        readonly path: string,
        readonly keyPath: string[],
        readonly actual: string,
    ) {
        super(
            `${path} has a non-object value at "${keyPath.join('.')}" (found ${actual}). mna will not replace it.`,
        )
        this.name = 'ConfigConflictError'
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function describeType(value: unknown): string {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'an array'
    return `a ${typeof value}`
}

export interface ConfigDoc {
    /** Raw text, or null when the file does not exist. */
    text: string | null
    /** Parsed object, or null when the file does not exist. */
    data: Record<string, unknown> | null
}

/**
 * Reads a config we intend to merge into. Comments and trailing commas are
 * tolerated — VS Code's `mcp.json` and Gemini CLI's `settings.json` are JSONC
 * by convention, and treating a commented config as "corrupt" would send users
 * down a dead end.
 */
export async function readConfigDoc(path: string): Promise<ConfigDoc> {
    const text = await readIfExists(path)
    if (text === null) return { text: null, data: null }
    if (text.trim() === '') return { text, data: {} }

    const errors: ParseError[] = []
    const parsed = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false })

    if (errors.length > 0) {
        const first = errors[0]!
        throw new UnparseableConfigError(path, `${printParseErrorCode(first.error)} at offset ${first.offset}`)
    }
    if (!isPlainObject(parsed)) {
        throw new UnparseableConfigError(path, `expected an object, got ${describeType(parsed)}`)
    }
    return { text, data: parsed }
}

/** Back-compat alias used by callers that only want the parsed object. */
export async function readMergeableJson(path: string): Promise<Record<string, unknown> | null> {
    return (await readConfigDoc(path)).data
}

function getAtPath(root: Record<string, unknown>, keyPath: string[]): unknown {
    let node: unknown = root
    for (const key of keyPath) {
        if (!isPlainObject(node)) return undefined
        node = node[key]
    }
    return node
}

/**
 * Every container along `keyPath` must be absent or a plain object. A string,
 * array, or null in the way is a hard stop — silently replacing it with `{}`
 * would delete whatever the user had there.
 */
function assertPathMergeable(path: string, root: Record<string, unknown>, keyPath: string[]): void {
    let node: unknown = root
    for (let i = 0; i < keyPath.length - 1; i++) {
        const key = keyPath[i]!
        node = (node as Record<string, unknown>)[key]
        if (node === undefined) return
        if (!isPlainObject(node)) {
            throw new ConfigConflictError(path, keyPath.slice(0, i + 1), describeType(node))
        }
    }
}

function sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Writes via a temp file in the same directory plus `rename()`, which is
 * atomic on POSIX. A crash, a full disk, or a Ctrl-C mid-write therefore
 * leaves the original file intact rather than truncated — this matters because
 * `~/.claude.json` holds Claude Code's entire user state and is routinely
 * multiple megabytes.
 */
export async function writeFileAtomic(path: string, content: string, mode?: number): Promise<void> {
    const tmp = join(dirname(path), `.${basename(path)}.mna-tmp-${process.pid}-${randomBytes(4).toString('hex')}`)
    try {
        const targetMode = mode ?? (await currentMode(path))
        // Create with the final mode rather than chmod-ing afterwards: for a
        // file holding an API key, chmod-after leaves a brief window in which
        // the secret is world-readable.
        await writeFile(tmp, content, targetMode === undefined ? 'utf8' : { encoding: 'utf8', mode: targetMode })
        if (targetMode !== undefined) await chmod(tmp, targetMode)
        await rename(tmp, path)
    } catch (err) {
        await rm(tmp, { force: true })
        throw err
    }
}

async function currentMode(path: string): Promise<number | undefined> {
    try {
        return (await stat(path)).mode & 0o777
    } catch {
        return undefined
    }
}

/** Decide create/overwrite/unchanged for a file write without touching disk. */
export async function planFileChange(path: string, content: string, label: string): Promise<FileChange> {
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
    secret = false,
): Promise<JsonChange> {
    const { data } = await readConfigDoc(path)
    let status: ChangeStatus = 'create'
    if (data !== null) {
        assertPathMergeable(path, data, keyPath)
        const current = getAtPath(data, keyPath)
        status = current === undefined ? 'create' : sameJson(current, value) ? 'unchanged' : 'overwrite'
    }
    return { kind: 'json', path, keyPath, value, status, label, secret }
}

function backupSuffix(now = new Date()): string {
    // Millisecond precision: a single run can back up the same file twice, and
    // second-granularity names collided (and so overwrote each other).
    return now.toISOString().replace(/[-:.]/g, '').replace(/Z$/, '')
}

/** How many timestamped backups of a given file we keep around. */
export const BACKUP_RETENTION = 3

async function pruneBackups(path: string, keep = BACKUP_RETENTION): Promise<void> {
    const dir = dirname(path)
    const prefix = `${basename(path)}.mna-backup-`
    try {
        const entries = (await readdir(dir)).filter((name) => name.startsWith(prefix)).sort()
        for (const stale of entries.slice(0, Math.max(0, entries.length - keep))) {
            await rm(join(dir, stale), { force: true })
        }
    } catch {
        // Pruning is best-effort; never fail an install over it.
    }
}

/**
 * Copy `path` aside before we modify it. Backups inherit 0600 because the
 * originals can contain OAuth tokens and API keys, and only the most recent
 * few are kept.
 */
export async function backupFile(path: string, now?: Date): Promise<string> {
    const base = `${path}.mna-backup-${backupSuffix(now)}`
    // Timestamps alone are not unique: a single run can back the same file up
    // twice within a millisecond, and a colliding name would silently overwrite
    // the earlier backup — losing exactly the thing we are trying to preserve.
    let target = base
    for (let n = 2; existsSync(target); n++) {
        target = `${base}-${n}`
    }
    await copyFile(path, target)
    await chmod(target, 0o600)
    await pruneBackups(path)
    return target
}

/**
 * Performs a planned change. `unchanged` changes are no-ops. Anything that
 * modifies an existing file is backed up first, and every write is atomic.
 */
export async function applyChange(change: PlannedChange): Promise<AppliedChange> {
    if (change.status === 'unchanged') {
        return { path: change.path, label: change.label, result: 'unchanged' }
    }

    await mkdir(dirname(change.path), { recursive: true })

    if (change.kind === 'file') {
        const backup = change.status === 'overwrite' ? await backupFile(change.path) : undefined
        try {
            await writeFileAtomic(change.path, change.content)
        } catch (err) {
            throw new ApplyFailedError(change.path, err, backup)
        }
        return {
            path: change.path,
            label: change.label,
            result: change.status === 'create' ? 'created' : 'updated',
            backup,
        }
    }

    const { text, data } = await readConfigDoc(change.path)
    if (data !== null) assertPathMergeable(change.path, data, change.keyPath)
    const backup = text === null ? undefined : await backupFile(change.path)

    // For an existing config, edit the text in place: jsonc-parser rewrites only
    // the affected span, so comments, key order, and formatting all survive.
    const next =
        text === null
            ? `${JSON.stringify(buildNested(change.keyPath, change.value), null, 2)}\n`
            : applyEdits(
                  text,
                  modify(text, change.keyPath, change.value, {
                      formattingOptions: { insertSpaces: true, tabSize: 2 },
                  }),
              )

    try {
        await writeFileAtomic(change.path, next, change.secret ? 0o600 : undefined)
    } catch (err) {
        throw new ApplyFailedError(change.path, err, backup)
    }
    return { path: change.path, label: change.label, result: text === null ? 'created' : 'updated', backup }
}

function buildNested(keyPath: string[], value: unknown): Record<string, unknown> {
    const root: Record<string, unknown> = {}
    let node = root
    for (const key of keyPath.slice(0, -1)) {
        node[key] = {}
        node = node[key] as Record<string, unknown>
    }
    node[keyPath[keyPath.length - 1]!] = value
    return root
}
