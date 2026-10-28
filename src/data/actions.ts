import type { ActionCard } from './types';

/**
 * Cartes Action du lancement : **8 Collègues** et **3 Objets** (`CARD-SPEC.md` §1,
 * `D-005`). Elles se jouent depuis la main puis partent au Rebut : un **Objet** est
 * illimité par tour, un **Collègue** une fois par tour (`docs/JEU.md` §4).
 *
 * Conventions d'écriture : `D-027` (un Objet est **NEUF** ou **MRO**, la flavour est une
 * scène de site dont la chute vise le système) et `docs/JEU.md` §5 (primitives d'effet
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
    glyph: '✚',
    art: 'sse-trousse-secours.webp'
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
    glyph: '↻',
    art: 'amelioration-baie-test.webp'
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
    glyph: '⚒',
    art: 'atelier-colle-cyanoacrylate.webp'
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
    glyph: '✚',
    art: 'sse-visite-medicale.webp'
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
    glyph: '▲',
    art: 'management-entretien-annuel.webp'
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
    glyph: '☺',
    art: 'qvt-yoga-du-rire.webp'
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
    glyph: '↻',
    art: 'amelioration-reunion-de-suivi.webp'
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
    glyph: '◉',
    art: 'rh-reunion-individuelle.webp'
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
    glyph: '◆',
    art: 'direction-reunion-qui-aurait-pu-etre-un-mail.webp'
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
    glyph: '✊',
    art: 'syndicat-assemblee-generale.webp'
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
    glyph: '⌘',
    art: 'support-escalade.webp'
  })
];

/**
 * Variante d'une carte Action — même motif que `sse.ts` : une autre apparence de la
 * **même** carte. Le nom, le texte, les effets et, s'il existe, l'`itemKind` sont
 * hérités de la base (`docs/JEU.md` §5) ; seuls l'identifiant (`-star` / `-star2`) et
 * la rareté changent.
 *
 * **L'illustration ne s'hérite pas** (D-139), comme pour les Planqués : `art` est écarté,
 * et une variante qui a sa planche la déclare. Les huit variantes de Collègues sont
 * comprises dans les 75 variantes de la décision.
 */
const variant = (
  baseId: string,
  id: string,
  rarity: ActionCard['rarity'],
  glyph?: string,
  art?: string
): ActionCard => {
  const source = ACTION_CARDS.find((card) => card.id === baseId);
  if (!source) throw new Error(`Carte Action introuvable: ${baseId}`);
  const { art: _heritee, ...herite } = source;
  return {
    ...herite,
    id,
    rarity,
    variantOf: baseId,
    glyph: glyph ?? source.glyph,
    flavor: source.flavor,
    ...(art === undefined ? {} : { art })
  };
};

/**
 * Les **8 variantes de Collègues** (`CARD-SPEC.md` §1).
 * Une par Collègue, toutes en `1S` : dans les fichiers de faction, la variante d'une base
 * `2D` est à **1 étoile** (26 des 30 cas mesurés) — et `3S`/`COU` reviennent aux variantes
 * de Planqués. Aucune variante d'Objet : CARD-SPEC n'en compte pas.
 */
export const ACTION_VARIANTS: ActionCard[] = [
  variant('sse-visite-medicale', 'sse-visite-medicale-star', '1S'),
  variant('management-entretien-annuel', 'management-entretien-annuel-star', '1S'),
  variant('qvt-yoga-du-rire', 'qvt-yoga-du-rire-star', '1S'),
  variant('amelioration-reunion-de-suivi', 'amelioration-reunion-de-suivi-star', '1S'),
  variant('rh-reunion-individuelle', 'rh-reunion-individuelle-star', '1S'),
  variant(
    'direction-reunion-qui-aurait-pu-etre-un-mail',
    'direction-reunion-qui-aurait-pu-etre-un-mail-star',
    '1S'
  ),
  variant('syndicat-assemblee-generale', 'syndicat-assemblee-generale-star', '1S'),
  variant('support-escalade', 'support-escalade-star', '1S')
];

export const ALL_ACTION_CARDS: ActionCard[] = [...ACTION_CARDS, ...ACTION_VARIANTS];
