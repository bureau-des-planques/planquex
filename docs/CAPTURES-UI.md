# Protocole — capturer l'interface (référence de conception)

> **À qui** : à toi, sur ton téléphone.
> **Pourquoi** : nos cinq écrans (Accueil, Parc, Chariot, Combat, Réglages) ont été
> dessinés sans référence visuelle. L'application d'origine en a une vingtaine, et
> `../../grevomon-pocket/docs/INVENTAIRE-PTCGP.md` §5 en donne la **liste des modules** —
> mais un nom de module ne dit pas comment l'écran est **composé**.
> Créé le 19/10/2026.

## La règle qui gouverne tout ce document

**On capture la structure, jamais le contenu.** Ce qu'on cherche, c'est :

- **la hiérarchie de l'information** : qu'est-ce qui est gros, qu'est-ce qui est
  petit, qu'est-ce qui est en haut à droite ;
- **ce qui est atteignable en un geste** depuis l'écran (les raccourcis) ;
- **les états** : écran vide, écran plein, sélection en cours, confirmation ;
- **où l'argent et les minuteurs apparaissent** — leur place, pas leur montant.

On **ne copie pas** : ni l'art, ni les textes, ni les icônes, ni les couleurs.
L'univers est le nôtre (atelier MRO, D-025). Cette référence est **structurelle**.

Aucune image de ce lot n'entre dans `src/` ni dans `public/`. Elles vivent dans
`docs/preuves/` et servent à **relire un écran**, pas à le produire.

---

## 1. Comment capturer un écran

- **En portrait**, plein écran, sans notification à l'écran.
- **Un fichier par état**, pas un fichier par écran : un écran vide et un écran plein
  sont deux informations différentes. Nomme l'état : `-vide`, `-plein`.
- Si un écran a plusieurs **onglets** internes, une capture par onglet.
- Ne te force pas à tout faire en une séance. Un écran bien capturé vaut mieux que
  vingt écrans flous.

Dossier : `docs/preuves/ui-<AAAA-MM-JJ>/`, avec le même `README.md` de lot que pour
les règles (voir `docs/preuves/README.md`), mais la colonne de droite devient
« **ce que ça nous apprend pour notre écran** ».

---

## 2. Lot B — les écrans que nous avons déjà

Ils servent à **affiner** l'existant. **Aucun n'est déjà capturé** : les images du
legacy (`../../grevomon-pocket/design/qa/`) sont des captures de **notre ancienne
application**, pas de l'application de référence — voir `docs/preuves/README.md`,
section « les captures du legacy ne sont PAS des preuves ».

| # | Fichier | Écran | Ce que tu cherches |
|---|---|---|---|
| B01 | `B01-accueil.png` | Accueil / hub | La place des raccourcis, la devise en haut, ce qui est mis en avant |
| B02 | `B02-arrivage.png` | Ouverture d'un Arrivage | Le rythme de révélation, le récapitulatif final, le bouton « encore » |
| B03 | `B03-parc.png` | Parc / collection | La grille (colonnes, densité), les filtres, le tri, la barre de progression |
| B04 | `B04-fiche-carte.png` | Fiche carte (zoom) | Le gabarit lu en grand : ce qui est lisible, ce qui est relégué |
| B05 | `B05-chariot.png` | Chariot / éditeur | Comment la validité est montrée, le compteur, les filtres |
| B06 | `B06-combat-plateau.png` | Combat — le plateau | La disposition exacte : le Poste au centre, le Rack dessous, la main en bas, la jauge, les états |
| B07 | `B07-combat-choix.png` | Combat — choisir une action | Comment les Pression sont présentées, ce qui est grisé quand c'est impossible |
| B08 | `B08-combat-resultat.png` | Combat — résultat | Ce qui est récapitulé : qui a gagné, comment, ce qu'on gagne |
| B09 | `B09-boutique.png` | Boutique / Économat | La grille, les devises, la place des minuteurs |
| B10 | `B10-missions.png` | Missions / Note de service | La liste, la progression, la récompense, l'état « réclamé » |
| B11 | `B11-profil.png` | Profil | Avatar, niveau, statistiques visibles |

---

## 3. Lot C — les écrans que nous n'avons pas

Ils servent à **concevoir**. `INVENTAIRE-PTCGP.md` §6 les classe par priorité : les
trois premiers sont les manques les plus coûteux (reprise de combat, tutoriel,
séries de missions). Comme on ne les a pas encore, une capture vaut ici beaucoup :
elle remplace une réunion de conception.

| # | Fichier | Écran | Pourquoi il compte chez nous |
|---|---|---|---|
| C01 | `C01-titre.png` | Écran titre / connexion | Première impression ; nous n'avons pas d'écran de démarrage |
| C02 | `C02-onboarding-1.png` → `C04` | Onboarding du premier lancement | « Journée d'intégration » : rien ne présente le jeu aujourd'hui |
| C05 | `C05-tutoriel-combat.png` | Tutoriel de combat guidé | Priorité haute de l'inventaire : les règles ne sont pas découvrables |
| C06 | `C06-reprise-combat.png` | Reprise d'un combat interrompu | Priorité haute : un combat interrompu est perdu aujourd'hui |
| C07 | `C07-missions-theme.png` | Séries thématiques de missions | Priorité haute : la collection n'a aucun objectif long terme |
| C08 | `C08-present-box.png` | Boîte de récompenses différées | Notre futur « Casier » |
| C09 | `C09-inventaire.png` | Inventaire d'objets | Nous n'avons pas d'écran d'inventaire |

> **`C09` — hors périmètre** (22/10/2026). Chez nous, les **Objets** sont des **cartes Action jouables**
> (NEUF ou MRO) : elles se jouent depuis la main et partent au Rebut. Il n'y a **rien à inventorier**,
> donc pas d'écran à construire — le jeu de référence en a un parce que sa structure d'objets est
> différente. Décision et raison : `.out-of-scope/inventaire-objets.md`.
| C10 | `C10-skins.png` | Variantes cosmétiques de cartes | Nos futurs « Autocollants » : monétisation sans toucher à l'équilibrage |
| C11 | `C11-echange.png` | Échange de cartes | Nos futurs « Échanges de postes » |
| C12 | `C12-amis.png` | Amis / fil social | Nos futurs « Camarades » |
| C13 | `C13-arene.png` | Classement / Échelon | Notre futur mode classé |
| C14 | `C14-aide.png` | Aide contextuelle / guide | Nous n'avons aucune aide en jeu |

Certains écrans de ce lot sont **hors périmètre de lancement** (`AGENTS.md` §4) —
PvP, échanges, amis, abonnement. Les capturer maintenant n'est pas les construire :
c'est éviter d'avoir à les réinventer dans six mois. **Fais-les en dernier.**

---

## 4. Ce que ce lot ne fera pas

Il ne produira **aucune** image d'illustration, aucun asset, aucun `public/`.
La direction artistique se décide dans `docs/CARD-SPEC.md` §5 et se produit à part —
des captures d'un jeu dont l'art ne nous appartient pas n'y changeraient rien.
