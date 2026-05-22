import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const keysListCommand = defineCommand({
    meta: { name: 'list', description: "List the current user's active API keys." },
    args: {
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)

            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })
            const { data, error } = await client.GET('/v1/api-keys')
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
                return
            }

            renderTable({
                columns: [
                    { header: 'Name', key: 'name', maxWidth: 40 },
                    { header: 'Created', key: 'createdAt', maxWidth: 20 },
                    { header: 'Last used', key: 'lastUsed', maxWidth: 20 },
                    { header: 'Current', key: 'isCurrent' },
                ],
                rows:
                    data?.keys?.map((k) => ({
                        name: k.name,
                        createdAt: k.createdAt?.slice(0, 19).replace('T', ' '),
                        lastUsed: k.lastUsed?.slice(0, 19).replace('T', ' ') ?? '—',
                        isCurrent: k.isCurrent ? '✓' : '',
                    })) ?? [],
                emptyMessage: 'No active keys.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
