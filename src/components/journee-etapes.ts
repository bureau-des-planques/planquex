/**
 * Les étapes de la « Journée d'intégration » (#130, D-066 ; jouée, D-136, #334).
 *
 * **Cinq étapes** : les quatre du ticket #130 — le Seuil et le Stress, l'Arrivage, le Deck,
 * la fin d'un combat — plus **le tour de jeu** (D-136). Chacune **ouvre l'écran qu'elle
 * décrit** (`cible`, une route de `src/App.tsx`), sauf le tour de jeu, qui se **fait** dans
 * le dialogue avant de conduire au combat : attacher un café, lancer une Pression, lire le
 * Stress (`geste: 'tour'`).
 *
 * **Deux phrases au plus et un seul geste par étape** (D-136) : `texte` tient en deux
 * phrases, `action` nomme le geste, et le pas de lecture est **mesuré** par le test
 * (`secondesDeLecture`) au lieu d'être supposé.
 *
 * Les textes emploient le vocabulaire du jeu (`AGENTS.md` §3) et aucun mot interdit.
 */
export interface EtapeJournee {
  /** Le titre de l'étape : il devient le titre du dialogue. */
  readonly titre: string;
  /** Ce qu'on ne devine pas, en deux phrases au plus. */
  readonly texte: string;
  /** La route de l'écran que le bouton ouvre — un geste, pas un renvoi. */
  readonly cible: string;
  /** Le libellé du bouton : il nomme le geste, jamais « en savoir plus ». */
  readonly action: string;
  /**
   * Le geste qui se **fait dans le dialogue**, quand l'étape ne peut pas se comprendre
   * seulement en ouvrant un écran. Seul le tour de jeu en a un (D-136) : il faut avoir
   * attaché un café et lancé une Pression pour passer.
   */
  readonly geste?: 'tour';
}

export const ETAPES_JOURNEE: readonly EtapeJournee[] = [
  {
    titre: 'Le Seuil et le Stress',
    texte:
      'Le Seuil est la limite avant la casse, et le Stress monte à chaque Pression. Au combat, la barre montre le Stress approcher du Seuil.',
    cible: '/collection',
    action: 'Voir ma Collection'
  },
  {
    titre: 'L’Arrivage',
    texte:
      'Un Arrivage, c’est cinq cartes : trois communes, une peu commune, une rare au minimum. Le bouton de l’accueil l’ouvre, et les cartes rejoignent ta Collection.',
    cible: '/',
    action: 'Ouvrir un Arrivage'
  },
  {
    titre: 'Le Deck',
    texte:
      'Un Deck, c’est vingt cartes, deux exemplaires maximum du même nom, et au moins un Planqué Entrant. Choisis aussi de un à trois types de café : ce sont eux qui paient tes Pressions.',
    cible: '/deck',
    action: 'Composer mon Deck'
  },
  {
    titre: 'La fin d’un combat',
    texte:
      'Le premier à trois Interventions gagne, et un COMEX en vaut deux. Quand un Planqué craque, c’est son joueur qui choisit la relève ; plus de Planqué en jeu, c’est la défaite.',
    cible: '/battle',
    action: 'Aller au combat'
  },
  {
    titre: 'Le tour de jeu',
    texte:
      'Un tour, c’est un café attaché, une Pression lancée, et un Stress qui monte. Fais-le ici : le geste est le même en combat.',
    cible: '/battle',
    action: 'Jouer mon premier tour',
    geste: 'tour'
  }
];

/**
 * Ce que le saut coûte, écrit sur le bouton (D-136).
 *
 * Un testeur pressé saute d'un clic, mais il **sait** ce qu'il perd : tant que le tour de
 * jeu reste à voir, le bouton le nomme. Passé cette étape, il n'y a plus rien à perdre, et
 * le bouton le dit aussi.
 */
export function libelleSaut(etape: number, tourFait = false): string {
  const restantes = ETAPES_JOURNEE.slice(Math.max(0, etape));
  const tour = restantes.find((courante) => courante.geste === 'tour');
  if (!tour || tourFait) return 'Terminer la journée d’intégration';
  return `Passer : tu ne verras pas ${tour.titre.toLowerCase()}`;
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
