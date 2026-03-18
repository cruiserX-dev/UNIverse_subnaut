import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mewtual',
        short_name: 'Mewtual',
        description: 'Student to Student Network — Marketplace, Ride Pool & Clubs',
        theme_color: '#1C1917',
        background_color: '#FAF8F5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
  {
    src: 'icon-192.png',
    sizes: '192x192',
    type: 'image/png'
  },
  {
    src: 'icon-512.png',
    sizes: '512x512',
    type: 'image/png'
  }
]
      }
    })
  ],
})