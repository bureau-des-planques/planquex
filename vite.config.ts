import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// La version de l'application a UNE seule source : `package.json`.
// Elle est injectée telle quelle au build (`__APP_VERSION__`, voir `src/version.ts`)
// pour que l'écran ne puisse pas mentir sur la version qu'il sert — c'est l'outil de
// diagnostic n°1 d'une PWA, où un testeur garde très bien l'ancien service worker.
// Garde : `src/version.test.ts` (elle échoue si un numéro de version est écrit en dur).
const { version: APP_VERSION, stage: APP_STAGE } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string; stage: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_STAGE__: JSON.stringify(APP_STAGE)
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bureau des Planqués',
        short_name: 'Planqués',
        description: 'Collectionne les Planqués, ouvre des bacs à courrier, affronte la Direction.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'fr',
        start_url: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        // `webp` est là pour les illustrations : depuis D-045 elles entrent dans le graphe
        // de modules (Vite les hache dans `dist/assets/`), donc sans ce motif un testeur
        // hors ligne verrait des cartes sans image.
        globPatterns: ['**/*.{js,css,html,svg,webp,woff2}'],
        navigateFallback: '/index.html',
        // Les illustrations pèsent : 1,2 Mo par image en 1024². Le précache les veut toutes
        // (c'est le jeu hors ligne), mais il ne doit pas être purgé d'office.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5178,
    host: true
  }
});
