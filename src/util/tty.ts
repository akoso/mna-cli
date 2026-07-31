/** Common CI env vars — set by GitHub Actions, GitLab, CircleCI, Buildkite, etc. */
const CI_VARS = ['CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'GITHUB_ACTIONS', 'GITLAB_CI']

export function isCI(): boolean {
    return CI_VARS.some((name) => {
        const value = process.env[name]
        return value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'
    })
}

/**
 * True only when we can actually put a prompt in front of a human: both ends of
 * the terminal are a TTY and we are not in CI.
 */
export function isInteractive(): boolean {
    return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY) && !isCI()
}
