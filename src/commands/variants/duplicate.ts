import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const variantsDuplicateCommand = defineCommand({
    meta: { name: 'duplicate', description: 'Duplicate an existing variant.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID to duplicate.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST(
                '/v1/trips/{id}/variants/{variantId}/duplicate',
                {
                    params: { path: { id: args.tripId, variantId: args.variantId } },
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Duplicated variant as ${colors.bold(data?.name ?? '')} (${data?.id ?? ''})\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
