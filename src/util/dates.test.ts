import { describe, expect, test } from 'bun:test'
import { normalizeToIsoDateTime } from './dates'

describe('normalizeToIsoDateTime', () => {
    test('expands a YYYY-MM-DD date to UTC start-of-day ISO', () => {
        expect(normalizeToIsoDateTime('2026-07-07', '--start-date')).toBe('2026-07-07T00:00:00.000Z')
    })

    test('passes through a full ISO date-time, normalizing to millis + Z', () => {
        expect(normalizeToIsoDateTime('2026-07-02T12:00:00Z', '--free-cancellation-until')).toBe(
            '2026-07-02T12:00:00.000Z',
        )
    })

    test('trims surrounding whitespace', () => {
        expect(normalizeToIsoDateTime('  2026-07-15  ', '--end-date')).toBe('2026-07-15T00:00:00.000Z')
    })

    test('rejects an impossible calendar date', () => {
        expect(() => normalizeToIsoDateTime('2026-02-31', '--start-date')).toThrow(/Invalid date for --start-date/)
    })

    test('rejects garbage with a flag-named message', () => {
        expect(() => normalizeToIsoDateTime('not-a-date', '--end-date')).toThrow(/Invalid date for --end-date/)
    })
})
