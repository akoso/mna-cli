import { defineCommand } from 'citty'
import { loadCredentials, resolveApiKey } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { colors } from '../../render/colors'
import { CLIENTS } from '../../skills/clients'
import { hostEnv } from '../../skills/host-env'
import { mcpState, planForClients, skillState } from '../../skills/plan'
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
                    clients: plans.map((plan) => ({
                        id: plan.id,
                        label: plan.label,
                        installed: plan.installed,
                        detectedAt: plan.detectedAt,
                        skill: { path: plan.skillPath, state: skillState(plan) },
                        mcp: { path: plan.mcpPath, state: mcpState(plan) },
                        blocked: plan.blocked ?? null,
                    })),
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
                    skill: skillState(plan),
                    mcp: mcpState(plan),
                    path: plan.skillPath ? tildify(plan.skillPath, env.home) : '—',
                })),
                emptyMessage: 'No supported AI clients detected. Use --all to see everything mna can install into.',
            })

            for (const plan of visible) {
                if (plan.blocked) {
                    process.stdout.write(`${colors.yellow('!')} ${plan.label}: ${plan.blocked}\n`)
                }
            }

            if (visible.some((p) => skillState(p) !== 'up-to-date')) {
                process.stdout.write(colors.dim('\nRun `mna skills install` to set these up.\n'))
            }
        } catch (err) {
            reportAndExit(err)
        }
    },
})
