# Les versions — la règle, et comment on la publie

> Référence unique du projet sur le nom des versions. Elle **ne crée aucune règle de jeu** :
> les règles vivent dans `AGENTS.md` §4 et `docs/DECISIONS.md`. Les actes datés qui l'ont
> écrite : **D-048** (trois étapes nommées), **D-050** (l'étape est un mot, le numéro est la
> version), **D-051** (une ligne de version par étape), **D-090** (la note de version vit
> aussi **dans l'application**, prise aux releases GitHub).
>
> Un agent qui touche au code, à la doc ou à une publication lit cette page **avant** d'écrire
> un numéro quelque part.

## 1. Les trois chiffres

`majeur.mineur.correctif` — par exemple `0.1.1`.

| Chiffre | Ce qu'il dit | Chez nous |
|---|---|---|
| **majeur** | changement incompatible ; tant qu'il vaut `0`, la norme dit « pas encore sorti, tout peut changer » | **`1.0.0`** est la sortie : c'est le passage à 1 qui annonce « c'est sorti » |
| **mineur** | nouveauté compatible | **le changement d'étape** : `0.1.x` alpha → `0.2.x` beta → `1.0.0` |
| **correctif** | correction seule | **toute build donnée à quelqu'un** à l'intérieur d'une étape |

Deux réflexes : quand la mineure monte, le correctif **repart à zéro** (`0.1.7` → `0.2.0`, jamais
`0.2.7`) ; et un numéro ne se réutilise pas — deux builds qui partent chez des testeurs ont
**toujours** deux versions différentes.

## 2. Une ligne de version par étape

| Étape | Ligne de version | Affiché dans Réglages |
|---|---|---|
| **alpha** | `0.1.x` | `Alpha · 0.1.1` |
| **beta** | `0.2.x` | `Bêta · 0.2.0` |
| **release** | `1.0.0` | `Version finale · 1.0.0` |

**Dans une étape, tout monte le correctif** — une correction comme une nouveauté. Pourquoi :
l'étape annonce déjà que le périmètre est incomplet, donc distinguer « correctif » et
« nouveauté » à l'intérieur ne sert personne. Ce qui compte, c'est que deux builds portées à des
testeurs ne se confondent pas.

**Changer d'étape monte la mineure.** La beta ne reprend pas le numéro de l'alpha : sinon
`v0.1.4` désignerait deux builds différents, et le tag ne dirait plus rien.

## 3. L'étape est un mot, pas un suffixe

**Interdit** : `0.1.1-alpha.2`, `0.1.1-beta`. Personne ne dit « alpha deux », et un testeur ne
recopie pas ça. L'étape s'écrit **à côté** du numéro, et elle vit dans `package.json` :

```jsonc
{
  "version": "0.1.1",
  "stage": "alpha"
}
```

Les deux sont injectés au build (`vite.config.ts` → `__APP_VERSION__`, `__APP_STAGE__`), lus par
**`src/version.ts`** seul, et affichés par `APP_LABEL` (`Alpha · 0.1.1`). Valeurs admises pour
`stage` : `alpha`, `beta`, `release`. Un mot inconnu retombe sur `alpha` — on ne fait jamais
croire à une version finale par accident.

**Ne jamais écrire un numéro ni un mot d'étape dans un composant** : `src/version.test.ts`
échoue si un `1.2.3` apparaît quelque part dans `src/`. Une seule source, `package.json`.
**Une exception nommée** : `src/data/versions.ts` — l'historique des notes, **généré** depuis
les releases GitHub (`npm run notes:versions`, §4). C'est l'historique, donc il nomme les
versions passées ; la version **courante**, elle, ne s'y lit pas non plus — elle vient
d'`APP_LABEL`, et `src/data/versions.test.ts` vérifie qu'elle a bien sa note.

## 4. Publier une build

1. **Écrire la note** de la version à venir dans `src/data/versions.ts` — c'est ce que
   l'écran `/feuille-de-route` affiche, et c'est **le geste qui rend la règle tenable** : le tag
   part **avant** la release GitHub, donc la note est écrite d'abord, avec son
   `brouillon: true`. `src/data/versions.test.ts` **échoue** si la version de
   `package.json` n'a pas sa note : on ne publie pas une version sans dire ce qu'elle
   contient. Le **message aux testeurs** (`docs/ALPHA-TESTEURS.md`) ne recopie **aucun** numéro
   de version : son titre n'en porte pas, et il demande au testeur de lire le sien dans Réglages.
   Un numéro écrit à la main dans ce document vieillit à la release suivante — il annonçait encore
   0.1.13 quand la production servait 0.1.14 (#356) —, et `src/version.test.ts` le refuse.
2. **Monter la version** : `npm version 0.1.2 --no-git-tag-version` (dans `planquex/`), puis
   changer `stage` à la main si l'étape change.
3. **Vérifier** : `npm run check`, `npm test`, `npm run garde-fous`, `npm run build` — et
   regarder la version rendue (`grep -o "$(node -p 'require("./package.json").version')"
   dist/assets/*.js`). Puis les
   **fichiers générés** : `npm run plan:dev` et `npm run notes:versions` (réécrivent si besoin),
   puis `-- --verifie` sur chacun. Ce geste local est celui qui garde la release : la CI des PR
   ne les vérifie plus (D-113), et `fichiers-generes.yml` le refait sur le tag en filet. Le
   contrôle `--verifie` du tag **accepte un seul écart** (D-122) : la note de la version de
   `package.json` encore marquée `brouillon: true` alors que sa release est **publiée** — c'est
   le cas du tag, puisque le tag part avant la release et que la note est reprise ensuite
   (étape 7). Tant que la note n'est pas reprise, il le dit dans sa sortie et sort 0 ; tout
   autre écart (version en trop ou manquante, texte retouché, brouillon d'une autre version)
   sort 1 comme avant.
4. **Mettre la production au niveau de ce que la note promet** — la note se lit **à la sortie de
   la release**, donc ce qu'elle annonce doit être vrai **ce jour-là**, pas à la fusion. Pour les
   annonces du mur dans `#comite` (#318, D-120), qui est ce que `/confidentialite` décrit au
   présent : appliquer `supabase/migrations/0013_discord_comite.sql`, puis poser le webhook dans
   Vault — `select vault.create_secret('<url du webhook>', 'discord_webhook_comite');`. La
   procédure complète, avec sa vérification, est `docs/INTEGRATIONS-DISCORD.md` §10. Tant que ces
   deux gestes ne sont pas faits, la page Confidentialité **décrit un envoi qui n'a pas lieu** :
   c'est le premier pas à cocher, et la preuve qu'il est fait est **une annonce réelle** arrivée
   dans le salon (un post-it collé, une minute d'attente, `§10.4`), pas une migration « appliquée ».
5. **Commiter**, puis **poser le tag** `v<version>` (`v0.1.2`) et le pousser.
6. **Créer la release GitHub** avec `--prerelease` tant qu'on n'est pas en release, et le
   message aux testeurs (`docs/ALPHA-TESTEURS.md` tant qu'on est en alpha) en notes. C'est
   cette publication qui rend le brouillon du tag **attendu** aux yeux du contrôle
   `-- --verifie` (D-122) : avant elle, aucune tolérance — la note écrite d'avance est
   simplement ce que le générateur garde.
7. **Reprendre la release dans l'application** : `npm run notes:versions` relit les releases
   GitHub et réécrit `src/data/versions.ts` — le texte publié remplace la note écrite
   d'avance, et son `brouillon` tombe. C'est la seule fois où la note change après coup, et
   elle devient alors **la même des deux côtés**. Jusque-là, le contrôle du tag (`-- --verifie`,
   D-122) accepte ce brouillon comme **attendu** : c'est l'état normal d'un tag, pas une
   divergence. Ce que la tolérance ne fait pas : **réparer un tag déjà poussé** — le run de
   `fichiers-generes.yml` tourne sur le commit tagué, donc il garde le comportement de ce
   commit. Une fois l'étape faite, la tolérance ne sert plus et le contrôle repasse par le
   chemin strict.
8. **Le tag dit la version, pas l'étape** : c'est la release qui porte le drapeau *pre-release*.

**Cadence (D-128).** Une release part quand un **lot cohérent** est prêt, et **pas plus d'une par
jour** : deux releases le même jour ont déjà eu lieu, et le testeur doit pouvoir dire « je suis sur
celle d'aujourd'hui ». **Plusieurs pull requests peuvent entrer dans une même release** : la limite de
`docs/agents/parallelisme.md` porte sur deux PR qui touchent les mêmes fichiers, pas sur le nombre de
releases. Une PR n'est donc pas une release.

Un `git tag -a v0.1.2` sur un commit, c'est un point de retour ; un tag déplacé à la main après
coup, c'est un mensonge. Si la build était fausse, on monte la version et on refait un tag.

### 4.1 Les deux endroits, et pourquoi les deux

| Endroit | Ce qu'il porte | Qui le lit |
|---|---|---|
| **La release GitHub** | le journal complet, daté, avec le message aux testeurs | le dépôt, l'historique, `npm run notes:versions` |
| **`/feuille-de-route`** (dans le jeu) | la version courante mise en avant, puis l'historique — et, depuis D-097 (3), l'étape en cours, les critères de sortie, les jalons et ce qui est prévu | **le testeur**, sans compte, sans sortir du jeu |

**Pourquoi le fichier de données est embarqué au build et pas lu en direct** : le dépôt est
**privé**, l'API GitHub répond `404` sans jeton (mesuré le 24/10/2026), et un jeton dans le
bundle se lit dans les DevTools. L'application lit donc `src/data/versions.ts`, pris aux
releases par `npm run notes:versions` — elle marche **hors ligne**, et il n'y a rien à
configurer. Le script tourne **avant de taguer**, jamais pendant `npm run build` : la CI n'a
ni `gh` ni accès à GitHub, et un build qui dépend du réseau ne se rejoue pas.

### 4.2 Le corps de la release, dans cet ordre

Depuis le 26/10/2026, le corps de chaque release GitHub a **deux catégories**, dans cet ordre :

1. **`## Ajouts et améliorations`** — ce qui est nouveau ou mieux qu'avant.
2. **`## Corrections de bugs`** — ce qui était cassé et ne l'est plus.

Un paragraphe d'introduction (`Version 0.1.13, étape alpha…`) peut précéder les deux. Une catégorie
vide se retire, plutôt que de rester avec « rien ». Chaque point est une phrase complète, lue par
un testeur : pas de nom de fichier, pas de jargon interne sans l'expliquer.

Les **autres informations** (migration, sauvegarde, pièges connus) vont **après** les deux
catégories, sous `## Pour un testeur` : ce titre est dans `SECTIONS_ECARTEES`
(`scripts/notes-versions.mjs`), donc il reste dans la release et sort de la note du jeu.

Les **problèmes connus** de la version se lisent en base et se collent sous ce même titre :
`npm run problemes` imprime le bloc (D-119, `docs/COMITE.md` §5.2), et il le rend **sans titre
markdown** — un `###` sous `## Pour un testeur` rouvrirait la section, et les problèmes
entreraient dans `/feuille-de-route` comme s'ils étaient des nouveautés.

Le parseur lit chaque `##` comme un groupe de `src/data/versions.ts` : les deux catégories
apparaissent donc telles quelles dans `/feuille-de-route`. Un titre inventé hors de ce modèle
entre dans la note du jeu : ne pas en créer sans raison.

## 5. Ce qu'un agent doit faire, et ne pas faire

- **Avant** de citer une version quelque part : la lire dans `package.json` (ou `APP_LABEL` à
  l'écran) — jamais de mémoire, jamais recopiée d'un message précédent.
- **Après** un changement qui part chez quelqu'un : **deux** écritures, et elles disent la
  même chose — la note dans `src/data/versions.ts` (lue par l'écran `/feuille-de-route`), et le
  corps de la **release GitHub** (le journal public, daté). `npm run notes:versions` les
  réconcilie à la publication : c'est la release qui a le dernier mot, et
  `src/data/versions.test.ts` refuse une version sans note.
- **Ne pas** éditer `src/data/versions.ts` à la main au-delà de la note à venir : le fichier
  est **généré** (`scripts/notes-versions.mjs`), et `npm run notes:versions -- --verifie`
  (relayé hors ligne par `scripts/notes-versions.test.ts`) dit s'il a divergé.
- **Ne pas** inventer un numéro pour « faire beau » (un saut de `0.1.3` à `0.5.0` ne dit rien).
- **Ne pas** renommer un tag publié : on monte la version.
- Les testeurs citent **ce que Réglages affiche** (`Alpha · 0.1.2`) : c'est ce que
  `docs/ALPHA-TESTEURS.md` leur demande de recopier, et c'est aussi le libellé mis en avant
  sur `/feuille-de-route`.
