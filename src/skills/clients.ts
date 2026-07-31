import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { HostEnv } from './host-env'
import { MCP_SERVER_URL } from './payload'

export type Scope = 'user' | 'project'

/**
 * How a client wants a remote MCP server expressed in its config.
 *
 * - `http`      — `{ type: 'http', url, headers? }` (Claude Code, VS Code)
 * - `url`       — `{ url, headers? }`, no `type` field (Cursor)
 * - `httpUrl`   — `{ httpUrl, headers? }`; Gemini CLI picks its transport from
 *                 the key name (`httpUrl` = streamable HTTP, `url` = SSE)
 * - `serverUrl` — `{ serverUrl, headers? }` (Windsurf/Cascade)
 * - `mcp-remote`— stdio bridge for clients without a remote transport
 *                 (`npx -y mcp-remote <url> --header X-API-Key:${MNA_API_KEY}`)
 */
export type McpStyle = 'http' | 'url' | 'httpUrl' | 'serverUrl' | 'mcp-remote'

export interface McpTarget {
    /** Resolves the config file, or null when unsupported on this platform. */
    configPath: (env: HostEnv) => string | null
    /** Top-level key holding the server map ("mcpServers" almost everywhere; "servers" in VS Code). */
    serversKey: string
    style: McpStyle
}

export interface ClientDefinition {
    id: string
    label: string
    /** Path relative to $HOME whose existence means "this client is installed". */
    detectDir: string
    /** Skill directory root relative to $HOME, or null when the client has no skill support. */
    userSkillsDir: string | null
    /** Skill directory root relative to the project root, or null. */
    projectSkillsDir: string | null
    mcp?: McpTarget
    /** Extra note surfaced in `skills list` / install output. */
    note?: string
}

function claudeDesktopConfigPath(env: HostEnv): string | null {
    if (env.platform === 'darwin') {
        return join(env.home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    }
    if (env.platform === 'win32') {
        const appData = env.appData ?? join(env.home, 'AppData', 'Roaming')
        return join(appData, 'Claude', 'claude_desktop_config.json')
    }
    return join(env.home, '.config', 'Claude', 'claude_desktop_config.json')
}

function claudeDesktopDetectDir(env: HostEnv): string {
    const path = claudeDesktopConfigPath(env)
    return path ? dirname(path) : join(env.home, '.config', 'Claude')
}

function vscodeUserDir(env: HostEnv): string {
    if (env.platform === 'darwin') return join(env.home, 'Library', 'Application Support', 'Code', 'User')
    if (env.platform === 'win32') {
        const appData = env.appData ?? join(env.home, 'AppData', 'Roaming')
        return join(appData, 'Code', 'User')
    }
    return join(env.home, '.config', 'Code', 'User')
}

/**
 * Supported clients.
 *
 * Skill directories follow the same table Wrangler uses (via `rosie-skills`)
 * for its own post-login install, which is the de-facto cross-agent
 * convention: `<agent-config-dir>/skills/<name>/SKILL.md`.
 */
export const CLIENTS: ClientDefinition[] = [
    {
        id: 'claude-code',
        label: 'Claude Code',
        detectDir: '.claude',
        userSkillsDir: '.claude/skills',
        projectSkillsDir: '.claude/skills',
        mcp: {
            configPath: (env) => join(env.home, '.claude.json'),
            serversKey: 'mcpServers',
            style: 'http',
        },
    },
    {
        id: 'cursor',
        label: 'Cursor',
        detectDir: '.cursor',
        userSkillsDir: '.cursor/skills',
        projectSkillsDir: '.cursor/skills',
        mcp: {
            configPath: (env) => join(env.home, '.cursor', 'mcp.json'),
            serversKey: 'mcpServers',
            style: 'url',
        },
    },
    {
        id: 'claude-desktop',
        label: 'Claude Desktop',
        detectDir: '',
        userSkillsDir: null,
        projectSkillsDir: null,
        mcp: {
            configPath: claudeDesktopConfigPath,
            serversKey: 'mcpServers',
            style: 'mcp-remote',
        },
        note: 'MCP server only — Claude Desktop does not read filesystem skills.',
    },
    {
        id: 'windsurf',
        label: 'Windsurf / Devin Desktop',
        detectDir: '.codeium/windsurf',
        userSkillsDir: '.codeium/windsurf/skills',
        projectSkillsDir: '.windsurf/skills',
        mcp: {
            configPath: (env) => join(env.home, '.codeium', 'windsurf', 'mcp_config.json'),
            serversKey: 'mcpServers',
            style: 'serverUrl',
        },
    },
    {
        id: 'vscode',
        label: 'VS Code (Copilot agent mode)',
        detectDir: '',
        userSkillsDir: null,
        projectSkillsDir: null,
        mcp: {
            configPath: (env) => join(vscodeUserDir(env), 'mcp.json'),
            serversKey: 'servers',
            style: 'http',
        },
        note: 'MCP server only; targets the default VS Code profile.',
    },
    {
        id: 'codex',
        label: 'Codex CLI',
        detectDir: '.codex',
        userSkillsDir: '.codex/skills',
        projectSkillsDir: '.codex/skills',
        note: 'Skill only — Codex keeps MCP servers in TOML, which `mna` does not edit.',
    },
    {
        id: 'opencode',
        label: 'OpenCode',
        detectDir: '.config/opencode',
        userSkillsDir: '.config/opencode/skills',
        projectSkillsDir: '.opencode/skills',
    },
    {
        // The cross-agent convention several tools now read (Codex, Amp, Warp,
        // Copilot, Antigravity, …). Only written when it already exists, or on
        // an explicit --client agents / --all.
        id: 'agents',
        label: 'Universal agent skills',
        detectDir: '.agents',
        userSkillsDir: '.agents/skills',
        projectSkillsDir: '.agents/skills',
        note: 'Shared ~/.agents/skills directory read by several agents.',
    },
    {
        id: 'gemini-cli',
        label: 'Gemini CLI',
        detectDir: '.gemini',
        userSkillsDir: '.gemini/skills',
        projectSkillsDir: '.gemini/skills',
        mcp: {
            configPath: (env) => join(env.home, '.gemini', 'settings.json'),
            serversKey: 'mcpServers',
            style: 'httpUrl',
        },
    },
]

export function findClient(id: string): ClientDefinition | undefined {
    return CLIENTS.find((c) => c.id === id)
}

async function isDir(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isDirectory()
    } catch {
        return false
    }
}

