import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/**
 * Faction **Atelier** (`ATL`) — Combat, vivier **Atelier** (D-024, D-026).
 * Archétype : aggro / midrange, « gros dégâts, gros Seuil, dégâts au Banc, jeu direct »
 * (`CARD-SPEC.md` §3). Les intitulés sont des postes de l'atelier d'optronique ; les Pressions,
 * des gestes et des outils ; les Talents, des manies de métier (D-027).
 */

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('ATELIER');

export const ATELIER_CARDS: PlanqueCard[] = [
  // Ligne 1 : Joueur de flûte → Technicien système → Responsable process
  base({
    id: 'atelier-joueur-de-flute',
    name: 'Joueur de flûte',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Mélodie', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse entend une mélodie de réunion. Personne n’a demandé la suite.' }],
    flavor: 'Il joue pendant la réunion de lancement. Personne ne l’a invité.',
    art: 'atelier-joueur-de-flute.webp'
  }),
  base({
    id: 'atelier-technicien-systeme',
    evolvesFrom: 'atelier-joueur-de-flute',
    name: 'Technicien système',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    ability: { name: 'Mise à jour', text: 'Une fois par tour : soigne 10 de ce Planqué.', kind: 'heal', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Redémarrage à froid', cost: ['ATELIER', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse redémarre à froid. Les données, elles, ne sont pas sauvegardées.' }],
    flavor: 'Il redémarre le serveur. Pour voir.',
    art: 'atelier-technicien-systeme.webp'
  }),
  base({
    id: 'atelier-responsable-process',
    evolvesFrom: 'atelier-technicien-systeme',
    name: 'Responsable process d’atelier',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 3,
    attacks: [
      { name: 'Procédure', cost: ['ATELIER', 'INCOLORE'], damage: 70, text: 'Le Planqué adverse reçoit une procédure. Elle n’a pas été relue.' },
      { name: 'Revue de process', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a une procédure pour tout. Aucune n’est à jour.',
    art: 'atelier-responsable-process.webp'
  }),

  // Ligne 2 : Opticien → RPO → RUI
  base({
    id: 'atelier-opticien',
    name: 'Opticien',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Réglage', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse est réglé au tournevis. La mesure, elle, est faite sur tableur.' }],
    flavor: 'Il règle la lunette à la main. La mesure est faite sur tableur.',
    art: 'atelier-opticien.webp'
  }),
  base({
    id: 'atelier-rpo',
    evolvesFrom: 'atelier-opticien',
    name: 'RPO',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Relance', cost: ['ATELIER', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est relancé pour un point d’avancement. Le point est reporté à la semaine suivante.' }],
    flavor: 'Il pilote la production depuis une réunion. La production l’a oublié.',
    art: 'atelier-rpo.webp'
  }),
  base({
    id: 'atelier-rui',
    evolvesFrom: 'atelier-rpo',
    name: 'RUI',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Plan d’unité', cost: ['ATELIER', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse reçoit le plan de l’unité. L’unité n’a pas été consultée.' },
      { name: 'Visite de l’unité', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Responsable de l’unité. L’unité ne l’a jamais croisé.',
    art: 'atelier-rui.webp'
  }),

  // Ligne 3 : Régleur → RPI → Responsable flux
  base({
    id: 'atelier-regleur',
    name: 'Régleur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Calage', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse est calé au millimètre. Le millimètre n’était pas étalonné.' }],
    flavor: 'Il règle au millimètre. Le millimètre n’était pas étalonné.',
    art: 'atelier-regleur.webp'
  }),
  base({
    id: 'atelier-rpi',
    evolvesFrom: 'atelier-regleur',
    name: 'RPI',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Interface', cost: ['ATELIER', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est branché sur l’interface commune. Personne n’a validé l’interface.' }],
    flavor: 'Il a un sigle, une salle, et un ordre du jour pour la salle.',
    art: 'atelier-rpi.webp'
  }),
  base({
    id: 'atelier-responsable-flux',
    evolvesFrom: 'atelier-rpi',
    name: 'Responsable flux d’atelier',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 3,
    attacks: [
      { name: 'Dispatch', cost: ['ATELIER', 'INCOLORE'], damage: 70, text: 'Le Planqué adverse est envoyé dans un autre flux. Le flux précédent, lui, est resté bloqué.' },
      { name: 'Réorganisation', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Ce Planqué prend 20 de stress. Le flux est réorganisé, pas le retard.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il fait circuler les flux. Les flux, eux, ne circulent pas.',
    art: 'atelier-responsable-flux.webp'
  }),

  // Ligne 4 : Contrôleur vibration → Responsable qualité
  base({
    id: 'atelier-controleur-vibration',
    name: 'Contrôleur vibration',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [
      {
        name: 'Essai sous vibration',
        cost: ['ATELIER'],
        damage: 10,
        text: 'Échange ce Planqué avec un Planqué du Banc. L’essai a été décalé au lundi.',
        effects: [{ kind: 'switchSelf' }]
      }
    ],
    flavor: 'Il secoue la pièce. La validation attend l’essai du lundi.',
    art: 'atelier-controleur-vibration.webp'
  }),
  base({
    id: 'atelier-responsable-qualite',
    evolvesFrom: 'atelier-controleur-vibration',
    name: 'Responsable qualité',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    attacks: [
      { name: 'Non-conformité', cost: ['ATELIER', 'INCOLORE'], damage: 40, text: 'Soigne 20 de ce Planqué. La non-conformité, elle, reste ouverte.', effects: [{ kind: 'healSelf', amount: 20 }] }
    ],
    flavor: 'Une non-conformité attend sa signature depuis le printemps.',
    art: 'atelier-responsable-qualite.webp'
  }),

  // Ligne 5 : Mécanicien → Gestionnaire FOD
  base({
    id: 'atelier-mecanicien',
    name: 'Mécanicien',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Clé à chocs', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse reçoit une rafale de clé à chocs. Le bruit est connu ; la référence de la pièce, non.' }],
    flavor: 'Il connaît le bruit par cœur. Il ne connaît pas la référence.',
    art: 'atelier-mecanicien.webp'
  }),
  base({
    id: 'atelier-gestionnaire-fod',
    evolvesFrom: 'atelier-mecanicien',
    name: 'Gestionnaire FOD',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Ramassage', cost: ['ATELIER', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est ramassé avec la vis qu’il a perdue. La vis, elle, est toujours introuvable.' }],
    flavor: 'Il ramasse les vis perdues. Il ne retrouve jamais la sienne.',
    art: 'atelier-gestionnaire-fod.webp'
  }),

  // Ligne 6 : Monteur optique → Technicien de banc d'essai
  base({
    id: 'atelier-monteur-optique',
    name: 'Monteur optique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Montage', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse est monté de travers. La lentille, elle, est à l’envers.' }],
    flavor: 'Il a monté la lentille à l’endroit. Le miroir, lui, est à l’envers.',
    art: 'atelier-monteur-optique.webp'
  }),
  base({
    id: 'atelier-technicien-banc-essai',
    evolvesFrom: 'atelier-monteur-optique',
    name: 'Technicien de banc d’essai',
    stage: 'N+1',
    rarity: '3D',
    hp: 110,
    retreat: 2,
    attacks: [
      { name: 'Test de banc', cost: ['ATELIER', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse subit un test. Le test a été validé par son propre auteur.' },
      {
        name: 'Contrôle du banc',
        cost: ['ATELIER', 'INCOLORE', 'INCOLORE'],
        damage: 80,
        text: 'Envoie 1 café du Planqué adverse au rebut. Le contrôle a été fait ailleurs.',
        effects: [{ kind: 'discardEnergy', target: 'opponent' }]
      }
    ],
    flavor: 'Il a validé le banc. Le banc a validé son propre test.',
    art: 'atelier-technicien-banc-essai.webp'
  }),

  // Ligne 7 : Pointeur → Ordonnanceur → Responsable de pôle
  base({
    id: 'atelier-pointeur',
    name: 'Pointeur',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [
      {
        name: 'Pointage',
        cost: ['ATELIER'],
        damage: 10,
        text: 'Ce Planqué subit 10 de moins au prochain tour. La cote a été arrondie.',
        effects: [{ kind: 'reduceDamage', amount: 10 }]
      }
    ],
    flavor: 'Il pointe la cote au micron. La cote, elle, a été arrondie en réunion.',
    art: 'atelier-pointeur.webp'
  }),
  base({
    id: 'atelier-ordonnanceur',
    evolvesFrom: 'atelier-pointeur',
    name: 'Ordonnanceur',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Planning', cost: ['ATELIER', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est replanifié. Le planning avait déjà été replanifié.' }],
    flavor: 'Il ordonne tout, sauf le planning.'
  }),
  base({
    id: 'atelier-responsable-pole',
    evolvesFrom: 'atelier-ordonnanceur',
    name: 'Responsable de pôle',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 3,
    attacks: [
      { name: 'Objectif de pôle', cost: ['ATELIER', 'INCOLORE'], damage: 70, text: 'Le Planqué adverse reçoit un objectif de pôle. Le pôle compte trente personnes.' },
      { name: 'Revue du pôle', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Ce Planqué prend 20 de stress. Le pôle est revu, les personnes non.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il dirige un pôle de trente personnes. Il les reconnaît à leur badge.'
  }),

  // Ligne 8 : Cariste de salle blanche → Planificateur des moyens d'essai
  base({
    id: 'atelier-cariste-salle-blanche',
    name: 'Cariste de salle blanche',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Sas', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse traverse le sas. Le sas a sonné, personne n’a répondu.' }],
    flavor: 'Il a traversé la salle blanche avec des chaussures de chantier. Le sas a sonné.'
  }),
  base({
    id: 'atelier-planificateur-moyens-essai',
    evolvesFrom: 'atelier-cariste-salle-blanche',
    name: 'Planificateur des moyens d’essai',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Réservation', cost: ['ATELIER', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est réservé pour lundi. Le créneau est pris depuis mars.' }],
    flavor: 'Il a réservé le banc pour lundi. Le banc est réservé depuis mars.'
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
    attacks: [{ name: 'Ronde de nuit', cost: ['ATELIER'], damage: 20, text: 'Une ronde de nuit tombe sur le Planqué adverse. Le registre de passage est signé, et vide.' }],
    flavor: 'Il fait le tour du site. Personne ne fait le tour de lui.',
    art: 'atelier-gardien-usine.webp'
  }),
  base({
    id: 'atelier-magasinier',
    name: 'Magasinier',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Inventaire', cost: ['ATELIER'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a tout rangé. Il ne trouve plus rien.',
    art: 'atelier-magasinier.webp'
  }),
  base({
    id: 'atelier-assistant-rpo',
    name: 'Assistant RPO',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Compte rendu', cost: ['ATELIER'], damage: 10, text: 'Pioche 1 carte. Le compte rendu part au RPO.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il assiste le RPO depuis trois ans. Personne ne sait lequel assiste l’autre.'
  }),
  base({
    id: 'atelier-agent-maintenance',
    name: 'Agent de maintenance',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Graissage', cost: ['ATELIER'], damage: 20, text: 'Le Planqué adverse glisse sur une couche de graisse. Le bidon était resté ouvert sur l’établi.' }],
    flavor: 'Il graisse la chaîne. Elle est à sec dans deux jours.',
    art: 'atelier-agent-maintenance.webp'
  }),

  // COMEX (D-026) : le statut reste affiché ; le nom porte le jeu de mots (D-095).
  base({
    id: 'atelier-rpo-sans-rui-ex',
    evolvesFrom: 'atelier-technicien-systeme',
    name: 'RPO sans RUI',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Procédure supprimée', cost: ['ATELIER', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse subit une procédure supprimée. La procédure, elle, a survécu.' },
      { name: 'Décision seule', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 120, text: 'Ce Planqué prend 20 de stress. La décision a été prise sans le RUI.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Il a supprimé le RUI. La procédure, elle, a survécu.'
  }),
  base({
    id: 'atelier-rui-non-toxique-ex',
    evolvesFrom: 'atelier-rpo',
    name: 'RUI non toxique',
    stage: 'N+2',
    rarity: '4D',
    hp: 190,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Plan de l’unité', cost: ['ATELIER', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse reçoit le plan de l’unité. L’unité n’a pas été consultée.' },
      { name: 'Bonne humeur', cost: ['ATELIER', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Soigne 10 de tous tes Planqués. Ce Planqué prend 20 de stress.', effects: [{ kind: 'healAll', amount: 10 }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Il valide l’unité depuis le parking. Personne ne lui a dit qu’il était toxique.'
  })
];

export const ATELIER_VARIANTS: Card[] = [
  secretVariant(ATELIER_CARDS, 'atelier-technicien-systeme', 'star', '⚒'),
  secretVariant(ATELIER_CARDS, 'atelier-rpo', 'star', '⌁'),
  secretVariant(ATELIER_CARDS, 'atelier-responsable-qualite', 'star', '✦'),
  secretVariant(ATELIER_CARDS, 'atelier-rpi', 'star', '◉'),
  secretVariant(ATELIER_CARDS, 'atelier-responsable-process', 'star3', '⚒'),
  secretVariant(ATELIER_CARDS, 'atelier-rui', 'star2', '✦'),
  secretVariant(ATELIER_CARDS, 'atelier-responsable-flux', 'star2', '⚒'),
  secretVariant(ATELIER_CARDS, 'atelier-joueur-de-flute', 'star2', '◉')
];

export const ALL_ATELIER_CARDS: Card[] = [...ATELIER_CARDS, ...ATELIER_VARIANTS];
