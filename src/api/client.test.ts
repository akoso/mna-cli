import { describe, expect, test, beforeEach } from 'bun:test'
import { createApiClient } from './client'

describe('createApiClient', () => {
    let originalFetch: typeof fetch

    beforeEach(() => {
        originalFetch = global.fetch
    })

    test('injects X-API-Key header on every request', async () => {
        let capturedHeaders: Headers | undefined
        global.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
            const req = input instanceof Request ? input : new Request(String(input), init)
            capturedHeaders = req.headers
            return new Response(JSON.stringify({ trips: [] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }) as unknown as typeof fetch

        const client = createApiClient({
            baseUrl: 'https://api.example.invalid',
            apiKey: 'mna_live_test',
        })

        await client.GET('/v1/trips', {
            params: { query: { includeExample: false, status: 'planning' } },
        })

        expect(capturedHeaders?.get('x-api-key')).toBe('mna_live_test')

        global.fetch = originalFetch
    })

    test('tolerates an empty 201 body without throwing a JSON parse error', async () => {
        // Option-creation endpoints return 201 with no body and no Content-Length:0,
        // which makes openapi-fetch's default JSON parser throw. The client should
        // normalize this to undefined data instead.
        global.fetch = (async () => new Response(null, { status: 201 })) as unknown as typeof fetch

        const client = createApiClient({
            baseUrl: 'https://api.example.invalid',
            apiKey: 'mna_live_test',
        })

        const { data, error } = await client.POST(
            '/v1/trips/{id}/variants/{variantId}/destinations/{destinationKey}/options/accommodation',
            {
                params: { path: { id: 't', variantId: 'v', destinationKey: 'd' } },
                body: {} as never,
            },
        )

        expect(error).toBeUndefined()
        expect(data).toBeUndefined()

        global.fetch = originalFetch
    })

    async function failingRequest(response: Response): Promise<Error> {
        global.fetch = (async () => response.clone()) as unknown as typeof fetch

        const client = createApiClient({
            baseUrl: 'https://api.example.invalid',
            apiKey: 'mna_live_test',
        })

        try {
            await client.GET('/v1/trips', {
                params: { query: { includeExample: false, status: 'planning' } },
            })
            throw new Error('expected the request to reject')
        } catch (err) {
            return err as Error
        } finally {
            global.fetch = originalFetch
        }
    }

    const jsonResponse = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

    test('surfaces a string message from the error body', async () => {
        const err = await failingRequest(
            jsonResponse({ statusCode: 400, message: 'location.coordinates must be { lat, lng }' }, 400),
        )

        expect(err.message).toBe('HTTP 400 — location.coordinates must be { lat, lng }')
    })

    test('joins an array of validation messages with "; "', async () => {
        const err = await failingRequest(
            jsonResponse({ statusCode: 400, message: ['startDate must be a date', 'name should not be empty'] }, 400),
        )

        expect(err.message).toBe('HTTP 400 — startDate must be a date; name should not be empty')
    })

    test('falls back to the `error` field when there is no message', async () => {
        const err = await failingRequest(jsonResponse({ statusCode: 409, error: 'Conflict' }, 409))

        expect(err.message).toBe('HTTP 409 — Conflict')
    })

    test('uses a short printable non-JSON body as the detail', async () => {
        const err = await failingRequest(new Response('Bad Gateway', { status: 502 }))

        expect(err.message).toBe('HTTP 502 — Bad Gateway')
    })

    test('ignores a long or unprintable non-JSON body', async () => {
        const html = `<html>\n<body>${'x'.repeat(500)}</body>\n</html>`
        const err = await failingRequest(new Response(html, { status: 503 }))

        expect(err.message).toBe('HTTP 503')
    })

    test('degrades to the bare status line on an empty body', async () => {
        const err = await failingRequest(new Response(null, { status: 400 }))

        expect(err.message).toBe('HTTP 400')
    })

    test('degrades to the bare status line on a message-less body', async () => {
        const err = await failingRequest(
            jsonResponse({ statusCode: 400, timestamp: '2026-07-28T00:00:00.000Z', path: '/v1/trips' }, 400),
        )

        expect(err.message).toBe('HTTP 400')
    })

    test('never renders undefined for a bare 500', async () => {
        const err = await failingRequest(
            jsonResponse({ statusCode: 500, timestamp: '2026-07-28T00:00:00.000Z', path: '/v1/trips' }, 500),
        )

        expect(err.message).toBe('HTTP 500')
        expect(err.message).not.toContain('undefined')
    })

    test('throws ApiError with status + body on non-2xx', async () => {
        global.fetch = (async () => {
            return new Response(JSON.stringify({ message: 'API key is missing' }), {
                status: 401,
                headers: { 'content-type': 'application/json' },
            })
        }) as unknown as typeof fetch

        const client = createApiClient({
            baseUrl: 'https://api.example.invalid',
            apiKey: '',
        })

        await expect(
            client.GET('/v1/trips', {
                params: { query: { includeExample: false, status: 'planning' } },
            }),
        ).rejects.toMatchObject({
            status: 401,
            message: expect.stringContaining('API key is missing'),
        })

        global.fetch = originalFetch
    })
})
