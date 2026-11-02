# Illustrations des bases — recensement du 2 novembre 2026 (#499)

Lot **de mesure**, pas de production d'art : le jalon bêta (critère 4 de **D-048**, amendé
par **D-063**) demande « les bases illustrées, ou la décision assumée de ne pas l'être ».
Le nombre n'était pas connu. Il l'est ici, avec la commande et sa sortie. **La décision,
elle, reste humaine** (`docs/agents/parallelisme.md` §7) : le §5 ci-dessous prépare
l'arbitrage, il ne le tranche pas.

## 0. Méthode

- **État mesuré** : branche `agent/499`, issue de `main` au commit `61b2e34` (2/11/2026).
- **Commande** : `npm run mesure:illustrations`
  (`scripts/preuves/mesure-illustrations.mjs`, lecture seule).
- **Sources** : `ALL_CARDS` (`src/data/index.ts`) pour les cartes et leur champ `art` ;
  `design/illustrations/` pour les fichiers réellement présents ; `artUrl` (`src/art.ts`)
  pour la résolution Vite — le même chemin que l'écran, pas une simple présence sur disque.
- **Définitions** :
  - une **base** est une carte **sans** `variantOf` (Planqués, Collègues et Objets) ;
  - une base est **illustrée** quand son `art` est déclaré, que le fichier existe dans
    `design/illustrations/` et que Vite le résout ;
  - une variante sans `art` **n'ajoute pas de fichier** : elle reprend la planche de sa
    base à la lecture (`artFileOf`, **D-139**). Son repli ne compte donc pas comme une
    illustration de plus.
- **Reproductibilité** : sortie sans hasard ni horodatage ; lancer deux fois donne le même
  texte. `-- --json` rend le rapport complet (mêmes chiffres).
- **Garde** : `scripts/preuves/mesure-illustrations.test.ts` éprouve le calcul sur un
  catalogue **fabriqué** — base sans `art`, `art` sans fichier, fichier non servi par Vite,
  orpheline, variante en repli — pour que chaque faux compte ait un test qui échoue.

## 1. Le compte

Extrait exact de `npm run mesure:illustrations` :

```text
**225 bases illustrées sur 233**, **8 sans illustration**. 7 variantes sur 75 ont leur propre planche ; les 68 autres reprennent celle de leur base (D-139), sans ajouter de fichier au registre.

| Mesure | Nombre |
|---|---:|
| Cartes au catalogue | 308 |
| Bases | 233 |
| — dont illustrées | 225 |
| — dont sans illustration | 8 |
| Variantes | 75 |
| — dont avec leur propre planche | 7 |
| — dont en repli sur celle de leur base (D-139) | 68 |
| `.webp` dans `design/illustrations/` | 232 |
| Fichiers déclarés par une carte | 232 |
```

Les deux comptes de défauts sont **vides**, ce qui est le point rassurant de la mesure :

- **aucune orpheline** : chaque `.webp` du registre est déclaré par une carte ;
- **aucune manquante** : chaque `art` déclaré a son fichier, et Vite le sert.

Le défaut n'est donc pas un registre incohérent, c'est **huit bases qui n'ont pas encore
de planche**.

## 2. Les huit bases sans illustration

Extrait de la même commande (colonnes « Sans » et « Identifiants ») :

| Faction | Bases | Illustrées | Sans | Identifiants sans illustration |
|---|---:|---:|---:|---|
| **INTERIM** | 10 | 6 | 4 | `interim-vacataire`, `interim-charge-mission`, `interim-coordinateur-interimaire`, `interim-suppleant` |
| **SYNDICAT** | 11 | 7 | 4 | `syndicat-delegue-syndical`, `syndicat-permanent-syndical`, `syndicat-collectif-atelier`, `syndicat-representant-section` |

Les huit autres factions sont **complètes** (SSE 30/30, MANAGEMENT 22/22,
AMÉLIORATION 20/20, QVT 38/38, RH 26/26, ATELIER 27/27, DIRECTION 17/17, SUPPORT 32/32).

**Pourquoi ces huit-là, et pourquoi le chiffre 225.** Les huit bases manquantes sont
exactement les huit cartes ajoutées par le contenu de **#352** (`a9aa5f4`, 28/10/2026 :
« 4 cartes de base au Syndicat et 4 à l'Intérim »). La vague d'illustrations des 225 bases
est antérieure (`8351043`, 26/10/2026 : « les 225 cartes de base ont leur image ») : elle a
couvert le set tel qu'il était alors, et n'a pas suivi les huit entrées arrivées deux jours
plus tard. Le chiffre de **225** dans D-048, D-063 et D-126 est donc un **instantané daté**,
pas le compte vivant : depuis #352, le set a **233 bases**, et c'est 225/233 qui se mesure.

