# CLI map, JSON body shapes, and gotchas

Read this when you're building option/event bodies or need the exact command for a mutation.
The repo `README.md` has the exhaustive table; this file is the planning-focused subset plus
the field shapes you can't guess. Examples below use neutral placeholders.

## Command quick-map (all support `--json`)

```
trips        list | show <id> [--all-options] | create --name | edit <id> | delete <id> | share | unshare
variants     add <trip> --name <dates…> [--notes] | duplicate <trip> <var>
             edit <trip> <var> [--name --notes <dates…>] | select <trip> <var> | delete
destinations add <trip> <var> --place [--start-date --end-date --notes --return-to-home]
             edit <trip> <var> <destKey> [--place --notes --start-date --end-date --return-to-home/--no-…]
             reorder <trip> <var> --order=k1,k2,k3 | delete <trip> <var> <destKey>
options      add <trip> <var> <destKey> <kind> --from-json <file> [--free-cancellation-until <date>]
             edit <trip> <var> <destKey> <kind> <optKey> [--from-json <file>] [--free-cancellation-until <date>]
             select <trip> <var> <destKey> <kind> <optKey> | deselect <trip> <var> <destKey> <kind>
             delete <trip> <var> <destKey> <kind> <optKey>
events       add <trip> <var> --from-json <file> | edit <trip> <var> <eventKey> --from-json
             toggle <trip> <var> <eventKey> | delete <trip> <var> <eventKey>
access/vote  access list|invite|set-role|revoke|*-invite-link ; vote option|event ; votes list
goals        list|show|add|quick-add|edit|delete|link-trip|unlink-trip|mark-visited|mark-dreaming
collections  list|show|create|edit|delete|add-goal|remove-goal|share|open-shared
```

`<kind>` is one of `accommodation | transport | getting-around`.

## Option JSON bodies (`--from-json`)

### accommodation
```json
{
  "name": "Seaside Apartment",
  "type": "apartment",                          // hotel|hostel|apartment|house|camping|other
  "totalCost": 1200, "currency": "EUR",
  "location": { ...see "Location shape" below... },
  "roomDetails": { "numberOfRooms": 1 },        // optional: sizeInM2
  "sourceUrl": "https://…",
  "notes": "9.7 (240 reviews). Beachfront, kitchen, free parking.",
  "checkIn": "2026-07-07T12:00:00.000Z",        // ISO date-time
  "checkOut": "2026-07-15T12:00:00.000Z",
  "freeCancellationUntil": "2026-07-02T12:00:00.000Z"
}
```
`checkIn`/`checkOut`/`checkInTime`/`checkOutTime`/`freeCancellationUntil` can also be set with
`options edit … --free-cancellation-until <date>` (accommodation only) without a JSON file.

### transport
```json
{
  "transportType": "car",                       // car|plane|train|bus|ship|motorbike|bike|other
  "roundTrip": false,
  "totalCost": 120, "currency": "EUR",
  "from": { ...location... }, "to": { ...location... },
  "departAt": "2026-07-05T08:00", "arriveAt": "2026-07-05T11:00",
  "durationHours": 3, "durationMinutes": 0,
  "notes": "Own car, ~250 km. Fuel only."
}
```
Model each leg as the trip *into* a destination; attach it to that destination. Put the final
home-return drive on the `--return-to-home` destination so the per-variant total is clean.

### getting-around
```json
{ "type": "ownCar", "totalCost": 0, "currency": "EUR", "notes": "Own car throughout." }
```
`type`: walk|publicTransport|rideShare|ownCar|rentalCar|ownMotor|rentalMotor|bike|rentalBike|other.

### event (variant-level, `events add`)
```json
{ "name": "City walking tour", "start": "2026-07-06T10:00", "end": "2026-07-06T13:00",
  "totalCost": 0, "currency": "EUR", "link": "…", "notes": "…",
  "location": { "name": "Old Town", "formattedAddress": "…", "coordinates": { "lat": 0.0, "lng": 0.0 } } }
```

## Location shape — a non-obvious gotcha

For accommodation/transport `location`, the OpenAPI advertises flat `address` / `latitude` /
`longitude` — **but the API drops those silently.** Only `name` persists from the flat form.
Coordinates persist **only** when sent nested:

```json
"location": {
  "name": "Seaside Apartment",
  "formattedAddress": "<full address>, <City>, <Country>",
  "coordinates": { "lat": 0.000000, "lng": 0.000000 }
}
```
Coordinate keys are `lat`/`lng` **everywhere, including event locations** — an event body with
`coordinates.latitude`/`.longitude` is a 500, not a silent drop (verified against production).
Get exact coordinates from the search result, or geocode the address (e.g. OpenStreetMap
Nominatim). After setting, **verify with `trips show`** — never trust the 2xx alone.

## Dates

`destinations --start-date/--end-date`, accommodation `checkIn/checkOut/freeCancellationUntil`,
and event `start/end` are all ISO date-time. Accept `YYYY-MM-DD` from the user and normalize.
Using `T12:00:00.000Z` (noon UTC) avoids timezone off-by-one on the displayed calendar date.

### Variant dates — required on create

The variant is what carries the trip's dates, and the API refuses to store one without them.
`variants add` takes one of two complete shapes; a half-filled or mixed set is rejected locally:

```bash
mna variants add <trip> --name "Beach option" --start-date 2026-09-01 --end-date 2026-09-08
mna variants add <trip> --name "Flexible option" \
  --depart-not-before 2026-09-01 --depart-not-after 2026-09-03 \
  --return-not-before 2026-09-10 --return-not-after 2026-09-12 \
  --min-nights 7 --max-nights 10
```

`variants edit` takes the same flags; leave them off and the existing dates stay untouched.
Switching a variant between the two shapes is just an edit with the other flag set.

## Verify-after-write

Mutation responses are intentionally thin (often just the new key). Confirm the state with
`mna trips show <tripId> --json` and parse the field you changed. This is the reliable way to
catch a silently-dropped field or an accidental duplicate create.

## Auth / config

Header is `X-API-Key` (handled by the CLI). Creds live at `~/.config/mna/credentials`
(`XDG_CONFIG_HOME` overrides). `MNA_API_KEY` / `MNA_API_BASE_URL` env vars override for CI/dev.
