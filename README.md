# mna

> Command-line tool for [My Next Adventure](https://mynextadventure.cloud).

`mna` is an open-source CLI for managing your trips on My Next Adventure.
It also ships as an agent skill — run `mna skills install` and your AI coding
agent (Claude Code, Cursor, …) can plan, research, build, cost, and manage whole
trips on your behalf. See [`skills/mna/SKILL.md`](./skills/mna/SKILL.md).

Status: **pre-1.0, alpha.** Tagged releases publish binaries to GitHub
Releases. npm and Homebrew distribution land with the first tag.

## Install

### npm (Node 20+)

```bash
npm install -g @mantacodedevs/mna-cli
```

This installs the `mna` binary. It bundles all dependencies as a single
JS file; no Bun required.

### Homebrew (macOS + Linux)

```bash
brew install mantacodedevs/tap/mna
```

Installs a precompiled native binary. The tap is updated per release; see
[RELEASING.md](./RELEASING.md).

### Pre-built binary from GitHub Releases

```bash
# Pick the right artifact for your OS/arch:
#   mna-darwin-arm64.tar.gz   (Apple Silicon)
#   mna-darwin-x64.tar.gz     (Intel Mac)
#   mna-linux-x64.tar.gz      (Linux x86_64)
curl -L -o mna.tar.gz \
  https://github.com/MantaCodeDevs/mna-cli/releases/latest/download/mna-darwin-arm64.tar.gz
tar -xzf mna.tar.gz
mv mna-darwin-arm64 /usr/local/bin/mna
mna --version
```

### From source (development)

```bash
git clone https://github.com/MantaCodeDevs/mna-cli
cd mna-cli
bun install
bun run codegen
bun run build
bun link
```

`bun run build` is required before `bun link` — it produces `dist/mna.js`, the bin
target. `bun link` only creates the `mna` symlink if that file already exists, so
skipping the build leaves you with `command not found: mna`.

`mna` should then be on your PATH. See [DEVELOPMENT.md](./DEVELOPMENT.md).

## Quickstart

```bash
mna login                          # opens browser for one-click consent
mna trips list                     # see your trips
mna trips show <tripId>            # detail view
```

If you prefer headless / paste-token login:

```bash
mna login --paste-token <key>      # generate the key from the user menu on app.mynextadventure.cloud
```

## Use it from your AI coding agent

`mna` doubles as an agent **skill** — install it and your agent can plan, research, cost, and
manage whole trips for you. **One command:**

```bash
mna skills install
```

It detects the AI clients on your machine, shows exactly what it will write where, and asks
once. After a successful `mna login` on an interactive terminal it offers the same thing with a
single `y` (silence it with `mna config set skills.prompt false`).

```bash
mna skills list                      # what's detected, and what's already installed
mna skills list --all                # every client mna knows how to install into
mna skills install --dry-run         # show the writes, change nothing
mna skills install --client cursor   # one client only
mna skills install --all --yes       # every supported client, no prompt
mna skills install --no-mcp          # skill only, skip the MCP server entry
mna skills install --scope project   # into ./.claude/skills etc. instead of $HOME
```

Installs are idempotent: identical files are left alone, JSON configs are **merged** (never
overwritten wholesale), anything modified is backed up next to itself as
`<file>.mna-backup-<timestamp>`, and a config `mna` can't parse is reported rather than
replaced.

### Supported clients

| Client | `--client` | Skill | MCP server config |
|---|---|---|---|
| Claude Code | `claude-code` | `~/.claude/skills/mna/` | `~/.claude.json` → `mcpServers` |
| Cursor | `cursor` | `~/.cursor/skills/mna/` | `~/.cursor/mcp.json` → `mcpServers` |
| Claude Desktop | `claude-desktop` | — | `claude_desktop_config.json` (per-OS) → `mcpServers` |
| Windsurf / Devin Desktop | `windsurf` | `~/.codeium/windsurf/skills/mna/` | `~/.codeium/windsurf/mcp_config.json` |
| VS Code (Copilot agent mode) | `vscode` | — | `<VS Code user dir>/mcp.json` → `servers` |
| Universal agent skills | `agents` | `~/.agents/skills/mna/` | — |
| Codex CLI | `codex` | `~/.codex/skills/mna/` | — (TOML config, not touched) |
| OpenCode | `opencode` | `~/.config/opencode/skills/mna/` | — |
| Gemini CLI | `gemini-cli` | `~/.gemini/skills/mna/` | `~/.gemini/settings.json` → `mcpServers` |

The MCP entry points at the hosted server `https://mcp.mynextadventure.cloud/mcp`, written in
whichever shape the client expects — `{"type":"http","url":…}` for Claude Code and VS Code,
`{"url":…}` for Cursor, `{"httpUrl":…}` for Gemini CLI, `{"serverUrl":…}` for Windsurf, and the
`npx -y mcp-remote` stdio bridge for Claude Desktop, which has no native remote transport. If
you're logged in, your API key is embedded as an `X-API-Key` header — otherwise the client
authenticates over OAuth on first use.

### Manual install (fallback)

The skill is plain markdown driving the CLI, so any agent that reads `SKILL.md` files can use
it. Copy it wherever your agent looks:

```bash
# from a clone
mkdir -p ~/.claude/skills && cp -r skills/mna ~/.claude/skills/

# from the npm package
mkdir -p ~/.claude/skills && cp -r "$(npm root -g)/@mantacodedevs/mna-cli/skills/mna" ~/.claude/skills/
```

The skill drives the `mna` CLI, so install the CLI (above) and run `mna login` first.

## Commands

Every command supports `--json` for piping into `jq` or Claude.

### Auth & identity

| Command | Description |
|---|---|
| `mna login [--paste-token <key>]` | Browser-mediated login (default) or headless paste-token. |
| `mna logout [--local-only]` | Revoke the current API key server-side and delete local credentials. |
| `mna whoami [--verify]` | Show the current user; `--verify` re-fetches from `/v1/me`. |
| `mna keys list` | List active API keys with `current` flag on the calling key. |
| `mna keys revoke <name> [--yes]` | Revoke an API key by name. |
| `mna config get\|set apiBaseUrl [<url>]` | Read/override the API base URL locally. |
| `mna config get\|set skills.prompt [true\|false]` | Toggle the post-login "install the skill?" offer. |

### Agent integration

| Command | Description |
|---|---|
| `mna skills list [--all] [--scope=user\|project]` | Show detected AI clients and whether the skill/MCP server is installed. |
| `mna skills install [--client=<id>] [--all] [--scope=user\|project] [--no-mcp] [--dry-run] [--yes]` | Install the skill (and MCP server entry) into your AI clients. |

### Trips

| Command | Description |
|---|---|
| `mna trips list [--status=planning\|ready\|finished\|cancelled] [--include-example]` | List trips. |
| `mna trips show <tripId> [--all-options]` | Show one trip in detail. |
| `mna trips create --name <name> [--cover-photo <url>]` | Create a new trip. |
| `mna trips edit <tripId> [--name=...] [--cover-photo=...] [--status=...]` | Update trip-level fields. |
| `mna trips delete <tripId> [--yes]` | Delete a trip permanently. |
| `mna trips share <tripId>` | Generate a shareable link for the trip. |
| `mna trips unshare <tripId>` | Revoke all share links. |

### Variants

| Command | Description |
|---|---|
| `mna variants add <tripId> --name <name> [--notes=...]` | Add a new variant. |
| `mna variants duplicate <tripId> <variantId>` | Duplicate a variant. |
| `mna variants edit <tripId> <variantId> [--name=...] [--notes=...]` | Update variant fields. |
| `mna variants select <tripId> <variantId>` | Set the selected variant. |
| `mna variants delete <tripId> <variantId> [--yes]` | Delete a variant. |

### Destinations

| Command | Description |
|---|---|
| `mna destinations add <tripId> <variantId> --place <name> [--notes=...] [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--return-to-home]` | Add a destination. |
| `mna destinations edit <tripId> <variantId> <destinationKey> [--place=...] [--notes=...] [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--no-return-to-home]` | Update destination. |
| `mna destinations reorder <tripId> <variantId> --order=key1,key2,key3` | Reorder destinations. |
| `mna destinations delete <tripId> <variantId> <destinationKey> [--yes]` | Delete a destination. |

### Options (accommodation \| transport \| getting-around)

| Command | Description |
|---|---|
| `mna options add <tripId> <variantId> <destinationKey> <kind> --from-json=<file> [--free-cancellation-until=<date>]` | Add an option from JSON. `--free-cancellation-until` (accommodation only) merges into the body. |
| `mna options edit <tripId> <variantId> <destinationKey> <kind> <optionKey> [--from-json=<file>] [--free-cancellation-until=<date>]` | Edit an option. For accommodation, `--free-cancellation-until` alone updates the date without a JSON file. |
| `mna options delete <tripId> <variantId> <destinationKey> <kind> <optionKey> [--yes]` | Delete an option. |
| `mna options select <tripId> <variantId> <destinationKey> <kind> <optionKey>` | Select an option. |
| `mna options deselect <tripId> <variantId> <destinationKey> <kind>` | Deselect the current option. |

### Events

| Command | Description |
|---|---|
| `mna events add <tripId> <variantId> --from-json=<file>` | Add an event. |
| `mna events edit <tripId> <variantId> <eventKey> --from-json=<file>` | Edit an event. |
| `mna events toggle <tripId> <variantId> <eventKey>` | Toggle the event's selected state. |
| `mna events delete <tripId> <variantId> <eventKey> [--yes]` | Delete an event. |

### Collaboration & voting

| Command | Description |
|---|---|
| `mna access list <tripId>` | List collaborators on a trip. |
| `mna access invite <tripId> --email=... --role=VIEW\|VOTER\|EDIT\|OWNER` | Invite a collaborator by email. |
| `mna access set-role <tripId> --user=<userId> --role=...` | Change a collaborator's role. |
| `mna access revoke <tripId> --user=<userId> [--yes]` | Remove a collaborator. |
| `mna access create-invite-link <tripId> --role=VIEW\|VOTER\|EDIT` | Generate an invite-link token. |
| `mna access list-invite-links <tripId>` | List active invite links. |
| `mna access revoke-invite-link <tripId> <tokenId> [--yes]` | Revoke an invite link. |
| `mna vote option <tripId> <variantId> <destinationKey> <kind> <optionKey> --value=up\|down\|clear` | Vote on an option. |
| `mna vote event <tripId> <variantId> <eventKey> --value=up\|down\|clear` | Vote on an event. |
| `mna votes list <tripId> <variantId>` | List votes for a variant. |

### Travel goals

| Command | Description |
|---|---|
| `mna goals list [--collection=<id>] [--status=visited\|dreaming\|planning]` | List goals. |
| `mna goals show <goalId>` | Show one goal. |
| `mna goals add --from-json=<file>` | Create a goal from JSON. |
| `mna goals quick-add --text="..."` | Quick-add a goal by name or URL. |
| `mna goals edit <goalId> --from-json=<file>` | Update a goal. |
| `mna goals delete <goalId> [--yes]` | Delete a goal. |
| `mna goals link-trip <goalId> <tripId>` | Link a goal to a trip. |
| `mna goals unlink-trip <goalId>` | Unlink a goal from its trip. |
| `mna goals mark-visited <goalId> [--date=<ISO>]` | Mark a goal as visited. |
| `mna goals mark-dreaming <goalId>` | Reset a goal to "dreaming". |

### Goal collections

| Command | Description |
|---|---|
| `mna collections list` | List your collections. |
| `mna collections show <collectionId>` | Show a collection with nested goals. |
| `mna collections create --name=<name> [--description=...] [--emoji=...] [--visibility=private\|shared\|public]` | Create a collection. |
| `mna collections edit <collectionId> --from-json=<file>` | Update a collection. |
| `mna collections delete <collectionId> [--yes]` | Delete a collection. |
| `mna collections add-goal <collectionId> <goalId>` | Add a goal to a collection. |
| `mna collections remove-goal <collectionId> <goalId>` | Remove a goal from a collection. |
| `mna collections share <collectionId>` | Generate a public share URL. |
| `mna collections open-shared <token>` | Open a publicly shared collection (no login required). |

## Status

All command groups (auth/keys/config, trips, variants, destinations, options, events, access, vote/votes, goals, collections) are wired, CI-tested, and backed by live `/v1/` endpoints in production. Pre-1.0 means the public API contract is still allowed to break under `/v1/`. Once `1.0.0` ships, `/v1/` becomes stable; breaking changes require `/v2/`.

The contract of record is `https://api.mynextadventure.cloud/v1/openapi.json`. If a write seems to "succeed" but a field doesn't stick, re-fetch with `mna trips show <id> --json` to confirm — and check the request body shape against the OpenAPI schema for that endpoint.

## Configuration

| Env var | Description |
|---|---|
| `MNA_API_KEY` | Override the key from the credentials file. Useful for CI. |
| `MNA_API_BASE_URL` | Override the API base URL. Useful for local dev. |
| `XDG_CONFIG_HOME` | Where the credentials and settings files are stored. Default: `~/.config`. |
| `CI=1` | Suppresses all interactive prompts, including the post-login skill offer. |
| `MNA_DEBUG=1` | Print error stack traces. |
| `NO_COLOR=1` | Disable ANSI colors. |

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md). MIT licensed.
