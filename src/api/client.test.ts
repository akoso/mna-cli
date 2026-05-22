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
