# Bureau des Planqués

Refonte complète du jeu, dans un dossier neuf et indépendant de `grevomon-pocket`.

- **Statut** : prototype. Le code existe (37 cartes SSE, moteur, store), mais l’application n’est pas encore démarrable (`src/main.tsx` absent). Voir [`AGENTS.md`](AGENTS.md) pour l’état vérifié, les règles et les commandes.
- **Référence fonctionnelle** : `../sources/` et `../resources/` (Pokémon TCG Pocket 1.7.5), analysés dans `../grevomon-pocket/docs/INVENTAIRE-PTCGP.md`.
- **Contenu** : univers corporate original (Bureau des Planqués). Aucun asset, nom ou texte Pokémon n'est réutilisé.
- **Cible** : PWA mobile-first, 100+ utilisateurs simultanés, backend Supabase, déploiement Vercel/Cloudflare, emails Brevo.

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
