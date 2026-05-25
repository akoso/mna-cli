# mna

> Command-line tool for [My Next Adventure](https://mynextadventure.cloud).

`mna` is an open-source CLI for managing your trips on My Next Adventure.
It also ships as a [Claude Code](https://claude.com/claude-code) skill so Claude
can plan, view, and (in later phases) modify trips on your behalf.

Status: **pre-1.0, alpha.** Tagged releases publish binaries to GitHub
Releases. npm and Homebrew distribution land with the first tag.

## Install

### npm (Node 20+)

```bash
npm install -g @mynextadventure/cli
```

This installs the `mna` binary. It bundles all dependencies as a single
JS file; no Bun required.

### Homebrew (macOS + Linux)

```bash
brew install mynextadventure/tap/mna
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
  https://github.com/akoso/mna-cli/releases/latest/download/mna-darwin-arm64.tar.gz
tar -xzf mna.tar.gz
mv mna-darwin-arm64 /usr/local/bin/mna
mna --version
```

### From source (development)

```bash
git clone https://github.com/mynextadventure/mna-cli
cd mna-cli
bun install
bun run codegen
bun link
```

`mna` should then be on your PATH. See [DEVELOPMENT.md](./DEVELOPMENT.md).

## Quickstart

1. Sign in at https://mynextadventure.cloud, open the user menu, and click **API Keys** to generate one.
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
