import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

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
  },
  plugins: [
    react({
      babel: {
        plugins: [
          // 'react-dev-locator', // Removed to clean up production build attributes
        ],
      },
    }),
    tsconfigPaths()
  ],
})
