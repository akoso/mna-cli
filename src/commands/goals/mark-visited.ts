import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const goalsMarkVisitedCommand = defineCommand({
    meta: {
        name: 'mark-visited',
        description: 'Mark a goal as visited (sets status to "visited" and stamps the date).',
    },
    args: {
        goalId: { type: 'positional', description: 'Goal ID.' },
        date: {
            type: 'string',
            description: 'ISO 8601 date for when the goal was visited. Defaults to now.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const body: Record<string, unknown> = {}
            if (args.date) {
                const parsed = new Date(args.date)
                if (Number.isNaN(parsed.getTime())) {
                    throw new Error(`Invalid --date: ${args.date}. Use an ISO 8601 date (e.g. 2025-06-01).`)
                }
                body.visitedDate = parsed.toISOString()
            }

            const { data, error } = await client.POST('/v1/goals/{goalId}/mark-visited', {
                params: { path: { goalId: args.goalId } },
                body: body as never,
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Marked goal ${args.goalId} as visited${data?.visitedDate ? ` on ${data.visitedDate}` : ''}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
