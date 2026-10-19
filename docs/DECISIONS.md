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
| D-020 | 19/10/2026 | **Périmètre du lancement figé (O-008)** : les 4 ajouts du jeu de référence 2025-2026 sont **exclus** du set — Méga-Évolution ex à 3 Primes, Vulnérabilité ×2 par un Lieu, Pokémon à double type, Outils et Lieux. Le projet reste : 3 stades (N+1 → N+2 → COMEX), Cadre = **2 Primes**, un Planqué = **une** faction, Vulnérabilité **+20** | Le coût de la Méga-Évolution n'est pas le code (3 lignes) mais la **courbe de stats**, qui n'a aucune source publique : l'inventer contredit `CARD-SPEC.md` §2. Le double type casserait « 1 faction = 1 type », socle de §3.2 et de la table de Vulnérabilité. Chiffrage : `docs/ARBITRAGE-O-008.md` |
| D-021 | 19/10/2026 | **Les dégâts se lisent par coût en café, pas par rareté** : 1 café **10–30**, 2 cafés **40–80**, 3 cafés **70–120**, et un effet ne coûte des dégâts (20 à 40) **qu'à partir de 3 cafés**. La colonne « dégâts » par stade/rareté de `CARD-SPEC.md` §2 devient **indicative** | §2 portait deux règles incompatibles (bande par rareté contre règle par coût) : les 11 écarts relevés sur 7 cartes venaient de là, **pas des cartes**. Bandes ancrées sur les cartes réelles de TCG Pocket relevées le 19/10/2026 — Scyther 30 brut contre Venomoth 30 + Empoisonné à 1 énergie (effet gratuit), Dewgong 90 brut contre Vaporeon 60 + soin 30 à 3 énergies (effet payé), Starmie ex 90 à 2 énergies (un Cadre n'est pas un N+2). **Aucune carte modifiée** : `src/data/cards.test.ts` vérifie les 37 cartes contre ces bandes |
| D-022 | 19/10/2026 | **O-009 tranché, faute de source primaire** : (1) **pas de reprise de poste** — la main de départ contient toujours un N+1, sans remélange ni pioche adverse (le mulligan de §4 était celui du TCG *physique*) ; (2) la partie se perd aussi **quand plus aucun Planqué n'est en jeu**, désormais écrit dans §4 ; (3) la relève après K.O. est **choisie** par le joueur K.O. (déjà implémenté) ; (4) le plafond de **3 types de café** et son tirage aléatoire restent des **hypothèses assumées**, marquées comme telles dans §4 | Aucune version web des « Astuces de jeu » n'existe : deux recherches n'ont trouvé que du secondaire. Les points 1 à 3 sont concordants chez deux sources japonaises récentes (Game8 MAJ 30/09/2026, GameWith MAJ 19/10/2026) ; le point 4 n'a que des wikis. Le point 1 change le moteur : `mulligan()` supprimé, remplacé par `ensureBasicInHand()` (échange carte pour carte, main à 5, total conservé). Preuve à capturer : `docs/PROTOCOLE-ASTUCES.md` |
| D-023 | 19/10/2026 | **Le Moral suit le jeu réel (O-011)** : Basique **50–80**, Stade 1 **90–120**, Stade 2 **140–160**, ex **170–190**, resserrés à ±10 par rareté pour garder une progression lisible. Deux cartes remontent : `sse-medecin-travail` **130 → 140** et `sse-medecin-chef-ex` **160 → 170**. La Relève reste un choix maison | Notre courbe plafonnait 20 points sous le jeu de référence : les K.O. y étaient donc **moins chers** que dans le jeu qu'on copie, c'est-à-dire une partie plus rapide. Effet chiffré par `src/game/pace.test.ts` (modèle de rythme, `PACE_REPORT=1` pour le tableau) : **0 tour** d'écart dans la lecture optimiste, au plus **+3 tours** dans la pessimiste (N+1 21 → 24, COMEX 10 → 13), rien sur N+2 ni Cadre. Coût borné, donc on adopte la courbe du miroir plutôt que de garder une courbe inventée |
| D-024 | 19/10/2026 | **Nommage des factions et des types (amende D-006)** : les 10 factions deviennent **SSE, Management, QVT, Amélioration continue, RH, Atelier, Direction, Syndicat, Intérim, Support**. Un nom de faction désigne **un service ou un collectif, jamais une personne**. Abréviation : **sigle réel s'il existe, sinon trois lettres** → `SSE`, `MGT`, `QVT`, `AC`, `RH`, `ATL`, `DIR`, `SYN`, `INT`, `SUP`. Les **anglicismes entrés dans le français courant** (management, audit) sont admis dans un nom de faction ; les **titres à la mode** (Happiness Manager, Chief Happiness Officer) restent **sur les cartes**. Le type **Psy devient Psychique**. La collision faction/carte de « Atelier » (« Chef d'atelier », Lieu « Atelier ») est **assumée** | Quatre registres se mélangeaient — services (SSE, RH), domaines (Amélioration continue), collectifs (Direction, Syndicat) et **personnes** (Manager, Technicien, Intérimaire) : une faction doit pouvoir *contenir* des gens, pas *être* un poste. La règle d'abréviation évite d'inventer `RHS` et `AMC` pour deux sigles réels, et huit codes sur dix sont identiques dans les deux règles possibles |
| D-025 | 19/10/2026 | **Référentiel du contenu : le site devient un atelier MRO d'équipement optronique.** Le **nom du jeu est conservé** — « Bureau des Planqués » se relit en *bureau d'études / bureau des méthodes*. Les **règles et le miroir** sont intouchés ; les **factions survivent** (une société de MRO a bien un SSE, un CSE, une Direction, une Qualité) ; le **vocabulaire du plateau** (open-space, machine à café, courrier, classeur, bacs…) sera **réécrit en termes d'atelier** ; l'**équipement optronique est la marchandise** du site (Objets, Outils) et **le Planqué reste un salarié** | « Et du plateau qui va avec » désignait le vocabulaire de jeu, pas la saveur d'un bac : (A) est retenu plutôt que (B) un registre réservé à un seul bac. Coût nul en structure : les factions sont des fonctions d'entreprise, le SSE et le CSE sont même des fonctions *industrielles*, et les 37 cartes SSE — métiers de site — tiennent dans les deux univers |

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
| O-008 | **Écarts du miroir 2026** : Méga-Évolution ex = 3 Primes, Vulnérabilité ×2 par un Lieu, Pokémon à double type, statut des Outils/Lieux | **Tranché le 19/10/2026 : exclure les 4 (D-020).** Chiffrage conservé dans `docs/ARBITRAGE-O-008.md` pour une réintroduction en extension | Tranché |
| O-009 | **Points de règle insourçables** : reprise de poste, fin de partie sans Planqué, qui choisit la relève, plafond de 3 types de café | **Tranché le 19/10/2026 par D-022** (décision datée, faute de source primaire). Ce qui reste : la **preuve**, à capturer avec `docs/PROTOCOLE-ASTUCES.md` | Tranché |
| O-012 | **Preuve primaire des Astuces de jeu** : ~15 lignes de §4 sont décidées mais jamais observées | Capturer les 6 écrans listés dans `docs/PROTOCOLE-ASTUCES.md` et les ranger dans `docs/preuves/`. **Toi seul peux le faire** (application mobile) | Avant de considérer §4 comme vérifié |
| O-010 | **Écarts code ↔ `AGENTS.md` §4** : 5 sur 8 corrigés le 19/10/2026, 2 **bloqués** faute de contenu, 1 faux positif | Voir l'état ci-dessous | Les 2 restants : après l'écriture des cartes concernées |
| O-011 | **Courbe de Moral sous celle du jeu réel** d'environ 20 points aux stades hauts | **Tranché le 19/10/2026 : on adopte la courbe du miroir (D-023)**, le coût en rythme étant borné à +3 tours | Tranché |

