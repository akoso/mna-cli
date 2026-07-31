import { mcpState, skillState, type ClientPlan } from './plan'

/**
 * The per-client shape emitted by both `skills list` and `skills install`.
 * Keeping one definition means the two commands cannot drift apart.
 */
export function clientJsonView(plan: ClientPlan) {
    return {
        id: plan.id,
        label: plan.label,
        installed: plan.installed,
        detectedAt: plan.detectedAt,
        skill: {
            path: plan.skillPath,
            state: skillState(plan),
            pathVerified: plan.skillPathVerified,
            pathDocs: plan.skillPathDocs ?? null,
        },
        mcp: {
            path: plan.mcpPath,
            state: mcpState(plan),
            pathVerified: plan.mcpPathVerified,
        },
        mcpBlocked: plan.mcpBlocked ?? null,
    }
}
