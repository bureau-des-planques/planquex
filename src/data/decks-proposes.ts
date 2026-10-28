import type { CafeType, Vivier } from './types';

/**
 * Les **Decks proposés** (#141, D-063, D-069, D-149) : des Decks de 20 cartes que le joueur
 * charge en un geste depuis l'écran du Deck, quelle que soit sa Collection. Le joueur en a
 * **cinq** (D-069) ; **trois** portent un `archetype`, un par archétype (D-125 (3), D-149) : ce
 * sont les Decks que joue la Direction selon sa difficulté (`src/game/deck-direction.ts`).
 *
 * ⚠️ **Les listes sont PROVISOIRES.** D-069 acte le jeu d'archétypes (cinq Decks proposés, leur
 * stratégie, leur faiblesse) mais réserve la **fabrication des listes** à après la vague
 * d'illustrations. Ce fichier fournit la mécanique ; les `cartes` sont un brouillon légal
 * et jouable, à refaire une fois les cartes illustrées. Le registre, lui, ne change pas.
 */
export interface DeckPropose {
  id: string;
  name: string;
  /** `MIXTE` : un Deck proposé qui prend dans deux viviers (D-069 (5)). */
  vivier: Vivier | 'MIXTE';
  /** Les types de café du Deck proposé (1 à 3, productibles) : ils partent avec lui (#91). */
  cafeTypes: readonly CafeType[];
  /**
   * L'archétype du Deck, pour les trois que joue la Direction (D-125 (3), D-149) : un par
   * archétype. Les deux autres Decks proposés n'en portent pas : le joueur seul les charge.
   */
  archetype?: 'agressif' | 'controle' | 'milieu';
  /** Ce qu'il fait, en une phrase. */
  strategie: string;
  /** Contre quoi il est faible, en une phrase. */
  faiblesse: string;
  /**
   * **Sa difficulté à jouer** (#251) : à quel point il demande de la lecture, pas la
   * difficulté de la Direction. Un Deck simple se joue tôt ; un Deck exigeant se paie
   * d'une erreur de tempo.
   */
  difficulteAJouer: 'facile' | 'moyenne' | 'exigeante';
  /** Pourquoi il est à ce niveau, en une phrase (le panneau de présentation l'affiche). */
  pourquoiDifficulte: string;
  /** 20 identifiants de cartes **de base** du catalogue (jamais une variante). */
  cartes: readonly string[];
}

/** Répète un id : `x(id, 2)` pour deux exemplaires. */
const x = (id: string, copies = 1): string[] => Array.from({ length: copies }, () => id);

