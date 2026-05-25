import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const eventsToggleCommand = defineCommand({
    meta: { name: 'toggle', description: "Toggle an event's selected state on the variant." },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        eventKey: { type: 'positional', description: 'Event key.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST(
                '/v1/trips/{id}/variants/{variantId}/events/{eventKey}/toggle',
                {
                    params: {
                        path: {
                            id: args.tripId,
                            variantId: args.variantId,
                            eventKey: args.eventKey,
                        },
                    },
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            const result = data as unknown as { selected?: boolean } | undefined

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                const state =
                    result?.selected === true
                        ? 'selected'
                        : result?.selected === false
                          ? 'deselected'
                          : 'toggled'
                process.stdout.write(
                    `${colors.green('✓')} Event ${args.eventKey} ${state}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
