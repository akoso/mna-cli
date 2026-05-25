import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const collectionsAddGoalCommand = defineCommand({
    meta: { name: 'add-goal', description: 'Add a goal to a collection.' },
    args: {
        collectionId: { type: 'positional', description: 'Collection ID.' },
        goalId: { type: 'positional', description: 'Goal ID to add.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/collections/{collectionId}/goals', {
                params: { path: { collectionId: args.collectionId } },
                body: { add: [args.goalId], remove: [] },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Added goal ${args.goalId} to collection ${args.collectionId}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
