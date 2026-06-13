import { createApiClient } from '../api/client'
import { saveCredentials, type Credentials } from './credentials-store'
import { fetchIdentity } from './fetch-identity'

export interface PasteTokenLoginInput {
    apiKey: string
    apiBaseUrl: string
}

/**
 * Validates a pasted API key by fetching the key holder's identity from
 * GET /v1/me, then persists credentials with the real user info. If the key is
 * invalid, ApiError(401) bubbles up.
 */
export async function pasteTokenLogin(input: PasteTokenLoginInput): Promise<Credentials> {
    const client = createApiClient({ baseUrl: input.apiBaseUrl, apiKey: input.apiKey })

    const creds: Credentials = {
        version: 1,
        apiKey: input.apiKey,
        user: await fetchIdentity(client),
        apiBaseUrl: input.apiBaseUrl,
        createdAt: new Date().toISOString(),
    }

    await saveCredentials(creds)
    return creds
}
