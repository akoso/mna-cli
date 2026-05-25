import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const collectionsDeleteCommand = defineCommand({
    meta: { name: 'delete', description: 'Permanently delete a collection.' },
    args: {
        collectionId: { type: 'positional', description: 'Collection ID.' },
        yes: { type: 'boolean', default: false, description: 'Skip the confirmation prompt.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            if (!args.yes) {
                const ok = await confirm({
                    message: `Permanently delete collection ${args.collectionId}? The goals inside will be kept (their reference is removed). This cannot be undone.`,
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

            const { data, error } = await client.DELETE('/v1/collections/{collectionId}', {
                params: { path: { collectionId: args.collectionId } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(`${colors.green('✓')} Deleted collection ${args.collectionId}.\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
