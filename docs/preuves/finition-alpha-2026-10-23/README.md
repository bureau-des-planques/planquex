# Passe de finition de l'alpha — captures datées (#131, D-060)

Lot du **23/10/2026**. Un lot **ne se remplace pas** : une nouvelle passe ouvre un nouveau dossier.
La version de l'application n'est pas recopiée ici : elle se lit dans `package.json` (`version`,
`stage`) et s'affiche par `APP_LABEL` dans Réglages (`docs/VERSIONS.md`).

## Comment elles ont été prises

| Dossier | Commande | Taille |
|---|---|---|
| `avant/` | `npm run build` puis `npm run capturer` sur `dev` **avant** la passe (420 × 900) ; un script ponctuel Playwright pour 360 × 800 et 1280 × 800 | 420 × 900 · 360 × 800 · 1280 × 800 |
| `apres/420-<écran>.png` | `npm run build` puis `npm run capturer` sur la branche `131-finition-alpha` | **420 × 900**, fenêtre seule (D-060) |
| `apres/420-etat-*.png` | même build, script ponctuel Playwright : l'état est provoqué (hors ligne, adresse inconnue, confirmation, recherche sans résultat, tour de la Direction…) | 420 × 900 |
| `apres/360-*`, `apres/1280-*` | même build, script ponctuel | 360 × 800 · 1280 × 800 |

`captures/` n'est pas versionné : ces images sont la copie de la preuve, choisie ici.

## Ce que les captures montrent (lu à la main, à 420 × 900)

- `360-collection` : **avant**, une colonne (`getComputedStyle(.card-grid)` → 1 colonne) ; **après**, deux.
- `420-etat-introuvable` : une adresse inconnue ne se fait plus passer pour l'Accueil.
- `420-etat-hors-ligne` : le bandeau dit ce qui continue et ce qui attend.
- `420-etat-reset-confirmation`, `420-etat-forfait-confirmation` : un seul composant de confirmation.
- `420-etat-fiche-carte`, `420-etat-arrivage` : les deux dialogues passent par le composant de dialogue ;
  l'Arrivage marque les cartes « Nouvelle ».
- `420-etat-collection-vide` : le vide nomme sa cause et offre « Tout effacer ».
- `420-etat-attente-direction` : « La Direction réfléchit… » pendant son tour.
- `420-combat` : le paragraphe qui parlait du moteur au joueur n'y est plus.
- `420-premiere-visite` : la Journée d'intégration, seule capture **non amorcée**.

## Ce que les captures ne prouvent pas

Le **ressenti** : la fluidité, le rythme de l'attente de la Direction (600 ms par coup), la lisibilité
au pouce sur un vrai téléphone. Une capture est un instant ; la passe n'a pas été jouée sur un appareil.
