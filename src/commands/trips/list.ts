import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const tripsListCommand = defineCommand({
    meta: {
        name: 'list',
        description: "List the current user's trips.",
    },
    args: {
        status: {
            type: 'string',
            description: 'Filter by status (planning|ready|finished|cancelled).',
        },
        'include-example': {
            type: 'boolean',
            description: 'Include the example/demo trip.',
            default: false,
        },
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)

            const client = createApiClient({
                baseUrl: resolveBaseUrl(creds),
                apiKey,
            })

            const query: Record<string, unknown> = {}
            if (args.status) query.status = args.status
            if (args['include-example']) query.includeExample = true

            const { data, error } = await client.GET('/v1/trips', { params: { query: query as never } })
            if (error) {
                throw new Error(`Unexpected error fetching trips: ${JSON.stringify(error)}`)
            }

            if (args.json) {
                renderJson(data)
                return
            }

            renderTable({
                columns: [
                    { header: 'ID', key: 'id', maxWidth: 26 },
                    { header: 'Name', key: 'name', maxWidth: 40 },
                    { header: 'Status', key: 'status' },
                ],
                rows: data?.trips ?? [],
                emptyMessage: 'No trips yet.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
