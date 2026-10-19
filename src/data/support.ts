import type { Card, PlanqueCard } from './types';

const PALETTE = 'linear-gradient(155deg, #083a3a 0%, #4f9d9d 48%, #071a1a 100%)';
const GLYPH = '⌘';

/**
 * Faction **Support** (`SUP`) — Incolore, vivier **Étage** (D-024, D-026).
 * Archétype : midrange / contrôle, « polyvalent, pioche, recherche » (`CARD-SPEC.md` §3).
 * Les intitulés sont des postes réels de helpdesk et de services généraux, les Pressions
 * des tâches et des documents de travail, le Talent une compétence de métier (D-027).
 *
 * 30 bases + 8 variantes = **38 entrées** (`PROPOSITION.md` §4.3). Stades Entrant → N+1 →
 * N+2 ; COMEX `ex: true` en 4D valant 2 Interventions (D-020) ; Seuil par stade/rareté et
 * dégâts par café conformes à `CARD-SPEC.md` §2 (D-021, D-023).
 */
const base = (card: Omit<PlanqueCard, 'kind' | 'faction' | 'weakness' | 'palette' | 'glyph'> & { glyph?: string }): PlanqueCard => ({
  ...card,
  kind: 'PLANQUE',
  faction: 'SUPPORT',
  weakness: 'ATELIER',
  palette: PALETTE,
  glyph: card.glyph ?? GLYPH
});

