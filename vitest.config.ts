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
 * `**\/*.{test,spec}.*` — c'est-à-dire **`src/`, `scripts/` ET `supabase/`**. Un `include`
 * restreint à `src/**` **cesse d'exécuter** les sept `scripts/*.test.ts` (dont
 * `garde-fous.test.ts`, qui garde la table des gardes) et `supabase/mur.test.ts` (la garde
 * RLS de #135) : la suite devient **verte avec moins de couverture**, ce qui est pire qu'un
 * échec. Les motifs ci-dessous couvrent donc les **trois** zones, et pas seulement `src/`.
 *
 * Le défaut a été trouvé par l'orchestrateur en fusionnant : 55 fichiers annoncés contre 60.
 * Un contrôle qui vaut pour la prochaine fois : `npx vitest list --filesOnly` doit rendre
 * **autant de fichiers qu'il y a de fichiers de test sur le disque** (`find -name '*.test.*'`).
 */
const { version: APP_VERSION, stage: APP_STAGE } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
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
    projects: [
      {
        name: 'node',
        test: {
          environment: 'node',
          setupFiles: ['./src/test/setup.ts'],
          // Les TROIS zones : `src/` (moteur, données, store, lib), `scripts/` (les gardes
          // du dépôt) et `supabase/` (la migration du mur). Les écrans sont en `.tsx` et
          // vivent dans le projet `ui`.
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'supabase/**/*.test.ts'],
          globals: true,
          pool: 'forks'
        }
      },
      {
        name: 'ui',
        test: {
          environment: 'jsdom',
          setupFiles: ['./src/test/setup-jsdom.ts'],
          include: ['src/**/*.test.tsx'],
          globals: true,
          css: true,
          pool: 'forks'
        }
      }
    ]
  }
});
