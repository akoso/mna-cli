import { mkdir, readFile, unlink, writeFile, chmod } from 'node:fs/promises'
import { dirname } from 'node:path'
import { credentialsPath } from '../util/xdg'

export interface Credentials {
    version: 1
    apiKey: string
    user: {
        id: string
        email: string
        name: string
    }
    apiBaseUrl: string
    createdAt: string
}

const CURRENT_VERSION = 1 as const

export async function loadCredentials(): Promise<Credentials | null> {
    try {
        const raw = await readFile(credentialsPath(), 'utf8')
        const parsed = JSON.parse(raw) as unknown
        if (!isCredentials(parsed)) {
            return null
        }
        return parsed
    } catch {
        return null
    }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
    const path = credentialsPath()
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await chmod(dirname(path), 0o700)
    await writeFile(path, `${JSON.stringify(creds, null, 2)}\n`, { mode: 0o600 })
    await chmod(path, 0o600)
}

export async function deleteCredentials(): Promise<void> {
    try {
        await unlink(credentialsPath())
    } catch {
        // already absent
    }
}

export function resolveApiKey(creds: Credentials | null): string | undefined {
    if (process.env.MNA_API_KEY?.trim()) {
        return process.env.MNA_API_KEY.trim()
    }
    return creds?.apiKey
}

export function resolveBaseUrl(creds: Credentials | null): string {
    return (
        process.env.MNA_API_BASE_URL?.trim() ||
        creds?.apiBaseUrl ||
        'https://api.mynextadventure.cloud'
    )
}

function isCredentials(value: unknown): value is Credentials {
    if (typeof value !== 'object' || value === null) return false
    const c = value as Partial<Credentials>
    return (
        c.version === CURRENT_VERSION &&
        typeof c.apiKey === 'string' &&
        typeof c.apiBaseUrl === 'string' &&
        typeof c.createdAt === 'string' &&
        typeof c.user === 'object' &&
        c.user !== null &&
        typeof c.user.id === 'string' &&
        typeof c.user.email === 'string' &&
        typeof c.user.name === 'string'
    )
}
