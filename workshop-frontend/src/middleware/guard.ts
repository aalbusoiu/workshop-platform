// This function is to check if the user accessing a restricted page is logged in, on fail returns to /login.
// Example:
// <script setup lang="ts">
// definePageMeta({ requiresAuth: true, middleware: ['guard'] })
// </script>
import { getProfile, getToken } from '~/domains/auth'

export default defineNuxtRouteMiddleware(async (to) => {
    console.log(`[Guard] Running on: ${to.path}`)

    if (!to.meta.requiresAuth) {
        console.log('[Guard] No auth required, skipping.')
        return
    }

    if (!getToken()) {
        console.log('[Guard] No token found. Redirecting to /login.')
        return navigateTo('/login')
    }

    console.log('[Guard] Token found, validating profile...')
    try {
        await getProfile()
        console.log('[Guard] Profile validation successful.')
    } catch (error) {
        console.error('[Guard] Profile validation FAILED.', error)
        console.log('[Guard] Redirecting to /login.')
        return navigateTo('/login')
    }
})