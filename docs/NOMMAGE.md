# Inventaire du nommage — points à trancher

> Relevé le 19/10/2026, **avant** l'écriture des 286 cartes : c'est le bon moment, parce
> que les noms des 8 Collègues, des 3 Objets et de 226 Planqués en dépendent.
> Ce document n'acte rien. Il liste ce qui existe, et signale les **incohérences**
> que j'ai trouvées — c'est à toi de dire lesquelles te gênent.
> Autorité : `AGENTS.md` §3 pour le vocabulaire, `docs/DECISIONS.md` pour les choix.

## 1. Les 10 factions — et leurs quatre façons d'être nommées

| Code | Nom affiché (`FACTION_META`) | Abréviation | Nature du nom | Type (mécanique) |
|---|---|---|---|---|
| `SSE` | **SSE** | `SSE` | un service | Plante |
| `MANAGER` | **Manager** | `MGR` | une personne | Feu |
| `HAPPINESS` | **Happiness Manager** | `HAP` | une personne, **en anglais** | Eau |
| `AMELIORATION` | **Amélioration continue** | `AC` | un domaine | Électricité |
| `RH` | **RH** | `RH` | un service | Psy |
| `TECHNICIEN` | **Technicien** | `TEC` | une personne | Combat |
| `DIRECTION` | **Direction** | `DIR` | un collectif | Obscurité |
| `SYNDICAT` | **Syndicat** | `SYN` | un collectif | Métal |
| `INTERIMAIRE` | **Intérimaire** | `INT` | un **statut**, pas une entité | Dragon |
| `SUPPORT` | **Service Support** | `SUP` | un service, **redondant** | Incolore |

Sourcé dans `src/data/index.ts` (`FACTION_META`), les noms dans `docs/FACTIONS.md`.

**Ce que j'y vois, par ordre d'importance :**

1. **Quatre registres mélangés.** « Manager » et « Technicien » sont des *personnes*,
   « SSE » et « RH » des *services*, « Direction » et « Syndicat » des *collectifs*,
   « Amélioration continue » un *domaine*. Rien n'oblige à un registre unique, mais
   ça se voit dans une grille de cartes.
2. **Chevauchement des « chefs » sur trois axes.** La faction `MANAGER` (carte
   signature : *Directeur général*), la faction `DIRECTION` (carte signature : *PDG*)
   **et le stade `COMEX`** désignent tous « la hiérarchie ». C'est le point qui me
   paraît le plus susceptible de te gêner.
3. **Anglais résiduel dans deux noms** : « Happiness Manager » et « Service
   Support » — alors que §3 impose le français à l'interface. Défendable comme
   satire du titre à la mode, mais c'est explicite ou ce n'est pas assumé.
4. **Abréviations hétérogènes** : trois lettres (`MGR`, `HAP`, `TEC`, `DIR`, `SYN`,
   `INT`, `SUP`), **deux** lettres (`AC`), et deux qui sont le nom entier (`SSE`, `RH`).
5. **« Service Support » dit deux fois la même chose**, et son `SUP` se confond avec
   « support » au sens technique.
6. **`INTERIMAIRE` est un statut, pas une faction** — c'est pour ça qu'il est le seul
   sans Vulnérabilité (Dragon, §3.2). Cohérent mécaniquement, bancal nominalement.

Deux observations supplémentaires, vérifiées dans les docs :

- **Une faction porte le nom d'une de ses cartes.** La faction `HAPPINESS` s'appelle
  « Happiness Manager », et la carte `Happiness Manager` est son **N+2**
  (`FACTIONS.md:111` : « Chargé QVT → Happiness Manager → Chief Happiness Officer »).
  Dans le Galérodex, « Happiness Manager » désignera donc à la fois un filtre de
  faction et une carte. Idem, en plus léger, pour `INTERIMAIRE` dont la carte
  signature est « Intérimaire légendaire ».
- **Le français et l'anglais cohabitent dans les entités elles-mêmes** :
  « Happiness Manager » (faction), « Chief Happiness Officer » (sa carte COMEX),
  « Service Support » (faction). Le reste est en français.

## 2. Stades, raretés, statuts

| Famille | Valeurs | Remarque |
|---|---|---|
| Stade (`Stage`) | `N+1`, `N+2`, `COMEX` | mélange une progression chiffrée et un acronyme — mais c'est lisible |
| Raretés **en code** | `1D` `2D` `3D` `4D` `1S` `2S` | |
| Raretés **cibles** (`CARD-SPEC.md` §1) | + **3 étoiles** (4 cartes) et **Couronne** (3 cartes) | **absentes de `types.ts`** : à ajouter aux types et aux métadonnées avant de les utiliser (§3.2 d'AGENTS le rappelle) |
| Statuts | `SURCHARGE`, `BURNOUT`, `BLOQUE`, `GELE`, `DERIVE` | « Burn-out » est le seul nom composé avec trait d'union, et le seul à garder une forme anglaise |
| `Keyword` (maison) | `priorityShift` → **« Changement de priorité »** | seule exception au standard (D-004) |

## 3. Vocabulaire de jeu : deux points de friction

7. **« Reprise de poste » est orphelin.** `AGENTS.md` §3.1 traduit *Mulligan* par
   « Reprise de poste »… mais **D-022 a supprimé la reprise de poste** : Pocket n'en
   a pas. Le terme n'existe plus dans le jeu. À supprimer de la table, ou à
   réaffecter (le choix de la relève après K.-O. ?).
8. **« Courrier » sert à deux choses.** Le **Courrier** est la main, et le **Bac à
   courrier** est le paquet. À l'écran on lit « Courrier 2 » pour la taille de main,
   juste à côté d'un bouton « Ouvrir un bac » : ça se confond.
9. **« Classeur » / « Galérodex » :** `AGENTS.md` §3.1 dit « ne pas dire Classeur
   seul » pour la collection, mais `PROPOSITION.md:194` et `:368` écrivent encore
   « Classeur / Galérodex ». Deux docs, deux règles.

## 4. Nommage des cartes

- **Identifiants** : kebab-case préfixé faction — `sse-medecin-travail`. Les variantes
  portent `-star` / `-star2`.
- **Marque du Cadre** : le **nom** affiché dit « **Cadre** » (`Médecin-chef Cadre`,
  corrigé le 19/10), mais l'**identifiant** garde `-ex` (`sse-medecin-chef-ex`) : c'est
  un identifiant de code **persisté** dans les sauvegardes, donc non renommable sans
  migration. Écart assumé, mais c'est un écart.
- **Noms d'attaques en double** : « Diagnostic » ×3 et « Protocole » ×3. Les trois
  occurrences de chaque viennent de la même ligne (Médecin-chef, Médecin-chef Cadre,
  Psychiatre) : volontaire ou pas ?

## 5. Ce que ce document n'invente pas

Aucun nom ne change sans ta réponse. Les 226 cartes de base se répartissent en
**215 Planqués + 8 Collègues + 3 Objets** (`CARD-SPEC.md` §1) : les 11 noms de
Collègues et d'Objets seront tirés de ce que tu auras tranché ici.
