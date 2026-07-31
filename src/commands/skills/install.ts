import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { loadCredentials, resolveApiKey } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { CLIENTS, findClient, type ClientDefinition, type Scope } from '../../skills/clients'
import { hostEnv } from '../../skills/host-env'
import { MCP_SERVER_NAME, MCP_SERVER_URL, SKILL_NAME } from '../../skills/payload'
import { applyPlan, mcpState, planForClients, skillState, type ClientPlan } from '../../skills/plan'
import { pendingCount, renderPlans, tildify } from '../../skills/render-plan'
import { reportAndExit } from '../../util/errors'
import { isInteractive } from '../../util/tty'

function selectClients(clientArg: string | undefined, all: boolean, detected: Set<string>): ClientDefinition[] {
    if (clientArg) {
        return clientArg
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => {
                const client = findClient(name)
                if (!client) {
                    throw new Error(
                        `Unknown client: ${name}. Known: ${CLIENTS.map((c) => c.id).join(', ')}.`,
                    )
                }
                return client
            })
    }
    if (all) return CLIENTS
    return CLIENTS.filter((c) => detected.has(c.id))
}

function jsonView(plans: ClientPlan[], scope: Scope, dryRun: boolean) {
    return {
        scope,
        dryRun,
        mcpServer: { name: MCP_SERVER_NAME, url: MCP_SERVER_URL },
        clients: plans.map((plan) => ({
            id: plan.id,
            label: plan.label,
            installed: plan.installed,
            skill: { path: plan.skillPath, state: skillState(plan) },
            mcp: { path: plan.mcpPath, state: mcpState(plan) },
            blocked: plan.blocked ?? null,
            changes: plan.changes.map((c) => ({
                kind: c.kind,
                path: c.path,
                status: c.status,
                label: c.label,
                ...(c.kind === 'json' ? { keyPath: c.keyPath } : {}),
            })),
        })),
    }
}

export const skillsInstallCommand = defineCommand({
    meta: {
        name: 'install',
        description: `Install the ${SKILL_NAME} skill (and MCP server) into your AI coding clients.`,
    },
    args: {
        client: {
            type: 'string',
            description: 'Install into one client only (comma-separated for several). See `mna skills list --all`.',
        },
        all: {
            type: 'boolean',
            default: false,
            description: 'Install into every supported client, detected or not.',
        },
        scope: {
            type: 'string',
            default: 'user',
            description: 'Install for the current user (default) or into this project (project).',
        },
        mcp: {
            type: 'boolean',
            default: true,
            description: 'Also register the MNA MCP server. Use --no-mcp for the skill only.',
        },
        yes: { type: 'boolean', default: false, description: 'Skip the confirmation prompt.' },
        'dry-run': { type: 'boolean', default: false, description: 'Show what would change; write nothing.' },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            const scope = args.scope
            if (scope !== 'user' && scope !== 'project') {
                throw new Error(`Invalid --scope: ${scope}. Choose "user" or "project".`)
            }

            const dryRun = args['dry-run']
            const env = hostEnv()
            const apiKey = resolveApiKey(await loadCredentials())

            const detectionPlans = await planForClients(CLIENTS, {
                env,
                scope,
                includeMcp: false,
                apiKey,
            })
            const detected = new Set(detectionPlans.filter((p) => p.installed).map((p) => p.id))
            const clients = selectClients(args.client, args.all, detected)

            if (clients.length === 0) {
                const message =
                    'No supported AI clients detected. Run `mna skills list --all` to see what mna can install into, or pass --client <name>.'
                if (args.json) {
                    renderJson({ scope, dryRun, clients: [], message })
                    return
                }
                process.stdout.write(`${colors.yellow('!')} ${message}\n`)
                return
            }

            const plans = await planForClients(clients, { env, scope, includeMcp: args.mcp, apiKey })
            const pending = pendingCount(plans)

            if (args.json && !args.yes && !dryRun) {
                throw new Error('Refusing to write in --json mode without --yes (or use --dry-run).')
            }

            if (pending === 0) {
                if (args.json) {
                    renderJson({ ...jsonView(plans, scope, dryRun), applied: [] })
                    return
                }
                process.stdout.write(
                    `${colors.green('✓')} Already up to date for ${plans.map((p) => p.label).join(', ')}.\n`,
                )
                return
            }

            if (!args.json) {
                process.stdout.write(
                    `Detected AI clients: ${colors.bold(plans.filter((p) => p.installed).map((p) => p.label).join(', ') || 'none')}\n\n`,
                )
                process.stdout.write(`${dryRun ? 'Would write' : 'mna will write'}:\n\n`)
                process.stdout.write(renderPlans(plans, { home: env.home, verbose: dryRun }))
                if (args.mcp && plans.some((p) => p.mcpPath)) {
                    process.stdout.write(
                        colors.dim(
                            apiKey
                                ? '  The MCP entry embeds your API key so the client can authenticate.\n\n'
                                : '  Not logged in — the MCP entry will use OAuth. Run `mna login` first to embed an API key instead.\n\n',
                        ),
                    )
                }
            }

            if (dryRun) {
                if (args.json) {
                    renderJson({ ...jsonView(plans, scope, dryRun), applied: [] })
                } else {
                    process.stdout.write(colors.dim('Dry run — nothing was written.\n'))
                }
                return
            }

            if (!args.yes) {
                if (!isInteractive()) {
                    throw new Error('Not an interactive terminal. Re-run with --yes to install non-interactively.')
                }
                const overwrites = plans.some((p) => p.changes.some((c) => c.status === 'overwrite'))
                const ok = await confirm({
                    message: overwrites
                        ? 'Some files above will be overwritten (a timestamped backup is kept). Continue?'
                        : `Install the ${SKILL_NAME} skill for ${plans.map((p) => p.label).join(', ')}?`,
                    default: !overwrites,
                })
                if (!ok) {
                    process.stdout.write(colors.dim('Aborted. Nothing was written.\n'))
                    process.exit(1)
                }
            }

            const applied = []
            for (const plan of plans) {
                applied.push(await applyPlan(plan, false))
            }

            if (args.json) {
                renderJson({ ...jsonView(plans, scope, dryRun), applied })
                return
            }

            for (const client of applied) {
                for (const change of client.applied) {
                    if (change.result === 'unchanged') continue
                    process.stdout.write(
                        `${colors.green('✓')} ${change.result} ${tildify(change.path, env.home)}\n`,
                    )
                    if (change.backup) {
                        process.stdout.write(
                            colors.dim(`  backup: ${tildify(change.backup, env.home)}\n`),
                        )
                    }
                }
            }
            process.stdout.write(
                `\n${colors.green('✓')} Installed the ${SKILL_NAME} skill for ${plans.map((p) => p.label).join(', ')}.\n`,
            )
            process.stdout.write(colors.dim('  Restart the client (or reload skills) and ask it to plan a trip.\n'))
        } catch (err) {
            reportAndExit(err)
        }
    },
})
