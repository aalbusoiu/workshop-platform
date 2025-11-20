const KEY = 'rgbi.jwt'

/**
 * Simple localStorage-backed token store.
 */
export default {
    /**
     * Read the persisted JWT (client-only).
     */
    get(): string | null {
        if (typeof window === 'undefined') return null
        return localStorage.getItem(KEY)
    },
    /**
     * Persist or clear the JWT (client-only).
     */
    set(token: string | null) {
        if (typeof window === 'undefined') return
        if (token) localStorage.setItem(KEY, token)
        else localStorage.removeItem(KEY)
    }
}