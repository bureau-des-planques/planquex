import type { Card, PlanqueCard } from './types';
import { planqueBase } from './planque';

/**
 * Faction **Intérim** (`INT`) — Dragon, vivier **Bureaux** (D-024, D-026).
 * Archétype combo / aggro : multi-énergie, chaos, **aucune vulnérabilité**
 * (`CARD-SPEC.md` §3). Les intitulés sont des postes réels, les Pressions des
 * tâches ou documents de mission, les Talents des compétences de métier (D-027).
 *
 * 10 entrées, toutes des bases : la ligne à 3 stades, la carte signature COMEX, la
 * ligne à 3 stades de la vague 2 (#86, les 9 cartes `3D` manquantes), et la vague #352
 * (un Entrant seul, deux Entrants, une ligne à 2 stades) qui porte la faction à **10
 * noms de base** — le minimum pour un Deck mono-faction de 20 cartes. Le quota
 * de `PROPOSITION.md` §4.3 (4 entrées) est dépassé : la cible de rareté
 * `CARD-SPEC.md` §1 (42 cartes en 3◆) prime, l'écart est signalé au ticket #63.
 * Seuil par stade/rareté et dégâts par café conformes à `CARD-SPEC.md` §2 (D-021,
 * D-023) ; COMEX `ex: true` en 4D, valant 2 Interventions (D-020).
 *
 * **Types de café (#116, #412)** : `INTERIM` n'est pas un type produit, donc chaque Pression
 * à **2 cafés et plus** mêle **deux types produits distincts** (D-037 (3)) ; une Pression
 * à **1 café** n'en porte qu'un, et le Deck doit le produire. Une **ligne d'évolution** doit
 * rester payable avec le plafond de **3 types** d'un Deck (D-034, D-037 (4)) : chaque
 * ligne garde donc **une paire stable**, et l'Entrant (`SSE`) est le troisième type.
 * `interim.test.ts` le contrôle **par ligne**, pas carte par carte.
 *
 * **La faction entière tient dans ces trois types (#412, D-134 (2))** : jusqu'à #412, la
 * ligne 1 coûtait `MANAGEMENT` + `QVT` et la ligne 2 `RH` + `ATELIER`, soit **cinq** types
 * pour la faction — et **aucun** Deck de trois types ne pouvait payer l'ensemble. Mesuré par
 * `npm run mesure:archetypes`, le Deck d'archétype (qui prend toutes les cartes de la
 * faction) ne pouvait pas lancer **57 % de ses Pressions** : le COMEX et le N+2 de la ligne 1,
 * entre autres, ne pouvaient pas attaquer. Toutes les Pressions de la faction demandent
 * désormais `SSE` (Entrant) ou la paire **`RH` + `ATELIER`**, qui est celle de la ligne 2 :
 * trois types, un Deck jouable, le plafond de D-034 respecté.
 */

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('INTERIM');