État d'**O-010** (relevé le 19/10/2026, corrigé le même jour sauf mention) :

| Écart | État |
|---|---|
| Relève après K.O. **automatique** au lieu d'un choix du joueur | **Corrigé** : `BattleState.pendingPromotion` + `promoteActive()` ; toute autre action est refusée tant que la relève n'est pas choisie |
| Évolution refusée au **tour 1 global** au lieu du premier tour de chaque joueur | **Corrigé** : `isFirstTurnFor()` (joueur = tour 1, Direction = tour 2), utilisée par `evolve` et `canEvolve` |
| **« Changement de priorité » (D-004) absent** | **Corrigé** : type `Keyword`, champ `Card.keywords`, action `priorityShift()`, drapeau `RULES.priorityShiftEnabled` dans `src/game/rules.ts`, une fois par tour |
| Classeur **non validé par le moteur** | **Corrigé** : les règles 20/2/1 quittent le store pour `src/game/deck.ts` ; `createBattle` **refuse** un classeur illégal |
| `DERIVE` « jamais traitée en `checkup` » | **Faux positif** : §4 dit « Dérive = lancer **avant attaque** », et l'ordre des statuts documenté ne l'inclut pas. Le code est conforme. Rien à corriger côté moteur |
| **Un seul statut** à la fois : l'ordre des statuts documenté est inopérant | **Corrigé** : `CardInstance.statuses: Status[]` ; `checkup` les résout **dans l'ordre de §4** (`STATUS_ORDER` dans `src/game/rules.ts`), `Dérive` restant avant l'attaque. Une même condition ne se cumule pas |
| **Cartes Action absentes** (Objet illimité / Collègue 1 par tour) | **Bloqué** : aucune carte Objet ni Collègue n'existe. D-005 en prévoit 8 + 3 : le mécanisme suivra les données |
| **Types de café absents** (`cost` est un nombre) | **Bloqué** : typage des cafés + génération aléatoire + incolore = réécriture des attaques des 37 cartes. Le plafond « 3 » n'a d'ailleurs pas de source primaire (O-009) |

