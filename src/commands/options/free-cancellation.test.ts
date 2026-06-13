import { describe, expect, test } from 'bun:test'
import { applyFreeCancellation } from './free-cancellation'

describe('applyFreeCancellation', () => {
    test('merges a normalized freeCancellationUntil for accommodation', () => {
        const body: Record<string, unknown> = { name: 'Hotel' }
        applyFreeCancellation(body, '2026-07-02', 'accommodation')
        expect(body).toEqual({ name: 'Hotel', freeCancellationUntil: '2026-07-02T00:00:00.000Z' })
    })

    test('passes a full ISO date-time through', () => {
        const body: Record<string, unknown> = {}
        applyFreeCancellation(body, '2026-07-02T12:00:00.000Z', 'accommodation')
        expect(body.freeCancellationUntil).toBe('2026-07-02T12:00:00.000Z')
    })

    test('is a no-op when the flag is absent', () => {
        const body: Record<string, unknown> = { name: 'Train' }
        applyFreeCancellation(body, undefined, 'transport')
        expect(body).toEqual({ name: 'Train' })
    })

    test('rejects non-accommodation kinds', () => {
        expect(() => applyFreeCancellation({}, '2026-07-02', 'transport')).toThrow(
            /only valid for the "accommodation" kind/,
        )
    })
})
