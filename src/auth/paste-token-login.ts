import { createApiClient } from '../api/client'
import { saveCredentials, type Credentials } from './credentials-store'

export interface PasteTokenLoginInput {
    apiKey: string
    apiBaseUrl: string
}

/**
 * Validates a pasted API key by hitting GET /v1/trips (the only authenticated
 * read endpoint available today). On success, persists credentials with a
 * placeholder user (real user info will be filled in by `mna whoami --verify`
 * once Phase 1 ships GET /v1/me).
 */
export async function pasteTokenLogin(input: PasteTokenLoginInput): Promise<Credentials> {
    const client = createApiClient({ baseUrl: input.apiBaseUrl, apiKey: input.apiKey })

    // Sanity-check the key. If it's invalid, ApiError(401) bubbles up.
    // The /v1/trips endpoint requires query params per the OpenAPI schema;
    // pass empty values to satisfy the type-checker.
    await client.GET('/v1/trips', { params: { query: { includeExample: false } as never } })

    const creds: Credentials = {
        version: 1,
        apiKey: input.apiKey,
        user: {
            id: 'unknown',
            email: 'unknown@local',
            name: 'CLI user',
        },
        apiBaseUrl: input.apiBaseUrl,
        createdAt: new Date().toISOString(),
    }

    await saveCredentials(creds)
    return creds
}
