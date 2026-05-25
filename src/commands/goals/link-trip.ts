import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const goalsLinkTripCommand = defineCommand({
    meta: {
        name: 'link-trip',
        description: 'Link a goal to a trip (sets status to "planning").',
    },
    args: {
        goalId: { type: 'positional', description: 'Goal ID.' },
        tripId: { type: 'positional', description: 'Trip ID.' },
        'trip-name': {
            type: 'string',
            description: 'Override the trip name echoed back on the goal (defaults to the trip\'s current name).',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            // The link-trip endpoint requires both tripId and tripName, so resolve the
            // trip name from the trip itself unless the caller overrode it.
            let tripName = args['trip-name']
            if (!tripName) {
                const { data: trip, error: tripErr } = await client.GET('/v1/trips/{id}', {
                    params: { path: { id: args.tripId }, query: { includeAllOptions: false } as never },
                })
                if (tripErr) {
                    throw new Error(`Unexpected error fetching trip: ${JSON.stringify(tripErr)}`)
                }
                tripName = trip?.name ?? args.tripId
            }

            const { data, error } = await client.POST('/v1/goals/{goalId}/link-trip', {
                params: { path: { goalId: args.goalId } },
                body: { tripId: args.tripId, tripName },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Linked goal ${args.goalId} to trip ${colors.bold(tripName)} (${args.tripId}).\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
