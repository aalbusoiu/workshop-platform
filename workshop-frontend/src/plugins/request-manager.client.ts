import RequestManager from '~/core/http/RequestManager'
import TokenManager from '~/core/auth/TokenManager'

/**
 * Nuxt plugin: boot the RequestManager and configure token refresh.
 */
export default defineNuxtPlugin(() => {
    RequestManager.init()
    // TODO: Configure later when refresh token exists.
    TokenManager.configureRefresh(async () => {
        return null
    })
})