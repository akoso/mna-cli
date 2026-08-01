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

const MAX_RAW_BODY_DETAIL_LENGTH = 200
const FIRST_PRINTABLE_CHAR_CODE = 0x20

function joinMessage(value: unknown): string | undefined {
    if (typeof value === 'string') return value.trim() || undefined
    if (Array.isArray(value)) {
        const parts = value
            .filter((part): part is string => typeof part === 'string')
            .map((part) => part.trim())
            .filter(Boolean)
        return parts.length > 0 ? parts.join('; ') : undefined
    }
    return undefined
}

function isPrintable(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) < FIRST_PRINTABLE_CHAR_CODE) return false
    }
    return true
}

function printableRawBody(text: string): string | undefined {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > MAX_RAW_BODY_DETAIL_LENGTH || !isPrintable(trimmed)) {
        return undefined
    }
    return trimmed
}

function parseJsonBody(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

/**
 * Best-effort human-readable detail for a failed response. A body with nothing
 * usable in it — today's production `{statusCode, timestamp, path}`, a stripped
 * body, an HTML error page — yields undefined so the caller degrades to the
 * bare status line.
 */
function extractErrorDetail(body: unknown, rawText: string): string | undefined {
    if (body !== null && typeof body === 'object') {
        const { message, error } = body as { message?: unknown; error?: unknown }
        return joinMessage(message) ?? joinMessage(error)
    }
    return joinMessage(body) ?? printableRawBody(rawText)
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
                const rawText = await response
                    .clone()
                    .text()
                    .catch(() => '')
                const body = parseJsonBody(rawText)
                const detail = extractErrorDetail(body, rawText)
                const status = `HTTP ${response.status}`
                throw new ApiError(response.status, detail ? `${status} — ${detail}` : status, body)
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
