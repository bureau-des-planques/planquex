# Product

<!-- impeccable:product-schema 1 -->

> **Bureau des Planqués** — jeu de cartes à collectionner, satire du monde de l'entreprise, qui suit
> les règles de TCG Pocket en n'en changeant que les noms.
>
> Ce fichier rassemble le **contexte produit dérivé** destiné à la compétence `impeccable` : usagers,
> but, périmètre, contraintes et éléments de preuve. Il ne porte **aucune** décision visuelle —
> l'apparence vit dans `DESIGN.md`, les règles de jeu dans `docs/JEU.md` §4 et `docs/DECISIONS.md`.
> En cas de conflit, l'ordre d'autorité d'`AGENTS.md` §2 tranche : ce document dérivé n'est pas une
> nouvelle source de règle (D-176).

## Platform

web

Application web installable (PWA), servie en production sur `planquex.4k7.org`. Aucune application
native : le « paquet » est le service worker et le manifeste.

## Users

**Pendant l'alpha : les testeurs.** Des collègues de l'atelier, qui connaissent le vocabulaire maison
et jouent surtout **sur le téléphone, en main, pendant une pause au travail**. Leur travail n'est pas
de « valider une feature » : ils jouent une partie de bout en bout et disent ce qui accroche. Le mot
du projet est **testeur**, jamais « joueur » tout court (D-117) — le public, c'est le lancement.

**Cible durable : le public francophone des TCG.** Un joueur qui connaît TCG Pocket et ne connaît pas
l'atelier. Il doit comprendre le jeu sans qu'on lui explique le jargon : les références internes
restent, elles ne sont pas traduites (voir _Brand Commitments_).

Le parcours de référence pendant l'alpha : ouvrir un Arrivage, construire un Deck, affronter la
Direction en solo, et — s'il y a quelque chose à dire — coller un **post-it IP** (idée) ou **OUF**
(défaut) sur le mur du comité.

## Product Purpose

Faire un jeu de cartes à collectionner **complet et jouable**, dont la satire du bureau est le sujet
et non un décor : les factions sont des services, la monnaie est le café, les points de victoire sont
des Interventions, et un Planqué craque quand son Stress atteint son Seuil.

Le succès de l'alpha tient en une question, posée telle quelle dans le README : **est-ce que ça donne
envie de refaire une partie ?** Tout le reste — polish, contenu, écrans annexes — s'y subordonne.

## Positioning

**Un miroir, pas une variante.** Les règles sont celles de TCG Pocket dans son état de 2026 : aucune
valeur mathématique ne bouge, seuls les noms et les textes changent (D-018, D-020). Un concurrent ne
peut pas copier honnêtement cette position, parce qu'elle repose sur une contrainte tenue : chaque
ligne de règle est **sourcée** (captures de l'application de référence ou recherche documentée,
D-034), et chaque écart au miroir est une décision datée, pas un ajustement d'équilibrage.

Le second trait non copiable est le **vocabulaire** : dix factions de service, trois viviers (Atelier,
Étage, Bureaux), et un jargon d'entreprise employé sans guillemets ni glossaire — le sens vient du
jeu, pas d'une explication.

## Operating Context

- **Le téléphone est la scène réelle.** Le jeu s'installe comme une application ; les mesures de
  référence se font en **420 × 900**. Le desktop doit fonctionner, il ne dicte pas les choix.
- **La pause au travail** : sessions courtes, une main, un pouce, souvent en réseau moyen — d'où le
  bandeau hors ligne et le service worker.
- **La Journée d'intégration** est un **panneau**, pas un dialogue : une région nommée, non modale,
  sans voile ni piège à focus (D-160 (2), D-162 (1)). Sa voix est le **Chef de cabinet** (D-181) ;
  elle se saute d'un clic et se rejoue depuis Réglages.
- **La Collection et le Deck vivent sur l'appareil** (Zustand persisté). Vider les données du
  navigateur les efface : la sauvegarde est un geste explicite dans Réglages.
- **Le comité** est le seul canal de retour intégré : un mur de post-its qui exige un compte dans
  l'alpha en ligne (D-156), modéré côté serveur. Un serveur Discord **facultatif** double le canal
  (D-120) ; le client n'en porte qu'un lien, jamais un widget.
- **La porte de l'alpha en ligne exige un compte** (D-156) : une session anonyme repart vers
  `/connexion` ; un compte non approuvé (en attente ou `refuse`) ne joue pas et repart vers
  `/attente`, qui ne montre que son état (D-201, qui amende D-199) ; le serveur refuse aussi
  l'Arrivage à un compte non approuvé.
- **Le mode local fonctionne sans configuration.** Sans `.env`, la garde de compte laisse passer et
  le mur lit `docs/comite.json` : un clone frais reste jouable, et rien n'est envoyé nulle part.
  Ce repli local ne décrit pas l'entrée en alpha en ligne, qui exige un compte (D-156).
- **Tout est en français** : interface, cartes, docs. Les identifiants du code restent en anglais.

## Capabilities and Constraints

