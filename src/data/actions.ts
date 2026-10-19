import type { ActionCard } from './types';

/**
 * Cartes Action du lancement : **8 Collègues** et **3 Objets** (`CARD-SPEC.md` §1,
 * `D-005`). Elles se jouent depuis la main puis partent au Rebut : un **Objet** est
 * illimité par tour, un **Collègue** une fois par tour (`AGENTS.md` §4).
 *
 * Conventions d'écriture : `D-027` (un Objet est **NEUF** ou **MRO**, la flavour est une
 * scène de site dont la chute vise le système) et `AGENTS.md` §5 (primitives d'effet
 * existantes uniquement). Les huit Collègues couvrent huit factions ; l'Atelier et
 * l'Intérim n'en ont pas, leurs cartes Action du lancement sont des Objets.
 */
const PALETTE = 'linear-gradient(155deg, #101a26 0%, #43506a 55%, #070c14 100%)';

const card = (entry: Omit<ActionCard, 'palette'>): ActionCard => ({ ...entry, palette: PALETTE });

export const ACTION_CARDS: ActionCard[] = [
  // ——— Objets : NEUF (matériel à installer) ou MRO (pièces et outillage), D-027 ———
  card({
    id: 'sse-trousse-secours',
    name: 'Trousse de secours',
    kind: 'OBJET',
    itemKind: 'MRO',
    faction: 'SSE',
    rarity: '2D',
    text: 'Soigne 10 de tous tes Planqués.',
    effects: [{ kind: 'healAll', amount: 10 }],
    flavor: 'Le pansement est périmé. Le registre, non.',
    glyph: '✚'
  }),
  card({
    id: 'amelioration-baie-test',
    name: 'Baie de test',
    kind: 'OBJET',
    itemKind: 'NEUF',
    faction: 'AMELIORATION',
    rarity: '2D',
    text: 'Pioche 2 cartes.',
    effects: [{ kind: 'draw', amount: 2 }],
    flavor: 'Deux heures de mesure pour une vis desserrée. Le rapport est impeccable.',
    glyph: '↻'
  }),
  card({
    id: 'atelier-colle-cyanoacrylate',
    name: 'Colle cyanoacrylate',
    kind: 'OBJET',
    itemKind: 'MRO',
    faction: 'ATELIER',
    rarity: '2D',
    text: 'Le Planqué adverse est Immobilisé.',
    effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }],
    flavor: 'La pièce est collée. La réunion aussi.',
    glyph: '⚒'
  }),

  // ——— Collègues : 1 par tour, un par faction (huit factions) ———
  card({
    id: 'sse-visite-medicale',
    name: 'Visite médicale',
    kind: 'COLLEAGUE',
    faction: 'SSE',
    rarity: '2D',
    text: 'Soigne 20 de tous tes Planqués.',
    effects: [{ kind: 'healAll', amount: 20 }],
    flavor: 'Il a coché « apte ». Il n’a pas demandé à quoi.',
    glyph: '✚'
  }),
  card({
    id: 'management-entretien-annuel',
    name: 'Entretien annuel',
    kind: 'COLLEAGUE',
    faction: 'MANAGEMENT',
    rarity: '2D',
    text: 'Envoie 1 café du Planqué adverse au rebut.',
    effects: [{ kind: 'discardEnergy', target: 'opponent' }],
    flavor: 'Il a coché « atteint ». Le formulaire ne demande pas comment.',
    glyph: '▲'
  }),
  card({
    id: 'qvt-yoga-du-rire',
    name: 'Yoga du rire',
    kind: 'COLLEAGUE',
    faction: 'QVT',
    rarity: '2D',
    text: 'Soigne 10 de tous tes Planqués. Pioche 1 carte.',
    effects: [
      { kind: 'healAll', amount: 10 },
      { kind: 'draw', amount: 1 }
    ],
    flavor: 'Riez. La séance est obligatoire, et déduite de la pause.',
    glyph: '☺'
  }),
  card({
    id: 'amelioration-reunion-de-suivi',
    name: 'Réunion de suivi',
    kind: 'COLLEAGUE',
    faction: 'AMELIORATION',
    rarity: '2D',
    text: 'Pioche 2 cartes.',
    effects: [{ kind: 'draw', amount: 2 }],
    flavor: 'Trois actions décidées. Aucune ne concerne le produit.',
    glyph: '↻'
  }),
  card({
    id: 'rh-reunion-individuelle',
    name: 'Réunion individuelle',
    kind: 'COLLEAGUE',
    faction: 'RH',
    rarity: '2D',
    text: 'Le Planqué adverse est Dérivé.',
    effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }],
    flavor: 'Tu es ressorti avec un plan de carrière. Il tient sur un post-it.',
    glyph: '◉'
  }),
  card({
    id: 'direction-reunion-qui-aurait-pu-etre-un-mail',
    name: 'Réunion qui aurait pu être un mail',
    kind: 'COLLEAGUE',
    faction: 'DIRECTION',
    rarity: '2D',
    text: 'Envoie 1 café du Planqué adverse au rebut. Pioche 1 carte.',
    effects: [
      { kind: 'discardEnergy', target: 'opponent' },
      { kind: 'draw', amount: 1 }
    ],
    flavor: 'Quarante-cinq minutes pour décider de ne pas décider.',
    glyph: '◆'
  }),
  card({
    id: 'syndicat-assemblee-generale',
    name: 'Assemblée générale',
    kind: 'COLLEAGUE',
    faction: 'SYNDICAT',
    rarity: '2D',
    text: 'Le Planqué adverse est en Sieste.',
    effects: [{ kind: 'status', status: 'SIESTE', target: 'opponent' }],
    flavor: 'L’ordre du jour tient en trois heures. La décision, en une ligne.',
    glyph: '✊'
  }),
  card({
    id: 'support-escalade',
    name: 'Escalade',
    kind: 'COLLEAGUE',
    faction: 'SUPPORT',
    rarity: '2D',
    text: 'Pioche 2 cartes.',
    effects: [{ kind: 'draw', amount: 2 }],
    flavor: 'Le ticket a changé de service. Le problème aussi.',
    glyph: '⌘'
  })
];
