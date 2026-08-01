import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { variantsAddCommand } from './add'
import { variantsEditCommand } from './edit'

type RunFn = (ctx: { args: Record<string, unknown> }) => Promise<void>
const runAdd = (args: Record<string, unknown>) =>
    (variantsAddCommand.run as unknown as RunFn)({ args })
const runEdit = (args: Record<string, unknown>) =>
    (variantsEditCommand.run as unknown as RunFn)({ args })

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

describe('variants add — date flags', () => {
    test('sends exact dates alongside the name', async () => {
        await runAdd({
            tripId: 't',
            name: 'Beach option',
            'start-date': '2026-09-01',
            'end-date': '2026-09-08',
            json: false,
        })

        expect(captured?.method).toBe('POST')
        expect(captured?.body).toEqual({
            name: 'Beach option',
            dates: {
                startDate: '2026-09-01T00:00:00.000Z',
                endDate: '2026-09-08T00:00:00.000Z',
            },
        })
    })

    test('sends flexi dates with numeric night bounds', async () => {
        await runAdd({
            tripId: 't',
            name: 'Flexible option',
            'depart-not-before': '2026-09-01',
            'depart-not-after': '2026-09-03',
            'return-not-before': '2026-09-10',
            'return-not-after': '2026-09-12',
            'min-nights': '7',
            'max-nights': '10',
            json: false,
        })

        expect(captured?.body).toEqual({
            name: 'Flexible option',
            dates: {
                departLeavingNotBeforeDate: '2026-09-01T00:00:00.000Z',
                departArrivingNotAfterDate: '2026-09-03T00:00:00.000Z',
                returnLeavingNotBeforeDate: '2026-09-10T00:00:00.000Z',
                returnArrivingNotAfterDate: '2026-09-12T00:00:00.000Z',
                minNights: 7,
                maxNights: 10,
            },
        })
    })
})

describe('variants edit — date flags', () => {
    test('omits dates when no date flag is given', async () => {
        await runEdit({ tripId: 't', variantId: 'v', name: 'Renamed', json: false })

        expect(captured?.method).toBe('PATCH')
        expect(captured?.body).toEqual({ name: 'Renamed' })
    })

    test('sends a complete dates object when the flags are given', async () => {
        await runEdit({
            tripId: 't',
            variantId: 'v',
            'start-date': '2026-09-02',
            'end-date': '2026-09-09',
            json: false,
        })

        expect(captured?.body).toEqual({
            dates: {
                startDate: '2026-09-02T00:00:00.000Z',
                endDate: '2026-09-09T00:00:00.000Z',
            },
        })
    })
})
