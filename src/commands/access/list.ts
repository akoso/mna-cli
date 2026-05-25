import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const accessListCommand = defineCommand({
    meta: {
        name: 'list',
        description: 'List users with access to a trip (includes the owner).',
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

            const { data, error } = await client.GET('/v1/trips/{id}/access', {
                params: { path: { id: args.tripId } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
                return
            }

            renderTable({
                columns: [
                    { header: 'User ID', key: 'userId', maxWidth: 26 },
                    { header: 'Name', key: 'name', maxWidth: 30 },
                    { header: 'Email', key: 'email', maxWidth: 40 },
                    { header: 'Access', key: 'accessLevel' },
                ],
                rows:
                    data?.users?.map((u) => ({
                        userId: u.user.userId ?? '—',
                        name: u.user.name || '(pending)',
                        email: u.user.email ?? '—',
                        accessLevel: u.accessLevel,
                    })) ?? [],
                emptyMessage: 'No users with access.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
