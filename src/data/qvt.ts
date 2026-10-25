import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('QVT');

export const QVT_CARDS: PlanqueCard[] = [
  // Ligne 1 : Chargé QVT → Happiness Manager → Chief Happiness Officer (échantillon CARD-SPEC.md)
  base({
    id: 'qvt-charge-qvt',
    name: 'Chargé QVT',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Corbeille de fruits', cost: ['QVT'], damage: 10, text: 'Soigne 10 d\'un de tes Planqués.', effects: [{ kind: 'healSelf', amount: 10 }] }],
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
    // Le café va à un Planqué du **Banc** (#165, D-082), pas au Poste : `target: 'rack'`.
    ability: {
      name: 'Bulletin de bonheur',
      text: 'Une fois par tour : attache 1 café à un Planqué du Banc.',
      kind: 'attachEnergy',
      target: 'rack',
      oncePerTurn: true
    },
    attacks: [{ name: 'Afterwork', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
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
      { name: 'Team building', cost: ['QVT', 'INCOLORE'], damage: 60, text: 'Soigne 20 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 20 }] },
      { name: 'Yoga du rire', cost: ['QVT', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse est Dérivé.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: 'Riez. C\'est obligatoire.',
    art: 'qvt-chief-happiness-officer.webp'
  }),

  // Ligne 2 : Animateur bien-être → Responsable QVT → Directeur QVT
  base({
    id: 'qvt-animateur-bien-etre',
    name: 'Animateur bien-être',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Pause active', cost: ['QVT'], damage: 10, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a mis de la musique. La pause est décomptée.',
    art: 'qvt-animateur-bien-etre.webp'
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
    attacks: [{ name: 'Enquête satisfaction', cost: ['QVT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est sondé sur son bien-être. Les réponses sont anonymes, sauf la sienne.' }],
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
      { name: 'Plan d\'action', cost: ['QVT', 'INCOLORE'], damage: 70, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Semaine de la QVT', cost: ['QVT', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Soigne 30 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 30 }] }
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
    attacks: [{ name: 'Étirement', cost: ['QVT'], damage: 20, text: 'Le Planqué adverse est étiré jusqu’à la limite. Le dos craque ; le planning, non.' }],
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
      { name: 'Bilan forme', cost: ['QVT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse passe un bilan de forme. La salle de sport est devenue un bureau, mais le bilan est positif.' },
      { name: 'Programme sur mesure', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Soigne 20 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 20 }] }
    ],
    flavor: 'Elle a un certificat. La salle de sport est devenue un bureau.'
  }),

  // Ligne 4 : Gestionnaire flux → Optimiseur process (2 stades)
  base({
    id: 'qvt-coordinateur-flux',
    name: 'Coordinateur de flux',
    stage: 'ENTRANT',
    rarity: '2D',
    hp: 75,
    retreat: 1,
    attacks: [{ name: 'Fluidifier', cost: ['QVT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a fluidifié le process. Le goulot est toujours là.'
  }),
  base({
    id: 'qvt-optimiseur-process',
    evolvesFrom: 'qvt-coordinateur-flux',
    name: 'Optimiseur process',
    stage: 'N+1',
    rarity: '3D',
    hp: 105,
    retreat: 1,
    ability: { name: 'Flux tendu', text: 'Une fois par tour : attache 1 café à ce Planqué.', kind: 'attachEnergy', oncePerTurn: true },
    attacks: [
      { name: 'Kaizen', cost: ['QVT', 'INCOLORE'], damage: 50, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] },
      { name: 'Chronométrage', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse est Immobilisé.', effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }
    ],
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
    attacks: [{ name: 'Relance', cost: ['QVT'], damage: 20, text: 'Le Planqué adverse est relancé pour remplir le formulaire. Le formulaire n’enregistre rien.' }],
    flavor: 'Il a relancé tout le monde. Le formulaire n\'enregistre rien.'
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
      { name: 'Atelier créatif', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Restitution', cost: ['QVT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse assiste à la restitution du projet. Le compte rendu est en attente de validation.' }
    ],
    flavor: 'Le projet est livré. Le compte-rendu est en attente.'
  }),

  // Ligne 6 : Chargé de mission QVT → Facilitateur (2 stades)
  base({
    id: 'qvt-charge-mission',
    name: 'Chargé de mission QVT',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Mot doux', cost: ['QVT'], damage: 10, text: 'Soigne 10 d\'un de tes Planqués.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il a écrit un post-it. Il l\'a collé sur son écran.',
    art: 'qvt-charge-mission.webp'
  }),
  base({
    id: 'qvt-facilitateur',
    evolvesFrom: 'qvt-charge-mission',
    name: 'Facilitateur',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    ability: { name: 'Cadre bienveillant', text: 'Ce Planqué subit 10 dégâts de moins.', kind: 'reduceDamage', amount: 10 },
    attacks: [{ name: 'Icebreaker', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse est Dérivé.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }],
    flavor: 'Il a brisé la glace. L\'eau est restée froide.'
  }),

  // Entrants seuls (sans évolution)
  base({
    id: 'qvt-charge-logistique',
    name: 'Chargé de logistique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Panier garni', cost: ['QVT'], damage: 10, text: 'Soigne 20 d\'un de tes Planqués.', effects: [{ kind: 'healSelf', amount: 20 }] }],
    flavor: 'Il a monté les palettes au troisième. Le bon de livraison, lui, est resté au quai.'
  }),
  base({
    id: 'qvt-responsable-evenementiel',
    name: 'Responsable événementiel',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Verre de l\'amitié', cost: ['QVT'], damage: 20, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a réservé le bar. Le budget est passé en frais de représentation.'
  }),
  base({
    id: 'qvt-charge-ergonomie',
    name: 'Chargé d\'ergonomie',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Posture du lotus', cost: ['QVT'], damage: 10, text: 'Le Planqué adverse est prié de tenir la posture du lotus. La charge de travail, elle, ne se tient pas.' }],
    flavor: 'Elle tient la posture. La charge de travail, non.'
  }),
  base({
    id: 'qvt-gestionnaire-moyens-generaux',
    name: 'Gestionnaire des moyens généraux',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 65,
    retreat: 1,
    attacks: [{ name: 'Café pour tous', cost: ['QVT'], damage: 10, text: 'Le Planqué adverse a droit à sa tournée. La machine est en panne depuis l’inauguration.' }],
    flavor: 'Il a fait le tour des bureaux. La machine est en panne.',
    art: 'qvt-gestionnaire-moyens-generaux.webp'
  }),
  base({
    id: 'qvt-charge-environnement-travail',
    name: 'Chargé de l\'environnement de travail',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Oxygéner', cost: ['QVT'], damage: 10, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }],
    flavor: 'Il a mis un ficus partout. L\'air est toujours vicié.'
  }),
  base({
    id: 'qvt-masseur-kinesitherapeute',
    name: 'Masseur-kinésithérapeute',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Shiatsu express', cost: ['QVT'], damage: 20, text: 'Le Planqué adverse reçoit un shiatsu de cinq minutes. Le stress descend des épaules et remonte au cou.' }],
    flavor: 'Il a massé les épaules. Le stress est remonté au cou.'
  }),

  // Ligne 7 : Chargé d'intégration → Responsable intégration (2 stades)
  base({
    id: 'qvt-charge-integration',
    name: 'Chargé d\'intégration',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Livret d\'accueil', cost: ['QVT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le livret d\'accueil fait 80 pages. La journée d\'intégration dure une heure.'
  }),
  base({
    id: 'qvt-responsable-integration',
    evolvesFrom: 'qvt-charge-integration',
    name: 'Responsable intégration',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    ability: { name: 'Parrainage', text: 'Une fois par tour : soigne 10 de ce Planqué.', kind: 'heal', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Journée d\'intégration', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'L\'intégration est réussie. Le poste est supprimé.'
  }),

  // Ligne 8 : Conseiller en évolution professionnelle → Responsable développement des compétences
  base({
    id: 'qvt-conseiller-evolution-professionnelle',
    name: 'Conseiller en évolution professionnelle',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Bilan de compétences', cost: ['QVT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Les compétences sont reconnues. Le budget ne l\'est pas.'
  }),
  base({
    id: 'qvt-responsable-developpement-competences',
    evolvesFrom: 'qvt-conseiller-evolution-professionnelle',
    name: 'Responsable développement des compétences',
    stage: 'N+1',
    rarity: '3D',
    hp: 110,
    retreat: 2,
    attacks: [
      { name: 'Plan de formation', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Attestation de formation', cost: ['QVT', 'INCOLORE', 'INCOLORE'], damage: 70, text: 'Soigne 20 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 20 }] }
    ],
    flavor: 'Le plan de formation est validé. Les formations sont reportées.'
  }),

  // Ligne 9 : Consultant QVT → Responsable de l'expérience collaborateur
  base({
    id: 'qvt-consultant-qvt',
    name: 'Consultant QVT',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Diagnostic', cost: ['QVT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le diagnostic est livré. La solution est une autre mission.'
  }),
  base({
    id: 'qvt-responsable-experience-collaborateur',
    evolvesFrom: 'qvt-consultant-qvt',
    name: 'Responsable de l\'expérience collaborateur',
    stage: 'N+1',
    rarity: '2D',
    hp: 105,
    retreat: 1,
    ability: { name: 'Point d\'étape', text: 'Une fois par tour : soigne 10 et retire un statut de ce Planqué.', kind: 'antiStatus', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Entretien de parcours', cost: ['QVT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est reçu pour son entretien de parcours. Le parcours traverse trois directions et aucun bureau.' }],
    flavor: 'Le parcours est fluide. Il traverse trois directions.'
  }),

  // Ligne 10 : Chargé de formation → Chef de projet formation
  base({
    id: 'qvt-charge-formation',
    name: 'Chargé de formation',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Convocation', cost: ['QVT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'La formation est annulée. La convocation est partie.'
  }),
  base({
    id: 'qvt-chef-projet-formation',
    evolvesFrom: 'qvt-charge-formation',
    name: 'Chef de projet formation',
    stage: 'N+1',
    rarity: '2D',
    hp: 95,
    retreat: 1,
    attacks: [
      { name: 'Catalogue', cost: ['QVT', 'INCOLORE'], damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Évaluation à froid', cost: ['QVT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse remplit une évaluation à froid. Le projet est livré ; l’évaluation, jamais lue.' }
    ],
    flavor: 'Le projet est livré. L\'évaluation ne l\'est jamais.'
  }),

  // Ligne 11 : Chargé de l'engagement → Responsable de l'engagement → Chief Happiness Officer COMEX
  base({
    id: 'qvt-charge-engagement',
    name: 'Chargé de l\'engagement',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Baromètre', cost: ['QVT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le baromètre progresse. Le taux de réponse, non.',
    art: 'qvt-charge-engagement.webp'
  }),
  base({
    id: 'qvt-responsable-engagement',
    evolvesFrom: 'qvt-charge-engagement',
    name: 'Responsable de l\'engagement',
    stage: 'N+1',
    rarity: '3D',
    hp: 110,
    retreat: 2,
    attacks: [
      { name: 'Semaine de l\'engagement', cost: ['QVT', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est engagé de force dans l’opération d’engagement. La mesure ne l’engage à rien.' },
      { name: 'Action collective', cost: ['QVT', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse est Immobilisation.', effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }
    ],
    flavor: 'L\'engagement est mesuré. La mesure n\'engage personne.'
  }),
  base({
    id: 'qvt-chief-happiness-officer-ex',
    evolvesFrom: 'qvt-responsable-engagement',
    name: 'Chief Happiness Officer COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Certification du bonheur', cost: ['QVT', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse reçoit sa certification du bonheur. Elle est obligatoire et facturée au service.' },
      { name: 'Facture du bonheur', cost: ['QVT', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Le bonheur est obligatoire. Il est aussi facturé.'
  }),

  // Entrants seuls (suite)
  base({
    id: 'qvt-assistant-qvt',
    name: 'Assistant QVT',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Commande groupée', cost: ['QVT'], damage: 10, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Il commande les fruits. La facture arrive avant eux.',
    art: 'qvt-assistant-qvt.webp'
  }),
  base({
    id: 'qvt-charge-communication-interne',
    name: 'Chargé de communication interne',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Newsletter', cost: ['QVT'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'L\'article est publié. L\'outil d\'envoi est en maintenance.',
    art: 'qvt-charge-communication-interne.webp'
  }),
  base({
    id: 'qvt-charge-evenements-internes',
    name: 'Chargé d\'événements internes',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Pot de départ', cost: ['QVT'], damage: 20, text: 'Le Planqué adverse est convié à un pot de départ. La salle est réservée ; le budget attend toujours sa validation.' }],
    flavor: 'La salle est réservée. Le budget est en attente de validation.'
  }),
  base({
    id: 'qvt-charge-mobilite-interne',
    name: 'Chargé de mobilité interne',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 65,
    retreat: 1,
    attacks: [{ name: 'Mutation', cost: ['QVT'], damage: 10, text: 'Échange ce Planqué avec un Planqué du Banc.', effects: [{ kind: 'switchSelf' }] }],
    flavor: 'Le poste est ouvert. La mobilité est gelée.'
  }),
  base({
    id: 'qvt-charge-vie-associative',
    name: 'Chargé de vie associative',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 55,
    retreat: 1,
    attacks: [{ name: 'Tournoi de babyfoot', cost: ['QVT'], damage: 10, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'Le tournoi est annulé. La coupe est déjà gravée.'
  }),

  // Second COMEX (vague 1, #66) : la ligne du responsable QVT, distincte de la signature.
  base({
    id: 'qvt-directeur-qvt-ex',
    evolvesFrom: 'qvt-responsable-qvt',
    name: 'Directeur QVT COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Plan d\'action', cost: ['QVT', 'INCOLORE'], damage: 70, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Semaine de la QVT', cost: ['QVT', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Soigne 30 de tous tes Planqués. Ce Planqué prend 20 de stress.', effects: [{ kind: 'healAll', amount: 30 }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Une semaine entière à ne rien produire.'
  })
];

export const QVT_VARIANTS: Card[] = [
  secretVariant(QVT_CARDS, 'qvt-happiness-manager', 'star', '✦'),
  secretVariant(QVT_CARDS, 'qvt-chief-happiness-officer', 'star3', '☺'),
  secretVariant(QVT_CARDS, 'qvt-responsable-qvt', 'star', '☁'),
  secretVariant(QVT_CARDS, 'qvt-directeur-qvt', 'star2', '✧'),
  secretVariant(QVT_CARDS, 'qvt-charge-integration', 'star', '✦'),
  secretVariant(QVT_CARDS, 'qvt-consultant-qvt', 'star', '☁'),
  secretVariant(QVT_CARDS, 'qvt-charge-formation', 'star', '✧'),
  secretVariant(QVT_CARDS, 'qvt-charge-communication-interne', 'star', '☺'),
  secretVariant(QVT_CARDS, 'qvt-responsable-integration', 'star2', '✦'),
  secretVariant(QVT_CARDS, 'qvt-responsable-developpement-competences', 'star2', '◉'),
  secretVariant(QVT_CARDS, 'qvt-responsable-engagement', 'star2', '◆'),
  secretVariant(QVT_CARDS, 'qvt-responsable-experience-collaborateur', 'star2', '✚')
];

export const ALL_QVT_CARDS: Card[] = [...QVT_CARDS, ...QVT_VARIANTS];
