import { normalizeToIsoDateTime } from '../../util/dates'

/**
 * Merge the ergonomic `--free-cancellation-until` flag into an option body.
 * Only accommodation options carry this field, so any other kind is rejected.
 */
export function applyFreeCancellation(
    body: Record<string, unknown>,
    value: string | undefined,
    kind: string,
): void {
    if (value === undefined) return
    if (kind !== 'accommodation') {
        throw new Error('--free-cancellation-until is only valid for the "accommodation" kind.')
    }
    body.freeCancellationUntil = normalizeToIsoDateTime(value, '--free-cancellation-until')
}
