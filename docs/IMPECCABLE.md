# Impeccable — mode d'emploi avancé

> **Version 4.7.0** · compétence de design + détecteur déterministe
> Compétence installée dans `.opencode/skills/impeccable/` · binaire épinglé en `devDependency`
> Document de travail, pas une autorité produit : en cas de conflit, l'ordre d'autorité d'`AGENTS.md` §2 tranche.

| Repère | Valeur |
|---|---|
| **Objet** | Concevoir, juger, raffiner, durcir et documenter une interface ; détecter les anti-patterns |
| **Portée** | UI web et natives iOS/Android ; pas le backend seul |
| **Entrée session** | `/impeccable <commande> <cible>` — un seul point d'entrée dans ce dépôt |
| **Entrée CLI** | `npx impeccable <verbe>` ou `.opencode/skills/impeccable/scripts/impeccable <verbe>` |
| **Version** | 4.7.0, Apache 2.0 |
| **Détecteur** | 61 règles déterministes : tells d'UI générée par IA, accessibilité, qualité de design |
| **État du dépôt** | `PRODUCT.md` absent · `DESIGN.md` présent (1<sup>re</sup> passe) · `.impeccable/` présent (un instantané de critique) |

## Sommaire

1. [Deux artefacts, un seul nom](#artefacts)
2. [Le modèle mental](#modele)
3. [Le préalable : le contexte](#contexte)
4. [La boucle en six temps](#boucle)
5. [Les 24 commandes](#commandes)
6. [Le détecteur en profondeur](#detecteur)
7. [La porte CI de ce dépôt](#porte)
8. [Utiliser les commandes dans une session](#session)
9. [Recettes](#recettes)
10. [Pièges et gouvernance](#pieges)
11. [Maintenance](#maintenance)
12. [Fiche mémo](#memo)
13. [Sources](#sources)

---

<a id="artefacts"></a>
## 1. Deux artefacts, un seul nom

`impeccable` n'est pas un linter de plus. C'est **deux artefacts sous un même nom**, et les confondre est la première erreur.

| | La compétence | Le binaire |
|---|---|---|
| **Ce qu'elle est** | Un directeur de design qui planifie, juge, raffine, durcit et documente | Un détecteur d'anti-patterns, utilisable seul en CLI et en CI |
| **Ce qu'elle fait** | Décide et exécute | Mesure |
| **Où** | `.opencode/skills/impeccable/SKILL.md` | `node_modules/impeccable` + le lanceur `.opencode/skills/impeccable/scripts/impeccable` |
| **Entrée** | `/impeccable <commande> <cible>` | `npx impeccable <verbe>` |
| **Sortie** | Code, `PRODUCT.md`, `DESIGN.md`, rapport de revue | Constats, JSON, code de sortie |
| **Déterminisme** | Jugement | 61 règles |

Le binaire ne conçoit rien : il mesure. La compétence ne mesure pas : elle décide et exécute. Le pont entre les deux, ce sont `critique` — qui exige une preuve détecteur + navigateur — et les gardes CI. Gardez cette séparation en tête : elle explique la moitié des règles du système.

> **À retenir.** Un détecteur silencieux n'est pas un détecteur rassurant. Un scan de sources ne voit pas ce qu'un navigateur voit. La compétence le sait, et c'est pour cela qu'elle exige les deux.

---

<a id="modele"></a>
## 2. Le modèle mental

### 2.1 Quatre modes, choisis par surface

Le mode décrit ce que la personne doit réussir **sur cette surface**, pas ce qu'est le produit. L'écran Collection est Operate ; la feuille de route est Read ; une landing publique serait Persuade. L'ambition se règle sur le mode : pleine sur Persuade et Experience, en précision et retenue sur Operate et Read. C'est le garde-fou contre le défaut classique : surdécorer un écran de tâche.

| Mode | Le visiteur | Surfaces typiques | Ambition |
|---|---|---|---|
| **Persuade** | Décide et agit | Landing, marketing, campagne, pricing | Pleine : gagner l'attention et l'action |
| **Operate** | Accomplit une tâche | App, dashboard, éditeur, admin, réglages | Précision, cohérence, attentes natives |
| **Read** | Comprend | Docs, articles, guides, aide, changelog | Structure pour la compréhension, puis plaisir de lecture |
| **Experience** | Est dans l'œuvre | Portfolio, galerie, vitrine | L'artefact mène dès le premier viewport ; l'interface recule |

Le mode se persiste dans le **brief de surface**, pas globalement. Un écran de jeu est Operate ; sa page de présentation est Persuade. Ne transportez pas le mode d'une surface à l'autre.

### 2.2 Trois axiomes qui décident à votre place

1. **Le brief gagne.** Une esthétique épinglée — époque, matériau, police, palette — prime sur un avertissement de saturation. Rediriger un brief clair vers votre goût est un échec, pas une amélioration.
2. **Raffinement préserve, refonte remplace.** Le raffinement garde l'identité, le comportement et la copy hors périmètre. La refonte garde la vérité produit, le contenu, les fonctions et les affordances natives, mais traite l'ancien look comme anti-référence. Interdit : polir le look qu'on jette.
3. **L'autorité visuelle est une preuve, pas un nom de fichier.** L'absence de `DESIGN.md` ne rend pas un projet greenfield. C'est `new-work` qui décide préserver, étendre ou remplacer le monde visuel en place.

### 2.3 Deux règles de conduite

- **Finir le travail.** Le livrable est complet, sauf les assets que l'utilisateur doit fournir. Pas de repli, pas de raccourci, pas de « à peu près ».
- **Les symboles chargés restent hors décoration.** Un univers de sujet n'autorise pas les emblèmes liés au militarisme, au suprémacisme ou à la haine comme motifs, badges ou ornements — y compris leurs variantes stylisées. Le contenu qui documente un tel symbole comme fait reste tel quel.

### 2.4 Le plancher de craft

`craft-floor.md` se lit **juste avant toute édition UI**, y compris une petite retouche — jamais pour du planning seul. Il porte le plancher de qualité, les interdits absolus et les réflexes qu'aucun détecteur n'attrape. C'est la différence entre « ça passe le détecteur » et « ça tient ». Le détecteur est un filet, pas un certificat.

> **Piège classique.** Lire `craft-floor.md` au début d'une session de planification, puis l'oublier au moment d'éditer. La référence se charge **au moment de l'édition**, pas avant.

---

<a id="contexte"></a>
## 3. Le préalable : le contexte

### 3.1 Une fois par session

```bash
.opencode/skills/impeccable/scripts/impeccable context --target <fichier-ou-route>
```

`context` charge `PRODUCT.md`, `DESIGN.md`, le brief de surface et les conseils natifs quand ils s'appliquent. Il résout aussi le répertoire de base qui sert à toutes les commandes. **Suivez ses directives et ne le relancez pas.** Gardez le répertoire de travail à la racine du projet, pas dans le dossier de la compétence.

Si le lanceur refuse ou échoue, envoyez **d'abord un message séparé** (« Context loading did not run; I'll read the existing project context directly »), puis lisez `PRODUCT.md` et `DESIGN.md` sans inventer ce qui manque. Un échec du lanceur ne bloque ni le planning ni l'édition.

### 3.2 L'état réel de ce dépôt

| Élément | État | Conséquence |
|---|---|---|
| `PRODUCT.md` | Absent | `context` répond `NO_PRODUCT_MD` ; une nouvelle surface ou un remplacement visuel passe par `init` d'abord |
| `DESIGN.md` | Présent, première passe, structure maison | `document` ne l'écrase pas en silence ; les jetons vivent dans `src/styles.css` |
| `.impeccable/` | Présent : un instantané de `critique` sur `/collection` | Pas encore de config détecteur ni de hooks ; l'instantané est une archive de revue, pas une autorité |
| Scan source | `[]` sur 326 fichiers au dernier passage | Sous-comptage assumé : ce n'est pas un brevet de propreté |
| Porte CI | 12 écrans, plafond `BASELINE` | `npm run detect:ui:page` reste la mesure qui compte |

### 3.3 Trois commandes de contexte, trois rôles

| Commande | Écrit | Ne fait pas |
|---|---|---|
| `init` | `PRODUCT.md` : usagers, marque, principes | Ne crée pas `DESIGN.md` ; peut créer `.impeccable/live/config.json` sur un projet web runnable |
| `document` | `DESIGN.md` : jetons normatifs + huit sections canoniques | N'écrase jamais en silence : demande refresh, overwrite ou merge |
| `extract` | Consolidation des motifs et jetons réutilisables | Ne remplace pas une refonte ; six étapes, de la découverte à la documentation |

Précisions utiles :

- `init` fait une **interview en plusieurs rounds** quand le contexte manque. Il met à jour un `PRODUCT.md` existant plutôt que d'en créer un concurrent.
- `document` suit le format officiel : frontmatter YAML (les jetons sont **normatifs**, la prose explique comment les appliquer), puis jusqu'à huit sections dans un ordre fixe. Les ombres, le motion et les focus rings passent dans le **sidecar**, pas dans les sous-jetons de composant (limités à huit propriétés).
- `document` a deux chemins : **scan** (le projet a du code, des jetons ou du rendu) et **seed** (`--seed`, projet pré-implémentation). En cas de doute, scan d'abord ; si rien n'est trouvé, proposer seed sans basculer en silence.
- `teach` est un alias de `init`. `craft` est un alias déprécié de new-work, sans comportement supplémentaire.

> **Conséquence pratique.** Sur ce dépôt, une **nouvelle surface** ou une **refonte visuelle** commence par `init`. Un **raffinement étroit** de l'existant peut démarrer sur l'implémentation en place et proposer `init` ensuite — ne bloquez pas une retouche pour cela. Après `init`, reprenez **sans relancer** `context`.

---

<a id="boucle"></a>
## 4. La boucle en six temps

| # | Phase | Commandes | Ce qu'on y gagne |
|---|---|---|---|
| 01 | **Contexte** | `init` · `document` · `extract` | La vérité produit et le système visuel, avant les pixels |
| 02 | **Plan** | `shape` | Un brief et une direction résolus, pas des suppositions |
| 03 | **Construire** | new-work + `craft-floor` | Un monde visuel qui tient, pas un assemblage |
| 04 | **Évaluer** | `critique` · `audit` | Un jugement UX et une vérification technique séparés |
| 05 | **Raffiner** | `polish` · `bolder` · `quieter` · `distill` · `onboard` | Une surface finie, calibrée, accueillante |
| 06 | **Durcir** | `harden` · `adapt` · `optimize` | Une surface qui survit à la production |

### 4.1 Construire — capturer la vérité avant les pixels

`shape` ouvre la découverte quand elle manque : **deux rounds** d'interview (but, personnes, résultat ; matière, comportement, limites), résolution de direction, brief écrit, puis arrêt. `shape` possède la découverte ; `new-work` possède le monde visuel. Une nouvelle surface ou un remplacement visuel passe par `init`, puis `new-work`. Un système visuel cohérent mais non documenté passe par `document`. Une refonte passe par `new-work`, qui remplace `DESIGN.md` ; `init` préserve la vérité produit.

### 4.2 Évaluer — deux vérités différentes

`critique` est un **jugement UX** sur une cible stable. Son invariant est dur : évaluation A (revue design) et B (détecteur + navigateur) doivent tourner en **deux sous-agents isolés** dès que l'outil existe — c'est le cas ici. A doit finir **avant** que les constats du détecteur entrent dans la synthèse, parce qu'un constat déterministe ancre quand même le jugement. Si vous dégradez, la première ligne du rapport doit être `⚠️ DEGRADED: single-context (<raison>)` ; un critique dégradé silencieux est un critique raté. Sur natif, A seul. La réponse en chat est le livrable ; l'instantané persisté n'est qu'une archive. À la fin, `critique` demande ce qu'on veut améliorer ensuite.

> **Limite observée dans ce harnais.** Le lanceur peut être refusé aux sous-agents, et un sous-agent peut ne pas avoir d'outil navigateur. Si B ne peut pas produire la preuve, dites la dégradation au lieu de la masquer ; le rapport doit commencer par la bannière.

`audit` est la **vérification technique** : accessibilité, performance, théming, responsive, et **intégrité d'implémentation**, l'axe critique. Il produit un score de santé, un verdict, une synthèse, des constats par sévérité, des motifs systémiques et des actions. `critique` répond « est-ce que ça se comprend et se décide ? » ; `audit` répond « est-ce que c'est construit correctement ? ». Les deux avant une refonte sérieuse.

### 4.3 Raffiner — propre n'est pas robuste

`polish` est la passe finale en cinq temps : établir le système, réunir les preuves, trier, polir tout le chemin (flux et hiérarchie, layout et type, couleur et imagerie, interaction et état, contenu et code), vérifier et finir. `harden` traite la réalité de production sur **sept dimensions** : débordement de texte, i18n, erreurs, cas limites, validation, résilience a11y, résilience performance. Un écran peut être poli et casser en allemand ou sur un nom de 80 caractères.

`bolder` et `quieter` calibrent l'intensité ; `distill` soustrait ; `onboard` traite le premier lancement, les états vides et l'activation.

### 4.4 Améliorer, corriger, itérer

Les interventions ciblées (`animate`, `colorize`, `typeset`, `layout`, `delight`, `overdrive`) supposent une surface qui tient déjà. Les correctifs (`clarify`, `adapt`, `optimize`) traitent copy, responsive et performance. `live` fait choisir l'élément par un humain dans le navigateur ; `generate` fait proposer des variantes par l'agent sur un élément nommé. Si deux commandes collent, demandez **une fois** — ne devinez pas.

### 4.5 Cas particulier : construction guidée par un comp

Un build guidé par un comp approuvé passe par des portes humaines, pas par une inspection automatique :

- **Carte de régions** : `comp-spec --comp <comp.png> --grid` ouvre l'original et la grille ; `regions.json` décrit chaque région avec un `id` stable, un `kind`, une `note` et **exactement un** de `pixelBox`, `box` normalisée ou `grid`.
- **Inspection** : `comp-spec --comp … --regions regions.json --inspect-map` produit un rapport, un overlay, des crops exacts et des planches de comparaison. Zéro erreur ne certifie pas la précision du crop.
- **Revue de plan et d'assets** : `component-review plan` écrit `.impeccable/review/components.json` et refuse tant qu'une région raster n'a pas sa plaque. La revue se fait par l'outil hôte, ou par `capture`, `serve`, `verify`. **Ne validez jamais à la place de l'utilisateur.**
- **Attente** : `serve` sort en `2` sans navigateur et en `4` après 30 minutes d'inactivité. Dans les deux cas, personne ne relit : arrêtez l'attente, ne validez rien et rapportez la revue comme **en attente**.
- **Premier viewport** : après approbation, assemblez depuis les plaques et le plan, puis passez la porte du hero avec un manifeste `schemaVersion: 2`, un seul composant, `box` exactement `{x:0,y:0,w:1,h:1}`, et la liste complète des dépendances. Un besoin de reprise relance un round.

> **À retenir.** Une revue en attente est du travail en attente, pas un build terminé. Une validation humaine ne lève jamais les contrôles d'intégrité.

---

<a id="commandes"></a>
## 5. Les 24 commandes

24 commandes de travail, plus l'entrée `/impeccable` elle-même — 25 entrées dans `impeccable help`.

| Commande | Catégorie | Rôle | Référence |
|---|---|---|---|
| `craft` | Build | Alias déprécié de new-work ; aucun comportement en plus | `craft.md` |
| `shape` | Build | Planifier UX/UI avant le code | `shape.md` |
| `init` | Build | Capturer la vérité produit dans `PRODUCT.md` | `init.md` |
| `document` | Build | Générer `DESIGN.md` depuis le code existant | `document.md` |
| `extract` | Build | Extraire jetons, motifs et composants réutilisables | `extract.md` |
| `critique` | Evaluate | Revue UX avec notation heuristique | `critique.md` |
| `audit` | Evaluate | Contrôles techniques : a11y, perf, responsive, intégrité | `audit.md` |
| `polish` | Refine | Passe finale avant livraison | `polish.md` |
| `bolder` | Refine | Amplifier un design tiède ou sûr | `bolder.md` |
| `quieter` | Refine | Calmer un design agressif ou surstimulant | `quieter.md` |
| `distill` | Refine | Réduire à l'essentiel, retirer la complexité | `distill.md` |
| `harden` | Refine | Erreurs, i18n, débordements, cas limites | `harden.md` |
| `onboard` | Refine | Premier lancement, états vides, activation | `onboard.md` |
| `animate` | Enhance | Animations et micro-interactions intentionnelles | `animate.md` |
| `colorize` | Enhance | Couleur stratégique sur une UI monochrome | `colorize.md` |
| `typeset` | Enhance | Hiérarchie typographique, choix de fontes | `typeset.md` |
| `layout` | Enhance | Espacement, rythme, hiérarchie visuelle | `layout.md` |
| `delight` | Enhance | Personnalité et touches mémorables | `delight.md` |
| `overdrive` | Enhance | Au-delà des limites conventionnelles | `overdrive.md` |
| `clarify` | Fix | Copy UX, libellés, messages d'erreur | `clarify.md` |
| `adapt` | Fix | Adaptation aux appareils et tailles d'écran | `adapt.md` |
| `optimize` | Fix | Diagnostic et correction de performance UI | `optimize.md` |
| `live` | Iterate | Variantes en navigateur, l'humain choisit l'élément | `live.md` |
| `generate` | Iterate | Variantes générées sur un élément nommé, sans picking | `generate.md` |

**Références natives** : `audit.native.md`, `adapt.native.md`, `ios.md`, `android.md`. Sur une plateforme native, la variante native remplace la référence web.

**Répartition** : Build 5 · Evaluate 2 · Refine 6 · Enhance 6 · Fix 3 · Iterate 2.

---

<a id="detecteur"></a>
## 6. Le détecteur en profondeur

### 6.1 Trois modes de scan, trois niveaux de vérité

| Cible | Méthode | Ce qu'elle voit |
|---|---|---|
| **HTML** | Analyse statique HTML/CSS, CSS lié inclus | La structure et les styles d'une page statique |
| **Non-HTML** (CSS, JSX, TSX, Vue, Svelte) | Correspondance regex | Des motifs de code, pas un rendu |
| **URL** (`http(s)://`, `file://`) | Navigateur complet via Puppeteer | La page telle qu'elle s'affiche, CSS lié inclus |

Conséquence décisive : un scan de sources ne fait pas tourner les règles qui exigent une page parsée — `tiny-text`, `low-contrast` et les autres règles d'éléments. Le détecteur le dit lui-même : *« findings are an undercount, not a clean bill of health »*. Sur ce dépôt, `impeccable detect --json src/` renvoie `[]` sur 326 fichiers au dernier passage, et ce `[]` ne veut pas dire « écran propre ».

### 6.2 Codes de sortie

| Code | Signification | À retenir |
|---|---|---|
| `0` | Scan terminé, aucun constat primaire | Des avis peuvent rester listés |
| `1` | Au moins une cible n'a pas pu être scannée | Ce n'est **pas** un succès |
| `2` | Scan terminé avec constats primaires | C'est un échec de gate |

En multi-cibles partiel, **l'échec opérationnel prime**. Un scan qui n'a pas tout lu n'est pas un scan propre.

### 6.3 Avis et constats

Les **Advisory** sont détectés et listés à part, mais jamais comptés et jamais dans le code de sortie. `--no-advisory` les masque. C'est toute la différence entre un avis et une régression — et c'est ce qui rend le détecteur utilisable en CI sans négocier chaque remarque.

Les constats lisibles vont sur **`stderr`**, pour laisser **`stdout`** au structuré. D'où `--json` pour la CI, et `2> findings.txt` pour archiver. Un pipe naïf sans `--json` perd les constats.

### 6.4 Configuration

| Fichier | Portée | Clés |
|---|---|---|
| `.impeccable/config.json` | Partagée | `detector.ignoreRules`, `detector.ignoreFiles`, `detector.ignoreValues`, `detector.designSystem.enabled` |
| `.impeccable/config.local.json` | Locale, gitignorée | Mêmes clés ; sert aux essais personnels |

`--no-config` coupe tout d'un bloc (config, ignores inline et `DESIGN.md`). `--no-inline-ignores`, `--no-design-system` et `--no-advisory` coupent finement.

### 6.5 Ignores

```bash
npx impeccable ignores list
npx impeccable ignores add-rule <rule> [--all-values]
npx impeccable ignores add-file "<glob>"
npx impeccable ignores add-value <rule> <value> [--file <glob>] [--reason "<texte>"]
npx impeccable ignores remove-rule <rule>
npx impeccable ignores remove-file "<glob>"
npx impeccable ignores remove-value <rule> <value>
npx impeccable ignores clear
```

`--shared` écrit `config.json` (défaut), `--local` écrit `config.local.json`, `--all` applique aux deux. Un faux positif se documente avec `--reason`, il ne se supprime pas en silence.

Dans le fichier, un ignore voyage avec lui :

```html
<!-- impeccable-disable overused-font -- document de marque -->
```

```css
.brand { font-family: Inter } /* impeccable-disable-line overused-font */
```

```js
// impeccable-disable-next-line bounce-easing: rebond intentionnel
```

`impeccable-disable` couvre tout le fichier ; `-line` et `-next-line` sont locaux. Listez un ou plusieurs identifiants de règle, ou `*` pour toutes. Parfait pour un cas isolé, mauvais pour une politique.

### 6.6 Flags utiles

| Flag | Effet |
|---|---|
| `--json` | Résultat JSON sur `stdout` |
| `--quiet` | Mode texte : seulement le compte final |
| `--scope type,layout` | Restreint aux domaines de design nommés |
| `--viewport 390x844` | Viewport navigateur pour les scans d'URL |
| `--cdp <port\|url>` | Scanne une page d'app Chromium (Electron, NW.js, CEF, WebView2) via DevTools ; la page est laissée en l'état |
| `--target <texte>` | Avec `--cdp`, choisit la page dont l'URL ou le titre contient ce texte |
| `--no-consent-hiding` | Garde les bandeaux de consentement avant le scan |
| `--no-overlay-hiding` | Garde les product tours et preloaders qui couvrent la page |

### 6.7 Exemples

```bash
npx impeccable detect src/
npx impeccable detect index.html
npx impeccable detect https://example.com
npx impeccable detect --json .
npx impeccable detect --no-config src/
npx impeccable detect --scope layout src/
npx impeccable detect --viewport 390x844 http://localhost:5173/collection
npx impeccable detect --cdp 9222 --target "Bureau" --json
```

> **Pourquoi c'est avancé.** Le détecteur ne dit pas seulement « il y a un problème » : il dit **où**, **à quel point**, et **si c'est un avis ou un constat**. La qualité de votre CI dépend de la distinction, pas du nombre de règles.

---

<a id="porte"></a>
## 7. La porte CI de ce dépôt

### 7.1 Deux commandes, deux rôles

| Commande | Ce qu'elle fait | Ce qu'elle vaut |
|---|---|---|
| `npm run detect:ui` | `impeccable detect src/` : regex (326 fichiers au dernier passage) | Test de fumée. Il a laissé passer deux `nested-cards` que le navigateur voyait |
| `npm run detect:ui:page` | `node scripts/ci/detect-ui-pages.mjs` : sert `dist/` et scanne chaque écran | La porte. C'est la mesure qui compte |

### 7.2 Trois décisions de gouvernance

- **`ECRANS`** : douze routes réellement ouvertes à un invité — `/`, `/collection`, `/deck`, `/battle`, `/settings`, `/comite`, `/comite/suivi`, `/feuille-de-route`, `/connexion`, `/attente`, `/confidentialite`, `/administration`. `/installation` est exclu volontairement (D-155, #514) : le guide ne suit pas les règles de style du jeu, et sa lisibilité se vérifie à la main sur téléphone. La portée est une décision, pas un oubli.
- **`BASELINE`** : un plafond par écran, un **cliquet**. Le gate ne demande pas zéro par principe : il demande **pas plus qu'hier**, et chaque baisse se fait dans le commit qui corrige. Depuis le 26/10/2026, le plafond du dépôt est à zéro, donc il exige zéro. Le plafond a été abaissé par vagues — Collection 42 → 32 → 3 → 0, Deck 12 → 11 → 6 → 0 — chaque fois dans le commit qui corrige.
- **Le seuil est écrit une fois**, pas dans la tête du lecteur : un anti-pattern compte, un avis non.

### 7.3 La leçon technique

La mesure vient de `--json` (`[]` = aucun constat) et du code de sortie. Une sortie vide ne distinguait pas « page propre » de « page non mesurée » — c'est exactement le bug que #208 a corrigé. Le mode `--controle '<json>'` sert de sonde : il lit une sortie `--json` et dit si elle échoue, sans navigateur ni réseau. C'est ce que les tests utilisent.

> **La leçon n'est pas « lancez le détecteur ».** C'est : mesurez la page **servie**, pas la source ; séparez l'avis du constat ; faites du plafond un cliquet ; rendez la portée explicite.

---

<a id="session"></a>
## 8. Utiliser les commandes dans une session

### 8.1 Un seul point d'entrée dans ce dépôt

`.opencode/commands/` ne contient qu'un fichier, `impeccable.md`, déclaré en sous-tâche (`subtask: true`, agent `build`). La forme d'appel est donc :

```text
/impeccable <commande> <cible>
```

Les raccourcis autonomes `/audit`, `/polish`, etc. listés par `impeccable help` n'existent pas ici tant que vous ne les créez pas avec `impeccable pin <pin|unpin> <commande>`. Tant qu'ils n'existent pas, tout passe par `/impeccable`.

### 8.2 Trois façons d'entrer

| Ce que vous tapez | Ce qui se passe |
|---|---|
| `/impeccable critique /collection` | Commande explicite : la référence de `critique` est chargée et suivie |
| « L'écran Collection est illisible » | Requête implicite : le routeur choisit la commande qui correspond au symptôme |
| `/impeccable` seul | Menu contextuel ; il recommande 2–3 commandes et **n'en lance aucune** |

### 8.3 Ce qu'il faut donner dans le prompt

Le routeur ne devine pas ce qui n'est pas dit. Donnez-lui trois choses :

1. **Une cible stable** — un fichier (`src/styles.css`) ou une route (`/collection`). Pour `critique`, c'est un invariant : une cible, pas un périmètre flou.
2. **Le symptôme ou l'intention** — « trop chargé », « le premier lancement est vide », « ça casse en allemand », « les libellés sont ambigus ». C'est ce qui déclenche la bonne référence.
3. **Les contraintes** — ce qui est hors périmètre, ce qui doit rester, le brief s'il est épinglé. Sans cela, le skill applique ses propres critères, ce qui n'est pas toujours ce que vous voulez.

Ne demandez pas « améliore l'UI » : le routeur devra deviner la cible et la commande. Nommez l'écran et le problème.

### 8.4 Ce qui se passe ensuite

La commande charge sa référence, inspecte l'existant, puis travaille. Elle peut vous poser des questions, et c'est normal :

- `init` : interview en plusieurs rounds, écrit `PRODUCT.md` ;
- `shape` : deux rounds de découverte, puis un brief ;
- `document` : si un `DESIGN.md` existe, il demande refresh, overwrite ou merge — jamais d'écrasement silencieux ;
- `critique` : deux évaluations isolées, un rapport, puis « que veut-on améliorer ensuite ? » ;
- `live` : vous cliquez l'élément dans le navigateur, l'agent propose des variantes ;
- revue de composants : la session attend vos décisions, et ne valide jamais à votre place.

Répondez à la question au lieu de contourner : une revue en attente est du travail en attente, pas un build terminé.

### 8.5 Une séquence type dans une session

```text
/impeccable init                    # une fois, si PRODUCT.md manque
/impeccable shape <surface>         # si la découverte manque
/impeccable critique /collection    # jugement UX
/impeccable audit /collection       # vérification technique
/impeccable polish /collection      # passe finale
/impeccable harden /collection      # robustesse de production
npm run build && npm run detect:ui:page
```

En pratique, **une commande par tour** : le routeur charge une référence à la fois. Si vous en demandez deux qui collent, il demandera laquelle — répondez une fois, ne reformulez pas.

### 8.6 Continuité entre les tours

- `context` tourne **une fois** ; ne le relancez pas. Après `init`, reprenez sans le relancer.
- Gardez **le même target** d'un tour à l'autre : un `critique` sur `/collection`, puis un `polish` sur `/collection`, se comparent ; un `polish` sur « l'app » ne se compare à rien.
- Le snapshot de `critique` est une archive, pas la source de vérité : le livrable, c'est la réponse en chat.
- `doctor` ne se lance pas en passant. Demandez-le.
- Une question de workflow reçoit un conseil, pas une exécution. Si vous voulez l'exécution, demandez-la explicitement.

### 8.7 Du symptôme à la commande

| Symptôme | Commande |
|---|---|
| « C'est trop plat » | `bolder` |
| « C'est trop chargé » | `quieter` ou `distill` |
| « La hiérarchie ne se lit pas » | `layout` ou `typeset` |
| « Les messages d'erreur sont flous » | `clarify` |
| « Le premier lancement est vide » | `onboard` |
| « Ça casse sur mobile » | `adapt` |
| « C'est lent » | `optimize` |
| « Est-ce que c'est bien construit ? » | `audit` |
| « Est-ce que ça se comprend ? » | `critique` |
| « Documente ce qui existe » | `document` |
| « Réutilise ce qui se répète » | `extract` |

Et le garde-fou : les commandes ne remplacent pas la gate CI. Un `polish` réussi en session reste un polish non mesuré tant que `npm run detect:ui:page` n'a pas tourné sur la page servie.

---

<a id="recettes"></a>
## 9. Recettes

```bash
# 1. Scan brut, sans config ni DESIGN.md, pour voir ce que le détecteur voit vraiment
npx impeccable detect --no-config src/

# 2. Scan ciblé sur un domaine
npx impeccable detect --scope layout src/

# 3. Scan mobile d'une page servie
npx impeccable detect --viewport 390x844 http://localhost:5173/collection

# 4. Scan d'une app desktop par son port DevTools
npx impeccable detect --cdp 9222 --target "Bureau" --json

# 5. Faux positif documenté, au niveau projet
npx impeccable ignores add-value overused-font Inter --reason "Police de marque"

# 6. Portée legacy entière
npx impeccable ignores add-file "src/legacy/**"

# 7. La porte CI complète
npm run build && npm run detect:ui:page
```

Côté compétence :

```text
/impeccable init                          # capturer la vérité produit
/impeccable document                      # carboniser le système visuel existant
/impeccable critique <cible>              # jugement UX
/impeccable audit <cible>                 # vérification technique
/impeccable polish <cible>                # passe finale
/impeccable harden <cible>                # robustesse de production
```

---

<a id="pieges"></a>
## 10. Pièges et gouvernance

- **Ne relancez pas `context`.** Il charge une fois, il dirige, il ne se réexécute pas.
- **Un `[]` de scan source n'est pas un brevet de propreté.** C'est un test de fumée, pas une mesure d'écran.
- **Un avis n'est pas un constat.** Ne bloquez pas une livraison sur un `Advisory`, et ne masquez pas les avis avec `--no-advisory` pour fabriquer un faux propre.
- **Un ignore se documente.** `--reason` ou commentaire inline ; une politique passe par la config, pas par une suppression silencieuse.
- **`doctor` rapporte la dérive, il ne la répare pas en effet de bord.** Seul un constat `auto` s'applique à la prochaine écriture. Un `CONTEXT_STALE` se rapporte, il ne s'agit pas.
- **Pas de critique dégradé silencieux.** La bannière `⚠️ DEGRADED` est obligatoire ; sans elle, le rapport est un échec.
- **Le brief gagne.** Ne redirigez pas une direction claire vers votre goût.
- **Ne polissez pas le look que vous remplacez.** Refonte et raffinement ne se mélangent pas.
- **Les symboles chargés restent hors décoration.** Pas d'emblèmes liés au militarisme, au suprémacisme ou à la haine comme motifs, même si l'univers du sujet les évoque.
- **`craft` est déprécié.** Utilisez une demande de new-work ordinaire.
- **Si le lanceur échoue**, envoyez d'abord un message (« Context loading did not run; I'll read the existing project context directly »), puis lisez `PRODUCT.md` et `DESIGN.md` sans inventer ce qui manque.
- **Les commandes ne remplacent pas la gate CI.** Un polish réussi en session reste non mesuré tant que la page servie n'a pas été scannée.

---

<a id="maintenance"></a>
## 11. Maintenance

| Commande | Effet |
|---|---|
| `/impeccable hooks status\|on\|off\|ignore-rule\|ignore-file\|ignore-value\|reset` | Gère le hook qui lance le détecteur après édition de fichiers UI |
| `impeccable doctor [--json] [--fix] [--target <path>]` | Rapporte la dérive entre les artefacts et ce que la version lit ; `--fix` n'applique que les migrations `auto` |
| `impeccable pin <pin\|unpin> <commande>` | Crée ou retire un raccourci `/<commande>` autonome |
| `npx impeccable install` | Installe la compétence dans le harnais |
| `npx impeccable link --source=.impeccable` | Lie depuis un checkout local ou un submodule |
| `npx impeccable update` | Met à jour la compétence |
| `npx impeccable check` | Vérifie si une mise à jour est disponible |
| `npx impeccable telemetry off\|on\|status` | Coupe, active ou affiche la télémétrie anonyme |

Les verbes de la compétence — `context`, `signals`, `pin`, `hooks`, `doctor` — ne figurent pas dans l'aide de premier niveau `impeccable --help`, qui ne liste que l'installateur et le détecteur. `doctor` a sa propre aide. Le paquet est épinglé en `devDependency` à `4.7.0` : mettez à jour volontairement, pas au fil d'un `npm install`.

---

<a id="memo"></a>
## 12. Fiche mémo

| Si vous voulez… | Faites… |
|---|---|
| Capturer la vérité produit | `/impeccable init` |
| Documenter le système visuel | `/impeccable document` |
| Planifier une nouvelle surface | `/impeccable shape <surface>` |
| Juger l'UX | `/impeccable critique <cible>` |
| Vérifier la technique | `/impeccable audit <cible>` |
| Fermer un chantier | `/impeccable polish <cible>` puis `/impeccable harden <cible>` |
| Mesurer un écran servi | `npm run build && npm run detect:ui:page` |
| Scanner une URL en mobile | `npx impeccable detect --viewport 390x844 <url>` |
| Taire un faux positif | `npx impeccable ignores add-value <règle> <valeur> --reason "…"` |
| Voir la dérive des artefacts | `/impeccable doctor` |
| Créer un raccourci permanent | `impeccable pin <pin\|unpin> <commande>` |

### Quatre réflexes

1. **Mesurer la page servie, pas la source.**
2. **Un avis n'est pas un constat.**
3. **Un ignore se documente.**
4. **Le plafond baisse dans le commit qui corrige.**

### Trois interdits

- Ne pas relancer `context`.
- Ne pas réparer `doctor` en effet de bord.
- Ne pas polir le look qu'on remplace.

---

<a id="sources"></a>
## 13. Sources

Relevé le 30/10/2026, version 4.7.0. Les faits de ce document viennent des fichiers suivants :

- `.opencode/skills/impeccable/SKILL.md` — principes, modes, table des 24 commandes, routing, hooks, doctor, pin.
- `.opencode/skills/impeccable/reference/` — `init.md`, `document.md`, `extract.md`, `shape.md`, `critique.md`, `audit.md`, `polish.md`, `harden.md`, `live.md`, `generate.md`, `doctor.md`, `hooks.md`, `routing.md`, `craft-floor.md`, `region-map.md`, `component-review.md`.
- `.opencode/commands/impeccable.md` — point d'entrée `/impeccable`, sous-tâche, agent `build`.
- `node_modules/impeccable/README.md` — 61 règles déterministes, portée des scans.
- `scripts/ci/detect-ui-pages.mjs` — `ECRANS`, `BASELINE`, mode `--controle`, historique #205, #208, #234, D-155.
- `package.json` — scripts `detect:ui` et `detect:ui:page`, `devDependency` `impeccable@4.7.0`.
- `DESIGN.md`, `.gitignore` — état du système visuel, fichiers locaux ignorés.
- `.impeccable/critique/2026-10-30T06-14-58Z__src-pages-collection-tsx.md` — instantané de `critique` sur `/collection` (méthode dual-agent, 23/40), observé le 30/10/2026.
- Sorties observées : `impeccable context` (`NO_PRODUCT_MD`), `impeccable detect --json src/` (`[]`, 326 fichiers au dernier passage, avertissement de sous-comptage), `impeccable detect --help`, `impeccable ignores --help`, `impeccable pin --help`, `impeccable doctor --help`, `impeccable help`.

> **Ce document ne remplace aucune des références ci-dessus.** En cas de doute sur un comportement, la référence de la commande fait foi ; en cas de conflit documentaire dans le dépôt, `AGENTS.md` §2 tranche.