export const SUPPORT_CARDS: PlanqueCard[] = [
  // Ligne principale (échantillon CARD-SPEC.md) : Agent support → Technicien support → Responsable support
  base({
    id: 'support-agent-support',
    name: 'Agent support',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Ticket', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a ouvert le ticket. Il l’a fermé. Sans réponse.'
  }),
  base({
    id: 'support-technicien-support',
    evolvesFrom: 'support-agent-support',
    name: 'Technicien support',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Prise en main', text: 'Une fois par tour : soigne 10 de ce Planqué.', kind: 'heal', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Procédure', cost: 2, damage: 40 }],
    flavor: 'Avez-vous essayé de redémarrer votre demande ?'
  }),
  base({
    id: 'support-responsable-support',
    evolvesFrom: 'support-technicien-support',
    name: 'Responsable support',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'FAQ', cost: 2, damage: 50, text: 'Pioche 2 cartes.', effects: [{ kind: 'draw', amount: 2 }] },
      { name: 'Chatbot', cost: 3, damage: 80, text: 'Le Planqué adverse est Dérivé.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: 'Le chatbot a compris. Personne n’a compris le chatbot.'
  }),
  base({
    id: 'support-responsable-support-ex',
    evolvesFrom: 'support-technicien-support',
    name: 'Responsable support COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'FAQ', cost: 2, damage: 70, text: 'Pioche 2 cartes.', effects: [{ kind: 'draw', amount: 2 }] },
      { name: 'Chatbot', cost: 3, damage: 120, text: 'Le Planqué adverse est Dérivé. Ce Planqué prend 20 de stress.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Une seule réponse automatique.'
  }),

  // Ligne 2 : Standardiste → Assistant de direction → Responsable des services généraux
  base({
    id: 'support-standardiste',
    name: 'Standardiste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Transfert d’appel', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'L’appel est transféré. Le dossier reste sur la ligne.'
  }),
  base({
    id: 'support-assistant-direction',
    evolvesFrom: 'support-standardiste',
    name: 'Assistant de direction',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Compte rendu', cost: 2, damage: 50 }],
    flavor: 'Le compte rendu est diffusé. Il n’est pas lu.'
  }),
  base({
    id: 'support-responsable-services-generaux',
    evolvesFrom: 'support-assistant-direction',
    name: 'Responsable des services généraux',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Appel d’offres', cost: 2, damage: 60 },
      { name: 'Plan de reprise', cost: 3, damage: 90, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }
    ],
    flavor: 'Il a renouvelé tous les contrats. Le service, lui, n’a pas changé.'
  }),

  // Ligne 3 : Technicien micro-informatique → Administrateur systèmes → Ingénieur systèmes
  base({
    id: 'support-technicien-micro-informatique',
    name: 'Technicien micro-informatique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Réinstallation', cost: 1, damage: 20 }],
    flavor: 'La sauvegarde est incluse. Elle n’a jamais tourné.'
  }),
  base({
    id: 'support-administrateur-systemes',
    evolvesFrom: 'support-technicien-micro-informatique',
    name: 'Administrateur systèmes',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Sauvegarde', cost: 2, damage: 40, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'La sauvegarde est quotidienne. La restauration, jamais testée.'
  }),
  base({
    id: 'support-ingenieur-systemes',
    evolvesFrom: 'support-administrateur-systemes',
    name: 'Ingénieur systèmes',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Bascule', cost: 2, damage: 60 },
      { name: 'Plan de continuité', cost: 3, damage: 90, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }
    ],
    flavor: 'Le plan de continuité tient en une page. La panne, en trois.'
  }),

  // Ligne 4 : Rédacteur technique → Chargé de documentation → Responsable documentation
  base({
    id: 'support-redacteur-technique',
    name: 'Rédacteur technique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Mode d’emploi', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a écrit la procédure. Elle décrit une version qui n’existe plus.'
  }),
  base({
    id: 'support-charge-documentation',
    evolvesFrom: 'support-redacteur-technique',
    name: 'Chargé de documentation',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Base de connaissances', cost: 2, damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'La base de connaissances est complète. Elle documente l’ancien logiciel.'
  }),
  base({
    id: 'support-responsable-documentation',
    evolvesFrom: 'support-charge-documentation',
    name: 'Responsable documentation',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Mise à jour', cost: 2, damage: 50 },
      { name: 'Refonte', cost: 3, damage: 90, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }
    ],
    flavor: 'La documentation est validée. Le produit est déjà en v2.'
  }),

  // Ligne 5 : Technicien réseau → Administrateur réseau (2 stades)
  base({
    id: 'support-technicien-reseau',
    name: 'Technicien réseau',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Câblage', cost: 1, damage: 20 }],
    flavor: 'Le câble est neuf. La prise, non.'
  }),
  base({
    id: 'support-administrateur-reseau',
    evolvesFrom: 'support-technicien-reseau',
    name: 'Administrateur réseau',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [
      {
        name: 'Filtrage',
        cost: 2,
        damage: 40,
        text: 'Ce Planqué subit 10 de moins au prochain tour.',
        effects: [{ kind: 'reduceDamage', amount: 10 }]
      }
    ],
    flavor: 'Le pare-feu bloque tout. Y compris les demandes.'
  }),

  // Ligne 6 : Correspondant informatique → Référent informatique (2 stades)
  base({
    id: 'support-correspondant-informatique',
    name: 'Correspondant informatique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Relais', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il remonte l’information. Elle redescend en procédure.'
  }),
  base({
    id: 'support-referent-informatique',
    evolvesFrom: 'support-correspondant-informatique',
    name: 'Référent informatique',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Assistance', cost: 2, damage: 40, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }],
    flavor: 'Il connaît la solution. Elle n’est pas dans le catalogue.'
  }),

  // Ligne 7 : Assistant méthodes → Technicien méthodes (2 stades)
  base({
    id: 'support-assistant-methodes',
    name: 'Assistant méthodes',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Gamme', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'La gamme est à jour. L’atelier travaille sur l’ancienne.'
  }),
  base({
    id: 'support-technicien-methodes',
    evolvesFrom: 'support-assistant-methodes',
    name: 'Technicien méthodes',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Mode opératoire', cost: 2, damage: 50 }],
    flavor: 'Le mode opératoire est validé. Il n’a pas été essayé.'
  }),

  // Ligne 8 : Formateur informatique → Chargé de formation (2 stades)
  base({
    id: 'support-formateur-informatique',
    name: 'Formateur informatique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Initiation', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'La formation dure une heure. La licence s’installe en trois.'
  }),
  base({
    id: 'support-charge-formation-informatique',
    evolvesFrom: 'support-formateur-informatique',
    name: 'Chargé de formation informatique',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Parcours', cost: 2, damage: 50 }],
    flavor: 'Le parcours est personnalisé. Tout le monde suit le même.'
  }),

  // Ligne 9 : Gestionnaire de tickets → Superviseur support (2 stades)
  base({
    id: 'support-gestionnaire-tickets',
    name: 'Gestionnaire de tickets',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Tri', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a trié les tickets. Le plus ancien a deux ans.'
  }),
  base({
    id: 'support-superviseur-support',
    evolvesFrom: 'support-gestionnaire-tickets',
    name: 'Superviseur support',
    stage: 'N+1',
    rarity: '3D',
    hp: 110,
    retreat: 2,
    attacks: [
      { name: 'Reporting', cost: 2, damage: 50, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Escalade', cost: 3, damage: 80, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Le ticket est escaladé. Il redescend sans réponse.'
  }),

  // Entrants seuls (sans évolution)
  base({
    id: 'support-assistant-administratif',
    name: 'Assistant administratif',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Saisie', cost: 1, damage: 20 }],
    flavor: 'Il saisit les demandes. Le formulaire les perd.'
  }),
  base({
    id: 'support-archiviste',
    name: 'Archiviste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Archivage', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Tout est archivé. Plus rien n’est retrouvé.'
  }),
  base({
    id: 'support-receptionniste',
    name: 'Réceptionniste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Accueil', cost: 1, damage: 20 }],
    flavor: 'Il accueille les visiteurs. Le badge ne s’ouvre pas.'
  }),
  base({
    id: 'support-teleconseiller',
    name: 'Téléconseiller',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Script', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le script prévoit tout. Sauf la question.'
  }),
  base({
    id: 'support-operateur-saisie',
    name: 'Opérateur de saisie',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Frappe', cost: 1, damage: 20 }],
    flavor: 'Il tape plus vite que le système ne répond.'
  }),
  base({
    id: 'support-testeur-logiciel',
    name: 'Testeur logiciel',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Recette', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a testé le cas normal. La production, non.'
  }),
  base({
    id: 'support-coordinateur-support',
    name: 'Coordinateur support',
    stage: 'ENTRANT',
    rarity: '2D',
    hp: 70,
    retreat: 1,
    attacks: [
      { name: 'Planning', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Revue de tickets', cost: 2, damage: 40 }
    ],
    flavor: 'Il coordonne les files d’attente. Elles ne se rejoignent jamais.'
  })
];

