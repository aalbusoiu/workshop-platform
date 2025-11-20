import type { ResponseInfo } from '~/core/http/RequestCallbackHandler'
import RequestManager, { RequestCallbackHandlerManaged } from '~/core/http/RequestManager'
import TokenManager from '~/core/auth/TokenManager'

type JoinOk = { participantId: number; sessionId: number; token: string; expiresAt: string }
type CreateOk = any

/**
 * Join a session using a short code and optional participant fields.
 * On success, the participant JWT is stored in TokenManager.
 *
 * @param code - The workshop/session short code (e.g., "KGPBC").
 * @param colorHex - Participant color in the form "#RRGGBB".
 * @param displayName - Optional participant display name.
 * @returns A promise resolving to the join payload with participant and session identifiers and a JWT.
 */
export function joinSession(code: string, colorHex: string, displayName?: string): Promise<JoinOk> {
    return new Promise((resolve, reject) => {
        class H extends RequestCallbackHandlerManaged {
            override onSucceeded(r: ResponseInfo) {
                const t = r.json?.token as string | undefined
                if (t) TokenManager.setToken(t)
                resolve(r.json as JoinOk)
            }
            override on409() {
                reject(new Error('Session is full.'))
            }
            override onFailed(status: number, r?: ResponseInfo) {
                if (status === 0) {
                    reject(new Error("Couldn't establish the connection. Try again in a moment."))
                    return
                }
                if (status === 404) {
                    reject(new Error(`Session ${code} does not exist.`))
                    return
                }
                const msg = extractNestMessage(r?.json) || 'Join failed.'
                reject(new Error(msg))
            }
        }
        RequestManager.post('/sessions/join', new H(), { code, colorHex, ...(displayName ? { displayName } : {}) })
    })
}

/**
 * Create a new session (moderator-only).
 *
 * @param maxParticipants - Optional maximum number of participants for the session. If omitted, backend default applies.
 * @returns A promise resolving to the backend response describing the created session.
 */
export function createSession(maxParticipants?: number): Promise<CreateOk> {
    return new Promise((resolve, reject) => {
        class H extends RequestCallbackHandlerManaged {
            override onSucceeded(r: ResponseInfo) { resolve(r.json as CreateOk) }
            override onUnauthorized() { reject(new Error('Unauthorized. Login required.')) }
            override onFailed(status: number, r?: ResponseInfo) {
                const msg = status === 0
                    ? "Couldn't establish the connection. Try again in a moment."
                    : extractNestMessage(r?.json) || 'Create session failed.'
                reject(new Error(msg))
            }
        }
        const body = maxParticipants == null ? {} : { maxParticipants }
        RequestManager.post('/sessions', new H(), body)
    })
}

/**
 * Clear any locally stored participant token.
 *
 * @returns Nothing. Side-effect: removes JWT from memory and storage.
 */
export function leaveLocal() {
    TokenManager.setToken(null)
}

/**
 * Extract a friendly message from typical NestJS error shapes.
 * Supports:
 *  - { message: "string" }
 *  - { message: ["a","b"] }
 *  - { error: "string", statusCode: number }
 *  - arbitrary strings
 */
function extractNestMessage(payload: any): string | null {
    if (!payload) return null
    if (typeof payload === 'string') return payload
    if (typeof payload.message === 'string') return payload.message
    if (Array.isArray(payload.message)) return payload.message.join('; ')
    if (typeof payload.error === 'string') return payload.error
    return null
}