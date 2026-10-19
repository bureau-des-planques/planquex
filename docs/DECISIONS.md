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
| D-016 | 18/10/2026 | Infrastructure du TCG : **nouveaux projets Vercel et Supabase** (schéma vide) liés à `Chapax/grevomon-tcg` ; comptes Vercel, Supabase et Brevo **conservés** (D-012) ; réglages SMTP Brevo repris avec une clé dédiée ; le projet Supabase de `Chapax/grevomon` est archivé, son schéma et ses Edge Functions **ne sont pas repris** — ⚠️ **amendée par D-017** (le projet Vercel est réutilisé, pas recréé) | L'ancien backend implémente `RULES-4b`, remplacé par D-003 ; le reprendre copierait l'ancien moteur (D-001, AGENTS.md §9) |
| D-017 | 19/10/2026 | **Amendement D-016** : le TCG est déployé sur le **projet Vercel existant `grevomon`** (`https://grevomon.vercel.app`), pas sur un nouveau projet `grevomon-tcg` ; le projet Supabase reste le nouveau `jzlcwnozlzhadatksvgh` (schéma vide) ; la clé SMTP Brevo vit dans la config Custom SMTP de Supabase, **pas** dans `.env` | Le site `grevomon.vercel.app` est mort de toute façon (Supabase de prod en pause, 18/10) ; réutiliser le projet Vercel évite un doublon ; supprimer le secret du dépôt réduit la surface d'exposition |
| D-018 | 19/10/2026 | **Miroir de référence daté** : le mode standard est le miroir de *Pokémon TCG Pocket* **dans son état de 2026**, et non la version de lancement (A1, 10/2024). Le standard, c'est ce miroir **plus** le seul mot-clé maison « Changement de priorité » (D-004) | D-003 ne datait pas le miroir ; la recherche du 19/10/2026 montre des valeurs qui ont bougé (Méga-Évolution ex = 3 Primes, Faiblesse ×2 par un Lieu, Pokémon à double type). Un miroir non daté rend toute vérification impossible |
| D-019 | 19/10/2026 | Les règles maison **`RULES-4b` sont rangées hors du standard**, dans `docs/MODES-FUTURS.md` (mode futur « Café », non acté, non implémenté). Elles disparaissent de `AGENTS.md` §4.1 et de `PROPOSITION.md` §3.1 | Mélangées aux règles du standard, elles ont produit de faux constats d'audit, dont une contradiction apparente sur la fin de partie — exactement le genre de confusion que le projet doit éviter |

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
| O-008 | **Écarts du miroir 2026** : Méga-Évolution ex = 3 Primes, Vulnérabilité ×2 par un Lieu, Pokémon à double type, statut des Outils/Lieux | Intégrer (nouveau stade, nouveau palier de Primes, types multiples) **ou** exclure explicitement du périmètre | Avant l'écriture des 286 textes — voir `docs/MIROIR-2026-DELTAS.md` §3 |
| O-009 | **Points de règle insourçables** : mulligan (« l'adversaire pioche 1 »), fin de partie sans Planqué, **qui choisit la relève après K.O.**, plafond de 3 types de café | Capturer les « Astuces de jeu » de l'app (preuve horodatée), ou trancher par décision datée | Avant de figer le moteur — le code et la doc se contredisent déjà sur la relève |
| O-010 | **Écarts code ↔ `AGENTS.md` §4** : 4 sur 8 corrigés le 19/10/2026, 3 **bloqués** faute de contenu, 1 faux positif | Voir l'état ci-dessous | Les 3 restants : après l'écriture des cartes concernées |

État d'**O-010** (relevé le 19/10/2026, corrigé le même jour sauf mention) :

| Écart | État |
|---|---|
| Relève après K.O. **automatique** au lieu d'un choix du joueur | **Corrigé** : `BattleState.pendingPromotion` + `promoteActive()` ; toute autre action est refusée tant que la relève n'est pas choisie |
| Évolution refusée au **tour 1 global** au lieu du premier tour de chaque joueur | **Corrigé** : `isFirstTurnFor()` (joueur = tour 1, Direction = tour 2), utilisée par `evolve` et `canEvolve` |
| **« Changement de priorité » (D-004) absent** | **Corrigé** : type `Keyword`, champ `Card.keywords`, action `priorityShift()`, drapeau `RULES.priorityShiftEnabled` dans `src/game/rules.ts`, une fois par tour |
| Classeur **non validé par le moteur** | **Corrigé** : les règles 20/2/1 quittent le store pour `src/game/deck.ts` ; `createBattle` **refuse** un classeur illégal |
| `DERIVE` « jamais traitée en `checkup` » | **Faux positif** : §4 dit « Dérive = lancer **avant attaque** », et l'ordre des statuts documenté ne l'inclut pas. Le code est conforme. Rien à corriger côté moteur |
| **Un seul statut** à la fois : l'ordre des statuts documenté est inopérant | **Bloqué** : demande de passer `CardInstance.status` en liste de statuts, ce qui touche le type, `applyStatus`, `checkup`, l'UI et 37 cartes. À faire avec une décision |
| **Cartes Action absentes** (Objet illimité / Collègue 1 par tour) | **Bloqué** : aucune carte Objet ni Collègue n'existe. D-005 en prévoit 8 + 3 : le mécanisme suivra les données |
| **Types de café absents** (`cost` est un nombre) | **Bloqué** : typage des cafés + génération aléatoire + incolore = réécriture des attaques des 37 cartes. Le plafond « 3 » n'a d'ailleurs pas de source primaire (O-009) |

## Prochaine étape

1. Les noms de factions, le mot-clé et le cadre du miroir sont actés (D-004, D-006, D-014, D-018, D-019).
2. Trancher **O-009** (points de règle insourçables, dont la relève après K.O.) : le moteur contredit déjà la doc.
3. Générer la **spécification des 286 cartes** (lignes, stades, raretés, stats, textes) — intègre d'abord **O-008**.
4. Produire la **direction artistique** (palette, gabarit, 3 planches).
5. Trancher les points ouverts restants (nom/domaine, satire, argent réel, style, lancement).
