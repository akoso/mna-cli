import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { parseVoteValue } from './values'

export const voteEventCommand = defineCommand({
    meta: {
        name: 'event',
        description: 'Cast / update / clear a vote on an event.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        eventKey: { type: 'positional', description: 'Event key inside the variant.' },
        value: {
            type: 'string',
            required: true,
            description: 'Vote direction: up | down | clear.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const value = parseVoteValue(args.value)

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST(
                '/v1/trips/{id}/variants/{variantId}/votes/events',
                {
                    params: { path: { id: args.tripId, variantId: args.variantId } },
                    body: { eventKey: args.eventKey, value },
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else if (value === 'clear') {
                process.stdout.write(
                    `${colors.green('✓')} Cleared vote on event ${args.eventKey}.\n`,
                )
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Voted ${colors.bold(value)} on event ${args.eventKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
