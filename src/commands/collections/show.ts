import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const collectionsShowCommand = defineCommand({
    meta: {
        name: 'show',
        description: 'Show full details of one collection (with nested goals).',
    },
    args: {
        collectionId: { type: 'positional', description: 'Collection ID.' },
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

            const { data, error } = await client.GET('/v1/collections/{collectionId}', {
                params: { path: { collectionId: args.collectionId } },
            })
            if (error) {
                throw new Error(`Unexpected error fetching collection: ${JSON.stringify(error)}`)
            }
            if (!data) {
                throw new Error('No collection returned.')
            }

            if (args.json) {
                renderJson(data)
                return
            }

            const stdout = process.stdout
            const heading = data.emoji ? `${data.emoji} ${data.name}` : data.name
            stdout.write(`${colors.bold(heading)}  ${colors.dim(`(${data.id})`)}\n`)
            stdout.write(`Visibility: ${data.visibility}\n`)
            stdout.write(`Goals: ${data.goalCount} (${data.visitedCount} visited)\n`)
            if (data.description) stdout.write(`Description: ${data.description}\n`)
            if (data.shareToken) stdout.write(`Share token: ${data.shareToken}\n`)
            stdout.write('\n')

            renderTable({
                columns: [
                    { header: 'Goal ID', key: 'id', maxWidth: 26 },
                    { header: 'Name', key: 'name', maxWidth: 40 },
                    { header: 'Status', key: 'status' },
                    { header: 'Priority', key: 'priority' },
                ],
                rows: data.goals ?? [],
                emptyMessage: 'No goals in this collection yet.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
