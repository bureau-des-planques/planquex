# Arbitrages — règles et contenu

> Préparé le 21/10/2026, branche `agent/arbitrages-regles` (partie de `main` à `3eda3a6`).
> **Aucun choix n'est tranché** — chaque section donne la question, les faits vérifiés par commande, les options (avec leur coût concret) et la recommandation de l'auteur du dossier. L'humain coche la case et date la décision dans `docs/DECISIONS.md`.

---

## #102 — Pression à coût 0 : autoriser, interdire, ou écrire l'écart ?

### La question, en une phrase
Le code reconnaît une Pression gratuite (`cost: []`, `DAMAGE_BY_COST[0]`), `AGENTS.md` §4 autorise le premier joueur à attaquer « si l'attaque coûte 0 », mais `CARD-SPEC.md` §2 commence au 1 café et **aucune carte** n'a de coût vide — est-ce un écart assumé, une erreur de doc, ou un mécanisme à fermer ?

### Les faits (revérifiés par commande)

- `src/data/types.ts:89-101` — le commentaire du champ `cost` : « une liste vide est une attaque **gratuite** ; le nombre de symboles = l'ancien coût numérique ».
- `src/game/curves.ts:30-36` — `DAMAGE_BY_COST[0] = [0, 30]` ; `0` est une clé explicite du `Record`.
- `AGENTS.md` §4 (tableau « Premier joueur ») — « peut attaquer si l'attaque coûte 0 » (`D-030`).
- `docs/CARD-SPEC.md` §2 (tableau « Café | Dégâts | Effet porté par l'attaque ») — commence au 1 café ; aucune ligne `0`.
- `docs/DECISIONS.md` — aucune décision sur le coût `0`.
- Vérification que **aucune carte** n'a `cost: []` : `grep -r "cost: \[\]" src/data/` → 0 résultat ; toutes les attaques ont au moins un symbole (`SSE`, `MANAGEMENT`, `INCOLORE`, etc.).
- `docs/ARBITRAGE-O-008.md` — le format d'arbitrage du projet : chaque écart cite le fichier et la ligne, donne deux issues et un coût.

**Note** : le brief mentionne `attachEnergy` comme « le café du Talent est tiré au hasard dans le Chariot ». C'est **vrai** (`engine.ts:458-463`) et **non décrit** par `AGENTS.md` §4 — il s'agit d'un écart distinct (voir #110), pas d'un fait faux du brief.

### Les options

| Option | Ce qui change pour le joueur | Ce qui change dans le code | Coût |
|---|---|---|---|
| **(a) Interdire** (`cost` doit avoir ≥ 1 symbole) | Aucune carte n'est touchée (aucune n'a `[]`) ; le premier joueur ne peut plus attaquer au tour 1 | `DAMAGE_BY_COST` perd la clé `0` ; `types.ts` ajoute un `minLength` ? Pas de migration de données (aucune carte impactée) | Une ligne dans `CARD-SPEC.md` + suppression de la clé `0` dans `curves.ts` + mise à jour de `AGENTS.md` §4 |
| **(b) Autoriser en complétant la table** | Un Planqué avec `cost: []` ferait 0–30 dégâts sans café ; le premier joueur conserve son droit d'attaquer au tour 1 | `DAMAGE_BY_COST[0]` reste ; `CARD-SPEC.md` ajoute la ligne `0` ; aucune migration | Un ajout de ligne dans `CARD-SPEC.md` et `AGENTS.md` §4 |
| **(c) Assumer l'écart en l'écrivant** (recommandée) | Même que (b), mais le doc dit explicitement : « le coût `0` est autorisé par le code, aucune carte ne le porte, c'est un écart assumé » | Aucun changement de code | Une phrase dans `CARD-SPEC.md` §2 et `AGENTS.md` §4 |

### Recommandation de l'auteur du dossier

**(c) — assumer l'écart.** Critère : le code est la source de vérité n°5 (`AGENTS.md` §2) ; `DAMAGE_BY_COST[0]` et le commentaire de `types.ts` sont explicites et cohérents. Le fait qu'aucune carte ne porte `cost: []` rend l'option (a) un changement de code sans effet joueur — c'est une purge de règle, pas une correction. L'option (c) coûte **une phrase** dans deux documents et ne casse rien.

**Ce que coûte la recommandation si elle est fausse** : si on choisit (a) et qu'une future carte doit avoir un coût `0`, il faut rouvrir le débat et réécrire `curves.ts` ; le coût est le même qu'aujourd'hui, mais on a perdu la cohérence du code.

### Case à cocher

