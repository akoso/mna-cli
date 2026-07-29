# Development

## Requirements

- [Bun](https://bun.sh) 1.x
- A My Next Adventure account + API key for end-to-end testing

## Setup

```bash
bun install
bun run codegen   # generates src/api/generated/schema.ts from the production OpenAPI
```

## Common workflows

```bash
bun run dev <args>      # run the CLI from source (alias for `bun run src/bin/mna.ts`)
bun run test            # unit tests
bun run test:watch      # unit tests in watch mode
bun run typecheck       # tsc --noEmit
bun run lint            # biome lint
bun run lint:fix        # biome check --write (auto-fix lint + format)
bun run format          # biome format --write
bun run build           # bundles to dist/ for npm publish
bun run codegen         # regen types from production OpenAPI
```

## Codegen source priority

Without `MNA_OPENAPI_URL` set, `bun run codegen` tries sources in order:

1. `openapi.json` at the repo root (committed snapshot)
2. `https://api.mynextadventure.cloud/v1/openapi.json` (the live public spec)

The snapshot comes first so CI and fresh clones are deterministic and land green regardless of deploy timing; the URL is the fallback for a checkout where the snapshot is missing. To type-check against the current production surface instead, force it:

```bash
MNA_OPENAPI_URL=https://api.mynextadventure.cloud/v1/openapi.json bun run codegen
```

The snapshot is refreshed on a slower cadence than the server deploys, so it can lag production by additive (backwards-compatible) fields. Refresh it by running the command above and committing the resulting `openapi.json`.

## Codegen against a local server

If you're hacking on `mynextadventure/travel-plans` locally:

```bash
MNA_OPENAPI_URL=http://127.0.0.1:5010/v1/openapi.json bun run codegen
```

Explicitly setting `MNA_OPENAPI_URL` disables the snapshot fallback — the script tries only that one source and fails if it's down.

## File layout

```
src/
├── api/           # openapi-fetch client + generated types
├── auth/          # credentials store + login flow
├── bin/           # CLI entrypoint
├── commands/      # one file per command
├── render/        # output formatters (JSON, table, ANSI)
└── util/          # error reporting, XDG paths
```

## Tests

`bun test`. Tests live next to their subjects (`*.test.ts`). The credentials store
test uses a temp dir via `XDG_CONFIG_HOME` and never touches `~/.config`. The
API client test stubs `global.fetch` rather than hitting the network. Don't
introduce tests that hit production unless they're explicitly opt-in (`MNA_E2E=1`).

## Releasing

See [RELEASING.md](./RELEASING.md). Releases are driven by pushing a `vX.Y.Z`
tag, which builds the native binaries, cuts a GitHub Release, and publishes
`@mantacode/mna-cli` to npm.
