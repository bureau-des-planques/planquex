import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('SSE');

export const SSE_CARDS: PlanqueCard[] = [
  base({
    id: 'sse-infirmier-site',
    name: 'Infirmier de site',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Pansement', cost: ['SSE'], damage: 10, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a lu la notice. En diagonale.'
  }),
  base({
    id: 'sse-infirmiere-travail',
    evolvesFrom: 'sse-infirmier-site',
    name: 'Infirmière du travail',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Prévention', text: 'Une fois par tour : soigne 10 d’un Planqué.', kind: 'heal', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Piqûre de rappel', cost: ['SSE', 'INCOLORE'], damage: 40 }],
    flavor: 'Elle sait où tu as mal avant toi.'
  }),
  base({
    id: 'sse-medecin-travail',
    evolvesFrom: 'sse-infirmiere-travail',
    name: 'Médecin du travail',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Arrêt de travail', cost: ['SSE', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse est en Sieste.', effects: [{ kind: 'status', status: 'SIESTE', target: 'opponent' }] },
      { name: 'Bilan de santé', cost: ['SSE', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Soigne 20 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 20 }] }
    ],
    flavor: 'Il a signé. Tu ne reviens pas avant lundi.'
  }),
  base({
    id: 'sse-preventeur',
    name: 'Préventeur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Inspection', cost: ['SSE'], damage: 20 }],
    flavor: 'Il a coché la case. La case ne sert à rien.'
  }),
  base({
    id: 'sse-ergonome',
    evolvesFrom: 'sse-preventeur',
    name: 'Ergonome',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    ability: { name: 'Posture', text: 'Ce Planqué subit 10 dégâts de moins.', kind: 'reduceDamage', amount: 10 },
    attacks: [{ name: 'Réglage', cost: ['SSE', 'INCOLORE'], damage: 40 }],
    flavor: 'Il a réglé la chaise. Ton dos attend encore.'
  }),
  base({
    id: 'sse-responsable-sse',
    evolvesFrom: 'sse-ergonome',
    name: 'Responsable SSE',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Rapport d’incident', cost: ['SSE', 'INCOLORE'], damage: 60, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Plan de prévention', cost: ['SSE', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }
    ],
    flavor: 'Il a écrit le protocole. Personne ne l’applique.'
  }),
  base({
    id: 'sse-kine-travail',
    name: 'Kiné du travail',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Manipulation', cost: ['SSE'], damage: 20 }],
    flavor: 'Il a massé l’épaule. Le problème est ailleurs.'
  }),
  base({
    id: 'sse-sophrologue',
    evolvesFrom: 'sse-kine-travail',
    name: 'Sophrologue',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Respiration', text: 'Une fois par tour : soigne 10 et retire un statut.', kind: 'antiStatus', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Relaxation', cost: ['SSE', 'INCOLORE'], damage: 40 }],
    flavor: 'Respire. Le Rack est encore là.'
  }),
  base({
    id: 'sse-medecin-chef',
    evolvesFrom: 'sse-sophrologue',
    name: 'Médecin-chef',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Diagnostic', cost: ['SSE', 'INCOLORE'], damage: 60 },
      { name: 'Protocole', cost: ['SSE', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Ce Planqué prend 10 de stress.', effects: [{ kind: 'selfDamage', amount: 10 }] }
    ],
    flavor: 'Il a diagnostiqué le management. C’est grave.'
  }),
  base({
    id: 'sse-secouriste',
    name: 'Secouriste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Massage cardiaque', cost: ['SSE'], damage: 20 }],
    flavor: 'Il a couru. L’ascenseur était en panne.'
  }),
  base({
    id: 'sse-chef-secours',
    evolvesFrom: 'sse-secouriste',
    name: 'Chef de secours',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Intervention', cost: ['SSE', 'INCOLORE'], damage: 50, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a sauvé la réunion. Pas le patient.'
  }),
  base({
    id: 'sse-agent-entretien',
    name: 'Agent d’entretien',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Serpillière', cost: ['SSE'], damage: 10, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il a nettoyé. La direction a sali.'
  }),
  base({
    id: 'sse-responsable-hygiene',
    evolvesFrom: 'sse-agent-entretien',
    name: 'Responsable hygiène',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Protocole', cost: ['SSE', 'INCOLORE'], damage: 40 }],
    flavor: 'Il a écrit le protocole d’hygiène. En trois exemplaires.'
  }),
  base({
    id: 'sse-psychologue',
    name: 'Psychologue du travail',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Écoute', cost: ['SSE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a écouté. C’était déjà beaucoup.'
  }),
  base({
    id: 'sse-psychiatre',
    evolvesFrom: 'sse-psychologue',
    name: 'Psychiatre du travail',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Diagnostic', cost: ['SSE', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse est Dérivé.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }],
    flavor: 'Il a prescrit des vacances. Refusées.'
  }),
  base({
    id: 'sse-dieteticien',
    name: 'Diététicien',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Menu équilibré', cost: ['SSE'], damage: 10, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a équilibré le menu. La cantine a ajouté du gras.'
  }),
  base({
    id: 'sse-nutritionniste',
    evolvesFrom: 'sse-dieteticien',
    name: 'Nutritionniste',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Régime', cost: ['SSE', 'INCOLORE'], damage: 40, text: 'Soigne 20 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 20 }] }],
    flavor: 'Il a remplacé le sucre par la stevia. Personne n’a vu la différence.'
  }),
  base({
    id: 'sse-interne',
    name: 'Interne',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Garde', cost: ['SSE'], damage: 20 }],
    flavor: 'Il est interne. Il fait le travail de trois médecins.'
  }),
  base({
    id: 'sse-infirmier-volant',
    name: 'Infirmier volant',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Remplacement', cost: ['SSE'], damage: 20, text: 'Échange ce Planqué avec un Planqué du Rack.', effects: [{ kind: 'switchSelf' }] }],
    flavor: 'Il remplace tout le monde. Personne ne le remplace.'
  }),
  base({
    id: 'sse-pompier-volontaire',
    name: 'Pompier volontaire',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Extincteur', cost: ['SSE'], damage: 20 }],
    flavor: 'Il éteint les incendies. On lui demande de les prévenir.'
  }),
  base({
    id: 'sse-medecin-sport',
    name: 'Médecin du sport',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Bandage', cost: ['SSE'], damage: 10, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il soigne les entorses des autres.'
  }),
  base({
    id: 'sse-assistante-sociale',
    name: 'Assistante sociale',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Dossier', cost: ['SSE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Elle a ouvert le dossier. Le dossier s’est refermé.'
  }),
  base({
    id: 'sse-controleur-securite',
    name: 'Contrôleur de sécurité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Vérification', cost: ['SSE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il vérifie les issues de secours. Elles sont bloquées.'
  }),
  base({
    id: 'sse-brancardier',
    name: 'Brancardier',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Transport', cost: ['SSE'], damage: 20 }],
    flavor: 'Il transporte. Il ne juge pas.'
  }),
  base({
    id: 'sse-medecin-legiste',
    name: 'Médecin légiste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Autopsie', cost: ['SSE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a vu pire. C’était la réunion d’hier.'
  }),
  base({
    id: 'sse-medecin-chef-ex',
    evolvesFrom: 'sse-sophrologue',
    name: 'Médecin-chef COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 170,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Diagnostic', cost: ['SSE', 'INCOLORE'], damage: 70 },
      { name: 'Protocole', cost: ['SSE', 'INCOLORE', 'INCOLORE'], damage: 120, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Un seul médecin.'
  }),

  // Second COMEX (vague 1, #66) : la ligne de prévention, distincte de la signature.
  base({
    id: 'sse-responsable-sse-ex',
    evolvesFrom: 'sse-ergonome',
    name: 'Responsable SSE COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Rapport d’incident', cost: ['SSE', 'INCOLORE'], damage: 70, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Plan de prévention', cost: ['SSE', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Soigne 30 de tous tes Planqués. Ce Planqué prend 20 de stress.', effects: [{ kind: 'healAll', amount: 30 }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Le plan de prévention est arrivé après l’incident.'
  })
];

export const SSE_VARIANTS: Card[] = [
  secretVariant(SSE_CARDS, 'sse-infirmiere-travail', 'star', '✚'),
  secretVariant(SSE_CARDS, 'sse-ergonome', 'star', '⌁'),
  secretVariant(SSE_CARDS, 'sse-sophrologue', 'star', '☁'),
  secretVariant(SSE_CARDS, 'sse-chef-secours', 'star', '✚'),
  secretVariant(SSE_CARDS, 'sse-responsable-hygiene', 'star', '✦'),
  secretVariant(SSE_CARDS, 'sse-psychiatre', 'star', '◉'),
  secretVariant(SSE_CARDS, 'sse-medecin-travail', 'star2', '✚'),
  secretVariant(SSE_CARDS, 'sse-responsable-sse', 'star2', '✦'),
  secretVariant(SSE_CARDS, 'sse-medecin-chef', 'star2', '✚'),
  secretVariant(SSE_CARDS, 'sse-psychologue', 'star2', '◉'),
  secretVariant(SSE_CARDS, 'sse-nutritionniste', 'star2', '☘')
];

export const ALL_SSE_CARDS: Card[] = [...SSE_CARDS, ...SSE_VARIANTS];
