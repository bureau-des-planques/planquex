# La Boîte à idées — ce que les invités remontent, et ce qu'on en fait

> Référence d'exploitation du mur de post-its. Les **décisions** qui l'ont écrit : **D-058** (le
> mur et ses deux familles), **D-059** (le tri, les statuts, l'identité), **D-060** (l'UI).
> Le vocabulaire est dans `AGENTS.md` §3 : **la Boîte à idées** (l'entrée, la bulle), **le mur**
> (l'écran), **post-it IP** (une idée), **post-it OUF** (un signalement), **un invité**.

## 1. Les deux familles, et rien d'autre

| Famille | Ce qu'on y met | Comment on le reconnaît |
|---|---|---|
| **post-it IP** | une idée, une fonctionnalité, un avis (« j'aurais aimé », « c'est bizarre ») | ça propose quelque chose |
| **post-it OUF** | un signalement : ça casse, ça ment, ça bloque | ça décrit un défaut |

Trois familles, c'est déjà trop pour un mur qu'on lit en trente secondes : un avis neutre se range
dans les **IP**.

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

## 3. Le fichier du mur

`design/…` non : le mur vit dans **`docs/boite-a-idees.json`**, versionné avec le dépôt, parce que
c'est la seule source partagée que le jeu peut lire sans backend (D-058).

```jsonc
{
  "postits": [
    {
      "id": "p-001",              // court, stable, jamais réutilisé
      "kind": "IP",               // « IP » ou « OUF », et rien d'autre
      "titre": "Une ligne, à l'impératif ou nominative",
      "texte": "Le retour tel qu'il a été écrit, à peine nettoyé",
      "ecran": "Combat",          // Accueil | Parc | Chariot | Combat | Réglages | Autre
      "pseudo": "Employé 404",    // le nom local du posteur
      "version": "Alpha · 0.1.2", // ce que Réglages affichait chez lui
      "statut": "en attente",     // en attente | retenu | en cours | fait | écarté
      "raison": "",               // obligatoire dès que le statut vaut « ecarte »
      "ticket": null              // le numéro d'issue GitHub dès qu'il y en a un
    }
  ]
}
```

Le jeu **lit** ce fichier et n'écrit jamais dedans. Il est mis à jour **à la main** au fil du tri
— c'est le prix de l'absence de backend, et il est assumé (D-058).

## 4. Le formulaire

La seule porte d'écriture de l'alpha. C'est lui qui décide de la **qualité** des retours : un
formulaire qui demande « décris ton bug » reçoit « ça bug » ; un formulaire qui demande *ce que tu
faisais* et *ce que tu attendais* reçoit de quoi corriger.

**Adresse** : dans `docs/boite-a-idees.json` (`formulaire`). Le jeu la lit et l'ouvre depuis la bulle.

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
| 7 | **Écran** | Choix multiples (une seule) | non | « Accueil, Parc, Chariot, Combat, Réglages, autre. » |
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
   e-mail* : désactivé). L'invité n'a pas de compte, et on lui a promis qu'on n'en demanderait pas.
2. **Ne pas limiter à une réponse** (le même invité doit pouvoir signaler trois choses en trois fois).
3. **Ne pas utiliser le champ « Importer un fichier »** : il **oblige** à se connecter à un compte
   Google. D'où le champ 8, qui demande un **lien**.
4. **Aiguillage** : sur la question 2, *Aller à la section en fonction de la réponse* — « Remonter un
   bug » et « Gueuler » vers **Post-it OUF**, « Proposer une feature » vers **Post-it IP**.
5. **La version est le premier champ, et obligatoire** : un retour sans version ne dit pas s'il
   concerne encore la build courante.

### 4.3 L'état du formulaire au 22/10/2026

Relevé sur le formulaire public (`viewform`, **HTTP 200** — il est bien ouvert aux visiteurs).

**En place :** version ; type (Remonter un bug / Proposer une feature / Gueuler) ; une section
**Post-it OUF** complète (titre, ce que tu faisais, ce qui s'est passé, ce que tu attendais, écran,
lien vers une image) ; une section **Post-it IP** complète (titre, l'idée, à quoi ça servirait, écran,
lien vers une image). L'envoi de fichier a disparu : la capture se demande en **lien**.

**Deux écarts avec la cible, assumés ou à trancher :**

1. **« Gueuler » a sa propre section**, « Pourquoi qu'on Gueule », avec un seul champ libre
   (« Exprime toi ») : ni titre, ni écran. Un post-it de ce type arrive donc **sans structure**, et
   il faudra deviner de quoi il parle. Deux issues : l'**aiguiller vers la section IP** (la réponse
   « Gueuler » reste enregistrée, donc le tri saura que c'était un coup de gueule), ou lui **ajouter
   le titre et l'écran**. Sur le mur, « Gueuler » se range de toute façon dans les **IP** (D-058).
2. **Le titre de la question « Capture » porte tout le texte d'aide** (« Colle un lien vers une
   image… »). C'est le libellé qui se retrouve en en-tête de colonne dans les réponses : mieux vaut
   le raccourcir à « Capture », et laisser la phrase dans l'**aide**.

**Le ton est celui du projet** — « Recueille avis Alpha », « Tu veux quoi ? », « Exprime toi », et
les coquilles qui vont avec : on n'y touche pas, c'est la satire.

**Non vérifiable depuis l'extérieur :** les cases **« Obligatoire »**. Les deux qui comptent —
**la version** et **le type** — doivent l'être, sinon un retour sans version ne dit pas s'il concerne
encore la build courante.

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

L'adresse **ne change pas** (seul le contenu change) : `docs/boite-a-idees.json` n'a rien à recevoir.
Si l'adresse venait à changer, c'est **ce champ** qu'on met à jour — et rien d'autre, le mur la lit.

## 5. Le tri, en fin de journée

1. Lire ce qui est arrivé dans le formulaire.
2. Créer les post-its correspondants dans le fichier, statut **`en attente`**, `id` neuf.
3. Pour chacun : **retenu** (et on ouvre un ticket, `ticket` rempli, statut **`en cours`**), ou
   **écarté** avec sa **raison écrite**.
4. Un **bug** qui casse la boucle passe devant tout le reste : c'est le critère (b) de sortie
   d'alpha (D-056).
5. Commiter le fichier — le mur des invités change au déploiement suivant.

Ce tri est un travail **avec l'agent**, pas sur son dos : c'est lui qui tient le fichier et qui
ouvre les tickets (D-059).
