// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    srcDir: 'src',
    ssr: false,
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    css: ['@/assets/base.css'],
    modules: [
        '@nuxt/icon'
    ],
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api/v1'
        }
    },
    vite: {
        server: {
            proxy: {
                '/api': {
                    target: process.env.DEV_API_ORIGIN || 'http://127.0.0.1:3001',
                    changeOrigin: true,
                    secure: false
                }
            }
        }
    }
})