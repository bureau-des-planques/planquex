# Lot `sorties-2026-10-28` — inventaire des sorties et ce que font les autres (#426)

Lot **de constat**, pas de correction : aucun écran n'est modifié ici (#427 pour le combat,
#428 pour le retour partout). Ticket #426, part of #425. Date de la mesure : **28/10/2026**.

## 0. Méthode

- **État mesuré** : `main` après fusion de `origin/main` (merge `0e38294`, #423 D-143 et #432 D-142 inclus).
  Build réel : `npm run build` (sous `flock`), servi par `npx vite preview --port 4194 --strictPort`.
- **Pilotage** : `playwright-core` + Chromium (`/opt/pw-browsers/chromium`), 420 × 900 et 360 × 640.
  Script : `mesure-gestes.mjs` (même dossier). Commande :
  `node docs/preuves/sorties-2026-10-28/mesure-gestes.mjs http://localhost:4194 420 900`
  (idem `360 640`). Sorties brutes : `mesure-420x900.json`, `mesure-360x640.json`.
- **Geste** = un clic ou un tap sur un contrôle, **ou** un « retour » du navigateur. Chaque chemin
  est exécuté et son arrivée vérifiée sur l'URL. Aucun chiffre n'est estimé.
- **Accueil** : la « Journée d'intégration » de première visite est fermée par `Échap` **sans être
  comptée**. Le combat est joué jusqu'au plateau (« Affronter la Direction »).
- **Garde** : `src/sorties.test.tsx`, qui rend les routes réelles de `App` (jsdom).

## 1. Inventaire — une ligne par route

Légende : **B** = barre du bas, **E** = engrenage (en-tête), **M** = bulle du comité,
**⋯** = menu du combat, **N** = bouton du navigateur. « Corps » = lien dans le contenu de la page.

| Route | Écran | Voies de sortie | Cul-de-sac ? | Verdict |
|---|---|---|---|---|
| `/` | Accueil | B (Accueil), E, M | non | **garde** — point de retour de référence |
| `/collection` | Collection | B, E, M ; Corps → `/deck` | non | **garde** |
| `/deck` | Deck | B, E, M ; Corps → `/collection` | non | **garde** |
| `/battle` | Combat | `←` (`.battle__sortie`, un geste) ; N ; **pas de B**, **pas de E** en écran court ; ⋯ sans « quitter » | **oui, partiel** : en pleine action, aucune navigation ailleurs | **cul-de-sac partiel** → #427 |
| `/battle?tutoriel=1` | Combat guidé | comme `/battle` ; `←` nommé « Quitter le combat guidé » | oui, partiel (même cause) | idem → #427 |
| `/comite` | Mur | B, E, M (le mur n'a pas de M sur soi-même : la bulle mène au suivi) ; Corps « Retour au bureau » | non | **garde** |
| `/comite/suivi` | Suivi | B, E ; Corps « Retour au bureau » ; **M absente** (par conception) | non | **garde** |
| `/settings` | Réglages | B, E ; Corps → `/battle?tutoriel=1`, `/confidentialite`, `/feuille-de-route`, `/attente`, `/administration`, `/connexion` (selon le compte) | non | **garde** |
| `/attente` | Attente (compte) | B, E ; Corps « Retour au bureau » | non (route de compte) | **garde** — atteignable seulement en build configuré |
| `/administration` | Administration (compte) | B, E ; Corps « Retour au bureau » (×2) | non (route de compte) | **garde** — idem |
| `/confidentialite` | Confidentialité (hors `Layout`) | **aucune B, M, E** ; Corps « Retour au bureau » seulement | **voie unique**, dans le corps | **à surveiller** → #428 |
| `/feuille-de-route` | Feuille de route (hors `Layout`) | **aucune B, M, E** ; Corps « Retour au bureau » seulement | **voie unique**, dans le corps | **à surveiller** → #428 |
| `/installation` | Installation (hors `Layout`) | **aucune B, M, E** ; Corps « Retour au bureau » ; **aucun lien interne entrant** | voie unique + **orpheline** | **cul-de-sac** (inatteignable depuis l'accueil) → #428 |
| `/connexion` | Connexion (hors `Layout`) | **aucune B, M, E** ; Corps « Retour au bureau » (sans base) | voie unique ; **atteignable seulement** avec un compte configuré | **cul-de-sac** en build sans base → #428 |
| `*` | Introuvable | Corps « Retour à l’accueil » | non | **garde** |
| `/parc`, `/chariot`, `/idees`, `/nouveautes` | Redirections (D-075, D-097) | pas un écran : `Navigate` vers la cible | — | hors inventaire d'écran |

Remarques de constat :

- **Le menu `⋯` du combat ne propose pas de quitter.** Mesuré (420 et 360) : entrées
  `Journal`, `Partie à deux`, `Règles`, `Abandonner`, `Nouveau combat`. `Abandonner` est un forfait
  (défaite), pas une sortie ; il ouvre une confirmation.
- **Barre du haut** : en écran court (`max-width: 899px`, `styles.css` « Combat : écran court »), la
  barre du haut est `display: none` sur `.battle` ; l'engrenage « Réglages » n'apparaît pas dans les
  contrôles visibles du combat mesurés (420 et 360). Constat CSS + mesure, pas une capture.
- **Bulle du comité** : présente sur toutes les pages `Layout` sauf le combat et le suivi, et
  **seulement** quand elle a quelque chose à dire (`AlerteComite`) : elle n'est jamais un retour.
- **`ErreurDeRendu`** : un lien `href="/"` (rechargement complet) remplace l'écran en erreur.

## 2. Gestes — de l'accueil à l'écran, et retour

Mesure réelle, `mesure-gestes.mjs`. « Aller » = gestes depuis l'accueil. « Retour (contrôle) » =
gestes du chemin de retour offert par l'interface. « Retour (N) » = pas de bouton navigateur.

| Écran | Aller 420×900 | Retour 420×900 | Retour (N) 420×900 | Aller 360×640 | Retour 360×640 | Retour (N) 360×640 |
|---|---|---|---|---|---|---|
| Collection | 1 (B) | 1 (B) | 1 | 1 | 1 | 1 |
| Deck | 1 (B) | 1 (B) | 1 | 1 | 1 | 1 |
| Combat | 1 (« Affronter la Direction ») | 1 (`←`) | 1 | 1 | 1 | 1 |
| Comité (mur) | 1 (B) | 1 (B) | 1 | 1 | 1 | 1 |
| Comité — Le suivi | 2 (B + sous-onglet) | 1 (B) | 2 | 2 | 1 | 2 |
| Réglages | 1 (E) | 1 (B) | 1 | 1 | 1 | 1 |
| Confidentialité | 2 (E + lien) | 1 (« Retour au bureau ») | 2 | 2 | 1 | 2 |
| Feuille de route | 1 (« Voir toutes les versions ») | 1 (« Retour au bureau ») | 1 | 1 | 1 | 1 |
| Installation | **pas de chemin** (aucun lien interne) | — | — | — | — | — |
| Connexion | **pas de chemin** en build sans base | — | — | — | — | — |

Arrivée vérifiée sur chaque chemin (`arriveeOk` : vrai partout), aucune erreur de page
(`erreursPage` vide). Installation, Connexion, Attente et Administration : saisie d'adresse seule
(`sansLien` : Installation 1 lien vers `/`, sans barre ; Connexion 1 ; Attente et Administration
2 liens et la barre, car ces écrans ne s'ouvrent qu'avec un compte configuré).

## 3. Culs-de-sac nommés

1. **Combat (`/battle`) — navigation en pleine action absente.** Une seule voie de sortie (`←`),
   qui quitte la partie (gardée, D-142). Pas de barre, pas d'engrenage en écran court : Comité,
   Réglages, Deck et Collection ne sont joignables qu'après être sorti. → **#427**.
2. **Hors `Layout` (`/confidentialite`, `/feuille-de-route`, `/installation`, `/connexion`) —
   voie unique dans le corps.** Pas de barre, pas de bulle, pas d'engrenage ; seul « Retour au bureau »
   dans le contenu. Position de ce bouton dans la première vue : **non mesurée** (voir § 6).
   → **#428**.
3. **`/installation` — orpheline.** Aucun lien interne n'y mène ; la note de release la désigne hors
   de l'application. Un cul-de-sac *et* une route inatteignable depuis l'accueil : c'est l'exception
   nommée dans `src/sorties.test.tsx`.
4. **`/connexion` en build sans base — orpheline.** Seul écran à lien d'accueil, atteignable
   uniquement si un compte est configuré (`GardeComptes`) : exception nommée dans le test.

## 4. Recherche — trois références

Jeux de cartes mobiles comparables. Sources **primaires** quand elles sont accessibles ; les
citations ci-dessous indiquent le niveau de preuve. Aujourd'hui (28/10/2026) :
`support.pokemon.com` renvoie **HTTP 403** à l'outil de lecture ; `yugipedia.com` aussi. Le réseau
est disponible, mais ces deux sources n'ont pas pu être relues cette session.

### 4.1 Pokémon TCG Pocket — sortie d'une partie et navigation

- Menu : « rightmost button at the bottom of the screen » (FAQ gameplay, mise à jour **30/07/2026**,
  transcrite dans `docs/preuves/references-ui-2026-10-27/pokemon-pocket.md`, S4/S5, **primaire**,
  relue en 2026-10-27, non relue aujourd'hui).
- Combat : « forfait » figure dans la ligne **Combat** du tableau de `pokemon-pocket.md` (ligne 102).
  La source exacte de cette ligne n'est pas renseignée dans le lot : **non vérifiée**.
- Ce qu'on **garde** : un **menu unique**, toujours au même endroit, qui regroupe les réglages —
  la leçon de Pocket est la constance de l'emplacement, pas la barre complète.
- Ce qu'on **rejette** : la barre du bas en combat. Pocket la garde (menu en bas à droite) ; chez
  nous le plateau est mesuré trop haut pour une barre à 360 × 640 (`battle` CSS, D-094, D-142).

### 4.2 Hearthstone — sortie d'une partie et navigation en pleine action

- Menu de partie : icône en **bas à droite**, « available at any time » ; entrées **Concede**
  (abandon de la partie), **Leave** (ne quitte que le mode spectateur), **Options**, **Quit**
  (quitte le jeu). Source : Hearthstone Wiki, page *Game Menu* (`hearthstone.wiki.gg/wiki/Game_Menu`,
  **secondaire**, communautaire, consultée 28/10/2026).
- Abandon : « conceding ends the match in the opponent's favor ». Même source (**secondaire**).
  Un avertissement apparaît si l'abandon fait perdre une progression de quête
  (Out of Games, patch 22.2.0, **secondaire**).
- Sortie de secours : « la sortie de secours doit rester atteignable même si l'on n'a pas fini le
  parcours guidé » — inférence de notre lot `references-ui-2026-10-27/hearthstone.md` §4.2, appuyée
  sur la note de patch Blizzard **29.4.3** (30/05/2024, **primaire**).

### 4.3 Yu-Gi-Oh! Master Duel — sortie d'un duel

- Recherche seule : une sortie (*surrender*) ne semble pas pénaliser le joueur et se fait sans délai
  (Sportskeeda, **secondaire**). Yugipedia (page *Surrender*, **403**) n'a pas été relue.
- Commandes : « Some buttons are displayed on screen to various parts of the field or while
  navigating through the menus » (Konami, support, transcrit dans `references-ui-2026-10-27/yu-gi-oh.md`,
  **primaire**) : les boutons de navigation restent **sur l'écran de jeu**, pas dans un menu caché.
- Ce qu'on **garde** : des boutons de navigation **visibles sur le plateau** (Konami) — chez nous le
  `←` du combat est le seul contrôle de ce genre ; il doit donc rester visible.
- Ce qu'on **rejette** : une sortie qui se confond avec le forfait. Chez Master Duel la sortie
  (*surrender*) est un geste à part ; chez nous `Abandonner` est un forfait, et la sortie `←` ne
  l'est pas (D-142). On garde cette séparation.

### 4.4 Tableau de décision

| Ce qu'on **garde** | Raison | Source |
|---|---|---|
| Menu de partie joignable à tout instant, à un emplacement constant | Pocket et Hearthstone le font ; c'est le geste « où est le menu » | Pocket S4 (primaire) ; Hearthstone wiki (secondaire) |
| Sortie de la partie **séparée** de l'abandon (`←` ≠ `Abandonner`) | Hearthstone : Concede = défaite ; Leave ≠ Concede | Hearthstone wiki (secondaire) |
| Sortie de secours atteignable hors parcours guidé | Blizzard 29.4.3 | primaire (lot `hearthstone.md`) |
| Contrôles de navigation **visibles sur le plateau** | Master Duel : boutons affichés sur l'écran | Konami (primaire) |

| Ce qu'on **rejette** | Raison | Source |
|---|---|---|
| Abandon = sortie | Hearthstone : abandonner est une défaite, avec un risque sur les quêtes | Hearthstone wiki ; Out of Games (secondaires) |
| Barre du bas complète en combat | Plateau mesuré trop haut à 360 × 640 ; #275, D-116 | mesure `mesure-360x640.json` ; `styles.css` |
| Sortie immédiate « sans conséquence » comme règle | Source secondaire seule (Sportskeeda) ; on ne s'appuie pas dessus | Sportskeeda (secondaire) |

## 5. La garde qui mord

`src/sorties.test.tsx` (6 tests, 0 échec) :

- **Le contrôle mord** : `cheminsSansRetour` signale une route fabriquée sans lien vers `/` ;
  `cheminsInatteignables` signale une route que personne ne lie ; une exception devenue
  atteignable est signalée comme périmée ; un graphe sain ne signale rien.
- **Sur l'App réelle** : la liste des routes est confrontée à `src/App.tsx` ; chaque route est
  **rendue** depuis l'accueil ; les exceptions nommées (`EXCEPTIONS`) sont exactement celles qui
  restent inatteignables.

## 6. Non vérifié

- Position de « Retour au bureau » dans la **première vue** des pages hors `Layout` (420 × 900 et
  360 × 640) : le script mesure le geste, pas la flottaison.
- Sources primaires Pocket (FAQ, 2026) et Master Duel (Yugipedia) : **non relues aujourd'hui** (403).
- Hearthstone wiki et Out of Games : **secondaires**.
- Aucune capture d'écran de ce lot : le constat est fait par DOM, CSS et gestes.
