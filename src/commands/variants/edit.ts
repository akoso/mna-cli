import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const variantsEditCommand = defineCommand({
    meta: { name: 'edit', description: 'Update fields on an existing variant.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        name: { type: 'string', description: 'New variant name.' },
        notes: { type: 'string', description: 'New variant notes.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const updates: Record<string, unknown> = {}
            if (args.name !== undefined) updates.name = args.name
            if (args.notes !== undefined) updates.notes = args.notes
            if (Object.keys(updates).length === 0) {
                throw new Error('Specify at least one of --name, --notes.')
            }

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.PATCH('/v1/trips/{id}/variants/{variantId}', {
                params: { path: { id: args.tripId, variantId: args.variantId } },
                body: updates as never,
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(`${colors.green('✓')} Updated variant ${args.variantId}.\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
