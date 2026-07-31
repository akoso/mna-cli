import { colors } from '../render/colors'
import type { PlannedChange } from './changes'
import type { ClientPlan } from './plan'

/** Shortens `/Users/me/.claude/...` to `~/.claude/...` for display only. */
export function tildify(path: string, home: string): string {
    return home && path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

function describe(change: PlannedChange, home: string): string {
    const verb =
        change.status === 'create'
            ? colors.green('create   ')
            : change.status === 'overwrite'
              ? colors.yellow('overwrite')
              : colors.dim('unchanged')
    const target = tildify(change.path, home)
    const suffix = change.kind === 'json' ? colors.dim(`  →  ${change.keyPath.join('.')}`) : ''
    return `    ${verb}  ${target}${suffix}`
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
        if (changes.length === 0 && !plan.blocked) continue

        lines.push(`  ${colors.bold(plan.label)}`)
        if (plan.blocked) {
            lines.push(`    ${colors.yellow('skipped')}    ${plan.blocked}`)
        }
        for (const change of changes) {
            lines.push(describe(change, options.home))
        }
        lines.push('')
    }
    return lines.join('\n')
}

export function pendingCount(plans: ClientPlan[]): number {
    return plans.reduce((n, plan) => n + plan.changes.filter((c) => c.status !== 'unchanged').length, 0)
}
