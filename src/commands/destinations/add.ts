import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const destinationsAddCommand = defineCommand({
    meta: { name: 'add', description: 'Add a new destination to a variant.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        place: { type: 'string', required: true, description: 'Place name (e.g. "Lisbon, Portugal").' },
        notes: { type: 'string', description: 'Free-form destination notes.' },
        'return-to-home': {
            type: 'boolean',
            default: false,
            description: 'Mark this destination as the return-to-home leg.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const body: Record<string, unknown> = {
                destination: args.place,
                isReturnToHome: args['return-to-home'] ?? false,
            }
            if (args.notes !== undefined) body.notes = args.notes

            const { data, error } = await client.POST(
                '/v1/trips/{id}/variants/{variantId}/destinations',
                {
                    params: { path: { id: args.tripId, variantId: args.variantId } },
                    body: body as never,
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            const created = data as unknown as { destinationKey?: string } | undefined

            if (args.json) {
                renderJson(created)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Added destination ${colors.bold(args.place)} (${created?.destinationKey ?? ''})\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
