import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { parseAccessLevel } from './roles'

export const accessInviteCommand = defineCommand({
    meta: {
        name: 'invite',
        description: 'Invite a user to a trip by email. The invite email is sent automatically.',
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        email: { type: 'string', required: true, description: 'Email address to invite.' },
        role: {
            type: 'string',
            required: true,
            description: 'Access level to grant: VIEW | VOTER | EDIT | OWNER (case-insensitive).',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const accessLevel = parseAccessLevel(args.role)

            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)
            const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })

            const { data, error } = await client.POST('/v1/trips/{id}/access/invite', {
                params: { path: { id: args.tripId } },
                body: { email: args.email, accessLevel },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Invited ${colors.bold(args.email)} as ${accessLevel.toUpperCase()}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
