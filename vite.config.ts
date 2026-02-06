import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      // 1. External API (Manual Activation)
      '/api/cdks': {
        target: 'https://freespaces.gmailshop.top',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      '/api/stocks': {
        target: 'https://freespaces.gmailshop.top',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      // 2. Local Backend (Admin API & Bot)
      '/api/subscriptions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  },
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
        output: {
            manualChunks: {
                vendor: ['react', 'react-dom', 'react-router-dom'],
                charts: ['recharts'],
                ui: ['lucide-react', 'clsx', 'tailwind-merge']
            }
        }
    }
  },
  plugins: [
    react({
      babel: {
        plugins: [
          // 'react-dev-locator', // Removed to clean up production build attributes
        ],
      },
    }),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'GPT Admin Panel',
        short_name: 'GPT Admin',
        description: 'Admin Panel for GPT Subscription Management',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