export const DECKS_PROPOSES: readonly DeckPropose[] = [
  {
    id: 'coup-de-marteau',
    name: 'Le coup de marteau',
    vivier: 'ATELIER',
    archetype: 'agressif',
    cafeTypes: ['ATELIER', 'MANAGEMENT'],
    strategie: 'Agression brute : de gros Seuils et des Pressions dès les premiers tours, presque aucun effet.',
    faiblesse: 'Le soin et l’endurance le laissent à court de Stress à infliger.',
    difficulteAJouer: 'facile',
    pourquoiDifficulte: 'Pose et frappe : peu de décisions, un plan clair.',
    cartes: [
      ...x('atelier-joueur-de-flute', 2),
      ...x('atelier-technicien-systeme', 2),
      ...x('atelier-responsable-process'),
      ...x('atelier-monteur-optique', 2),
      ...x('atelier-technicien-banc-essai', 2),
      ...x('atelier-mecanicien', 2),
      ...x('atelier-gestionnaire-fod', 2),
      ...x('management-jeune-manager', 2),
      ...x('management-manager-proximite', 2),
      ...x('management-responsable-unite'),
      ...x('atelier-colle-cyanoacrylate'),
      ...x('management-entretien-annuel')
    ]
  },
  {
    id: 'la-reorganisation',
    name: 'La réorganisation',
    vivier: 'ETAGE',
    archetype: 'controle',
    cafeTypes: ['AMELIORATION', 'DIRECTION'],
    strategie: 'Contrôle : des statuts et des tapes larges qui échangent du tempo contre de la maîtrise.',
    faiblesse: 'L’agression pure le submerge avant que ses statuts ne pèsent.',
    difficulteAJouer: 'exigeante',
    pourquoiDifficulte: 'Chaque statut se pose au bon tour : une erreur de tempo se paie.',
    cartes: [
      ...x('amelioration-charge-qualite', 2),
      ...x('amelioration-auditeur-qualite', 2),
      ...x('amelioration-directeur-qualite'),
      ...x('amelioration-consultant-lean', 2),
      ...x('amelioration-responsable-process', 2),
      ...x('direction-directeur-fantome', 2),
      ...x('direction-directeur-regional', 2),
      ...x('direction-directeur-general'),
      ...x('direction-assistant-direction', 2),
      ...x('direction-chef-cabinet', 2),
      ...x('amelioration-baie-test'),
      ...x('amelioration-reunion-de-suivi')
    ]
  },
  {
    id: 'la-paperasse',
    name: 'La paperasse',
    vivier: 'BUREAUX',
    cafeTypes: ['SSE', 'RH'],
    strategie: 'Endurance : du soin et des Talents de ressource, il gagne en durant.',
    faiblesse: 'Un burst qui l’abat avant qu’il ait soigné quoi que ce soit.',
    difficulteAJouer: 'moyenne',
    pourquoiDifficulte: 'Il faut choisir quand défendre et quand attaquer : la partie se joue au long cours.',
    cartes: [
      ...x('sse-infirmier-site', 2),
      ...x('sse-infirmiere-travail', 2),
      ...x('sse-medecin-travail'),
      ...x('sse-preventeur', 2),
      ...x('sse-ergonome', 2),
      ...x('rh-assistant-rh', 2),
      ...x('rh-charge-recrutement', 2),
      ...x('rh-drh'),
      ...x('rh-gestionnaire-formation', 2),
      ...x('rh-responsable-formation'),
      ...x('sse-trousse-secours'),
      ...x('sse-visite-medicale'),
      ...x('rh-reunion-individuelle')
    ]
  },
  {
    id: 'la-bonne-humeur',
    name: 'La bonne humeur',
    vivier: 'BUREAUX',
    archetype: 'milieu',
    cafeTypes: ['QVT'],
    strategie: 'Tempo et soin : un seul type de café, une partie qui se gagne au long cours.',
    faiblesse: 'Le contrôle : les statuts cassent son rythme et le privent de son tempo.',
    difficulteAJouer: 'facile',
    pourquoiDifficulte: 'Un seul type de café et un plan simple : tenir, puis remonter.',
    cartes: [
      ...x('qvt-charge-qvt', 2),
      ...x('qvt-happiness-manager', 2),
      ...x('qvt-chief-happiness-officer'),
      ...x('qvt-animateur-bien-etre', 2),
      ...x('qvt-responsable-qvt', 2),
      ...x('qvt-coach-sante', 2),
      ...x('qvt-expert-bien-etre', 2),
      ...x('qvt-referent-qvt', 2),
      ...x('qvt-chef-projet-qvt', 2),
      ...x('qvt-charge-mission', 2),
      ...x('qvt-yoga-du-rire')
    ]
  },
  {
    id: 'les-renforts',
    name: 'Les renforts',
    vivier: 'MIXTE',
    // D-069 écrit « ATELIER + INTERIM », mais INTERIM (Dragon) n'est jamais un type de café
    // (D-034). Les Pressions des Intérimaires exigent la paire RH + ATELIER (D-037 (3)),
    // comme `SIMULATION_CAFE_TYPES` : c'est elle qui arme le joker incolore.
    cafeTypes: ['ATELIER', 'RH'],
    strategie: 'Le joker incolore : des Intérimaires qui s’adaptent, soutenus par la maintenance de l’Atelier.',
    faiblesse: 'Les Decks d’un seul type, plus réguliers et plus rapides.',
    difficulteAJouer: 'exigeante',
    pourquoiDifficulte: 'Le joker incolore demande de lire les deux viviers à chaque tour.',
    cartes: [
      ...x('interim-interimaire', 2),
      ...x('interim-interimaire-confirme', 2),
      ...x('interim-chef-equipe-interimaire'),
      ...x('interim-consultant-interimaire', 2),
      ...x('interim-responsable-interim'),
      ...x('atelier-joueur-de-flute', 2),
      ...x('atelier-technicien-systeme', 2),
      ...x('atelier-opticien', 2),
      ...x('atelier-rpo', 2),
      ...x('atelier-regleur', 2),
      ...x('atelier-rpi', 2)
    ]
  }
];
