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
| D-026 | 19/10/2026 | **Vocabulaire arrêté** (fin de la session de nommage). Le tableau complet et ses raisons vivent dans `docs/CORRESPONDANCES.md`. Ce qui change : stades **Entrant / N+1 / N+2**, avec **COMEX** comme **statut** d'ex affiché *avec* le stade ; **Seuil** (points de vie) ; **Stress** (dégâts) ; **craquer** (K.O.) ; **Chariot** (classeur) ; **Rebut** (défausse, et le verbe « mettre au rebut ») ; **Rack** (banc) ; **Rotation** (relève) ; **Interventions** (Primes) ; **Parc** (collection) ; **Arrivage** (paquet) ; **Viviers** — Atelier, Étage, Bureaux ; **Marché** (extension) ; **Tickets** et **Chrono** (économie). Statuts : **Surcharge, Épuisement, Sieste, Immobilisation, Dérive**. Restent inchangés : **main**, **Café**, **Machine à café**, **Pression**, **Talent**, **Poste**, **Objet**, **Collègue**, **Outil** | Trois règles ont guidé la session : **la règle du rire** (un mot du système, appliqué à des gens, avec un sérieux imperturbable), **la règle du nom d'origine** (on garde le mot du jeu de cartes quand il ne dit rien du travail), et **le nombre de viviers est ouvert** (champ `vivier` par carte). Deux appuis extérieurs : la structure du jeu de base — *Genetic Apex*, 3 sous-paquets, 226 ◊ + 60 ☆, exactement notre 286 — et le vocabulaire retrouvé dans le legacy (`grevomon-pocket/docs/RULES-4b.md:40-42` : Seuil / Stress / craquer), cité comme **idée** et jamais comme règle (§9). Le cadrage Seuil/Stress/craquer remplace Moral/dégâts/K.O. : c'est une **représentation** — même calcul, même miroir — et non le mécanisme 4b que §4.1 bannit |
| D-027 | 19/10/2026 | **Conventions de noms de cartes** : (1) un **Planqué** = un intitulé de poste **réel**, en priorité ceux du site (RPO, assistant RPO, responsable produit, gestionnaire, méthodes, flux, process, opto, méca, système, essai) ; (2) une **Pression** = un geste, une tâche ou un document de travail, et elle **fait monter le Stress** ; (3) un **Talent** = une compétence ou une manie de métier ; (4) un **Objet** est **NEUF** (matériel à installer) ou **MRO** (pièces et outillage de remise en état) ; (5) la **flavour** = une scène de site, et **la chute vise le système, jamais un collègue** ; (6) les **identifiants** gardent `-ex` pour les COMEX — suffixe technique persisté dans les sauvegardes, l'affichage dit COMEX | Ces conventions sont ce qui distinguera une satire **punch up** d'une moquerie de collègues. Les **215 noms individuels restent hors session** : ils seront produits en les appliquant, l'un après l'autre |
| D-028 | 19/10/2026 | **Points ouverts du contenu tranchés** : **O-004** degré de satire = « punch up » **modéré** (on ridiculise les postures et le système, jamais une personne réelle, une entreprise existante ni un groupe protégé) ; **O-006** style visuel = **corporate dark premium** ; **O-005** = **aucun argent réel en v1** (la Cotisation se paie en monnaie de jeu ; Stripe plus tard si besoin) ; **O-007** = **bêta fermée par phases** (le phasage 0→6 de `PROPOSITION.md`) ; **O-003** = **domaine reporté** au lancement (le nom « Bureau des Planqués » reste acté) | Les quatre premiers confirment les options déjà écrites dans `AGENTS.md` §4.2 et `PROPOSITION.md` §5 ; le domaine ne sert pas au développement local et sera réservé au moment de la bêta (`grevomon-tcg#10`). D-028 **débloque l'écriture des 286 textes et la direction artistique** |
| D-029 | 20/10/2026 | **Nommage de Management** : la **carte signature** de `MANAGEMENT` passe de « Chef des ventes » à **« Responsable d'unité »** (« Responsable d'unité COMEX » pour la carte COMEX) ; trois quasi-synonymes internes sont variés — « Responsable d'équipe » → **« Animateur d'équipe »**, « Manager adjoint » → **« Chef de service »**, « Commercial » → **« Technico-commercial »**. Les **identifiants suivent les noms** (`AGENTS.md` §5) : cinq entrées s'ajoutent à `CARD_ID_RENAMES` (migration `version: 2`) — une par id renommé, carte COMEX incluse | La faction portait quatre paires d'intitulés qui se répétaient — dont un sommet, « Chef des ventes », qui nommait le **métier** (la vente) plutôt que l'**encadrement**, alors que Direction porte déjà « Directeur général » et « Directeur de programme ». **Chaque nom retenu a été vérifié libre par commande** dans les 286 avant d'être proposé : la leçon d'un « Directeur général » choisi sur une analyse incomplète, alors que `direction-directeur-general` existait déjà. Le suffixe « COMEX » **reste** — « X » / « X COMEX » partageant leur base est ce que fait le jeu de référence (« Charizard » / « Charizard ex »), et D-026 fait de COMEX un **statut** que l'interface affiche en plus |

