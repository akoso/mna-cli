import { homedir } from 'node:os'

/**
 * Everything the client registry needs to know about the machine. Bundled into
 * one object so tests can point detection at a fake home directory without
 * mutating process-wide state beyond what they control.
 */
export interface HostEnv {
    home: string
    platform: NodeJS.Platform
    cwd: string
    /** %APPDATA% on Windows; unused elsewhere. */
    appData?: string
}

export function hostEnv(overrides: Partial<HostEnv> = {}): HostEnv {
    return {
        home: process.env.HOME?.trim() || homedir(),
        platform: process.platform,
        cwd: process.cwd(),
        appData: process.env.APPDATA,
        ...overrides,
    }
}
