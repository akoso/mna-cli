const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normalize a user-supplied date into an ISO 8601 date-time string. Accepts a
 * bare `YYYY-MM-DD` (expanded to UTC start-of-day) or a full ISO date-time.
 * Throws a flag-named error on anything that isn't a real date.
 */
export function normalizeToIsoDateTime(value: string, flag: string): string {
    const trimmed = value.trim()
    const isDateOnly = DATE_ONLY.test(trimmed)
    const date = new Date(isDateOnly ? `${trimmed}T00:00:00.000Z` : trimmed)

    // `new Date` rolls impossible dates over (Feb 31 -> Mar 3), so confirm a
    // date-only input survives the round-trip unchanged.
    const invalid =
        Number.isNaN(date.getTime()) || (isDateOnly && date.toISOString().slice(0, 10) !== trimmed)
    if (invalid) {
        throw new Error(
            `Invalid date for ${flag}: "${value}". Use YYYY-MM-DD or an ISO 8601 date-time.`,
        )
    }
    return date.toISOString()
}
