import type { Api } from '../api/client'
import type { Credentials } from './credentials-store'

/**
 * Fetch the identity of the API key holder from GET /v1/me and map it into the
 * stored credentials shape. Doubles as a key-validity check: an invalid key
 * makes the client throw an ApiError(401).
 */
export async function fetchIdentity(client: Api): Promise<Credentials['user']> {
    const { data, error } = await client.GET('/v1/me')
    if (error) throw new Error(`Failed to fetch identity: ${JSON.stringify(error)}`)
    if (!data) throw new Error('No identity returned by /v1/me.')

    return {
        id: data.userId,
        email: data.email ?? 'unknown@local',
        name: data.name ?? 'CLI user',
    }
}
