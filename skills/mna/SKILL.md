---
name: mna
description: >-
  Plan and manage trips end-to-end on My Next Adventure via the `mna` CLI — create trips,
  compare variants, build destinations and travel legs, research and book real accommodation,
  cost transport, set dates and cancellation deadlines, and keep it all in sync. Use this
  whenever the user wants to plan, research, price, build, or manage a trip / vacation /
  itinerary on My Next Adventure (or mentions `mna`), even if they don't name the app — e.g.
  "help me plan our summer trip", "find a lakefront place near X", "add a stopover on the way",
  "compare these two hotels", "set up a few options to compare", "what's this trip costing".
  Also covers travel goals, collections, trip sharing, and group voting.
---

# Planning trips with My Next Adventure (`mna`)

`mna` is a CLI over the My Next Adventure API (`app.mynextadventure.cloud`). The app is the
**source of truth** for a trip. Your job is to drive it as a thoughtful travel-planning
partner: do the research and the arithmetic, keep the plan organized, and let the user make
the real calls.

## Bootstrap

Run `mna whoami` first. If it reports "Not logged in", ask the user to run `mna login`
themselves (browser consent) or `mna login --paste-token <key>` (key from the user menu →
API Keys on the site). **Always pass `--json`** so output is parseable.

## The data model (hold this in your head)

```
trip
└── variant            ← a whole-trip STRATEGY you compare (one is "selected")
    ├── destination    ← a place/leg, in travel order; one can be return-to-home
    │   ├── accommodation options   (one selected)   ← where you sleep
    │   ├── transport options       (one selected)   ← how you get TO this leg
    │   └── getting-around options  (one selected)   ← local mobility
    └── event           ← an activity/booking (optional)
```
Most things support multiple **options** so the user (and collaborators) can compare and vote;
exactly one per kind is **selected** and counts toward the plan. After any write, the response
is thin — **re-fetch `mna trips show <tripId> --json` to confirm it actually persisted.**

## How to work — the method

The *way of working* matters more than the commands. Internalize these principles, then follow
the playbook below.

1. **The app holds the plan; keep a local mirror.** Treat the trip in `mna` as source of truth,
   and also keep a lightweight `PLAN.md` in the working directory — IDs, decisions made, open
   questions, running totals. It's what lets you resume cleanly in a later session.
2. **Anchor on what exists.** Before creating anything, check `mna trips list --json` and/or ask
   — the user may already have the trip going. Don't spawn a duplicate.
3. **Brainstorm before building.** Nail who's going, exact dates, origin/return, the vibe, the
   budget band, and the non-negotiables — and let the *user* define the variant strategy. Don't
   invent structure they didn't ask for.
4. **Variants are comparable whole-trip strategies**, not tweaks — e.g. "single base the whole
   time" vs "stopover + base" vs "stopover + base + a different return stop". Fork a baseline
   with `variants duplicate`, then diverge.
5. **Recommend, don't enumerate.** Present 2–4 candidates with the *one trade-off that matters*
   and a clear pick — not an exhaustive menu. Reserve a hard question (or `AskUserQuestion`) for
   genuine forks: which stopover, which place, splurge vs value.
6. **Research real, bookable data.** Use a hotel connector for accommodation and **verify
   availability for the exact dates before recommending** (see
   `references/research-and-costing.md`). Never invent prices or "it's available".
7. **Cost with looked-up numbers, show the math.** Fuel prices, distances, nightly rates — look
   them up, compute, and state what's excluded (food, tolls, activities). No hand-waved figures.
8. **Be geography-aware.** Order legs to avoid backtracking, mark the return-home leg, and keep
   far-flung sights as day-trips rather than extra bases. Break long drives with a stopover.
9. **The user's edits are authoritative.** Manual price changes (e.g. a loyalty discount applied
   by hand), geocoded location fixes, spelling corrections — keep them, never "correct" them
   back to the scraped value. When you add an option, note that the real price may differ.
10. **Iterate as the brief sharpens.** Accommodation priorities shift mid-search ("actually,
    lakefront, calmer, with restaurants nearby"). Re-run the search against the new criteria
    rather than defending the old shortlist.
11. **Set precise, real data.** Exact coordinates, per-destination dates, free-cancellation
    deadlines — so the plan maps correctly and is genuinely actionable.

## The playbook

0. **Bootstrap** — `mna whoami`; everything `--json`.
1. **Frame & anchor** — confirm participants, exact dates, origin/return, vibe, budget, the main
   goal. Anchor on an existing trip (`trips list`) or `mna trips create --name "…"`.
2. **Shape variants with the user** — agree on 2–3 comparable strategies. The variant carries the
   trip's dates, and `mna variants add` requires them:
   `mna variants add <trip> --name "…" --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>`
   (or the six flexible-dates flags — see `references/cli-and-schemas.md`). Or
   `mna variants duplicate` to fork a baseline and then `variants edit` the notes.
3. **Lay out destinations** — add in travel order with dates:
   `mna destinations add <trip> <variant> --place "<City, Country>"
   --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> --notes "…"`. Mark the home leg with
   `--return-to-home`. Fix ordering with `mna destinations reorder … --order=k1,k2,k3`.
   For stopovers, research candidates, present with a recommendation, let the user pick.
4. **Transport per leg** — usually how you arrive at each destination (own car, train, flight).
   Cost it (look up fuel/fares; see the reference). Add via
   `mna options add … transport --from-json <file>` and `mna options select …`. Put the
   home-return drive on the return-to-home destination so totals stay clean.
5. **Accommodation per destination** — research with a hotel connector, present a curated spread
   (price tiers + location trade-offs + ratings) with a recommendation, **verify availability**,
   then add the shortlist (`options add … accommodation --from-json`), set the chosen one
   `options select …`, and set its exact location, `--free-cancellation-until`, and check-in/out
   dates. Replace stale placeholder options rather than piling new ones on top.
6. **Events** — only if the user wants them. The app is not a day-by-day itinerary planner and
   many users explicitly don't want that — ask, don't assume.
7. **Choose & total** — `mna variants select <trip> <variant>`; sum selected accommodation +
   transport; present the variant comparison with subtotals and what's excluded.
8. **Sync & verify** — update `PLAN.md`, and confirm every change with `mna trips show --json`.

## Writing options and events

Options and events are created from a JSON body (`--from-json <file>`). The exact field shapes,
the enums, the **nested-coordinates location requirement**, and the date/cancellation fields are
in **`references/cli-and-schemas.md`** — read it before building option/event bodies.

## Research and costing

How to drive a hotel connector (search → verify availability → map into an option), run
area/beachfront searches, and compute own-car fuel costs from looked-up prices live in
**`references/research-and-costing.md`**.

## Full command reference

The complete command map (auth, trips, variants, destinations, options, events, access/voting,
goals, collections) is in the repo `README.md`. When a body shape is unclear, fetch and read
`https://api.mynextadventure.cloud/v1/openapi.json` — it's the contract of record.