**Fait et jouable :** le solo contre la Direction (Poste, Banc, Machine à café, Pressions,
Conditions, trois Interventions), les Arrivages (5 cartes), la Collection filtrable, le Deck de
20 cartes avec ses types de café, le comité, le set illustré (chaque carte de base a son image).

**Pas encore, et assumé comme tel :** le classé (Échelon), l'Économat du CSE, les notes de service,
la Cotisation, et **l'argent réel** — aucun paiement, aucune monnaie payante dans l'alpha.

**Contraintes tenues par le dépôt :**

- **Aucune règle de jeu ne se change sans une décision datée** dans `docs/DECISIONS.md` ; le
  périmètre du miroir est borné (Outils, Lieux et ajouts 2025-2026 exclus, D-020).
- **Aucun texte de carte hors de `src/data`** ; le vocabulaire interdit (`Galère`, `Pokémon`, l'ancien
  nom du projet) est gardé par un test exécutable.
- **Aucun traceur, aucune publicité, aucune revente de données** — promesse écrite sur la page
  Confidentialité ; elle interdit de fait les widgets tiers (Discord, analytics).
- **Une seule clé côté client** : la clé publique ; une clé de service est refusée par le module.
- **Un écran ne se déclare rendu que par capture ou inspection du navigateur**, jamais par la lecture
  du JSX.

**Décisions exécutées ou tranchées** : la difficulté et le Deck de la Direction (#251, D-125), les
sons de l'alpha (#378, D-137 et D-166), et la lecture de la courbe du Deck (D-172) ne sont plus des
questions ouvertes.

## Brand Commitments

- **Le nom** : Bureau des Planqués. Le motif est **la tasse de Café** (`design/logo/`), pas un
  personnage.
- **Le registre** : satire du corporate, jamais de la méchanceté envers les personnes — une faction
  désigne un service ou un collectif, **jamais quelqu'un** (D-024).
- **Le jargon maison s'emploie, il ne s'explique pas** : « OUF » reste tel quel (D-058), le café est
  une ressource, les Interventions sont des points. La lisibilité vient du contexte de jeu ; un
  lecteur extérieur doit comprendre la mécanique, pas le folklore.
- **Mots interdits** dans les données, l'UI et les textes : `Galère`, `Pokémon`, l'ancien nom du
  projet — la liste exécutable fait foi.
- **Gratuit et sans argent réel** dans l'alpha ; toute monétisation future passe par une décision.
- La voix éditoriale est **courte, sèche, drôle** ; les libellés d'action disent ce qui va se passer.

## Evidence on Hand

- **Le jeu, en ligne et installable** : `planquex.4k7.org`.
- **Captures réelles** : `design/vitrine/` (accueil, collection, combat) et `docs/preuves/` — dont les
  captures des « Astuces de jeu » du jeu de référence (`docs/preuves/astuces-2026-10-20/`), qui
  sourcent les règles.
- **Le set illustré** : **233 bases illustrées sur 233**, d'après `npm run mesure:illustrations`
  (relevé le 02/11/2026) ; 7 variantes sur 75 ont leur propre planche et les autres retombent sur
  celle de leur base (D-139, gardé par `src/data/art.test.ts`).
- **Le système visuel mesuré** : `DESIGN.md` (jetons, gabarit de carte, ratios WCAG calculés sur les
  jetons réels) et `src/styles.css`.
- **Des testeurs réels** et un mur de retours ; pas de chiffres d'audience, pas de témoignages, pas
  d'études de marché — **ne pas en fabriquer**.

## Product Principles

1. **Le miroir d'abord.** Une idée qui s'écarte des règles de TCG Pocket n'entre pas sans décision
   datée ; l'équilibrage ne se « sent » pas, il se source.
2. **Une partie, puis une autre.** La question qui juge tout : le testeur a-t-il envie de relancer un
   Arrivage ?
3. **Le téléphone en main.** Un choix d'interface qui ne tient pas à 420 × 900, un pouce, en pause au
   travail, n'est pas tenu.
4. **Le jargon sans glossaire.** On n'explique pas le vocabulaire maison : on le fait vivre dans le
   jeu, jusqu'à ce qu'il se comprenne.
5. **La preuve plutôt que l'opinion.** Rien n'est « fait » sans commande, test, capture ou mesure —
   les règles comme l'interface.

## Accessibility & Inclusion

- **WCAG 2.1 AA** est le seuil, et il est **mesuré** sur les jetons réels et sur les écrans servis
  (`DESIGN.md` §1.5 pour les ratios, `npm run detect:ui:page` pour la page). Un texte atténué sur le
  centre éclairé de la table est explicitement interdit plutôt que toléré.
- **Le mouvement se respecte** : `prefers-reduced-motion` coupe les animations et le défilement
  animé du combat ; une animation se prouve par une planche de frames, pas par un style calculé.
- **La couleur ne porte jamais seule une information** (WCAG 1.4.1) : les pastilles de café portent
  un glyphe en combat, les états ont un libellé.
- **Français** partout, y compris les chemins de récupération de compte ; les messages d'erreur
  disent quoi faire.
