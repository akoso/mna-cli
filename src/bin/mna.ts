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
import { accessListCommand } from '../commands/access/list'
import { accessInviteCommand } from '../commands/access/invite'
import { accessSetRoleCommand } from '../commands/access/set-role'
import { accessRevokeCommand } from '../commands/access/revoke'
import { accessCreateInviteLinkCommand } from '../commands/access/create-invite-link'
import { accessListInviteLinksCommand } from '../commands/access/list-invite-links'
import { accessRevokeInviteLinkCommand } from '../commands/access/revoke-invite-link'
import { voteOptionCommand } from '../commands/vote/option'
import { voteEventCommand } from '../commands/vote/event'
import { votesListCommand } from '../commands/votes/list'
import { goalsListCommand } from '../commands/goals/list'
import { goalsShowCommand } from '../commands/goals/show'
import { goalsAddCommand } from '../commands/goals/add'
import { goalsQuickAddCommand } from '../commands/goals/quick-add'
import { goalsEditCommand } from '../commands/goals/edit'
import { goalsDeleteCommand } from '../commands/goals/delete'
import { goalsLinkTripCommand } from '../commands/goals/link-trip'
import { goalsUnlinkTripCommand } from '../commands/goals/unlink-trip'
import { goalsMarkVisitedCommand } from '../commands/goals/mark-visited'
import { goalsMarkDreamingCommand } from '../commands/goals/mark-dreaming'
import { collectionsListCommand } from '../commands/collections/list'
import { collectionsShowCommand } from '../commands/collections/show'
import { collectionsCreateCommand } from '../commands/collections/create'
import { collectionsEditCommand } from '../commands/collections/edit'
import { collectionsDeleteCommand } from '../commands/collections/delete'
import { collectionsAddGoalCommand } from '../commands/collections/add-goal'
import { collectionsRemoveGoalCommand } from '../commands/collections/remove-goal'
import { collectionsShareCommand } from '../commands/collections/share'
import { collectionsOpenSharedCommand } from '../commands/collections/open-shared'

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

const access = defineCommand({
    meta: { name: 'access', description: 'Manage trip access and invite links.' },
    subCommands: {
        list: accessListCommand,
        invite: accessInviteCommand,
        'set-role': accessSetRoleCommand,
        revoke: accessRevokeCommand,
        'create-invite-link': accessCreateInviteLinkCommand,
        'list-invite-links': accessListInviteLinksCommand,
        'revoke-invite-link': accessRevokeInviteLinkCommand,
    },
})

const vote = defineCommand({
    meta: { name: 'vote', description: 'Cast votes on options and events.' },
    subCommands: {
        option: voteOptionCommand,
        event: voteEventCommand,
    },
})

const votes = defineCommand({
    meta: { name: 'votes', description: 'List votes cast on a variant.' },
    subCommands: {
        list: votesListCommand,
    },
})

const goals = defineCommand({
    meta: { name: 'goals', description: 'Manage travel goals.' },
    subCommands: {
        list: goalsListCommand,
        show: goalsShowCommand,
        add: goalsAddCommand,
        'quick-add': goalsQuickAddCommand,
        edit: goalsEditCommand,
        delete: goalsDeleteCommand,
        'link-trip': goalsLinkTripCommand,
        'unlink-trip': goalsUnlinkTripCommand,
        'mark-visited': goalsMarkVisitedCommand,
        'mark-dreaming': goalsMarkDreamingCommand,
    },
})

const collections = defineCommand({
    meta: { name: 'collections', description: 'Manage goal collections.' },
    subCommands: {
        list: collectionsListCommand,
        show: collectionsShowCommand,
        create: collectionsCreateCommand,
        edit: collectionsEditCommand,
        delete: collectionsDeleteCommand,
        'add-goal': collectionsAddGoalCommand,
        'remove-goal': collectionsRemoveGoalCommand,
        share: collectionsShareCommand,
        'open-shared': collectionsOpenSharedCommand,
    },
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
        access,
        vote,
        votes,
        goals,
        collections,
        config: configCommand,
    },
})

runMain(main)
