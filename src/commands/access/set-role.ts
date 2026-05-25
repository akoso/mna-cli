import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { reportAndExit, requireApiKey } from '../../util/errors'
import { parseAccessLevel } from './roles'

export const accessSetRoleCommand = defineCommand({
    meta: {
        name: 'set-role',
        description: "Change a user's access level on a trip.",
    },
    args: {
        tripId: { type: 'positional', description: 'Trip ID.' },
        user: {
            type: 'string',
            required: true,
            description: 'Target user ID (Kinde id).',
        },
        role: {
            type: 'string',
            required: true,
            description: 'New access level: VIEW | VOTER | EDIT | OWNER (case-insensitive).',
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

            const { data, error } = await client.PATCH('/v1/trips/{id}/access/{userId}', {
                params: { path: { id: args.tripId, userId: args.user } },
                body: { accessLevel },
            })
            if (error) throw new Error(`Unexpected error: ${JSON.stringify(error)}`)

            if (args.json) {
                renderJson(data)
            } else {
                process.stdout.write(
                    `${colors.green('✓')} Set ${colors.bold(args.user)} to ${accessLevel.toUpperCase()}.\n`,
                )
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
