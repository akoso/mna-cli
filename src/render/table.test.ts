import { describe, expect, test } from 'bun:test'
import { renderTable } from './table'

describe('renderTable', () => {
    test('renders a simple table with headers and rows', () => {
        const writes: string[] = []
        const env = process.env.NO_COLOR
        process.env.NO_COLOR = '1'

        try {
            renderTable(
                {
                    columns: [
                        { header: 'ID', key: 'id' },
                        { header: 'Name', key: 'name' },
                    ],
                    rows: [
                        { id: 'trip_1', name: 'Tokyo 2026' },
                        { id: 'trip_2', name: 'Iceland' },
                    ],
                },
                { write: (s) => (writes.push(s), true) },
            )
        } finally {
            process.env.NO_COLOR = env
        }

        const output = writes.join('')
        expect(output).toContain('ID')
        expect(output).toContain('Name')
        expect(output).toContain('trip_1')
        expect(output).toContain('Tokyo 2026')
        expect(output).toContain('Iceland')
    })

    test('handles empty rows with a placeholder line', () => {
        const writes: string[] = []
        renderTable(
            {
                columns: [{ header: 'ID', key: 'id' }],
                rows: [],
                emptyMessage: 'No trips yet.',
            },
            { write: (s) => (writes.push(s), true) },
        )
        expect(writes.join('')).toContain('No trips yet.')
    })

    test('truncates long cells to maxWidth', () => {
        const writes: string[] = []
        const env = process.env.NO_COLOR
        process.env.NO_COLOR = '1'
        try {
            renderTable(
                {
                    columns: [{ header: 'Name', key: 'name', maxWidth: 10 }],
                    rows: [{ name: 'This is a very long trip name that should truncate' }],
                },
                { write: (s) => (writes.push(s), true) },
            )
        } finally {
            process.env.NO_COLOR = env
        }
        const output = writes.join('')
        expect(output).toContain('This is a…')
    })
})
