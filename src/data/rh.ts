import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('RH');

export const RH_CARDS: PlanqueCard[] = [
  // Ligne principale : Assistant RH → Chargé de recrutement → DRH
  base({
    id: 'rh-assistant-rh',
    name: 'Assistant RH',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    // L’effet vendu (CARD-SPEC.md §4) est la révélation d’une carte de la main adverse
    // (#160, D-078) ; le statut Dérivé n’était pas annoncé par le texte.
    attacks: [{ name: 'Entretien', cost: ['RH'], damage: 10, text: 'L’adversaire révèle une carte de sa main.', effects: [{ kind: 'reveal', target: 'opponent', amount: 1 }] }],
    flavor: "Il a posé la question. Il n'a pas écouté la réponse."
  }),
  base({
    id: 'rh-charge-recrutement',
    evolvesFrom: 'rh-assistant-rh',
    name: 'Chargé de recrutement',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    // Talent vendu « en jouant » par `CARD-SPEC.md` §4 (D-074) : recherche d’un Planqué
    // dans le Deck (#161, D-080), la carte trouvée étant révélée au journal, et
    // déclenchement à la mise en jeu (#163, D-081).
    ability: {
      name: 'Sourcing',
      text: 'En jouant : cherche un Planqué dans ton deck, révèle-le, ajoute-le à ta main.',
      kind: 'effects',
      trigger: 'onPlay',
      effects: [{ kind: 'search', filter: 'PLANQUE' }]
    },
    attacks: [{ name: "Promesse d'embauche", cost: ['RH', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse reçoit une promesse d’embauche. Le poste est passionnant ; le salaire est confidentiel.' }],
    flavor: "Le poste est passionnant. Le salaire est confidentiel."
  }),
  base({
    id: 'rh-drh',
    evolvesFrom: 'rh-charge-recrutement',
    name: 'DRH',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      // « L’adversaire défausse 1 carte » (CARD-SPEC.md §4) : une carte de la main, au hasard
      // (#159, D-076) — plus un café comme avant.
      { name: 'Plan de carrière', cost: ['RH', 'INCOLORE'], damage: 60, text: 'L’adversaire défausse 1 carte.', effects: [{ kind: 'discardHand', target: 'opponent', amount: 1 }] },
      { name: "Entretien annuel", cost: ['RH', 'INCOLORE', 'INCOLORE'], damage: 80, text: "Le Planqué adverse est Dérivé.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: "Il a lu ton CV. Il sait où tu habites.",
    art: 'rh-drh.webp'
  }),

  // Deuxième ligne : Chargé de sourcing → Chasseur de têtes → Directeur des talents
  base({
    id: 'rh-charge-sourcing',
    name: 'Chargé de sourcing',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Approche discrète', cost: ['RH'], damage: 10, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il t’a repéré sur un réseau professionnel. Tu n’es pas en recherche.'
  }),
  base({
    id: 'rh-chasseur-tetes',
    evolvesFrom: 'rh-charge-sourcing',
    name: 'Chasseur de têtes',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [
      { name: 'Offre mirobolante', cost: ['RH'], damage: 20, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Contre-offre', cost: ['RH', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse reçoit une contre-offre inespérée. Elle expirera avant la fin de son préavis.' }
    ],
    flavor: "Il double ton salaire. La direction triple son budget café."
  }),
  base({
    id: 'rh-directeur-talents',
    evolvesFrom: 'rh-chasseur-tetes',
    name: 'Directeur des talents',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Marque employeur', cost: ['RH', 'INCOLORE'], damage: 60, text: "Soigne 20 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 20 }] },
      { name: 'Rétention', cost: ['RH', 'INCOLORE', 'INCOLORE'], damage: 90, text: "Échange ce Planqué avec un Planqué du Banc.", effects: [{ kind: 'switchSelf' }] }
    ],
    flavor: "Il garde les meilleurs. Les autres partent en intérim."
  }),

  // Troisième ligne : Gestionnaire formation → Responsable formation → DRH formation
  base({
    id: 'rh-gestionnaire-formation',
    name: 'Gestionnaire formation',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Module e-learning', cost: ['RH'], damage: 10, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: "Il a validé ta formation. Le lien est mort depuis 2019."
  }),
  base({
    id: 'rh-responsable-formation',
    evolvesFrom: 'rh-gestionnaire-formation',
    name: 'Responsable formation',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    ability: { name: 'Plan de développement', text: "Une fois par tour : soigne 10 d'un Planqué.", kind: 'heal', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Certification', cost: ['RH', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est envoyé en certification. Le budget a servi à acheter des licences que personne n’utilise.' }],
    flavor: "Il a un budget. Il l'a dépensé en licences inutilisées."
  }),
  base({
    id: 'rh-drh-formation',
    evolvesFrom: 'rh-responsable-formation',
    name: 'DRH Formation',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Université d\'entreprise', cost: ['RH', 'INCOLORE'], damage: 60, text: "Soigne 10 de tous tes Planqués.", effects: [{ kind: 'healAll', amount: 10 }] },
      { name: 'Montée en compétences', cost: ['RH', 'INCOLORE', 'INCOLORE'], damage: 100, text: "Ce Planqué prend 20 de stress.", effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: "Elle a formé l'équipe. Le plan de formation a expiré."
  }),

  // Quatrième ligne : Chargé paie → Responsable comp & ben → DRH rémunération
  base({
    id: 'rh-responsable-comp-ben',
    name: 'Responsable Comp & Ben',
    stage: 'ENTRANT',
    rarity: '2D',
    hp: 70,
    retreat: 1,
    attacks: [
      { name: 'Prime variable', cost: ['RH'], damage: 20, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Avantages sociaux', cost: ['RH', 'INCOLORE'], damage: 40, text: "Soigne 10 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 10 }] }
    ],
    flavor: "Il a négocié la mutuelle. Elle ne rembourse pas les lunettes."
  }),

  // Cinquième ligne : Juriste social → Responsable relations sociales → DRH juridique
  base({
    id: 'rh-juriste-social',
    name: 'Juriste social',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Clause', cost: ['RH'], damage: 10, text: "Le Planqué adverse est Immobilisé.", effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }],
    flavor: "Il a lu le code du travail. Il l'utilise comme oreiller."
  }),
  base({
    id: 'rh-responsable-relations-sociales',
    evolvesFrom: 'rh-juriste-social',
    name: 'Responsable relations sociales',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    attacks: [
      { name: 'Négociation', cost: ['RH', 'INCOLORE'], damage: 40, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Accord d\'entreprise', cost: ['RH', 'INCOLORE'], damage: 50, text: "Soigne 20 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 20 }] }
    ],
    flavor: "Il a signé l'accord. Les syndicats ont signé le procès-verbal."
  }),
  base({
    id: 'rh-drh-juridique',
    evolvesFrom: 'rh-responsable-relations-sociales',
    name: 'DRH Juridique',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Contentieux', cost: ['RH', 'INCOLORE'], damage: 60, text: "Le Planqué adverse est Dérivé.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] },
      { name: 'Conformité', cost: ['RH', 'INCOLORE', 'INCOLORE'], damage: 90, text: "Ce Planqué subit 10 de moins au prochain tour.", effects: [{ kind: 'reduceDamage', amount: 10 }] }
    ],
    flavor: "Il a gagné le procès. L'entreprise a payé les frais."
  }),

  // Sixième ligne : Chargé diversité → Responsable inclusion → DRH diversité
  base({
    id: 'rh-charge-diversite',
    name: 'Chargé diversité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Atelier biais', cost: ['RH'], damage: 10, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: "Il a fait l'atelier. Les biais sont revenus au café."
  }),
  base({
    id: 'rh-responsable-inclusion',
    evolvesFrom: 'rh-charge-diversite',
    name: 'Responsable inclusion',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    ability: { name: 'Parité', text: 'Une fois par tour : pioche 1 carte.', kind: 'draw', amount: 1, oncePerTurn: true },
    attacks: [{ name: 'Index égalité', cost: ['RH', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse est classé dans l’index égalité. La direction fête déjà les 99 sur 100.' }],
    flavor: "Elle a publié l'index. La direction a fêté les 99/100."
  }),
  base({
    id: 'rh-drh-diversite',
    evolvesFrom: 'rh-responsable-inclusion',
    name: 'DRH Diversité',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Mixité', cost: ['RH', 'INCOLORE'], damage: 60, text: "Soigne 10 de tous tes Planqués.", effects: [{ kind: 'healAll', amount: 10 }] },
      { name: 'Inclusion réelle', cost: ['RH', 'INCOLORE', 'INCOLORE'], damage: 100, text: "Le Planqué adverse est Dérivé.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: "Elle a changé les panneaux. Les portes sont restées fermées."
  }),

  // Cartes Entrant seules (sans évolution)
  base({
    id: 'rh-charge-mobilite',
    name: 'Chargé mobilité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Mutation', cost: ['RH'], damage: 20, text: "Échange ce Planqué avec un Planqué du Banc.", effects: [{ kind: 'switchSelf' }] }],
    flavor: "Il a validé ta mutation. Le carton est prêt depuis trois mois."
  }),
  base({
    id: 'rh-gestionnaire-rh',
    name: 'Gestionnaire RH',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Dossier', cost: ['RH'], damage: 20, text: 'Le Planqué adverse est classé au dossier. L’archive a brûlé, mais la procédure de classement est intacte.' }],
    flavor: "Il a classé le dossier. L'archive a brûlé."
  }),
  base({
    id: 'rh-assistant-paie',
    name: 'Assistant paie',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Virement', cost: ['RH'], damage: 10, text: "Soigne 10 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: "Il a fait le virement. La banque a bloqué le compte."
  }),
  base({
    id: 'rh-referent-handicap',
    name: 'Référent handicap',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Aménagement', cost: ['RH'], damage: 20, text: "Ce Planqué subit 10 de moins au prochain tour.", effects: [{ kind: 'reduceDamage', amount: 10 }] }],
    flavor: "Il a demandé l'aménagement. La direction a acheté une plante."
  }),
  base({
    id: 'rh-charge-prevention',
    name: 'Chargé de prévention',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Enquête satisfaction', cost: ['RH'], damage: 10, text: 'Le Planqué adverse répond à l’enquête de satisfaction. Les résultats sont confidentiels, même pour lui.' }],
    flavor: 'Il a rempli le questionnaire de prévention. Personne n’a coché « risque ».'
  }),
  base({
    id: 'rh-charge-offboarding',
    name: 'Chargé offboarding',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Entretien départ', cost: ['RH'], damage: 20, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: "Il a fait l'entretien. Le badge est déjà désactivé."
  }),
  base({
    id: 'rh-charge-sirh',
    name: 'Chargé SIRH',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Export', cost: ['RH'], damage: 10, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: "Il a fait l'export. Le fichier fait 2 Go."
  }),

  // COMEX : DRH ex
  base({
    id: 'rh-drh-ex',
    evolvesFrom: 'rh-charge-recrutement',
    name: 'DRH COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Plan de carrière', cost: ['RH', 'INCOLORE'], damage: 70, text: 'L’adversaire défausse 1 carte.', effects: [{ kind: 'discardHand', target: 'opponent', amount: 1 }] },
      { name: "Entretien annuel", cost: ['RH', 'INCOLORE', 'INCOLORE'], damage: 120, text: "Le Planqué adverse est Dérivé. Ce Planqué prend 20 de stress.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: "Deux Interventions. Un seul dossier."
  }),

  // Second COMEX (vague 1, #66) : la ligne du recrutement, distincte de la signature.
  base({
    id: 'rh-directeur-talents-ex',
    evolvesFrom: 'rh-chasseur-tetes',
    name: 'Directeur des talents COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Marque employeur', cost: ['RH', 'INCOLORE'], damage: 70, text: 'Soigne 20 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 20 }] },
      { name: 'Rétention', cost: ['RH', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Échange ce Planqué avec un Planqué du Banc. Le Planqué adverse est Dérivé.', effects: [{ kind: 'switchSelf' }, { kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: 'Deux Interventions. Le talent est parti avant la signature.'
  })
];

export const RH_VARIANTS: Card[] = [
  secretVariant(RH_CARDS, 'rh-assistant-rh', 'star', '◉'),
  secretVariant(RH_CARDS, 'rh-charge-recrutement', 'star', '✦'),
  secretVariant(RH_CARDS, 'rh-charge-sourcing', 'star', '☁'),
  secretVariant(RH_CARDS, 'rh-chasseur-tetes', 'star', '✚'),
  secretVariant(RH_CARDS, 'rh-drh', 'crown', '◉'),
  secretVariant(RH_CARDS, 'rh-directeur-talents', 'star2', '✦'),
  secretVariant(RH_CARDS, 'rh-drh-formation', 'star2', '✚'),
  secretVariant(RH_CARDS, 'rh-responsable-comp-ben', 'star2', '☘')
];

export const ALL_RH_CARDS: Card[] = [...RH_CARDS, ...RH_VARIANTS];
