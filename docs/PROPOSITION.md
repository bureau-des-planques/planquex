# Bureau des Planqués — proposition de refonte complète

> Version de travail — 18/10/2026. Document de décision, pas de code.
> Objectif : reproduire **le jeu complet de l'APK** (Pokémon TCG Pocket 1.7.5) avec
> l'univers Bureau des Planqués, sans réutiliser `grevomon-pocket`, et avec la même profondeur
> de contenu au lancement : **286 cartes**, tous les écrans, tous les systèmes.

---

## 0. Décisions à valider

| # | Sujet | Proposition par défaut |
|---|---|---|
| 1 | Base de règles | TCG Pocket **à l'identique** : 20 cartes, 5 en main, 3 au Rack, 3 Interventions, Machine à café, pas de résistance, pas de défaite par pioche vide |
| 2 | Volume | **286 cartes** : 226 de base + 60 secrètes, avec la même répartition de raretés |
| 3 | Factions | 10 factions corporate (SSE, Management, QVT, Amélioration continue, RH, Atelier, Direction, Syndicat, Intérim, Support) |
| 4 | Ton | Satire de bureau, **punch up** : on ridiculise les postures de pouvoir, pas les personnes réelles ni les groupes protégés |
| 5 | Art | Direction « corporate dark premium » ; production assistée par IA + curation humaine (option à trancher) |
| 6 | Monétisation | Aucun argent réel en v1 ; « Cotisation » payée en monnaie de jeu ; Stripe plus tard si besoin |
| 7 | PvP | Serveur autoritaire, temps réel + reprise asynchrone, timer de 90 s |
| 8 | Stack | **React 19 + Vite 8 + TypeScript + PWA** (pas Godot) |
| 9 | Lancement | Bêta fermée par phases, pas de « big bang » |
| 10 | Nom / domaine | À définir (proposition : **Bureau des Planqués**) |

---

## 1. Ce que dit réellement l'APK

Faits observés dans `../sources/` et `../resources/` :

- Cible : **Pokémon TCG Pocket 1.7.5**, Unity IL2CPP, paquet `jp.pokemon.pokemontcgp`.
- Les **données de cartes, illustrations et textes ne sont pas dans l'APK** : elles sont téléchargées.
- `global-metadata.dat` est chiffré ; les 545 Mo de `split_bundledtree.apk` sont des blobs `.aladin` chiffrés.
- Le code Java de `sources/` est le pont Unity + les SDK (DeNA, Adjust, Firebase, NPlay, CriWare), pas la logique du jeu.
- L'inventaire fonctionnel (écrans, modules, systèmes) est dans `../grevomon-pocket/docs/INVENTAIRE-PTCGP.md`.

**Conséquence** : on peut reproduire les **règles, les écrans, les systèmes et l'économie**, pas copier le contenu. C'est exactement ce que ce projet fait, avec un univers original.

---

## 2. Stack recommandée

### 2.1 Comparatif honnête

| Critère | React + Vite + PWA | Godot 4 (Web) |
|---|---|---|
| Poids initial | ~150–250 Ko gzip | 20–40 Mo de WASM + moteur |
| Fluidité mobile | 60 fps en CSS/GPU, excellent pour des cartes | Bon en natif, **fragile en Web mobile** |
| UI texte / accessibilité | DOM, React Aria, lecteurs d'écran | Peu accessible, texte moins net |
| Auth / Supabase | Intégration directe | Pont JS à écrire |
| SEO / partage / liens | Natif | Faible |
| Mises à jour | Instantanées | Rebuild + redéploiement |
| Stores mobiles | PWA installable, puis Capacitor | Export natif direct |
| Animations cartes/particules | Motion + CSS + canvas | Très bon |
| 100+ utilisateurs simultanés | Aucun problème (statique + CDN) | Serveur de jeu à héberger |

### 2.2 Recommandation

**React 19 + Vite 8 + TypeScript + PWA**, avec :

- **Tailwind CSS 4** + **shadcn/ui** (Base UI par défaut depuis juillet 2026) pour les composants ;
- **Motion** (ex-Framer Motion) pour les transitions de cartes et d'écrans ;
- **React Aria** pour les composants critiques (dialogues, focus, clavier) ;
- **TanStack Router** + **TanStack Query** pour les routes et le cache serveur ;
- **Zustand** pour l'état local de jeu ;
- **Zod** pour valider cartes, actions et réponses API ;
- **Vitest** + **fast-check** (propriétés) + **Playwright** (E2E) ;
- **vite-plugin-pwa** (Workbox) pour l'installable et l'offline ;
- **PixiJS** uniquement si les effets d'ouverture de booster dépassent le canvas CSS.

