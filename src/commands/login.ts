import { defineCommand } from 'citty'
import { browserLogin } from '../auth/browser-login'
import { pasteTokenLogin } from '../auth/paste-token-login'
import { resolveBaseUrl, type Credentials } from '../auth/credentials-store'
import { reportAndExit } from '../util/errors'
import { colors } from '../render/colors'
import { renderJson } from '../render/json'
import { maybeOfferSkillInstall } from '../skills/post-login-prompt'

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
        json: { type: 'boolean', default: false, description: 'Output as JSON (also suppresses prompts).' },
    },
    async run({ args }) {
        try {
            const apiBaseUrl = resolveBaseUrl(null)
            const webAppBaseUrl = args['web-base-url'] ?? process.env.MNA_WEB_BASE_URL ?? DEFAULT_WEB_BASE

            let credentials: Credentials

            if (args['paste-token']) {
                credentials = await pasteTokenLogin({ apiKey: args['paste-token'], apiBaseUrl })
            } else {
                if (!args.json) {
                    process.stdout.write(
                        'Opening browser for consent... If it does not open, copy the URL below.\n\n',
                    )
                }
                const result = await browserLogin({ apiBaseUrl, webAppBaseUrl })
                credentials = result.credentials
                if (!args.json) process.stdout.write(colors.dim(`  ${result.consentUrl}\n\n`))
            }

            if (args.json) {
                renderJson({
                    loggedIn: true,
                    user: credentials.user,
                    apiBaseUrl: credentials.apiBaseUrl,
                })
                return
            }

            process.stdout.write(`${colors.green('✓')} Logged in.\n`)
            process.stdout.write(colors.dim('  Credentials saved to ~/.config/mna/credentials\n'))
            process.stdout.write(colors.dim(`  Base URL: ${credentials.apiBaseUrl}\n`))

            // Courtesy offer — no-ops in CI, pipes, or when switched off.
            await maybeOfferSkillInstall({ json: args.json })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
