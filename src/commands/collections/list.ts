import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const collectionsListCommand = defineCommand({
    meta: {
        name: 'list',
        description: "List the current user's goal collections.",
    },
    args: {
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

            const { data, error } = await client.GET('/v1/collections')
            if (error) {
                throw new Error(`Unexpected error fetching collections: ${JSON.stringify(error)}`)
            }

            if (args.json) {
                renderJson(data)
                return
            }

            renderTable({
                columns: [
                    { header: 'ID', key: 'id', maxWidth: 26 },
                    { header: 'Name', key: 'name', maxWidth: 40 },
                    { header: 'Visibility', key: 'visibility' },
                    { header: 'Goals', key: 'goalCount' },
                    { header: 'Visited', key: 'visitedCount' },
                ],
                rows: data?.collections ?? [],
                emptyMessage: 'No collections yet.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
