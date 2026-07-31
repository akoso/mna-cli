import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { rm } from 'node:fs/promises'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { CLIENTS, findClient, type ClientDefinition } from '../../skills/clients'
import { hostEnv } from '../../skills/host-env'
import { SKILL_NAME } from '../../skills/payload'
import { planForClients } from '../../skills/plan'
import { tildify } from '../../skills/render-plan'
import { reportAndExit } from '../../util/errors'
import { isInteractive } from '../../util/tty'

export const skillsUninstallCommand = defineCommand({
    meta: {
        name: 'uninstall',
        description: `Remove the ${SKILL_NAME} skill directory from your AI coding clients.`,
    },
    args: {
        client: { type: 'string', description: 'Uninstall from one client only (comma-separated).' },
        scope: { type: 'string', default: 'user', description: 'Which copy to remove (user|project).' },
        yes: { type: 'boolean', default: false, description: 'Skip the confirmation prompt.' },
        'dry-run': { type: 'boolean', default: false, description: 'Show what would be removed.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        const asJson = args.json
        try {
            const scope = args.scope
            if (scope !== 'user' && scope !== 'project') {
                throw new Error(`Invalid --scope: ${scope}. Choose "user" or "project".`)
            }

            const env = hostEnv()
            let clients: ClientDefinition[] = CLIENTS
            if (args.client) {
                clients = args.client
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean)
                    .map((name) => {
                        const client = findClient(name)
                        if (!client) throw new Error(`Unknown client: ${name}.`)
                        return client
                    })
            }

            const plans = await planForClients(clients, { env, scope, includeMcp: false })
            // Only offer to remove skills that are actually on disk.
            const targets = plans.filter((p) => p.skillPath && p.changes.some((c) => c.status !== 'create'))

            if (targets.length === 0) {
                const message = `No installed ${SKILL_NAME} skill found.`
                if (asJson) {
                    renderJson({ ok: true, removed: [], message })
                    return
                }
                process.stdout.write(colors.dim(`${message}\n`))
                return
            }

            if (!asJson) {
                process.stdout.write(`${args['dry-run'] ? 'Would remove' : 'Will remove'}:\n\n`)
                for (const plan of targets) {
                    process.stdout.write(`  ${colors.bold(plan.label)}\n`)
                    process.stdout.write(`    ${colors.red('remove')}  ${tildify(plan.skillPath!, env.home)}\n`)
                }
                process.stdout.write('\n')
                process.stdout.write(
                    colors.dim('  MCP server entries are left alone — remove those from the client config by hand.\n\n'),
                )
            }

            if (args['dry-run']) {
                if (asJson) {
                    renderJson({ ok: true, dryRun: true, removed: targets.map((p) => p.skillPath) })
                } else {
                    process.stdout.write(colors.dim('Dry run — nothing was removed.\n'))
                }
                return
            }

            if (!args.yes) {
                if (!isInteractive()) {
                    throw new Error('Not an interactive terminal. Re-run with --yes.')
                }
                const ok = await confirm({
                    message: `Remove the ${SKILL_NAME} skill from ${targets.map((p) => p.label).join(', ')}?`,
                    default: false,
                })
                if (!ok) {
                    process.stdout.write(colors.dim('Aborted.\n'))
                    process.exit(1)
                }
            }

            const removed: string[] = []
            const failures: { path: string; message: string }[] = []
            for (const plan of targets) {
                try {
                    await rm(plan.skillPath!, { recursive: true, force: true })
                    removed.push(plan.skillPath!)
                } catch (err) {
                    failures.push({
                        path: plan.skillPath!,
                        message: err instanceof Error ? err.message : String(err),
                    })
                }
            }

            if (asJson) {
                renderJson({ ok: failures.length === 0, removed, failures })
                if (failures.length > 0) process.exit(2)
                return
            }

            for (const path of removed) {
                process.stdout.write(`${colors.green('✓')} removed ${tildify(path, env.home)}\n`)
            }
            for (const failure of failures) {
                process.stderr.write(
                    `${colors.red('✖')} could not remove ${tildify(failure.path, env.home)} — ${failure.message}\n`,
                )
            }
            if (failures.length > 0) process.exit(2)
        } catch (err) {
            if (asJson) {
                renderJson({ ok: false, error: err instanceof Error ? err.message : String(err) })
                process.exit(1)
            }
            reportAndExit(err)
        }
    },
})
