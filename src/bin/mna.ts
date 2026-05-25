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
import { variantsAddCommand } from '../commands/variants/add'
import { variantsDuplicateCommand } from '../commands/variants/duplicate'
import { variantsEditCommand } from '../commands/variants/edit'
import { variantsSelectCommand } from '../commands/variants/select'
import { variantsDeleteCommand } from '../commands/variants/delete'
import { destinationsAddCommand } from '../commands/destinations/add'
import { destinationsEditCommand } from '../commands/destinations/edit'
import { destinationsReorderCommand } from '../commands/destinations/reorder'
import { destinationsDeleteCommand } from '../commands/destinations/delete'
import { optionsAddCommand } from '../commands/options/add'
import { optionsEditCommand } from '../commands/options/edit'
import { optionsDeleteCommand } from '../commands/options/delete'
import { optionsSelectCommand } from '../commands/options/select'
import { optionsDeselectCommand } from '../commands/options/deselect'
import { eventsAddCommand } from '../commands/events/add'
import { eventsEditCommand } from '../commands/events/edit'
import { eventsToggleCommand } from '../commands/events/toggle'
import { eventsDeleteCommand } from '../commands/events/delete'
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

const variants = defineCommand({
    meta: { name: 'variants', description: 'Manage trip variants.' },
    subCommands: {
        add: variantsAddCommand,
        duplicate: variantsDuplicateCommand,
        edit: variantsEditCommand,
        select: variantsSelectCommand,
        delete: variantsDeleteCommand,
    },
})

const destinations = defineCommand({
    meta: { name: 'destinations', description: 'Manage destinations within a variant.' },
    subCommands: {
        add: destinationsAddCommand,
        edit: destinationsEditCommand,
        reorder: destinationsReorderCommand,
        delete: destinationsDeleteCommand,
    },
})

const options = defineCommand({
    meta: {
        name: 'options',
        description: 'Manage destination options (accommodation | transport | getting-around).',
    },
    subCommands: {
        add: optionsAddCommand,
        edit: optionsEditCommand,
        delete: optionsDeleteCommand,
        select: optionsSelectCommand,
        deselect: optionsDeselectCommand,
    },
})

const events = defineCommand({
    meta: { name: 'events', description: 'Manage events on a variant.' },
    subCommands: {
        add: eventsAddCommand,
        edit: eventsEditCommand,
        toggle: eventsToggleCommand,
        delete: eventsDeleteCommand,
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
        variants,
        destinations,
        options,
        events,
        keys,
        config: configCommand,
    },
})

runMain(main)
