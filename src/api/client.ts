import createOpenApiFetch, { type Middleware } from 'openapi-fetch'
import type { paths } from './generated/schema'

export type Api = ReturnType<typeof createOpenApiFetch<paths>>

export interface CreateApiClientOptions {
    baseUrl: string
    apiKey: string
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly body: unknown,
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

export function createApiClient({ baseUrl, apiKey }: CreateApiClientOptions): Api {
    const client = createOpenApiFetch<paths>({ baseUrl })

    const apiKeyMiddleware: Middleware = {
        onRequest({ request }) {
            request.headers.set('X-API-Key', apiKey)
            return request
        },
        async onResponse({ response }) {
            if (!response.ok) {
                const body = await response.clone().json().catch(() => undefined)
                const message =
                    (body as { message?: string } | undefined)?.message ?? `HTTP ${response.status}`
                throw new ApiError(response.status, message, body)
            }

            // Some endpoints (e.g. option creation) return a 2xx with an empty body and
            // no `Content-Length: 0`, which makes openapi-fetch's JSON parser throw
            // "Failed to parse JSON". Normalize empty success bodies so the parser
            // yields `data: undefined` instead of crashing the command.
            const text = await response.clone().text()
            if (text.trim() === '') {
                const headers = new Headers(response.headers)
                headers.set('Content-Length', '0')
                return new Response(null, {
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                })
            }
            return response
        },
    }

    client.use(apiKeyMiddleware)
    return client
}
