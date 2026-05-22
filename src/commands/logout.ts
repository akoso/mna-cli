import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { ApiError, createApiClient } from '../api/client'
import {
    deleteCredentials,
    loadCredentials,
    resolveApiKey,
    resolveBaseUrl,
} from '../auth/credentials-store'
import { colors } from '../render/colors'
import { reportAndExit } from '../util/errors'

export const logoutCommand = defineCommand({
    meta: {
        name: 'logout',
        description:
            'Revoke the current API key server-side and delete the local credentials.',
    },
    args: {
        'local-only': {
            type: 'boolean',
            description: 'Skip server-side revocation. Local file only.',
            default: false,
        },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            if (!creds) {
                process.stdout.write(colors.dim('Not logged in. Nothing to delete.\n'))
                return
            }

            if (!args['local-only']) {
                const apiKey = resolveApiKey(creds)
                if (apiKey) {
                    const client = createApiClient({ baseUrl: resolveBaseUrl(creds), apiKey })
                    try {
                        await client.DELETE('/v1/api-keys/me')
                        process.stdout.write(`${colors.green('✓')} Server-side key revoked.\n`)
                    } catch (err) {
                        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
                            // Key already invalid / revoked. Continue with local delete.
                            process.stdout.write(
                                colors.dim('  Key already inactive server-side.\n'),
                            )
                        } else {
                            // Server unreachable or unexpected error — ask before deleting local.
                            process.stderr.write(
                                `${colors.red('✖')} Failed to revoke server-side: ${(err as Error).message}\n`,
                            )
                            const proceed = await confirm({
                                message:
                                    'Delete local credentials anyway? The server-side key may still be active.',
                                default: false,
                            })
                            if (!proceed) {
                                process.stderr.write('Aborted. No changes made.\n')
                                process.exit(1)
                            }
                        }
                    }
                }
            }

            await deleteCredentials()
            process.stdout.write(`${colors.green('✓')} Logged out.\n`)
        } catch (err) {
            reportAndExit(err)
        }
    },
})
