# CLI map, JSON body shapes, and gotchas

Read this when you're building option/event bodies or need the exact command for a mutation.
The repo `README.md` has the exhaustive table; this file is the planning-focused subset plus
the field shapes you can't guess. Examples below use neutral placeholders.

## Command quick-map (all support `--json`)

```
trips        list | show <id> [--all-options] | create --name | edit <id> | delete <id> | share | unshare
variants     add <trip> --name | duplicate <trip> <var> | edit <trip> <var> | select <trip> <var> | delete
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
  "externalRating": { "score": 9.7, "scale": 10, "count": 240, "source": "booking.com" },
  "features": ["beachfront", "privateKitchen", "freeParking"],
  "description": "Top-floor flat with a sea-facing terrace.",
  "url": "https://…",                           // the listing / property site
  "imageUrl": "https://…",                      // hotlinked photo, not copied
  "sourceUrl": "https://…",
  "notes": "Owner replies within the hour; parking is a shared yard.",
  "checkIn": "2026-07-07T12:00:00.000Z",        // ISO date-time
  "checkOut": "2026-07-15T12:00:00.000Z",
  "freeCancellationUntil": "2026-07-02T12:00:00.000Z"
}
```
`checkIn`/`checkOut`/`checkInTime`/`checkOutTime`/`freeCancellationUntil` can also be set with
`options edit … --free-cancellation-until <date>` (accommodation only) without a JSON file.
Everything else goes through `--from-json`, on both `options add` and `options edit`.

`externalRating.scale` is **required whenever `score` is set** — Booking.com publishes out of 10,
Google out of 5. Store both and quote the pair (`9.7/10`); never normalise or compare across scales.

`features` (all optional, use only what the listing actually states):
`beachfront`, `beachNearby`, `privateBeachArea`, `swimmingPool`, `kidsPool`, `kidsPlayArea`,
`privateKitchen`, `sharedKitchen`, `washingMachine`, `familyRooms`, `airConditioning`,
`freeParking`, `freeWifi`, `balconyTerrace`, `petsAllowed`.
`privateKitchen` and `sharedKitchen` are different things: Booking lists "Shared kitchen" at
property level, which is not what a user means by "an apartment with a kitchen".

Put ratings and facilities in these fields rather than in `notes` — `mna trips show` renders them,
and `notes` should carry what no field covers. `type` and `roomDetails` come back on read too.

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
  "location": { "name": "Old Town", "formattedAddress": "…", "coordinates": { "latitude": 0.0, "longitude": 0.0 } } }
```

## Location shape — a non-obvious gotcha

Option locations are **written flat and read back nested**. Send `address` / `latitude` /
`longitude`; a nested `formattedAddress` + `coordinates` object is silently dropped and only
`name` survives (verified against production on both `options add` and `options edit`):

```json
"location": {
  "name": "Seaside Apartment",
  "address": "<full address>, <City>, <Country>",
  "latitude": 0.000000,
  "longitude": 0.000000,
  "locationiqPlaceId": "…"
}
```
`trips show` returns the same place as `formattedAddress` + `coordinates.lat`/`.lng` — that's the
read shape, not something to echo back on a write. `locationiqPlaceId` (and `googlePlaceId`)
round-trip, so pass whichever your geocoder gave you and the app can re-resolve the place later.
`location` is **replaced wholesale**, never merged: a partial `location` in an `options edit` body
clears whatever you left out. Get exact coordinates from the search result, or geocode the address
(e.g. OpenStreetMap Nominatim). After setting, **verify with `trips show`** — never trust the 2xx
alone. **Event** locations are a different DTO and do take nested `coordinates`.

## Dates

`destinations --start-date/--end-date`, accommodation `checkIn/checkOut/freeCancellationUntil`,
and event `start/end` are all ISO date-time. Accept `YYYY-MM-DD` from the user and normalize.
Using `T12:00:00.000Z` (noon UTC) avoids timezone off-by-one on the displayed calendar date.

## Verify-after-write

Mutation responses are intentionally thin (often just the new key). Confirm the state with
`mna trips show <tripId> --json` and parse the field you changed. This is the reliable way to
catch a silently-dropped field or an accidental duplicate create.

## Auth / config

Header is `X-API-Key` (handled by the CLI). Creds live at `~/.config/mna/credentials`
(`XDG_CONFIG_HOME` overrides). `MNA_API_KEY` / `MNA_API_BASE_URL` env vars override for CI/dev.
