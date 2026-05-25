import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const goalsUnlinkTripCommand = defineCommand({
    meta: {
        name: 'unlink-trip',
        description: 'Unlink a goal from its trip (reverts status to "dreaming").',
    },
    args: {
        goalId: { type: 'positional', description: 'Goal ID.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/goals/{goalId}/unlink-trip', {
                params: { path: { goalId: args.goalId } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(`${colors.green('✓')} Unlinked goal ${args.goalId} from its trip.\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
