export default defineNuxtConfig({
    future: {
        compatibilityVersion: 4,
    },
    modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
    runtimeConfig: {
        public: {
        apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000'
        }
    },
    compatibilityDate: '2025-01-01'
});
