# Spec — l'ouverture d'un Arrivage : les quatre temps

> Écrite le **28/10/2026**, après le prototype de #283 et deux essais sur téléphone.
> Elle **n'acte rien** : ce qui engage est déjà daté ailleurs — la forme (**animation, pas vidéo**)
> est tranchée dans **#269**, les sons dans **D-137**, l'accès aux photos dans **AGENTS.md §6/§9**.
> Ce document décrit **ce que le code doit faire**, avec les chiffres relevés sur le prototype.

## 1. D'où ça vient

| | |
|---|---|
| Ticket | **#283** — « Ouverture d'un paquet : l'animation » |
| Prototype | branche **`prototype/ouverture-283`**, `src/prototype/ouverture.html` (DEV seulement) |
| Forme | **animation**, pas vidéo (#269) ; la vidéo a servi de **brief**, jamais de livrable |
| Recherche | `outils.md` et `techniques.md` (28/10/2026), cités au fil des sections |

Le prototype a servi à trancher **par l'œil**, pas par l'argument : trois rendus du creux
(dégradés CSS, shader WebGL, filtres SVG), puis les gestes sur des **photos** du sachet. Ce qui
suit est ce qui a été **retenu à l'essai**, pas ce qui était le plus élégant sur le papier.

## 2. Le sachet est une photo, pas un dessin

Trois rendus du creux ont été comparés sur la même image :

- **dégradés CSS** : plat. Le film ne se déforme pas, on voit des ronds dessinés dessus ;
- **filtres SVG** (`feDisplacementMap` + `feSpecularLighting`) : du relief, mais surexposé, et
  WebKit calcule ces filtres sur le processeur (bugs 287982, 263848) ;
- **shader WebGL2** : **retenu**. C'est le seul qui donne un creux réel sur un film photographié.

Conséquence, et c'est la décision structurante : **le sachet n'est pas dessiné**, il est
**photographié**. Les états (étiquette collée, coin levé, étiquette enroulée, partie, déchiré à
quart, à moitié, ouvert) sont des **photos tirées par gflow** (images gratuites), dérivées l'une de
l'autre par `i2i` pour garder la même pochette. Le geste ne dessine rien : il **fond** d'une photo à
la suivante et le shader déforme le film.

**Coût assumé** : sept plaque de 630 × 1120 en JPEG ≈ **600 Ko** au total, à mettre dans le
précache. C'est le prix du réalisme ; il se paie une fois, et il est très inférieur aux 28 Mo de la
première visite (PWA, #357).

## 3. Les quatre temps

### 3.1 Toucher — le sachet se creuse

| | |
|---|---|
| Geste | appui n'importe où sur le sachet, **avant** toute autre étape |
| Effet | un creux se forme sous le doigt : centre assombri, liseré clair **cassé par du bruit**, plis qui rayonnent |
| Amplitude | liée à l'enfoncement, ressort sous-amorti (raideur 240, amortissement 15) : il s'enfonce en ~150 ms et rebondit au relâchement |
| Ce qui bouge | **le film seul** : la déformation est masquée par la silhouette du sachet, et **renforcée vers les soudures** ; le sachet entier glisse légèrement vers le doigt |
| Motif | **différent à chaque appui** : tirage seedé (graine exposée, rejouable) — jamais deux fois le même pli |
| Lumière | vient **du haut à gauche** (le bug du prototype : lumière d'en bas → le creux se lisait comme une bosse) |

### 3.2 Étiquette — l'autocollant se décolle

| | |
|---|---|
| Geste | appui sur l'étiquette puis glissement, **dans le sens que le joueur veut** (les plaques sont miroir si on tire à gauche) |
| Course | **170 px** pour aller de « collée » à « détachée » (96 px était trop vif à l'essai) |
| Seuil | **0,45** de la course : en deçà, elle **se recolle** ; au-delà, elle se détache |
| Rendu | quatre photos : collée → coin levé → enroulée → partie |
| Envol | une fois détachée, le sticker **détouré** sort du cadre dans le sens du doigt (880 ms, rotation, fondu seulement à la fin) — il ne s'efface **pas** sur place |
| Son | craquement **pendant le mouvement** uniquement, plus dense si on tire vite ; silence dès que le doigt s'arrête |

### 3.3 Déchirure — le long des pointillés, et pas ailleurs

| | |
|---|---|
| Geste | appui **près de la ligne de pointillés** (tolérance ≈ 8 % de la hauteur), puis glissement horizontal |
| Suivi | la déchirure suit le doigt, **s'arrête quand il s'arrête**, reprend où elle en était, et **revient** si on lâche avant la fin |
| Seuil d'ouverture | la déchirure doit atteindre **0,9** de la ligne : avant, lâcher referme ; après, lâcher ouvre |
| Rendu | trois photos : déchiré au quart, à moitié, ouvert — plus un repère lumineux au front de déchirure |

### 3.4 Ouverture — les cartes sortent de l'intérieur

| | |
|---|---|
| Déclencheur | **uniquement** la déchirure complète, jamais un appui |
| Sachet | il **descend** (26 %) pendant que les cartes sortent |
| Cartes | les **vraies `CardView`** du tirage, pas des images : elles montent **d'abord derrière la bande du haut** (donc on les voit émerger de l'ouverture), puis s'ouvrent en éventail devant |
| Ordre | l'ordre du tirage, une carte après l'autre (décalage ≈ 80 ms) |
| Son | « pop » grave et court à l'ouverture |

**Dette assumée** : dans le prototype, l'éventail se pose trop haut et les cartes sont petites
(30 % de la largeur de la zone, qui fait 315 px). Dans la vraie modale elles prennent leur taille, et
l'éventail doit se poser **devant le sachet**. C'est le seul temps qui reste « à affiner » à la
validation du 28/10/2026.

## 4. La machine d'états

Cinq phases, quatre gestes, trois seuils — **du TypeScript pur**, sans DOM ni horloge cachée
(c'est ce qui la rend testable en jsdom, `techniques.md` §8.1) :

```
ferme ──appui sur l'étiquette──▶ etiquette ──relâche ≥ 0,45──▶ dechirure
   ▲                                  │                              │
   └────────relâche < 0,45────────────┘                              │
                                                        déchirure = 0,9 et relâche
                                                                     ▼
                                                                  ouvert
```

| État | Ce qu'il porte |
|---|---|
| `phase` | `ferme` · `etiquette` · `dechirure` · `ouvert` |
| `etiquette` | 0 → 1, la levée |
| `dechirure` | 0 → 1, la progression sur la ligne |

**Invariants à garder par un test qui mord** (AGENTS.md §6) :

- l'étiquette ne redescend pas **pendant** le glissement (on ne recolle pas en revenant), mais elle
  revient à 0 si on lâche sous le seuil ;
- la déchirure, elle, suit le doigt **dans les deux sens** : c'est ce qui la rend annulable ;
- `ouvert` n'est atteignable que par `dechirure` — jamais depuis `ferme` ;
- un geste annulé (`pointercancel`, `lostpointercapture`) se traite **exactement** comme un
  relâchement (spec Pointer Events §3.3).

## 5. Ce qui n'est pas négociable

- **Mouvement réduit** : sous `useMouvementReduit()` (réglage du store **ou** `prefers-reduced-motion`),
  on va directement à l'état final, cartes à plat. `MotionConfig reducedMotion` **ne suffit pas** : il
  ne coupe que les transformations, pas les fondus.
- **Accessibilité** : WCAG 2.5.1 et 2.5.7 exigent qu'un geste de glissement ait un équivalent en un
  seul appui. Le banc n'en a pas encore ; le jeu doit avoir un **bouton « Ouvrir »** toujours visible
  qui joue la séquence sans geste, et qui sert aussi au clavier.
- **Aucune main à l'écran** : c'est le doigt du joueur. Les photos sont tirées sans main, et les
  prompts le disent.
- **Pas de texte cuit dans les images** : l'étiquette porte un pictogramme, le texte est écrit par
  l'interface.

## 6. Le son — trois points d'accroche, pas trois sons

D-137 n'en autorise **que deux** dans l'alpha (l'Arrivage et le verdict), et veut des sons **libres
sourcés**. L'animation expose donc trois moments — `contact`, `dechirure`, `ouverture` — et c'est
**#378** qui décide comment ils se branchent sur deux fichiers, et **#379** qui choisit les timbres.
Le prototype a montré qu'un craquement **synthétisé** (bruit filtré, grains liés à la vitesse du
doigt) suit le geste bien mieux qu'un fichier déclenché au clic : piste à garder pour le contact.

## 7. Les preuves à produire

- **jsdom** : la machine d'états, en TypeScript pur (aucun stub nécessaire) ; pour le composant,
  `setPointerCapture` et `Element.animate` **n'existent pas** dans jsdom — doubles de test dans
  `src/test/setup-jsdom.ts` (un précédent existe : `Comite.placement.test.tsx`) ;
- **planche de frames** : `scripts/filmer-animation.mjs` **clique et survole mais ne glisse pas** ;
  il faut lui ajouter un geste (CDP `Input.dispatchTouchEvent`), et indexer les cases par
  **progression** plutôt que par temps ;
- **WebGL** : jamais dans jsdom ; le rendu se prouve par planche, et un **repli** est obligatoire
  si `getContext('webgl2')` échoue (appareil ancien, ou « Mouvement réduit »).

## 8. Ce qui reste ouvert

1. **La sortie des cartes** (cf. §3.4) : éventail, taille, place, et la descente du sachet.
2. **Le repli sans WebGL** : quelle image montrer à la place du creux.
3. **Les planches définitives** : sept photos par sachet, mais combien de sachets ? Un seul pour
   l'instant — l'Arrivage n'a pas de variante visuelle, et rien ne le demande.
4. **Le tracé de la déchirure** : le prototype fond entre trois photos ; une vraie déchirure qui
   suit le doigt au millimètre demanderait un tracé vectoriel (recherche §2) — à trancher si le
   fondu ne suffit pas à l'usage.
