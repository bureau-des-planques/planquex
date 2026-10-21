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

La seule porte d'écriture de l'alpha. Les champs, dans cet ordre — **c'est ce formulaire qui
décide de la qualité des retours** :

1. **IP ou OUF** (obligatoire) — le choix qui fait tout.
2. **Titre** (obligatoire, une ligne).
3. **Description** (obligatoire).
4. **Écran** (choix : Accueil, Parc, Chariot, Combat, Réglages, Autre).
5. **Ce que tu faisais** (obligatoire, court).
6. **Ce que tu attendais** (obligatoire, court) — les deux champs qui manquent le plus dans un
   retour de bug.
7. **Ton pseudo** (comme dans Réglages).
8. **La version affichée** (obligatoire : `Alpha · 0.1.2`, à recopier en bas de Réglages) — le
   formulaire ne peut pas la lire tout seul, et c'est la seule chose qui dit si un bug d'hier
   existe encore aujourd'hui.
9. **Une capture** (facultatif, pièce jointe).

**Le formulaire est à créer par Bastien** : il vit chez l'hébergeur de son choix (Google Form est
le plus court chemin), et son adresse est posée dans `docs/boite-a-idees.json` (`"formulaire"`),
pour que le mur puisse l'ouvrir depuis le jeu.

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
