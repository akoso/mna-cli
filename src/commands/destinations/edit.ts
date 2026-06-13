import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { normalizeToIsoDateTime } from '../../util/dates'

export const destinationsEditCommand = defineCommand({
    meta: { name: 'edit', description: 'Update fields on a destination.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        destinationKey: { type: 'positional', description: 'Destination key.' },
        place: { type: 'string', description: 'New place name.' },
        notes: { type: 'string', description: 'New free-form notes.' },
        'start-date': { type: 'string', description: 'Arrival date (YYYY-MM-DD or ISO date-time).' },
        'end-date': { type: 'string', description: 'Departure date (YYYY-MM-DD or ISO date-time).' },
        'return-to-home': {
            type: 'boolean',
            description: 'Toggle return-to-home semantics. Supports --no-return-to-home.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const updates: Record<string, unknown> = {}
            if (args.place !== undefined) updates.destination = args.place
            if (args.notes !== undefined) updates.notes = args.notes
            if (args['return-to-home'] !== undefined) {
                updates.isReturnToHome = args['return-to-home']
            }
            if (args['start-date'] !== undefined) {
                updates.startDate = normalizeToIsoDateTime(args['start-date'], '--start-date')
            }
            if (args['end-date'] !== undefined) {
                updates.endDate = normalizeToIsoDateTime(args['end-date'], '--end-date')
            }
            if (Object.keys(updates).length === 0) {
                throw new Error(
                    'Specify at least one of --place, --notes, --start-date, --end-date, --return-to-home.',
                )
            }

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.PATCH(
                '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}',
                {
                    params: {
                        path: {
                            id: args.tripId,
                            variantId: args.variantId,
                            destinationKey: args.destinationKey,
                        },
                    },
                    body: updates as never,
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Updated destination ${args.destinationKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