Détail d'**O-011** (relevé le 19/10/2026, `CARD-SPEC.md` §2 contre les cartes réelles) :

| Stade | Notre bande de Moral | Jeu réel |
|---|---|---|
| N+1 (Basique) | 60–70 | 50–80 |
| N+2 (Stade 1) | 80–100 | 90–120 |
| COMEX (Stade 2) | 120–140 | 140–160 |
| Cadre (ex) | 140–170 | 170–190 |

Le décalage est d'environ **20 points** aux stades hauts. Conséquence à ne pas oublier : remonter
le Moral **ralentit** la partie (il faut plus de Pressions par K.O.), donc cela se tranche avec une
simulation, pas au feeling.

### Propagation en attente (D-024, D-025)

Les deux décisions sont **actées**, mais leurs conséquences s'écrivent en **une seule
passe** à la fin de la session de nommage — plutôt que de rééditer dix fois les mêmes
fichiers. D'ici là, les fichiers ci-dessous portent encore les anciens noms : ce n'est
pas une contradiction silencieuse, c'est un chantier listé.

| Fichier | Ce qui reste à propager |
|---|---|
| `AGENTS.md` §3.1 | tout le vocabulaire du plateau — après la famille « vocabulaire » |
| `AGENTS.md` §3.2 | les 10 noms, Psy → Psychique, les deux règles (abréviation, anglicismes) |
| `docs/FACTIONS.md` | 10 en-têtes, tableau §1, lignes « Faiblesse », identités |
| `docs/PROPOSITION.md` | §3.2 (les ~40 termes), §3.3 (les factions), §5 (les bacs) |
| `docs/CORRESPONDANCES.md` | §5 (types et factions), §3-§4 (les termes) |
| `docs/NOMMAGE.md` | §6 : marquer les propositions comme actées |
| `src/data/types.ts` | union `Faction` — 5 clés renommées |
| `src/data/index.ts` | `FACTION_META` : noms et étiquettes courtes |
| `src/data/sse.ts` | `weakness: 'MANAGER'` → `'MANAGEMENT'` |
| `src/data/cards.test.ts` | table `WEAKNESS` |

**Aucun identifiant de carte ne bouge** : seule `SSE` a des cartes, et son code ne change pas.

## Prochaine étape

1. Les noms de factions, le mot-clé, le cadre du miroir et le périmètre du lancement sont actés (D-004, D-006, D-014, D-018, **D-020**). Le set se construit sur 3 stades, Cadre = 2 Primes, une faction par Planqué.
2. Trancher **O-009** : fait (D-022). Reste **O-012**, la capture des Astuces de jeu — toi seul peux la produire.
3. Générer la **spécification des 286 cartes** (lignes, stades, raretés, stats, textes) : le périmètre est figé par D-020, plus rien ne bloque l'écriture.
4. Produire la **direction artistique** (palette, gabarit, 3 planches).
5. Trancher les points ouverts restants (nom/domaine, satire, argent réel, style, lancement).