const variant = (baseId: string, id: string, rarity: Card['rarity'], glyph?: string): PlanqueCard => {
  const source = SUPPORT_CARDS.find((card) => card.id === baseId);
  if (!source) throw new Error(`Carte Support introuvable: ${baseId}`);
  return {
    ...source,
    id,
    rarity,
    variantOf: baseId,
    glyph: glyph ?? source.glyph,
    flavor: source.flavor
  };
};

export const SUPPORT_VARIANTS: Card[] = [
  variant('support-technicien-support', 'support-technicien-support-star', '1S', '⌘'),
  variant('support-administrateur-systemes', 'support-administrateur-systemes-star', '1S', '✦'),
  variant('support-charge-documentation', 'support-charge-documentation-star', '1S', '◉'),
  variant('support-superviseur-support', 'support-superviseur-support-star', '1S', '☁'),
  variant('support-responsable-support', 'support-responsable-support-star2', '2S', '⌘'),
  variant('support-ingenieur-systemes', 'support-ingenieur-systemes-star2', '2S', '✦'),
  variant('support-responsable-documentation', 'support-responsable-documentation-star2', '2S', '◉'),
  variant('support-responsable-services-generaux', 'support-responsable-services-generaux-star2', '2S', '☁')
];

export const ALL_SUPPORT_CARDS: Card[] = [...SUPPORT_CARDS, ...SUPPORT_VARIANTS];
