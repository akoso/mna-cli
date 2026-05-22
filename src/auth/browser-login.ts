import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { hostname } from 'node:os'
import { spawn } from 'node:child_process'
import { saveCredentials, type Credentials } from './credentials-store'

const TIMEOUT_MS = 5 * 60 * 1000
const PORT_MIN = 1024
const PORT_MAX = 65535

export interface BrowserLoginInput {
    apiBaseUrl: string
    webAppBaseUrl: string
    /** Hook for tests — falsy in production. */
    openBrowser?: (url: string) => void
    /** Hook for tests — falsy in production. */
    now?: () => number
}

export interface BrowserLoginOutput {
    credentials: Credentials
    consentUrl: string
}

/**
 * Browser-mediated login. Starts a loopback HTTP server, opens the user's
 * browser to the consent page, and waits up to 5 minutes for the redirect.
 */
export async function browserLogin(input: BrowserLoginInput): Promise<BrowserLoginOutput> {
    const state = randomBytes(24).toString('base64url')
    const name = sanitizeHostname(hostname())
    const open = input.openBrowser ?? defaultOpenBrowser

    const { port, gotCallback } = await listenForCallback(state)

    // Validate the port we ended up on
    if (port < PORT_MIN || port > PORT_MAX) {
        throw new Error(`Unexpected port ${port} (must be in ${PORT_MIN}-${PORT_MAX})`)
    }

    const consentUrl = `${input.webAppBaseUrl.replace(/\/$/, '')}/cli-auth?state=${encodeURIComponent(state)}&port=${port}&name=${encodeURIComponent(name)}`
    open(consentUrl)

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const { apiKey } = await Promise.race([
        gotCallback,
        new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
                () => reject(new Error('Timed out waiting for browser approval (5 minutes).')),
                TIMEOUT_MS,
            )
        }),
    ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle)
    })

    const credentials: Credentials = {
        version: 1,
        apiKey,
        user: { id: 'unknown', email: 'unknown@local', name: 'CLI user' },
        apiBaseUrl: input.apiBaseUrl,
        createdAt: new Date().toISOString(),
    }
    await saveCredentials(credentials)
    return { credentials, consentUrl }
}

interface CallbackListener {
    port: number
    gotCallback: Promise<{ apiKey: string }>
}

async function listenForCallback(expectedState: string): Promise<CallbackListener> {
    return new Promise((resolve, reject) => {
        let resolveCallback!: (value: { apiKey: string }) => void
        let rejectCallback!: (err: Error) => void
        const gotCallback = new Promise<{ apiKey: string }>((res, rej) => {
            resolveCallback = res
            rejectCallback = rej
        })

        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
            try {
                if (!req.url) throw new Error('Empty request URL')
                const url = new URL(req.url, 'http://127.0.0.1')
                if (url.pathname !== '/cb') {
                    res.statusCode = 404
                    res.end()
                    return
                }
                const state = url.searchParams.get('state')
                const key = url.searchParams.get('key')
                if (state !== expectedState) {
                    res.statusCode = 400
                    res.end('Invalid state — mismatched approval. Close this tab and retry `mna login`.')
                    rejectCallback(new Error('Callback state mismatch — possible CSRF or stale tab.'))
                    return
                }
                if (!key) {
                    res.statusCode = 400
                    res.end('Missing key parameter.')
                    rejectCallback(new Error('Callback missing key parameter.'))
                    return
                }
                res.statusCode = 200
                res.setHeader('content-type', 'text/html; charset=utf-8')
                res.end('<html><body><h2>✓ Approved. You can close this tab.</h2></body></html>')
                resolveCallback({ apiKey: key })
            } finally {
                server.close()
            }
        })

        server.listen({ host: '127.0.0.1', port: 0 }, () => {
            const address = server.address()
            if (!address || typeof address === 'string') {
                reject(new Error('Could not determine loopback port'))
                return
            }
            resolve({ port: address.port, gotCallback })
        })

        server.on('error', reject)
    })
}

function sanitizeHostname(h: string): string {
    return h.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64) || 'cli'
}

function defaultOpenBrowser(url: string): void {
    const platform = process.platform
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref()
}
