import { defineCommand } from 'citty'
import { browserLogin } from '../auth/browser-login'
import { pasteTokenLogin } from '../auth/paste-token-login'
import { resolveBaseUrl } from '../auth/credentials-store'
import { reportAndExit } from '../util/errors'
import { colors } from '../render/colors'

const DEFAULT_WEB_BASE = 'https://app.mynextadventure.cloud'

export const loginCommand = defineCommand({
    meta: {
        name: 'login',
        description: 'Authenticate the CLI against My Next Adventure.',
    },
    args: {
        'paste-token': {
            type: 'string',
            description: 'Skip the browser flow — pass an API key generated in the user menu.',
        },
        'web-base-url': {
            type: 'string',
            description: 'Override the web app URL (rarely needed; defaults to app.mynextadventure.cloud).',
        },
    },
    async run({ args }) {
        try {
            const apiBaseUrl = resolveBaseUrl(null)
            const webAppBaseUrl = args['web-base-url'] ?? process.env.MNA_WEB_BASE_URL ?? DEFAULT_WEB_BASE

            if (args['paste-token']) {
                const creds = await pasteTokenLogin({ apiKey: args['paste-token'], apiBaseUrl })
                process.stdout.write(`${colors.green('✓')} Logged in.\n`)
                process.stdout.write(colors.dim('  Credentials saved to ~/.config/mna/credentials\n'))
                process.stdout.write(colors.dim(`  Base URL: ${creds.apiBaseUrl}\n`))
                return
            }

            process.stdout.write('Opening browser for consent... If it does not open, copy the URL below.\n\n')

            const { credentials, consentUrl } = await browserLogin({ apiBaseUrl, webAppBaseUrl })
            process.stdout.write(colors.dim(`  ${consentUrl}\n\n`))
            process.stdout.write(`${colors.green('✓')} Logged in.\n`)
            process.stdout.write(colors.dim('  Credentials saved to ~/.config/mna/credentials\n'))
            process.stdout.write(colors.dim(`  Base URL: ${credentials.apiBaseUrl}\n`))
        } catch (err) {
            reportAndExit(err)
        }
    },
})
