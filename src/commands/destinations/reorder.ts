import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const destinationsReorderCommand = defineCommand({
    meta: { name: 'reorder', description: 'Reorder destinations within a variant.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        order: {
            type: 'string',
            required: true,
            description: 'Comma-separated destination keys in the desired new order.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const keys = args.order
                .split(',')
                .map((k) => k.trim())
            if (keys.length === 0 || keys.some((k) => k.length === 0)) {
                throw new Error(
                    '--order must be a comma-separated list of non-empty destination keys.',
                )
            }

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST(
                '/v1/trips/{id}/variants/{variantId}/destinations/reorder',
                {
                    params: { path: { id: args.tripId, variantId: args.variantId } },
                    body: { order: keys } as never,
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Reordered ${keys.length} destination(s).\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
