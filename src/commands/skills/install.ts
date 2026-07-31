import { defineCommand } from 'citty'
import { confirm } from '@inquirer/prompts'
import { loadCredentials, resolveApiKey } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { colors } from '../../render/colors'
import { CLIENTS, findClient, type ClientDefinition, type Scope } from '../../skills/clients'
import { hostEnv } from '../../skills/host-env'
import { MCP_SERVER_NAME, MCP_SERVER_URL, SKILL_NAME } from '../../skills/payload'
import {
    applyPlan,
    mcpState,
    planForClients,
    skillState,
    type AppliedClient,
    type ClientPlan,
} from '../../skills/plan'
import { pendingCount, renderPlans, tildify } from '../../skills/render-plan'
import { clientJsonView } from '../../skills/json-view'
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
            ...clientJsonView(plan),
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
            description: 'Install the skill for the current user (default) or into this project (project).',
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
        const asJson = args.json
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
                if (asJson) {
                    renderJson({ ok: true, scope, dryRun, clients: [], applied: [], message })
                    return
                }
                process.stdout.write(`${colors.yellow('!')} ${message}\n`)
                return
            }

            const plans = await planForClients(clients, { env, scope, includeMcp: args.mcp, apiKey })
            const pending = pendingCount(plans)

            if (asJson && !args.yes && !dryRun) {
                throw new Error('Refusing to write in --json mode without --yes (or use --dry-run).')
            }

            if (pending === 0) {
                if (asJson) {
                    renderJson({ ok: true, ...jsonView(plans, scope, dryRun), applied: [], failures: [] })
                    return
                }
                process.stdout.write(
                    `${colors.green('✓')} Already up to date for ${plans.map((p) => p.label).join(', ')}.\n`,
                )
                for (const plan of plans) {
                    if (plan.mcpBlocked) {
                        process.stdout.write(
                            `${colors.yellow('!')} ${plan.label}: ${tildify(plan.mcpBlocked, env.home)}\n`,
                        )
                    }
                }
                return
            }

            if (!asJson) {
                const detectedLabels = plans
                    .filter((p) => p.installed)
                    .map((p) => p.label)
                    .join(', ')
                process.stdout.write(`Detected AI clients: ${colors.bold(detectedLabels || 'none')}\n\n`)
                process.stdout.write(`${dryRun ? 'Would write' : 'mna will write'}:\n\n`)
                process.stdout.write(renderPlans(plans, { home: env.home, verbose: dryRun }))

                if (
                    plans.some((p) => !p.skillPathVerified && p.skillPath) ||
                    plans.some((p) => !p.mcpPathVerified && p.mcpPath)
                ) {
                    process.stdout.write(
                        colors.dim(
                            '  (?) marks a path that follows convention but is not documented by that\n' +
                                '      vendor for your OS — the client may not actually read it.\n\n',
                        ),
                    )
                }
                if (args.mcp && plans.some((p) => p.mcpPath)) {
                    process.stdout.write(
                        colors.dim(
                            apiKey
                                ? '  Your API key is written into that config in plain text (mna sets the file to 0600).\n\n'
                                : '  Not logged in — the MCP entry will use OAuth. Run `mna login` first to embed an API key instead.\n\n',
                        ),
                    )
                }
                if (scope === 'project') {
                    process.stdout.write(
                        colors.dim(
                            '  --scope project relocates the skill only; MCP servers stay in the user-level config.\n\n',
                        ),
                    )
                }
            }

            if (dryRun) {
                if (asJson) {
                    renderJson({ ok: true, ...jsonView(plans, scope, dryRun), applied: [], failures: [] })
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

            // Each client is applied independently: one unwritable path must not
            // abandon the rest, and the summary below reports what *actually*
            // happened rather than what was planned.
            const applied: AppliedClient[] = []
            for (const plan of plans) {
                applied.push(await applyPlan(plan, false))
            }

            const wrote = applied.flatMap((c) => c.applied.filter((a) => a.result !== 'unchanged'))
            const failures = applied.flatMap((c) => c.errors.map((e) => ({ client: c.label, ...e })))
            const blocked = plans.filter((p) => p.mcpBlocked)

            // Report per artefact, not per client. A client whose skill files
            // all failed but whose MCP entry landed has NOT had "the skill
            // installed", and saying so would be a false success claim.
            const didWrite = (c: AppliedClient, label: string) =>
                c.applied.some((a) => a.label === label && a.result !== 'unchanged')
            const skillClients = applied.filter((c) => didWrite(c, 'skill'))
            const mcpOnlyClients = applied.filter((c) => didWrite(c, 'mcp') && !didWrite(c, 'skill'))

            if (asJson) {
                renderJson({
                    // `ok` tracks the exit code: hard write failures only. A
                    // blocked MCP config is a warning — the skill still landed.
                    ok: failures.length === 0,
                    ...jsonView(plans, scope, dryRun),
                    applied,
                    failures,
                    warnings: blocked.map((p) => ({ client: p.label, message: p.mcpBlocked })),
                })
                if (failures.length > 0) process.exit(2)
                return
            }

            for (const client of applied) {
                for (const change of client.applied) {
                    if (change.result === 'unchanged') continue
                    process.stdout.write(
                        `${colors.green('✓')} ${change.result} ${tildify(change.path, env.home)}\n`,
                    )
                    if (change.backup) {
                        process.stdout.write(colors.dim(`  backup: ${tildify(change.backup, env.home)}\n`))
                    }
                }
            }

            for (const failure of failures) {
                process.stderr.write(
                    `${colors.red('✖')} ${failure.client}: could not write ${tildify(failure.path, env.home)} — ${failure.message}\n`,
                )
                if (failure.backup) {
                    process.stderr.write(
                        colors.dim(`  your original is at ${tildify(failure.backup, env.home)}\n`),
                    )
                }
            }
            for (const plan of blocked) {
                process.stderr.write(
                    `${colors.yellow('!')} ${plan.label}: ${tildify(plan.mcpBlocked!, env.home)}\n`,
                )
            }

            if (wrote.length === 0) {
                process.stderr.write(`\n${colors.red('✖')} Nothing was installed.\n`)
                process.exit(2)
            }

            process.stdout.write('\n')
            if (skillClients.length > 0) {
                process.stdout.write(
                    `${colors.green('✓')} Installed the ${SKILL_NAME} skill for ${skillClients.map((c) => c.label).join(', ')}.\n`,
                )
            }
            if (mcpOnlyClients.length > 0) {
                process.stdout.write(
                    `${colors.green('✓')} Registered the MNA MCP server for ${mcpOnlyClients.map((c) => c.label).join(', ')}.\n`,
                )
            }
            process.stdout.write(colors.dim('  Restart the client (or reload skills) and ask it to plan a trip.\n'))

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
