# Research & costing: real accommodation and honest numbers

The plans that land are the ones built on real, bookable data and looked-up costs.

## Accommodation research

If a hotel-search connector is available, use it — a Booking.com MCP tool
(`accommodations_search`) is a good option when present, and Expedia / Tripadvisor connectors
work too. If none is available, fall back to web search and the property's own page. Whatever
the source, the workflow is the same:

1. **Search each destination with the real constraints:**
   - check-in / check-out = that destination's exact nights *for that variant* — a short base and
     a long base return different prices and availability.
   - adults + **children ages** — kids' ages change room eligibility and price.
   - currency = the user's home currency so totals are comparable.
   - require a kitchen when needed (filter to apartments / holiday homes).
   - hard requirements as filters (free parking, beachfront).
   - a price ceiling and type/photo filters to shape the spread.
2. **For location-specific asks** — on the water, by the lifts, near the trailhead, walkable to
   the old town — search that area by name or by coordinates (lat/lng + radius) with the matching
   filter. A generic city-wide search buries exactly the places they asked for.
3. **Present a curated spread, not the raw list** — typically a value pick, a proven/most-reviewed
   pick, and a splurge/location pick. For each: nightly + total, rating *and review count*, and
   the one location trade-off (central vs waterfront, walkable vs needs-the-car). Give a clear
   recommendation tied to the user's stated priorities.
4. **Verify availability for the exact dates before recommending or adding.** Re-query the
   specific properties by name for the real check-in/out. Search ranking can hide an available
   place, and a place that showed up for a long stay may be unavailable for a shorter window. If a
   by-name availability check returns nothing, it's genuinely gone — drop it. This distinguishes
   "ranked out of the list" from "actually unavailable".
5. **Map the chosen places into accommodation options** (`options add … accommodation --from-json`)
   with the quoted total, the exact location, `sourceUrl`, and the listing's own metadata —
   `externalRating` (score **plus its scale** and review count), `features`, `description`, `url`,
   `imageUrl` — then `options select` the pick and set `--free-cancellation-until` + check-in/out.
   Only `notes` is free text; everything with a field goes in its field.

Reviews: weight **review count**, not just score — a 10/10 from 4 reviews is far less proven than
a 9.7 from 240. Flag thin-review places as such. Keep each score in the scale its source published
it in (`scale: 10` for Booking.com, `5` for Google) and never convert between them.
When mapping facilities, `privateKitchen` means a kitchen in the unit; a property-level
"Shared kitchen" is `sharedKitchen` and is not what a user asking for a kitchen wants.

## Costing own-car transport (fuel)

The user usually just wants the fuel number. Do it honestly:

1. **Look up current fuel prices** for the *jurisdictions the route passes through* — countries,
   or states/provinces where fuel is taxed locally — for the right grade. Don't assume.
2. **Route-weight** them — most of a long drive may be in one of them; weight by rough distance
   share.
3. **Convert to the user's currency** (look up the FX rate) and work in the units they use.
4. **Fuel = distance × consumption × price.** Metric: `km × (L/100km ÷ 100) × price_per_L`.
   US customary: `miles ÷ mpg × price_per_gallon`. Use the consumption figure the user gives.
   Compute per leg; attach each leg's fuel to its destination's transport option; fold the
   home-return drive into the return-to-home leg.
5. **State what's excluded** — tolls and road-use charges, ferries, parking — unless asked to
   include them.

For other modes (train, flights), price the actual fares from a connector or the carrier, not a
guess, and note the class/conditions.

## Honoring the user's own numbers

If the user hand-edits a price (a loyalty discount such as a booking-site membership often makes
their real rate lower than the public quote) or fixes a location/spelling, that value is
authoritative — don't revert it on the next sync. When you add a freshly-searched option, note
that the public price may be higher than what they'll actually pay.

## Keep a local PLAN.md

Mirror the app into a `PLAN.md` in the working dir: the trip/variant/destination IDs, the chosen
options with prices, running totals, decisions made, and open questions. It's cheap and it's what
makes a multi-session plan resumable.
