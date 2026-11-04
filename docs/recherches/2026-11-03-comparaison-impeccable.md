# Ce que la skill `impeccable` (mode critique) a réellement apporté

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `comparaison-impeccable/COMPARAISON.md`. Les critiques « B » qu'il compare
> (`diag-*/CRITIQUE-IMPECCABLE.md`, `diag-arrivage/RARETES.md`) ne sont pas archivées ; les trois
> rapports « A » le sont, sous `2026-11-03-diagnostic-*.md`.

> Mesure faite le 03/11/2026 sur trois écrans. A = diagnostic **sans** impeccable (Claude, captures et mesures
> de terrain). B = critique **avec** impeccable (Gemini 3.8 Flash), produite **après** A et **à partir de A**
> (les deux documents B citent `RAPPORT.md` et jusqu'aux étiquettes de A : « D2 », « D3 », « C-01 »).
> Légende : **[O]** observé par moi (fichier:ligne lu, image lue, JSON recompté) · **[D]** déduit.
> Aucun fichier du dépôt n'a été modifié ; je n'ai lancé ni serveur ni test.

**Biais principal, à garder en tête partout** : B part d'une matière déjà trouvée par A. La question n'est donc
pas « B est-il aussi bon que A » mais « **qu'ajoute B à A** » — et B ne peut pas être crédité de ce qu'il recopie.
Second biais, symétrique : A avait déjà creusé 6 h de terrain, B a eu 2 h de rédaction. Ce que je mesure est
l'**incrément**, pas la compétence intrinsèque de la méthode.

---

## 1. Journée d'intégration

Sources : A = `diag-integration/RAPPORT.md` (+ `RAPPORT-session-concurrente.md`, autre session) ;
B = `diag-integration/CRITIQUE-IMPECCABLE.md` (172 lignes, se termine proprement).

### 1.1 Constats de A

| # | Constat | Gravité A | Preuve A |
|---|---|---|---|
| D1 | Sans backend, l'étape 1 bloque sans échappatoire | bloquant | `Home.tsx`, `JourneeIntegration.tsx:194` |
| D2 | L'étape est un compteur, pas une fonction de l'écran (étapes 2, 3, 5 s'ouvrent sur l'écran précédent) | bloquant | `JourneeIntegration.tsx:346-348` |
| D3 | La cible de l'étape 2 est hors fenêtre (y=1330) | P1 | `A-420x900-07`, `A-1280x800-07` |
| D4 | La garde interdit ce que le texte nomme (onglet Collection) | P1 | `B-420x900.json`, liste blanche `:71-75` |
| D5 | Deux tutoriels superposés à 420 px | P1 | `B-zoom-pas-a-pas-1-haut.png` |
| D6 | L'étape 5 se ferme au clic, `/comite` sans panneau | P2 | `:322-325` |
| D7 | « Revoir » reprend à 3/5 | P1 | autre session `19` |
| D8 | URL directe et retour arrière désynchronisés | P1 | `C-420x900-02`, `-07` |
| D9 | Bande morte de 100 px à 420 ; panneau sur le titre à 1280 | P2 | `A-420x900-07`, `A-1280x800-07` |
| A1 | D-175 a fusionné Collection/Deck sans reprendre l'étape 2 | doc | `docs/DECISIONS.md` |
| A2 | Indice d'étape écrit en dur dans `Battle.tsx:1013` | P2 | fichier:ligne |
| A3 | Un geste déjà fait allume « Suivant » à l'arrivée | P2 | `:192-200` |
| A4 | « bulle » est déjà pris par le comité (vocabulaire) | P2 | `docs/JEU.md` §3 l.66 |
| A5 | La voix de la Direction n'a aucune décision | doc | `grep -c` = 0 |
| A6 | 4ᵉ passe en 7 jours ; 64/64 tests verts pendant que 9 défauts existent | méthode | `npx vitest run` |
| — | 378 mots rendus (pas 36-59 comptés par `motsDeLEtape`) | P1 | `moi/captures/*.json` |
| — | Trois niveaux de texte pour une idée (titre + consigne + réplique qui la redit) | P1 | `A-420x900-05` |
| — | La voix du jeu est une note de bas de page (36 px, italique gris, après la consigne) | P1 | `A-420x900-05` |
| — | Bloc fixe de 300 px pour 12 mots utiles | P2 | `A-420x900-07` |
| — | Le détecteur est muet sur tout cela | méthode | `[]`, puis 3 avis `body` |
| + | Ce qui marche : geste réel, Échap = pause, `role=region` + `aria-live`, 0 erreur console | — | 3 × `erreurs: 0` |

### 1.2 Constats de B

Huit lignes de priorités P0–P3 (§4), plus cinq remarques de dimensions (§2), plus un barème Nielsen 12/40.

| Ligne B | Contenu | Sort |
|---|---|---|
| P0-1 | Blocage hors-ligne étape 1 | = D1 |
| P0-2 | Désynchronisation écran/texte par « Suivant » | = D2 |
| P0-3 | Cible hors fenêtre y=1330 | = D3 |
| P1-4 | Garde globale interceptant les onglets | = D4 |
| P1-5 | 600 mots de texte | = A (§1.1) |
| P1-6 | Panneau occultant / trou vide (540 px, 100 px) | = D9 |
| P2-7 | Superposition `/battle` | = D5 |
| P2-8 | Disparition de l'étape 5 | = D6 |
| §2.5 | `role=region` menteur + écouteur de capture | = D4 |
| §2.5 | **La réplique n'a pas d'`aria-live` ; seul le titre est annoncé** | **seulement B** |
| §2.5 | **Le panneau vole le focus « à chaque avancée de compteur »** | **seulement B** |
| N1 | « Deux compteurs non coordonnés (3/5 vs 1/5) » | = A (§2) |
| N6 | Pavé de 80 mots, cible hors écran | = D3 |
| N7 | « Revoir » cassé | = D7 |

**Communs : 9 · seulement A : 11 · seulement B : 3.**

### 1.3 Vérification des constats « seulement B » [O]

| Constat B | Vérification | Verdict |
|---|---|---|
| La réplique n'a pas de conteneur `aria-live` dédié ; seul le titre annonce son changement | `JourneeIntegration.tsx:248` : l'`aria-live` n'enveloppe **que** le `<h2>` ; la réplique est en `:279-285`, hors zone vive. Le `role="status"` de `:298/:302` parle du **geste**, pas de la Direction. | **VRAI** — et c'est le seul vrai constat neuf de B sur cet écran. A l'avait frôlé (« la réplique en est le texte » dans son §3.2) sans diagnostiquer l'état actuel. |
| « À chaque avancée de compteur, le panneau vole le focus » | L'effet qui appelle `panneauRef.current?.focus()` (`:95`) a pour dépendances **`[ouvert]`** (`:101`), pas `[etape]`. Le focus est pris **une fois à l'ouverture**. | **FAUX** sur le mécanisme. A avait le fait juste (`:95` contre D-161). B ajoute une causalité inventée. |
| 540 px de large, panneau qui occulte le titre à 1280 | Image `A-1280x800-07` : panneau de x=10 à x≈551. | **VRAI**, mais c'est une **mesure de précision** sur D9 (A disait « recouvre le titre »), pas un constat neuf. |

Autres défauts de B vérifiés au passage :

| Élément B | Vérification | Verdict |
|---|---|---|
| Cite `A-420x900-11` comme preuve de D2 | Le dossier `moi/captures/` s'arrête à `A-420x900-09`. | **citation fausse** |
| Prescrit `scrollIntoView({ block: 'center' })` pour D3 | Le code **refuse explicitement** `'center'`, avec sa raison écrite (`:132-140` : « Centré, un volet de 1 299 px posait son en-tête hors écran »). | **prescription régressive** |
| Prescrit un masque semi-transparent / overlay (§3.1, P1-4) | D-160 (2) : « un **panneau** posé en haut, **sans voile** ». A avait posé l'arbitrage (« un voile amende D-160 (2) — à trancher »). B le prescrit sans le dire. | **prescription contre une décision** |
| Barème 12/40 | A rapporte **18/40** pour le même écran (autre session). Deux passages d'impeccable, deux totaux, aucun ancrage de notation. | **non reproductible** |

### 1.4 Méthode

- **Barème Nielsen /40** : n'a servi à aucune décision. Les huit priorités P0–P3 sont les défauts D1–D9 de A,
  réordonnés ; le total 12/40 ne se retrouve ni dans le rapport de l'autre session (18/40) ni dans une grille
  citée. C'est de la mise en forme, et une mise en forme qui **ne se rejoue pas**.
- **P0–P3** : B promeut D1/D2/D3 en P0, ce que A tenait déjà pour bloquant. Aucun changement de priorité n'est
  argumenté (à l'inverse, en Arrivage B **rétrograde** le son de P2 à P3 sans raison).
- **Mode dégradé « single-context »** : annoncé en tête (`⚠️ DEGRADED`), honnête, mais il signifie que la
  critique multi-contextes n'a pas tourné. Rien dans le contenu ne s'en ressent parce que le contenu vient de A.
- **Grille de dimensions** (§2.1–2.5) : re-découpage des sections de A. Une seule sous-section produit un fait
  neuf (l'`aria-live`), et elle est noyée entre deux affirmations fausses.
- **Tests proposés** : voir §4.
- **Ce que la méthode n'a pas fait** : aucun ticket, aucun critère d'acceptation, aucune entrée `garde-fous.mjs`.
  A en proposait 10 avec AC. B s'arrête à la nomenclature P0–P3.

---

## 2. Ouverture d'Arrivage

Sources : A = `diag-arrivage/RAPPORT.md` ; B = `diag-arrivage/CRITIQUE-IMPECCABLE.md` (119 lignes, propre).
Note : un fichier frère **`RARETES.md`** (19:56) propose deux nomenclatures (Jeu A / Jeu B) ; B (21:24) s'en sert.

### 2.1 Constats de A

| # | Constat | Gravité A | Preuve A |
|---|---|---|---|
| S1 | Sachet générique (icône « booster TCG ») | P1 | `planches/envol-420x900.jpg`, `Pochette.tsx:126-229` |
| S2 | La blague du sachet est illisible (~8,4 / 7,8 px < plancher 9,92) | P2 | calcul `336/300 × 7,5` |
| S3 | Tout est or, le sachet n'a pas de couleur propre | P2 | `Pochette.tsx:76-82` |
| S4 | Pas de volume ouvert (ni dos, ni lèvre) | P1 | `zoom.jpg` |
| S5 | La déchirure est bonne, testée | + | `SPEC` §3.2 |
| A1 | Sortie à l'envers : cartes sous le sachet jusqu'à 2 900 ms | P1 | z-index + `ENVOL.revelation` |
| A2 | Les cartes sortent du cadre (−82 px à 1280 ; sous le titre à 420) | P1 | `v2/f1280/mesures.json` |
| A3 | Cinq ors indiscernables (ΔE 5,7–23,7) | P1 | `RARITY_META`, `t420/f17.png` |
| A4 | L'annonce est une phrase tirée au hasard, au retournement seulement | P2 | `revelation.ts:60-88` |
| A5 | Rectangle gris parasite, **cause non cherchée** | P2 | `r420/f35.png` |
| A6 | Le son part au clic, pas à la déchirure (non écouté) | P2 | `Home.tsx:91-96` |
| A7 | Mouvement réduit : aucune annonce | contrainte | `SPEC` §5 |
| — | L'outil de preuve n'atteint plus la scène (`filmer-animation.mjs` exit 1) ; `capturer` saute l'état | friction | §1.1, `capturer.mjs:984-1008` |
| — | « Dorée » n'existe pas ; la créer est une mécanique nouvelle | règle | D-018/D-020 |
| — | Aucune garde n'aurait vu l'empilement | méthode | `styles-ouverture.test.ts` |

### 2.2 Constats de B

| Ligne B | Contenu | Sort |
|---|---|---|
| C-01 | Cartes masquées et étalées derrière le sachet | = A1 |
| C-02 | Dépassement du viewport | = A2 |
| C-03 | Microcopie illisible (~8 px) | = S2 |
| C-04 | Indiscernabilité des raretés (ΔE 5,7–23,7) | = A3 |
| C-05 | Booster générique, absence de volume | = S1 + S4 |
| C-06 | Pas de taxonomie stable | = A4 |
| C-07 | Rectangle gris parasite | = A5 |
| C-08 | Désynchronisation sonore | = A6, **rétrogradé P2 → P3** |
| — | « 8 raretés : nomenclature du Jeu B » présentée comme **décision de Bastien** | **seulement B** |
| — | « Opacité 0.91 → 0.41 → 0 » | **seulement B** |
| — | « 50 % masqué pendant toute l'ascension (0–1 500 ms) » | **seulement B** |
| — | « Hearthstone : ΔE > 60 » | **seulement B** |
| — | Le rectangle gris « trahit un masque ou un conteneur mal nettoyé » | **seulement B** |

**Communs : 8 · seulement A : 6 · seulement B : 5.**

### 2.3 Vérification des constats « seulement B » [O]

| Constat B | Vérification | Verdict |
|---|---|---|
| Opacité du sachet « 0.91 → 0.41 → 0 » | `v2/f420/mesures.json`, champ `opaciteCorps` : **1 → 0,97 → 0,76 → 0,04**, puis 0 à 2 921 ms. À 1280 : 0,95 puis 0,5. Ni 0,91 ni 0,41 n'existent dans une mesure. | **FAUX (chiffres fabriqués)** |
| « 50 % de chaque carte masqué pendant toute l'ascension 0–1 500 ms » | Même fichier, `cartesSousLeCorps` : **100 %** à 35 et 363 ms, 64–92 % à 745 ms, 53 % à 1 101 ms, 50 % à 1 454 ms. | **FAUX** : B prend la fin de la montée pour toute la montée et **atténue le pire**. |
| Nomenclature « Jeu B » (*À l'essai … Légataire*) présentée comme « décision de Bastien acte » | Les huit mots viennent de `RARETES.md` §« Jeu B », fichier intitulé « **Propositions** de noms ». `grep -ril "Titularisé\|Légataire\|Émérite" docs/ src/` → **0**. Aucune ligne de `docs/DECISIONS.md` ne les porte. | **provenance fausse** : une proposition devient une décision. |
| « Hearthstone différencie bleu/violet/orange avec ΔE > 60 » | Aucune mesure, aucune source citée ; A avait mesuré **notre** palette seulement. | **invérifiable** |
| Rectangle gris = « masque ou conteneur mal nettoyé » | A dit « cause non cherchée ». B n'apporte ni capture nouvelle ni lecture de code. | **spéculation présentée comme diagnostic** (le mot « trahissant » fait le travail) |

### 2.4 Méthode

- **Barème** : pas de Nielsen ici, mais une légende P0–P3 et une « matrice des constats ». Les deux P0 sont
  A1 et A2, que A tenait déjà pour P1 bloquants. La seule **rétrogradation** (audio P2→P3) n'est pas motivée.
- **Mode dégradé** : pas annoncé sur ce document (contrairement aux deux autres). [O]
- **P0–P3** : n'a conduit à aucune décision ; B ne propose ni ticket ni AC.
- **Apport réel de méthode** : le test 4.2 (plancher typographique SVG) — voir §4.
- **Ce que la méthode a coûté** : trois chiffres faux ou invérifiables **présentés avec la même autorité** que
  les mesures de A. C'est le point le plus grave : dans un document qui se présente comme une critique
  « formelle », le faux est indiscernable du mesuré.

---

## 3. Combat

Sources : A = `diag-combat/RAPPORT.md` ; B = `diag-combat/CRITIQUE-IMPECCABLE.md` (150 lignes, se termine proprement).

### 3.1 Constats de A

| # | Constat | Gravité A | Preuve A |
|---|---|---|---|
| C1 | L'écran n'a pas la forme que D-093 a décidée (main rognée, quatre piles ouvrables) | P1 | SPEC R1/R5, `plateau.tsx:317` |
| C2 | Rien ne dit « table de jeu » (pas de paquet, pas de main adverse) | P1 | captures 420 |
| C3 | Toucher une carte de la main fait défiler de 278 px et cache l'adversaire | P1 | `film-ia.json` |
| C4 | La main prend 134 px pour des noms que la fiche répète | P2 | `mesures-telephones.json` |
| C5 | Le journal n'est qu'une ligne | P2 | `420x900-2-milieu-menu-journal.png` |
| C6 | Rien ne dit d'où vient une carte (aucune animation) | P2 | §1.3 |
| C7 | Noms tronqués | P3 (connu) | captures |
| C8 | Le Rebut n'est pas consultable contre la capture `03` (D-034) | P2 | `docs/preuves/astuces…` |
| — | Les cartes posées face cachée **n'existent pas** ; la « main adverse » est un texte | constat | `engine.ts:294-312` |
| — | Trois lectures de « se retourner » (A/B = mise en scène, C = règle) | cadrage | §3.2 |
| — | Maquette mesurée sur 4 gabarits (589 px tient à 420, déborde de 10 px à 390/360) | preuve | `maquette-mesures.json` |
| — | 17 décisions à amender, listées et citées | doc | §4 |

### 3.2 Constats de B

| Ligne B | Contenu | Sort |
|---|---|---|
| 1 | Défilement de 278 px au tap | = C3 |
| 2 | Absence de matérialité (pastilles, Rebut inouvrable) | = C2 + C8 |
| 3 | Plateau écrasé, noms coupés | = C4 + C7 |
| 4 | « 16 bordures 1px », flat hierarchy 1.21:1, néons cyan | **moitié B** |
| 5 | Nom au pied de la carte, masqué sous 56 px | = risque T4 de A |
| 6 | Ouverture et pioche plates | = C6 |
| 7 | « Rupture d'accessibilité si le journal disparaît sans `aria-live` » | **seulement B** |
| 8 | Cibles tactiles 44 px pour Deck/Rebut | **seulement B** |
| 9 | Animations non passables / plafond | ≈ §4 D-141 de A |
| 10 | Main adverse fantôme | = A |
| 11 | `repeating-stripes-gradient` | = avis du détecteur cité par A |
| — | « `de Stress` répété jusqu'à quatre fois sur le plateau » | **seulement B** |
| — | Pastilles « brun terne `#3a2a18` » | **seulement B** |
| — | « plus de 100 px verticaux rendus au plateau » | **seulement B** |
| — | « Suppression totale du journal » présentée comme décision de Bastien | **seulement B** |

**Communs : 9 · seulement A : 9 · seulement B : 6.**

### 3.3 Vérification des constats « seulement B » [O]

| Constat B | Vérification | Verdict |
|---|---|---|
| « Rupture d'accessibilité si le journal disparaît : il servait de support aux annonces » | `Battle.tsx:1301` : `sr-only aria-live="polite" data-testid="annonce-du-coup"` reçoit **déjà** `lastLog`, dans une zone **persistante** ; `:1487` le dit : « Pas d'`aria-live` : l'annonce du coup a déjà sa zone ». Le journal visible n'a jamais porté l'annonce. | **FAUX** (et il existait une réplique `annonce-replique-direction`, `:1307`) |
| Cibles Deck/Rebut 80×23 et 87×23 < 44 px | A avait mesuré 80×23 et 87×23 (§1.2) ; `styles.css:4497-4513` : `.pile` n'a pas de hauteur minimale. Le plancher 44 px est une règle réelle. | **VRAI** — seul constat neuf vrai et utile de B sur cet écran (mais la mesure est celle de A). |
| « `de Stress` répétée jusqu'à quatre fois sur le plateau » | Image `420x900-2-milieu-reprise.png` lue : le plateau n'affiche **aucun** « de Stress » (les cartes montrent `40/100`, `0/140`…). La chaîne n'existe que dans l'inspecteur (`InspecteurCombat.tsx:73,101`) et les badges de statut. | **FAUX tel qu'écrit** |
| Pastilles « brun terne `#3a2a18` / parchemin » | `styles.css:4499` : `background: var(--scene-parch)` = **`#b18a60`** (bord `#664d38`). `grep 3a2a18 src/styles.css` → **0**. | **FAUX (hex inventé)** |
| « plus de 100 px verticaux rendus au plateau (`maquette-mesures.json`) » | Le fichier cité mesure `board.h = 589` contre **561 avant**, soit **+28 px**, journal de 3 lignes **conservé** (`ticker.h = 48`). Les « +100 px » sont une projection arithmétique (134−56 + journal), pas la mesure. | **FAUX comme citation** (l'ordre de grandeur n'est atteint que si le journal disparaît **et** la main descend, ce que la maquette ne teste pas) |
| « 16 bordures 1px imbriquées » | `grep -c "1px solid"` = **72** dans `styles.css` ; aucun décompte à l'écran. L'image montre des cadres imbriqués (vrai en esprit), le chiffre n'est pas justifié. | **invérifiable** |
| « `styles.css:1665` : encadrés néons cyan agressifs » | Ligne 1665 = `.card--comex { --frame: var(--gold); }` — un cadre **or**, pas un néon cyan. | **citation fausse** |
| « Le composant universel `CardView` est écarté au profit de tuiles rabotées » | `CardSlot.tsx:49` rend `<CardView compact …>` : le plateau **utilise** `CardView`. | **FAUX** |
| « Suppression totale du journal » (décision) | Aucune trace : A proposait 2–3 lignes visibles (§3.4) ; le retrait total exigerait d'amender D-158 (2) (12 lignes de journal sur bureau), que B ne cite jamais. | **invérifiable et non instruit** |
| Ratio « flat hierarchy 1.21:1 » | `detect-page-420x900.json` : « body 15px, h2 15.2px, h1 18.4px (1.21:1) », sélecteur **`body`**. | **VRAI**, mais A citait déjà les trois avis ; B ajoute le chiffre et le présente comme un défaut **du combat** alors que le constat porte sur `body`. |

### 3.4 Méthode

- **Barème 22/40** (« Médiocre / refonte majeure ») : une note sans référentiel, sur un écran où A avait huit
  constats mesurés. Elle ne change aucune priorité : les P0 de B sont les P1 de A.
- **P0–P3** : la seule hiérarchisation neuve est fausse ou déjà faite. Le classement #4 (Cardocalypse) repose
  sur un ratio `body` et un décompte inventé.
- **Mode dégradé** : annoncé (`⚠️ DEGRADED: single-context`).
- **Ce que la méthode a produit de solide** : rien de neuf côté constats, sauf les 44 px — qui vient d'une
  règle connue appliquée à une mesure de A. La grille de Nielsen n'a **pas** fait surgir le défaut central
  (D-093 non tenu, l'écran n'a pas la forme décidée) : B ne cite jamais D-093.

---

## 4. Les tests automatisables proposés par B : lesquels tiennent ?

| Test B | Écran | Écrivable ? | Utile ? | Verdict |
|---|---|---|---|---|
| Budget de mots : réplique ≤ 12, total ≤ 70, **comptés sur les chaînes sources** | Intégration | oui | **non, en l'état** | A a mesuré que la source dit 36–59 mots quand le DOM en rend 73–93 (`motsDeLEtape`, `journee-etapes.ts:142`). Le test de B **rejoue le bug que A a diagnostiqué**. La version de A (« compter le DOM rendu ») est la seule qui garde. |
| `resoudreEtapeJournee('/') === 1`, `('/deck') === 2`… | Intégration | oui | **non, nuisible** | A a montré qu'une route porte **plusieurs** étapes (2a sur `/`, 3a sur `/deck`, tableau §1.2). Ce test figerait un modèle 1 route = 1 étape, faux, et passerait au vert sur le code actuel. |
| Aucune intersection bulle / cible | Intégration | oui (Playwright) | oui | Recoupe le ticket 3 de A, en moins bon : A demande `elementFromPoint` au centre de la cible, qui attrape aussi un voile ou un `pointer-events`. |
| Étape 1 praticable sans `VITE_SUPABASE_URL` | Intégration | oui | oui | = ticket 7 de A, à l'identique. |
| Empilement : `z-index` cartes > sachet dès l'éjection ; `cartesSousLeCorps` = 0 % | Arrivage | oui | oui | = T1 AC4 de A, à l'identique (y compris le cas fautif qui mord). |
| **Plancher typographique SVG** : extraire les `<text>`, `fontSize × 336/300 ≥ 9,92` | Arrivage | **oui** | **oui, neuf** | **Le seul apport de test réellement neuf des trois documents.** A avait l'exigence (T3 AC1) mais pas la forme testable. Attention : la largeur 336 est un gabarit ; il faut exprimer le test en **ratio** du viewBox, sinon il ne vaut qu'à 420 px. |
| ΔE ≥ 25 entre paliers + attribut de forme | Arrivage | oui | oui | = T5 AC2 de A, à l'identique. |
| `scrollHeight == innerHeight` + instant « carte choisie » dans `INSTANTS_COMBAT` | Combat | oui | oui | = T5 AC1 de A, à l'identique. |
| `.board` ≥ 580 px, main ≤ 76 px | Combat | oui | **douteux** | 580 est un chiffre de maquette (589 mesuré, 561 aujourd'hui) : le test échouerait **avant** tout travail, pour une raison sans rapport avec un défaut. A formulait la même exigence sans seuil en dur. |
| Cibles ≥ 44×44 sur les piles et les cartes de main | Combat | oui | oui, neuf | Recoupe le vrai constat neuf de B. À écrire (le plancher 44 px existe ailleurs dans le dépôt). |
| Contraste ≥ 4,5:1 sur les badges des nouvelles piles | Combat | oui | oui | Neuf, mais le dépôt a déjà `DESIGN.md` §1.5 + un test de contraste de scène ; à vérifier avant d'en ajouter un. |
| Flip ≤ 800 ms + `prefers-reduced-motion` | Combat | oui | oui | = T7 AC de A. |
| **`[aria-live=polite]` qui reçoit la dernière action de l'IA** | Combat | oui | **non : déjà vrai** | `Battle.tsx:1301` le fait déjà. Le test passe au vert au premier jour : **une assertion qui ne peut pas échouer ne compte pas** (AGENTS §6). C'est le test qui trahit le constat faux #7. |

**Bilan tests : 11 propositions → 6 recopient A, 1 (plancher SVG) est un vrai gain, 2 sont neuves et utiles
(44 px, contraste), 1 est plus faible que celle de A (budget de mots), 1 est nuisible (route → étape), 1 ne peut
pas échouer (aria-live).**

---

## 5. Conclusion par écran

### Journée d'intégration
- **Communs 9 · seulement A 11 · seulement B 3**, dont **1 vrai** (l'`aria-live` qui n'annonce que le titre),
  1 faux sur le mécanisme (focus « à chaque étape »), 1 mesure de précision (540 px).
- B **n'a pas** trouvé le défaut central : la cause de D2 (`:346-348`), la cible hors fenêtre par course avec
  le `Suspense` (D3), les 378 mots rendus contre 36–59 comptés, ni les six dettes documentaires (A1–A6).
- Deux prescriptions de B **cassent une règle du dépôt** sans le dire : `block:'center'` (refusé dans le code,
  avec sa raison écrite) et le voile (D-160 (2) « sans voile »).
- Barème : 12/40 ici, 18/40 dans l'autre session, pour le même écran. Non reproductible.

### Ouverture d'Arrivage
- **Communs 8 · seulement A 6 · seulement B 5**, dont **0 vrai constat**, **2 chiffres faux**
  (opacités 0,91/0,41 ; « 50 % pendant toute la montée » alors que c'est 100 % au début), 1 provenance
  fausse (la nomenclature du Jeu B présentée comme décision alors qu'elle vient d'un fichier « Propositions »),
  1 invérifiable (ΔE > 60 chez Hearthstone), 1 spéculation (la cause du rectangle gris).
- Les huit constats C-01…C-08 sont les huit lignes de A, dans le même ordre, avec les mêmes preuves.
- Seul gain : le test de plancher typographique SVG.

### Combat
- **Communs 9 · seulement A 9 · seulement B 6**, dont **1 vrai** (les 44 px des piles, à partir d'une mesure
  de A), **4 faux** (`aria-live` du journal, `de Stress` ×4, `#3a2a18`, `CardView` écarté), 2 citations
  fausses (`styles.css:1665`, « +100 px » attribués à un fichier qui mesure +28), 1 invérifiable (16 bordures),
  1 décision prêtée à Bastien sans trace (suppression totale du journal, qui exigerait d'amender D-158).
- B **ne cite jamais D-093**, alors que le défaut n° 1 de A est « l'écran n'a pas la forme décidée ».
- Le test `aria-live` proposé passe au vert aujourd'hui : il garde le constat faux.

---

## 6. Conclusion globale

**(a) Ce qu'impeccable a trouvé que A n'avait pas — chiffré.** Trois constats neufs **vrais** sur trois écrans :
l'`aria-live` qui n'annonce que le titre (Intégration), les cibles tactiles de 44 px (Combat), et — méthode, pas
constat — la forme testable du plancher typographique SVG (Arrivage). Soit **≈ 1 par écran**, tous mineurs, tous
sur des **règles connues du dépôt** (D-162 (1), plancher 44 px, `--fs-2xs`) appliquées à des mesures de A. Aucun
ne touche la cause d'un défaut. À comparer aux 26 constats de A que B n'a pas (11 + 6 + 9). **[O]**

**(b) Ce qu'elle a inventé ou répété.** 38 des 41 constats de B (93 %) sont ceux de A, souvent avec ses étiquettes
(« D2 », « D3 », « C-01 »). À côté, **13 énoncés faux, invérifiables ou mal sourcés** : opacités 0,91/0,41,
« 50 % pendant toute la montée », `de Stress` ×4, `#3a2a18`, `CardView` écarté, `aria-live` du journal,
« +100 px » attribués à `maquette-mesures.json`, `styles.css:1665`, capture `A-420x900-11` inexistante, ΔE > 60
chez Hearthstone, 16 bordures, deux décisions prêtées à Bastien sans trace, cause du rectangle gris. Trois
prescriptions contredisent une décision ou un commentaire de refus : `block:'center'`, le voile (D-160 (2)),
le journal (D-158 non instruite). Le déséquilibre est net : **le faux est écrit avec la même autorité que le
mesuré**, ce qui est le pire défaut possible dans un document de critique. **[O]**

**(c) Jugement — vaut-elle son coût, et quand ?** Sur cette tâche, **non, pas dans cet ordre**. Lancée **après**
un diagnostic mesuré, elle produit de la mise en forme (Nielsen /40, P0–P3) et un incrément de 1 constat vrai
par écran, au prix de 13 énoncés douteux et de 3 prescriptions contre règlement ; elle ne produit **aucun
ticket** là où A en produisait 10 avec critères d'acceptation. **Avant** le diagnostic, rien dans ces trois
documents ne montre qu'elle aurait trouvé les causes : elle n'a pas trouvé le `z-index` de l'Arrivage, la course
avec le `Suspense`, le défilement de 278 px, ni les 378 mots — elle les a **lus**. Sa valeur réelle est ailleurs :
comme **seconde passe de forme** sur un écran déjà mesuré (elle range, elle nomme, elle propose parfois un test
juste — le plancher SVG), à condition de trois garde-fous : **(1)** lui interdire d'écrire un chiffre non mesuré
(sinon elle en invente), **(2)** la faire relire contre `docs/DECISIONS.md` avant diffusion (sinon elle prescrit
un voile que D-160 (2) interdit), **(3)** refuser tout test qui passe au vert le jour où on l'écrit. Pour les
tickets, elle n'apporte rien : c'est le travail de A, et c'est ce qui a réellement débloqué les trois sujets.

### Observé / déduit

- **Observé [O]** : les 13 vérifications de §1.3, §2.3, §3.3 (fichier:ligne, JSON recomptés, images lues) ; les
  comptes communs / seulement A / seulement B ; l'absence des huit mots du Jeu B dans `docs/` et `src/` ; les
  totaux Nielsen divergents (12 et 18) ; les dépendances `[ouvert]` de l'effet de focus ; `Battle.tsx:1301` ;
  `CardSlot.tsx:49` ; `--scene-parch: #b18a60` ; `POCHETTE.largeur = 300`.
- **Déduit [D], non vérifié** : que B n'a pas eu d'autre source que A + `RARETES.md` (aucune trace de session) ;
  que les « décisions de Bastien » citées par B ont pu être prises dans un canal que je ne vois pas (je dis
  seulement qu'**aucune trace n'existe dans le dépôt**) ; le temps de travail respectif de A et B ; que la
  nomenclature du Jeu B aurait été choisie par B lui-même plutôt que reprise de `RARETES.md` — non, celle-là est
  observée : elle est **mot pour mot** dans `RARETES.md`.
- **Non fait** : rejouer `impeccable critique` moi-même (le binaire et la skill ne sont pas dans mon périmètre) ;
  mesurer 16 bordures ou un ΔE Hearthstone ; ouvrir une session pour vérifier les arbitrages de Bastien.
