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
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
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
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Bureau des Planqués',
        // Le libellé sous l'icône installée : le nom technique (D-036), choisi par Bastien (D-054).
        short_name: 'Planquex',
        description: 'Collectionne les Planqués, ouvre des Arrivages, affronte la Direction.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        // Portrait **et** paysage (D-142) : l'application installée suit la rotation du téléphone.
        // L'écran de combat a sa mise en page de paysage (`styles.css`, « écran court, paysage »).
        orientation: 'any',
        lang: 'fr',
        start_url: '/',
        // Des PNG d'abord : sans icône raster, Chromium/Brave n'installe qu'un raccourci
        // avec son propre badge (constaté le 21/10/2026). Le SVG reste en repli vectoriel.
        // Les PNG se régénèrent par `npm run icones`. Garde : `scripts/ressources/icones.test.ts`.
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        // Les illustrations **ne sont pas précachées** (#357) : depuis D-045 elles entrent
        // dans le graphe de modules (Vite les hache dans `dist/assets/`), et les précacher
        // faisait payer **28 Mo** à la première visite avant d'avoir vu une carte. Elles
        // restent servies par le réseau, et la carte qui s'affiche les demande alors.
        // **`wav` depuis #413** : les deux sons de l'alpha vivent dans `public/sons/` et ne sont
        // pas hachés par Vite, donc aucun `import` ne les met dans le graphe de modules. Sans cette
        // extension, le jeu était **muet hors ligne** — le mode que #357 a rendu utilisable.
        // 74 Ko pour deux sons : le prix est dérisoire, le silence ne l'est pas.
        // **`webp` depuis #415** : les trois captures de règles (`public/regles/`, ~92 Ko) doivent
        // rester lisibles hors ligne, comme les sons. Même raison, même garde (`precache.test.ts`).
        globPatterns: ['**/*.{js,css,html,svg,woff2,wav,webp}'],
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
  build: {
    rolldownOptions: {
      output: {
        /**
         * **Un paquet par famille de dépendances** (#479).
         *
         * Mesuré le 29/10/2026, après #478 : les écrans chargés à la demande, le paquet
         * principal pesait encore **727 kB** (221 kB gzip) parce que React, le routeur,
         * Supabase, framer-motion et base-ui y vivaient tous — c'est-à-dire 227 kB au-dessus du
         * seuil que Vite signale. Le même découpage appliqué, il tombe à **290 kB** (78 kB
         * gzip), et **aucun** paquet ne dépasse **500 kB** : le plus gros est `react` à 219 kB
         * (68 kB gzip), puis `supabase` à 215 kB (55 kB gzip).
         *
         * Le ticket #479 annonce 202 kB (52 kB gzip) pour le principal : ce chiffre est celui
         * d'un Accueil **paresseux** lui aussi, mesuré puis écarté par #478 (la porte d'entrée
         * n'attend aucun morceau, et son repli ne s'affiche pas). Les 88 kB d'écart sont
         * exactement le code de l'Accueil et de sa scène d'Arrivage, restés dans l'entrée.
         *
         * La règle a deux raisons, et aucune n'est cosmétique :
         *
         * 1. **Le cache.** Une famille change à son rythme ; un `react` stable d'un build au
         *    suivant reste dans le cache du navigateur, quel que soit le code qui l'entoure.
         * 2. **La lisibilité d'un profil.** Un paquet nommé dit d'où vient le poids ; un
         *    `vendor` de 900 kB ne dit rien.
         *
         * **L'ordre est la règle de priorité** : rolldown prend le premier groupe qui accepte un
         * module, donc `react` passe avant `vendor` (qui accepterait tout). `react`,
         * `react-dom` et `scheduler` sont dans **le même** groupe : une seule copie de React et
         * de son ordonnanceur, dans un seul morceau, sans cycle d'initialisation (le build
         * n'émet aucun avertissement d'ordre).
         *
         * Garde : `npm run mesure:paquets` (#480) refuse un paquet au-dessus de 500 kB et un
         * principal au-dessus du cliquet.
         */
        codeSplitting: {
          groups: [
            // React, son rendu, son ordonnanceur — un seul morceau, et le premier servi.
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/ },
            { name: 'router', test: /node_modules[\\/]react-router/ },
            // Le client du mur : le plus gros des dépendances, et le seul chargé à la demande.
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            // Les animations : `framer-motion` et ses deux paquets internes.
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            // Les primitives d'interface (base-ui et son positionnement flottant).
            { name: 'base-ui', test: /node_modules[\\/](@base-ui|@floating-ui)[\\/]/ },
            // Les briques d'interface génériques : icônes, classes, variantes.
            {
              name: 'ui',
              test: /node_modules[\\/](lucide-react|class-variance-authority|clsx|tailwind-merge|cn)[\\/]/
            },
            // Tout le reste des dépendances : jamais un fourre-tout silencieux, il est nommé.
            { name: 'vendor', test: /node_modules[\\/]/ }
          ]
        }
      }
    }
  },
  server: {
    port: 5178,
    host: true
  }
});
