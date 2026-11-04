# Diagnostic — la Journée d'intégration (03/11/2026) — rapport de la session « moi »

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `diag-integration/RAPPORT.md`. Le rapport frère de l'autre session,
> `RAPPORT-session-concurrente.md`, **n'est pas archivé** : les renvois qui le nomment désignent
> une pièce absente, de même que les captures et relevés `*.json` cités.

> Demande de Bastien : « rendre la Journée d'intégration mieux faite, moins de texte écrit, avec les
> phrases de la Direction dites par un personnage qui la représente, un peu comme Hearthstone.
> Actuellement on peut être sur une autre page que ce qui nous est décrit. »
>
> **Diagnostic seul** : aucun fichier du dépôt n'a été modifié (`git status --short` vide, voir §0).
> Base : `main` à `1fd8142`. **[O]** = observé (commande, capture, fichier:ligne lu) · **[D]** = déduit.
>
> **Deux sessions ont travaillé en parallèle sur ce même sujet, dans ce même dossier** (§6, friction 1).
> L'autre a écrit un rapport entier, conservé tel quel dans `RAPPORT-session-concurrente.md`
> (md5 `17106145…`). Ce rapport-ci **le recoupe, ne le recopie pas** : chaque désynchronisation D1–D9 de
> l'autre a été **revérifiée de mon côté** par mes propres sondes (`moi/`), je dis lesquelles, et j'ajoute
> ce qu'il n'a pas vu (A1–A6, §1.3). Là où nos deux sessions concordent, c'est une confirmation
> indépendante.

## 0. Ce qui a été lancé (commande, exit, extrait)

| Commande | Exit | Extrait |
|---|---|---|
| `VITE_SUPABASE_URL=https://fauxprojet.supabase.co VITE_SUPABASE_ANON_KEY=<factice> node node_modules/.bin/vite --port 5191 --strictPort` (pid **2272**) | serveur | `ss -ltnp` : `*:5191 … pid=2272` ; `curl` → `200` |
| `node moi/probe-a.mjs 420x900` · `1280x800` | 0 · 0 | étapes 1→2, garde, cible ; `erreurs console : 0` |
| `node moi/probe-b.mjs 420x900` · `1280x800` | 0 · 0 | reprise, étapes 2→3, combat guidé, pas-à-pas 1/5→5/5 ; `erreurs console : 0` |
| `node moi/probe-c.mjs 420x900` | 0 | URL directe, flèche du combat, Échap, retour arrière ; `erreurs console : 0` |
| `npx vitest run` (7 fichiers : `journee-etapes`, `JourneeIntegration`, `.ecran`, `journee-cible`, `journee-gestes`, `pas-a-pas-combat-etapes`, `repliques-direction`) | 0 | `Test Files 7 passed (7) · Tests 64 passed (64)` |
| `npx impeccable detect --json src/components/JourneeIntegration.tsx src/components/CartesJournee.tsx src/components/PasAPasCombat.tsx` | 0 | `[]` |
| `npx impeccable detect --json --viewport 420x900 http://localhost:5191/` (Journée ouverte) | 0 | 3 constats, tous sur `body` (`dark-glow`, `radial-halo`, `repeating-stripes-gradient` advisory) : **aucun sur la Journée** |
| outil Skill `impeccable` | **refus** | `Permission denied: skill` — voir §2 |
| `node --experimental-strip-types` (comptage des mots de `journee-etapes.ts`) | 0 | 47/52/36/50/59 mots « données » par étape |
| `gh issue list --state open --search "intégration"` · `"tutoriel"` | 0 | #636 (Discord) et #495 (export/import) : **aucun ticket ouvert sur la Journée** |

Captures **de cette session** : `moi/captures/` du dossier de travail, **non archivées** (`A-420x900-*`, `A-1280x800-*`,
`B-…`, `C-…`, `options-personnages.png`) + `*.json` (relevés : chemin, h1, texte du panneau, rectangle de la
cible, `elementFromPoint`). Captures **de l'autre session**, réutilisées pour les étapes 4–5 et la scène de
fin : `captures/backend-simule-420x900-depuis-combat/` du même dossier, **non archivées** (`06` fin, `07` étape 4,
`09` étape 5) et `…/backend-simule-1280x800/`. Biais du banc : Supabase simulé par `page.route`
(la Collection reste à 0 % après l'Arrivage simulé : **artefact**, rien n'en est conclu) ; `reducedMotion:
'reduce'` fait passer l'Arrivage directement à la révélation.

