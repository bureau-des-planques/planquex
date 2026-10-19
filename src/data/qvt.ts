import type { Card, PlanqueCard } from './types';

const PALETTE = 'linear-gradient(155deg, #0b3d5c 0%, #2f8fb3 48%, #071421 100%)';
const GLYPH = '☺';

const base = (card: Omit<PlanqueCard, 'kind' | 'faction' | 'weakness' | 'palette' | 'glyph'> & { glyph?: string }): PlanqueCard => ({
  ...card,
  kind: 'PLANQUE',
  faction: 'QVT',
  weakness: 'AMELIORATION',
  palette: PALETTE,
  glyph: card.glyph ?? GLYPH
});

export const QVT_CARDS: PlanqueCard[] = [
  // Ligne 1 : Chargé QVT → Happiness Manager → Chief Happiness Officer (échantillon CARD-SPEC.md)
  base({
    id: 'qvt-charge-qvt',
    name: 'Chargé QVT',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Corbeille de fruits', cost: 1, damage: 10, text: 'Soigne 10 d\'un de tes Planqués.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a apporté des clémentines. C\'est son projet.'
  }),
  base({
    id: 'qvt-happiness-manager',
    evolvesFrom: 'qvt-charge-qvt',
    name: 'Happiness Manager',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Bulletin de bonheur', text: 'Une fois par tour : attache 1 café à un Planqué de ton Rack.', kind: 'attachEnergy', oncePerTurn: true },
    attacks: [{ name: 'Afterwork', cost: 2, damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le bonheur est un KPI comme un autre.'
  }),
  base({
    id: 'qvt-chief-happiness-officer',
    evolvesFrom: 'qvt-happiness-manager',
    name: 'Chief Happiness Officer',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Team building', cost: 2, damage: 60, text: 'Soigne 20 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 20 }] },
      { name: 'Yoga du rire', cost: 3, damage: 80, text: 'Le Planqué adverse est Dérivé.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: 'Riez. C\'est obligatoire.'
  }),

  // Ligne 2 : Animateur bien-être → Responsable QVT → Directeur QVT
  base({
    id: 'qvt-animateur-bien-etre',
    name: 'Animateur bien-être',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Pause active', cost: 1, damage: 10, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a mis de la musique. Personne n\'a dansé.'
  }),
  base({
    id: 'qvt-responsable-qvt',
    evolvesFrom: 'qvt-animateur-bien-etre',
    name: 'Responsable QVT',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    ability: { name: 'Écoute active', text: 'Une fois par tour : soigne 10 et retire un statut d\'un de tes Planqués.', kind: 'antiStatus', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Enquête satisfaction', cost: 2, damage: 50 }],
    flavor: 'Il a lu les réponses. Il a fait comme si.'
  }),
  base({
    id: 'qvt-directeur-qvt',
    evolvesFrom: 'qvt-responsable-qvt',
    name: 'Directeur QVT',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Plan d\'action', cost: 2, damage: 70, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Semaine de la QVT', cost: 3, damage: 90, text: 'Soigne 30 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 30 }] }
    ],
    flavor: 'Le budget a été validé. La direction l\'a gelé.'
  }),

  // Ligne 3 : Coach santé → Expert bien-être (2 stades)
  base({
    id: 'qvt-coach-sante',
    name: 'Coach santé',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Étirement', cost: 1, damage: 20 }],
    flavor: 'Il a compté jusqu\'à dix. Le dos craque encore.'
  }),
  base({
    id: 'qvt-expert-bien-etre',
    evolvesFrom: 'qvt-coach-sante',
    name: 'Expert bien-être',
    stage: 'N+1',
    rarity: '2D',
    hp: 110,
    retreat: 1,
    attacks: [
      { name: 'Bilan forme', cost: 2, damage: 50 },
      { name: 'Programme sur mesure', cost: 2, damage: 40, text: 'Soigne 20 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 20 }] }
    ],
    flavor: 'Elle a un certificat. Le tapis de gym sert de paillasson.'
  }),

  // Ligne 4 : Gestionnaire flux → Optimiseur process (2 stades)
  base({
    id: 'qvt-gestionnaire-flux',
    name: 'Gestionnaire flux',
    stage: 'ENTRANT',
    rarity: '2D',
    hp: 75,
    retreat: 1,
    attacks: [{ name: 'Fluidifier', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a fluidifié le process. Le goulot est toujours là.'
  }),
  base({
    id: 'qvt-optimiseur-process',
    evolvesFrom: 'qvt-gestionnaire-flux',
    name: 'Optimiseur process',
    stage: 'N+1',
    rarity: '3D',
    hp: 105,
    retreat: 1,
    ability: { name: 'Flux tendu', text: 'Une fois par tour : attache 1 café à ce Planqué.', kind: 'attachEnergy', oncePerTurn: true },
    attacks: [{ name: 'Kaizen', cost: 2, damage: 50, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }],
    flavor: 'Il a optimisé la réunion. Elle dure maintenant 55 minutes.'
  }),

  // Ligne 5 : Référent QVT → Chef de projet QVT (2 stades)
  base({
    id: 'qvt-referent-qvt',
    name: 'Référent QVT',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Relance', cost: 1, damage: 20 }],
    flavor: 'Il a relancé tout le monde. Personne n\'a répondu.'
  }),
  base({
    id: 'qvt-chef-projet-qvt',
    evolvesFrom: 'qvt-referent-qvt',
    name: 'Chef de projet QVT',
    stage: 'N+1',
    rarity: '2D',
    hp: 95,
    retreat: 1,
    attacks: [
      { name: 'Atelier créatif', cost: 2, damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Restitution', cost: 2, damage: 50 }
    ],
    flavor: 'Le projet est livré. Le compte-rendu est en attente.'
  }),

  // Ligne 6 : Ambassadeur bienveillance → Facilitateur (2 stades)
  base({
    id: 'qvt-ambassadeur-bienveillance',
    name: 'Ambassadeur bienveillance',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Mot doux', cost: 1, damage: 10, text: 'Soigne 10 d\'un de tes Planqués.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a écrit un post-it. Il l\'a collé sur son écran.'
  }),
  base({
    id: 'qvt-facilitateur',
    evolvesFrom: 'qvt-ambassadeur-bienveillance',
    name: 'Facilitateur',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    ability: { name: 'Cadre bienveillant', text: 'Ce Planqué subit 10 dégâts de moins.', kind: 'reduceDamage', amount: 10 },
    attacks: [{ name: 'Icebreaker', cost: 2, damage: 40, text: 'Le Planqué adverse est Dérivé.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }],
    flavor: 'Il a brisé la glace. L\'eau est restée froide.'
  }),

  // Entrants seuls (sans évolution)
  base({
    id: 'qvt-cueilleur-fruits',
    name: 'Cueilleur de fruits',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Panier garni', cost: 1, damage: 10, text: 'Soigne 20 d\'un de tes Planqués.', effects: [{ kind: 'healSelf', amount: 20 }] }],
    flavor: 'Il a cueilli des pommes. Le panier est pour la direction.'
  }),
  base({
    id: 'qvt-organisateur-afterwork',
    name: 'Organisateur afterwork',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Verre de l\'amitié', cost: 1, damage: 20, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a réservé le bar. Le budget est passé en frais de représentation.'
  }),
  base({
    id: 'qvt-yogiste-bureau',
    name: 'Yogiste de bureau',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Posture du lotus', cost: 1, damage: 10 }],
    flavor: 'Elle fait le chien tête en bas. Le PDG fait le paon.'
  }),
  base({
    id: 'qvt-animateur-pause',
    name: 'Animateur pause',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 65,
    retreat: 1,
    attacks: [{ name: 'Café pour tous', cost: 1, damage: 10 }],
    flavor: 'Il a fait le tour des bureaux. La machine est en panne.'
  }),
  base({
    id: 'qvt-decorateur-plantes',
    name: 'Décorateur plantes',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Oxygéner', cost: 1, damage: 10, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }],
    flavor: 'Il a mis un ficus partout. L\'air est toujours vicié.'
  }),
  base({
    id: 'qvt-masseur-assis',
    name: 'Masseur assis',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Shiatsu express', cost: 1, damage: 20 }],
    flavor: 'Il a massé les épaules. Le stress est remonté au cou.'
  })
];

const variant = (baseId: string, id: string, rarity: Card['rarity'], glyph?: string): PlanqueCard => {
  const source = QVT_CARDS.find((card) => card.id === baseId);
  if (!source) throw new Error(`Carte QVT introuvable: ${baseId}`);
  return {
    ...source,
    id,
    rarity,
    variantOf: baseId,
    glyph: glyph ?? source.glyph,
    flavor: source.flavor
  };
};

export const QVT_VARIANTS: Card[] = [
  variant('qvt-happiness-manager', 'qvt-happiness-manager-star', '1S', '✦'),
  variant('qvt-chief-happiness-officer', 'qvt-chief-happiness-officer-star2', '2S', '☺'),
  variant('qvt-responsable-qvt', 'qvt-responsable-qvt-star', '1S', '☁'),
  variant('qvt-directeur-qvt', 'qvt-directeur-qvt-star2', '2S', '✧')
];

export const ALL_QVT_CARDS: Card[] = [...QVT_CARDS, ...QVT_VARIANTS];