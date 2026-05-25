import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { parseVoteValue } from './values'

const KINDS = ['accommodation', 'transport', 'getting-around'] as const
type Kind = (typeof KINDS)[number]

function assertKind(value: string): asserts value is Kind {
    if (!(KINDS as readonly string[]).includes(value)) {
        throw new Error(`Invalid kind "${value}". Must be one of: ${KINDS.join(', ')}.`)
    }
}

export const voteOptionCommand = defineCommand({
    meta: {
        name: 'option',
        description: "Cast / update / clear a vote on a destination option.",
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        destinationKey: { type: 'positional', description: 'Destination key.' },
        kind: {
            type: 'positional',
            description: 'Option kind: accommodation | transport | getting-around. (Accepted for parity with `mna options` — the vote endpoint resolves the option by key alone.)',
        },
        optionKey: { type: 'positional', description: 'Option key inside the destination.' },
        value: {
            type: 'string',
            required: true,
            description: 'Vote direction: up | down | clear.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            // Validate kind for caller hygiene even though the wire body doesn't carry it.
            assertKind(args.kind)
            const value = parseVoteValue(args.value)

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST(
                '/v1/trips/{id}/variants/{variantId}/votes/options',
                {
                    params: { path: { id: args.tripId, variantId: args.variantId } },
                    body: {
                        destinationKey: args.destinationKey,
                        optionKey: args.optionKey,
                        value,
                    },
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else if (value === 'clear') {
                process.stdout.write(
                    `${colors.green('✓')} Cleared vote on option ${args.optionKey}.\n`,
                )
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Voted ${colors.bold(value)} on option ${args.optionKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
