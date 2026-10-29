# Éditer un fichier — par remplacement ciblé, jamais par réécriture

Écrit le 28/10/2026, ticket #258 (rétro du 26/10/2026). Ce document dit **le geste**, pas la
discipline : un agent qui réécrit un fichier entier ne le fait pas par négligence, il le fait
parce que son outil d'édition ne sait pas viser une ligne dans un fichier de 3 900 lignes.

## 1. Le constat, mesuré

119 sessions du 24 au 26 octobre, 8 466 messages d'agent, 9 867 appels d'outils :

- **384 écritures de fichiers par `python3 - <<'PY'`** en trois jours, dans 39 sessions ;
- **218** sont des commandes de moins de 25 lignes — un remplacement ciblé suffirait ;
- les fichiers visés sont **toujours les plus gros** : `src/styles.css` (3 903 lignes, réécrit
  29 fois), `src/animation/attaque.ts` (2 466, 25 fois), `src/pages/Battle.tsx` (1 761, 21 fois).

**Ce qui n'est pas prouvé, et ne doit pas être affirmé** : le lien de cause à effet entre la
taille d'un fichier et la réécriture. Mesuré le 26/10 : **aucune** réécriture ne suit un
remplacement ciblé en échec (0 corrélation). Une coïncidence n'est pas une cause, et le ticket
le dit lui-même. Ce qui suit est donc une règle de **geste**, pas une explication du passé.

## 2. La règle

**Une écriture touche les lignes de son intention, et elles seules.**

- On **remplace un passage** en l'ancrant : trois lignes de contexte avant, trois après, assez
  pour que l'ancre soit **unique** dans le fichier.
- On ne **réécrit pas** un fichier entier pour changer dix lignes — ni par un heredoc Python,
  ni par un `write` complet, ni par un script « je relis puis je réécris tout ».
- Si l'ancre n'est pas unique, on **élargit l'ancre**, on ne bascule pas sur la réécriture.
- Si le passage est à 1 500 lignes du début, on **lit une plage** (ou on `grep` la ligne) pour
  trouver l'ancre : lire dix lignes ne coûte rien, réécrire 3 900 lignes coûte le fichier.

## 3. Pourquoi — trois effets observables

1. **Une réécriture écrase les modifications concurrentes.** Quatre agents travaillent par
   vague ([`parallelisme.md`](parallelisme.md) §1). Entre la lecture et l'écriture d'un fichier
   entier, la modification d'un autre auteur sur une ligne voisine **disparaît sans conflit** :
   git ne peut pas la voir, elle n'est jamais dans l'index. Un remplacement ciblé laisse cette
   ligne intacte, et un vrai conflit se **signale**.
2. **Le diff devient illisible.** Une réécriture de `styles.css` rend un diff de 3 900 lignes
   pour un changement de dix : la relecture ne peut plus dire **ce qui** a changé, donc ne peut
   plus dire si c'est juste. La revue (`code-review`, D-131) s'appuie sur le diff.
3. **Un reformatage involontaire change ce qui s'affiche.** Dans `src/data/`, un texte de carte
   par ligne : un repli déplace le texte à l'écran et fait échouer `npm run format:check`
   (`.prettierignore` les exclut pour cette raison).

Le point 1 est le seul qui soit une **perte** ; les deux autres sont du **coût de relecture**.
Aucun des trois ne dépend du langage ni de l'outil : c'est l'écriture du fichier entier qui les
produit, pas la commande qui l'écrit.

## 4. Le remède quand le remplacement ciblé ne suffit pas

Le remède n'est pas « faire plus attention » : c'est **un fichier plus petit**, ou **une plage
lisible**.

| Situation | Le geste |
|---|---|
| l'ancre est introuvable parce que le fichier est trop gros pour être lu | lire **une plage** (`offset`/`limit`), ou `grep -n` la signature, puis ancrer |
| deux lignes identiques dans le fichier | élargir l'ancre de trois lignes ; ne jamais « remplacer tout » sauf si **toutes** les occurrences doivent changer |
| le fichier fait plus de ~1 500 lignes et bouge à chaque ticket | **c'est la taille le défaut** : proposer un découpage (ticket de refactor, jamais un `write` complet en attendant) |
| un script doit produire le fichier (générateur) | c'est légitime : il est **déterministe** et relu par son test — ce n'est pas une réécriture manuelle |

La dernière ligne compte : `scripts/generateurs/plan-dev.mjs`, `scripts/generateurs/index-decisions.mjs` ou
`scripts/ressources/icones.mjs` écrivent des fichiers entiers **par conception**. La règle vise l'édition
d'un fichier **écrit à la main**.

## 5. Ce qui reste ouvert

Le ticket #258 est **parké** sur sa moitié diagnostic (décision de Bastien, 26/10/2026) : il
demande, avant de trancher, une corrélation normalisée par taille, la cause du contournement, et
un cas où une réécriture a changé des lignes qu'on ne voulait pas toucher. Ce document ne
remplace pas cette mesure — il fixe le geste qui ne dépend pas de son verdict, parce que
« réécrire écrase les modifications des autres agents » est vrai **indépendamment** de la cause.

Les deux questions ouvertes, à traiter par un ticket de refactor et non par une règle de plus :

- **découper** `src/styles.css`, `src/animation/attaque.ts`, `src/pages/Battle.tsx` ;
- ou **un outil d'édition par plage de lignes**, si le harnais en offre un.
