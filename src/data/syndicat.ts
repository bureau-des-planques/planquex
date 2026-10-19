import type { Card, PlanqueCard } from './types';

const PALETTE = 'linear-gradient(155deg, #2a1010 0%, #b34a4a 48%, #140f0f 100%)';
const GLYPH = '✊';

/**
 * Faction **Syndicat** (`SYN`) — Métal, vivier **Atelier** (D-024, D-026).
 * Archétype tank / contrôle : gros Seuil, soin, protection, anti-statut (CARD-SPEC.md §3).
 * Les intitulés sont des postes réels, les Pressions des tâches ou documents,
 * les Talents des compétences de métier (D-027).
 */
const base = (card: Omit<PlanqueCard, 'kind' | 'faction' | 'weakness' | 'palette' | 'glyph'> & { glyph?: string }): PlanqueCard => ({
  ...card,
  kind: 'PLANQUE',
  faction: 'SYNDICAT',
  weakness: 'MANAGEMENT',
  palette: PALETTE,
  glyph: card.glyph ?? GLYPH
});

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
        cost: 1,
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
    attacks: [{ name: 'Motion', cost: 2, damage: 40 }],
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
        cost: 2,
        damage: 50,
        text: 'Ce Planqué subit 10 de moins au prochain tour.',
        effects: [{ kind: 'reduceDamage', amount: 10 }]
      },
      {
        name: 'Grève',
        cost: 3,
        damage: 80,
        text: 'Le Planqué adverse est Immobilisé.',
        effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }]
      }
    ],
    flavor: 'Il a obtenu une réunion. Elle a duré 4 heures.'
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
        cost: 2,
        damage: 60,
        text: 'Ce Planqué subit 20 de moins au prochain tour.',
        effects: [{ kind: 'reduceDamage', amount: 20 }]
      },
      {
        name: 'Grève',
        cost: 3,
        damage: 110,
        text: 'Le Planqué adverse est Immobilisé.',
        effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }]
      }
    ],
    flavor: 'Deux Interventions. Le compte rendu fait 40 pages.'
  })
];

const variant = (baseId: string, id: string, rarity: Card['rarity'], glyph?: string): PlanqueCard => {
  const source = SYNDICAT_CARDS.find((card) => card.id === baseId);
  if (!source) throw new Error(`Carte Syndicat introuvable: ${baseId}`);
  return {
    ...source,
    id,
    rarity,
    variantOf: baseId,
    glyph: glyph ?? source.glyph,
    flavor: source.flavor
  };
};

export const SYNDICAT_VARIANTS: Card[] = [
  variant('syndicat-secretaire-general', 'syndicat-secretaire-general-star2', '2S', '✦')
];

export const ALL_SYNDICAT_CARDS: Card[] = [...SYNDICAT_CARDS, ...SYNDICAT_VARIANTS];
