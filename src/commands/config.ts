import { defineCommand } from 'citty'
import { loadCredentials, resolveBaseUrl, saveCredentials } from '../auth/credentials-store'
import { reportAndExit } from '../util/errors'
import { loadSettings, setSetting } from '../util/settings'
import { renderJson } from '../render/json'

const KNOWN_KEYS = ['apiBaseUrl', 'skills.prompt'] as const
type ConfigKey = (typeof KNOWN_KEYS)[number]

function isKnownKey(key: string): key is ConfigKey {
    return (KNOWN_KEYS as readonly string[]).includes(key)
}

function parseBoolean(value: string): boolean {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
    throw new Error(`Expected a boolean (true|false) for skills.prompt, got: ${value}`)
}

export const configGet = defineCommand({
    meta: { name: 'get', description: 'Print a configuration value.' },
    args: {
        key: { type: 'positional', description: 'Configuration key (e.g. apiBaseUrl).' },
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            if (!isKnownKey(args.key)) {
                throw new Error(`Unknown config key: ${args.key}. Known: ${KNOWN_KEYS.join(', ')}.`)
            }

            const value: string | boolean =
                args.key === 'apiBaseUrl'
                    ? resolveBaseUrl(await loadCredentials())
                    : ((await loadSettings())['skills.prompt'] ?? true)

            if (args.json) {
                renderJson({ [args.key]: value })
            } else {
                process.stdout.write(`${value}\n`)
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})

export const configSet = defineCommand({
    meta: { name: 'set', description: 'Set a configuration value.' },
    args: {
        key: { type: 'positional', description: 'Configuration key.' },
        value: { type: 'positional', description: 'New value.' },
    },
    async run({ args }) {
        try {
            if (!isKnownKey(args.key)) {
                throw new Error(`Unknown config key: ${args.key}. Known: ${KNOWN_KEYS.join(', ')}.`)
            }

            if (args.key === 'skills.prompt') {
                await setSetting('skills.prompt', parseBoolean(args.value))
                process.stdout.write('Updated skills.prompt.\n')
                return
            }

            const creds = await loadCredentials()
            if (!creds) {
                throw new Error('No credentials file found. Run `mna login --paste-token <key>` first.')
            }

            creds.apiBaseUrl = args.value
            await saveCredentials(creds)
            process.stdout.write(`Updated ${args.key}.\n`)
        } catch (err) {
            reportAndExit(err)
        }
    },
})

export const configCommand = defineCommand({
    meta: { name: 'config', description: 'Manage local CLI configuration.' },
    subCommands: { get: configGet, set: configSet },
})
