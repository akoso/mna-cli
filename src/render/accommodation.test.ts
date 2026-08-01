import { describe, expect, test } from 'bun:test'
import { accommodationRows, formatFeatures, formatRating, formatStayDetails } from './accommodation'

describe('formatRating', () => {
    test('keeps the source scale rather than normalising', () => {
        expect(formatRating({ score: 8.8, scale: 10, count: 92 })).toBe('8.8/10 (92)')
        expect(formatRating({ score: 4.4, scale: 5, count: 310 })).toBe('4.4/5 (310)')
    })

    test('omits the review count when absent', () => {
        expect(formatRating({ score: 9, scale: 10 })).toBe('9/10')
    })

    test('renders nothing when unrated', () => {
        expect(formatRating(undefined)).toBe('')
    })
})

describe('formatFeatures', () => {
    test('labels features and keeps private and shared kitchens apart', () => {
        expect(formatFeatures(['privateKitchen', 'freeParking'])).toBe('Private kitchen, Free parking')
        expect(formatFeatures(['sharedKitchen'])).toBe('Shared kitchen')
    })

    test('renders nothing when there are no features', () => {
        expect(formatFeatures(undefined)).toBe('')
        expect(formatFeatures([])).toBe('')
    })
})

describe('formatStayDetails', () => {
    test('combines type, room count and size', () => {
        const details = formatStayDetails({
            key: 'o1',
            totalCost: 1200,
            currency: 'EUR',
            location: {},
            type: 'apartment',
            roomDetails: { numberOfRooms: 2, sizeInM2: 45 },
        })
        expect(details).toBe('apartment · 2 rooms · 45 m²')
    })

    test('drops the parts the option does not carry', () => {
        expect(
            formatStayDetails({
                key: 'o1',
                totalCost: 1200,
                currency: 'EUR',
                location: {},
                roomDetails: { numberOfRooms: 1 },
            }),
        ).toBe('1 room')
    })

    test('treats a zero room count or size as unset', () => {
        expect(
            formatStayDetails({
                key: 'o1',
                totalCost: 1200,
                currency: 'EUR',
                location: {},
                type: 'apartment',
                roomDetails: { numberOfRooms: 0, sizeInM2: 0 },
            }),
        ).toBe('apartment')
    })
})

describe('accommodationRows', () => {
    test('marks the selected option and carries the new metadata', () => {
        const rows = accommodationRows([
            {
                destination: 'Split',
                destinationKey: 'd1',
                selectedAccommodation: 'o2',
                accommodationOptions: [
                    { key: 'o1', name: 'Hostel Central', totalCost: 400, currency: 'EUR', location: {} },
                    {
                        key: 'o2',
                        name: 'Seaside Apartment',
                        totalCost: 1200,
                        currency: 'EUR',
                        location: {},
                        type: 'apartment',
                        externalRating: { score: 8.8, scale: 10, count: 92 },
                        features: ['beachfront', 'privateKitchen'],
                    },
                ],
                transportOptions: [],
                gettingAroundOptions: [],
            },
        ])

        expect(rows).toHaveLength(2)
        expect(rows[0]!.option).toBe('  Hostel Central')
        expect(rows[1]!.option).toBe('✓ Seaside Apartment')
        expect(rows[1]!.cost).toBe('1200 EUR')
        expect(rows[1]!.rating).toBe('8.8/10 (92)')
        expect(rows[1]!.features).toBe('Beachfront, Private kitchen')
    })

    test('handles a trip with no destinations', () => {
        expect(accommodationRows(undefined)).toEqual([])
    })
})
