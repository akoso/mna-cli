import { join } from 'node:path'
import {
    applyChange,
    planFileChange,
    planJsonChange,
    UnparseableConfigError,
    type AppliedChange,
    type PlannedChange,
} from './changes'
import {
    buildMcpEntry,
    detectionPath,
    isClientInstalled,
    skillDir,
    type ClientDefinition,
    type Scope,
} from './clients'
import type { HostEnv } from './host-env'
import { MCP_SERVER_NAME, SKILL_FILES } from './payload'

export interface PlanOptions {
    env: HostEnv
    scope: Scope
    /** Include the MNA MCP server entry for MCP-capable clients. */
    includeMcp: boolean
    /** Stored API key, embedded as an `X-API-Key` header when present. */
    apiKey?: string
}

export interface ClientPlan {
    id: string
    label: string
    installed: boolean
    /** The path whose presence we took as proof of installation. */
    detectedAt: string
    skillPath: string | null
    mcpPath: string | null
    changes: PlannedChange[]
    /** Set when we cannot safely touch this client (e.g. unparseable config). */
    blocked?: string
    note?: string
}

export function hasPendingChanges(plan: ClientPlan): boolean {
    return plan.changes.some((c) => c.status !== 'unchanged')
}

export type ItemState = 'up-to-date' | 'outdated' | 'missing' | 'n/a'

function stateOf(changes: PlannedChange[], supported: boolean): ItemState {
    if (!supported || changes.length === 0) return 'n/a'
    if (changes.every((c) => c.status === 'unchanged')) return 'up-to-date'
    if (changes.every((c) => c.status === 'create')) return 'missing'
    return 'outdated'
}

export function skillState(plan: ClientPlan): ItemState {
    return stateOf(
        plan.changes.filter((c) => c.label === 'skill'),
        plan.skillPath !== null,
    )
}

export function mcpState(plan: ClientPlan): ItemState {
    return stateOf(
        plan.changes.filter((c) => c.label === 'mcp'),
        plan.mcpPath !== null,
    )
}

/** True when the skill is installed and byte-identical to the shipped copy. */
export function skillUpToDate(plan: ClientPlan): boolean {
    return skillState(plan) === 'up-to-date'
}

export async function planForClient(client: ClientDefinition, options: PlanOptions): Promise<ClientPlan> {
    const { env, scope, includeMcp, apiKey } = options
    const installed = await isClientInstalled(client, env)
    const dir = skillDir(client, env, scope)
    const mcpPath = includeMcp ? (client.mcp?.configPath(env) ?? null) : null

    const plan: ClientPlan = {
        id: client.id,
        label: client.label,
        installed,
        detectedAt: detectionPath(client, env),
        skillPath: dir,
        mcpPath,
        changes: [],
        note: client.note,
    }

    if (dir) {
        for (const file of SKILL_FILES) {
            plan.changes.push(await planFileChange(join(dir, file.path), file.content, 'skill'))
        }
    }

    if (mcpPath && client.mcp) {
        try {
            plan.changes.push(
                await planJsonChange(
                    mcpPath,
                    [client.mcp.serversKey, MCP_SERVER_NAME],
                    buildMcpEntry(client.mcp.style, { apiKey }),
                    'mcp',
                ),
            )
        } catch (err) {
            if (err instanceof UnparseableConfigError) {
                plan.blocked = `${err.message} Fix or move it, then re-run — mna will not overwrite a config it cannot parse.`
                plan.mcpPath = null
            } else {
                throw err
            }
        }
    }

    return plan
}

export async function planForClients(
    clients: ClientDefinition[],
    options: PlanOptions,
): Promise<ClientPlan[]> {
    const plans: ClientPlan[] = []
    for (const client of clients) {
        plans.push(await planForClient(client, options))
    }
    return plans
}

export interface AppliedClient {
    id: string
    label: string
    applied: AppliedChange[]
}

/** Executes a plan. `dryRun` short-circuits before any filesystem write. */
export async function applyPlan(plan: ClientPlan, dryRun: boolean): Promise<AppliedClient> {
    const applied: AppliedChange[] = []
    if (dryRun || plan.blocked) {
        return { id: plan.id, label: plan.label, applied }
    }
    for (const change of plan.changes) {
        applied.push(await applyChange(change))
    }
    return { id: plan.id, label: plan.label, applied }
}
