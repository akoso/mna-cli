import { defineCommand } from 'citty'
import { deleteCredentials, loadCredentials } from '../auth/credentials-store'
import { colors } from '../render/colors'
import { reportAndExit } from '../util/errors'

export const logoutCommand = defineCommand({
    meta: {
        name: 'logout',
        description: 'Delete the local credentials file.',
    },
    async run() {
        try {
            const creds = await loadCredentials()
            if (!creds) {
                process.stdout.write(colors.dim('Not logged in. Nothing to delete.\n'))
                return
            }

            // Phase 1 will also revoke the key server-side via DELETE /v1/api-keys/me.
            // For now, local deletion only.
            await deleteCredentials()
            process.stdout.write(`${colors.green('✓')} Logged out (local credentials removed).\n`)
            process.stdout.write(
                colors.dim('  Note: the API key remains valid server-side until you revoke it in settings.\n'),
            )
        } catch (err) {
            reportAndExit(err)
        }
    },
})
