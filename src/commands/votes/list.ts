import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const votesListCommand = defineCommand({
    meta: {
        name: 'list',
        description: 'List all votes cast on a variant (options + events).',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.GET(
                '/v1/trips/{id}/variants/{variantId}/votes',
                { params: { path: { id: args.tripId, variantId: args.variantId } } },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
                return
            }

            renderTable({
                columns: [
                    { header: 'User', key: 'user', maxWidth: 28 },
                    { header: 'Destination', key: 'destinationKey', maxWidth: 24 },
                    { header: 'Target key', key: 'optionKey', maxWidth: 28 },
                    { header: 'Vote', key: 'vote' },
                ],
                rows:
                    data?.votes?.map((v) => ({
                        user: v.user.name || v.user.userId || v.user.email || '—',
                        destinationKey: v.destinationKey ?? '—',
                        optionKey: v.optionKey ?? '—',
                        vote: v.vote === 1 ? 'up' : 'down',
                    })) ?? [],
                emptyMessage: 'No votes cast yet.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
