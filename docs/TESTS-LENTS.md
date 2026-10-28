# Les tests lents

> **Document dérivé** — régénéré par `npm run tests:lents -- --ecrire`, gardé par
> `scripts/tests-lents.test.ts` (#422, D-143 (5)). Ne pas le corriger à la main.

Mesuré le **2026-10-28** (`vitest run --reporter=json`, somme des durées d'assertion par
fichier ; les fichiers tournent en parallèle, donc le total dépasse le temps mural).

**La règle** : au-delà de **5 s**, un fichier de test dit **pourquoi** il est lent, en tête,
sur une ligne portant « Lenteur justifiée ». Un test qui ne sait pas se justifier se corrige.

| Fichier | Durée | Tests | Justifié |
|---|---|---|---|
| `scripts/capturer.test.ts` | 41.9 s | 53 | oui |
| `supabase/discord.test.ts` | 34.8 s | 32 | oui |
| `supabase/comptes.test.ts` | 33.8 s | 34 | oui |
| `supabase/gueulage.test.ts` | 31.3 s | 23 | oui |
| `scripts/illustration-vague.test.ts` | 28.6 s | 60 | oui |
| `src/pages/Collection.test.tsx` | 27.3 s | 17 | oui |
| `supabase/anon.test.ts` | 23.5 s | 6 | oui |
| `supabase/fonctions.test.ts` | 23.5 s | 8 | oui |
| `scripts/simulate.test.ts` | 23.3 s | 8 | oui |
| `supabase/mur-ecriture.test.ts` | 20.9 s | 22 | oui |
| `supabase/pouces.test.ts` | 20.8 s | 19 | oui |
| `supabase/dates.test.ts` | 20.5 s | 15 | oui |
| `src/pages/Collection.filtres.test.tsx` | 20.3 s | 10 | oui |
| `supabase/place.test.ts` | 15.0 s | 13 | oui |
| `supabase/base.test.ts` | 14.7 s | 6 | oui |
| `supabase/comite.test.ts` | 12.0 s | 15 | oui |
| `src/pages/Battle.test.tsx` | 11.7 s | 80 | oui |
| `src/pages/Collection.finition.test.tsx` | 11.1 s | 7 | oui |
| `src/game/fuzz-invariants.test.ts` | 8.7 s | 2 | oui |
| `src/game/mesure-direction.test.ts` | 7.8 s | 11 | oui |
| `src/pages/Deck.test.tsx` | 7.8 s | 15 | oui |
| `src/game/ia-niveau-2.test.ts` | 6.9 s | 10 | oui |
| `src/game/ia-expectiminimax.test.ts` | 5.7 s | 13 | oui |
| `src/game/ia-recherche.test.ts` | 5.6 s | 16 | oui |
| `tools/admin/admin.test.ts` | 5.4 s | 30 | oui |
