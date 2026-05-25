import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const eventsDeleteCommand = defineCommand({
    meta: { name: 'delete', description: 'Delete an event from a variant.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        eventKey: { type: 'positional', description: 'Event key.' },
        yes: { type: 'boolean', default: false, description: 'Skip the confirmation prompt.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            if (!args.yes) {
                const ok = await confirm({
                    message: `Permanently delete event ${args.eventKey}? This cannot be undone.`,
                    default: false,
                })
                if (!ok) {
                    process.stderr.write('Aborted.\n')
                    process.exit(1)
                }
            }

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.DELETE(
                '/v1/trips/{id}/variants/{variantId}/events/{eventKey}',
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

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Deleted event ${args.eventKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
