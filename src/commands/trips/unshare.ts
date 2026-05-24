import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const tripsUnshareCommand = defineCommand({
    meta: { name: 'unshare', description: 'Revoke all share links for a trip.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.DELETE('/v1/trips/{id}/share-link', {
                params: { path: { id: args.tripId } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(`${colors.green('✓')} Revoked ${data!.removedCount} share link(s).\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