## 1. Le parcours, étape par étape

### 1.1 Texte à l'écran (mesuré sur le DOM rendu, 420 × 900)

`innerText` du panneau : **80 / 85 / 69 / 79 / 100** mots ; moins le texte `sr-only` (7 mots) =
**73 / 78 / 62 / 72 / 93 = 378 mots visibles** pour les cinq étapes [O, `moi/captures/*.json`, recoupe
l'autre session]. Le test ne voit pas cela : `motsDeLEtape` (`journee-etapes.ts:142`) ne compte que
titre + texte + action + réplique, soit **36 à 59** (`journee-etapes.ts` : 47/52/36/50/59) [O].

Puis, **avant la première partie libre** : le pas-à-pas du combat, **205 mots** (51/39/36/38/41,
`pas-a-pas-combat-etapes.ts`, mesuré), un bandeau « Combat guidé » de 24 mots (`Battle.tsx:1025`), et six
étapes « Les règles en une minute » rangées dans Réglages. **≈ 600 mots** lus pour apprendre un geste qui,
sur la fin scriptée, tient en un clic [O pour 378 + 205 + 24 ; le reste est de l'autre session].

La réplique de la Direction fait **10 à 17 mots**, rendue en italique gris, **36 px** de portrait
(`JourneeIntegration.tsx:280`), **après** la consigne, qui la redit (« Ouvre ton Arrivage » sous « Clique
Ouvrir un Arrivage ») [O, capture `A-420x900-05-apres-rangement.png`].

### 1.2 Tableau écran / texte (420 × 900, Supabase simulé)

| # | Écran réel | Panneau | Écran décrit | Synchro | Preuve |
|---|---|---|---|---|---|
| 1 | `/` | 1/5 L'Arrivage | `/` | ✅ cible y=491 visible | `A-420x900-01` |
| 1′ | `/` **sans** serveur | 1/5, « Suivant » éteint | `/` | ❌ **D1** : « Le serveur du jeu n'est pas configuré » | autre session `sans-backend-420x900/02` |
| 2a | `/` | 2/5 La Collection et le Deck | `/deck` | ❌ **D2** | `A-420x900-06` (relevé #6) |
| 2b | `/deck`, arrivée | 2/5, cible « Decks proposés » à **y=1330**, `scrollY 0` | `/deck` + Collection | ❌ **D3**, **D4** | `A-420x900-07`, `A-1280x800-07` (y=811 pour 800) |
| 2c | `/deck`, clic sur le lien « Collection » | chemin **reste `/deck`** | Collection | ❌ **D4** | `moi/captures/B-420x900.json` (note) |
| 3a | **`/deck`** (scrollY 1269, au milieu de la liste) | 3/5 Le combat | `/battle` | ❌ **D2** | `B-420x900-04` |
| 3b | `/battle?tutoriel=1&scene=fin` | Journée masquée ; pas-à-pas **1/5** + bandeau « Combat guidé » qui se **superpose** | une Pression suffit | ❌ **D5** | `B-420x900-06`, zoom `B-zoom-pas-a-pas-1-haut.png` |
| 4 | `/settings` (après « Continuer ») | 4/5 Tes données | `/settings` | ✅ | autre session `07` |
| 5 | **`/settings`** | 5/5 Le comité | `/comite` | ❌ **D2** | autre session `09` |
| 5b | `/comite` | **aucun panneau** : la Journée s'est fermée | `/comite` | ❌ **D6** | `JourneeIntegration.tsx:322-325` |
| R | `/settings` après « Revoir » | **3/5** « Jouer mon premier combat » | `/battle` | ❌ **D7** | autre session `19` |
| U | `/comite` ou `/settings` par **URL directe** pendant l'étape 3 | 3/5 Le combat | autre | ❌ **D8** | `C-420x900-02`, `-03` |
| B | retour arrière du navigateur depuis `/battle` | `/settings`, 3/5 | — | ❌ **D8** | `C-420x900-07` |

### 1.3 Les désynchronisations, leur cause, et ce qui est nouveau

Confirmés **de mon côté** (même cause, mes propres mesures) : D1 (relevé sans serveur de l'autre session,
relu ; la cause `Home.tsx` / `JourneeIntegration.tsx:194-195` lue), D2, D3, D4, D5, D6, D7, D8 (voir
`RAPPORT-session-concurrente.md` §1 pour leur texte ; je ne le répète pas). Précisions et mesures propres :

- **D2 — l'étape est un compteur, pas une fonction de l'écran.** [O] Cause : `onClick={() =>
  allerAEtape(etape + 1)}` (`JourneeIntegration.tsx:346-348`) ne navigue pas ; seul « Aller au… »
  (`:318-328`) navigue, et la route ne sert qu'à masquer ce bouton (`surLaPage`, `:203`). Les étapes
  **2, 3 et 5** s'ouvrent sur l'écran de la précédente. La 4 n'est juste que parce que `Battle.tsx:1014` fait
  `navigate('/settings')` à la main. C'est **la cause directe** de la plainte de Bastien.
- **D3 — la cible hors fenêtre.** [O] `scrollY 0`, cible y=1330 (420) / 811 (1280×800), 2,5 s après
  l'arrivée ; « Montrer le bouton » la ramène (`scrollY 1014`, y=316). [D pour le mécanisme] `amenerLaCible()`
  (`:137-141`) tourne dans l'effet `[ouvert, etape, pathname]` (`:156-182`) avant que la page paresseuse
  (`Layout.tsx` `Suspense`) pose `data-journee-cible` (`Deck.tsx:354`) ; `document.fonts.ready` est déjà résolu.
- **D4 — la garde interdit ce que le texte nomme.** [O] clic sur `main a[href="/collection"]` →
  `/deck`. Liste blanche `:71-75` (panneau, cible, `.hand`, `.board`, dialogues, `.ouverture`) : ni la barre
  du bas, ni les onglets. Le texte dit « La Collection montre ce que tu possèdes ».
- **D5 (mesure ajoutée).** [O] À 420 px, la ligne du pas-à-pas (`1/5 Le Poste et le Banc | Suivant | Plus`)
  couvre le début du bandeau « Combat guidé… » qui dit presque la même chose : deux textes superposés
  (zoom `B-zoom-pas-a-pas-1-haut.png`). Au bureau, pas de recouvrement (`B-1280x800-06`).
- **D9 (mise en page).** [O] Sur `A-420x900-07`, la bande entre le bas du panneau (y≈308) et le contenu
  (onglets y≈415) est vide : l'espace réservé (`Layout.tsx:195`, `--journee-hauteur`) commence sous
  l'en-tête et le panneau part de y=10. Au bureau, le panneau recouvre le titre de la page
  (`A-1280x800-07`).

**Ce que l'autre session n'a pas écrit** :

- **A1 — D-160 avait posé la dette, D-175 l'a ouverte.** [O] La phrase finale de D-160 : « La fusion des pages
  Collection et Deck est actée **après** ce tutoriel : il s'appuie sur les deux pages actuelles. » D-175
  (02/11) a fusionné ; aucun ticket n'a repris l'étape 2 (titre « La Collection et le Deck »,
  « Aller au Deck », cible `/deck`). D4 en est la conséquence.
- **A2 — un indice d'étape écrit en dur.** [O] `Battle.tsx:1013` : `if (etapeJournee() === 2)
  avancerJournee()` et `:1014` `navigate('/settings')` (qui répète `journee-etapes.ts:86`). Réordonner
  `ETAPES_JOURNEE` casse le combat sans qu'aucun test ne tombe.
- **A3 — un geste peut être déjà fait à l'arrivée.** [D, lu `JourneeIntegration.tsx:192-200` et `:119-125`]
  Un testeur qui a déjà ouvert un Arrivage ou un Deck voit « Suivant » allumé dès l'entrée de l'étape 1 ou 2,
  alors que le texte demande de le faire ; la reprise saute ces étapes en silence (D7 en est l'effet visible).
- **A4 — le mot « bulle » est pris.** [O] `docs/JEU.md` §3, ligne 66 : « l'entrée : la **bulle** présente
  partout » (le comité, D-058, D-097). Mon premier réflexe était « bulle » pour la Direction : à ne pas
  employer à l'UI. L'autre session propose « réplique », qui est le mot de `src/game/repliques-direction.ts`.
- **A5 — la voix de la Direction n'a aucune décision.** [O] `grep -c "réplique" docs/DECISIONS.md` → `0`. Le
  portrait, les répliques de combat et la ligne de la Journée viennent des commits `63c7c27` (30/10,
  « la Direction parle, et provoque ») et `9b1b3b9` (31/10, « la Direction sort de sa bulle »), et d'un
  commentaire « copie validée par Bastien » (`journee-etapes.ts:38`). D-108 ne nomme que le **camp**.
- **A6 — c'est la quatrième passe en sept jours sur le même reproche.** [O] #334 (fermé, 27/10) : « (a) Trop
  rapide, ou trop de texte… moins de phrases, plus de geste » ; puis D-160 (30/10), D-162 et D-163 (31/10),
  et la demande d'aujourd'hui. Chaque passe a mesuré **la source** (nombre de phrases, `secondesDeLecture`),
  jamais **le rendu** ni la correspondance écran/texte : les tests sont restés verts (64/64) pendant que
  les neuf défauts existaient.

## 2. Critique de l'écran (`impeccable`)

La skill est **refusée** (`Permission denied: skill`, absente de la liste de ma session). **Je n'ai pas
contourné ce refus en lisant `.opencode/skills/impeccable/SKILL.md`** : la critique ci-dessous est la
mienne, sur `PRODUCT.md`, `DESIGN.md` et mes captures, avec le **binaire** `impeccable detect`
(autorisé, hors ligne). L'autre session, elle, a lu `SKILL.md` à la main et rend **18/40** (cohérence 1,
esthétique 1) ; je ne vois rien qui contredise ce total, mais **je ne l'ai pas rejoué** : à prendre comme
sa note, pas la mienne. Mode de la surface : **Operate** (premier parcours, pouce, pause au travail).

| Constat | Preuve |
|---|---|
| **Le panneau décrit un écran où l'on n'est pas** : le défaut qui définit la Journée | D2, D8 |
| **Trois niveaux de texte pour une idée** : titre, consigne de 27 mots, réplique de 16 qui la redit, ligne de geste en jaune | `A-420x900-05` |
| **La voix du jeu est une note de bas de page** : 36 px, italique gris, après la consigne ; la scène de fin (`06-battle-fin`), elle, est déjà « Hearthstone » | `A-420x900-05`, autre session `06` |
| **Un bloc fixe de 300 px en haut d'un écran de 900** (plus la bande vide) pour 12 mots utiles, sur le bien le plus rare du jeu (D-167, D-171 : la hauteur) | `A-420x900-07` |
| **Deux tutoriels, deux compteurs `N/5`** (3/5 puis 1/5), deux voix, deux « Suivant » | `B-420x900-04` → `-06` |
| **La cible dorée existe** (le bon réflexe : `outline`, jamais une bordure) mais elle est hors fenêtre à l'étape 2 | D3 |
| Ce qui marche : le geste **réel** (on ouvre un vrai Arrivage, on charge un vrai Deck), Échap = pause, `role="region"` + `aria-live`, aucune erreur de console sur tout le parcours | `erreurs console : 0` ×3 |
| **Le détecteur est muet sur tout cela** : sources `[]`, page = 3 constats de fond de `body` | §0 |

Verdict de spécificité : c'est un « coach mark » de SaaS ; ce qui fait le jeu (la Direction qui te nargue)
est le plus petit élément du panneau.

## 3. Direction proposée

### 3.1 Principe : l'étape est une fonction de l'écran

`étape = f(route, faits)`. Chaque étape déclare **sa route**, **sa cible** et **son fait** ; la réplique
montrée est celle de la première étape non faite **dont la route est la route courante**. Sur une autre
route, la Direction **ne décrit pas l'écran absent** : elle pointe **l'entrée de la barre du bas** qui y
mène (cette entrée devient la cible et la garde la laisse passer). « Suivant » disparaît : le geste fait **est**
le passage. Retour arrière, URL directe, rechargement et « Revoir » donnent alors toujours la réplique de
l'écran où l'on est (D2, D7, D8 tombent par construction ; A2 disparaît avec l'indice en dur). Le saut reste à
un clic et **nomme ce qu'il coûte** (D-136).

### 3.2 Forme (réf. `REFERENCES.md` §2 : répliques de **3 à 12 mots**, la consigne portée par une flèche
+ une zone éclairée + la carte qui luit, **aucune fenêtre modale**)

- Une **réplique** de ≤ 12 mots, **ancrée** à l'élément montré par une pointe, avec un portrait de **≤ 48 px**
  *dans* la réplique (la hauteur est rare : D-167, D-171) ; le grand portrait ne sert qu'à la scène de fin.
- La « zone éclairée » d'Hearthstone = le contour doré existant de `[data-journee-cible]` (déjà un
  `outline`, sans prendre de place) + une pulsation ; **pas de voile** (D-160 (2) l'écarte ; un voile
  `pointer-events: none` passerait la sonde de D-168, mais il amende D-160 (2) — à trancher).
- Plus d'espace réservé ni de panneau en haut : l'en-tête redevient visible, la bande morte disparaît (D9).
- Sur `/battle` : **la même voix** parle sur la scène de fin, sans le pas-à-pas d'une première partie
  (D5) ; un seul compteur, ou aucun.
- Lecteurs d'écran : `role="region"` et `aria-live` restent (D-162 (1)) ; la réplique en est le texte.

### 3.3 Qui parle — trois options, sans trancher

Contraintes : une faction n'est jamais une personne (D-024) ; le camp reste « la Direction » (D-108) ; le
motif de marque est la tasse, « pas un personnage » (`PRODUCT.md`, dérivé, D-176) — le personnage vivrait
**dans la Journée et la scène de fin**, jamais dans la marque. Les cinq cartes ci-dessous existent et ont
leur illustration (`design/illustrations/direction-*.webp`, vues dans `options-personnages.png`) : **aucun
asset ni mot neuf**.

| Option | Carte | Ce que ça raconte | Pour | Contre |
|---|---|---|---|---|
| **A. Le PDG** | `direction-pdg` (signature de la faction) | le patron accueille le nouveau en personne | déjà le portrait actuel (`JourneeIntegration.tsx:12`), même voix que `REPLIQUES_DIRECTION`, continuité avec la fin de combat | le boss fait aussi le tutoriel : brouille D-117 (5) « Journée ≠ tutoriel contre la Direction » |
| **B. Le Chef de cabinet** | `direction-chef-cabinet` (Pressions « Porte fermée », « Note interne ») | le PDG ne parle jamais en direct : son cabinet **transmet** « de la part de la Direction » | c'est littéralement « un personnage qui la représente » ; garde le PDG pour le boss | moins lisible d'un public TCG |
| **C. Le Stagiaire direction** | `direction-stagiaire-direction` (une tasse, des dossiers) | la Direction a **délégué** ton intégration au stagiaire | gag immédiat, rapport évident au café | peu d'autorité pour « contraindre » ; risque de taper sur le plus faible plutôt que sur la posture (DESIGN §5.2 : « on ridiculise la posture ») |

À écarter : le **Chef de projet fantôme** (`direction-chef-projet-fantome`) est l'**adversaire posé sur le
plateau** de la fin scriptée (`B-420x900-06`) : le guide et l'adversaire se confondraient. L'**Assistant
direction** est une variante de B.

### 3.4 Texte cible, chiffré (exemples **non validés**, comptés par script : 10-11 mots chacun)

| Étape (route) | Cible | Réplique (exemple) | Mots |
|---|---|---|---|
| Arrivage (`/`) | bouton « Ouvrir un Arrivage » | « Ouvre un Arrivage. Cinq cartes, ça ne se refuse pas. » | 10 |
| Après l'Arrivage (autre route) | entrée « Cartes » | « Tes cartes sont rangées. Direction « Cartes », en bas. » | 10 |
| Cartes (`/deck`) | « Charger » du Deck proposé | « Charge un Deck proposé. Tu n'es pas payé à la réflexion. » | 11 |
| Combat guidé (`/battle?…scene=fin`) | la Pression | « Une Pression suffit : le bouton bleu. Je te regarde. » | 10 |
| Réglages (`/settings`) | « Créer ma sauvegarde » | « Sauvegarde. Perdre tes cartes serait ton dossier, pas le nôtre. » | 10 |
| Comité (`/comite`) | l'entrée / le mur | « Un défaut ? Un post-it OUF. On l'affichera, c'est tout. » | 10 |

**Cible : ≤ 12 mots par réplique, ≈ 60 mots pour toute la Journée, contre 378 mots visibles aujourd'hui
(−84 %)**, mesurés **sur le DOM rendu** (boutons et lignes d'état compris), et ≈ 10 mots à la scène de fin
au lieu de ≈ 230 (pas-à-pas 205 + bandeau 24).

## 4. Décisions touchées

**À amender si la direction est retenue** (une seule décision datée peut les porter) :

| Décision | Ce qui change |
|---|---|
| **D-160** (2) panneau « posé en haut, sans voile » ; (3) garde : inerte sauf panneau et `data-journee-cible` | la forme devient une réplique ancrée ; la cible peut être une entrée de la barre du bas ; la garde suit |
| **D-162** (3) « sur `/battle` le panneau s'efface, le combat garde son tutoriel » | la Direction parle sur la scène de fin ; le pas-à-pas complet n'y est plus ouvert depuis la Journée |
| **D-163** (1) espace réservé `--journee-hauteur`, (3) « Suivant » action principale, (5) copie | l'espace réservé et « Suivant » disparaissent ; toute la copie change |
| **D-165** (3) étape 1 du pas-à-pas à l'impératif | à restreindre à la vraie première partie (hors fin scriptée) |
| **D-136** « deux phrases au plus et un seul geste » | **compatible** (plus strict) : le test `nombreDePhrases ≤ 2` et `secondesDeLecture ≤ 30 s` est remplacé par « ≤ 12 mots rendus » ; le libellé du saut doit survivre ou être amendé |
| **D-066** forme courte (alpha) / guidée (beta) | la forme pilotée par l'écran **est** la forme guidée, déjà à demi livrée par D-160 : l'acter comme arrivée avant la beta |
| **D-117** (5) Journée et tutoriel contre la Direction « deux choses distinctes » | avec l'option A (ou toute voix qui fait les deux), à confirmer ou amender |

**Dettes déjà présentes, à signaler (pas créées par la demande)** : D-175 jamais répercutée dans l'étape 2
(A1) ; D-179 (6) « le combat, la Collection et le Deck continuent sans réseau » contre l'étape 1 qui bloque
hors ligne (D1) ; D-161 dit « le panneau ne prend pas le focus » alors que `JourneeIntegration.tsx:95` appelle
`panneauRef.current?.focus()` ; `DESIGN.md:468` range encore la Journée parmi les dialogues
`components/ui/dialog.tsx`, faux depuis D-160/D-162.

**Mots qui exigent une décision datée (`AGENTS.md` §1.4, `docs/JEU.md` §3)** :
- un **nom propre** (prénom, surnom) pour le personnage — les trois options l'évitent en gardant
  l'intitulé de la carte ; tout **titre de rôle neuf** (« tuteur », « parrain », « référent ») ;
- **« bulle »** : déjà pris par le comité (A4) → dire « réplique » ;
- « La Direction » comme **locuteur** : couvert par D-108 si la réplique est signée « <intitulé> · la
  Direction », **mais la voix elle-même n'a aucune décision** (A5) : la décision doit **ratifier** « la
  Direction parle » (ton : une phrase, sèche, jamais une insulte, « un dossier, jamais une personne » —
  `repliques-direction.ts`) ;
- **aucune règle de jeu ne bouge** : la référence Hearthstone ne vaut que pour la forme (aucun pourcentage,
  aucune règle copiée) ; à écrire dans la décision pour que le miroir de TCG Pocket (D-018, D-020) tienne.

## 5. Tickets (titre + critère d'acceptation vérifiable)

Ordre : 0 → 1 (le test rouge d'abord) → 2 → le reste.

0. **Décision : qui parle pour la Direction, et la forme de la Journée.** AC : une ligne datée dans
   `docs/DECISIONS.md` (choix A/B/C ; voile oui/non ; amendements D-160 (2)(3), D-162 (3), D-163 (1)(3)(5),
   D-165 (3), position sur D-066 et D-117 ; ratification de « la Direction parle »), puis
   `npm run index:decisions` et `npx vitest run scripts/gardes/decisions.test.ts` verts. *(Hors périmètre
   d'un agent codeur : AGENTS.md interdit de toucher `docs/DECISIONS.md` sans la décision de Bastien.)*
1. **Garde : la Journée reste sur l'écran qu'elle décrit** (rouge avant tout). AC : un test rend `App` avec
   les **vraies routes** (pas `path="*"`) et parcourt `/` → `/deck` → `/battle?tutoriel=1&scene=fin` →
   `/settings` → `/comite`, plus retour arrière, URL directe, rechargement et « Revoir » ; à **chaque état**,
   la cible désignée existe **sur la route courante** ou est l'entrée de la barre du bas qui y mène. « Le
   contrôle mord » : un mutant « Suivant = étape + 1 sans navigation » fait tomber le test, et une entrée
   commentée dans `scripts/ci/garde-fous.mjs` (ticket, règle, test ciblé) le mute via `npm run garde-fous`.
2. **L'étape se déduit de la route et des faits** (supprime « Suivant »). AC : `grep -n "etapeJournee() === 2"
   src/pages/Battle.tsx` → aucune occurrence ; `journee-etape.ts` ne porte plus de compteur écrit par un
   bouton ; le ticket 1 passe ; « Revoir » commence à la première étape et ne saute rien en silence (A3).
3. **La réplique ancrée remplace le panneau.** AC : `npm run capturer` étendu à la Journée ouverte à
   360×640, 390×664, 420×900, 1280×800 : `elementFromPoint` au centre de la cible = la cible (jamais la
   réplique), en-tête visible, aucune bande vide > 16 px, cible **dans la fenêtre** à l'arrivée sur une page
   paresseuse (D3), cibles tactiles ≥ 44 px, `role="region"` + `aria-live` conservés.
4. **Le texte de la Journée tient en ≈ 60 mots.** AC : un test compte les mots **rendus** (DOM, boutons et
   lignes d'état compris) : ≤ 12 par réplique, ≤ 70 au total ; `motsDeLEtape` aligné sur le rendu ; « le
   contrôle mord » avec une réplique de 13 mots ; mots interdits et vocabulaire de `journee-etapes.test.ts`
   conservés.
5. **Le combat de la Journée : une réplique, pas le pas-à-pas d'une première partie.** AC : sur
   `?tutoriel=1&scene=fin` entré **depuis la Journée**, aucun compteur `N/5` du pas-à-pas, aucun bandeau
   « Combat guidé » superposé (capture 420×900 : pas de texte qui en couvre un autre), la réplique désigne
   la Pression ; l'entrée **depuis Réglages** garde le pas-à-pas complet ; `Battle.tutoriel.test.tsx`
   couvre les deux.
6. **L'étape « Cartes » suit D-175.** AC : l'onglet Collection n'est nommé que s'il est cible ou atteignable
   (test : clic pendant l'étape) ; la cible entre dans la fenêtre à l'arrivée (sonde `probe-a` : `dansLaFenetre
   = true`, `couverte = false` à 360×640, 420×900, 1280×800).
7. **Hors ligne ou sans serveur, l'Arrivage ne bloque pas la Journée.** AC : configuration absente ou
   `navigator.onLine = false` → la réplique le dit et l'étape suivante est atteignable ; le libellé du saut
   ne promet pas de perdre « le combat » à l'étape 1 ; test avec `definirSourcesArrivage` en `hors-ligne`.
8. **La Journée se dit sur le comité.** AC : à l'arrivée sur `/comite` depuis l'étape 5, la réplique est
   rendue **avant** que la Journée se termine (`terminer()` n'est plus appelé dans le même `onClick` que
   `navigate`, `:322-325`) ; test d'écran.
9. **Un banc de preuve de la Journée dans le dépôt.** AC : `npm run parcours:journee` (ou une option de
   `capturer`) rejoue la Journée avec un Supabase simulé (`page.route` + session factice), écrit une planche
   par étape, et **échoue** si la route d'une capture diffère de la route décrite ; amorçage `version`
   lu de `STORAGE_VERSION` (`useStore.ts:104`), pas écrit en dur.
10. **Nettoyages.** AC : `DESIGN.md:468` corrigé ; `PRODUCT.md` re-dérivé après le ticket 0 ; D-161 « focus »
    tranché face à `JourneeIntegration.tsx:95` ; code mort `premiere === -1 ? … : premiere`
    (`JourneeIntegration.tsx:123-124`) retiré ; `npm run check`, `npm run format:check` et les tests
    concernés verts.

## 6. Frictions d'environnement

1. **Une autre session travaillait sur le même sujet, dans le même dossier, au même moment.** [O] La
   consigne disait « une tentative précédente a été annulée » ; or `ps` montrait, à 19:42-19:46, un `vite
   --port 5191` (pid 4186510, parent `opencode serve`), un `node parcourir.mjs` actif et un
   `mv captures/backend-simule-420x900 …` lancé **pendant que je lisais** ce dossier ; un second `vite` sur le
   port **5192** (pid 4187252) n'était pas à moi. Elle a fini par écrire son propre `RAPPORT.md` (19:50, 26 767
   octets). **Je ne l'ai pas arrêtée** (hors de ma consigne), j'ai travaillé dans `moi/` et je n'ai pas
   touché à ses processus. Conséquences : double travail ; risque d'écrasement du livrable (j'ai copié le sien
   en `RAPPORT-session-concurrente.md` avant d'écrire celui-ci) ; **mon serveur (pid 2272, lancé à 19:47) a
   disparu** : l'autre session le décrit comme « un serveur fantôme » qu'elle a arrêté par `kill 2272`
   — c'était le mien (même pid, mêmes variables factices). Deux sessions qui croient chacune posséder le
   port 5191 se tuent mutuellement ; le dossier de sortie est resté partagé.
2. **Aucun outil du dépôt ne parcourt la Journée.** [O] `capturer.mjs:13` amorce `tutorielVu: true` sur
   toutes les pages et ne garde que `premiere-visite.png` (étape 1, sur `/`) : **quatre étapes sur cinq
   n'ont jamais été photographiées en CI**. `parcours.mjs` et `jouer-partie.mjs` n'ouvrent pas la Journée.
   Chaque session a donc écrit ~400 lignes jetables (`parcourir.mjs`, `moi/lib.mjs`) — d'où le ticket 9.
3. **Sans backend, la Journée est impraticable** [O] : `.env` n'a ni `VITE_SUPABASE_URL` ni
   `VITE_SUPABASE_ANON_KEY` (variables `SUPABASE_*` seulement) ; l'étape 1 affiche « Le serveur du jeu n'est
   pas configuré ». Contournement : URL et clé factices au lancement de Vite + session posée dans
   `localStorage` (`sb-fauxprojet-auth-token`) + `page.route` sur Auth, REST et `functions/v1/ouvrir-arrivage`.
   Un dev local propre ne peut pas faire la Journée : PRODUCT.md promet pourtant que « le mode local
   fonctionne sans configuration ».
4. **Garde absente** — celle qui aurait empêché la désynchronisation : `JourneeIntegration.ecran.test.tsx:40-45`
   rend chaque étape sous une route attrape-tout (`<Route path="*" element={<p>l'écran ouvert</p>} />`) ;
   `JourneeIntegration.test.ts` lit **la source** par expressions régulières ; `journee-etapes.test.ts:114-145`
   vérifie que la route **existe** dans `App.tsx`, pas que la cible est à l'écran quand l'étape s'affiche.
   Résultat : **64/64 verts** (`npx vitest run`, exit 0) pendant que D1–D9 existent. Le détecteur d'UI
   (`[]`, exit 0) ne peut rien y voir ; D-168 l'a déjà dit d'un scan muet.
5. **Skill `impeccable` refusée** (`Permission denied: skill`) alors que la consigne la demande ; elle n'est
   pas dans la liste de ma session (code-review, codebase-design, diagnosing-bugs, prototype, tdd). Je ne
   l'ai pas contournée en lisant son `SKILL.md` ; l'autre session l'a fait. À trancher : le refus est-il
   voulu, ou la liste est-elle incomplète ?
6. **`[data-ouvrir]` / `[data-tout-afficher]`** : mes clics ont expiré (4 s) sous `reducedMotion: 'reduce'` ;
   l'Arrivage s'ouvre alors directement à « 5 / 5 retournées » (`A-420x900-02`). Pas un défaut du produit, un
   piège du banc ; l'autre session a eu les mêmes timeouts.
7. **`node --experimental-strip-types` ne résout pas l'alias `@/`** [O] : `pas-a-pas-combat-etapes.ts`
   (importe `@/components/journee-etapes`) échoue en `ERR_MODULE_NOT_FOUND` ; textes comptés par expression
   régulière à la place. `journee-etapes.ts`, sans import alias, passe.
8. **`gh issue view` sans `--json`** échoue (AGENTS.md §7) : respecté. **Aucun ticket ouvert sur la
   Journée** : les tickets fermés #130, #334 (et #272) portent l'historique.
9. **Persistance amorcée** : j'ai écrit `version: 18` en dur dans `moi/lib.mjs` (lu de `useStore.ts:104`) ;
   `capturer-socle.mjs:29` l'omet à dessein. Écrire la version dans un banc est le piège que la règle
   « ne jamais écrire une version en dur » vise : à lire à la source dans le ticket 9.
10. **`vite` en dev** écrit dans `node_modules/.vite` du dépôt partagé (« Re-optimizing dependencies ») :
    sans effet sur `git status`, mais cache commun à toutes les sessions sur `main`.

## 7. Observé / non vérifié

- **Observé** : D1–D9, A1–A2 et A4–A6 (lecture du code, captures, relevés, `grep`), les mots affichés, les
  64 tests verts, `impeccable detect`.
- **Déduit, non vérifié** : le mécanisme exact de D3 (condition de course entre l'effet et la page
  paresseuse) ; A3 (geste déjà fait à l'arrivée : lu, pas rejoué avec un store déjà rempli) ;
  l'effet du geste « retour » d'Android ; qu'un voile `pointer-events: none` passe la sonde de D-168 (lu
  dans D-168, pas testé) ; la note 18/40 (celle de l'autre session, non rejouée).
- **Non fait** : aucune planche de frames d'animation (le diagnostic ne touche pas aux animations) ; pas de
  parcours à 360 × 640 ni 390 × 664 (420 × 900 et 1280 × 800 seulement).
