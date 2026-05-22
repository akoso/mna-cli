export interface Writer {
    write(s: string): boolean
}

const DEFAULT_WRITER: Writer = process.stdout

/**
 * Pretty-prints any JSON-serializable value to the writer (default: stdout)
 * with a trailing newline.
 */
export function renderJson(value: unknown, writer: Writer = DEFAULT_WRITER): void {
    writer.write(JSON.stringify(value, null, 2) + '\n')
}
