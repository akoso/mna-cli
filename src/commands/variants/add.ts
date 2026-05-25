import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const variantsAddCommand = defineCommand({
    meta: { name: 'add', description: 'Add a new variant to a trip.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        name: { type: 'string', required: true, description: 'Variant name.' },
        notes: { type: 'string', description: 'Free-form variant notes.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const body: Record<string, unknown> = { name: args.name }
            if (args.notes !== undefined) body.notes = args.notes

            const { data, error } = await client.POST('/v1/trips/{id}/variants', {
                params: { path: { id: args.tripId } },
                body: body as never,
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            const created = data as unknown as { id?: string; name?: string } | undefined

            if (args.json) {
                renderJson(created)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Added variant ${colors.bold(created?.name ?? args.name)} (${created?.id ?? ''})\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