| D-030 | 20/10/2026 | **Le premier joueur pioche** (correction de `AGENTS.md` §4). La ligne « Premier joueur : **Ne pioche pas** » est fausse. La **seule** exception au premier tour du premier joueur est l'**énergie** : aucune n'est générée, donc il n'a rien à attacher. Il peut jouer un Collègue et attaquer si l'attaque coûte 0 — ces deux points étaient déjà justes | La règle « le premier joueur ne pioche pas » est celle du TCG **physique**, pas de Pocket — même erreur de provenance que la « reprise de poste » corrigée par D-022. Sources : transcription datée des Astuces in-app (`deckgym-core`, 08/09/2026 — les deux joueurs piochent 5 à l'initialisation, aucune restriction de pioche au tour 1) ; Bulbapedia et TVTropes ne listent qu'**une** exception, l'énergie. Détail : `docs/preuves/regles-2026-10-20/README.md` §2 |
| D-031 | 20/10/2026 | **Les statuts ne sont pas tous cumulables** (correction de `AGENTS.md` §4). **Surcharge** et **Épuisement** se cumulent entre eux et avec tout le reste. **Sieste**, **Immobilisation** et **Dérive** s'**excluent** mutuellement : appliquer l'une remplace les autres. Seul le Planqué au **Poste** peut porter un statut ; la **Rotation** et l'**évolution** les purgent tous | §4 disait « cumulables » pour les cinq, sans distinction. La transcription in-app est explicite : « Asleep, Paralyzed, and Confused cannot stack with each other. If one of these Special Conditions is applied, it replaces any of the others. » — seuls Poisoned et Burned « can stack with other Special Conditions ». L'ordre de résolution de §4 (Surcharge → Épuisement → Sieste → Immobilisation) est **confirmé** par la même source |
| D-032 | 20/10/2026 | **Six règles entrent dans `AGENTS.md` §4** (ajouts, aucune n'était écrite) : (1) la **Vulnérabilité ne s'applique pas au Rack** ; (2) **seul le Planqué au Poste** peut porter un statut, et Rotation comme évolution les purgent (voir D-031) ; (3) **ordre du calcul des dégâts** : dégâts de l'attaque → effets sur l'attaquant → **Vulnérabilité** → effets sur le défenseur ; (4) la **relève est choisie par le joueur dont le Planqué a craqué**, et après un **double craquage l'attaquant choisit en premier** ; (5) **limite de 30 tours** en PvP (50 en solo), puis **égalité** ; (6) atteindre 3 Interventions sur l'action qui vide le plateau **ne sauve pas** d'une défaite par plateau vide | Ces six points sont absents de §4 alors qu'ils se rencontrent en jeu. Sources : transcription in-app datée (`deckgym-core`, 08/09/2026) pour (1)(2)(4)(6) ; **FAQ officielle** (article `57286049312665`, `edited_at` 18/05/2026) pour (3) ; TVTropes et Bulbapedia pour (5). Le point (4) lève l'ambiguïté de §4, qui disait « le Rack fournit la relève » sans dire **qui** choisit — c'est déjà ce que fait le moteur (`pendingPromotion` + `promoteActive()`) |
| D-033 | 20/10/2026 | **O-012 avance, sans se clore** : la revue de sources du 20/10/2026 (branche `preuves/regles-2026-10-20`, dossier `docs/preuves/regles-2026-10-20/`) **confirme 14 lignes** de §4 et en **corrige 3** (D-030, D-031, D-032). Ce qui reste non observé : le **plafond de 3 types de café** (confirme O-009, débloque le ticket #30), le contenu des écrans « Contrôle Pokémon et États Spéciaux » et « Mettre un Pokémon K.O. », et la **pioche du premier joueur** (D-030 repose sur une transcription, pas sur une capture) | La revue a atteint son **critère d'arrêt** (une passe de requêtes sans affirmation nouvelle) après quatre passes : moteur `deckgym-core`, bases de cartes, simulateurs, datamining. La preuve primaire reste hors d'atteinte : le texte des Astuces vit dans `gamedata_master_tips.aladin`, **chiffré**, et les clés ne sont pas publiques (détail : `d-datamining.md`). O-013 ouverte pour cette piste |

## Ouvertes

| ID | Sujet | Options | Échéance |
|---|---|---|---|
| O-001 | Noms des 10 factions | Acté : voir D-006 | Acté |
| O-002 | Variante du mot-clé « Changement de priorité » | A (looter) retenue ; B (briefing) et C (débrief) plus tard | Acté |
| O-003 | Nom du jeu et domaine | Nom acté : « Bureau des Planqués » ; **domaine reporté au lancement** (D-028) | Tranché |
| O-004 | Degré de satire | **« Punch up » modéré** (D-028), aucun nom réel | Tranché |
| O-005 | Argent réel | **Aucun en v1** (D-028) ; Stripe plus tard si besoin | Tranché |
| O-006 | Style visuel précis | **Corporate dark premium** (D-028) | Tranché |
| O-007 | Lancement | **Bêta fermée par phases** (D-028) | Tranché |
| O-008 | **Écarts du miroir 2026** : Méga-Évolution ex = 3 Primes, Vulnérabilité ×2 par un Lieu, Pokémon à double type, statut des Outils/Lieux | **Tranché le 19/10/2026 : exclure les 4 (D-020).** Chiffrage conservé dans `docs/ARBITRAGE-O-008.md` pour une réintroduction en extension | Tranché |
| O-009 | **Points de règle insourçables** : reprise de poste, fin de partie sans Planqué, qui choisit la relève, plafond de 3 types de café | **Tranché le 19/10/2026 par D-022** (décision datée, faute de source primaire). Ce qui reste : la **preuve**, à capturer avec `docs/PROTOCOLE-ASTUCES.md` | Tranché |
| O-012 | **Preuve primaire des Astuces de jeu** : ~15 lignes de §4 sont décidées mais jamais observées | **Avancé le 20/10/2026 (D-033)** : 8 captures sont rangées (`docs/preuves/astuces-2026-10-20/`), 14 lignes confirmées et 3 corrigées par la revue de sources (`docs/preuves/regles-2026-10-20/`). Restent à capturer : **« Contrôle Pokémon et États Spéciaux »**, **« Mettre un Pokémon K.O. et issue d'un combat »**, et l'**éditeur de Chariot** (types de café) | Avant de considérer §4 comme vérifié |
| O-013 | **Texte exact du jeu (masterdata)** : le texte des Astuces vit dans `gamedata_master_tips.aladin`, **chiffré** | Il faut les clés `ALADIN_KEY` / `ALADIN_HASH`, **non publiques** — générées au runtime par Unity. Trois voies : (a) appareil rooté + Frida, ~3 h ; (b) accès au dépôt privé de RaenonX (masterdata déjà déchiffré) ; (c) s'en passer, les captures suffisant. Détail : `d-datamining.md` | Avant de renoncer à O-012, ou jamais si (c) suffit |
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

### Propagation — 19/10/2026

Les conséquences de D-024, D-025, D-026 et D-027 ont été propagées en **deux passes** :

1. **Le code** — types, moteur, données, UI, tests : `check` 0, **62 tests**, `build` 0. Vérifié :
   `grep -rniE "MANAGER|HAPPINESS|TECHNICIEN|INTERIMAIRE" src/` → **aucune occurrence**, et
   `src/data/sse.ts:290` nomme la carte `'Médecin-chef COMEX'`.
2. **Les docs** — `AGENTS.md` §3 à §7, `CARD-SPEC.md`, `FACTIONS.md`, `PROPOSITION.md`,
   `CORRESPONDANCES.md`, `docs/agents/domain.md`. La liste des fichiers ci-dessous est la trace
   du chantier.

> **Correction du 19/10/2026.** La première version de cette note annonçait la passe des docs
> comme **terminée et vérifiée** — c'était **faux**, et rien ne l'avait re-mesuré. Un relevé a
> montré que `PROPOSITION.md` §3-§5, `CORRESPONDANCES.md` (dont D-026 fait pourtant « le tableau
> complet ») et `CARD-SPEC.md` §3-§4 portaient encore les noms d'avant D-024 (`Manager`,
> `Happiness Manager`, `Technicien`, `Intérimaire`) et le vocabulaire d'avant D-026 (`Courrier`,
> `Archive`, `Prime`, `Bacs`, `Faiblesse`). Le typo **« Psychiquechic »** y survivait aussi. Tout
> est corrigé à la main.

> **Le vocabulaire des actes datés n'est pas réécrit.** Les corps des décisions **antérieures à
> D-024** (et les tableaux d'audit **O-010**/**O-011**) gardent les mots de leur date :
> « Cadre » pour un COMEX, « Primes » pour les Interventions, « Moral » pour le Seuil, « bacs »
> pour les Arrivages et les Viviers. Un acte ne se réécrit pas ; **D-024/D-026/D-027** sont
> l'état courant, et `AGENTS.md` §3 est la table de vocabulaire.

> **Leçon de méthode** : deux passages `perl`/`sed` ont abîmé la prose qui *expliquait* les
> changements (« le Seuil remplace le Seuil », « Psychiquechique »). Sur un document qui *parle*
> des termes, on édite à la main — le remplacement automatique ne distingue pas le terme de sa
> définition. Et une propagation ne se déclare **pas** vérifiée tant qu'un `grep` ne le prouve pas.

| Fichier | Ce qui a été propagé |
|---|---|
| `AGENTS.md` §3.1 | tout le vocabulaire du plateau ; l'ancien nom de la collection → **Galérodex** |
| `AGENTS.md` §3.2 | les 10 noms, Psy → Psychique, les deux règles (abréviation, anglicismes) |
| `docs/FACTIONS.md` | 10 en-têtes, tableau §1, lignes **Vulnérabilité**, identités, lignes d'évolution (`Directeur général`, `Auditeur qualité`, `Technicien de maintenance`) |
| `docs/CARD-SPEC.md` | §2 (`COMEX`, `Vulnérabilité`), §3 (les 10 archétypes), §4 (les 10 en-têtes) |
| `docs/PROPOSITION.md` | §0, §3.1 (les règles), §3.2 (les ~40 termes), §3.3 (les factions), §3.6, §4.3-§4.5, §5.2, §10 |
| `docs/CORRESPONDANCES.md` | §1, §2-§4 (les termes), §5 (types et factions), §9-§11 |
| `docs/agents/domain.md` | le glossaire cité et le nom de la collection |
| `docs/NOMMAGE.md` | §6 : les propositions sont marquées **actées** ; §1 et §4 restent l'« avant » |
| `src/data/types.ts` | union `Faction` — 5 clés renommées |
| `src/data/index.ts` | `FACTION_META` : noms et étiquettes courtes |
| `src/data/sse.ts` | `weakness: 'MANAGER'` → `'MANAGEMENT'` |
| `src/data/cards.test.ts` | table `WEAKNESS`, libellé du `describe` `COMEX` |

**Aucun identifiant de carte ne bouge** : seule `SSE` a des cartes, et son code ne change pas.

## Prochaine étape

1. Les noms de factions, le mot-clé, le cadre du miroir et le périmètre du lancement sont actés (D-004, D-006, D-014, D-018, **D-020**). Le set se construit sur 3 stades, COMEX = 2 Interventions, une faction par Planqué.
2. Trancher **O-009** : fait (D-022). Reste **O-012**, la capture des Astuces de jeu — toi seul peux la produire.
3. Générer la **spécification des 286 cartes** (lignes, stades, raretés, stats, textes) : le périmètre est figé par D-020, plus rien ne bloque l'écriture.
4. Produire la **direction artistique** (palette, gabarit, 3 planches).
5. Trancher les points ouverts restants (nom/domaine, satire, argent réel, style, lancement).
