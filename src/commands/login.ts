import { defineCommand } from 'citty'
import { pasteTokenLogin } from '../auth/paste-token-login'
import { resolveBaseUrl } from '../auth/credentials-store'
import { reportAndExit } from '../util/errors'
import { colors } from '../render/colors'

export const loginCommand = defineCommand({
    meta: {
        name: 'login',
        description: 'Authenticate the CLI against My Next Adventure.',
    },
    args: {
        'paste-token': {
            type: 'string',
            description: 'API key generated from https://mynextadventure.cloud/settings/api-keys.',
        },
    },
    async run({ args }) {
        try {
            const pastedKey = args['paste-token']
            if (!pastedKey) {
                throw new Error(
                    'Browser-mediated login is not yet available (Phase 1).\n' +
                        '  Generate an API key at https://mynextadventure.cloud/settings/api-keys\n' +
                        '  Then run: mna login --paste-token <key>',
                )
            }

            const baseUrl = resolveBaseUrl(null)
            const creds = await pasteTokenLogin({ apiKey: pastedKey, apiBaseUrl: baseUrl })

            process.stdout.write(`${colors.green('✓')} Logged in.\n`)
            process.stdout.write(colors.dim("  Credentials saved to ~/.config/mna/credentials\n"))
            process.stdout.write(colors.dim(`  Base URL: ${creds.apiBaseUrl}\n`))
        } catch (err) {
            reportAndExit(err)
        }
    },
})
