# Les versions — la règle, et comment on la publie

> Référence unique du projet sur le nom des versions. Elle **ne crée aucune règle de jeu** :
> les règles vivent dans `AGENTS.md` §4 et `docs/DECISIONS.md`. Les actes datés qui l'ont
> écrite : **D-048** (trois étapes nommées), **D-050** (l'étape est un mot, le numéro est la
> version), **D-051** (une ligne de version par étape).
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

## 4. Publier une build

1. **Monter la version** : `npm version 0.1.2 --no-git-tag-version` (dans `planquex/`), puis
   changer `stage` à la main si l'étape change.
2. **Vérifier** : `npm run check`, `npm test`, `npm run garde-fous`, `npm run build` — et
   regarder la version rendue (`grep -o "$(node -p 'require("./package.json").version')"
   dist/assets/*.js`).
3. **Commiter**, puis **poser le tag** `v<version>` (`v0.1.2`) et le pousser.
4. **Créer la release GitHub** avec `--prerelease` tant qu'on n'est pas en release, et le
   message aux testeurs (`docs/ALPHA-TESTEURS.md` tant qu'on est en alpha) en notes.
5. **Le tag dit la version, pas l'étape** : c'est la release qui porte le drapeau *pre-release*.

Un `git tag -a v0.1.2` sur un commit, c'est un point de retour ; un tag déplacé à la main après
coup, c'est un mensonge. Si la build était fausse, on monte la version et on refait un tag.

## 5. Ce qu'un agent doit faire, et ne pas faire

- **Avant** de citer une version quelque part : la lire dans `package.json` (ou `APP_LABEL` à
  l'écran) — jamais de mémoire, jamais recopiée d'un message précédent.
- **Après** un changement qui part chez quelqu'un : une ligne de plus dans `CHANGELOG` ? Non —
  **le corps de la release GitHub** est le journal, et il est daté. Pas de fichier de plus.
- **Ne pas** inventer un numéro pour « faire beau » (un saut de `0.1.3` à `0.5.0` ne dit rien).
- **Ne pas** renommer un tag publié : on monte la version.
- Les testeurs citent **ce que Réglages affiche** (`Alpha · 0.1.2`) : c'est ce que
  `docs/ALPHA-TESTEURS.md` leur demande de recopier.
