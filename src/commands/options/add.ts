import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

const KINDS = ['accommodation', 'transport', 'getting-around'] as const
type Kind = (typeof KINDS)[number]

function assertKind(value: string): asserts value is Kind {
    if (!(KINDS as readonly string[]).includes(value)) {
        throw new Error(`Invalid kind "${value}". Must be one of: ${KINDS.join(', ')}.`)
    }
}

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

export const optionsAddCommand = defineCommand({
    meta: {
        name: 'add',
        description:
            'Add an option (accommodation | transport | getting-around) to a destination from a JSON file.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        variantId: { type: 'positional', description: 'Variant ID.' },
        destinationKey: { type: 'positional', description: 'Destination key.' },
        kind: {
            type: 'positional',
            description: 'Option kind: accommodation | transport | getting-around.',
        },
        'from-json': {
            type: 'string',
            required: true,
            description: 'Path to JSON file describing the option body.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            assertKind(args.kind)
            const body = await readJsonBody(args['from-json'])

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const path = {
                id: args.tripId,
                variantId: args.variantId,
                destinationKey: args.destinationKey,
            }

            let error: unknown
            let data: unknown
            if (args.kind === 'accommodation') {
                const res = await client.POST(
                    '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/accommodation',
                    { params: { path }, body: body as never },
                )
                error = res.error
                data = res.data
            } else if (args.kind === 'transport') {
                const res = await client.POST(
                    '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/transport',
                    { params: { path }, body: body as never },
                )
                error = res.error
                data = res.data
            } else {
                const res = await client.POST(
                    '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/getting-around',
                    { params: { path }, body: body as never },
                )
                error = res.error
                data = res.data
            }
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data ?? { ok: true })
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Added ${colors.bold(args.kind)} option on destination ${args.destinationKey}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
