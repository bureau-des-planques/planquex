import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

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

/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('SUPPORT');

export const SUPPORT_CARDS: PlanqueCard[] = [
  // Ligne principale (échantillon CARD-SPEC.md) : Agent support → Technicien support → Responsable support
  base({
    id: 'support-agent-support',
    name: 'Agent support',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Ticket', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a ouvert le ticket. Il l’a fermé. Sans réponse.',
    art: 'support-agent-support.webp'
  }),
  base({
    id: 'support-technicien-support',
    evolvesFrom: 'support-agent-support',
    name: 'Technicien support',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    // Talent vendu « en jouant » par `CARD-SPEC.md` §4 (D-074) : recherche d’un Collègue
    // dans le Deck (#161, D-080), la carte trouvée étant révélée au journal, et
    // déclenchement à la mise en jeu (#163, D-081).
    ability: {
      name: 'Escalade',
      text: 'En jouant : cherche un Collègue dans ton deck, révèle-le, ajoute-le à ta main.',
      kind: 'effects',
      trigger: 'onPlay',
      effects: [{ kind: 'search', filter: 'COLLEAGUE' }]
    },
    attacks: [{ name: 'Procédure', cost: ['INCOLORE', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse est renvoyé à la procédure. Avez-vous essayé de redémarrer votre demande ?' }],
    flavor: 'Avez-vous essayé de redémarrer votre demande ?',
    art: 'support-technicien-support.webp'
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
      { name: 'FAQ', cost: ['INCOLORE', 'INCOLORE'], damage: 50, text: 'Pioche 2 cartes.', effects: [{ kind: 'draw', amount: 2 }] },
      { name: 'Chatbot', cost: ['INCOLORE', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse est Dérivé.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }] }
    ],
    flavor: 'Le chatbot a compris. Personne n’a compris le chatbot.',
    art: 'support-responsable-support.webp'
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
      { name: 'FAQ', cost: ['INCOLORE', 'INCOLORE'], damage: 70, text: 'Pioche 2 cartes.', effects: [{ kind: 'draw', amount: 2 }] },
      { name: 'Chatbot', cost: ['INCOLORE', 'INCOLORE', 'INCOLORE'], damage: 120, text: 'Le Planqué adverse est Dérivé. Ce Planqué prend 20 de stress.', effects: [{ kind: 'status', status: 'DERIVE', target: 'opponent' }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Une seule réponse automatique.',
    art: 'support-responsable-support-ex.webp'
  }),

  // Ligne 2 : Standardiste → Assistant de direction → Responsable des services généraux
  base({
    id: 'support-standardiste',
    name: 'Standardiste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Transfert d’appel', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'L’appel est transféré. Le dossier reste sur la ligne.',
    art: 'support-standardiste.webp'
  }),
  base({
    id: 'support-assistant-direction',
    evolvesFrom: 'support-standardiste',
    name: 'Assistant de direction',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Compte rendu', cost: ['INCOLORE', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse reçoit le compte rendu en copie. Il est diffusé à tous et lu par personne.' }],
    flavor: 'Le compte rendu est diffusé. Il n’est pas lu.',
    art: 'support-assistant-direction.webp'
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
      { name: 'Appel d’offres', cost: ['INCOLORE', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse est mis en concurrence. Tous les contrats sont renouvelés ; le service ne change pas.' },
      { name: 'Plan de reprise', cost: ['INCOLORE', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }
    ],
    flavor: 'Il a renouvelé tous les contrats. Le service, lui, n’a pas changé.',
    art: 'support-responsable-services-generaux.webp'
  }),

  // Ligne 3 : Technicien micro-informatique → Administrateur systèmes → Ingénieur systèmes
  base({
    id: 'support-technicien-micro-informatique',
    name: 'Technicien micro-informatique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Réinstallation', cost: ['INCOLORE'], damage: 20, text: 'Le Planqué adverse est réinstallé de zéro. La sauvegarde est incluse ; elle n’a jamais tourné.' }],
    flavor: 'La sauvegarde est incluse. Elle n’a jamais tourné.',
    art: 'support-technicien-micro-informatique.webp'
  }),
  base({
    id: 'support-administrateur-systemes',
    evolvesFrom: 'support-technicien-micro-informatique',
    name: 'Administrateur systèmes',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Sauvegarde', cost: ['INCOLORE', 'INCOLORE'], damage: 40, text: 'Soigne 10 de ce Planqué.', effects: [{ kind: 'healSelf', amount: 10 }] }],
    flavor: 'La sauvegarde est quotidienne. La restauration, jamais testée.',
    art: 'support-administrateur-systemes.webp'
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
      { name: 'Bascule', cost: ['INCOLORE', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse est basculé sur le site de secours. Le plan de continuité tient en une page, la panne en trois.' },
      { name: 'Plan de continuité', cost: ['INCOLORE', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }
    ],
    flavor: 'Le plan de continuité tient en une page. La panne, en trois.',
    art: 'support-ingenieur-systemes.webp'
  }),

  // Ligne 4 : Rédacteur technique → Chargé de documentation → Responsable documentation
  base({
    id: 'support-redacteur-technique',
    name: 'Rédacteur technique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Mode d’emploi', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a écrit la procédure. Elle décrit une version qui n’existe plus.',
    art: 'support-redacteur-technique.webp'
  }),
  base({
    id: 'support-charge-documentation',
    evolvesFrom: 'support-redacteur-technique',
    name: 'Chargé de documentation',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Base de connaissances', cost: ['INCOLORE', 'INCOLORE'], damage: 40, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'La base de connaissances est complète. Elle documente l’ancien logiciel.',
    art: 'support-charge-documentation.webp'
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
      { name: 'Mise à jour', cost: ['INCOLORE', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse reçoit une mise à jour de la documentation. Le produit est déjà passé à la version suivante.' },
      { name: 'Refonte', cost: ['INCOLORE', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }
    ],
    flavor: 'La documentation est validée. Le produit est déjà en v2.',
    art: 'support-responsable-documentation.webp'
  }),

  // Ligne 5 : Technicien réseau → Administrateur réseau (2 stades)
  base({
    id: 'support-technicien-reseau',
    name: 'Technicien réseau',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Câblage', cost: ['INCOLORE'], damage: 20, text: 'Le Planqué adverse est branché sur un câble neuf. La prise, elle, date de l’ouverture du site.' }],
    flavor: 'Le câble est neuf. La prise, non.',
    art: 'support-technicien-reseau.webp'
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
        cost: ['INCOLORE', 'INCOLORE'],
        damage: 40,
        text: 'Ce Planqué subit 10 de moins au prochain tour.',
        effects: [{ kind: 'reduceDamage', amount: 10 }]
      }
    ],
    flavor: 'Le pare-feu bloque tout. Y compris les demandes.',
    art: 'support-administrateur-reseau.webp'
  }),

  // Ligne 6 : Correspondant informatique → Référent informatique (2 stades)
  base({
    id: 'support-correspondant-informatique',
    name: 'Correspondant informatique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Relais', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il remonte l’information. Elle redescend en procédure.',
    art: 'support-correspondant-informatique.webp'
  }),
  base({
    id: 'support-referent-informatique',
    evolvesFrom: 'support-correspondant-informatique',
    name: 'Référent informatique',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Assistance', cost: ['INCOLORE', 'INCOLORE'], damage: 40, text: 'Soigne 10 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 10 }] }],
    flavor: 'Il connaît la solution. Elle n’est pas dans le catalogue.',
    art: 'support-referent-informatique.webp'
  }),

  // Ligne 7 : Assistant méthodes → Technicien méthodes (2 stades)
  base({
    id: 'support-assistant-methodes',
    name: 'Assistant méthodes',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Gamme', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'La gamme est à jour. L’atelier travaille sur l’ancienne.',
    art: 'support-assistant-methodes.webp'
  }),
  base({
    id: 'support-technicien-methodes',
    evolvesFrom: 'support-assistant-methodes',
    name: 'Technicien méthodes',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Mode opératoire', cost: ['INCOLORE', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse suit le mode opératoire à la lettre. Il a été validé sans avoir été essayé.' }],
    flavor: 'Le mode opératoire est validé. Il n’a pas été essayé.',
    art: 'support-technicien-methodes.webp'
  }),

  // Ligne 8 : Formateur informatique → Chargé de formation (2 stades)
  base({
    id: 'support-formateur-informatique',
    name: 'Formateur informatique',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Initiation', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'La formation dure une heure. La licence s’installe en trois.',
    art: 'support-formateur-informatique.webp'
  }),
  base({
    id: 'support-charge-formation-informatique',
    evolvesFrom: 'support-formateur-informatique',
    name: 'Chargé de formation informatique',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [{ name: 'Parcours', cost: ['INCOLORE', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse suit un parcours personnalisé. C’est le même pour tout le monde.' }],
    flavor: 'Le parcours est personnalisé. Tout le monde suit le même.',
    art: 'support-charge-formation-informatique.webp'
  }),

  // Ligne 9 : Gestionnaire de tickets → Superviseur support (2 stades)
  base({
    id: 'support-gestionnaire-tickets',
    name: 'Gestionnaire de tickets',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Tri', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a trié les tickets. Le plus ancien a deux ans.',
    art: 'support-gestionnaire-tickets.webp'
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
      { name: 'Reporting', cost: ['INCOLORE', 'INCOLORE'], damage: 50, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Escalade', cost: ['INCOLORE', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }
    ],
    flavor: 'Le ticket est escaladé. Il redescend sans réponse.',
    art: 'support-superviseur-support.webp'
  }),

  // Entrants seuls (sans évolution)
  base({
    id: 'support-assistant-administratif',
    name: 'Assistant administratif',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Saisie', cost: ['INCOLORE'], damage: 20, text: 'Le Planqué adverse est saisi dans le formulaire. Le formulaire perd la demande, pas la rancune.' }],
    flavor: 'Il saisit les demandes. Le formulaire les perd.',
    art: 'support-assistant-administratif.webp'
  }),
  base({
    id: 'support-archiviste',
    name: 'Archiviste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Archivage', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Tout est archivé. Plus rien n’est retrouvé.',
    art: 'support-archiviste.webp'
  }),
  base({
    id: 'support-receptionniste',
    name: 'Réceptionniste',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Accueil', cost: ['INCOLORE'], damage: 20, text: 'Le Planqué adverse est accueilli au comptoir. Son badge ne s’ouvre sur aucune porte.' }],
    flavor: 'Il accueille les visiteurs. Le badge ne s’ouvre pas.',
    art: 'support-receptionniste.webp'
  }),
  base({
    id: 'support-teleconseiller',
    name: 'Téléconseiller',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Script', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le script prévoit tout. Sauf la question.',
    art: 'support-teleconseiller.webp'
  }),
  base({
    id: 'support-operateur-saisie',
    name: 'Opérateur de saisie',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Frappe', cost: ['INCOLORE'], damage: 20, text: 'Le Planqué adverse encaisse une frappe rapide. Le système répond moins vite que le clavier.' }],
    flavor: 'Il tape plus vite que le système ne répond.',
    art: 'support-operateur-saisie.webp'
  }),
  base({
    id: 'support-testeur-logiciel',
    name: 'Testeur logiciel',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Recette', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a testé le cas normal. La production, non.',
    art: 'support-testeur-logiciel.webp'
  }),
  base({
    id: 'support-coordinateur-support',
    name: 'Coordinateur support',
    stage: 'ENTRANT',
    rarity: '2D',
    hp: 70,
    retreat: 1,
    attacks: [
      { name: 'Planning', cost: ['INCOLORE'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Revue de tickets', cost: ['INCOLORE', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse passe en revue de tickets. Les files d’attente avancent en parallèle et ne se rejoignent jamais.' }
    ],
    flavor: 'Il coordonne les files d’attente. Elles ne se rejoignent jamais.',
    art: 'support-coordinateur-support.webp'
  }),

  // Second COMEX (vague 1, #66) : la ligne des systèmes, distincte de la signature.
  base({
    id: 'support-ingenieur-systemes-ex',
    evolvesFrom: 'support-administrateur-systemes',
    name: 'Ingénieur systèmes COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 180,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Bascule', cost: ['INCOLORE', 'INCOLORE'], damage: 70, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Plan de continuité', cost: ['INCOLORE', 'INCOLORE', 'INCOLORE'], damage: 110, text: 'Soigne 20 de tous tes Planqués. Ce Planqué prend 20 de stress.', effects: [{ kind: 'healAll', amount: 20 }, { kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Deux Interventions. Le plan de continuité tient sur une seule page.',
    art: 'support-ingenieur-systemes-ex.webp'
  })
];

export const SUPPORT_VARIANTS: Card[] = [
  secretVariant(SUPPORT_CARDS, 'support-technicien-support', 'star', '⌘'),
  secretVariant(SUPPORT_CARDS, 'support-administrateur-systemes', 'star', '✦'),
  secretVariant(SUPPORT_CARDS, 'support-charge-documentation', 'star', '◉'),
  secretVariant(SUPPORT_CARDS, 'support-superviseur-support', 'star', '☁'),
  secretVariant(SUPPORT_CARDS, 'support-responsable-support', 'star2', '⌘'),
  secretVariant(SUPPORT_CARDS, 'support-ingenieur-systemes', 'star2', '✦'),
  secretVariant(SUPPORT_CARDS, 'support-responsable-documentation', 'star2', '◉'),
  secretVariant(SUPPORT_CARDS, 'support-responsable-services-generaux', 'star2', '☁')
];

export const ALL_SUPPORT_CARDS: Card[] = [...SUPPORT_CARDS, ...SUPPORT_VARIANTS];
