import skillMd from '../../skills/mna/SKILL.md' with { type: 'text' }
import cliAndSchemas from '../../skills/mna/references/cli-and-schemas.md' with { type: 'text' }
import researchAndCosting from '../../skills/mna/references/research-and-costing.md' with { type: 'text' }

/**
 * The skill payload is inlined into the bundle at build time (Bun's text
 * loader) rather than read from disk. That way `mna skills install` works
 * identically from npm, Homebrew's compiled binary, and a source checkout —
 * none of which agree on where `skills/mna` sits relative to the entrypoint.
 */
export const SKILL_NAME = 'mna'

export interface SkillFile {
    /** Path relative to the skill directory. */
    path: string
    content: string
}

export const SKILL_FILES: SkillFile[] = [
    { path: 'SKILL.md', content: skillMd },
    { path: 'references/cli-and-schemas.md', content: cliAndSchemas },
    { path: 'references/research-and-costing.md', content: researchAndCosting },
]

/** The MNA MCP server (remote, streamable HTTP; OAuth-capable, also accepts X-API-Key). */
export const MCP_SERVER_NAME = 'my-next-adventure'
export const MCP_SERVER_URL = 'https://mcp.mynextadventure.cloud/mcp'
