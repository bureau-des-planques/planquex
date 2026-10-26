# Le comité — ce que les invités remontent, et ce qu'on en fait

> Référence d'exploitation du mur de post-its. Les **décisions** qui l'ont écrit : **D-058** (le
> mur et ses deux familles), **D-059** (le tri, les statuts) — **amendée par D-088** (l'identité
> est un compte authentifié, validé à la main) —, **D-060** (l'UI), **D-085** (le gueulage est une
> nature à part, sans famille).
>
> **Depuis D-088**, poster **depuis le jeu** exige un compte **approuvé** : Google ou courriel,
> puis validation manuelle par Bastien. Un compte en attente lit le mur et joue, il n'écrit pas.
> Le mur complet est là : **poster** (#136), **voter** (#137), **commenter** (#138), **corriger ou
> retirer** son post-it (#139), et **trier** depuis l'écran d'administration (`0006`).
> Le formulaire externe reste le palliatif de l'alpha d'avant — il ne demande pas de compte.
> **Renommée par D-097 (#210)** : l'entrée s'appelle **le comité** (elle était la « Boîte à idées »),
> son adresse est `/comite`, et `/idees` y redirige ; le fichier du mur est `docs/comite.json`.
> Le vocabulaire est dans `AGENTS.md` §3 : **le comité** (l'entrée, la bulle), **le mur**
> (l'écran), **post-it IP** (une idée), **post-it OUF** (un signalement), **un invité**.

## 1. Les deux familles, et le gueulage à part

| Famille | Ce qu'on y met | Comment on le reconnaît |
|---|---|---|
| **post-it IP** | une idée, une fonctionnalité, un avis (« j'aurais aimé », « c'est bizarre ») | ça propose quelque chose |
| **post-it OUF** | un signalement : ça casse, ça ment, ça bloque | ça décrit un défaut |

Trois familles, c'est déjà trop pour un mur qu'on lit en trente secondes : un avis neutre se range
dans les **IP**.

**Le gueulage n'est ni l'une ni l'autre** (D-085) : c'est une **nature propre**, sans famille. La
personne gueule d'abord ; c'est la **réponse d'après** — « tu veux remonter un bug ou proposer une
idée ? » — qui produit une IP ou un OUF, jamais le gueulage lui-même. Deux formes en découlent :

1. le **gueulage seul**, quand la personne n'a rien ajouté (« Non j'ai déjà assez gueulé ») ;
2. le **gueulage avec le post-it associé collé dessus**, quand la même réponse a produit une IP ou
   un OUF : le gueulage porte alors `lie`, l'`id` de ce post-it, et l'écran le colle sur lui (§3).

Le gueulage se trie comme les autres (`en attente`, `retenu`, `écarté` avec sa raison) ; le post-it
associé, lui, se trie **séparément** et garde sa famille.

## 2. Les statuts, et qui les fait avancer

```
en attente → retenu → en cours → fait
                    ↘ écarté (avec sa raison)
```

- **`en attente`** : le post-it est arrivé, personne ne l'a encore lu. C'est l'état de tout ce qui
  entre.
- **`retenu`** : Bastien l'a jugé digne d'être fait. **Lui seul** décide — l'agent prépare, il ne
  valide pas.
- **`en cours`** et **`fait`** : le post-it a un **ticket** ; c'est l'état du ticket qui fait foi,
  pas une seconde échelle tenue à la main.
- **`écarté`** : refusé, **avec sa raison écrite**. Un post-it écarté sans raison est un mur mort :
  c'est ce qui apprend aux invités ce qui vaut la peine d'être remonté.

Le mur affiche ces statuts, donc les invités voient ceux qui sont **validés**, ceux qui sont **en
attente**, et où en sont les retenus.

## 2 bis. Le mur, à l'écran

**C'est une page**, pas un panneau : un grand **tableau** sur lequel les post-its sont collés. La
**bulle** y mène, et elle est **absente pendant un combat** — donc on ne quitte jamais une partie en
cours pour aller lire le mur.

### Les trois apparences : deux familles, et le gueulage à part

| Apparence | Quand | Ce que ça dit |
|---|---|---|
| **jaune** | famille **IP** | une idée, une amélioration, un avis |
| **rouge** | famille **OUF** | un signalement |
| **blanc, plus grand** | un **gueulage** (le texte brut, tel qu'écrit) | on l'a lu, et on ne le classe pas de force |

Le gueulage **ne porte aucune famille** (D-085) : son étiquette dit « Gueulage », jamais
« Gueulage · OUF ». Quand la même réponse a produit un post-it, celui-ci est **collé sur** le
gueulage — sa teinte de famille, son titre, son statut — et il ne s'affiche pas en plus à côté. Un
gueulage **sans suite** garde son texte brut, et c'est là qu'il est le plus utile.

### La disposition fait humaine

Les post-its sont **légèrement inclinés** et **se chevauchent un peu** — jamais assez pour cacher le
texte d'un autre. Chaque post-it porte sa **position** dans le fichier du mur (`position`), en
pourcentage du tableau : ainsi tout le monde voit **la même** disposition, et elle survit au changement
d'écran.

**Une interface pour les placer** : un mode où on les **glisse** à la main, et qui **écrit la position**
là où le mur la lit. **Sur la base (#185, #186)**, le lâcher écrit `position_x`, `position_y` et
`position_angle` **tout de suite** : tout le monde voit la disposition sans commit. L'auteur range
**ses** post-its ; l'**administration** range **n'importe lequel** (D-092), et un compte en attente ne
range rien du tout. **Sans base**, il n'y a plus d'export (#215, D-097 (6)) : le mode déplace les
post-its à l'écran, et le fichier garde `position`, **écrit à la main**.

**Un post-it neuf ne se colle pas sur un autre (#185)** : sa place est tirée au hasard, puis écartée
des places déjà prises — le calcul garde le point dont l'écart à toutes les autres est le plus grand.
Un tableau bien rempli peut n'avoir plus de place libre : la disposition reste alors une affaire de
main, et le post-it se déplace.

### Ce que chaque post-it porte

En bas, comme sur un réseau social : **un pouce levé et un pouce baissé**, avec leurs comptes, et
**mon** vote distinct du total. Puis l'**auteur**, le **statut**, et le **lien vers le ticket** quand
il y en a un.

**Le fil (#138)** : sous chaque post-it, ses **commentaires** — du **plus ancien au plus récent**,
**sans imbrication**, chacun avec son **pseudo** et sa **date**. Un commentaire précise un cas
(« pareil chez moi, au deuxième tour ») sans ouvrir un post-it concurrent ; il est limité à
**500 caractères**, et l'écran le dit pendant la frappe. On **retire les siens**, jamais ceux d'un
autre. La **lecture** est ouverte à tout compte, même **en attente** ; l'**écriture** exige un compte
**approuvé** (D-088), et c'est la base qui refuse, pas seulement l'écran. Le fil vit **dans le
post-it agrandi** (une pression), comme le statut et les pouces ; un post-it qui a des commentaires
le dit même replié (« 2 commentaires — ouvrir pour lire »).

**La relecture (#139)** : tant que mon post-it est **`en attente`**, je peux corriger son **titre** et
son **texte**, ou le **retirer**. Après, non — et l'écran **dit pourquoi** : dès qu'un statut a bougé,
le mur doit dire la même chose à tout le monde, et le tri (une raison, un ticket) ne s'efface pas.
Le retrait passe par une **confirmation**, et il **supprime** le post-it (§3). Le titre et le texte
ne passent pas par un `update` direct : la base les donne à une **fonction** qui vérifie l'auteur et
le statut (`0006_tri_et_corrections.sql`), parce qu'un droit de colonne ne sait pas distinguer
l'auteur d'un administrateur.

> **Les votes n'existent pas sans la base** : ils supposent un état partagé entre appareils. Sans
> configuration (ou quand la base ne répond pas et que le mur retombe sur le fichier), le mur montre
> les post-its, leurs couleurs, leurs statuts et leur disposition — **ni bouton ni compteur**, et
> rien n'est contacté. **Avec la base** (#137) :
>
> - **un appareil, un pouce par post-it** (la clé primaire de `votes`, côté base) ;
> - **un clic sur un pouce** : si je n'ai pas voté, j'**ajoute** mon vote ; si j'ai déjà levé **ce**
>   pouce, je le **retire** ; si j'ai levé **l'autre**, je **change** mon vote (une modification de ma
>   ligne, jamais une seconde) — dans cet ordre de priorité ;
> - **mon** vote est un pouce **plein** avec l'étiquette « ton vote » : le total le comprend, il ne
>   s'y ajoute pas ;
> - **pas pour soi** : sur son propre post-it on voit les comptes, on ne vote pas. L'écran ne propose
>   pas le bouton, mais la règle est **dans la base** (`0004_pouces.sql`), pas dans l'écran ;
> - le compte bouge **tout de suite** ; si le réseau ou la base refuse, il **revient** à l'état d'avant,
>   avec un message discret sur le post-it. Un post-it écarté reste votable ; un post-it effacé ne
>   l'est plus (le message le dit) ;
> - le client n'écrit **jamais** `votant` : la base le remplit par `auth.uid()`.

### Sur téléphone — des post-its quand même, empilés

Le tableau **libre** ne fonctionne pas sur 360 px : les post-its s'y recouvriraient pour de bon. Mais
l'écran étroit **garde des post-its** — il ne se contente pas d'une liste de texte :

- **un post-it par ligne** entre 360 et 420 px, **deux par ligne** au-delà : c'est le seul changement
  de mise en page ;
- chaque post-it **garde son papier** : sa couleur de famille, sa **légère inclinaison**, et l'air
  d'être collé — incliné oui, **recouvert non** : la règle « le texte d'un autre n'est jamais caché »
  devient ici « deux post-its ne se recouvrent pas » ;
- **ils s'empilent**, la page **grandit** avec eux et **défile** : le mur n'a pas de hauteur fixe, il
  s'allonge tant qu'il y a des post-its ;
- **une pression agrandit un post-it** : sa taille de lecture — et c'est là que se rangent les choses
  qui ne tiennent pas sur un post-it de téléphone, c'est-à-dire **le statut, le lien vers le ticket, et
  les pouces** (avec la base, #137). Sur écran large, ces éléments
  vivent **sur** le post-it.

Le **mode de placement** reste un travail de **bureau** : il ne se fait pas au doigt sur un téléphone.
Sur la base, l'auteur range **son** post-it et l'**administration** range tout (#185, #186, D-092) : le tableau se répare donc post-it par post-it, et le bureau peut reprendre un post-it mal posé.

## 2 ter. Le suivi — `/comite/suivi` (#211, D-097 (2) et (5))

Le comité a **deux pages**, sous une barre de sous-onglets : **Le mur** (`/comite`, ce qui
arrive) et **Le suivi** (`/comite/suivi`, ce qu'on en a fait).

- **trois groupes** : `en cours`, `fait` — affiché **« Fait »**, un seul nom pour un état — et
  `écarté`, **avec sa raison** (D-059 : un écarté sans raison est un mur mort) ;
- `en attente` et `retenu` **restent sur le mur** : un post-it non trié n'a rien à faire dans
  un suivi, et le montrer deux fois ferait deux murs ;
- **ouvrir la page pose le repère** `vu_le` du compte, par `public.marquer_comite_vu()`
  (migration `0008`) — **jamais** un `update` direct, une politique RLS ne distinguant pas
  les colonnes. C'est ce qui remet le compteur du comité à zéro (D-097 (5)) ; sans base
  configurée, le geste est **inerte** ;
- la **source** est celle du mur : la base, ou `docs/comite.json` en secours — un suivi ne se
  déclare jamais vide parce que la base n'a pas répondu.

## 2 quater. Le compteur « choses à voir » — #212, D-097 (5)

Une **pastille numérotée** sur l'onglet **Comité** de la barre du bas, et l'**alerte** flottante
(`AlerteComite`, un post-it numéroté) qui **mène au suivi**. Elles répondent à une seule question :
**qu'est-ce qui a changé pour moi depuis ma dernière visite ?**

Ce qui compte, et **rien d'autre** :

1. **mes** post-its dont le **statut** a changé — la date est `postits.updated_at`, posée par le
   déclencheur du **statut seul** (migration `0008`) : corriger son texte ou ranger son post-it
   ne réveille pas le compteur ;
2. les **commentaires des autres** arrivés sur **mes** post-its — **jamais les miens** : répondre à
   son propre post-it n'apprend rien de neuf, et une pastille qui ne retombe jamais quand on se
   relit serait du bruit (`npm run garde-fous`, entrée #212).

Le **repère** est `comptes.vu_le` : **en base**, donc il suit le compte d'un appareil à l'autre
(D-097). Il est **posé à l'ouverture du suivi** par `public.marquer_comite_vu()` (voir §2 ter),
jamais par un `update` direct ; le compteur relu ensuite rend **0**.

**Où il est absent, et pourquoi** : **à zéro** (une pastille qui affiche 0 crie pour rien), **sans
base configurée** (rien n'est contacté : l'alpha fonctionne sans backend, D-058), et **en combat**
(on ne quitte pas une partie en cours pour un post-it — la barre y perd déjà l'onglet Comité). Sur
**Le suivi**, l'alerte s'efface aussi : c'est la page qui vient de les voir.

**La lecture** (`compterChosesAVoir`, `src/lib/murBase.ts`) fait **trois requêtes fixes**, jamais une
par post-it (pas de N+1) : mon repère, **mes** post-its (la vue `postits_avec_votes`, filtrée par
`auteur`), puis les commentaires de **tous** mes post-its en **un** `in`. Le filtre de date et
d'auteur se fait en mémoire : le repère est une donnée de mon compte, pas une colonne de la table
lue. Une base configurée qui échoue **lève** — l'écran n'affiche alors aucune pastille, et
l'erreur ne devient pas un zéro qui aurait l'air vrai.

## 3. Le fichier du mur

`design/…` non : le mur vit dans **`docs/comite.json`**, versionné avec le dépôt, parce que
c'est la seule source partagée que le jeu peut lire sans backend (D-058).

```jsonc
{
  "postits": [
    {
      "id": "p-001",              // court, stable, jamais réutilisé
      // « IP » ou « OUF », et rien d'autre — ABSENT pour un gueulage (D-085).
      "kind": "IP",
      "titre": "Une ligne, à l'impératif ou nominative",
      "texte": "Le retour tel qu'il a été écrit, à peine nettoyé",
      "ecran": "Combat",          // Accueil | Collection | Deck | Combat | Réglages | Autre
      "pseudo": "Employé 404",    // le nom local du posteur
      "version": "Alpha · 0.1.2", // ce que Réglages affichait chez lui
      "statut": "en attente",     // en attente | retenu | en cours | fait | écarté
      "raison": "",               // obligatoire dès que le statut vaut « écarté »
      "ticket": null,             // le numéro d'issue GitHub dès qu'il y en a un
      // Un gueulage s'affiche blanc et plus grand, et ne porte AUCUNE famille :
      // `kind` est alors ABSENT du fichier, jamais « IP » (D-085).
      "gueulage": false,
      // Sur un gueulage : l'id du post-it (IP ou OUF) que la même réponse a produit,
      // et que l'écran colle dessus. `null` quand le gueulage est seul.
      "lie": null,
      // Disposition « collée main », en POURCENTAGE du tableau — jamais en pixels, il
      // change de taille selon l'écran. `x` et `y` vont de 0 à 100, `angle` de -5 à +5.
      "position": { "x": 12, "y": 34, "angle": -2 },
      // Les compteurs du pouce levé et du pouce baissé, remplis par la base (#136, #137).
      // Le fichier les tient à zéro : il n'a aucun état partagé. Mon vote (`mon`, « up » ou
      // « down » ou nul) n'existe que lu en base ; il n'est jamais écrit dans ce fichier.
      "votes": { "up": 0, "down": 0 }
    }
  ]
}
```

Un post-it **retiré** par son auteur (#139) **disparaît du fichier** : il n'existe pas de statut
« retiré », et un mur qui garderait une ligne barrée dirait ce que personne n'a écrit. Le jeu ne
connaît donc que les **cinq** statuts de la liste. **En base, c'est la même règle** : le retrait est
une **suppression** (`delete`), qui emporte les votes et les commentaires du post-it
(`on delete cascade`). Pour **l'auteur**, la base ne l'autorise que **tant que le post-it est
`en attente`** (`0006`) — après, il porte un tri que le geste effacerait. Pour
**l'administration**, elle l'autorise **à n'importe quel statut** (#186, `0007`, D-092) : c'est le
geste de modération, et la confirmation dit ce qu'il efface.

Le jeu **lit** ce fichier et n'écrit jamais dedans. Il est mis à jour **hors du jeu** :
`npm run mur:import` ajoute les réponses du formulaire (§4.5), `npm run statut` déplace le tri
(§5.1), et la disposition s'écrit à la main (§2 bis). C'est le prix de l'absence de backend, et
il est assumé (D-058).

**Depuis #136**, quand la base est configurée (`VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`), le jeu lit la vue `postits_avec_votes` et **poste directement**
depuis le mur. Le fichier reste le **contrat de données** et la **source de secours** : sans
variables, ou si la base ne répond pas, le mur affiche ce fichier, sans écran cassé. Dans ce
cas, le formulaire (§4) reste la porte d'écriture.

**Le rangement (#185, #215)** : le mode de placement n'exporte plus de fichier — sur la base, le
lâcher écrit `position_x`, `position_y` et `position_angle` (politique « chacun déplace les
siens » de `0001`, reprise par `0005`) ; sans base, il ne fait que déplacer à l'écran, et
`position` s'écrit à la main dans le fichier. Et un post-it neuf est posé là où il cache le
moins de texte : sa place de hasard est écartée des places déjà prises, au lieu de tomber
dessus.

## 4. Le formulaire

La porte d'écriture de l'alpha **sans backend** (avec la base configurée, #136 fait poster
depuis le mur). C'est lui qui décide de la **qualité** des retours : un formulaire qui demande
« décris ton bug » reçoit « ça bug » ; un formulaire qui demande *ce que tu faisais* et *ce que
tu attendais* reçoit de quoi corriger.

**Adresse** : dans `docs/comite.json` (`formulaire`). Le jeu la lit et l'ouvre depuis la bulle.

> ### ⚠️ Le piège qui a déjà mordu (22/10/2026)
>
> **Un champ « Importer un fichier » ferme le formulaire.** Google impose la connexion à un compte
> pour *tous* les répondants dès qu'une question accepte un fichier — ce n'est pas un réglage qu'on
> peut désactiver, c'est la règle. Le formulaire s'est retrouvé en **401** (« Vous devez vous
> connecter ») pour n'importe quel visiteur, y compris sans lien avec le reste des réglages.
>
> **On demande donc un lien, jamais un fichier** : la question « Capture » est une **réponse courte**
> où la personne colle l'adresse d'une image. Le contrôle qui vaut, dix secondes : ouvrir le
> formulaire dans une **fenêtre privée**, sans être connecté — s'il demande de se connecter, il est fermé.
>
> Deux autres réglages ferment un formulaire sans prévenir : **« Limiter à 1 réponse »** et
> **« Collecter les adresses e-mail → Vérifié »**. Les trois se ressemblent : ils réclament une
> identité, donc ils exigent une connexion.

### 4.1 La forme cible

Un **préambule**, puis un **aiguillage** vers deux sections. Chaque ligne dit le **type** du champ,
s'il est **obligatoire**, et le **texte d'aide** (le petit texte gris sous la question — c'est lui qui
fait la différence).

**Préambule** (titre + description du formulaire)

> Bureau des Planqués — alpha. Dis-nous ce qui marche, ce qui casse, ce qui manque.
> **La version est en bas de l'écran Réglages** : recopie-la telle quelle. Sans elle, on ne saura pas
> si ce que tu signales existe encore.

| # | Champ | Type | Obligatoire | Texte d'aide |
|---|---|---|---|---|
| 1 | **Version du jeu** | Réponse courte | **oui** | « En bas de Réglages, par exemple `Alpha · 0.1.2`. Recopie-la telle quelle. » |
| 2 | **Tu veux quoi ?** | Choix multiples (une seule) | **oui** | « Un bug = quelque chose casse ou ment. Une idée = quelque chose manque ou ferait mieux. Gueuler = les deux à la fois. » |

**Section « Post-it OUF »** (un signalement — aiguillage : *Remonter un bug*, *Gueuler*)

| # | Champ | Type | Obligatoire | Texte d'aide |
|---|---|---|---|---|
| 3 | **Titre** | Réponse courte | **oui** | « Une ligne. Exemple : “le bouton Fin du tour reste grisé”. » |
| 4 | **Ce que tu faisais** | Paragraphe | **oui** | « L'écran, l'action, la carte. Exemple : “j'étais au combat, j'ai cliqué sur Pansement”. » |
| 5 | **Ce qui s'est passé** | Paragraphe | **oui** | « Le fait, sans jugement. Un message d'erreur ? Recopie-le. » |
| 6 | **Ce que tu attendais** | Paragraphe | **oui** | « Ce qui aurait dû se passer, à ton avis. » |
| 7 | **Écran** | Choix multiples (une seule) | non | « Accueil, Collection, Deck, Combat, Réglages, autre. » |
| 8 | **Capture** | Réponse courte | non | « Colle un **lien** vers une image (ton cloud, un message à toi-même). L'envoi de fichier oblige à ouvrir un compte Google, on ne l'impose pas. » |

**Section « Post-it IP »** (une idée, une amélioration — aiguillage : *Proposer une feature*)

| # | Champ | Type | Obligatoire | Texte d'aide |
|---|---|---|---|---|
| 9 | **Titre** | Réponse courte | **oui** | « Une ligne. Exemple : “voir combien d'Arrivages il me reste à ouvrir”. » |
| 10 | **L'idée** | Paragraphe | **oui** | « Ce que tu voudrais, et dans quelle situation ça te servirait. » |
| 11 | **À quoi ça servirait** | Paragraphe | non | « Ce que ça change pour toi. Si tu ne sais pas, laisse vide. » |
| 12 | **Écran** | Choix multiples (une seule) | non | idem (7) |
| 13 | **Capture** | Réponse courte | non | idem (8) |

### 4.2 Les cinq réglages qui ne se voient pas

1. **Ne pas collecter les adresses e-mail** (Paramètres → Réponses → *Collecter les adresses
   e-mail* : désactivé). Depuis **D-088**, le compte de l'invité porte déjà son courriel : ce
   formulaire n'est qu'un palliatif, et redemander l'adresse créerait une seconde liste à tenir.
2. **Ne pas limiter à une réponse** (le même invité doit pouvoir signaler trois choses en trois fois).
3. **Ne pas utiliser le champ « Importer un fichier »** : il **oblige** à une connexion Google
   supplémentaire et à un stockage chez le tiers. D'où le champ 8, qui demande un **lien**.
4. **Aiguillage** : sur la question 2, *Aller à la section en fonction de la réponse* — « Remonter un
   bug » et « Gueuler » vers **Post-it OUF**, « Proposer une feature » vers **Post-it IP**.
5. **La version est le premier champ, et obligatoire** : un retour sans version ne dit pas s'il
   concerne encore la build courante.

### 4.3 L'état du formulaire au 22/10/2026

Relevé sur le formulaire public (`viewform`, **HTTP 200** : ouvert aux visiteurs).

**Il ouvre sur quatre chemins**, après la question de version :

| Choix | Ce qui suit |
|---|---|
| **Remonter un bug** | section **Post-it OUF** — titre, ce que tu faisais, ce qui s'est passé, ce que tu attendais, écran, lien |
| **Proposer une feature** | section **Post-it IP** — titre, l'idée, à quoi ça servirait, écran, lien |
| **Gueuler** | **« Pourquoi qu'on Gueule »** : un champ libre (« Exprime toi »), puis « Envie d'aider ? » — *Remonter un bug* → OUF, *Proposer une idée* → IP, ou **« Non j'ai déjà assez gueulé comme ça »** qui envoie le message tel quel |
| **Donner ton avis sur le Jeux** | **« Avis sur le jeux »** — ce que tu as aimé, ce que tu n'as pas aimé |

**Pourquoi ce chemin « gueuler » est bon** : il prend l'émotion d'abord, et ne demande la structure
qu'**ensuite** — avec une sortie volontaire (« assez gueulé ») qui n'oblige personne à classer sa
colère. C'est ce qui manquait : un post-it sans titre ni écran était intriable, celui-ci offre de
le devenir sans le réclamer.

**Le chemin « avis »** est la donnée la plus précieuse de l'alpha : la question qu'on se pose est
« est-ce que la boucle tient », et « ce que tu as aimé / pas aimé » y répond mieux qu'un rapport de bug.

**Les cinq corrections — état arrêté au 22/10/2026** (acte : **D-073**) :

| # | Correction | État |
|---|---|---|
| 1 | Le pseudo, demandé nulle part | **Fait** — question « Pseudo », *réponse courte*, **facultative**, en **tête** du formulaire. Vide = « anonyme » sur le mur |
| 2 | La version et la question d'entrée **obligatoires** | **Déjà satisfait** — le drapeau se lit dans `FB_PUBLIC_LOAD_DATA_[4][0][2]` (`1`) |
| 3 | « Capture » en **titre**, la phrase en **aide** | **Fait** — sur les deux chemins |
| 4 | Une **aide** sur la question d'entrée | **Écartée** (22/10/2026) |
| 5 | L'**écran** sur le chemin « avis » | **Écartée** (22/10/2026) |

> **Relevé du 22/10/2026 (session `planquex-infra`).** La structure du formulaire se lit **de
> l'extérieur** : le `viewform` expose `FB_PUBLIC_LOAD_DATA_`, où `[4][0][2]` est le drapeau
> **obligatoire** (`1`/`0`). Contrairement à ce qu'écrivait le point 2, les cases **se lisent** :
> la version et la question d'entrée étaient **déjà** obligatoires, comme tous les champs marqués
> « oui » en §4.1. Aucun champ « Importer un fichier » n'existe, et le formulaire reste **public**
> (`curl` sur le `viewform` → `200` **hors connexion**). Les points 4 et 5 sont **écartés**, et
> **D-073** le dit : ils ne changent rien au tri, alors que le pseudo en était le seul point
> **bloquant**.

**Le ton est celui du projet** — « Recueille avis Alpha », « Pourquoi qu'on Gueule », « Exprime toi »,
« Non j'ai déja assez gueuler comme ça », et les coquilles qui vont avec : on n'y touche pas, c'est la
satire.

### 4.3 bis La règle de rangement sur le mur

Le mur ne connaît que **deux familles** (D-058) ; le formulaire en propose quatre, et le gueulage
n'est **aucune des deux** (D-085). Le rangement est donc mécanique, et il n'y a rien à décider au
tri :

| Chemin du formulaire | Ce qu'on met sur le mur |
|---|---|
| Remonter un bug | un **OUF** |
| Proposer une feature, **Donner ton avis** | une **IP** |
| Gueuler | un **gueulage**, **sans famille** |

Le chemin « Gueuler » ne se range **plus** en IP : le gueulage est à part, et c'est la **réponse
d'après** qui produit le post-it structuré — *Remonter un bug* remplit la colonne 7 « Titre » de la
même ligne, *Proposer une idée* remplit la colonne 13. Le gueulage porte alors l'`id` de ce post-it
dans `lie`, et l'écran le **colle dessus** ; s'il n'y a pas de suite (« Non j'ai déjà assez gueulé
comme ça »), le gueulage reste **seul**. Le gueulage garde le texte brut ; les détails du bug ou de
l'idée vivent sur le post-it associé.

Un gueulage n'a **pas de titre** : au tri, on en fabrique un avec ses premiers mots, et c'est écrit
comme tel dans le post-it (jamais un titre inventé qui trahirait le propos).

### 4.4 Si l'envoi de fichier devient nécessaire

La question a été posée le 22/10/2026, et la réponse est courte : **Tally**. Sa propre
documentation annonce « file uploads are free for all Tally users » (10 Mo par fichier sur l'offre
gratuite) et sa procédure se lit « build a file upload form (**without login**) » — soit exactement
ce que Google refuse. À noter : plusieurs comparateurs tiers disent l'inverse (upload réservé à
l'offre Pro) ; **deux minutes de test tranchent**, un formulaire vide et une fenêtre privée.

Microsoft Forms exige la connexion ; Framaforms n'a pas de champ fichier ; Airtable sait le faire
mais ajoute un compte et des limites.

**Mais le formulaire est un palliatif d'alpha.** La version complète du mur (D-058, #136) fait
**poster depuis le jeu**, capture comprise : le tiers disparaît alors, avec ses réglages.

### 4.3 Une fois le formulaire modifié

L'adresse **ne change pas** (seul le contenu change) : `docs/comite.json` n'a rien à recevoir.
Si l'adresse venait à changer, c'est **ce champ** qu'on met à jour — et rien d'autre, le mur la lit.

## 4.5 L'import des réponses — le palliatif sans backend (#177)

Le formulaire n'écrit pas dans le jeu : ses réponses vivent dans **Google Forms**. Tant que le
mur complet (#136) n'existe pas, un script comble le trou — il lit la feuille de réponses
**publiée en CSV** et ajoute au fichier du mur les post-its **absents**.

**L'adresse** est le champ `reponses` de `docs/comite.json` (mesurée le 23/10/2026) :

```
https://docs.google.com/spreadsheets/d/1WUvB3q0CjEbs7Z-cWXqPUU834Wh1X-nhw1oBWFlhugw/gviz/tq?tqx=out:csv
```

C'est l'endpoint **gviz** de la feuille, pas `pub?output=csv` : la feuille n'est pas « publiée sur
le Web », elle est seulement **partagée en lecture par lien**, ce qui suffit — donc **aucune
marche humaine supplémentaire** aujourd'hui. Il répond `200` et rend le **premier onglet** en CSV ;
un `gid` ne serait nécessaire que pour un autre onglet. La variable d'environnement
`MUR_REPONSES_CSV` surcharge l'adresse (dépannage, ou test d'une autre feuille).

**Si un jour l'adresse casse**, le geste humain est celui de Google : lier le formulaire à une
feuille de réponses (*Réponses → Associer à une feuille de calcul*), garder le partage en lecture
par lien, et recopier l'adresse gviz de la feuille dans `reponses`. Une feuille partagée ainsi
est **publique** : ne rien y mettre de personnel, et ne pas collecter les adresses e-mail (§4.2).

Les **19 colonnes réelles** suivent l'ordre du formulaire (mesuré le 23/10/2026) :
`Horodateur, Pseudo, Quelle Version du Jeux, Tu veux quoi ?, Exprime toi, Envie d'aider ?,
Titre, Ce que tu faisais ?, Ce qui c'est passé ?, Ce que tu attendais ?, Écran, Capture,
Titre, L'idée, À quoi ça servirait ?, Écran, Capture, Ce que tu as aimé ?, Ce que tu n'as pas aimé ?`.
Les colonnes **7 à 12** sont celles du chemin **bug**, **13 à 17** celles du chemin **idée** : les
trois questions en double (`Titre`, `Écran`, `Capture`) se lisent donc **par position**, jamais par
nom — c'est ce que fait le script.

**La commande** : `npm run mur:import` (en lecture seule, `--fichier <csv>` lit un CSV local).

- `--dry-run` affiche ce qui serait ajouté et **n'écrit rien** ;
- l'**idempotence** tient à la clé **horodatage + titre** : deux imports du même CSV ne dupliquent
  ni le gueulage ni le post-it collé dessus ;
- un post-it **existant n'est jamais modifié** : `statut`, `ticket`, `raison` et `position` sont
  le travail humain du tri (§5) ;
- un CSV **vide, illisible ou sans l'en-tête attendu** fait sortir en erreur, **fichier intact**.

Le post-it produit porte les champs de §3. Le **pseudo vide** devient « anonyme », et la
**capture** (un lien, jamais un fichier) rejoint le **texte** : le post-it n'a pas de champ pour
elle, et on n'en invente pas. Un **gueulage** n'a pas de titre : le script en fabrique un avec ses
**premiers mots**, et le **dit** en tête du texte (« Titre fabriqué… ») — jamais un titre inventé
qui trahirait le propos (§4.3 bis). Il est importé **sans famille** (`kind` absent, `gueulage:
true`) ; si la même ligne a rempli une section de bug ou d'idée, le script crée **en plus** l'OUF
ou l'IP correspondant, et met son `id` dans le `lie` du gueulage (D-085). Cet associé porte un id
suffixé par sa famille (`…-ouf`, `…-ip`) : il ne peut pas heurter celui du gueulage, qui partage
l'horodatage. Un **avis** garde sa famille **IP**.

Comme la clé vit dans l'`id`, chaque post-it porte l'horodatage
(`p-23-10-2026-14-05-32-le-bouton-fin-du-tour`) : **ne pas le renommer**, sinon le prochain
import le croira absent — §3 demande déjà un id *stable*.

## 5. Le tri, en fin de journée

1. Lancer `npm run mur:import` (d'abord avec `--dry-run`) : il ajoute au fichier les réponses
   absentes, statut **`en attente`** (§4.5).
2. Lire ce qui est arrivé dans le formulaire, y compris ce que l'import laisse de côté.
3. Pour chacun : **retenu** (et on ouvre un ticket, `ticket` rempli, statut **`en cours`**), ou
   **écarté** avec sa **raison écrite**.
4. Un **bug** qui casse la boucle passe devant tout le reste : c'est le critère (b) de sortie
   d'alpha (D-056).
5. Commiter le fichier — le mur des invités change au déploiement suivant.

Ce tri est un travail **avec l'agent**, pas sur son dos : c'est lui qui tient le fichier et qui
ouvre les tickets (D-059).

### 5.1 Déplacer un statut — l'écran d'administration, ou `npm run statut`

**Quand la base est configurée, le tri se fait dans l'écran d'administration** (`/administration`,
réservé aux comptes marqués administrateurs) : chaque post-it y a son **statut**, la **raison** d'un
écarté et son **ticket**. La migration `0006_tri_et_corrections.sql` donne à un administrateur le
droit d'écrire ces **trois colonnes** sur **n'importe quel** post-it — et **celles-là seulement** :
le titre et le texte restent à leur auteur, et la base refuse un administrateur qui les viserait
(`permission denied`, parce que ces colonnes ne sont pas dans le grant). Un **non-administrateur**
est refusé par la base : sa modification porte sur **0 ligne**, sans erreur.

**Sans base configurée, le fichier se déplace par le script** — c'est le tri de l'alpha sans
backend (#140) : quand la base n'est pas configurée, c'est ce fichier que le mur lit, et le script
**le dit**. Quand elle l'est, le script continue de fonctionner sur le fichier (la **source de
secours**) mais rappelle que le tri des post-its de la base se fait dans l'écran.

```bash
npm run statut <post-it> <statut>            # en attente | retenu | en cours | fait | écarté
npm run statut <post-it> --ticket <numéro>   # lie l'issue GitHub ; l'écran affiche le lien
npm run statut <post-it> écarté --raison "…" # écarter exige la raison (D-059)
```

Le script refuse, **sans rien écrire** : un statut hors des cinq, un ticket qui n'est pas un
entier strictement positif, un `id` inconnu, une raison vide, et un fichier déjà invalide. Il
**relit** ce qu'il a écrit avec `lireMur` (`src/store/mur.ts`) et, si le fichier relu ne passe
plus, **remet l'original** : il n'écrit rien d'illisible. L'écriture est **atomique** (fichier
temporaire puis renommage), au format du dépôt (`JSON.stringify(…, null, 2)` et saut de ligne
final), et les champs qu'il ne connaît pas traversent intacts.

`--fichier <json>` n'existe que pour les tests : il évite d'écrire dans le vrai fichier du mur
(`scripts/statut-mur.test.ts`).
