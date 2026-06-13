import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { readJsonObject } from '../../util/json-file'

export const goalsAddCommand = defineCommand({
    meta: { name: 'add', description: 'Create a new travel goal from a JSON file.' },
    args: {
        'from-json': {
            type: 'string',
            required: true,
            description: 'Path to JSON file describing the goal body.',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const body = await readJsonObject(args['from-json'])

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/goals', { body: body as never })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Created goal ${colors.bold(data?.name ?? '')} (${data?.id ?? ''})\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
