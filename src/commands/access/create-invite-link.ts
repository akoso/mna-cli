import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { INVITE_LINK_LEVELS, parseAccessLevel } from './roles'

export const accessCreateInviteLinkCommand = defineCommand({
    meta: {
        name: 'create-invite-link',
        description: 'Generate a new shareable invite-link token for a trip.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        role: {
            type: 'string',
            required: true,
            description: 'Access level the link will grant: VIEW | VOTER | EDIT (case-insensitive; OWNER is not allowed for shareable links).',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const accessLevel = parseAccessLevel(args.role, INVITE_LINK_LEVELS)

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/trips/{id}/access/invite-tokens', {
                params: { path: { id: args.tripId } },
                body: { accessLevel },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Created ${accessLevel.toUpperCase()} invite link (expires ${data!.expiresAt}):\n  ${data!.inviteUrl}\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
