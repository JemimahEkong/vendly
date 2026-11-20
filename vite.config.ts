import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Always load env files from this config's project root, not the shell's cwd.
  // `envDir` is explicit below for the same reason: a server started from a
  // different working directory must still see .env.local.
  const envDir = path.resolve(__dirname);
  const env = loadEnv(mode, envDir, '');

  return {
  root: envDir,
  envDir,
  envPrefix: 'VITE_',

  // Root deployment by default. Set VITE_BASE_PATH=/vendly/ when serving from
  // a sub-path such as GitHub Pages; assetPath() resolves public assets from it.
  base: env.VITE_BASE_PATH || '/',

  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills(),

    VitePWA({
      registerType: 'autoUpdate',

      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vendly-google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },

      manifest: {
        name: 'Vendly',
        short_name: 'Vendly',
        id: '/',
        description: 'Sales, inventory and payments for Nigerian merchants.',
        theme_color: '#F7F0D8',
        background_color: '#F7F0D8',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity', 'shopping'],

        icons: [
          {
            src: '/icons/vendly-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/vendly-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/vendly-icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/vendly-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  optimizeDeps: {
    exclude: ['@breeztech/breez-sdk-spark'],
  },

  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  };
});