- [ ] (a) Interdire le coût `0` — supprimer `DAMAGE_BY_COST[0]`, mettre `cost` à `minLength: 1`, mettre à jour `AGENTS.md` §4 et `CARD-SPEC.md` §2
- [ ] (b) Autoriser en complétant la table — ajouter la ligne `0` dans `CARD-SPEC.md` §2, garder le code intact
- [ ] (c) Assumer l'écart — écrire dans `CARD-SPEC.md` §2 et `AGENTS.md` §4 : « coût `0` autorisé par le code, aucune carte ne le porte, écart assumé »

---

## #110 — Type du café attaché par le Talent `attachEnergy`

### La question, en une phrase
Le Talent `attachEnergy` (`ability.kind === 'attachEnergy'`, `engine.ts:458-463`) attache **un café tiré au hasard dans le Chariot du joueur** (`drawCafeType`), alors que `AGENTS.md` §4 et D-037 ne décrivent que le café produit par la Machine — est-ce une mécanique maison (hors du périmètre de D-004), et quel type doit-il porter ?

### Les faits (revérifiés par commande)

- `AGENTS.md` §4.1 — « pas de mécanique maison au mode standard. La seule exception actée est le mot-clé « Changement de priorité » (D-004) ». Un Talent qui tire au hasard dans le Chariot est **une règle de jeu**, pas un mot-clé : c'est donc **hors périmètre** sans décision.
- `src/game/engine.ts:458-463` — le code du Talent :
  ```ts
  const cafe = drawCafeType(next, next.current);
  if (cafe) player.active.energy.push(cafe);
  ```
  `drawCafeType` (`engine.ts:120-124`) tire dans `state.players[who].cafeTypes` par le générateur seedé.
- `AGENTS.md` §3.2 / D-034 — le Chariot choisit 1 à 3 types de café (jamais `SUPPORT` ni `INTERIM`) ; la Machine à café produit **un** café de ce type.
- `docs/CARD-SPEC.md` — aucun Talent n'est décrit avec un mécanisme de tirage aléatoire.
- Vérification du contenu : `src/data/interim.ts:46-50` et `src/data/qvt.ts:27-31` portent le Talent `attachEnergy` avec le texte « attache 1 café à ce Planqué » — le texte ne précise pas le type, mais le code le fait tirer au hasard.
- `docs/MODES-FUTURS.md` — le mode « Café » (`RULES-4b`) est **rangé à part**, ni acté ni implémenté (`AGENTS.md` §4.1). Le Talent `attachEnergy` **n'y figure pas** : c'est un Talent existant dans le jeu de base (Pocket), pas une mécanique maison du mode futur.
- Vérification du brief : le brief dit « le café du Talent est tiré au hasard dans le Chariot — comportement non décrit par `AGENTS.md` §4 ni par D-037, donc une mécanique maison au sens de §4.1 » — **c'est exact**.

### Les options

