import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/**
 * Faction **Atelier** (`ATL`) — Combat, vivier **Atelier** (D-024, D-026).
 * Archétype : aggro / midrange, « gros dégâts, gros Seuil, dégâts au Rack, jeu direct »
 * (`CARD-SPEC.md` §3). Les intitulés sont des postes de terrain, les Pressions des gestes
 * et des outils, les Talents des manies de métier (D-027).
 */

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('ATELIER');

export const ATELIER_CARDS: PlanqueCard[] = [
  // Ligne principale : Apprenti → Technicien de maintenance → Chef d’atelier
  base({
    id: 'atelier-apprenti',
    name: 'Apprenti',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Coup de clé', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il a serré dans le bon sens. Presque.'
  }),
  base({
    id: 'atelier-technicien-maintenance',
    evolvesFrom: 'atelier-apprenti',
    name: 'Technicien de maintenance',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    ability: { name: 'Dépannage', text: 'Une fois par tour : soigne 10 de ce Planqué.', kind: 'heal', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Multimètre', cost: ['ATELIER', 'INCOLORE'], damage: 50 }],
    flavor: 'Il a réparé la machine. Elle marche moins bien.'
  }),
  base({
    id: 'atelier-chef-atelier',
    evolvesFrom: 'atelier-technicien-maintenance',
    name: 'Chef d’atelier',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 3,
    attacks: [
      { name: 'Intervention', cost: ['ATELIER', 'INCOLORE'], damage: 70 },
      { name: 'Gros œuvre', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a un plan. Le plan est une clé de 12.',
    art: 'atelier-chef-atelier.webp'
  }),

  // Ligne 2 : Électricien → Électromécanicien → Responsable maintenance
  base({
    id: 'atelier-electricien',
    name: 'Électricien',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Dénudage', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il a remis le courant. Le compteur tourne à l’envers.'
  }),
  base({
    id: 'atelier-electromecanicien',
    evolvesFrom: 'atelier-electricien',
    name: 'Électromécanicien',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Bobinage', cost: ['ATELIER', 'INCOLORE'], damage: 50 }],
    flavor: 'Il a rebobiné le moteur. Il a rendu l’âme au premier essai.'
  }),
  base({
    id: 'atelier-responsable-maintenance',
    evolvesFrom: 'atelier-electromecanicien',
    name: 'Responsable maintenance',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Plan de maintenance', cost: ['ATELIER', 'INCOLORE'], damage: 60 },
      { name: 'Révision générale', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il planifie la maintenance. La machine attend depuis mars.'
  }),

  // Ligne 3 : Plombier → Tuyauteur → Chef de chantier
  base({
    id: 'atelier-plombier',
    name: 'Plombier',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Soudure', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il a colmaté la fuite. Le plafond est tombé.'
  }),
  base({
    id: 'atelier-tuyauteur',
    evolvesFrom: 'atelier-plombier',
    name: 'Tuyauteur',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Raccordement', cost: ['ATELIER', 'INCOLORE'], damage: 50 }],
    flavor: 'Il a tiré la ligne. Elle arrive dans le mur.'
  }),
  base({
    id: 'atelier-chef-chantier',
    evolvesFrom: 'atelier-tuyauteur',
    name: 'Chef de chantier',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 3,
    attacks: [
      { name: 'Coulage', cost: ['ATELIER', 'INCOLORE'], damage: 70 },
      { name: 'Levage', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a tenu les délais. Le chantier, lui, est en retard.'
  }),

  // Ligne 4 : Ascensoriste → Dépanneur ascenseur (2 stades)
  base({
    id: 'atelier-ascensoriste',
    name: 'Ascensoriste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [
      {
        name: 'Déblocage',
        cost: ['ATELIER'],
        damage: 10,
        text: 'Échange ce Planqué avec un Planqué du Rack.',
        effects: [{ kind: 'switchSelf' }]
      }
    ],
    flavor: 'Il a débloqué la cabine. Elle est bloquée au troisième.'
  }),
  base({
    id: 'atelier-depanneur-ascenseur',
    evolvesFrom: 'atelier-ascensoriste',
    name: 'Dépanneur ascenseur',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    attacks: [
      { name: 'Remise en service', cost: ['ATELIER', 'INCOLORE'], damage: 40, text: 'Soigne 20 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 20 }] }
    ],
    flavor: 'Il a changé le câble. L’ascenseur monte encore plus lentement.'
  }),

  // Ligne 5 : Mécanicien → Mécanicien outilleur (2 stades)
  base({
    id: 'atelier-mecanicien',
    name: 'Mécanicien',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Clé à chocs', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il connaît le bruit par cœur. Il ne connaît pas la référence.'
  }),
  base({
    id: 'atelier-mecanicien-outilleur',
    evolvesFrom: 'atelier-mecanicien',
    name: 'Mécanicien outilleur',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Usinage', cost: ['ATELIER', 'INCOLORE'], damage: 50 }],
    flavor: 'Il a refait la pièce. La pièce n’existe plus au catalogue.'
  }),

  // Ligne 6 : Soudeur → Soudeur TIG (2 stades)
  base({
    id: 'atelier-soudeur',
    name: 'Soudeur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Arc électrique', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il a soudé les deux fers. Il a soudé aussi son gant.'
  }),
  base({
    id: 'atelier-soudeur-tig',
    evolvesFrom: 'atelier-soudeur',
    name: 'Soudeur TIG',
    stage: 'N+1',
    rarity: '3D',
    hp: 110,
    retreat: 2,
    attacks: [
      { name: 'Soudure fine', cost: ['ATELIER', 'INCOLORE'], damage: 50 },
      {
        name: 'Contrôle radio',
        cost: ['ATELIER', 'INCOLORE', 'INCOLORE'],
        damage: 80,
        text: 'Envoie 1 café du Planqué adverse au rebut.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      }
    ],
    flavor: 'Il a fait une soudure invisible. Le contrôle aussi.'
  }),

  // Ligne 7 : Chaudronnier → Chef de fabrication (2 stades)
  base({
    id: 'atelier-chaudronnier',
    name: 'Chaudronnier',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [
      {
        name: 'Pliage',
        cost: ['ATELIER'],
        damage: 10,
        text: 'Ce Planqué subit 10 de moins au prochain tour.',
        effects: [{ kind: 'reduceDamage', amount: 10 }]
      }
    ],
    flavor: 'Il a plié la tôle au millimètre. Le plan, lui, était faux.'
  }),
  base({
    id: 'atelier-chef-fabrication',
    evolvesFrom: 'atelier-chaudronnier',
    name: 'Chef de fabrication',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Gabarit', cost: ['ATELIER', 'INCOLORE'], damage: 50 }],
    flavor: 'Il a suivi le gabarit. Le gabarit ne suivait rien.'
  }),

  // Ligne 8 : Cariste → Chef de quai (2 stades)
  base({
    id: 'atelier-cariste',
    name: 'Cariste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Chariot élévateur', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il a empilé six palettes. La septième est tombée.'
  }),
  base({
    id: 'atelier-chef-quai',
    evolvesFrom: 'atelier-cariste',
    name: 'Chef de quai',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Chargement', cost: ['ATELIER', 'INCOLORE'], damage: 50 }],
    flavor: 'Il a chargé le camion en avance. Ce n’était pas le bon camion.'
  }),

  // Entrants seuls (sans évolution)
  base({
    id: 'atelier-gardien-usine',
    name: 'Gardien d’usine',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    ability: { name: 'Vigilance', text: 'Ce Planqué subit 10 dégâts de moins.', kind: 'reduceDamage', amount: 10 },
    attacks: [{ name: 'Ronde de nuit', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il fait le tour du site. Personne ne fait le tour de lui.'
  }),
  base({
    id: 'atelier-magasinier',
    name: 'Magasinier',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Inventaire', cost: ['ATELIER'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a tout rangé. Il ne trouve plus rien.'
  }),
  base({
    id: 'atelier-stagiaire-atelier',
    name: 'Stagiaire d’atelier',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Coup de main', cost: ['ATELIER'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a tenu le tournevis. C’est déjà un stage.'
  }),
  base({
    id: 'atelier-agent-maintenance',
    name: 'Agent de maintenance',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Graissage', cost: ['ATELIER'], damage: 20 }],
    flavor: 'Il graisse la chaîne. Elle est à sec dans deux jours.'
  }),

  // COMEX : Chef d’atelier ex
  base({
    id: 'atelier-chef-atelier-ex',
    evolvesFrom: 'atelier-technicien-maintenance',
    name: 'Chef d’atelier COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Intervention', cost: ['ATELIER', 'INCOLORE'], damage: 70 },
      { name: 'Gros œuvre', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 120, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Une seule clé de 12.'
  }),

  // Second COMEX (vague 1, #66) : la ligne de maintenance, distincte de la signature.
  base({
    id: 'atelier-responsable-maintenance-ex',
    evolvesFrom: 'atelier-electromecanicien',
    name: 'Responsable maintenance COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 190,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Plan de maintenance', cost: ['ATELIER', 'INCOLORE'], damage: 80 },
      { name: 'Révision générale', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Soigne 10 de tous tes Planqués. Ce Planqué prend 20 de stress.', effects: [{ kind: 'healAll', amount: 10 }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. La machine est révisée. La demande de pièces, non.'
  })
];

export const ATELIER_VARIANTS: Card[] = [
  secretVariant(ATELIER_CARDS, 'atelier-technicien-maintenance', 'star', '⚒'),
  secretVariant(ATELIER_CARDS, 'atelier-electromecanicien', 'star', '⌁'),
  secretVariant(ATELIER_CARDS, 'atelier-depanneur-ascenseur', 'star', '✦'),
  secretVariant(ATELIER_CARDS, 'atelier-tuyauteur', 'star', '◉'),
  secretVariant(ATELIER_CARDS, 'atelier-chef-atelier', 'star2', '⚒'),
  secretVariant(ATELIER_CARDS, 'atelier-responsable-maintenance', 'star2', '✦'),
  secretVariant(ATELIER_CARDS, 'atelier-chef-chantier', 'star2', '⚒'),
  secretVariant(ATELIER_CARDS, 'atelier-apprenti', 'star2', '◉')
];

export const ALL_ATELIER_CARDS: Card[] = [...ATELIER_CARDS, ...ATELIER_VARIANTS];
