#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { configCommand } from '../commands/config'
import { loginCommand } from '../commands/login'
import { logoutCommand } from '../commands/logout'
import { whoamiCommand } from '../commands/whoami'
import { tripsListCommand } from '../commands/trips/list'
import { tripsShowCommand } from '../commands/trips/show'
import { tripsCreateCommand } from '../commands/trips/create'
import { tripsEditCommand } from '../commands/trips/edit'
import { tripsDeleteCommand } from '../commands/trips/delete'
import { tripsShareCommand } from '../commands/trips/share'
import { tripsUnshareCommand } from '../commands/trips/unshare'
import { keysListCommand } from '../commands/keys/list'
import { keysRevokeCommand } from '../commands/keys/revoke'

const trips = defineCommand({
    meta: { name: 'trips', description: 'View and manage trips.' },
    subCommands: {
        list: tripsListCommand,
        show: tripsShowCommand,
        create: tripsCreateCommand,
        edit: tripsEditCommand,
        delete: tripsDeleteCommand,
        share: tripsShareCommand,
        unshare: tripsUnshareCommand,
    },
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
