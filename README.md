# mna

> Command-line tool for [My Next Adventure](https://mynextadventure.com).

`mna` is an open-source CLI for managing your trips on My Next Adventure.
It also ships as a [Claude Code](https://claude.com/claude-code) skill so Claude
can plan, view, and (in later phases) modify trips on your behalf.

Status: **alpha** — Phase 0 is read-only against the existing public API.
Future phases add full UI parity for writes, goals, collections, and group
features.

## Install

Not yet published to npm or Homebrew. Run from source:

```bash
git clone https://github.com/mynextadventure/mna-cli
cd mna-cli
bun install
bun run codegen
bun link
```

`mna` should then be on your PATH.

## Quickstart

1. Generate an API key at https://mynextadventure.com/settings/api-keys.
2. `mna login --paste-token <key>`
3. `mna trips list`

## Commands (Phase 0)

| Command | Description |
|---|---|
| `mna login --paste-token <key>` | Authenticate the CLI. |
| `mna logout` | Delete local credentials. |
| `mna whoami` | Show the current user (from local file). |
| `mna trips list [--status=...] [--include-example]` | List trips. |
| `mna trips show <tripId> [--all-options]` | Show one trip in detail. |
| `mna config get apiBaseUrl` | Show the current API base URL. |
| `mna config set apiBaseUrl <url>` | Override the base URL. |

Every command supports `--json` for piping into `jq` or Claude.

## Roadmap

- **Phase 1:** Browser-mediated login, `mna keys list|revoke`, `mna whoami --verify`.
- **Phases 2–7:** Trip / variant / destination / option / event / access / goal
  / collection CRUD as the server-side public API surface lands.
- **Phase 8:** npm package + Homebrew tap with native binaries.

## Configuration

| Env var | Description |
|---|---|
| `MNA_API_KEY` | Override the key from the credentials file. Useful for CI. |
| `MNA_API_BASE_URL` | Override the API base URL. Useful for local dev. |
| `XDG_CONFIG_HOME` | Where the credentials file is stored. Default: `~/.config`. |
| `MNA_DEBUG=1` | Print error stack traces. |
| `NO_COLOR=1` | Disable ANSI colors. |

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md). MIT licensed.
