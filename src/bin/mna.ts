#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { configCommand } from '../commands/config'
import { loginCommand } from '../commands/login'
import { logoutCommand } from '../commands/logout'
import { whoamiCommand } from '../commands/whoami'
import { tripsListCommand } from '../commands/trips/list'
import { tripsShowCommand } from '../commands/trips/show'
import { keysListCommand } from '../commands/keys/list'
import { keysRevokeCommand } from '../commands/keys/revoke'

const trips = defineCommand({
    meta: { name: 'trips', description: 'View and manage trips.' },
    subCommands: { list: tripsListCommand, show: tripsShowCommand },
})

const keys = defineCommand({
    meta: { name: 'keys', description: 'Manage API keys.' },
    subCommands: { list: keysListCommand, revoke: keysRevokeCommand },
})

const main = defineCommand({
    meta: {
        name: 'mna',
        version: '0.0.1',
        description: 'My Next Adventure CLI',
    },
    subCommands: {
        login: loginCommand,
        logout: logoutCommand,
        whoami: whoamiCommand,
        trips,
        keys,
        config: configCommand,
    },
})

runMain(main)
