import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

const VALID_VISIBILITIES = ['private', 'shared', 'public'] as const
type Visibility = (typeof VALID_VISIBILITIES)[number]
function isVisibility(s: string): s is Visibility {
    return (VALID_VISIBILITIES as readonly string[]).includes(s)
}

export const collectionsCreateCommand = defineCommand({
    meta: { name: 'create', description: 'Create a new goal collection.' },
    args: {
        name: { type: 'string', required: true, description: 'Collection name.' },
        description: { type: 'string', description: 'Optional description.' },
        emoji: { type: 'string', description: 'Optional emoji for visual identity.' },
        'cover-image': { type: 'string', description: 'Cover image URL.' },
        visibility: {
            type: 'string',
            description: `Visibility (${VALID_VISIBILITIES.join('|')}). Defaults to "private".`,
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const body: Record<string, unknown> = { name: args.name }
            if (args.description !== undefined) body.description = args.description
            if (args.emoji !== undefined) body.emoji = args.emoji
            if (args['cover-image'] !== undefined) body.coverImageUrl = args['cover-image']
            if (args.visibility !== undefined) {
                if (!isVisibility(args.visibility)) {
                    throw new Error(`Invalid visibility. Choose one of: ${VALID_VISIBILITIES.join(', ')}.`)
                }
                body.visibility = args.visibility
            }

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/collections', { body: body as never })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Created collection ${colors.bold(data?.name ?? args.name)} (${data?.id ?? ''})\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
