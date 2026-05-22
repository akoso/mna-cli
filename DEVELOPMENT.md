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

1. `https://mynextadventure.com/v1/openapi.json` (the live public spec)
2. `openapi.json` at the repo root (committed snapshot, refreshed periodically)

The snapshot fallback exists so CI and fresh clones work even when the production endpoint is unreachable. Once the production deploy is reliably online, prefer the URL — the committed snapshot will be regenerated on a slower cadence to track major contract changes.

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

Out of scope until Phase 8. See `docs/superpowers/specs/2026-05-21-mna-cli-design.md`
in the `travel-plans` repo for the release plan.
