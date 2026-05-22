import { describe, expect, test } from 'bun:test'
import { renderJson } from './json'

describe('renderJson', () => {
    test('writes pretty-printed JSON with trailing newline', () => {
        const writes: string[] = []
        renderJson({ hello: 'world', nested: { a: 1 } }, { write: (s) => (writes.push(s), true) })

        expect(writes.length).toBe(1)
        const parsed = JSON.parse(writes[0]!)
        expect(parsed).toEqual({ hello: 'world', nested: { a: 1 } })
        expect(writes[0]).toMatch(/\n$/)
        expect(writes[0]).toContain('  "hello"')
    })

    test('handles arrays', () => {
        const writes: string[] = []
        renderJson([1, 2, 3], { write: (s) => (writes.push(s), true) })
        expect(JSON.parse(writes[0]!)).toEqual([1, 2, 3])
    })

    test('handles null', () => {
        const writes: string[] = []
        renderJson(null, { write: (s) => (writes.push(s), true) })
        expect(writes[0]!.trim()).toBe('null')
    })
})
