# Bureau des Planqués

Refonte complète du jeu, dans un dossier neuf et indépendant de `grevomon-pocket`.

- **Statut** : prototype. Le code existe (cartes dans `src/data`, moteur, store) et l’application est démarrable (`src/main.tsx` présent). Le décompte réel des cartes se lit dans `npm run status` (`cards`) : il n'est pas recopié ici. Voir [`AGENTS.md`](AGENTS.md) pour l’état vérifié, les règles et les commandes.
- **Référence fonctionnelle** : `../sources/` et `../resources/` (Pokémon TCG Pocket 1.7.5), analysés dans `../grevomon-pocket/docs/INVENTAIRE-PTCGP.md`.
- **Contenu** : univers corporate original (Bureau des Planqués). Aucun asset, nom ou texte Pokémon n'est réutilisé.
- **Cible** : PWA mobile-first, 100+ utilisateurs simultanés, backend Supabase, déploiement Vercel/Cloudflare, emails Brevo.

## Démarrage rapide

Toutes les commandes se lancent depuis ce dossier, avec Node.js et npm installés. Elles correspondent aux scripts déclarés dans `package.json` et à l’état vérifié de [`AGENTS.md`](AGENTS.md) §7.

```bash
npm install          # installe les dépendances
npm run dev          # serveur de développement Vite sur http://localhost:5178
npm run check        # vérification des types (tsc -b)
npm test             # tests Vitest, une passe
npm run test:watch   # tests Vitest en continu
npm run build        # vérification des types puis build de production dans dist/
npm run preview      # sert le contenu de dist/
npm run status       # métriques du projet en JSON, dont le décompte des cartes
```

Le build valide produit `dist/index.html` et `dist/sw.js` : ce sont les deux fichiers à vérifier après `npm run build`.

Les décomptes de cartes et de tests ne sont **pas recopiés** dans ce fichier : `npm run status` affiche `cards.total`, `cards.base`, `cards.variants` et `cards.factions`, dérivés d'`ALL_CARDS` (`src/data/index.ts`) ; `npm test` affiche le nombre de tests. Un décompte en dur qui revient ici ou dans [`AGENTS.md`](AGENTS.md) §7 est refusé par `scripts/compteurs.test.ts`.

## Décisions déjà actées

| Sujet | Décision |
|---|---|
| Dossier | `grevomon-tcg/` (nouveau, autonome) |
| Base de règles | TCG Pocket à l'identique (20 cartes, 5 en main, 3 Primes, zone d'énergie) |
| Volume | 286 cartes au lancement (226 + 60 secrètes) |
| Périmètre | Tout le jeu et toutes les features de l'APK |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Infra | GitHub + Vercel + Cloudflare + Brevo + domaine |

## Prochaine étape

Les noms de factions et le mot-clé sont actés (voir `docs/DECISIONS.md`).

1. Générer la **spécification des 286 cartes** (lignes, stades, raretés, stats, textes).
2. Produire la **direction artistique** (palette, gabarit, 3 planches).
3. Trancher les points restants : nom/domaine, degré de satire, argent réel, style visuel, lancement.
4. Scaffolder le monorepo et le design system.
