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
            return response
        },
    }

    client.use(apiKeyMiddleware)
    return client
}
