---
name: mna
description: Use when the user wants to view, create, or manage their trips,
  variants, destinations, accommodation/transport/activity options, events,
  shares, travel goals, or collections on My Next Adventure.
---

# Managing trips with My Next Adventure

You have access to the `mna` CLI for the user's trips on mynextadventure.cloud.

## Bootstrap

Run `mna whoami` first. If it fails with "Not logged in", ask the user to run
`mna login --paste-token <key>` themselves — they generate the key by signing
in at https://mynextadventure.cloud, opening the user menu, and clicking
"API Keys".

Always pass `--json` so output is parseable.

## Phase 0 capabilities (read-only)

- `mna trips list --json` — overview of all trips.
- `mna trips show <tripId> --json` — full detail for one trip.
- `mna trips show <tripId> --json --all-options` — include unselected options.
- `mna whoami --json` — current credentials (no server call).
- `mna config get apiBaseUrl --json` — current base URL.

## Not yet available

Write operations, goals/collections, share/invite, voting, browser login,
`whoami --verify`. These land in Phases 1–7 of the server roadmap. Until then,
respond to write requests by explaining that this CLI is read-only today and
suggesting the web UI for mutations.

## Common workflows

### "What trips do I have?"

```bash
mna trips list --json
```

Filter by status: append `--status=planning`, `--status=booked`, or `--status=completed`.

### "Show me details for trip X"

If the user gives a name or ambiguous reference, first run `mna trips list --json`
to find the matching ID, then `mna trips show <id> --json`.

## Output expectations

`--json` returns the raw server response. Schemas track
https://mynextadventure.cloud/v1/openapi.json — when in doubt, fetch that and
read the schema definitions for the endpoint you're about to call.
