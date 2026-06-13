import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { readJsonObject } from '../../util/json-file'
import { applyFreeCancellation } from './free-cancellation'

const KINDS = ['accommodation', 'transport', 'getting-around'] as const
type Kind = (typeof KINDS)[number]

function assertKind(value: string): asserts value is Kind {
    if (!(KINDS as readonly string[]).includes(value)) {
        throw new Error(`Invalid kind "${value}". Must be one of: ${KINDS.join(', ')}.`)
    }
}

export const optionsEditCommand = defineCommand({
    meta: {
        name: 'edit',
        description:
            'Update fields on a destination option (accommodation | transport | getting-around) from a JSON file.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        destinationKey: { type: 'positional', description: 'Destination key.' },
        kind: {
            type: 'positional',
            description: 'Option kind: accommodation | transport | getting-around.',
        },
        optionKey: { type: 'positional', description: 'Option key.' },
        'from-json': {
            type: 'string',
            description: 'Path to JSON file describing the partial update.',
        },
        'free-cancellation-until': {
            type: 'string',
            description:
                'Accommodation only: free-cancellation deadline (YYYY-MM-DD or ISO date-time). Lets you skip --from-json.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            assertKind(args.kind)
            if (args['from-json'] === undefined && args['free-cancellation-until'] === undefined) {
                throw new Error('Specify --from-json and/or --free-cancellation-until.')
            }
            const body =
                args['from-json'] !== undefined ? await readJsonObject(args['from-json']) : {}
            applyFreeCancellation(body, args['free-cancellation-until'], args.kind)

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.PATCH(
                '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/{kind}/{optionKey}',
                {
                    params: {
                        path: {
                            id: args.tripId,
                            variantId: args.variantId,
                            destinationKey: args.destinationKey,
                            kind: args.kind,
                            optionKey: args.optionKey,
                        },
                    },
                    body: body as never,
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Updated ${args.kind} option ${args.optionKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
