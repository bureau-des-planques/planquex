import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/**
 * Faction **Direction** (`DIR`) — Obscurité, vivier **Étage** (D-024, D-026).
 * Archétype contrôle / combo : disruption, défausse (CARD-SPEC.md §3).
 * Les intitulés sont des postes réels, les Pressions des tâches ou documents,
 * les Talents des compétences de métier (D-027).
 */

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('DIRECTION');

export const DIRECTION_CARDS: PlanqueCard[] = [
  // Ligne principale (échantillon CARD-SPEC.md) : Chef de projet fantôme → Directeur adjoint → PDG
  base({
    id: 'direction-chef-projet-fantome',
    name: 'Chef de projet fantôme',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Reporting', cost: ['DIRECTION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il est en réunion. Depuis 2019.',
    art: 'direction-chef-projet-fantome.webp'
  }),
  base({
    id: 'direction-directeur-adjoint',
    evolvesFrom: 'direction-chef-projet-fantome',
    name: 'Directeur adjoint',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    // Talent vendu « en jouant » par `CARD-SPEC.md` §4 (D-074) : les deux camps défaussent
    // une carte de leur main (#159, D-076), le sien par choix, l'autre au hasard (#163, D-081).
    ability: {
      name: 'Cabinet',
      text: 'En jouant : défausse 1 carte, l’adversaire défausse 1 carte.',
      kind: 'effects',
      trigger: 'onPlay',
      effects: [
        { kind: 'discardHand', target: 'self', amount: 1 },
        { kind: 'discardHand', target: 'opponent', amount: 1 }
      ]
    },
    attacks: [{ name: 'Note de service', cost: ['DIRECTION', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse reçoit une note de service. Elle a été signée, puis déléguée à personne.' }],
    flavor: 'Il a délégué. À personne.',
    art: 'direction-directeur-adjoint.webp'
  }),
  base({
    id: 'direction-pdg',
    evolvesFrom: 'direction-directeur-adjoint',
    name: 'PDG',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Plan de départ', cost: ['DIRECTION', 'INCOLORE'], damage: 60, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      // « L’adversaire défausse 1 carte » (CARD-SPEC.md §4) : une carte de la main, au hasard
      // (#159, D-076) — plus un café comme avant.
      { name: 'Fusion-acquisition', cost: ['DIRECTION', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'L’adversaire défausse 1 carte.', effects: [{ kind: 'discardHand', target: 'opponent', amount: 1 }] }
    ],
    flavor: 'Il repart avec la prime. Tu restes avec le plan.',
    art: 'direction-pdg.webp'
  }),
  // COMEX : PDG ex
  base({
    id: 'direction-pdg-ex',
    evolvesFrom: 'direction-directeur-adjoint',
    name: 'PDG COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Plan de départ', cost: ['DIRECTION', 'INCOLORE'], damage: 70, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Fusion-acquisition', cost: ['DIRECTION', 'INCOLORE', 'INCOLORE'], damage: 120, text: 'L’adversaire défausse 1 carte. Ce Planqué prend 20 de stress.', effects: [{ kind: 'discardHand', target: 'opponent', amount: 1 }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Un seul bureau.'
  }),

  // Ligne 2 : Directeur fantôme → Directeur régional → Directeur général
  base({
    id: 'direction-directeur-fantome',
    name: 'Directeur fantôme',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Reporting', cost: ['DIRECTION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Son bureau est vide. Sa signature est partout.',
    art: 'direction-directeur-fantome.webp'
  }),
  base({
    id: 'direction-directeur-regional',
    evolvesFrom: 'direction-directeur-fantome',
    name: 'Directeur régional',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Réorganisation', cost: ['DIRECTION', 'INCOLORE'], damage: 50, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il a fusionné trois sites. Les budgets, non.'
  }),
  base({
    id: 'direction-directeur-general',
    evolvesFrom: 'direction-directeur-regional',
    name: 'Directeur général',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Restructuration', cost: ['DIRECTION', 'INCOLORE'], damage: 60, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Plan social', cost: ['DIRECTION', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a annoncé la fusion. Les organigrammes sont déjà faits.'
  }),

  // Ligne 3 (2 stades) : Assistant direction → Chef de cabinet
  base({
    id: 'direction-assistant-direction',
    name: 'Assistant direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Filtre', cost: ['DIRECTION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il lit tout. Il ne décide rien.',
    art: 'direction-assistant-direction.webp'
  }),
  base({
    id: 'direction-chef-cabinet',
    evolvesFrom: 'direction-assistant-direction',
    name: 'Chef de cabinet',
    stage: 'N+1',
    rarity: '2D',
    hp: 95,
    retreat: 1,
    attacks: [
      { name: 'Porte fermée', cost: ['DIRECTION', 'INCOLORE'], damage: 50, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Note interne', cost: ['DIRECTION', 'INCOLORE'], damage: 40, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Il sait qui voit le patron. Ce n\'est pas toi.',
    art: 'direction-chef-cabinet.webp'
  }),

  // Ligne 4 (2 stades) : Secrétaire direction → Directeur de programme
  base({
    id: 'direction-secretaire-direction',
    name: 'Secrétaire direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Agenda', cost: ['DIRECTION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Elle gère l\'agenda. L\'agenda la gère.'
  }),
  base({
    id: 'direction-directeur-programme',
    evolvesFrom: 'direction-secretaire-direction',
    name: 'Directeur de programme',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [
      { name: 'Jalons', cost: ['DIRECTION', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est sommé de tenir les jalons du programme. Le programme n’a pas encore de budget.' },
      { name: 'Recette finale', cost: ['DIRECTION', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Le programme avance. Le budget, non.'
  }),

  // Ligne 3 complétée en N+2 (vague 2, #86) : Assistant direction → Chef de cabinet
  // → Directeur de cabinet.
  base({
    id: 'direction-directeur-cabinet',
    evolvesFrom: 'direction-chef-cabinet',
    name: 'Directeur de cabinet',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      {
        name: 'Porte fermée',
        cost: ['DIRECTION', 'INCOLORE'],
        damage: 60,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      },
      {
        name: 'Contre-ordre',
        cost: ['DIRECTION', 'INCOLORE', 'INCOLORE'],
        damage: 80,
        text: 'Le Planqué adverse est Immobilisé.',
        effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }]
      }
    ],
    flavor: 'Trois bureaux, deux secrétaires, aucun dossier.',
    art: 'direction-directeur-cabinet.webp'
  }),

  // Ligne 4 complétée en N+2 (vague 2, #86) : Secrétaire direction → Directeur de
  // programme → Directeur de la stratégie.
  base({
    id: 'direction-directeur-strategie',
    evolvesFrom: 'direction-directeur-programme',
    name: 'Directeur de la stratégie',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      {
        name: 'Feuille de route',
        cost: ['DIRECTION', 'INCOLORE'],
        damage: 60,
        text: 'Pioche 1 carte.',
        effects: [{ kind: 'draw', amount: 1 }]
      },
      {
        name: 'Arbitrage stratégique',
        cost: ['DIRECTION', 'INCOLORE', 'INCOLORE'],
        damage: 90,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      }
    ],
    flavor: 'Le cap est fixé. Le budget suivra, un jour.'
  }),

  // Entrants seuls (sans évolution)
  base({
    id: 'direction-stagiaire-direction',
    name: 'Stagiaire direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Stage', cost: ['DIRECTION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a fait le café. Le café était froid.'
  }),
  base({
    id: 'direction-auditeur-direction',
    name: 'Auditeur de direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Prélèvement', cost: ['DIRECTION'], damage: 10, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il a prélevé un échantillon. Le rapport a disparu avant lui.',
    art: 'direction-auditeur-direction.webp'
  }),
  base({
    id: 'direction-commissaire-comptes',
    name: 'Commissaire aux comptes',
    stage: 'ENTRANT',
    rarity: '2D',
    hp: 70,
    retreat: 1,
    attacks: [
      { name: 'Certification', cost: ['DIRECTION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Rapport d\'anomalie', cost: ['DIRECTION', 'INCOLORE'], damage: 40, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Il a certifié les comptes. L\'anomalie est dans le tiroir.',
  })
];

export const DIRECTION_VARIANTS: Card[] = [
  secretVariant(DIRECTION_CARDS, 'direction-chef-projet-fantome', 'star', '◆'),
  secretVariant(DIRECTION_CARDS, 'direction-directeur-adjoint', 'star', '✦'),
  secretVariant(DIRECTION_CARDS, 'direction-pdg', 'crown', '◆'),
  secretVariant(DIRECTION_CARDS, 'direction-directeur-general', 'star', '✦')
];

export const ALL_DIRECTION_CARDS: Card[] = [...DIRECTION_CARDS, ...DIRECTION_VARIANTS];
