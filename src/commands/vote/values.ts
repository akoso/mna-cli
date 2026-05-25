// The server's vote POST endpoints accept the literal strings "up" | "down" |
// "clear", so the CLI passes the user-provided --value through unchanged after
// normalising case. (The GET /votes read-side normalises to numeric 1 / -1.)
export const VOTE_VALUES = ['up', 'down', 'clear'] as const
export type VoteValue = (typeof VOTE_VALUES)[number]

export function parseVoteValue(input: string): VoteValue {
    const normalised = input.trim().toLowerCase()
    if (!(VOTE_VALUES as readonly string[]).includes(normalised)) {
        throw new Error(
            `Invalid --value "${input}". Must be one of: ${VOTE_VALUES.join(', ')}.`,
        )
    }
    return normalised as VoteValue
}
