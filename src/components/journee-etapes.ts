/**
 * Les étapes de la « Journée d'intégration » (#130, D-066 ; refonte du 30/10/2026).
 *
 * **Cinq étapes, zéro recouvrement avec le pas-à-pas du combat.** La Journée couvre ce
 * qui existe **hors** du combat — l'Arrivage, la Collection et le Deck, les données du
 * navigateur, le comité — et elle **remet le combat** à son propre tutoriel : le
 * pas-à-pas, qui parle du Poste, du café, de la Pression et de la fin là où ces mots
 * veulent dire quelque chose (30/10/2026, décision D-160).
 *
 * Avant, trois de ses cinq étapes redisaient ce que le combat explique mieux : « Le Seuil
 * et le Stress » ouvrait la Collection, « La fin d'un combat » doublait « La fin », et
 * « Le tour de jeu » rejouait le café et la Pression dans une maquette. Un testeur
 * recevait dix étapes pour cinq choses.
 *
 * **Deux phrases au plus et un seul geste par étape** (D-136) : `texte` tient en deux
 * phrases, `action` nomme le geste, et le pas de lecture est **mesuré** par le test
 * (`secondesDeLecture`) au lieu d'être supposé.
 *
 * Les textes emploient le vocabulaire du jeu (`docs/JEU.md` §3) et aucun mot interdit.
 */
export interface EtapeJournee {
  /** Le titre de l'étape : il devient le titre du panneau. */
  readonly titre: string;
  /** Ce qu'on ne devine pas, en deux phrases au plus. */
  readonly texte: string;
  /** La route de l'écran que le bouton ouvre — un geste, pas un renvoi. */
  readonly cible: string;
  /** Le libellé du bouton : il nomme le geste, jamais « en savoir plus ». */
  readonly action: string;
  /**
   * Le **geste réel** que l'étape exige avant de passer à la suivante (30/10/2026).
   * Sans lui, la Journée se lisait : « ouvre un Arrivage » était un conseil, pas une
   * étape. `arrivage` attend un Arrivage ouvert (`packsOpened`), `deck` attend un Deck
   * chargé (`deck.length`).
   */
  readonly geste?: 'arrivage' | 'deck';
  /**
   * L'étape montre les cartes drôles du set (30/10/2026). C'est la carte qui parle : sa
   * `flavor` est déjà la vanne, on n'en ajoute pas une seconde.
   */
  readonly montreCartes?: boolean;
}

export const ETAPES_JOURNEE: readonly EtapeJournee[] = [
  {
    titre: 'L’Arrivage',
    texte:
      'Un Arrivage, c’est cinq cartes : trois communes, une peu commune, une rare au minimum. Clique le bouton de l’accueil : les cartes rejoignent ta Collection.',
    cible: '/',
    action: 'Aller à l’accueil',
    geste: 'arrivage'
  },
  {
    titre: 'La Collection et le Deck',
    texte:
      'La Collection montre ce que tu possèdes, et le Deck compose vingt cartes avec. Choisis un Deck proposé et charge-le : c’est celui que tu joueras.',
    cible: '/deck',
    action: 'Aller au Deck',
    geste: 'deck',
    montreCartes: true
  },
  {
    titre: 'Le combat',
    texte:
      'Trois Interventions et la partie est gagnée, et un COMEX en vaut deux. Le combat guidé t’apprend le Poste, le café et la Pression, sur le vrai plateau.',
    cible: '/battle?scene=fin',
    action: 'Jouer mon premier combat'
  },
  {
    titre: 'Tes données',
    texte:
      'Ta Collection et ton Deck vivent dans ce navigateur. Réglages → « Créer ma sauvegarde » avant de vider quoi que ce soit : c’est ta seule copie.',
    cible: '/settings',
    action: 'Ouvrir mes réglages'
  },
  {
    titre: 'Le comité',
    texte:
      'Le comité est le mur des retours : un post-it IP pour une idée, un OUF pour un défaut. Il reste ouvert après la Journée, quand tu auras quelque chose à dire.',
    cible: '/comite',
    action: 'Voir le comité'
  }
];

/**
 * Les cartes montrées à l'étape « La Collection et le Deck » (30/10/2026).
 *
 * Des **identifiants**, pas des textes : la vanne est la `flavor` de la carte, lue dans
 * `src/data` — un fait, un fichier. La paire Joueur de flûte → Technicien système est là
 * pour montrer une **évolution** (Entrant → N+1), pas seulement pour faire rire.
 */
export const CARTES_MONTREES = [
  'atelier-joueur-de-flute',
  'atelier-technicien-systeme',
  'direction-chef-projet-fantome',
  'rh-charge-recrutement',
  'qvt-happiness-manager',
  'interim-interimaire'
] as const;

/**
 * Ce que le saut coûte, écrit sur le bouton (D-136, reformulé le 30/10/2026).
 *
 * Un testeur pressé saute d'un clic, mais il **sait** ce qu'il perd. Tant que le combat
 * reste à voir, le bouton le nomme — c'est l'étape qui compte, celle que la Journée ne
 * fait qu'annoncer. Passé le combat, il n'y a plus rien à perdre que la fin du parcours,
 * et le bouton le dit : « Terminer ».
 */
export function libelleSaut(etape: number): string {
  const resteLeCombat = etape < ETAPES_JOURNEE.findIndex((courante) => courante.cible.split('?')[0] === '/battle');
  return resteLeCombat ? 'Passer : tu ne verras pas le combat' : 'Terminer la journée d’intégration';
}

/**
 * Vitesse de lecture retenue pour la mesure : **180 mots par minute**, la lecture d'un
 * écran par un testeur, pas celle d'un correcteur.
 */
export const MOTS_PAR_MINUTE = 180;

/** Les mots que l'étape demande de lire : son titre, son texte et le libellé du geste. */
export function motsDeLEtape(etape: EtapeJournee): number {
  return `${etape.titre} ${etape.texte} ${etape.action}`.split(/\s+/).filter(Boolean).length;
}

/** La lecture de l'étape, en secondes, à `MOTS_PAR_MINUTE`. */
export function secondesDeLecture(etape: EtapeJournee): number {
  return (motsDeLEtape(etape) / MOTS_PAR_MINUTE) * 60;
}

/** Les phrases d'un texte : un point, un point d'interrogation ou un point d'exclamation. */
export function nombreDePhrases(texte: string): number {
  return texte
    .split(/[.!?]+/)
    .map((phrase) => phrase.trim())
    .filter(Boolean).length;
}
