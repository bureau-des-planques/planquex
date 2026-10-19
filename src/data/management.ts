import type { Card, PlanqueCard } from './types';

const PALETTE = 'linear-gradient(155deg, #2a1206 0%, #d4622a 48%, #1a0a02 100%)';
const GLYPH = '▲';

/**
 * Faction **Management** (`MGT`) — Feu, vivier **Atelier** (D-024, D-026).
 * Archétype agressif : pression, objectifs, épuisement (CARD-SPEC.md §3).
 * Les intitulés sont des postes réels, les Pressions des tâches ou documents,
 * les Talents des compétences de métier (D-027).
 */
const base = (card: Omit<PlanqueCard, 'kind' | 'faction' | 'weakness' | 'palette' | 'glyph'> & { glyph?: string }): PlanqueCard => ({
  ...card,
  kind: 'PLANQUE',
  faction: 'MANAGEMENT',
  weakness: 'QVT',
  palette: PALETTE,
  glyph: card.glyph ?? GLYPH
});

export const MANAGEMENT_CARDS: PlanqueCard[] = [
  base({
    id: 'management-jeune-manager',
    name: 'Jeune manager',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Objectif', cost: 1, damage: 20 }],
    flavor: 'Il a un plan. Le plan est un post-it.'
  }),
  base({
    id: 'management-chef-de-projet',
    name: 'Chef de projet',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Rétroplanning', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a trois rétroplanings. Aucun ne parle du même projet.'
  }),
  base({
    id: 'management-commercial',
    name: 'Commercial',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Prospection', cost: 1, damage: 20 }],
    flavor: 'Il a signé un devis. Le client attend la livraison depuis mars.'
  }),
  base({
    id: 'management-assistant-manager',
    name: 'Assistant manager',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Reporting', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il prépare le tableau de bord qui prépare le tableau de bord.'
  }),
  base({
    id: 'management-superviseur',
    name: 'Superviseur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Briefing', cost: 1, damage: 20 }],
    flavor: 'Il a briefé l’équipe. L’équipe a compris le contraire.'
  }),
  base({
    id: 'management-ton-chef',
    name: 'Ton chef',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Point de suivi', cost: 1, damage: 20 }],
    flavor: 'Il veut juste un point. Le point dure deux heures.'
  }),
  base({
    id: 'management-chargee-clientele',
    name: 'Chargée de clientèle',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Relance', cost: 1, damage: 20 }],
    flavor: 'Elle relance les impayés. Personne ne la relance.'
  }),
  base({
    id: 'management-planificateur',
    name: 'Planificateur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Planning', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le planning est à jour. Le site a changé de plan.'
  }),
  base({
    id: 'management-controleur-gestion',
    name: 'Contrôleur de gestion',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Écart budgétaire', cost: 1, damage: 20 }],
    flavor: 'Il a trouvé l’écart. Il l’a mis dans un autre tableau.'
  }),
  base({
    id: 'management-chef-equipe',
    name: 'Chef d’équipe',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Consigne', cost: 1, damage: 20 }],
    flavor: 'Il relaie la consigne. La consigne s’arrête à lui.'
  }),
  base({
    id: 'management-charge-affaires',
    name: 'Chargé d’affaires',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Devis', cost: 1, damage: 20 }],
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
    attacks: [{ name: 'Deadline', cost: 2, damage: 50 }],
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
    attacks: [{ name: 'Jalon', cost: 2, damage: 50 }],
    flavor: 'Il a validé le jalon. Le jalon n’existait pas.'
  }),
  base({
    id: 'management-responsable-commercial',
    evolvesFrom: 'management-commercial',
    name: 'Responsable commercial',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Négociation', cost: 2, damage: 40 }],
    flavor: 'Il a négocié une remise. Le client en a négocié une autre.'
  }),
  base({
    id: 'management-manager-adjoint',
    evolvesFrom: 'management-assistant-manager',
    name: 'Manager adjoint',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [
      {
        name: 'Entretien individuel',
        cost: 2,
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
    attacks: [{ name: 'Cadence', cost: 2, damage: 50 }],
    flavor: 'La cadence est tenue. Les gens, non.'
  }),

  base({
    id: 'management-chef-des-ventes',
    evolvesFrom: 'management-manager-proximite',
    name: 'Chef des ventes',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      {
        name: 'Restructuration',
        cost: 2,
        damage: 60,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      },
      {
        name: 'Plan de croissance',
        cost: 3,
        damage: 100,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'La croissance est externe. Les dégâts sont internes.'
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
      { name: 'Revue de jalons', cost: 2, damage: 60 },
      {
        name: 'Recette finale',
        cost: 3,
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
      { name: 'Objectif de rendement', cost: 2, damage: 60 },
      {
        name: 'Ligne complète',
        cost: 3,
        damage: 100,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'Il a optimisé la ligne. Il a oublié les gens dessus.'
  }),
  base({
    id: 'management-chef-des-ventes-ex',
    evolvesFrom: 'management-manager-proximite',
    name: 'Chef des ventes COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 170,
    retreat: 3,
    ex: true,
    attacks: [
      {
        name: 'Restructuration',
        cost: 2,
        damage: 70,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      },
      {
        name: 'Plan de croissance',
        cost: 3,
        damage: 120,
        text: 'Ce Planqué prend 20 de stress.',
        effects: [{ kind: 'selfDamage', amount: 20 }]
      }
    ],
    flavor: 'Deux Interventions. Une seule réunion.'
  })
];

const variant = (baseId: string, id: string, rarity: Card['rarity'], glyph?: string): PlanqueCard => {
  const source = MANAGEMENT_CARDS.find((card) => card.id === baseId);
  if (!source) throw new Error(`Carte Management introuvable: ${baseId}`);
  return {
    ...source,
    id,
    rarity,
    variantOf: baseId,
    glyph: glyph ?? source.glyph,
    flavor: source.flavor
  };
};

export const MANAGEMENT_VARIANTS: Card[] = [
  variant('management-manager-proximite', 'management-manager-proximite-star', '1S', '▲'),
  variant('management-responsable-projet', 'management-responsable-projet-star', '1S', '✦'),
  variant('management-responsable-commercial', 'management-responsable-commercial-star', '1S', '▲'),
  variant('management-manager-adjoint', 'management-manager-adjoint-star', '1S', '◉'),
  variant('management-chef-des-ventes', 'management-chef-des-ventes-star2', '2S', '▲'),
  variant('management-directeur-projet', 'management-directeur-projet-star2', '2S', '✦'),
  variant('management-directeur-production', 'management-directeur-production-star2', '2S', '▲'),
  variant('management-jeune-manager', 'management-jeune-manager-star2', '2S', '◉')
];

export const ALL_MANAGEMENT_CARDS: Card[] = [...MANAGEMENT_CARDS, ...MANAGEMENT_VARIANTS];
