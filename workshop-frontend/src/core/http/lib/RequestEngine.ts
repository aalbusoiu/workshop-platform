import { useRuntimeConfig } from '#imports'
import { RequestCallbackHandler, type ResponseInfo } from '../RequestCallbackHandler'

/**
 * Low-level HTTP executor responsible for:
 * - Building absolute URLs from a public apiBase
 * - Injecting Authorization header when provided
 * - Normalizing responses to { status, json, headers }
 * - Invoking the appropriate RequestCallbackHandler hooks
 */
async function doFetch(
    method: string,
    path: string,
    handler: RequestCallbackHandler,
    jwt?: string,
    json?: object,
    formData?: FormData
) {
    const base = useRuntimeConfig().public.apiBase
    const url = path.startsWith('http') ? path : `${base}${path}`
    const headers: Record<string, string> = {}
    if (jwt) headers.Authorization = `Bearer ${jwt}`
    const body = formData ? formData : json != null ? JSON.stringify(json) : undefined
    if (!formData && json != null) headers['Content-Type'] = 'application/json'

    let status = 0
    try {
        const res = await fetch(url, { method, headers, body, credentials: 'include' })
        status = res.status
        const raw = await res.text()
        let data: any = null
        try {
            data = raw ? JSON.parse(raw) : null
        } catch {
            data = raw
        }
        const info: ResponseInfo = { status, json: data, headers: res.headers }
        if (res.ok) {
            handler.onSucceeded(info)
        } else if (status === 401) {
            handler.onUnauthorized(info)
        } else if (status === 409) {
            handler.on409(info)
        } else {
            handler.onFailed(status, info)
        }
        handler.onDestroy(status)
    } catch {
        handler.onFailed(status || 0)
        handler.onDestroy(status || 0)
    }
}

export default {
    get(path: string, handler: RequestCallbackHandler, jwt?: string) {
        return doFetch('GET', path, handler, jwt)
    },
    post(path: string, handler: RequestCallbackHandler, jwt?: string, json?: object) {
        return doFetch('POST', path, handler, jwt, json)
    },
    put(path: string, handler: RequestCallbackHandler, jwt?: string, json?: object, formData?: FormData) {
        return doFetch('PUT', path, handler, jwt, json, formData)
    },
    delete(path: string, handler: RequestCallbackHandler, jwt?: string, json?: object) {
        return doFetch('DELETE', path, handler, jwt, json)
    }
}