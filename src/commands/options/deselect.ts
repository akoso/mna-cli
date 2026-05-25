import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

const KINDS = ['accommodation', 'transport', 'getting-around'] as const
type Kind = (typeof KINDS)[number]

function assertKind(value: string): asserts value is Kind {
    if (!(KINDS as readonly string[]).includes(value)) {
        throw new Error(`Invalid kind "${value}". Must be one of: ${KINDS.join(', ')}.`)
    }
}

export const optionsDeselectCommand = defineCommand({
    meta: {
        name: 'deselect',
        description: 'Clear the selected option of the given kind on a destination.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        destinationKey: { type: 'positional', description: 'Destination key.' },
        kind: {
            type: 'positional',
            description: 'Option kind: accommodation | transport | getting-around.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            assertKind(args.kind)

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.PUT(
                '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/{kind}/deselect',
                {
                    params: {
                        path: {
                            id: args.tripId,
                            variantId: args.variantId,
                            destinationKey: args.destinationKey,
                            kind: args.kind,
                        },
                    },
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Deselected ${args.kind} option on destination ${args.destinationKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
