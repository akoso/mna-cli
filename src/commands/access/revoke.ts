import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const accessRevokeCommand = defineCommand({
    meta: { name: 'revoke', description: "Remove a user's access from a trip." },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        user: {
            type: 'string',
            required: true,
            description: 'Target user ID (Kinde id).',
        },
        yes: { type: 'boolean', default: false, description: 'Skip the confirmation prompt.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            if (!args.yes) {
                const ok = await confirm({
                    message: `Revoke access for user ${args.user} on trip ${args.tripId}?`,
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

            const { data, error } = await client.DELETE('/v1/trips/{id}/access/{userId}', {
                params: { path: { id: args.tripId, userId: args.user } },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else if (data?.removed) {
                process.stdout.write(`${colors.green('✓')} Revoked access for ${args.user}.\n`)
            } else {
                process.stdout.write(`${colors.dim('•')} User ${args.user} had no access to revoke.\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
