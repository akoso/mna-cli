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
mna login --paste-token <key>      # generate the key from the user menu on mynextadventure.cloud
```

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

All command groups (auth/keys/config, trips, variants, destinations, options, events, access, vote/votes, goals, collections) are wired and CI-tested. Pre-1.0 means the public API contract is still allowed to break under `/v1/`. Once `1.0.0` ships, `/v1/` becomes stable; breaking changes require `/v2/`.

The matching server-side public API endpoints land progressively in the `akoso/travel-plans` repo. If a command returns a 404 against production, the corresponding server PR likely hasn't deployed yet — try `mna whoami --verify` to confirm your base URL.

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
