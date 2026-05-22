import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const tripsShowCommand = defineCommand({
    meta: {
        name: 'show',
        description: 'Show full details of one trip.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        'all-options': {
            type: 'boolean',
            description: 'Include unselected option types in the output.',
            default: false,
        },
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

            const query: Record<string, unknown> = {}
            if (args['all-options']) query.includeAllOptions = true

            const { data, error } = await client.GET('/v1/trips/{id}', {
                params: { path: { id: args.tripId }, query: query as never },
            })
            if (error) {
                throw new Error(`Unexpected error fetching trip: ${JSON.stringify(error)}`)
            }
            if (!data) {
                throw new Error('No trip returned.')
            }

            if (args.json) {
                renderJson(data)
                return
            }

            const stdout = process.stdout
            stdout.write(`${colors.bold(data.name)}  ${colors.dim(`(${data.id})`)}\n`)
            stdout.write(`Status: ${data.status}\n`)
            if (data.selectedVariant) {
                stdout.write(`Selected variant: ${data.selectedVariant}\n`)
            }
            stdout.write(`Variants: ${data.variants?.length ?? 0}\n\n`)

            renderTable({
                columns: [
                    { header: 'Variant', key: 'name', maxWidth: 30 },
                    { header: 'Destinations', key: 'destinationsCount' },
                    { header: 'Events', key: 'eventsCount' },
                ],
                rows:
                    data.variants?.map((v) => ({
                        name: v.name,
                        destinationsCount: v.destinations?.length ?? 0,
                        eventsCount: v.eventsToAttend?.length ?? 0,
                    })) ?? [],
                emptyMessage: 'No variants yet.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
