import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { colors } from '../../render/colors'
import { reportAndExit } from '../../util/errors'

export const collectionsOpenSharedCommand = defineCommand({
    meta: {
        name: 'open-shared',
        description: 'Open a publicly shared collection by token (no login required).',
    },
    args: {
        token: { type: 'positional', description: 'Share token from a collection share URL.' },
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            // No API key required, but the client still attaches one if available.
            const client = createApiClient({
                baseUrl: resolveBaseUrl(creds),
                apiKey: creds?.apiKey ?? '',
            })

            const { data, error } = await client.GET('/v1/collections/shared/{token}', {
                params: { path: { token: args.token } },
            })
            if (error) {
                throw new Error(`Unexpected error fetching shared collection: ${JSON.stringify(error)}`)
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
            stdout.write('\n')

            renderTable({
                columns: [
                    { header: 'Goal ID', key: 'id', maxWidth: 26 },
                    { header: 'Name', key: 'name', maxWidth: 40 },
                    { header: 'Status', key: 'status' },
                    { header: 'Priority', key: 'priority' },
                ],
                rows: data.goals ?? [],
                emptyMessage: 'No goals in this collection.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
