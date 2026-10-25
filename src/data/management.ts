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
    attacks: [{ name: 'Objectif', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse reçoit un objectif de 20. Il sera revu à la hausse dès qu’il sera atteint.' }],
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
    flavor: 'Il a trois rétroplanings. Aucun ne parle du même projet.',
    art: 'management-chef-de-projet.webp'
  }),
  base({
    id: 'management-technico-commercial',
    name: 'Technico-commercial',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Prospection', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse est démarché sans relâche. Le devis part ; la livraison, elle, n’a pas de date.' }],
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
    flavor: 'Il prépare le tableau de bord qui prépare le tableau de bord.',
    art: 'management-assistant-manager.webp'
  }),
  base({
    id: 'management-superviseur',
    name: 'Superviseur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Briefing', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse subit un briefing de dernière minute. Le compte rendu dira le contraire.' }],
    flavor: 'Il a briefé l’équipe. Le compte-rendu dit l’inverse.'
  }),
  base({
    id: 'management-animateur-equipe',
    name: 'Animateur d’équipe',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Point de suivi', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse est convoqué à un point de suivi. Il durera deux heures et ne décidera rien.' }],
    flavor: 'Il veut juste un point. Le point dure deux heures.',
    art: 'management-animateur-equipe.webp'
  }),
  base({
    id: 'management-chargee-clientele',
    name: 'Chargée de clientèle',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Relance', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse est relancé trois fois dans la journée. La réponse attend toujours une validation.' }],
    flavor: 'Elle relance les impayés. La relance attend une validation.',
    art: 'management-chargee-clientele.webp'
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
    attacks: [{ name: 'Écart budgétaire', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse est épinglé sur un écart budgétaire. L’écart a déjà migré dans un autre tableau.' }],
    flavor: 'Il a trouvé l’écart. Il l’a mis dans un autre tableau.'
  }),
  base({
    id: 'management-chef-equipe',
    name: 'Chef d’équipe',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Consigne', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse reçoit la consigne du jour. Elle sera remplacée avant la fin du poste.' }],
    flavor: 'Il relaie la consigne. Le circuit l’a déjà remplacée.'
  }),
  base({
    id: 'management-charge-affaires',
    name: 'Chargé d’affaires',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Devis', cost: ['MANAGEMENT'], damage: 20, text: 'Le Planqué adverse reçoit un devis au prix le plus bas. La marge est restée au bureau.' }],
    flavor: 'Le devis est parti. La marge est restée au bureau.',
    art: 'management-charge-affaires.webp'
  }),

  base({
    id: 'management-manager-proximite',
    evolvesFrom: 'management-jeune-manager',
    name: 'Manager de proximité',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    // Le Talent vendu par `CARD-SPEC.md` §4 (D-074) : défausse de la main (#159, D-076) et
    // dégâts d'un Talent (#164, D-077) ; il reste à la demande, une fois par tour.
    ability: {
      name: 'Pression',
      text: 'Une fois par tour : défausse 1 carte, 10 dégâts au Planqué adverse actif.',
      kind: 'effects',
      oncePerTurn: true,
      effects: [
        { kind: 'discardHand', target: 'self', amount: 1 },
        { kind: 'damage', amount: 10 }
      ]
    },
    attacks: [{ name: 'Deadline', cost: ['MANAGEMENT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse tombe sur une échéance impossible. Elle a été fixée par courriel, sans accusé de lecture.' }],
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
    attacks: [{ name: 'Jalon', cost: ['MANAGEMENT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse doit valider un jalon qui n’existait pas la veille. Le planning sera refait après coup.' }],
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
    attacks: [{ name: 'Négociation', cost: ['MANAGEMENT', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse négocie une remise. Le client en négocie une autre, et gagne.' }],
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
    attacks: [{ name: 'Cadence', cost: ['MANAGEMENT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est mis en cadence. La cadence est tenue ; les gens, un peu moins.' }],
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
        text: 'Le Planqué adverse défausse 1 café.',
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
      { name: 'Revue de jalons', cost: ['MANAGEMENT', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse passe en revue de jalons. Le projet est livré ; la recette sera signée lundi.' },
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
      { name: 'Objectif de rendement', cost: ['MANAGEMENT', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse reçoit un objectif de rendement. Les gens sur la ligne n’étaient pas dans le calcul.' },
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
      { name: 'Objectifs du service', cost: ['MANAGEMENT', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse reçoit trois objectifs. Le sien est atteignable ; les deux autres, non.' },
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
        text: 'Le Planqué adverse défausse 1 café.',
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
