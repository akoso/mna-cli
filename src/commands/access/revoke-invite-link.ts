import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'

export const accessRevokeInviteLinkCommand = defineCommand({
    meta: { name: 'revoke-invite-link', description: 'Revoke a shareable invite-link token.' },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        tokenId: { type: 'positional', description: 'Token ID to revoke.' },
        yes: { type: 'boolean', default: false, description: 'Skip the confirmation prompt.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            if (!args.yes) {
                const ok = await confirm({
                    message: `Revoke invite token ${args.tokenId}? Existing recipients will not be able to claim it.`,
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

            const { data, error } = await client.DELETE(
                '/v1/trips/{id}/access/invite-tokens/{tokenId}',
                { params: { path: { id: args.tripId, tokenId: args.tokenId } } },
            )
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else if (data?.revoked) {
                process.stdout.write(`${colors.green('✓')} Revoked invite token ${args.tokenId}.\n`)
            } else {
                process.stdout.write(`${colors.dim('•')} No matching invite token to revoke.\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
