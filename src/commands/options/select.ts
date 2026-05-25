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

export const optionsSelectCommand = defineCommand({
    meta: {
        name: 'select',
        description:
            'Set the selected option of the given kind on a destination. The kind is sent in the request body so the controller knows which option service to dispatch to.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        destinationKey: { type: 'positional', description: 'Destination key.' },
        kind: {
            type: 'positional',
            description: 'Option kind: accommodation | transport | getting-around.',
        },
        optionKey: {
            type: 'positional',
            description: 'Option key (used as the universal option ID in the URL).',
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
                '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/{optionId}/select',
                {
                    params: {
                        path: {
                            id: args.tripId,
                            variantId: args.variantId,
                            destinationKey: args.destinationKey,
                            optionId: args.optionKey,
                        },
                    },
                    body: { type: args.kind } as never,
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Selected ${args.kind} option ${args.optionKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
