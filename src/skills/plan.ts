import { join } from 'node:path'
import {
    applyChange,
    ApplyFailedError,
    ConfigConflictError,
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
    /**
     * Why the MCP entry was dropped for this client (unparseable or conflicting
     * config). Scoped to the MCP entry only — the skill files are unaffected
     * and still install.
     */
    mcpBlocked?: string
    note?: string
    /** False when the skill directory is a community convention, not vendor-documented. */
    skillPathVerified: boolean
    /** Vendor page documenting the skill directory. */
    skillPathDocs?: string
    /** False when the MCP config path is not vendor-documented on this platform. */
    mcpPathVerified: boolean
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
        skillPathVerified: client.skillPathVerified ?? true,
        skillPathDocs: client.skillPathDocs,
        mcpPathVerified: !client.mcpPathUnverifiedOn?.includes(env.platform),
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
                    Boolean(apiKey),
                ),
            )
        } catch (err) {
            if (err instanceof UnparseableConfigError || err instanceof ConfigConflictError) {
                // Drop *only* the MCP entry. The skill files are independent of
                // this config and must still install.
                plan.mcpBlocked = `${err.message} Fix or move it, then re-run \`mna skills install\` — the skill files are unaffected.`
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

export interface ApplyError {
    path: string
    message: string
    /** Backup taken before the failed write, if any — the user's escape hatch. */
    backup?: string
}

export interface AppliedClient {
    id: string
    label: string
    applied: AppliedChange[]
    errors: ApplyError[]
}

/**
 * Maps a thrown value onto a reportable failure. Pulled out so the
 * backup-path branch — which the install command renders as "your original is
 * at <path>", and which is effectively unreachable through the filesystem once
 * an atomic rename is in play — is directly testable.
 */
export function toApplyError(path: string, err: unknown): ApplyError {
    return {
        path,
        message: err instanceof Error ? err.message : String(err),
        backup: err instanceof ApplyFailedError ? err.backup : undefined,
    }
}

/**
 * Executes a plan. `dryRun` short-circuits before any filesystem write. A
 * failure on one change is recorded and the rest still run, so a single
 * unwritable path cannot silently abandon the other files.
 */
export async function applyPlan(plan: ClientPlan, dryRun: boolean): Promise<AppliedClient> {
    const applied: AppliedChange[] = []
    const errors: ApplyError[] = []
    if (dryRun) {
        return { id: plan.id, label: plan.label, applied, errors }
    }
    for (const change of plan.changes) {
        try {
            applied.push(await applyChange(change))
        } catch (err) {
            errors.push(toApplyError(change.path, err))
        }
    }
    return { id: plan.id, label: plan.label, applied, errors }
}
