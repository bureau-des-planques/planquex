import type { Card, PlanqueCard } from './types';

const PALETTE = 'linear-gradient(155deg, #3d1a5c 0%, #8b5fb0 48%, #1a0a2e 100%)';
const GLYPH = '◉';

const base = (card: Omit<PlanqueCard, 'kind' | 'faction' | 'weakness' | 'palette' | 'glyph'> & { glyph?: string }): PlanqueCard => ({
  ...card,
  kind: 'PLANQUE',
  faction: 'RH',
  weakness: 'DIRECTION',
  palette: PALETTE,
  glyph: card.glyph ?? GLYPH
});

export const RH_CARDS: PlanqueCard[] = [
  // Ligne principale : Assistant RH → Chargé de recrutement → DRH
  base({
    id: 'rh-assistant-rh',
    name: 'Assistant RH',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Entretien', cost: 1, damage: 10, text: "L'adversaire révèle une carte de sa main.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }],
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
    ability: { name: 'Sourcing', text: "Une fois par tour, en jouant : cherche un Planqué dans ton deck, révèle-le, ajoute-le à ta main.", kind: 'draw', amount: 1, oncePerTurn: true },
    attacks: [{ name: "Promesse d'embauche", cost: 2, damage: 40 }],
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
      { name: 'Plan de carrière', cost: 2, damage: 60, text: "L'adversaire défausse 1 carte.", effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: "Entretien annuel", cost: 3, damage: 80, text: "Le Planqué adverse est Dérivé.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: "Il a lu ton CV. Il sait où tu habites."
  }),

  // Deuxième ligne : Recruteur en embuscade → Chasseur de têtes → Directeur des talents
  base({
    id: 'rh-recruteur-embuscade',
    name: 'Recruteur en embuscade',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Approche discrète', cost: 1, damage: 10, text: "L'adversaire défausse 1 carte.", effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: "Il t'a repéré sur LinkedIn. Tu n'es pas en recherche."
  }),
  base({
    id: 'rh-chasseur-tetes',
    evolvesFrom: 'rh-recruteur-embuscade',
    name: 'Chasseur de têtes',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [
      { name: 'Offre mirobolante', cost: 1, damage: 20, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Contre-offre', cost: 2, damage: 50 }
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
      { name: 'Marque employeur', cost: 2, damage: 60, text: "Soigne 20 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 20 }] },
      { name: 'Rétention', cost: 3, damage: 90, text: "Échange ce Planqué avec un Planqué du Rack.", effects: [{ kind: 'switchSelf' }] }
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
    attacks: [{ name: 'Module e-learning', cost: 1, damage: 10, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] }],
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
    attacks: [{ name: 'Certification', cost: 2, damage: 50 }],
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
      { name: 'Université d\'entreprise', cost: 2, damage: 60, text: "Soigne 10 de tous tes Planqués.", effects: [{ kind: 'healAll', amount: 10 }] },
      { name: 'Montée en compétences', cost: 3, damage: 100, text: "Ce Planqué prend 20 de stress.", effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: "Elle a formé l'équipe. L'équipe a formé la concurrence."
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
      { name: 'Prime variable', cost: 1, damage: 20, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Avantages sociaux', cost: 2, damage: 40, text: "Soigne 10 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 10 }] }
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
    attacks: [{ name: 'Clause', cost: 1, damage: 10, text: "Le Planqué adverse est Immobilisé.", effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }],
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
      { name: 'Négociation', cost: 2, damage: 40, text: "L'adversaire défausse 1 carte.", effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Accord d\'entreprise', cost: 2, damage: 50, text: "Soigne 20 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 20 }] }
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
      { name: 'Contentieux', cost: 2, damage: 60, text: "Le Planqué adverse est Dérivé.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] },
      { name: 'Conformité', cost: 3, damage: 90, text: "Ce Planqué subit 10 de moins au prochain tour.", effects: [{ kind: 'reduceDamage', amount: 10 }] }
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
    attacks: [{ name: 'Atelier biais', cost: 1, damage: 10, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] }],
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
    ability: { name: 'Parité', text: "Une fois par tour : échange 1 carte de ta main avec le dessus de ton deck.", kind: 'draw', amount: 1, oncePerTurn: true },
    attacks: [{ name: 'Index égalité', cost: 2, damage: 50 }],
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
      { name: 'Mixité', cost: 2, damage: 60, text: "Soigne 10 de tous tes Planqués.", effects: [{ kind: 'healAll', amount: 10 }] },
      { name: 'Inclusion réelle', cost: 3, damage: 100, text: "Le Planqué adverse est Dérivé.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
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
    attacks: [{ name: 'Mutation', cost: 1, damage: 20, text: "Échange ce Planqué avec un Planqué du Rack.", effects: [{ kind: 'switchSelf' }] }],
    flavor: "Il a validé ta mutation. Le carton est prêt depuis trois mois."
  }),
  base({
    id: 'rh-gestionnaire-rh',
    name: 'Gestionnaire RH',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Dossier', cost: 1, damage: 20 }],
    flavor: "Il a classé le dossier. L'archive a brûlé."
  }),
  base({
    id: 'rh-assistant-paie',
    name: 'Assistant paie',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Virement', cost: 1, damage: 10, text: "Soigne 10 de ce Planqué.", effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: "Il a fait le virement. La banque a bloqué le compte."
  }),
  base({
    id: 'rh-referent-handicap',
    name: 'Référent handicap',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Aménagement', cost: 1, damage: 20, text: "Ce Planqué subit 10 de moins au prochain tour.", effects: [{ kind: 'reduceDamage', amount: 10 }] }],
    flavor: "Il a demandé l'aménagement. La direction a acheté une plante."
  }),
  base({
    id: 'rh-responsable-qvt',
    name: 'Chargé de prévention',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Enquête satisfaction', cost: 1, damage: 10 }],
    flavor: "Il a fait l'enquête. Les résultats sont confidentiels."
  }),
  base({
    id: 'rh-charge-offboarding',
    name: 'Chargé offboarding',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Entretien départ', cost: 1, damage: 20, text: "L'adversaire défausse 1 carte.", effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: "Il a fait l'entretien. Le badge est déjà désactivé."
  }),
  base({
    id: 'rh-charge-sirh',
    name: 'Chargé SIRH',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Export', cost: 1, damage: 10, text: "Pioche 1 carte.", effects: [{ kind: 'draw', amount: 1 }] }],
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
      { name: 'Plan de carrière', cost: 2, damage: 70, text: "L'adversaire défausse 1 carte.", effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: "Entretien annuel", cost: 3, damage: 120, text: "Le Planqué adverse est Dérivé. Ce Planqué prend 20 de stress.", effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: "Deux Interventions. Un seul dossier."
  })
];

const variant = (baseId: string, id: string, rarity: Card['rarity'], glyph?: string): PlanqueCard => {
  const source = RH_CARDS.find((card) => card.id === baseId);
  if (!source) throw new Error(`Carte RH introuvable: ${baseId}`);
  return {
    ...source,
    id,
    rarity,
    variantOf: baseId,
    glyph: glyph ?? source.glyph,
    flavor: source.flavor
  };
};

export const RH_VARIANTS: Card[] = [
  variant('rh-assistant-rh', 'rh-assistant-rh-star', '1S', '◉'),
  variant('rh-charge-recrutement', 'rh-charge-recrutement-star', '1S', '✦'),
  variant('rh-recruteur-embuscade', 'rh-recruteur-embuscade-star', '1S', '☁'),
  variant('rh-chasseur-tetes', 'rh-chasseur-tetes-star', '1S', '✚'),
  variant('rh-drh', 'rh-drh-star2', '2S', '◉'),
  variant('rh-directeur-talents', 'rh-directeur-talents-star2', '2S', '✦'),
  variant('rh-drh-formation', 'rh-drh-formation-star2', '2S', '✚'),
  variant('rh-responsable-comp-ben', 'rh-responsable-comp-ben-star2', '2S', '☘')
];

export const ALL_RH_CARDS: Card[] = [...RH_CARDS, ...RH_VARIANTS];