import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const goalsShowCommand = defineCommand({
    meta: {
        name: 'show',
        description: 'Show full details of one goal.',
    },
    args: {
        goalId: { type: 'positional', description: 'Goal ID.' },
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

            const { data, error } = await client.GET('/v1/goals/{goalId}', {
                params: { path: { goalId: args.goalId } },
            })
            if (error) {
                throw new Error(`Unexpected error fetching goal: ${JSON.stringify(error)}`)
            }
            if (!data) {
                throw new Error('No goal returned.')
            }

            if (args.json) {
                renderJson(data)
                return
            }

            const stdout = process.stdout
            stdout.write(`${colors.bold(data.name)}  ${colors.dim(`(${data.id})`)}\n`)
            stdout.write(`Type: ${data.type}\n`)
            stdout.write(`Status: ${data.status}\n`)
            stdout.write(`Priority: ${data.priority}\n`)
            if (data.description) stdout.write(`Description: ${data.description}\n`)
            if (data.country) stdout.write(`Country: ${data.country}\n`)
            if (data.region) stdout.write(`Region: ${data.region}\n`)
            if (data.location?.name) stdout.write(`Location: ${data.location.name}\n`)
            if (data.tags?.length) stdout.write(`Tags: ${data.tags.join(', ')}\n`)
            if (data.bestTimeToVisit?.length) {
                stdout.write(`Best time: ${data.bestTimeToVisit.join(', ')}\n`)
            }
            if (data.estimatedBudget != null) {
                stdout.write(
                    `Estimated budget: ${data.estimatedBudget}${data.currency ? ` ${data.currency}` : ''}\n`,
                )
            }
            if (data.estimatedDuration) stdout.write(`Estimated duration: ${data.estimatedDuration}\n`)
            if (data.linkedTripId) {
                stdout.write(
                    `Linked trip: ${data.linkedTripName ?? '(unnamed)'} ${colors.dim(`(${data.linkedTripId})`)}\n`,
                )
            }
            if (data.visitedDate) stdout.write(`Visited: ${data.visitedDate}\n`)
            if (data.collectionIds?.length) {
                stdout.write(`Collections: ${data.collectionIds.join(', ')}\n`)
            }
            if (data.notes) stdout.write(`\n${colors.dim('Notes:')}\n${data.notes}\n`)
        } catch (err) {
            reportAndExit(err)
        }
    },
})
