import type { Card, PlanqueCard } from './types';
import { planqueBase, secretVariant } from './planque';

/**
 * Amélioration continue (code `AC`, vivier **Étage**, D-024/D-026) — Électricité.
 * Archétype : tempo / contrôle, « dégâts étalés, gel » (`CARD-SPEC.md` §3).
 *
 * 18 base + 7 variantes = **25 entrées** (`PROPOSITION.md` §4.3). Stades Entrant → N+1 → N+2,
 * COMEX `ex: true` en 4D valant 2 Interventions (D-020) ; Seuil par stade/rareté et dégâts
 * par café conformes à `CARD-SPEC.md` §2 (D-021, D-023) ; noms de postes réels (D-027).
 */
/** Le socle de faction (#54) : identité, vulnérabilité, dégradé et glyphe. */
const base = planqueBase('AMELIORATION');

export const AMELIORATION_CARDS: PlanqueCard[] = [
  base({
    id: 'amelioration-charge-qualite',
    name: 'Chargé qualité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Checklist', cost: ['AMELIORATION'], damage: 10, text: 'Regarde la carte du dessus de ton deck.', effects: [{ kind: 'peek' }] }],
    flavor: 'Il a coché la case. La case ne sert à rien.',
    art: 'amelioration-charge-qualite.webp'
  }),
  base({
    id: 'amelioration-auditeur-qualite',
    evolvesFrom: 'amelioration-charge-qualite',
    name: 'Auditeur qualité',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    // Talent vendu « en jouant » par `CARD-SPEC.md` §4 (D-074) : défausse de la main
    // (#159, D-076), révélation de la main adverse (#160, D-078) et déclenchement à la
    // mise en jeu (#163, D-081).
    ability: {
      name: 'Audit',
      text: 'En jouant : défausse 1 carte, l’adversaire révèle sa main.',
      kind: 'effects',
      trigger: 'onPlay',
      effects: [
        { kind: 'discardHand', target: 'self', amount: 1 },
        { kind: 'reveal', target: 'opponent' }
      ]
    },
    attacks: [{ name: 'Non-conformité', cost: ['AMELIORATION', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse est déclaré non conforme. La fiche d’écart le désigne ; le process, lui, reste hors de cause.' }],
    flavor: 'Il a trouvé un problème. Le problème, c’est le process.',
    art: 'amelioration-auditeur-qualite.webp'
  }),
  base({
    id: 'amelioration-directeur-qualite',
    evolvesFrom: 'amelioration-auditeur-qualite',
    name: 'Directeur qualité',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Tableau de bord', cost: ['AMELIORATION', 'INCOLORE'], damage: 60, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Norme ISO', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Le Planqué adverse est Immobilisé.', effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }
    ],
    flavor: 'Le process est conforme. Le produit est cassé.',
    art: 'amelioration-directeur-qualite.webp'
  }),
  base({
    id: 'amelioration-consultant-lean',
    name: 'Consultant Lean',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Diagnostic', cost: ['AMELIORATION'], damage: 20, text: 'Le Planqué adverse reçoit un diagnostic en deux jours. Le rapport était rédigé avant la visite.' }],
    flavor: 'Il a tout vu en deux jours. Le rapport était écrit avant.',
    art: 'amelioration-consultant-lean.webp'
  }),
  base({
    id: 'amelioration-responsable-process',
    evolvesFrom: 'amelioration-consultant-lean',
    name: 'Responsable process',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 1,
    ability: { name: 'Standardisation', text: 'Ce Planqué subit 10 dégâts de moins.', kind: 'reduceDamage', amount: 10 },
    attacks: [{ name: 'Revue de processus', cost: ['AMELIORATION', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse passe en revue de processus. Il sort de la réunion avec une étape de plus à documenter.' }],
    flavor: 'Il a écrit le process. Le process a écrit sa journée.'
  }),
  base({
    id: 'amelioration-responsable-amelioration-continue',
    evolvesFrom: 'amelioration-responsable-process',
    name: 'Responsable amélioration continue',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Chantier Lean', cost: ['AMELIORATION', 'INCOLORE'], damage: 60, text: 'Un chantier Lean s’abat sur le Planqué adverse. Objectif : zéro défaut, zéro production.' },
      { name: 'Zéro défaut', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Soigne 20 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 20 }] }
    ],
    flavor: 'Zéro défaut. Zéro production.'
  }),
  base({
    id: 'amelioration-gestionnaire-flux',
    name: 'Gestionnaire de flux',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Lissage', cost: ['AMELIORATION'], damage: 20, text: 'Le Planqué adverse est lissé pour entrer dans la courbe. La courbe, elle, ne bouge pas.' }],
    flavor: 'Il a lissé la charge. Le planning a doublé tout seul.'
  }),
  base({
    id: 'amelioration-responsable-flux',
    evolvesFrom: 'amelioration-gestionnaire-flux',
    name: 'Responsable flux',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [
      { name: 'Ordonnancement', cost: ['AMELIORATION', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse est réordonnancé en urgence. Le client a annulé pendant la réunion.' },
      { name: 'Rattrapage', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse doit rattraper tout le retard d’un coup. Le retard, lui, vient d’être reporté.' }
    ],
    flavor: 'Il a débloqué la ligne. Le client avait annulé.'
  }),
  base({
    id: 'amelioration-directeur-flux',
    evolvesFrom: 'amelioration-responsable-flux',
    name: 'Directeur des flux',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Plan de charge', cost: ['AMELIORATION', 'INCOLORE'], damage: 60, text: 'Le Planqué adverse reçoit un plan de charge. Le stock, lui, attend devant la porte.' },
      { name: 'Accélération', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 90, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a accéléré le flux. Le stock attend devant.',
    art: 'amelioration-directeur-flux.webp'
  }),
  base({
    id: 'amelioration-auditeur-interne',
    name: 'Auditeur interne',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Prélèvement', cost: ['AMELIORATION'], damage: 10, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il a prélevé un échantillon. L’échantillon est introuvable.',
    art: 'amelioration-auditeur-interne.webp'
  }),
  base({
    id: 'amelioration-responsable-audit',
    evolvesFrom: 'amelioration-auditeur-interne',
    name: 'Responsable audit',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Plan d’actions', text: 'Une fois par tour : soigne 10 et retire un statut.', kind: 'antiStatus', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Écart majeur', cost: ['AMELIORATION', 'INCOLORE'], damage: 50, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il a ouvert un écart. L’écart est resté ouvert.'
  }),
  base({
    id: 'amelioration-directeur-audit-interne',
    evolvesFrom: 'amelioration-responsable-audit',
    name: 'Directeur de l’audit interne',
    stage: 'N+2',
    rarity: '3D',
    hp: 150,
    retreat: 2,
    attacks: [
      { name: 'Revue de direction', cost: ['AMELIORATION', 'INCOLORE'], damage: 60, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Écart critique', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 100, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a audité l’audit. L’audit a été reporté.',
    art: 'amelioration-directeur-audit-interne.webp'
  }),
  base({
    id: 'amelioration-charge-amelioration',
    name: 'Chargé d’amélioration continue',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Kaizen', cost: ['AMELIORATION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le progrès continue. Le poste, non.',
    art: 'amelioration-charge-amelioration.webp'
  }),
  base({
    id: 'amelioration-charge-process',
    evolvesFrom: 'amelioration-charge-amelioration',
    name: 'Chargé de process',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    attacks: [
      { name: 'Analyse de la valeur', cost: ['AMELIORATION', 'INCOLORE'], damage: 40, text: 'Le Planqué adverse est analysé étape par étape. Une étape disparaît ; deux autres arrivent.' },
      { name: 'Goulot d’étranglement', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 70, text: 'Le Planqué adverse est Immobilisé.', effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }
    ],
    flavor: 'Il a supprimé une étape. On en a ajouté deux.',
    art: 'amelioration-charge-process.webp'
  }),
  base({
    id: 'amelioration-controleur-qualite',
    name: 'Contrôleur qualité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Contrôle', cost: ['AMELIORATION'], damage: 20, text: 'Le Planqué adverse est contrôlé à la pièce. Quarante vérifiées, quatre cents en attente.' }],
    flavor: 'Il a contrôlé quarante pièces. Il en reste quatre cents.',
    art: 'amelioration-controleur-qualite.webp'
  }),
  base({
    id: 'amelioration-chef-projet-qualite',
    evolvesFrom: 'amelioration-controleur-qualite',
    name: 'Chef de projet qualité',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [
      { name: 'Jalons', cost: ['AMELIORATION', 'INCOLORE'], damage: 50, text: 'Le Planqué adverse franchit un jalon qualité. Le jalon est passé ; le dossier, non.' },
      { name: 'Recette', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 80, text: 'Le Planqué adverse passe en recette. La liste des réserves est plus longue que le cahier des charges.' }
    ],
    flavor: 'Le jalon est passé. Le dossier, non.',
    art: 'amelioration-chef-projet-qualite.webp'
  }),
  base({
    id: 'amelioration-stagiaire-qualite',
    name: 'Stagiaire qualité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Relevé', cost: ['AMELIORATION'], damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Relevé terminé. L’action corrective est reportée.'
  }),
  base({
    id: 'amelioration-directeur-qualite-ex',
    evolvesFrom: 'amelioration-auditeur-qualite',
    name: 'Directeur qualité COMEX',
    stage: 'N+2',
    rarity: '4D',
    hp: 170,
    retreat: 3,
    ex: true,
    attacks: [
      { name: 'Audit flash', cost: ['AMELIORATION', 'INCOLORE'], damage: 70, text: 'Un audit flash s’abat sur le Planqué adverse. Il dure une heure, le rapport un trimestre.' },
      { name: 'Certification', cost: ['AMELIORATION', 'INCOLORE', 'INCOLORE'], damage: 120, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'On a amélioré le process d’amélioration.'
  })
];

export const AMELIORATION_VARIANTS: Card[] = [
  secretVariant(AMELIORATION_CARDS, 'amelioration-auditeur-qualite', 'star', '↻'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-responsable-process', 'star', '⌁'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-responsable-audit', 'star', '☰'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-chef-projet-qualite', 'star', '✦'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-directeur-qualite', 'star3', '↻'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-responsable-amelioration-continue', 'star2', '◉'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-directeur-flux', 'star2', '⌁')
];

export const ALL_AMELIORATION_CARDS: Card[] = [...AMELIORATION_CARDS, ...AMELIORATION_VARIANTS];
