import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const keysRevokeCommand = defineCommand({
    meta: { name: 'revoke', description: 'Revoke an API key by name.' },
    args: {
        name: { type: 'positional', description: 'The key name to revoke.' },
        yes: { type: 'boolean', description: 'Skip the confirmation prompt.', default: false },
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)

            if (!args.yes) {
                const ok = await confirm({
                    message: `Revoke API key "${args.name}"? This cannot be undone.`,
                    default: false,
                })
                if (!ok) {
                    process.stderr.write('Aborted.\n')
                    process.exit(1)
                }
            }

            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })
            const { data, error } = await client.DELETE('/v1/api-keys/{name}', {
                params: { path: { name: args.name } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(`${colors.green('✓')} Revoked "${args.name}".\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
