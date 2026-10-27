/**
 * Les étapes de la « Journée d'intégration » (#130, D-066).
 *
 * **Forme courte** : quatre étapes, et chacune **ouvre l'écran qu'elle décrit**
 * (`cible`, une route de `src/App.tsx`) au lieu de renvoyer à une documentation. La
 * forme **guidée** — celle qui attend que le geste soit fait — appartient à la beta
 * (D-066) et ne se code pas ici.
 *
 * Les quatre choses qu'un testeur ne devine pas (ticket #130) : le **Seuil** et le
 * **Stress**, l'**Arrivage**, le **Deck**, la **fin d'un combat**. Les textes
 * emploient le vocabulaire du jeu (`AGENTS.md` §3) et aucun mot interdit.
 *
 * Le plafond de lecture vient du ticket : **trente secondes par étape**. `secondesDeLecture`
 * est exporté pour que le test le **mesure** au lieu de le croire.
 */
export interface EtapeJournee {
  /** Le titre de l'étape : il devient le titre du dialogue. */
  readonly titre: string;
  /** Ce qu'on ne devine pas, en une phrase courte (trente secondes au plus). */
  readonly texte: string;
  /** La route de l'écran que le bouton ouvre — un geste, pas un renvoi. */
  readonly cible: string;
  /** Le libellé du bouton : il nomme le geste, jamais « en savoir plus ». */
  readonly action: string;
}

export const ETAPES_JOURNEE: readonly EtapeJournee[] = [
  {
    titre: 'Le Seuil et le Stress',
    texte:
      'Le Seuil est la limite avant la casse. Le Stress, lui, monte à chaque Pression : le Planqué craque quand il atteint son Seuil. La barre montre le Seuil à la Collection, et le Stress qui monte au combat.',
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
      'Le premier à trois Interventions gagne, et un COMEX en vaut deux. Quand un Planqué craque, c’est son joueur qui choisit la relève ; plus de Planqué en jeu, et c’est la défaite.',
    cible: '/battle',
    action: 'Aller au combat'
  }
];

/**
 * Vitesse de lecture retenue pour la mesure : **180 mots par minute**, la lecture d'un
 * écran par un testeur, pas celle d'un correcteur. À cette vitesse, 90 mots font
 * exactement les trente secondes du ticket.
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
