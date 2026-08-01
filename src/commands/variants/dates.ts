import { normalizeToIsoDateTime } from '../../util/dates'

const EXACT_DATE_FIELDS: Record<string, string> = {
    'start-date': 'startDate',
    'end-date': 'endDate',
}

const FLEXIBLE_DATE_FIELDS: Record<string, string> = {
    'depart-not-before': 'departLeavingNotBeforeDate',
    'depart-not-after': 'departArrivingNotAfterDate',
    'return-not-before': 'returnLeavingNotBeforeDate',
    'return-not-after': 'returnArrivingNotAfterDate',
}

const FLEXIBLE_NIGHT_FIELDS: Record<string, string> = {
    'min-nights': 'minNights',
    'max-nights': 'maxNights',
}

const EXACT_FLAGS = Object.keys(EXACT_DATE_FIELDS)
const FLEXIBLE_FLAGS = [...Object.keys(FLEXIBLE_DATE_FIELDS), ...Object.keys(FLEXIBLE_NIGHT_FIELDS)]

/** Date flags shared by `variants add` and `variants edit`. */
export const variantDateArgs = {
    'start-date': {
        type: 'string',
        description: 'Exact dates: first day of the trip (YYYY-MM-DD or ISO date-time).',
    },
    'end-date': {
        type: 'string',
        description: 'Exact dates: last day of the trip (YYYY-MM-DD or ISO date-time).',
    },
    'depart-not-before': {
        type: 'string',
        description: 'Flexible dates: earliest outbound departure.',
    },
    'depart-not-after': {
        type: 'string',
        description: 'Flexible dates: latest outbound arrival.',
    },
    'return-not-before': {
        type: 'string',
        description: 'Flexible dates: earliest return departure.',
    },
    'return-not-after': {
        type: 'string',
        description: 'Flexible dates: latest return arrival.',
    },
    'min-nights': { type: 'string', description: 'Flexible dates: minimum nights away.' },
    'max-nights': { type: 'string', description: 'Flexible dates: maximum nights away.' },
} as const

function suppliedFlags(args: Record<string, unknown>, flags: string[]): string[] {
    return flags.filter((flag) => args[flag] !== undefined && args[flag] !== '')
}

function flagList(flags: string[]): string {
    return flags.map((flag) => `--${flag}`).join(', ')
}

function parseNightCount(value: string, flag: string): number {
    const nights = Number(value.trim())
    if (!Number.isInteger(nights) || nights < 0) {
        throw new Error(`Invalid night count for ${flag}: "${value}". Use a whole number of nights.`)
    }
    return nights
}

/**
 * Builds the variant `dates` body from the date flags, or returns undefined when
 * none were given. The API accepts only a complete exact-dates or complete
 * flexible-dates object, so anything half-filled throws before the request goes out.
 */
export function buildVariantDates(
    args: Record<string, unknown>,
): Record<string, unknown> | undefined {
    const exact = suppliedFlags(args, EXACT_FLAGS)
    const flexible = suppliedFlags(args, FLEXIBLE_FLAGS)

    if (exact.length > 0 && flexible.length > 0) {
        throw new Error(
            `Mixed date shapes: use either exact dates (${flagList(EXACT_FLAGS)}) or flexible dates (${flagList(FLEXIBLE_FLAGS)}), not both.`,
        )
    }
    if (exact.length === 0 && flexible.length === 0) return undefined

    const isExact = exact.length > 0
    const required = isExact ? EXACT_FLAGS : FLEXIBLE_FLAGS
    const missing = required.filter((flag) => !(isExact ? exact : flexible).includes(flag))
    if (missing.length > 0) {
        throw new Error(
            `Incomplete dates: ${flagList(required)} must be given together. Missing ${flagList(missing)}.`,
        )
    }

    const dates: Record<string, unknown> = {}
    for (const [flag, field] of Object.entries(
        isExact ? EXACT_DATE_FIELDS : FLEXIBLE_DATE_FIELDS,
    )) {
        dates[field] = normalizeToIsoDateTime(String(args[flag]), `--${flag}`)
    }
    if (!isExact) {
        for (const [flag, field] of Object.entries(FLEXIBLE_NIGHT_FIELDS)) {
            dates[field] = parseNightCount(String(args[flag]), `--${flag}`)
        }
    }
    return dates
}

/** Same as `buildVariantDates`, for the create path where the API demands dates. */
export function requireVariantDates(args: Record<string, unknown>): Record<string, unknown> {
    const dates = buildVariantDates(args)
    if (dates === undefined) {
        throw new Error(
            `A variant cannot be created without dates. Supply exact dates (${flagList(EXACT_FLAGS)}) or flexible dates (${flagList(FLEXIBLE_FLAGS)}).`,
        )
    }
    return dates
}
