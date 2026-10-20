import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/**
 * Faction **Management** (`MGT`) — Feu, vivier **Atelier** (D-024, D-026).
 * Archétype agressif : pression, objectifs, épuisement (CARD-SPEC.md §3).
 * Les intitulés sont des postes réels, les Pressions des tâches ou documents,
 * les Talents des compétences de métier (D-027).
 */

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('MANAGEMENT');

export const MANAGEMENT_CARDS: PlanqueCard[] = [
  base({
    id: 'management-jeune-manager',
    name: 'Jeune manager',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Objectif', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Il a un plan. Le plan est un post-it.'
  }),
  base({
    id: 'management-chef-de-projet',
    name: 'Chef de projet',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Rétroplanning', cost: ['MANAGEMENT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a trois rétroplanings. Aucun ne parle du même projet.'
  }),
  base({
    id: 'management-technico-commercial',
    name: 'Technico-commercial',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Prospection', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Il a signé un devis. Le client attend la livraison depuis mars.'
  }),
  base({
    id: 'management-assistant-manager',
    name: 'Assistant manager',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Reporting', cost: ['MANAGEMENT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il prépare le tableau de bord qui prépare le tableau de bord.'
  }),
  base({
    id: 'management-superviseur',
    name: 'Superviseur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Briefing', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Il a briefé l’équipe. Le compte-rendu dit l’inverse.'
  }),
  base({
    id: 'management-animateur-equipe',
    name: 'Animateur d’équipe',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Point de suivi', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Il veut juste un point. Le point dure deux heures.'
  }),
  base({
    id: 'management-chargee-clientele',
    name: 'Chargée de clientèle',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Relance', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Elle relance les impayés. La relance attend une validation.'
  }),
  base({
    id: 'management-planificateur',
    name: 'Planificateur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Planning', cost: ['MANAGEMENT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le planning est à jour. Le site a changé de plan.'
  }),
  base({
    id: 'management-controleur-gestion',
    name: 'Contrôleur de gestion',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Écart budgétaire', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Il a trouvé l’écart. Il l’a mis dans un autre tableau.'
  }),
  base({
    id: 'management-chef-equipe',
    name: 'Chef d’équipe',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Consigne', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Il relaie la consigne. Le circuit l’a déjà remplacée.'
  }),
  base({
    id: 'management-charge-affaires',
    name: 'Chargé d’affaires',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Devis', cost: ['MANAGEMENT'], damage: 20 }],
    flavor: 'Le devis est parti. La marge est restée au bureau.'
  }),

  base({
    id: 'management-manager-proximite',
    evolvesFrom: 'management-jeune-manager',
    name: 'Manager de proximité',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Pression', text: 'Ce Planqué subit 10 dégâts de moins.', kind: 'reduceDamage', amount: 10 },
    attacks: [{ name: 'Deadline', cost: ['MANAGEMENT', 'INCOLORE'], damage: 50 }],
    flavor: 'Il manage par mail. Il ne lit pas les réponses.'
  }),
  base({
    id: 'management-responsable-projet',
    evolvesFrom: 'management-chef-de-projet',
    name: 'Responsable de projet',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Jalon', cost: ['MANAGEMENT', 'INCOLORE'], damage: 50 }],
    flavor: 'Il a validé le jalon. Le jalon n’existait pas.'
  }),
  base({
    id: 'management-responsable-commercial',
    evolvesFrom: 'management-technico-commercial',
    name: 'Responsable commercial',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Négociation', cost: ['MANAGEMENT', 'INCOLORE'], damage: 40 }],
    flavor: 'Il a négocié une remise. Le client en a négocié une autre.'
  }),
  base({
    id: 'management-chef-service',
    evolvesFrom: 'management-assistant-manager',
    name: 'Chef de service',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [
      {
        name: 'Entretien individuel',
        cost: ['MANAGEMENT', 'INCOLORE'],
        damage: 40,
        text: 'Le Planqué adverse est en Sieste.',
        effects: [{ kind: 'status', status: 'SIESTE', target: 'opponent' }]
      }
    ],
    flavor: 'Il a pris les décisions. Le chef les a signées.'
  }),
  base({
    id: 'management-responsable-production',
    evolvesFrom: 'management-superviseur',
    name: 'Responsable de production',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Cadence', cost: ['MANAGEMENT', 'INCOLORE'], damage: 50 }],
    flavor: 'La cadence est tenue. Les gens, non.'
  }),

  base({
    id: 'management-responsable-unite',
    evolvesFrom: 'management-manager-proximite',
    name: 'Responsable d’unité',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      {
        name: 'Restructuration',
        cost: ['MANAGEMENT', 'INCOLORE'],
        damage: 60,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      },
      {
        name: 'Plan de croissance',
        cost: ['MANAGEMENT', 'INCOLORE', 'INCOLORE'],
        damage: 100,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'La croissance est externe. Les dégâts sont internes.',
    art: 'management-responsable-unite.webp'
  }),
  base({
    id: 'management-directeur-projet',
    evolvesFrom: 'management-responsable-projet',
    name: 'Directeur de projet',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Revue de jalons', cost: ['MANAGEMENT', 'INCOLORE'], damage: 60 },
      {
        name: 'Recette finale',
        cost: ['MANAGEMENT', 'INCOLORE', 'INCOLORE'],
        damage: 90,
        text: 'Soigne 10 de tous tes Planqués.',
        effects: [{ kind: 'healAll', amount: 10 }]
      }
    ],
    flavor: 'Le projet est livré. La recette est signée demain.'
  }),
  base({
    id: 'management-directeur-production',
    evolvesFrom: 'management-responsable-production',
    name: 'Directeur de production',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Objectif de rendement', cost: ['MANAGEMENT', 'INCOLORE'], damage: 60 },
      {
        name: 'Ligne complète',
        cost: ['MANAGEMENT', 'INCOLORE', 'INCOLORE'],
        damage: 100,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'Il a optimisé la ligne. Il a oublié les gens dessus.'
  }),

  // Ligne complétée en N+2 (vague 2, #86) : Assistant manager → Chef de service →
  // Directeur de service.
  base({
    id: 'management-directeur-service',
    evolvesFrom: 'management-chef-service',
    name: 'Directeur de service',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Objectifs du service', cost: ['MANAGEMENT', 'INCOLORE'], damage: 60 },
      {
        name: 'Revue de performance',
        cost: ['MANAGEMENT', 'INCOLORE', 'INCOLORE'],
        damage: 90,
        text: 'Le Planqué adverse est en Épuisement.',
        effects: [{ kind: 'status', status: 'EPUISEMENT', target: 'opponent' }]
      }
    ],
    flavor: 'Trois objectifs. Le sien est atteignable. Les deux autres, non.'
  }),
  base({
    id: 'management-responsable-unite-ex',
    evolvesFrom: 'management-manager-proximite',
    name: 'Responsable d’unité COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 170,
    retreat: 3,
    ex: true,
    attacks: [
      {
        name: 'Restructuration',
        cost: ['MANAGEMENT', 'INCOLORE'],
        damage: 70,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      },
      {
        name: 'Plan de croissance',
        cost: ['MANAGEMENT', 'INCOLORE', 'INCOLORE'],
        damage: 120,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'Deux Interventions. Une seule réunion.'
  })
];

export const MANAGEMENT_VARIANTS: Card[] = [
  secretVariant(MANAGEMENT_CARDS, 'management-manager-proximite', 'star', '▲'),
  secretVariant(MANAGEMENT_CARDS, 'management-responsable-projet', 'star', '✦'),
  secretVariant(MANAGEMENT_CARDS, 'management-responsable-commercial', 'star', '▲'),
  secretVariant(MANAGEMENT_CARDS, 'management-chef-service', 'star', '◉'),
  secretVariant(MANAGEMENT_CARDS, 'management-responsable-unite', 'star2', '▲'),
  secretVariant(MANAGEMENT_CARDS, 'management-directeur-projet', 'star2', '✦'),
  secretVariant(MANAGEMENT_CARDS, 'management-directeur-production', 'star2', '▲'),
  secretVariant(MANAGEMENT_CARDS, 'management-jeune-manager', 'star2', '◉')
];

export const ALL_MANAGEMENT_CARDS: Card[] = [...MANAGEMENT_CARDS, ...MANAGEMENT_VARIANTS];
