const TOKEN_KEY = 'rgbi_jwt'

function isBrowser() {
    return typeof window !== 'undefined'
}

export function getToken(): string | null {
    return isBrowser() ? window.localStorage.getItem(TOKEN_KEY) : null
}

export function setToken(token: string | null) {
    if (!isBrowser()) return
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
}

export function authHeaders(): Record<string, string> {
    const t = getToken()
    return t ? { Authorization: `Bearer ${t}` } : {}
}

export interface LoginResponse {
    access_token: string
    user: { id: number; email: string; role: string }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
    const base = useRuntimeConfig().public.apiBase || '/api'
    const res = await $fetch<LoginResponse>(`${base}/auth/login`, {
        method: 'POST',
        body: { email, password }
    })
    setToken(res.access_token)
    return res
}

export async function getProfile() {
    const base = useRuntimeConfig().public.apiBase || '/api'
    return $fetch(`${base}/auth/profile`, { headers: authHeaders() })
}

export async function logout() {
    const base = useRuntimeConfig().public.apiBase || '/api'
    try {
        await $fetch(`${base}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        })
    } finally {
        setToken(null)
    }
}