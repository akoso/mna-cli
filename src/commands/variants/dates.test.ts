import { describe, expect, test } from 'bun:test'
import { buildVariantDates, requireVariantDates } from './dates'

const FLEXIBLE_ARGS = {
    'depart-not-before': '2026-09-01',
    'depart-not-after': '2026-09-03',
    'return-not-before': '2026-09-10',
    'return-not-after': '2026-09-12',
    'min-nights': '7',
    'max-nights': '10',
}

describe('buildVariantDates', () => {
    test('returns undefined when no date flag is given', () => {
        expect(buildVariantDates({ name: 'Beach option' })).toBeUndefined()
    })

    test('builds an exact-dates object from --start-date / --end-date', () => {
        expect(buildVariantDates({ 'start-date': '2026-09-01', 'end-date': '2026-09-08' })).toEqual({
            startDate: '2026-09-01T00:00:00.000Z',
            endDate: '2026-09-08T00:00:00.000Z',
        })
    })

    test('builds a flexi-dates object with numeric night counts', () => {
        expect(buildVariantDates(FLEXIBLE_ARGS)).toEqual({
            departLeavingNotBeforeDate: '2026-09-01T00:00:00.000Z',
            departArrivingNotAfterDate: '2026-09-03T00:00:00.000Z',
            returnLeavingNotBeforeDate: '2026-09-10T00:00:00.000Z',
            returnArrivingNotAfterDate: '2026-09-12T00:00:00.000Z',
            minNights: 7,
            maxNights: 10,
        })
    })

    test('rejects a half-filled exact-dates pair, naming the missing flag', () => {
        expect(() => buildVariantDates({ 'start-date': '2026-09-01' })).toThrow(
            /Missing --end-date/,
        )
    })

    test('rejects a half-filled flexi-dates set', () => {
        const { 'max-nights': _dropped, ...partial } = FLEXIBLE_ARGS
        expect(() => buildVariantDates(partial)).toThrow(/Missing --max-nights/)
    })

    test('rejects mixing the two shapes', () => {
        expect(() =>
            buildVariantDates({ 'start-date': '2026-09-01', 'min-nights': '7' }),
        ).toThrow(/Mixed date shapes/)
    })

    test('rejects a non-integer night count', () => {
        expect(() => buildVariantDates({ ...FLEXIBLE_ARGS, 'min-nights': 'seven' })).toThrow(
            /Invalid night count for --min-nights/,
        )
    })

    test('rejects an unparseable date with the flag name', () => {
        expect(() =>
            buildVariantDates({ 'start-date': 'next tuesday', 'end-date': '2026-09-08' }),
        ).toThrow(/Invalid date for --start-date/)
    })
})

describe('requireVariantDates', () => {
    test('fails fast when dates are absent, listing both shapes', () => {
        expect(() => requireVariantDates({ name: 'Beach option' })).toThrow(
            /cannot be created without dates/,
        )
    })

    test('passes a complete shape through', () => {
        expect(requireVariantDates({ 'start-date': '2026-09-01', 'end-date': '2026-09-08' })).toEqual(
            { startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-08T00:00:00.000Z' },
        )
    })
})
