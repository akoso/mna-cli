import { colors } from '../render/colors'
import { ApiError } from '../api/client'

/**
 * Translates any thrown value into a user-facing error message + an exit code.
 * Use as the top-level catch in command handlers.
 */
export function reportAndExit(err: unknown): never {
    if (err instanceof ApiError) {
        process.stderr.write(`${colors.red('✖')} ${err.message}\n`)
        if (err.status === 401) {
            process.stderr.write(colors.dim('  Try `mna login --paste-token <key>` to authenticate.\n'))
        }
        if (err.status === 402) {
            process.stderr.write(
                colors.dim('  This action requires a Premium subscription: https://mynextadventure.com/pricing\n'),
            )
        }
        process.exit(2)
    }

    if (err instanceof Error) {
        process.stderr.write(`${colors.red('✖')} ${err.message}\n`)
        if (process.env.MNA_DEBUG === '1' && err.stack) {
            process.stderr.write(colors.dim(err.stack + '\n'))
        }
        process.exit(1)
    }

    process.stderr.write(`${colors.red('✖')} ${String(err)}\n`)
    process.exit(1)
}

/**
 * Asserts that an API key is available; throws a user-friendly error otherwise.
 */
export function requireApiKey(apiKey: string | undefined): asserts apiKey is string {
    if (!apiKey) {
        throw new Error(
            'Not logged in. Run `mna login --paste-token <key>` or set MNA_API_KEY in your environment.',
        )
    }
}
