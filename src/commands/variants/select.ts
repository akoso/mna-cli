import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const variantsSelectCommand = defineCommand({
    meta: { name: 'select', description: 'Set the selected variant for a trip.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID to select.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.PUT(
                '/v1/trips/{id}/variants/{variantId}/select',
                {
                    params: { path: { id: args.tripId, variantId: args.variantId } },
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Selected variant ${args.variantId}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
