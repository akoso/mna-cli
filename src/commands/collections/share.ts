import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

const DEFAULT_WEB_BASE = 'https://mynextadventure.cloud'

function resolveWebBase(): string {
    return process.env.MNA_WEB_BASE_URL?.trim() || DEFAULT_WEB_BASE
}

export const collectionsShareCommand = defineCommand({
    meta: {
        name: 'share',
        description: 'Generate (or return) a share token for a collection and print the share URL.',
    },
    args: {
        collectionId: { type: 'positional', description: 'Collection ID.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/collections/{collectionId}/share', {
                params: { path: { collectionId: args.collectionId } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)
            if (!data) throw new Error('No share token returned.')

            const url = `${resolveWebBase()}/shared/collection/${data.shareToken}`

            if (args.json) {
                renderJson({ shareToken: data.shareToken, url })
            } else {
                process.stdout.write(`${colors.green('✓')} ${url}\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
