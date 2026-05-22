#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'

const main = defineCommand({
    meta: {
        name: 'mna',
        version: '0.0.1',
        description: 'My Next Adventure CLI',
    },
    subCommands: {},
    run() {
        // Show help when invoked with no subcommand.
        // citty handles --help / --version automatically.
    },
})

runMain(main)