export const INTERIM_CARDS: PlanqueCard[] = [
  base({
    id: 'interim-interimaire',
    name: 'Intérimaire',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Mission courte', cost: ['SSE'], damage: 20, text: 'Le Planqué adverse subit une mission courte et intense. L’intérimaire part vendredi, la consigne reste.' }],
    flavor: 'Il connaît le site mieux que le directeur. Il part vendredi.',
    art: 'interim-interimaire.webp'
  }),
  base({
    id: 'interim-interimaire-confirme',
    evolvesFrom: 'interim-interimaire',
    name: 'Intérimaire confirmé',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: {
      name: 'Polyvalence',
      text: 'Une fois par tour : attache 1 café à ce Planqué.',
      kind: 'attachEnergy',
      oncePerTurn: true
    },
    attacks: [{ name: 'Démerde', cost: ['RH', 'ATELIER'], damage: 50, text: 'Le Planqué adverse se fait déborder par un débrouillard. Il fait le travail de trois personnes, payé pour une.' }],
    flavor: 'Il a fait le boulot de trois personnes. Il est payé pour une.',
    art: 'interim-interimaire-confirme.webp'
  }),
  base({
    id: 'interim-chef-equipe-interimaire',
    evolvesFrom: 'interim-interimaire-confirme',
    name: "Chef d'équipe intérimaire",
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      {
        name: 'Site différent',
        cost: ['RH', 'ATELIER'],
        damage: 60,
        text: 'Échange ce Planqué avec un Planqué du Banc.',
        effects: [{ kind: 'switchSelf' }]
      },
      {
        name: 'Prime de précarité',
        cost: ['RH', 'ATELIER', 'RH'],
        damage: 100,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: "Il gère l'équipe. Il n'a pas de badge.",
    art: 'interim-chef-equipe-interimaire.webp'
  }),
  // COMEX : carte signature de la faction, 2 Interventions (D-020, D-026).
  base({
    id: 'interim-interimaire-legendaire-ex',
    evolvesFrom: 'interim-interimaire-confirme',
    name: 'Intérimaire légendaire',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      {
        name: 'Renfort express',
        cost: ['RH', 'ATELIER'],
        damage: 70,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      },
      {
        name: 'Prime de précarité',
        cost: ['RH', 'ATELIER', 'RH'],
        damage: 120,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'Il a sauvé la production. Le badge a expiré avant les remerciements.',
    art: 'interim-interimaire-legendaire-ex.webp'
  }),

  // Ligne 2 (vague 2, #86) : Intérimaire → Consultant intérimaire → Responsable
  // d’intérim. Le coût d'une Pression de l'Intérim mêle deux types produits
  // distincts (D-037 (3)) ; cette ligne garde la paire `RH` + `ATELIER`, la ligne 1
  // `MANAGEMENT` + `QVT` (#116 : trois types par ligne au plus, Entrant compris).
  base({
    id: 'interim-consultant-interimaire',
    evolvesFrom: 'interim-interimaire',
    name: 'Consultant intérimaire',
    stage: 'N+1',
    rarity: '3D',
    hp: 110,
    retreat: 1,
    ability: {
      name: 'Mise à disposition',
      text: 'Une fois par tour : attache 1 café à ce Planqué.',
      kind: 'attachEnergy',
      oncePerTurn: true
    },
    attacks: [
      { name: 'Mission d’appui', cost: ['RH', 'ATELIER'], damage: 50, text: 'Le Planqué adverse reçoit un appui qu’il n’a pas demandé. Le consultant remplace trois personnes sans en avoir croisé une.' },
      {
        name: 'Renvoi express',
        cost: ['RH', 'ATELIER', 'RH'],
        damage: 80,
        text: 'Échange ce Planqué avec un Planqué du Banc.',
        effects: [{ kind: 'switchSelf' }]
      }
    ],
    flavor: 'Il remplace trois personnes. Il n’en a rencontré aucune.',
    art: 'interim-consultant-interimaire.webp'
  }),
  base({
    id: 'interim-responsable-interim',
    evolvesFrom: 'interim-consultant-interimaire',
    name: 'Responsable d’intérim',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      {
        name: 'Contrat-cadre',
        cost: ['RH', 'ATELIER'],
        damage: 60,
        text: 'Pioche 1 carte.',
        effects: [{ kind: 'draw', amount: 1 }]
      },
      {
        name: 'Affectation d’urgence',
        cost: ['RH', 'ATELIER', 'RH'],
        damage: 100,
        text: 'Envoie 1 café du Planqué adverse au rebut. Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }, { kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'Il fournit du personnel. Le personnel ne sait pas où il va.',
    art: 'interim-responsable-interim.webp'
  }),

  // Vague #352 : la faction atteint **10 noms de base**, le minimum pour un Deck
  // mono-faction de 20 cartes (2 exemplaires par nom). Même contrainte de café que les
  // lignes existantes (#116) : les Pressions à 2 cafés gardent la paire de la ligne 1
  // (`MANAGEMENT` + `QVT`), les Entrants seuls n'emploient qu'un type **déjà** dans le
  // budget de trois de la ligne qu'ils rejoignent.
  // Pas de champ `art` : l'illustration n'est pas produite (spec #95, D-045) ; son
  // **sujet** est écrit dans `design/illustrations/SUJETS-flow.md`.
  base({
    id: 'interim-vacataire',
    name: 'Vacataire',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [
      {
        name: 'Renfort d’un jour',
        cost: ['ATELIER'],
        damage: 20,
        text: 'Ce Planqué prend 10 de stress.',
        effects: [{ kind: 'selfDamage', amount: 10 }]
      }
    ],
    flavor: 'Il a signé pour une journée. Il en est à sa troisième semaine.'
  }),
  base({
    id: 'interim-charge-mission',
    name: 'Chargé de mission',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [
      {
        name: 'Livrable',
        cost: ['SSE'],
        damage: 10,
        text: 'Pioche 1 carte.',
        effects: [{ kind: 'draw', amount: 1 }]
      }
    ],
    flavor: 'Il rend un livrable. Personne ne sait ce qu’il contient, tout le monde le valide.'
  }),
  base({
    id: 'interim-coordinateur-interimaire',
    evolvesFrom: 'interim-charge-mission',
    name: 'Coordinateur intérimaire',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [
      {
        name: 'Reporting express',
        cost: ['RH', 'ATELIER'],
        damage: 50,
        text: 'Échange ce Planqué avec un Planqué du Banc.',
        effects: [{ kind: 'switchSelf' }]
      }
    ],
    flavor: 'Il coordonne trois missions qu’il n’a pas le droit de nommer.'
  }),
  base({
    id: 'interim-suppleant',
    name: 'Suppléant',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [
      {
        name: 'Remplacement minute',
        cost: ['ATELIER'],
        damage: 20,
        text: 'Soigne 10 de ce Planqué.',
        effects: [{ kind: 'healSelf', amount: 10 }]
      }
    ],
    flavor: 'On lui a dit de faire comme son prédécesseur. Il ne l’a jamais croisé.'
  })
];

/**
 * Les 4 entrées de `PROPOSITION.md` §4.3 sont épuisées par les bases : pas de
 * variante secrète pour l'Intérim. Le tableau reste déclaré pour que l'enregistrement
 * et les tests suivent la même forme que les autres factions.
 */
export const INTERIM_VARIANTS: Card[] = [];

export const ALL_INTERIM_CARDS: Card[] = [...INTERIM_CARDS, ...INTERIM_VARIANTS];
