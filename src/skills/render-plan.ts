import { colors } from '../render/colors'
import type { PlannedChange } from './changes'
import type { ClientPlan } from './plan'

/**
 * Shortens `/Users/me/.claude/...` to `~/.claude/...` for display only.
 * Replaces every occurrence so it also tidies paths embedded in a sentence
 * (e.g. the "config is not valid JSON" message).
 */
export function tildify(text: string, home: string): string {
    if (!home) return text
    return text.split(`${home}/`).join('~/')
}

function describe(change: PlannedChange, home: string, unverified: boolean): string {
    const verb =
        change.status === 'create'
            ? colors.green('create   ')
            : change.status === 'overwrite'
              ? colors.yellow('overwrite')
              : colors.dim('unchanged')
    const target = tildify(change.path, home)
    const suffix = change.kind === 'json' ? colors.dim(`  →  ${change.keyPath.join('.')}`) : ''
    const marker = unverified ? colors.dim(' (?)') : ''
    return `    ${verb}  ${target}${suffix}${marker}`
}

export interface RenderPlanOptions {
    home: string
    /** Show `unchanged` lines too (used by --dry-run). */
    verbose?: boolean
}

/** Renders the "here is exactly what I will write" block shown before confirming. */
export function renderPlans(plans: ClientPlan[], options: RenderPlanOptions): string {
    const lines: string[] = []
    for (const plan of plans) {
        const changes = options.verbose ? plan.changes : plan.changes.filter((c) => c.status !== 'unchanged')
        if (changes.length === 0 && !plan.mcpBlocked) continue

        lines.push(`  ${colors.bold(plan.label)}`)
        for (const change of changes) {
            const unverified =
                change.label === 'skill' ? !plan.skillPathVerified : !plan.mcpPathVerified
            lines.push(describe(change, options.home, unverified))
        }
        if (plan.mcpBlocked) {
            lines.push(`    ${colors.yellow('skipped')}    ${tildify(plan.mcpBlocked, options.home)}`)
        }
        lines.push('')
    }
    return lines.join('\n')
}

export function pendingCount(plans: ClientPlan[]): number {
    return plans.reduce((n, plan) => n + plan.changes.filter((c) => c.status !== 'unchanged').length, 0)
}
