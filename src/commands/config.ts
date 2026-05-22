import { defineCommand } from 'citty'
import { loadCredentials, resolveBaseUrl, saveCredentials } from '../auth/credentials-store'
import { reportAndExit } from '../util/errors'
import { renderJson } from '../render/json'

const KNOWN_KEYS = ['apiBaseUrl'] as const
type ConfigKey = (typeof KNOWN_KEYS)[number]

function isKnownKey(key: string): key is ConfigKey {
    return (KNOWN_KEYS as readonly string[]).includes(key)
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

            const creds = await loadCredentials()
            const value = args.key === 'apiBaseUrl' ? resolveBaseUrl(creds) : undefined

            if (args.json) {
                renderJson({ [args.key]: value })
            } else {
                process.stdout.write(`${value ?? ''}\n`)
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

            const creds = await loadCredentials()
            if (!creds) {
                throw new Error('No credentials file found. Run `mna login --paste-token <key>` first.')
            }

            if (args.key === 'apiBaseUrl') {
                creds.apiBaseUrl = args.value
            }

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
