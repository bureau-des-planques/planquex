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
    attacks: [{ name: 'Reporting', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il est en réunion. Depuis 2019.'
  }),
  base({
    id: 'direction-directeur-adjoint',
    evolvesFrom: 'direction-chef-projet-fantome',
    name: 'Directeur adjoint',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Cabinet', text: 'Pioche 1 carte.', kind: 'draw', amount: 1, oncePerTurn: false },
    attacks: [{ name: 'Note de service', cost: 2, damage: 40 }],
    flavor: 'Il a délégué. À personne.'
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
      { name: 'Plan de départ', cost: 2, damage: 60, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Fusion-acquisition', cost: 3, damage: 100, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Il repart avec la prime. Tu restes avec le plan.'
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
      { name: 'Plan de départ', cost: 2, damage: 70, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Fusion-acquisition', cost: 3, damage: 120, text: 'Envoie 1 café du Planqué adverse au rebut. Ce Planqué prend 20 de stress.', effects: [{ kind: 'discardEnergy', target: 'opponent' }, { kind: 'selfDamage', amount: 20 }] }
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
    attacks: [{ name: 'Reporting', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Son bureau est vide. Sa signature est partout.'
  }),
  base({
    id: 'direction-directeur-regional',
    evolvesFrom: 'direction-directeur-fantome',
    name: 'Directeur régional',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Réorganisation', cost: 2, damage: 50, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
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
      { name: 'Restructuration', cost: 2, damage: 60, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Plan social', cost: 3, damage: 90, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'La croissance est externe. Les dégâts sont internes.'
  }),

  // Ligne 3 (2 stades) : Assistant direction → Chef de cabinet
  base({
    id: 'direction-assistant-direction',
    name: 'Assistant direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Filtre', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il lit tout. Il ne décide rien.'
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
      { name: 'Porte fermée', cost: 2, damage: 50, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Note interne', cost: 2, damage: 40, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Il sait qui voit le patron. Ce n\'est pas toi.'
  }),

  // Ligne 4 (2 stades) : Secrétaire direction → Directeur de programme
  base({
    id: 'direction-secretaire-direction',
    name: 'Secrétaire direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Agenda', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
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
      { name: 'Jalons', cost: 2, damage: 50 },
      { name: 'Recette finale', cost: 3, damage: 80, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Le projet est livré. La recette est signée demain.'
  }),

  // Entrants seuls (sans évolution)
  base({
    id: 'direction-stagiaire-direction',
    name: 'Stagiaire direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Stage', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a fait le café. Le café était froid.'
  }),
  base({
    id: 'direction-auditeur-interne',
    name: 'Auditeur de direction',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Prélèvement', cost: 1, damage: 10, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il a prélevé un échantillon. L\'échantillon est introuvable.'
  }),
  base({
    id: 'direction-commissaire-comptes',
    name: 'Commissaire aux comptes',
    stage: 'ENTRANT',
    rarity: '2D',
    hp: 70,
    retreat: 1,
    attacks: [
      { name: 'Certification', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Rapport d\'anomalie', cost: 2, damage: 40, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Il a certifié les comptes. L\'anomalie est dans le tiroir.'
  })
];

export const DIRECTION_VARIANTS: Card[] = [
  secretVariant(DIRECTION_CARDS, 'direction-chef-projet-fantome', 'star', '◆'),
  secretVariant(DIRECTION_CARDS, 'direction-directeur-adjoint', 'star', '✦'),
  secretVariant(DIRECTION_CARDS, 'direction-pdg', 'star2', '◆'),
  secretVariant(DIRECTION_CARDS, 'direction-directeur-general', 'star', '✦')
];

export const ALL_DIRECTION_CARDS: Card[] = [...DIRECTION_CARDS, ...DIRECTION_VARIANTS];
