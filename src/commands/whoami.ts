import { defineCommand } from 'citty'
import { loadCredentials, resolveBaseUrl } from '../auth/credentials-store'
import { renderJson } from '../render/json'
import { reportAndExit } from '../util/errors'

export const whoamiCommand = defineCommand({
    meta: {
        name: 'whoami',
        description: 'Show the currently logged-in user.',
    },
    args: {
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            if (!creds) {
                throw new Error('Not logged in. Run `mna login --paste-token <key>` first.')
            }

            const view = {
                user: creds.user,
                apiBaseUrl: resolveBaseUrl(creds),
                credentialsCreatedAt: creds.createdAt,
            }

            if (args.json) {
                renderJson(view)
            } else {
                process.stdout.write(`Logged in as ${view.user.name} <${view.user.email}>\n`)
                process.stdout.write(`Base URL: ${view.apiBaseUrl}\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