**Godot n'est pas retenu** pour ce projet : le web mobile est son point faible, l'intégration auth/backend est plus coûteuse, et un jeu de cartes 2D n'a pas besoin d'un moteur 3D. Si tu veux plus tard publier sur les stores, **Capacitor** emballe la PWA sans réécrire le jeu.

### 2.3 Budget performance (téléphone milieu de gamme, 4G)

| Métrique | Cible |
|---|---|
| JS initial | < 250 Ko gzip |
| LCP | < 2,5 s |
| Images de cartes | AVIF/WebP, tailles responsive, lazy loading |
| Animation | 60 fps, `transform`/`opacity` uniquement, `prefers-reduced-motion` respecté |
| Mémoire | < 150 Mo sur 200 cartes affichées (virtualisation) |
| Offline | coquille + collection + decks consultables |

### 2.4 Infra

| Besoin | Service | Notes |
|---|---|---|
| Code / CI | GitHub + Actions | typecheck, tests, build, Lighthouse, Playwright |
| Hébergement web | Vercel | preview par PR, edge CDN |
| Backend | Supabase | Postgres, Auth, Realtime, Edge Functions, RLS |
| Images / assets | Cloudflare R2 + CDN | pas d'egress, cache long, variantes générées au build |
| DNS / WAF | Cloudflare | domaine, cache, règles |
| Emails | Brevo | SMTP auth + transactionnel, 300/j gratuit |
| Erreurs | Sentry | free tier suffisant au début |
| Analytics | PostHog Cloud ou Umami | événements produit, pas de tracking intrusif |

**Capacité** : Supabase Pro (25 $/mois) donne **500 connexions Realtime simultanées** et 8 Go de base. Pour 100 utilisateurs simultanés, c'est largement suffisant. Le free tier (200 connexions) suffit pour la bêta, mais il **met le projet en pause après 7 jours d'inactivité** : à éviter en production.

### 2.5 Free tiers, capacité réelle et homelab

Ordres de grandeur 2026, à revérifier au moment du lancement :

| Plateforme | Connexions temps réel | MAU / joueurs | Base | Remarque |
|---|---:|---:|---|---|
| **Supabase Free** | **200** | 50 000 MAU | 500 Mo | Pause après 7 jours sans activité ; 2 M messages/mois |
| **Supabase Pro** | **500** (10 000 sans spend cap) | 100 000 MAU | 8 Go | 25 $/mois ; 5 M messages/mois |
| **Appwrite Cloud Free** | **250** | 75 000 MAU | 10 Go stockage | Ne met pas en pause ; 5 Go bande passante |
| **Firebase Spark** | **100** (Realtime DB) | 50 000 lectures/jour Firestore | 1 Go | 20 000 écritures/jour : trop juste pour du jeu |
| **Cloudflare Workers/DO Free** | ~100 000 requêtes DO/jour | — | D1/R2 | Très économique, mais plus de plomberie |
| **PocketBase auto-hébergé** | dépend du serveur (100–1 000+) | illimité | SQLite | Gratuit, simple, mais tu gères la dispo |

**Lecture pour 100 joueurs simultanés** : Supabase Free suffit (200 connexions), mais le plafond de 2 M messages/mois peut devenir juste si les joueurs enchaînent les combats. Pour une bêta publique, **Supabase Pro à 25 $/mois** est le choix sûr. Appwrite Free (250 connexions, pas de pause) est une alternative crédible.

**Combien de joueurs au total** : la limite contraignante n'est pas le nombre d'inscrits (50 000 MAU), c'est la **taille de la base**. Avec 286 cartes par joueur, compte ~10–20 Ko de collection par joueur ; 500 Mo tiennent donc quelques milliers à ~10 000 collectionneurs, avant les logs de combat. Les logs doivent partir vers R2.

**Homelab Proxmox + Cloudflare Tunnel** :

