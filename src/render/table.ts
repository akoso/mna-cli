import { colors } from './colors'

export interface Column<Row extends object> {
    header: string
    key: keyof Row & string
    maxWidth?: number
}

export interface TableInput<Row extends object> {
    columns: Column<Row>[]
    rows: Row[]
    emptyMessage?: string
}

export interface Writer {
    write(s: string): boolean
}

const DEFAULT_WRITER: Writer = process.stdout

export function renderTable<Row extends object>(
    input: TableInput<Row>,
    writer: Writer = DEFAULT_WRITER,
): void {
    const { columns, rows, emptyMessage = 'No results.' } = input

    if (rows.length === 0) {
        writer.write(`${colors.dim(emptyMessage)}\n`)
        return
    }

    const stringRows: string[][] = rows.map((row) =>
        columns.map((col) => {
            const raw = (row as Record<string, unknown>)[col.key]
            const text = raw == null ? '' : String(raw)
            return col.maxWidth && text.length > col.maxWidth ? text.slice(0, col.maxWidth - 1) + '…' : text
        }),
    )

    const widths = columns.map((col, i) => {
        const headerWidth = col.header.length
        const dataWidth = Math.max(0, ...stringRows.map((r) => r[i]!.length))
        const width = Math.max(headerWidth, dataWidth)
        return col.maxWidth ? Math.min(width, col.maxWidth) : width
    })

    const pad = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - s.length))
    const headerLine = columns.map((col, i) => colors.bold(pad(col.header, widths[i]!))).join('  ')
    const separator = widths.map((w) => '─'.repeat(w)).join('  ')

    writer.write(headerLine + '\n')
    writer.write(colors.dim(separator) + '\n')

    for (const row of stringRows) {
        writer.write(row.map((cell, i) => pad(cell, widths[i]!)).join('  ') + '\n')
    }
}
