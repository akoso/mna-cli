import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

async function readJsonBody(path: string): Promise<Record<string, unknown>> {
    const file = Bun.file(path)
    if (!(await file.exists())) {
        throw new Error(`JSON file not found: ${path}`)
    }
    const parsed = (await file.json()) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Expected JSON object in ${path}, got ${Array.isArray(parsed) ? 'array' : typeof parsed}.`)
    }
    return parsed as Record<string, unknown>
}

export const eventsAddCommand = defineCommand({
    meta: { name: 'add', description: 'Add an event option to a variant from a JSON file.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        'from-json': {
            type: 'string',
            required: true,
            description: 'Path to JSON file describing the event body.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const body = await readJsonBody(args['from-json'])

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST(
                '/v1/trips/{id}/variants/{variantId}/options/event',
                {
                    params: { path: { id: args.tripId, variantId: args.variantId } },
                    body: body as never,
                },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Added event on variant ${args.variantId}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
