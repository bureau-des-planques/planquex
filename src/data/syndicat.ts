import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/**
 * Faction **Syndicat** (`SYN`) — Métal, vivier **Atelier** (D-024, D-026).
 * Archétype tank / contrôle : gros Seuil, soin, protection, anti-statut (CARD-SPEC.md §3).
 * Les intitulés sont des postes réels, les Pressions des tâches ou documents,
 * les Talents des compétences de métier (D-027).
 */

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('SYNDICAT');

export const SYNDICAT_CARDS: PlanqueCard[] = [
  // Ligne principale (échantillon CARD-SPEC.md §4, FACTIONS.md §9) :
  // Délégué du personnel → Représentant CSE → Secrétaire général.
  base({
    id: 'syndicat-delegue-personnel',
    name: 'Délégué du personnel',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [
      {
        name: 'Tract',
        cost: ['SYNDICAT'],
        damage: 10,
        text: 'Soigne 10 de ce Planqué.',
        effects: [{ kind: 'healSelf', amount: 10 }]
      }
    ],
    flavor: 'Il a imprimé 400 tracts. En noir et blanc.'
  }),
  base({
    id: 'syndicat-representant-cse',
    evolvesFrom: 'syndicat-delegue-personnel',
    name: 'Représentant CSE',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    ability: { name: 'Heure de délégation', text: 'Une fois par tour : pioche 1 carte.', kind: 'draw', amount: 1, oncePerTurn: true },
    attacks: [{ name: 'Motion', cost: ['SYNDICAT', 'INCOLORE'], damage: 40 }],
    flavor: 'La réunion a duré 4 heures. Elle a été reportée.'
  }),
  base({
    id: 'syndicat-secretaire-general',
    evolvesFrom: 'syndicat-representant-cse',
    name: 'Secrétaire général',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 3,
    attacks: [
      {
        name: 'Convention collective',
        cost: ['SYNDICAT', 'INCOLORE'],
        damage: 50,
        text: 'Ce Planqué subit 10 de moins au prochain tour.',
        effects: [{ kind: 'reduceDamage', amount: 10 }]
      },
      {
        name: 'Grève',
        cost: ['SYNDICAT', 'INCOLORE', 'INCOLORE'],
        damage: 80,
        text: 'Le Planqué adverse est Immobilisé.',
        effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }]
      }
    ],
    flavor: 'Il a obtenu une réunion. Elle a duré 4 heures.',
    art: 'syndicat-secretaire-general.webp'
  }),
  // COMEX : Secrétaire général ex — 4D, 2 Interventions (D-020, D-026).
  base({
    id: 'syndicat-secretaire-general-ex',
    evolvesFrom: 'syndicat-representant-cse',
    name: 'Secrétaire général COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      {
        name: 'Convention collective',
        cost: ['SYNDICAT', 'INCOLORE'],
        damage: 60,
        text: 'Ce Planqué subit 20 de moins au prochain tour.',
        effects: [{ kind: 'reduceDamage', amount: 20 }]
      },
      {
        name: 'Grève',
        cost: ['SYNDICAT', 'INCOLORE', 'INCOLORE'],
        damage: 110,
        text: 'Le Planqué adverse est Immobilisé.',
        effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }]
      }
    ],
    flavor: 'Deux Interventions. Le compte rendu fait 40 pages.'
  }),

  // Ligne 2 (vague 2, #86) : Délégué du personnel → Trésorier CSE → Président CSE.
  base({
    id: 'syndicat-tresorier-cse',
    evolvesFrom: 'syndicat-delegue-personnel',
    name: 'Trésorier CSE',
    stage: 'N+1',
    rarity: '3D',
    hp: 100,
    retreat: 1,
    attacks: [
      {
        name: 'Relevé de trésorerie',
        cost: ['SYNDICAT', 'INCOLORE'],
        damage: 40,
        text: 'Soigne 10 de ce Planqué.',
        effects: [{ kind: 'healSelf', amount: 10 }]
      },
      {
        name: 'Note de frais',
        cost: ['SYNDICAT', 'INCOLORE', 'INCOLORE'],
        damage: 70,
        text: 'Pioche 1 carte.',
        effects: [{ kind: 'draw', amount: 1 }]
      }
    ],
    flavor: 'Il tient la caisse du café. Le reste n’est pas budgété.'
  }),
  base({
    id: 'syndicat-president-cse',
    evolvesFrom: 'syndicat-tresorier-cse',
    name: 'Président CSE',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      {
        name: 'Résolution',
        cost: ['SYNDICAT', 'INCOLORE'],
        damage: 60,
        text: 'Le Planqué adverse est en Sieste.',
        effects: [{ kind: 'status', status: 'SIESTE', target: 'opponent' }]
      },
      {
        name: 'Réquisition générale',
        cost: ['SYNDICAT', 'INCOLORE', 'INCOLORE'],
        damage: 90,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      }
    ],
    flavor: 'Il préside une réunion de deux personnes. Le procès-verbal fait douze pages.'
  })
];

export const SYNDICAT_VARIANTS: Card[] = [
  secretVariant(SYNDICAT_CARDS, 'syndicat-secretaire-general', 'star2', '✦')
];

export const ALL_SYNDICAT_CARDS: Card[] = [...SYNDICAT_CARDS, ...SYNDICAT_VARIANTS];
