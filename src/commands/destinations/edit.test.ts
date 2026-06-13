import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { destinationsEditCommand } from './edit'

type RunFn = (ctx: { args: Record<string, unknown> }) => Promise<void>
const run = (args: Record<string, unknown>) =>
    (destinationsEditCommand.run as unknown as RunFn)({ args })

let originalFetch: typeof fetch
let originalKey: string | undefined
let captured: { method: string; body: unknown } | undefined

beforeEach(() => {
    originalFetch = global.fetch
    originalKey = process.env.MNA_API_KEY
    process.env.MNA_API_KEY = 'mna_test'
    captured = undefined
    global.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
        const req = input instanceof Request ? input : new Request(String(input), init)
        const text = await req.text()
        captured = { method: req.method, body: text ? JSON.parse(text) : undefined }
        return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
})

afterEach(() => {
    global.fetch = originalFetch
    process.env.MNA_API_KEY = originalKey
    if (originalKey === undefined) Reflect.deleteProperty(process.env, 'MNA_API_KEY')
})

describe('destinations edit — date flags', () => {
    test('maps --start-date / --end-date to ISO body fields and nothing else', async () => {
        await run({
            tripId: 't',
            variantId: 'v',
            destinationKey: 'd',
            'start-date': '2026-07-07',
            'end-date': '2026-07-15',
            json: false,
        })

        expect(captured?.method).toBe('PATCH')
        expect(captured?.body).toEqual({
            startDate: '2026-07-07T00:00:00.000Z',
            endDate: '2026-07-15T00:00:00.000Z',
        })
    })

    test('omits date keys when the flags are absent', async () => {
        await run({
            tripId: 't',
            variantId: 'v',
            destinationKey: 'd',
            place: 'Lisbon',
            json: false,
        })

        expect(captured?.body).toEqual({ destination: 'Lisbon' })
    })
})
