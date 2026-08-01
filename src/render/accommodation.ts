import type { components } from '../api/generated/schema'

type AccommodationOption = components['schemas']['AccommodationOptionV1Dto']
type ExternalRating = components['schemas']['ExternalRatingV1Dto']
type Destination = components['schemas']['TripDestinationV1Dto']

const FEATURE_LABELS: Record<string, string> = {
    beachfront: 'Beachfront',
    beachNearby: 'Beach nearby',
    privateBeachArea: 'Private beach',
    swimmingPool: 'Pool',
    kidsPool: 'Kids pool',
    kidsPlayArea: 'Kids play area',
    privateKitchen: 'Private kitchen',
    sharedKitchen: 'Shared kitchen',
    washingMachine: 'Washing machine',
    familyRooms: 'Family rooms',
    airConditioning: 'A/C',
    freeParking: 'Free parking',
    freeWifi: 'Free WiFi',
    balconyTerrace: 'Balcony/terrace',
    petsAllowed: 'Pets allowed',
}

/** Booking.com rates out of 10 and Google out of 5, so a score without its scale is ambiguous. */
export function formatRating(rating: ExternalRating | undefined): string {
    if (rating === undefined) return ''
    const reviews = rating.count === undefined ? '' : ` (${rating.count})`
    return `${rating.score}/${rating.scale}${reviews}`
}

export function formatFeatures(features: AccommodationOption['features']): string {
    return (features ?? []).map((feature) => FEATURE_LABELS[feature] ?? feature).join(', ')
}

/** A zero room count or size is a placeholder the app writes, not a measurement. */
export function formatStayDetails(option: AccommodationOption): string {
    const rooms = option.roomDetails?.numberOfRooms
    const size = option.roomDetails?.sizeInM2
    return [
        option.type,
        rooms ? `${rooms} room${rooms === 1 ? '' : 's'}` : undefined,
        size ? `${size} m²` : undefined,
    ]
        .filter((part) => part !== undefined)
        .join(' · ')
}

export interface AccommodationRow {
    destination: string
    option: string
    cost: string
    rating: string
    details: string
    features: string
}

export function accommodationRows(destinations: Destination[] | undefined): AccommodationRow[] {
    return (destinations ?? []).flatMap((destination) =>
        (destination.accommodationOptions ?? []).map((option) => {
            const selected = option.key === destination.selectedAccommodation
            return {
                destination: destination.destination,
                option: `${selected ? '✓ ' : '  '}${option.name ?? option.key}`,
                cost: `${option.totalCost} ${option.currency}`,
                rating: formatRating(option.externalRating),
                details: formatStayDetails(option),
                features: formatFeatures(option.features),
            }
        }),
    )
}