Les **sujets** des huit cartes existent déjà, écrits dans `design/illustrations/SUJETS-flow.md`
(lignes 228–231 pour le Syndicat, 238–241 pour l'Intérim) : la vague n'aurait pas à les
inventer, seulement à les générer et à câbler `art` dans `src/data/syndicat.ts` et
`src/data/interim.ts`.

## 3. L'écart 232 fichiers / 225 cartes (#546)

#546 avait relevé **232 `.webp` pour 225 cartes** sans explication. La mesure la donne :

```text
232 = 225 bases illustrées + 7 variantes qui déclarent leur propre planche
```

Les sept variantes sont exactement celles de **D-126** (les trophées, déjà produites) :

- `3S` × 4 : `sse-medecin-travail-star3`, `amelioration-directeur-qualite-star3`,
  `qvt-chief-happiness-officer-star3`, `atelier-responsable-process-star3` ;
- `COU` × 3 : `rh-drh-crown`, `direction-pdg-crown`, `syndicat-secretaire-general-crown`.

Les **68 autres variantes** n'ajoutent aucun fichier : elles n'ont pas de `art` et
reprennent celui de leur base (D-139). L'écart de #546 n'était donc pas une anomalie : il
comptait des **fichiers** là où le ticket parlait de **cartes**, et il ne pouvait pas voir
que 225 bases étaient illustrées sur 233.

## 4. Ce que cette mesure ne prouve pas

- Elle prouve l'**existence**, la **résolution** et la **couverture**, pas la **qualité
  visuelle** : une planche peut être laide, mal cadrée ou hors sujet sans que ce compte
  bouge. Le gabarit (carré, ≥ 1024 px, < 1 Mo) est gardé par `src/data/art.test.ts`, pas ici.
- Elle est **datée** : fermer ou ouvrir une carte, ajouter une planche ou changer un `art`
  déplace les chiffres. La seule source vivante reste la commande.
- Les documents qui parlent encore de « 225 cartes de base illustrées » comme d'un état
  vivant (`docs/ALPHA-TESTEURS.md` §Collection, la note de version de `src/data/versions.ts`)
  sont **périmés depuis #352**. Ils ne sont pas corrigés ici : `docs/ALPHA-TESTEURS.md`
  n'est pas dans la zone de ce lot, et `src/data/versions.ts` est **généré** depuis les
  releases (`npm run notes:versions`). À traiter dans le ticket qui suivra la décision.

## 5. L'arbitrage à rendre — une proposition, pas une décision

**Option A — finir les huit bases avant la bêta.** Coût : huit générations dans le tuyau
existant (`scripts/illustration-vague.sh`, sujets déjà écrits), le câblage de `art` dans
deux fichiers de données, et la mise à jour des deux documents périmés du §4. Aucune
dépendance, aucun changement de règle. Effet : le critère 4 de D-048 est satisfait **au
compte vivant** (233/233) et un testeur ne voit plus aucun aplat dans la Collection.

**Option B — acter de ne pas les finir (D-063).** Coût : rien à produire, mais une décision
datée à écrire, et huit aplats assumés. Effet : **3,4 % du catalogue** (8/233) reste sans
visage, concentré sur deux factions — un Deck mono-Intérim en compte 4 sur 10 (40 %), un
mono-Syndicat 4 sur 11 (36 %). C'est là que le manque se voit : les factions complètes ne
le montrent jamais. Pour un testeur, la promesse de `docs/ALPHA-TESTEURS.md` (« tout le set
s'affiche illustré ») devient fausse, et le ticket de retour le plus probable est
« pourquoi cette carte n'a pas d'image ? ».

**Ce que la mesure ne tranche pas** : le coût en crédits et en temps des huit générations,
et l'éventualité d'une vague plus large (variantes `1S`/`2S` de D-126). Elle établit
seulement que le reste du set est **cohérent** (aucune orpheline, aucune manquante) et que
le trou est **petit, localisé et déjà approvisionné en sujets** — deux éléments qui rendent
l'option A peu risquée, sans pour autant la décider.

## 6. Reste non vérifié

- Les huit sujets de `SUJETS-flow.md` n'ont pas été relus contre les cartes : on sait
  qu'ils existent, pas qu'ils correspondent exactement au texte des cartes de #352.
- Aucun rendu à l'écran n'a été capturé : le compte est une lecture de données, pas une
  capture de Collection. La preuve de rendu reste `npm run capturer`, hors de ce lot.
- Le coût réel d'une vague de huit images (crédits, durée) n'est pas mesuré ici.
