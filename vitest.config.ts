import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

/**
 * La configuration de `vitest` (#145).
 *
 * **Deux projets, et deux seulement**, parce que deux mondes coexistent :
 *
 * - **`node`** : le moteur, les données, les scripts, la migration du mur. Aucun DOM.
 * - **`ui`** : les cinq écrans, rendus par `@testing-library/react`, donc sous **jsdom**.
 *
 * ⚠️ **Le périmètre des `include` n'est pas un détail.** Avant ce fichier, `vite.config.ts`
 * ne portait **aucun** bloc `test` : `vitest` utilisait donc ses **défauts**, qui couvrent
 * `**\/*.{test,spec}.*` — c'est-à-dire **`src/`, `scripts/`, `supabase/` ET `tools/`**. Un `include`
 * restreint à `src/**` **cesse d'exécuter** les sept `scripts/*.test.ts` (dont
 * `garde-fous.test.ts`, qui garde la table des gardes) et `supabase/mur.test.ts` (la garde
 * RLS de #135) : la suite devient **verte avec moins de couverture**, ce qui est pire qu'un
 * échec. Les motifs ci-dessous couvrent donc les **quatre** zones, et pas seulement `src/`.
 *
 * Le défaut a été trouvé par l'orchestrateur en fusionnant : 55 fichiers annoncés contre 60.
 * Un contrôle qui vaut pour la prochaine fois : `npx vitest list --filesOnly` doit rendre
 * **autant de fichiers qu'il y a de fichiers de test sur le disque** (`find -name '*.test.*'`).
 */
const { version: APP_VERSION, stage: APP_STAGE } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string; stage: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_STAGE__: JSON.stringify(APP_STAGE)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    // Des délais **tolérants à la charge** (#176). Le défaut de `vitest` (5 s par test,
    // 10 s par `beforeAll`) mesure le temps **mural** : quand plusieurs suites partagent
    // la machine — cinq `npx vitest run` en parallèle, ou un agent qui simule à côté —
    // les tests d'écran (`jsdom`, 8 s à eux seuls) et la migration du mur (`pglite`,
    // 2,4 s) dépassent le seuil alors que rien n'est cassé. Mesuré le 23/10/2026 :
    // 5 exécutions simultanées échouaient **uniquement** sur des délais, dans quatre
    // fichiers hors du périmètre de #176. Un délai plus large ne masque pas une boucle
    // infinie : il la fait durer 20 s au lieu de 5, et le test garde son échec nommé.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    projects: [
      {
        name: 'node',
        test: {
          environment: 'node',
          setupFiles: ['./src/test/setup.ts', './src/test/setup-poste.ts'],
          // Les QUATRE zones : `src/` (moteur, données, store, lib), `scripts/` (les gardes
          // du dépôt), `supabase/` (la migration du mur) et `tools/` (le poste de pilotage,
          // #184). Les écrans sont en `.tsx` et vivent dans le projet `ui`.
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'supabase/**/*.test.ts', 'tools/**/*.test.ts'],
          globals: true,
          pool: 'forks'
        }
      },
      {
        name: 'ui',
        test: {
          environment: 'jsdom',
          setupFiles: ['./src/test/setup-jsdom.ts', './src/test/setup-poste.ts'],
          include: ['src/**/*.test.tsx'],
          globals: true,
          css: true,
          pool: 'forks'
        }
      }
    ]
  }
});
