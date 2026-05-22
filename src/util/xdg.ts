import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Resolves the configuration directory for the CLI.
 * Honors $XDG_CONFIG_HOME; falls back to ~/.config.
 */
export function configHome(): string {
    return process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config')
}

export function mnaConfigDir(): string {
    return join(configHome(), 'mna')
}

export function credentialsPath(): string {
    return join(mnaConfigDir(), 'credentials')
}
