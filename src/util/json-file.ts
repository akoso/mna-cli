import { readFile } from 'node:fs/promises'

/**
 * Read a file and parse it as a JSON object. Uses node:fs so it works in the
 * compiled binary (which runs on Node, where the `Bun` global is undefined).
 */
export async function readJsonObject(path: string): Promise<Record<string, unknown>> {
    let raw: string
    try {
        raw = await readFile(path, 'utf8')
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`JSON file not found: ${path}`)
        }
        throw err
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (err) {
        throw new Error(`Invalid JSON in ${path}: ${(err as Error).message}`)
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(
            `Expected JSON object in ${path}, got ${Array.isArray(parsed) ? 'array' : typeof parsed}.`,
        )
    }
    return parsed as Record<string, unknown>
}