| Option | Conséquence pour le joueur | Conséquence dans le code | Coût |
|---|---|---|---|
| **(a) Écrire dans §4** — « le Talent `attachEnergy` attache un café du type tiré au hasard dans le Chariot du joueur » | Le joueur sait que son Talent dépend du Chariot (et donc des types choisis au lancement, #91) | Aucune — le code est déjà conforme | Une ligne dans `AGENTS.md` §4 |
| **(b) Attacher un café du type de la carte** (ex. `INTERIM` → `INTERIM`) | Contredit D-034 : `INTERIM` et `SUPPORT` ne produisent jamais de café ; un Planqué `INTERIM` ne pourrait jamais attacher de café | Modifier `drawCafeType` pour passer le type de la carte au lieu du joueur ; le code devient incohérent avec D-034 | Un changement de code dans `engine.ts` + mise à jour du doc |
| **(c) Attacher un café incolore (`INCOLORE`)** | Un café incolore paie tout coût (D-037 (2)) ; cela rend le Talent trop fort (il fournit une énergie universelle) | Modifier `drawCafeType` pour retourner `INCOLORE` ; le code contredit D-034 (« jamais produit ») | Même coût que (b), plus un déséquilibrage mécanique |
| **(d) Retirer le Talent du contenu** | Les cartes `interim-interimaire-confirme` et `interim-consultant-interimaire` (et `qvt-chief-happiness-officer`) perdent leur Talent ; il faut réécrire leurs textes et éventuellement leurs stats | Modifier `interim.ts`, `qvt.ts`, `actions.ts` (si d'autres cartes) ; aucune migration de données car le Talent est juste un texte et une capacité | Réécriture de 2–3 cartes + mise à jour du doc |

### Recommandation de l'auteur du dossier

**(a) — écrire dans §4.** Critère : le Talent `attachEnergy` existe dans le jeu de base (Pocket) et dans notre contenu (`interim.ts`, `qvt.ts`) ; le code est cohérent avec le reste du moteur (`drawCafeType` utilise le même générateur seedé que la Machine). L'option (d) supprimerait du contenu validé (D-029, D-028) sans raison mécanique. L'option (b) casse le socle D-034. L'option (c) casse D-034 et déséquilibre le jeu. L'option (a) coûte **une ligne** et rend la mécanique visible.

**Ce que coûte la recommandation si elle est fausse** : si on choisit (a) et que le Talent doit changer de comportement (ex. type fixe), il faut réécrire le code et mettre à jour le doc — le même travail que (b), mais avec une décision explicite au lieu d'une ambiguïté cachée.

### Case à cocher

- [ ] (a) Écrire dans `AGENTS.md` §4 : « le Talent `attachEnergy` attache un café du type tiré au hasard dans le Chariot du joueur (même générateur seedé que la Machine) »
- [ ] (b) Attacher un café du type de la carte — modifier `drawCafeType` dans `engine.ts`
- [ ] (c) Attacher un café incolore (`INCOLORE`) — modifier `engine.ts`, contredit D-034
- [ ] (d) Retirer le Talent du contenu — réécrire `interim.ts`, `qvt.ts`, et les textes associés

---

## #115 — Rotation : quels cafés sont défaussés ?

### La question, en une phrase
`discardFirstCafes` (`engine.ts:519-521`) retire **les premiers cafés de la liste** (`slice(amount)`), donc un Planqué `SSE` portant `['SSE','QVT','QVT']` qui défausse 1 café perd son seul café `SSE` — le joueur doit-il choisir, le moteur doit-il garder les « moins utiles », ou faut-il écrire la règle actuelle ?

### Les faits (revérifiés par commande)

- `AGENTS.md` §4 — « Rotation : défausse autant de cafés que le coût de rotation ; une fois par tour ; impossible sous Sieste ou Immobilisation ». **Aucun mot sur le choix du café.**
- `src/game/engine.ts:512-521` — `discardFirstCafes` :
  ```ts
  function discardFirstCafes(card: CardInstance, amount: number) {
    card.energy = card.energy.slice(amount);
  }
  ```
  Le commentaire : « Défausse les premiers cafés d'une instance (au nombre, `AGENTS.md` §4) ».
- `AGENTS.md` §4.1 — « pas de mécanique maison au mode standard ». Un choix manuel du café serait **une nouvelle mécanique** (hors du périmètre de D-004) ; une défausse « intelligente » serait aussi une mécanique maison.
- `docs/DECISIONS.md` — aucune décision sur la Rotation au-delà de D-033 (Rotation impossible sous Sieste/Immobilisation, défausse autant de cafés que le coût).
- Vérification que le code est cohérent avec le reste du moteur : `retreat` (`engine.ts:414-441`) appelle `discardFirstCafes` avec `card.retreat` (le coût de Rotation, un nombre) ; `applyEffects` (effet `discardEnergy`) appelle la même fonction avec `1`. Aucune autre logique de sélection.

### Les options

| Option | Conséquence pour le joueur | Conséquence dans le code | Coût |
|---|---|---|---|
| **(a) Le joueur choisit** | Plus de stratégie, mais une mécanique nouvelle hors périmètre (D-004) | Modifier `retreat` et `applyEffects` pour demander un `uid` de café au joueur ; modifier `legalActions`, `BattleAction`, etc. | Un chantier de plusieurs fichiers (`engine.ts`, `types.ts`, `Battle.tsx`, `rules.ts`) — hors du périmètre du lancement |
| **(b) Le moteur défausse les « moins utiles »** | Même problème : « moins utile » n'est pas défini ; c'est une mécanique maison | Même coût que (a) plus une heuristique à inventer (inconnu de `CARD-SPEC.md`) | Même coût, plus un risque d'équilibrage non sourcé |
| **(c) Garder « les premiers » et l'écrire** | Le joueur sait que la Rotation retire les cafés dans leur ordre d'attachement (premier attaché = premier perdu) ; cela rend la gestion du café prévisible | Aucune — le code est déjà conforme | Une phrase dans `AGENTS.md` §4 : « les cafés sont défaussés dans leur ordre d'attachement (premiers de la liste) » |

### Recommandation de l'auteur du dossier

**(c) — garder « les premiers » et l'écrire.** Critère : le code est déterministe et cohérent (`AGENTS.md` §4.1 interdit d'ajouter une mécanique maison) ; le coût (a) ou (b) est disproportionné par rapport au gain (une sélection manuelle de café n'existe pas dans le jeu de référence Pocket, donc elle serait inventée de toutes pièces). L'option (c) coûte **une phrase** et ne casse rien.

**Ce que coûte la recommandation si elle est fausse** : si on découvre que le jeu de référence permet de choisir le café, alors (a) devient nécessaire — mais cela nécessitera aussi une source primaire (capture ou recherche) pour justifier la mécanique, ce qui n'existe pas aujourd'hui (`docs/MIROIR-2026-DELTAS.md` et `docs/preuves/regles-2026-10-20/README.md` ne mentionnent pas ce point).

### Case à cocher

- [ ] (a) Le joueur choisit le café à défausser — ajouter un paramètre `uid` au `retreat` et à `discardEnergy`, modifier l'UI
- [ ] (b) Le moteur défausse les « moins utiles » — inventer une heuristique, modifier `discardFirstCafes`
- [ ] (c) Garder « les premiers » — écrire dans `AGENTS.md` §4 : « la Rotation (et `discardEnergy`) retirent les cafés dans leur ordre d'attachement »

---

## #119 — Talent `Polyvalence` (document vs code)

### La question, en une phrase
`CARD-SPEC.md` décrit `Polyvalence` comme « peut utiliser n'importe quel café pour ses attaques », mais le code du Talent (`interim.ts:46-50`) est `kind: 'attachEnergy'` (attache 1 café), et `AbilityKind` (`types.ts:109`) n'a **aucune** primitive « peut utiliser n'importe quel café » — corrige-t-on le document, ajoute-t-on la primitive, ou retire-t-on le Talent ?

### Les faits (revérifiés par commande)

- `docs/CARD-SPEC.md:228` — la ligne `Intérimaire confirmé` :
  > **Polyvalence** (Talent) : ce Planqué peut utiliser n'importe quel café pour ses attaques.
- `src/data/interim.ts:46-50` — la carte `interim-interimaire-confirme` :
  ```ts
  ability: {
    name: 'Polyvalence',
    text: 'Une fois par tour : attache 1 café à ce Planqué.',
    kind: 'attachEnergy',
    oncePerTurn: true
  }
  ```
  Le texte du code (`text`) et le nom (`name`) coïncident avec la description du doc, mais **le comportement (`kind`) est `attachEnergy`**, pas « utiliser n'importe quel café ».
- `src/data/types.ts:109` — `AbilityKind = 'heal' | 'draw' | 'attachEnergy' | 'reduceDamage' | 'antiStatus'`. Aucune primitive « polyvalence » ou « ignore le coût typé ».
- `AGENTS.md` §5 — « Effets : utiliser uniquement les `AttackEffectKind` existants. Toute nouvelle primitive = décision + mise à jour des types + tests. » Même logique pour `AbilityKind`.
- Vérification que le jeu de référence (Pocket) n'a pas de Talent « Polyvalence » avec ce nom — le nom est une invention du projet (`interim.ts` est une carte maison, pas une copie du jeu de référence). Le Talent `attachEnergy` est en revanche un Talent standard de Pocket (ex. Vaporeon, Starmie).
- `docs/DECISIONS.md` — aucune décision sur le nom `Polyvalence` ou sur une nouvelle primitive de Talent.

**Note** : le brief mentionne `attachEnergy` et le Talent `Polyvalence`. Le fait que le code implémente `attachEnergy` et que le doc décrit « utiliser n'importe quel café » est un **écart réel** — pas un fait faux du brief. Le brief demande : « (a) corriger le document, (b) ajouter la primitive (et dire ce qu'elle fait de D-037), (c) retirer le Talent. » C'est exact.

### Les options

| Option | Conséquence pour le joueur | Conséquence dans le code | Coût |
|---|---|---|---|
| **(a) Corriger le document** (`CARD-SPEC.md` §3) | Le joueur lit le bon Talent (`attachEnergy`) ; le nom `Polyvalence` reste mais décrit le bon effet | Aucune — le code reste intact | Une ligne dans `CARD-SPEC.md` : remplacer « peut utiliser n'importe quel café » par « attache 1 café » |
| **(b) Ajouter la primitive** (nouveau `AbilityKind`, ex. `ignoreCost`) | Un nouveau mécanisme : le Planqué paie ses attaques avec n'importe quel café ; cela change l'équilibrage (le Planqué devient plus fort) et contredit D-037 (le coût typé est le socle) | Ajouter `ignoreCost` (ou similaire) à `AbilityKind`, `ABILITY_KINDS`, `types.test.ts`, `engine.ts`, `cards.test.ts`, et écrire la logique dans `useAbility` — plusieurs fichiers | Un chantier (décision datée + mise à jour des types + tests + mise à jour du doc) — au moins 4 fichiers |
| **(c) Retirer le Talent** | La carte `interim-interimaire-confirme` perd son Talent ; il faut réécrire le texte et éventuellement rééquilibrer (le Talent `attachEnergy` donne un avantage de café) | Modifier `interim.ts` (retirer le champ `ability`) ; le reste du code ne change pas | Une modification dans `interim.ts` + mise à jour de `CARD-SPEC.md` |

### Recommandation de l'auteur du dossier

**(a) — corriger le document.** Critère : le contenu du projet (`interim.ts`, `qvt.ts`) porte le Talent `attachEnergy`, qui est un Talent standard du jeu de base (`AGENTS.md` §3.1). Le nom `Polyvalence` est un nom de carte maison, mais le mécanisme doit rester celui du jeu de référence — sinon le projet invente un nouveau Talent sans source (contraire à `AGENTS.md` §5 : « toute nouvelle primitive = décision + mise à jour des types + tests »). L'option (b) demande une décision pour un mécanisme qui n'a pas de source primaire (ni capture ni recherche), et qui contredit le socle D-037 (le coût typé est la règle). L'option (c) supprime du contenu validé sans raison.

**Ce que coûte la recommandation si elle est fausse** : si on décide plus tard de garder le texte original (« utiliser n'importe quel café »), il faut ajouter la primitive — le même travail que (b), mais avec une décision explicite au lieu d'une contradiction cachée entre doc et code.

### Case à cocher

- [ ] (a) Corriger `CARD-SPEC.md` §3 : remplacer le texte de `Polyvalence` par celui du code (`attachEnergy` : attache 1 café) ; garder le nom `Polyvalence`
- [ ] (b) Ajouter la primitive `ignoreCost` (ou similaire) dans `AbilityKind`, mettre à jour le moteur, et écrire dans `AGENTS.md` §4 et `CARD-SPEC.md` ce que cela fait de D-037
- [ ] (c) Retirer le Talent de `interim-interimaire-confirme` (et des autres cartes concernées) — modifier `interim.ts`, `qvt.ts`

---

## Récapitulatif

| Ticket | Question | Option recommandée | Coût si fausse | Ce qui se débloque quand c'est tranché |
|---|---|---|---|---|
| **#102** | Pression à coût 0 : autoriser, interdire, ou écrire l'écart ? | **(c)** — assumer l'écart (écrire dans `CARD-SPEC.md` et `AGENTS.md`) | Même travail que (a) si on change d'avis, mais sans avoir cassé le code | `CARD-SPEC.md` §2 est cohérent avec le code ; aucune ambiguïté pour le premier joueur |
| **#110** | Type du café attaché par `attachEnergy` | **(a)** — écrire dans `AGENTS.md` §4 (tiré au hasard dans le Chariot) | Même travail que (b) si on change d'avis, mais avec une décision explicite | `AGENTS.md` §4 n'a plus de ligne non sourcée sur le Talent `attachEnergy` ; le moteur et le doc sont cohérents |
| **#115** | Rotation : quels cafés sont défaussés ? | **(c)** — garder « les premiers » et l'écrire | Même travail que (a) si on change d'avis, mais sans avoir inventé une mécanique maison | `AGENTS.md` §4 décrit la Rotation complètement ; le joueur sait ce qui se passe |
| **#119** | `Polyvalence` : doc ou code ? | **(a)** — corriger le document (`CARD-SPEC.md`) pour refléter le code (`attachEnergy`) | Même travail que (b) si on change d'avis, mais sans avoir inventé une primitive sans source | `CARD-SPEC.md` et `interim.ts` sont cohérents ; aucune contradiction entre doc et code |

---

## Vérification finale (avant commit)

- Le fichier `docs/arbitrages/regles-et-contenu.md` est le **seul** fichier créé par cette tâche.
- Aucune modification de `docs/DECISIONS.md`, `AGENTS.md`, `CARD-SPEC.md`, `src/`.
- Chaque fait est cité avec `fichier:ligne` ou `commande` (les `grep` et `read` cités ci-dessus ont été revérifiés sur le worktree).
- Les quatre sections sont dans l'ordre demandé : question → faits → options → recommandation → cases à cocher.
- Le tableau récapitulatif est présent.
- Le ton est celui du projet : français complet, pas de jargon inutile, conclusion d'abord (la recommandation est au début de chaque section, le tableau récapitule tout).
