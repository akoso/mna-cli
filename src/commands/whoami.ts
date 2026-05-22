import { defineCommand } from 'citty'
import { createApiClient } from '../api/client'
import {
    loadCredentials,
    resolveApiKey,
    resolveBaseUrl,
    saveCredentials,
} from '../auth/credentials-store'
import { renderJson } from '../render/json'
import { reportAndExit } from '../util/errors'

export const whoamiCommand = defineCommand({
    meta: {
        name: 'whoami',
        description: 'Show the currently logged-in user.',
    },
    args: {
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
        verify: {
            type: 'boolean',
            description: 'Re-fetch user info from the server (also refreshes the local cache).',
            default: false,
        },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            if (!creds) {
                throw new Error('Not logged in. Run `mna login` first.')
            }

            let user = creds.user
            let verified = false

            if (args.verify) {
                const apiKey = resolveApiKey(creds)
                if (!apiKey) throw new Error('No API key in credentials file.')
                const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })
                const { data, error } = await client.GET('/v1/me')
                if (error) throw new Error(`Failed to verify: ${JSON.stringify(error)}`)
                if (!data) throw new Error('No identity returned by /v1/me.')

                user = {
                    id: data.userId,
                    email: data.email ?? 'unknown@local',
                    name: data.name ?? 'CLI user',
                }
                creds.user = user
                await saveCredentials(creds)
                verified = true
            }

            const view = {
                user,
                apiBaseUrl: resolveBaseUrl(creds),
                credentialsCreatedAt: creds.createdAt,
                verified,
            }

            if (args.json) {
                renderJson(view)
            } else {
                process.stdout.write(`Logged in as ${view.user.name} <${view.user.email}>\n`)
                process.stdout.write(`Base URL: ${view.apiBaseUrl}\n`)
                if (verified) process.stdout.write('  (verified via server)\n')
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
