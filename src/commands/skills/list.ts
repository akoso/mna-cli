import { defineCommand } from 'citty'
import { loadCredentials, resolveApiKey } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { colors } from '../../render/colors'
import { CLIENTS } from '../../skills/clients'
import { hostEnv } from '../../skills/host-env'
import { mcpState, planForClients, skillState } from '../../skills/plan'
import { clientJsonView } from '../../skills/json-view'
import { tildify } from '../../skills/render-plan'
import { reportAndExit } from '../../util/errors'

export const skillsListCommand = defineCommand({
    meta: {
        name: 'list',
        description: 'Show which AI clients are installed and whether the mna skill is set up.',
    },
    args: {
        all: {
            type: 'boolean',
            default: false,
            description: 'Include clients that are not installed on this machine.',
        },
        scope: {
            type: 'string',
            default: 'user',
            description: 'Skill scope to report on (user|project).',
        },
        json: { type: 'boolean', default: false, description: 'Output as JSON.' },
    },
    async run({ args }) {
        try {
            if (args.scope !== 'user' && args.scope !== 'project') {
                throw new Error(`Invalid --scope: ${args.scope}. Choose "user" or "project".`)
            }

            const env = hostEnv()
            const apiKey = resolveApiKey(await loadCredentials())
            const plans = await planForClients(CLIENTS, {
                env,
                scope: args.scope,
                includeMcp: true,
                apiKey,
            })
            const visible = args.all ? plans : plans.filter((p) => p.installed)

            if (args.json) {
                renderJson({
                    scope: args.scope,
                    authenticated: Boolean(apiKey),
                    clients: plans.map(clientJsonView),
                })
                return
            }

            renderTable({
                columns: [
                    { header: 'CLIENT', key: 'client' },
                    { header: 'ID', key: 'id' },
                    { header: 'DETECTED', key: 'detected' },
                    { header: 'SKILL', key: 'skill' },
                    { header: 'MCP', key: 'mcp' },
                    { header: 'SKILL PATH', key: 'path', maxWidth: 52 },
                ],
                rows: visible.map((plan) => ({
                    client: plan.label,
                    id: plan.id,
                    detected: plan.installed ? 'yes' : 'no',
                    skill: plan.skillPathVerified ? skillState(plan) : `${skillState(plan)} (?)`,
                    mcp: plan.mcpPathVerified ? mcpState(plan) : `${mcpState(plan)} (?)`,
                    path: plan.skillPath ? tildify(plan.skillPath, env.home) : '—',
                })),
                emptyMessage: 'No supported AI clients detected. Use --all to see everything mna can install into.',
            })

            for (const plan of visible) {
                if (plan.mcpBlocked) {
                    process.stdout.write(
                        `${colors.yellow('!')} ${plan.label}: ${tildify(plan.mcpBlocked, env.home)}\n`,
                    )
                }
            }

            if (
                visible.some((p) => !p.skillPathVerified && p.skillPath) ||
                visible.some((p) => !p.mcpPathVerified && p.mcpPath)
            ) {
                process.stdout.write(
                    colors.dim(
                        '\n(?) path follows convention but is not documented by that vendor for your OS —\n    the client may not actually read it.\n',
                    ),
                )
            }

            if (visible.some((p) => skillState(p) !== 'up-to-date')) {
                process.stdout.write(colors.dim('\nRun `mna skills install` to set these up.\n'))
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
