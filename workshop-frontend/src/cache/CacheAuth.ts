import TokenManager from '../core/auth/TokenManager'

/**
 * Thin adapter to source the current JWT for RequestManager.
 */
export default {
    /**
     * Return the in-memory JWT (or null).
     */
    getJwt(): string | null {
        return TokenManager.getToken()
    }
}