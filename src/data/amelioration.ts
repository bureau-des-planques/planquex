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
    attacks: [{ name: 'Checklist', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Il a coché la case. La case ne sert à rien.'
  }),
  base({
    id: 'amelioration-auditeur-qualite',
    evolvesFrom: 'amelioration-charge-qualite',
    name: 'Auditeur qualité',
    stage: 'N+1',
    rarity: '2D',
    hp: 90,
    retreat: 1,
    ability: { name: 'Audit', text: 'Une fois par tour : soigne 10 de ce Planqué.', kind: 'heal', amount: 10, oncePerTurn: true },
    attacks: [{ name: 'Non-conformité', cost: 2, damage: 40 }],
    flavor: 'Il a trouvé un problème. Le problème, c’est le process.'
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
      { name: 'Tableau de bord', cost: 2, damage: 60, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] },
      { name: 'Norme ISO', cost: 3, damage: 90, text: 'Le Planqué adverse est Immobilisé.', effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }
    ],
    flavor: 'Le process est conforme. Le produit est cassé.'
  }),
  base({
    id: 'amelioration-consultant-lean',
    name: 'Consultant Lean',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Diagnostic', cost: 1, damage: 20 }],
    flavor: 'Il a tout vu en deux jours. Le rapport était écrit avant.'
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
    attacks: [{ name: 'Revue de processus', cost: 2, damage: 50 }],
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
      { name: 'Chantier Lean', cost: 2, damage: 60 },
      { name: 'Zéro défaut', cost: 3, damage: 90, text: 'Soigne 20 de tous tes Planqués.', effects: [{ kind: 'healAll', amount: 20 }] }
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
    attacks: [{ name: 'Lissage', cost: 1, damage: 20 }],
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
      { name: 'Ordonnancement', cost: 2, damage: 40 },
      { name: 'Rattrapage', cost: 3, damage: 80 }
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
      { name: 'Plan de charge', cost: 2, damage: 60 },
      { name: 'Accélération', cost: 3, damage: 90, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a accéléré le flux. Le stock attend devant.'
  }),
  base({
    id: 'amelioration-auditeur-interne',
    name: 'Auditeur interne',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Prélèvement', cost: 1, damage: 10, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
    flavor: 'Il a prélevé un échantillon. L’échantillon est introuvable.'
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
    attacks: [{ name: 'Écart majeur', cost: 2, damage: 50, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] }],
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
      { name: 'Revue de direction', cost: 2, damage: 60, text: 'Envoie 1 café du Planqué adverse au rebut.', effects: [{ kind: 'discardEnergy', target: 'opponent' }] },
      { name: 'Écart critique', cost: 3, damage: 100, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'Il a audité l’audit. L’audit a été reporté.'
  }),
  base({
    id: 'amelioration-charge-amelioration',
    name: 'Chargé d’amélioration continue',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [{ name: 'Kaizen', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
    flavor: 'Le progrès continue. Le poste, non.'
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
      { name: 'Analyse de la valeur', cost: 2, damage: 40 },
      { name: 'Goulot d’étranglement', cost: 3, damage: 70, text: 'Le Planqué adverse est Immobilisé.', effects: [{ kind: 'status', status: 'IMMOBILISATION', target: 'opponent' }] }
    ],
    flavor: 'Il a supprimé une étape. On en a ajouté deux.'
  }),
  base({
    id: 'amelioration-controleur-qualite',
    name: 'Contrôleur qualité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 70,
    retreat: 1,
    attacks: [{ name: 'Contrôle', cost: 1, damage: 20 }],
    flavor: 'Il a contrôlé quarante pièces. Il en reste quatre cents.'
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
      { name: 'Jalons', cost: 2, damage: 50 },
      { name: 'Recette', cost: 3, damage: 80 }
    ],
    flavor: 'Le jalon est passé. Le dossier, non.'
  }),
  base({
    id: 'amelioration-stagiaire-qualite',
    name: 'Stagiaire qualité',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 50,
    retreat: 1,
    attacks: [{ name: 'Relevé', cost: 1, damage: 10, text: 'Pioche 1 carte.', effects: [{ kind: 'draw', amount: 1 }] }],
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
      { name: 'Audit flash', cost: 2, damage: 70 },
      { name: 'Certification', cost: 3, damage: 120, text: 'Ce Planqué prend 20 de stress.', effects: [{ kind: 'selfDamage', amount: 20 }] }
    ],
    flavor: 'On a amélioré le process d’amélioration.'
  })
];

export const AMELIORATION_VARIANTS: Card[] = [
  secretVariant(AMELIORATION_CARDS, 'amelioration-auditeur-qualite', 'star', '↻'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-responsable-process', 'star', '⌁'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-responsable-audit', 'star', '☰'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-chef-projet-qualite', 'star', '✦'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-directeur-qualite', 'star2', '↻'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-responsable-amelioration-continue', 'star2', '◉'),
  secretVariant(AMELIORATION_CARDS, 'amelioration-directeur-flux', 'star2', '⌁')
];

export const ALL_AMELIORATION_CARDS: Card[] = [...AMELIORATION_CARDS, ...AMELIORATION_VARIANTS];
