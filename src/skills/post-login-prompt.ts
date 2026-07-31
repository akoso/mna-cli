import { confirm } from '@inquirer/prompts'
import { colors } from '../render/colors'
import { CLIENTS } from './clients'
import { hostEnv, type HostEnv } from './host-env'
import { SKILL_NAME } from './payload'
import { applyPlan, hasPendingChanges, planForClients } from './plan'
import { tildify } from './render-plan'
import { skillsPromptEnabled } from '../util/settings'
import { isInteractive } from '../util/tty'

export type PostLoginOutcome =
    | 'skipped-json'
    | 'skipped-non-interactive'
    | 'skipped-disabled'
    | 'skipped-none-detected'
    | 'skipped-up-to-date'
    | 'declined'
    | 'installed'

export interface PostLoginPromptOptions {
    /** Machine-readable invocation — never prompt. */
    json?: boolean
    /** Overrides for tests. */
    interactive?: boolean
    env?: HostEnv
    confirmFn?: (message: string) => Promise<boolean>
    write?: (s: string) => void
}

/**
 * Wrangler-style courtesy offer after a successful login: if the machine has
 * AI clients that could drive `mna` and the skill isn't there yet, offer to
 * install it with a single `y`. Silent in CI, pipes, `--json`, or when the
 * user has turned it off with `mna config set skills.prompt false`.
 */
export async function maybeOfferSkillInstall(
    options: PostLoginPromptOptions = {},
): Promise<PostLoginOutcome> {
    const write = options.write ?? ((s: string) => void process.stdout.write(s))

    if (options.json) return 'skipped-json'
    if (!(options.interactive ?? isInteractive())) return 'skipped-non-interactive'
    if (!(await skillsPromptEnabled())) return 'skipped-disabled'

    const env = options.env ?? hostEnv()
    const plans = (
        await planForClients(CLIENTS, { env, scope: 'user', includeMcp: false })
    ).filter((plan) => plan.installed && plan.skillPath !== null && plan.skillPathVerified)

    if (plans.length === 0) return 'skipped-none-detected'

    const pending = plans.filter(hasPendingChanges)
    if (pending.length === 0) return 'skipped-up-to-date'

    const labels = pending.map((p) => p.label).join(', ')
    write(
        `\n${colors.dim(`Detected AI coding agents that could plan trips for you: ${labels}.`)}\n`,
    )

    const ask =
        options.confirmFn ??
        ((message: string) => confirm({ message, default: true }))
    const accepted = await ask(`Install the ${SKILL_NAME} skill for ${labels}?`)

    if (!accepted) {
        write(
            colors.dim(
                '  Skipped. Install later with `mna skills install`, or silence this with `mna config set skills.prompt false`.\n',
            ),
        )
        return 'declined'
    }

    for (const plan of pending) {
        const applied = await applyPlan(plan, false)
        for (const change of applied.applied) {
            if (change.result === 'unchanged') continue
            write(`${colors.green('✓')} ${change.result} ${tildify(change.path, env.home)}\n`)
        }
    }
    write(colors.dim('  Restart the agent (or reload skills) and just ask it to plan a trip.\n'))
    return 'installed'
}
