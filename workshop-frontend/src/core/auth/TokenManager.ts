import TokenStore from './TokenStore'

type TokenStatus = 'INVALID' | 'ENDING' | 'VALID'

let token: string | null = null
let expMs = 0
let refreshFn: null | (() => Promise<string | null>) = null
let refreshing = false

/**
 * Decode the JWT payload expiration (ms) from a base64url token.
 */
function decodeExpMs(t: string | null): number {
    if (!t) return 0
    const parts = t.split('.')
    if (parts.length < 2 || !parts[1]) return 0
    try {
        const b64url = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = b64url.padEnd(Math.ceil(b64url.length / 4) * 4, '=')
        if (typeof atob !== 'function') return 0
        const payload = JSON.parse(atob(padded) as string)
        const exp = typeof payload.exp === 'number' ? payload.exp : 0
        return exp * 1000
    } catch {
        return 0
    }
}

export default {
    /**
     * Provide an async function that returns a refreshed JWT (or null on failure).
     */
    configureRefresh(executor: () => Promise<string | null>) {
        refreshFn = executor
    },
    /**
     * Load token from storage into memory and compute its expiration.
     */
    loadFromStore() {
        const t = TokenStore.get()
        token = t
        expMs = decodeExpMs(t)
    },
    /**
     * Set a new token (persist + recompute expiration). Pass null to clear.
     */
    setToken(t: string | null) {
        token = t
        expMs = decodeExpMs(t)
        TokenStore.set(t)
    },
    /**
     * Return the current JWT (or null).
     */
    getToken(): string | null {
        return token
    },
    /**
     * Get a coarse token status: VALID / ENDING (less than threshold) / INVALID.
     */
    getStatus(thresholdMs = 60_000): TokenStatus {
        if (!token || !expMs) return 'INVALID'
        const remaining = expMs - Date.now()
        if (remaining <= 0) return 'INVALID'
        if (remaining < thresholdMs) return 'ENDING'
        return 'VALID'
    },
    /**
     * Attempt to refresh the JWT using the configured refresh function.
     * Returns true if a new token was obtained.
     */
    async requestRefresh(): Promise<boolean> {
        if (!refreshFn) return false
        if (refreshing) return false
        refreshing = true
        try {
            const newToken = await refreshFn()
            if (newToken) this.setToken(newToken)
            return Boolean(newToken)
        } finally {
            refreshing = false
        }
    }
}