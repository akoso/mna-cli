import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const accessListInviteLinksCommand = defineCommand({
    meta: {
        name: 'list-invite-links',
        description: 'List unexpired invite-link tokens for a trip.',
    },
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

            const { data, error } = await client.GET('/v1/trips/{id}/access/invite-tokens', {
                params: { path: { id: args.tripId } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
                return
            }

            renderTable({
                columns: [
                    { header: 'Token ID', key: 'id', maxWidth: 26 },
                    { header: 'Access', key: 'accessLevel' },
                    { header: 'Expires', key: 'expiresAt', maxWidth: 20 },
                    { header: 'URL', key: 'inviteUrl', maxWidth: 60 },
                ],
                rows:
                    data?.tokens?.map((t) => ({
                        id: t.id ?? '—',
                        accessLevel: t.accessLevel,
                        expiresAt: t.expiresAt?.slice(0, 19).replace('T', ' '),
                        inviteUrl: t.inviteUrl,
                    })) ?? [],
                emptyMessage: 'No active invite links.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
