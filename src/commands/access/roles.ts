// Server access-level enum (lowercase). The CLI accepts upper- or lowercase
// for friendliness and normalises to the server's wire form before sending.
export const ACCESS_LEVELS = ['owner', 'edit', 'voter', 'view'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

// Invite links can hand out any non-owner access (handing out owner via a
// public link would be a foot-gun).
export const INVITE_LINK_LEVELS: readonly AccessLevel[] = ['edit', 'voter', 'view']

export function parseAccessLevel(input: string, allowed: readonly AccessLevel[] = ACCESS_LEVELS): AccessLevel {
    const normalised = input.trim().toLowerCase()
    if (!(allowed as readonly string[]).includes(normalised)) {
        throw new Error(
            `Invalid role "${input}". Must be one of: ${allowed.map((a) => a.toUpperCase()).join(', ')}.`,
        )
    }
    return normalised as AccessLevel
}