- **Très bon pour** : staging, préprod, CI runners, backups, admin, bots, analytics self-hosted, origine des images.
- **Cloudflare Tunnel** : expose un service du homelab en HTTPS sans ouvrir de port ; mets **Cloudflare Access** devant l'admin et le staging.
- **Production** : le risque est la coupure internet, l'électricité, les backups et la sécurité. Pour 100 joueurs, un petit VPS Hetzner (~5 €/mois) sera plus fiable que le salon.
- **Option self-host complète** : **PocketBase** (un binaire, SQLite, auth, realtime, admin) sur une VM Proxmox 4 vCPU / 4–8 Go, derrière Cloudflare Tunnel, backups Litestream vers R2. Viable pour 100–500 joueurs simultanés.
- **Supabase self-hosted** : possible sur Proxmox, mais ~10 conteneurs et 8–16 Go de RAM ; plus lourd à maintenir que PocketBase.
- **Hybride recommandé** : Supabase managé pour l'auth/DB/realtime, **Cloudflare R2** pour les 286 illustrations (zéro egress), **homelab** pour staging/backups/CI.

---

## 3. Règles : TCG Pocket à l'identique

### 3.1 Tableau des règles de base

| Règle | Valeur |
|---|---|
| Chariot | **20 cartes**, max **2** exemplaires du même nom, au moins **1 Planqué Entrant** |
| main de départ | **5 cartes**, avec toujours au moins **1 Planqué Entrant** ; **pas de reprise de poste** : ni remélange, ni pioche pour l'adversaire (D-022) |
| main maximale | **10 cartes** |
| Rack | **3 places** |
| Poste | 1 |
| Interventions | **3** pour gagner ; un craquage normal = 1, un COMEX = 2 |
| Café | **Machine à café** : 1 café généré par tour, 1 attachement par tour ; si le slot du haut est occupé, pas de nouveau café |
| Types de café | Jusqu'à **3** par Chariot, ordre aléatoire ; le café incolore accepte tout — **établi par la recherche** (D-034) |
| Premier joueur | Ne pioche pas, ne peut pas attacher de café ; peut jouer un Collègue ; peut attaquer si l'attaque coûte 0 |
| Évolution | Impossible au premier tour de chaque joueur |
| Pression | 1 par tour ; le café n'est **pas consommé** ; elle fait monter le **Stress** |
| Vulnérabilité | **+20** |
| Résistance | **Aucune** |
| Rotation | Défausse autant de cafés que le coût de rotation |
| Pioche vide | **Pas de défaite** |
| craquage | L'adversaire marque les Interventions ; le Rack fournit la **relève** |
| Statuts | Surcharge (10 de Stress/tour), Épuisement (20 + lancer), Sieste (lancer), Immobilisation (1 tour), Dérive (lancer avant l'attaque) |
| Ordre des statuts | Surcharge → Épuisement → Sieste → Immobilisation |
| Cartes Action | Objet : illimité ; Collègue : **1 par tour** |
| Outils / Lieux | **Hors périmètre du lancement** (D-020) — reviendront en extension |

> Les règles maison `RULES-4b` (deck 12, main 4, résistance −20, défaite par banc vide) sont **rangées à part** dans `docs/MODES-FUTURS.md` : mode futur « Café », ni acté ni par défaut (D-019). Elles ne font pas partie du mode standard et ne doivent pas être citées comme telles.
>
> Le miroir de référence est **daté** : Pocket dans son état de **2026** (D-018). Les écarts connus et les points non sourçables sont listés dans `docs/MIROIR-2026-DELTAS.md` (O-008, O-009).

### 3.2 Adaptation des termes

Aucune valeur mathématique ne change. On renomme, on réécrit, on illustre.

| TCG Pocket | Bureau des Planqués | Notes |
|---|---|---|
| Pokémon | **Planqué** | La créature administrative |
| Basic / Stage 1 / Stage 2 | **Entrant / N+1 / N+2** | Progression hiérarchique |
| ex | **COMEX** | Vaut 2 Interventions |
| HP | **Seuil** | Même valeur, même courbe |
| Energy | **Café** | La ressource |
| Energy Zone | **Machine à café** | 1 café/tour |
| Attack | **Pression** | Une par tour |
| Ability | **Talent** | Inchangé |
| Item | **Objet** | Fournitures, docs, badges |
| Supporter | **Collègue** | 1 par tour |
| Tool | **Outil** | Clé USB, badge, gilet |
| Stadium | **Lieu** | Rack, cantine, salle de réunion |
| Prize / point | **Intervention** | 3 pour gagner |
| Weakness | **Vulnérabilité** | +20 |
| Resistance | — | Supprimée |
| Retreat | **Rotation** | Coût en cafés |
| Poison | **Surcharge** | 10/tour |
| Burn | **Épuisement** | 20 + flip |
| Sleep | **Sieste** | Flip pour se réveiller |
| Paralysis | **Immobilisation** | Saute un tour |
| Confusion | **Dérive** | Flip avant attaque |
| Deck | **Chariot** | 20 cartes |
| Hand | **main** | 5 cartes |
| Discard | **Rebut** | |
| Bench | **Rack** | 3 places |
| Active | **Poste** | |
| Coin flip | **Lancer de tampon** | Pile = tampon, face = agrafe |
| Mulligan | — | Le jeu de base n'en a pas, et nous non plus (D-022) |
| Pack | **Arrivage** | 5 cartes |
| Wonder Pick | **Pause café** | 5 cartes, 1 rare minimum |
| Collection | **Parc** | |
| Mission | **Note de service** | |
| Shop | **Économat / Boutique du CSE** | |
| Premium Pass | **Cotisation** | |
| Friend | **Camarade** | |
| Trade | **Échange de postes** | |
| Ranked | **Échelon** | |
| Present Box | **Casier** | |
| Card Skin | **Autocollant** | |
| Tutorial | **Journée d'intégration** | |

### 3.3 Les 10 factions

Chaque faction reprend un type TCG Pocket, avec le même rôle mécanique et une identité de bureau.

| Faction | Type | Vulnérable à | Identité | Exemples de cartes |
|---|---|---|---|---|
| **SSE** | Plante | Management | Prévention, soin, arrêts de travail | Médecin du travail, Infirmière, Trousse de secours |
| **Management** | Feu | QVT | Pression, objectifs, deadlines | Directeur général, Deadline hier, Réunion d’urgence |
| **QVT** | Eau | Amélioration continue | QVT, perks, flux, bien-être | Chief Happiness Officer, Yoga du rire, Corbeille de fruits |
| **Amélioration continue** | Électricité | Atelier | Lean, audits, KPI, process | Directeur qualité, Tableau de bord, Norme ISO |
| **RH** | Psychique | Direction | Recrutement, entretiens, manipulation | DRH, Entretien annuel, Plan de carrière |
| **Atelier** | Combat | RH | Terrain, maintenance, outils | Chef d’atelier, Multimètre, Intervention |
| **Direction** | Obscurité | Atelier | N+2, plans de départ, politique | PDG, Plan de départ, Réunion qui aurait pu être un mail |
| **Syndicat** | Métal | Management | CSE, protection, rapport de force | Secrétaire général, Tract blindé, Heure de délégation |
| **Intérim** | Dragon | Aucune | Mission courte, précarité, chaos | Intérimaire légendaire, Mission courte, Café renversé |
| **Support** | Incolore | Atelier | Helpdesk, tickets, polyvalence | Responsable support, Ticket, Escalade |

**Pourquoi ces noms** : ils sont immédiatement lisibles, ils permettent des lignes d'évolution naturelles (Entrant → N+1 → N+2), et ils donnent un vocabulaire de satire sans jamais viser une personne réelle.

### 3.4 Saveur Bureau des Planqués sans casser l'équilibre

Le mode standard reste **mathématiquement identique** à TCG Pocket. La saveur passe par :

1. **Les noms et textes** : chaque carte raconte une scène de bureau.
2. **Les animations** : tampon qui s'abat, machine à café qui fume, Rack qui tremble.
3. **Les missions** : « Note de service », « Objectifs annuels », « Plan de départ ».
4. **Les événements** : « Semaine de la qualité », « Audit surprise », « Grève générale ».
5. **Le mode Carrière** (optionnel, plus tard) : une campagne solo scénarisée avec des règles locales, sans toucher au standard.

**Pas de mécanique maison dans le mode standard** au lancement. Une seule exception, actée : le mot-clé **« Changement de priorité »** (une fois par tour, au Poste : défausser 1 carte, piocher 1). Il est déactivable par un drapeau global et testé en simulation avant validation.

### 3.5 Ton et satire

- On ridiculise **les postures** : réunions inutiles, plans de carrière, notes de service, présentéisme, jargon.
- On **ne nomme personne** de réel, aucune entreprise existante, aucun groupe protégé.
- Les cartes « Direction » sont des archétypes (N+2 fantôme, chef de projet fantôme), pas des portraits.
- Les textes sont drôles mais pas haineux ; la victime du gag est toujours le système, pas le salarié.
- Un comité de lecture (toi + quelques testeurs) valide les 286 textes avant publication.

### 3.6 Ce qu'on peut modifier sans casser le miroir

| Niveau | Modifications | Risque |
|---|---|---|
| **Cosmétique** | Noms, textes, art, sons, animations, cadres de rareté, thèmes de viviers, missions, avatars, autocollants | Nul |
| **Économie** | Recharge des Arrivages, prix boutique, récompenses de missions, coûts de Pause café | Faible (progression, pas combat) |
| **Contenu** | Les 286 cartes, leurs stats, attaques, talents | Moyen (méta) — validation par simulation |
| **Modes séparés** | Mode Carrière, mode Café 4b (parké : `docs/MODES-FUTURS.md`), draft, scellé | Nul sur le standard |
| **Mots-clés de carte** | « Changement de priorité », « Audit », « Prime »… construits sur des primitives existantes | Moyen — simulation obligatoire |
| **Règles de base** | Chariot, main, Rack, Interventions, café/tour, Vulnérabilité, résistance, pioche vide | **Élevé — on n'y touche pas** |

**Café et stress** :

- **Café = énergie.** La `Energy Zone` devient la **Machine à café** : 1 café/tour, 1 attachement/tour, le café non utilisé reste dans le slot du haut, 3 types max, l'incolore accepte tout. Aucune maths ne change.
- **Stress = états spéciaux.** Il n'existe pas de ressource « stress » dans TCG Pocket. On renomme les 5 états : Surcharge (poison), Épuisement (burn), Sieste (sleep), Immobilisation (paralysis), Dérive (confusion).
- Un **compteur de stress** qui s'accumule serait une mécanique maison. On le réserve à un mode alternatif, jamais au standard.

### 3.7 Noms actés

Les 10 noms sont actés (voir `FACTIONS.md` pour le détail des cartes) :

**SSE · Management · QVT · Amélioration continue · RH · Atelier · Direction · Syndicat · Intérim · Support**

Deux précisions :

- **SSE** = Service Santé Environnement, avec l’infirmière du travail incluse.
- Les stades sont **Entrant → N+1 → N+2** : la hiérarchie jusqu’au comité exécutif.

---

## 4. Contenu : 286 cartes au lancement

### 4.1 Structure exacte (miroir de Genetic Apex)

| Bloc | Nombre |
|---|---:|
| Cartes de base | **226** |
| — Planqués | 215 |
| — Collègues | 8 |
| — Objets | 3 |
| Cartes secrètes | **60** |
| — 1 étoile | 24 |
| — 2 étoiles | 29 |
| — 3 étoiles | 4 |
| — Couronne | 3 |
| **Total** | **286** |

### 4.2 Répartition des raretés (identique)

| Rareté | Nombre |
|---|---:|
| 1 diamant | 102 |
| 2 diamants | 67 |
| 3 diamants | 42 |
| 4 diamants | 15 |
| 1 étoile | 24 |
| 2 étoiles | 29 |
| 3 étoiles | 4 |
| Couronne | 3 |

### 4.3 Répartition par faction (miroir des types)

| Faction | Cartes (entrées) |
|---|---:|
| SSE | 37 |
| Management | 28 |
| QVT | 48 |
| Amélioration continue | 25 |
| RH | 32 |
| Atelier | 32 |
| Direction | 18 |
| Syndicat | 5 |
| Intérim | 4 |
| Support | 38 |
| **Total** | **267** |

> **Note (D-043, #104 (b))** : le nombre **267** est la valeur annoncée dans ce document (18/10/2026) ; le set réel en compte **281** (`npm run status` → `cards.byFaction`, dépassement antérieur et inévitable pour combler le déficit `3◆`, D-023/D-026). La **seule source** du nombre actuel est la commande `npm run status` (`cards.byFaction`), pas cette table.

Les 19 entrées restantes sont les Collègues et Objets. Les 60 secrètes sont des variantes d'art de cartes existantes.

### 4.4 Trois viviers de lancement

Comme Genetic Apex (Mewtwo / Charizard / Pikachu), trois viviers thématiques :

| Vivier | Factions mises en avant | Fantasme |
|---|---|---|
| **Vivier Atelier** | Atelier, Management, Syndicat | les pôles, les techniciens, le terrain |
| **Vivier Étage** | Amélioration continue, Support, Direction | la qualité, le process, le gestionnaire — et la Direction au-dessus |
| **Vivier Bureaux** | RH, SSE, QVT, Intérim | la paie, la santé, le bien-être, la précarité |

Chaque **Arrivage** contient 5 cartes : 3 communes, 1 peu commune, 1 rare minimum. Les taux exacts seront calibrés par simulation et affichés dans l'écran « Taux d'obtention ».

### 4.5 Pipeline de production

1. **Gabarit de carte** (Zod) : id, numéro, nom, faction, stade, évolution, Seuil, vulnérabilité, relève, attaques, talent, rareté, viviers, texte d'ambiance, art.
2. **Tableur de set** : 286 lignes, une par carte, avec les 10 factions et les 8 raretés.
3. **Validation automatique** : lignes d'évolution complètes, coûts d'énergie cohérents, aucune faction orpheline, counts exacts.
4. **Simulation d'équilibrage** : 10 000 parties par archétype, winrates cibles 45–55 %, détection des cartes auto-incluses.
5. **Textes** : 286 noms + 286 textes d'ambiance + 19 règles de cartes Action.
6. **Art** : 286 illustrations + 3 visuels de vivier + icônes de factions + cadres de rareté.
7. **Intégration** : build du set en JSON versionné, seed Supabase, tests de rendu.

### 4.6 Art : la vraie difficulté

286 illustrations, c'est le poste le plus long. Trois options :

| Option | Coût | Qualité | Délai |
|---|---|---|---|
| **A. IA + curation** | Faible | Bonne si direction artistique stricte | 2–4 semaines |
| **B. Placeholders stylés** | Nul | Correcte, lisible, pas premium | 1 semaine |
| **C. Commande à un illustrateur** | Élevé | Excellente | 2–4 mois |

**Recommandation** : A pour le lancement (style « corporate dark premium », palette bleu nuit/or, rendu semi-réaliste), avec un guide de style verrouillé et une curation carte par carte. Les 60 secrètes peuvent réutiliser l'art de base avec un traitement holographique, ce qui réduit le travail.

---

## 5. Fonctionnalités : tout l'APK

### 5.1 Matrice

| Système | Détail | Phase |
|---|---|---|
| Boot / titre | Écran titre, connexion, vérification de version | 1 |
| Onboarding | Journée d'intégration, tutoriel guidé | 1 |
| Accueil | Hub, quêtes, événements, raccourcis | 1 |
| Arrivages | Achat, stock, taux, ouverture animée | 2 |
| Parc | Grille, filtres, favoris, fiche, progression | 2 |
| Pause café (Wonder Pick) | 5 cartes, rotation, coûts, relance | 2 |
| Chariot | 20 cartes, légalité, decks sauvegardés, deck auto | 3 |
| Combat solo | Poste, Rack, cafés, attaques, statuts, journal | 3 |
| IA | Heuristique + plan rejoué, 3 niveaux | 3 |
| Tutoriel de combat | Pas-à-pas, guidé | 3 |
| Reprise de combat | Snapshot, « Reprendre » | 3 |
| PvP | Matchmaking, serveur autoritaire, timer, reprise | 4 |
| Classé | Échelons, saisons, MMR, classement | 4 |
| Échanges | Même rareté, jetons, escrow serveur | 5 |
| Amis / social | Liste, feed, présence | 5 |
| Casier | Récompenses différées, dons | 5 |
| Boutique | Offres du jour, bundles, historique | 2 |
| Cotisation | Passe premium, récompenses quotidiennes | 5 |
| Missions | Quotidiennes, séries thématiques, dex, deck | 2 |
| Succès | Collection, victoires, légendaires | 2 |
| Profil / apparence | Nom, avatar, stats, répartition | 1 |
| Réglages | Sons, haptique, animations, langue, reset | 1 |
| Notifications | Locales + email Brevo | 6 |
| Avis in-app | Demande de note | 6 |
| WebView | CGU, aide, confidentialité | 6 |
| Migration / suppression | Export, wipe compte | 6 |
| Localisation | FR d'abord, EN ensuite | 6 |
| Effets / transitions | Cartes holo, particules, page transitions | 3–6 |

### 5.2 Phasage réaliste

| Phase | Contenu | Sessions agent |
|---|---|---|
| 0 | Validation de ce document, spécification du set, direction artistique | 1 |
| 1 | Scaffold, design system, auth, PWA, CI, profil, accueil | 1–2 |
| 2 | Set 286 cartes, chariot, viviers, pause café, boutique, missions | 2 |
| 3 | Moteur, IA, combat solo, tutoriel, reprise, replay | 2–3 |
| 4 | PvP, serveur autoritaire, classé, matchmaking | 2–3 |
| 5 | Échanges, amis, casier, cotisation, événements | 2 |
| 6 | Polish, accessibilité, perf, déploiement, QA réelle | 1–2 |
| **Total** | | **11–15 sessions** |

Ce n'est pas un week-end. C'est un projet de plusieurs semaines, avec des paliers vérifiables.

---

## 6. Architecture

### 6.1 Monorepo

```
grevomon-tcg/
├── apps/
│   └── web/                 # React 19 + Vite 8 + PWA
├── packages/
│   ├── engine/              # moteur pur, déterministe, partagé client/serveur
│   ├── content/             # 286 cartes, schémas Zod, textes, art
│   ├── ui/                  # design system, cartes, animations
│   └── config/              # tsconfig, eslint, tailwind
├── supabase/
│   ├── migrations/          # schéma, RLS, index
│   └── functions/           # battle-action, matchmaking, trade, rewards
├── tools/
│   ├── card-gen/            # génération/validation du set
│   ├── balance/             # simulation d'équilibrage
│   └── art/                 # pipeline d'images, variantes, hash
├── docs/
└── package.json             # pnpm + turborepo
```

### 6.2 Moteur déterministe

- Fonctions pures : `applyAction(state, action) -> state'`.
- RNG **seedé** et journalisé : même seed + mêmes actions = même partie.
- Journal d'actions + snapshots : reprise, replay, anti-triche, debug.
- Le **même moteur** tourne côté client (optimiste) et côté Edge Function (autorité).
- Tests : unités, propriétés (`fast-check`), simulations IA vs IA, régressions de scénarios.

### 6.3 Modèle de données (aperçu)

```
profiles(id, username, avatar, created_at, ...)
cards(id, set_id, number, name, faction, stage, rarity, ...)
user_cards(user_id, card_id, quantity, obtained_at)
decks(id, user_id, name, is_valid, created_at)
deck_cards(deck_id, card_id, quantity)
packs(id, name, set_id, ...)
pack_openings(id, user_id, pack_id, seed, cards, created_at)
battles(id, player_a, player_b, state, status, version, ...)
battle_events(battle_id, seq, actor, action, created_at)
matchmaking(user_id, deck_id, rating, status)
trades(id, proposer, receiver, offered, requested, status)
missions(id, kind, requirements, rewards)
user_missions(user_id, mission_id, progress, claimed)
currency_ledger(user_id, currency, delta, reason, created_at)
```

### 6.4 Autorité serveur

- Le client envoie des **intentions** (`play_card`, `attach_energy`, `attack`, `retreat`, `end_turn`).
- L'Edge Function charge l'état, vérifie la légalité, applique l'action, persiste, diffuse.
- Idempotence par `action_id` ; version d'état pour rejeter les actions obsolètes.
- RLS : chaque joueur ne lit que ses données ; l'état de bataille est lisible par les deux joueurs seulement.
- Taux limités par utilisateur ; détection de rejeu ; audit des actions.

### 6.5 Déploiement

- `main` → Vercel production ; PR → preview.
- Migrations Supabase via CLI en CI, jamais à la main en prod.
- Assets : build → R2, URLs immutables + cache 1 an.
- Emails : Brevo SMTP pour l'auth, templates transactionnels.
- Observabilité : Sentry (erreurs), PostHog (funnel), logs Supabase.

---

## 7. Outils à ajouter à OpenCode

### 7.1 MCP prioritaires

| MCP | Usage | Risque |
|---|---|---|
| **Context7** | Docs à jour des libs (React, Vite, Tailwind, Supabase) | Faible (lecture) |
| **Playwright MCP** | QA navigateur, captures, parcours E2E | Moyen (agit dans le navigateur) |
| **Supabase MCP** | Schéma, migrations, logs, RLS | Élevé : **read-only** et projet scopé |
| **GitHub MCP** | Issues, PR, CI | Moyen |
| **Vercel MCP** | Déploiements, previews, logs | Moyen |
| **Cloudflare MCP** | DNS, R2, cache, Workers | Moyen |
| **Sentry MCP** | Erreurs, releases | Faible |
| **Figma MCP** | Design-to-code si on utilise Figma | Faible |
| **Chrome DevTools MCP** | Perf, réseau, mémoire | Moyen |

Exemple de configuration (à ajouter seulement après validation) :

```jsonc
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7": { "type": "remote", "url": "https://mcp.context7.com/mcp" },
    "playwright": { "type": "local", "command": ["npx", "-y", "@playwright/mcp@latest"] },
    "supabase": { "type": "remote", "url": "https://mcp.supabase.com/mcp", "enabled": false }
  }
}
```

### 7.2 Skills OpenCode

Déjà disponibles et utiles : `tdd`, `code-review`, `diagnosing-bugs`, `prototype`, `research`, `domain-modeling`, `writing-for-agents`, `skill-creator`.

À créer pour ce projet :

- **`planquex-card-design`** : gabarit, ton, règles de nommage, validation des 286 cartes.
- **`planquex-balance`** : lancer les simulations, lire les winrates, proposer des ajustements.
- **`planquex-ui-qa`** : captures 360/1280, vérifs de débordement, contrastes, reduced motion.
- **`planquex-lore`** : cohérence de l'univers, personnages, factions, textes.

### 7.3 Librairies et outils

| Besoin | Choix |
|---|---|
| UI | Tailwind 4, shadcn/ui, React Aria, Motion |
| État | Zustand, TanStack Query |
| Validation | Zod |
| DB types | `supabase gen types` |
| Tests | Vitest, Testing Library, fast-check, Playwright |
| Qualité | ESLint, Prettier, TypeScript strict, knip |
| Perf | Lighthouse CI, `size-limit`, `vite-bundle-visualizer` |
| Images | `sharp`, AVIF/WebP, blurhash |
| Erreurs | Sentry |
| Analytics | PostHog |
| Docs | Storybook (design system) |

---

## 8. Budget, planning, risques

### 8.1 Coût mensuel estimé

| Poste | Coût |
|---|---|
| Supabase Pro | 25 $ |
| Vercel | 0–20 $ |
| Cloudflare (DNS/R2) | 0–5 $ |
| Brevo | 0 $ (300 emails/j) |
| Sentry / PostHog | 0 $ (free) |
| Domaine | ~1–2 $/mois |
| **Total** | **~26–52 $/mois** |

### 8.2 Risques

| Risque | Impact | Mitigation |
|---|---|---|
| 286 illustrations | Blocage du lancement | IA + curation, placeholders dès la phase 2 |
| Équilibrage | Méta cassée | simulation dès la phase 3, patchs de set |
| Portée « tout l'APK » | Dérive | phases verrouillées, **beta** (voir D-048) |
| PvP serveur | Triche / désync | moteur partagé, autorité serveur, journal |
| Satire | Bad buzz | punch up, relecture, aucun nom réel |
| Supabase free | Pause 7 jours | Pro dès la bêta publique |
| iOS Safari | Quirks PWA | tests réels, fallback, Capacitor plus tard |

---

## 9. Questions à trancher

1. ~~**Règles** : on valide le miroir exact de TCG Pocket (20/5/3, zone d'énergie, pas de résistance, pas de défaite par pioche vide) et l'abandon de `RULES-4b` comme mode standard ?~~ **Tranché** (D-018, D-019) : miroir **daté 2026**, `RULES-4b` rangé dans `docs/MODES-FUTURS.md`. **O-008** (écarts du miroir) et **O-009** (règles insourçables) sont désormais **tranchés** — O-008 par **D-020**, O-009 par **D-022** — voir `docs/DECISIONS.md`.
2. **Volume** : on valide 286 cartes avec la répartition exacte (226 + 60, 102/67/42/15/24/29/4/3) ?
3. **Factions** : on valide les 10 noms proposés, ou tu veux en changer certains ?
4. **Ton** : on valide « punch up, aucun nom réel, la cible est le système » ? Tu veux un degré de férocité plus haut ou plus bas ?
5. **Art** : IA + curation, placeholders stylés, ou commande à un illustrateur ?
6. **Argent réel** : aucun en v1, ou Stripe dès la Cotisation ?
7. **PvP** : serveur autoritaire temps réel + reprise asynchrone, timer 90 s — ou plus simple (asynchrone pur) pour la v1 ?
8. **Stack** : React PWA confirmé ? Et « 100 » = 100 utilisateurs simultanés ou 100 utilisateurs au total ?
9. **Lancement** : **beta** par phases (voir D-048), ou tentative de tout livrer d'un coup ?
10. **Nom / domaine** : « Bureau des Planqués » te va, ou tu as un autre nom ?

---

## 10. Ce que je fais dès que tu réponds

1. Je fige les décisions dans `docs/DECISIONS.md`.
2. Je produis la **spécification du set** : 286 lignes, factions, raretés, lignes d'évolution, archétypes.
3. Je produis la **direction artistique** : palette, gabarit de carte, 3 planches de style.
4. Je scaffolde le monorepo et le design system, sans moteur de combat.
5. On attaque la phase 2 (contenu + collection + viviers) avec des captures à chaque étape.
