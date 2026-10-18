# Décisions

> Journal des décisions actées. Une décision = une ligne datée, un choix, une raison.
> Les points ouverts restent en bas tant qu'ils ne sont pas tranchés.

## Actées

| ID | Date | Décision | Raison |
|---|---|---|---|
| D-001 | 18/10/2026 | Nouveau dossier `grevomon-tcg/`, indépendant de `grevomon-pocket` | Repartir propre, sans dette de l’ancien projet |
| D-002 | 18/10/2026 | Stack **React 19 + Vite 8 + TypeScript + PWA** | Léger, fluide sur mobile, intégrable à Supabase ; Godot Web trop lourd |
| D-003 | 18/10/2026 | Règles standard = **miroir exact de TCG Pocket** (20/5/3, zone d’énergie, faiblesse +20, pas de résistance, pas de défaite par pioche vide) | Fidélité à l’APK, équilibre éprouvé |
| D-004 | 18/10/2026 | Un **mot-clé maison déactivable** (« Changement de priorité », looter : défausse 1, pioche 1), porté par les cartes, pas par les règles de base | Saveur Bureau des Planqués sans casser le standard ; base pour de futurs mots-clés |
| D-005 | 18/10/2026 | **286 cartes** au lancement : 226 + 60 secrètes, répartition de raretés identique à Genetic Apex | Même volume que l’APK |
| D-006 | 18/10/2026 | **10 factions** : SSE, Manager, Happiness Manager, Amélioration continue, RH, Technicien, Direction, Syndicat, Intérimaire, Service Support | Identité Bureau des Planqués, lisibilité mécanique |
| D-007 | 18/10/2026 | Art : **IA + curation humaine**, style « corporate dark premium » | 286 illustrations à coût maîtrisé |
| D-008 | 18/10/2026 | PvP **temps réel + reprise asynchrone**, serveur autoritaire, timer 90 s | Fidèle à l’APK, anti-triche |
| D-009 | 18/10/2026 | Backend **Supabase Free** pour le développement et la bêta ; passage à Pro quand on approche des limites | Coût nul au départ, upgrade au besoin |
| D-010 | 18/10/2026 | Cible initiale **100 joueurs simultanés** ; dimensionnement large échelle étudié plus tard | Priorité à la sortie, pas à la scalabilité théorique |
| D-011 | 18/10/2026 | Périmètre = **toutes les features de l’APK**, livrées par phases | « Tout le jeu », mais pas en big bang |
| D-012 | 18/10/2026 | Infrastructure : **Vercel** (web), **Supabase** (backend), **Cloudflare** (DNS/R2), **Brevo** (emails), **GitHub** (CI) | Comptes existants, coût maîtrisé |
| D-013 | 18/10/2026 | Homelab Proxmox + Cloudflare Tunnel = **staging, backups, CI, admin** ; pas la production principale | Fiabilité et sécurité de la prod |
| D-014 | 18/10/2026 | Stades d’évolution : **N+1 → N+2 → COMEX** | Hiérarchie corporate + punchline COMEX ; évite le doublon avec la faction Manager |
| D-015 | 18/10/2026 | Nom du jeu : **Bureau des Planqués** | Explicite, satirique, cohérent avec le dossier `grevomon-tcg` |
| D-016 | 18/10/2026 | Infrastructure du TCG : **nouveaux projets Vercel et Supabase** (schéma vide) liés à `Chapax/grevomon-tcg` ; comptes Vercel, Supabase et Brevo **conservés** (D-012) ; réglages SMTP Brevo repris avec une clé dédiée ; le projet Supabase de `Chapax/grevomon` est archivé, son schéma et ses Edge Functions **ne sont pas repris** | L'ancien backend implémente `RULES-4b`, remplacé par D-003 ; le reprendre copierait l'ancien moteur (D-001, AGENTS.md §9) |

## Ouvertes

| ID | Sujet | Options | Échéance |
|---|---|---|---|
| O-001 | Noms des 10 factions | Acté : voir D-006 | Acté |
| O-002 | Variante du mot-clé « Changement de priorité » | A (looter) retenue ; B (briefing) et C (débrief) plus tard | Acté |
| O-003 | Nom du jeu et domaine | Nom acté : « Bureau des Planqués » ; domaine à réserver | Nom acté |
| O-004 | Degré de satire | Punch up, aucun nom réel (recommandé) ; plus féroce ? | Avant l’écriture des 286 textes |
| O-005 | Argent réel | Aucun en v1 (recommandé) ; Stripe pour la Cotisation plus tard | Avant la phase 5 |
| O-006 | Style visuel précis | Corporate dark premium (recommandé) ; cartoon satirique ; rétro bureau | Avant la phase 0 |
| O-007 | Lancement | Bêta fermée par phases (recommandé) ; big bang | Avant la phase 6 |

## Prochaine étape

1. Les noms de factions et le mot-clé sont actés (D-004, D-006, D-014).
2. Générer la **spécification des 286 cartes** (lignes, stades, raretés, stats, textes).
3. Produire la **direction artistique** (palette, gabarit, 3 planches).
4. Trancher les points ouverts restants (nom/domaine, satire, argent réel, style, lancement).