async function exists(path: string): Promise<boolean> {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}

/** Absolute path of the directory whose presence means "installed". */
export function detectionPath(client: ClientDefinition, env: HostEnv): string {
    if (client.id === 'claude-desktop') return claudeDesktopDetectDir(env)
    if (client.id === 'vscode') return vscodeUserDir(env)
    return join(env.home, client.detectDir)
}

export async function isClientInstalled(client: ClientDefinition, env: HostEnv): Promise<boolean> {
    const path = detectionPath(client, env)
    if (await isDir(path)) return true
    // Some clients only materialise their config file, not a directory.
    const configPath = client.mcp?.configPath(env)
    return configPath ? await exists(configPath) : false
}

/** Absolute path of the skill directory we would write into. */
export function skillDir(client: ClientDefinition, env: HostEnv, scope: Scope): string | null {
    if (scope === 'project') {
        return client.projectSkillsDir ? join(env.cwd, client.projectSkillsDir, 'mna') : null
    }
    return client.userSkillsDir ? join(env.home, client.userSkillsDir, 'mna') : null
}

export interface McpEntryOptions {
    apiKey?: string
    url?: string
}

/** Builds the config value for this client's MCP server entry. */
export function buildMcpEntry(style: McpStyle, options: McpEntryOptions = {}): Record<string, unknown> {
    const url = options.url ?? MCP_SERVER_URL
    const headers = options.apiKey ? { 'X-API-Key': options.apiKey } : undefined

    if (style === 'mcp-remote') {
        // mcp-remote mangles header values containing spaces, so the documented
        // workaround is to pass the value through an env var placeholder.
        const args = ['-y', 'mcp-remote', url]
        const entry: Record<string, unknown> = { command: 'npx', args }
        if (options.apiKey) {
            args.push('--header', 'X-API-Key:${MNA_API_KEY}')
            entry.env = { MNA_API_KEY: options.apiKey }
        }
        return entry
    }

    if (style === 'url') {
        return headers ? { url, headers } : { url }
    }

    if (style === 'httpUrl') {
        return headers ? { httpUrl: url, headers } : { httpUrl: url }
    }

    if (style === 'serverUrl') {
        return headers ? { serverUrl: url, headers } : { serverUrl: url }
    }

    // Claude Code and VS Code share this shape; they differ only in which
    // top-level key the entry lives under (`mcpServers` vs `servers`).
    return headers ? { type: 'http', url, headers } : { type: 'http', url }
}
