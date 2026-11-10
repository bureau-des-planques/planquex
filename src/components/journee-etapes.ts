import { REPLIQUES_JOURNEE } from '@/data/repliques-direction';

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
  readonly geste?: 'arrivage' | 'deck' | 'sauvegarde' | 'combat';
  /**
   * **La Direction accueille le nouveau** (31/10/2026, copie validée par Bastien). Une
   * ligne, provocante, dans la voix du produit : les cinq textes d'étape sont justes mais
   * neutres, et la satire ne vivait que sur les cartes et la scène de fin. Elle se dit
   * dans le panneau, au-dessus du geste, comme la réplique de fin de combat. Le texte vit
   * dans `src/data/repliques-direction.ts` (`REPLIQUES_JOURNEE`, #782) : aucun texte de
   * réplique hors de `src/data` (`AGENTS.md` §6).
   */
  readonly direction: string;
  /**
   * L'étape montre les cartes drôles du set (30/10/2026). C'est la carte qui parle : sa
   * `flavor` est déjà la vanne, on n'en ajoute pas une seconde.
   */
  readonly montreCartes?: boolean;
}

export const ETAPES_JOURNEE: readonly EtapeJournee[] = [
  {
    titre: 'L’Arrivage',
    texte: 'Ouvre un Arrivage.',
    cible: '/',
    action: 'Aller à l’accueil',
    geste: 'arrivage',
    direction: REPLIQUES_JOURNEE.arrivage
  },
  {
    titre: 'La Collection et le Deck',
    /**
     * **La page unifiée « Cartes » (D-175, #545)** : Collection et Deck sont deux onglets
     * d'un même écran. L'étape vise `/deck` parce que le geste est de **charger** un Deck,
     * et `/collection` reste une adresse valide de l'autre onglet — elle n'est ni obsolète
     * ni redirigée (D-175 (2)).
     */
    texte: 'Charge un Deck proposé, vingt cartes.',
    cible: '/deck',
    action: 'Aller au Deck',
    geste: 'deck',
    montreCartes: true,
    direction: REPLIQUES_JOURNEE.collectionDeck
  },
  {
    titre: 'Le combat',
    texte: 'Joue le combat guidé.',
    cible: '/battle?tutoriel=1&scene=fin',
    action: 'Jouer mon premier combat',
    direction: REPLIQUES_JOURNEE.combat,
    // **Le combat est un geste** (31/10/2026) : sans lui, l'étape qui compte se traversait
    // en lecture. Il se marque à la scène de fin — gagner le combat guidé est la preuve
    // qu'on l'a joué. Sur `/battle`, le panneau s'efface (le pas-à-pas parle seul).
    geste: 'combat'
  },
  {
    titre: 'Tes données',
    texte: 'Crée ta sauvegarde dans Réglages, ta seule copie.',
    cible: '/settings',
    action: 'Aller aux réglages',
    geste: 'sauvegarde',
    direction: REPLIQUES_JOURNEE.donnees
  },
  {
    titre: 'Le comité',
    texte: 'Colle un post-it IP ou OUF.',
    cible: '/comite',
    action: 'Voir le comité',
    direction: REPLIQUES_JOURNEE.comite
  }
];

/**
 * **Le chemin d'une cible, sans sa requête** (D-162 (4)) : `?scene=fin` est un état d'écran,
 * pas une route. Un seul endroit coupe la requête, pour que la comparaison ne se réécrive
 * pas trois fois — `JourneeIntegration` et `Battle` s'y tiennent.
 */
export function cheminDeCible(cible: string): string {
  return cible.split('?')[0];
}

/**
 * **La route → l'étape** (#677) : l'étape qui décrit ce chemin, ou `-1`.
 *
 * La route n'est **pas** l'identifiant unique de l'étape : deux étapes peuvent partager un
 * écran, et c'est alors `JourneeIntegration` qui garde l'étape courante. Cette fonction ne
 * sert qu'à réaligner après un retour du navigateur ou une URL directe.
 */
export function etapePourChemin(pathname: string, etapes: readonly EtapeJournee[] = ETAPES_JOURNEE): number {
  return etapes.findIndex((etape) => cheminDeCible(etape.cible) === pathname);
}

/**
 * **L'index de l'étape qui porte ce geste**, ou `-1` — jamais un numéro écrit en dur (#677).
 * La fin du combat lit cet index : réordonner les étapes déplace le geste, pas la visite.
 */
export function indexEtapeGeste(
  geste: EtapeJournee['geste'],
  etapes: readonly EtapeJournee[] = ETAPES_JOURNEE
): number {
  return etapes.findIndex((etape) => etape.geste === geste);
}

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
 * **La position de la Journée au rendu précédent** (779, D-196) : l'étape, et si son geste était
 * déjà fait. Sert à lire une **transition**, pas un état.
 */
export interface PositionDeGeste {
  readonly etape: number;
  readonly fait: boolean;
}

/**
 * **Le geste vient de se faire, à cette étape** (D-196 (1)) : l'étape suivante s'ouvre.
 *
 * Il faut une **transition** : un geste déjà fait à l'arrivée (« Revoir », #731, une reprise)
 * n'enchaîne rien, sinon « Revoir » traverserait toute la Journée sans la lire.
 */
export function passeAuGeste(precedent: PositionDeGeste | null, etape: number, fait: boolean): boolean {
  return precedent !== null && precedent.etape === etape && !precedent.fait && fait;
}

/**
 * **Le tap sur l'encadré fait-il avancer ?** (D-196 (1)) Seulement une étape **sans geste**, et
 * pas la dernière : une étape avec geste avance par son geste.
 */
export function tapeAvance(etape: EtapeJournee, index: number, dernier: number): boolean {
  return etape.geste === undefined && index < dernier;
}

/**
 * **Le tap sur la dernière réplique termine la Journée** (779, décision du propriétaire du
 * 10/11/2026). Seule la dernière étape sans geste le fait : le même effet que « Relire la
 * Journée plus tard », qui reste à l'écran.
 */
export function tapeTermine(etape: EtapeJournee, index: number, dernier: number): boolean {
  return etape.geste === undefined && index >= dernier;
}

/**
 * Ce que le saut coûte, écrit sur le bouton (D-136, reformulé le 30/10/2026).
 *
 * Un testeur pressé saute d'un clic, mais il **sait** ce qu'il perd. Tant que le combat
 * reste à voir, le bouton le nomme — c'est l'étape qui compte, celle que la Journée ne
 * fait qu'annoncer. Passé le combat, il n'y a plus rien à perdre que la fin du parcours,
 * et le bouton le dit : « Terminer ».
 */
export function libelleSaut(etape: number): string {
  // **`<=` et non `<`** (31/10/2026) : à l'étape du combat, « Terminer » promettait de tout
  // garder alors qu'on perdait le seul écran que la Journée voulait montrer.
  const resteLeCombat = etape <= ETAPES_JOURNEE.findIndex((courante) => courante.cible.split('?')[0] === '/battle');
  return resteLeCombat ? 'Passer : tu ne verras pas le combat' : 'Terminer la journée d’intégration';
}

/**
 * **Le locuteur de la réplique** (D-181 (1)) : la Direction parle par son Chef de cabinet.
 * Il vit ici pour que la mesure de la réplique (nom compris) ne recopie pas la chaîne.
 */
export const LOCUTEUR_JOURNEE = 'Chef de cabinet';

/**
 * **Le budget de texte de la Journée** (D-181 (3), acquis le 03/11/2026) : 12 mots au plus
 * par réplique, locuteur compris, et ≈ 60 mots **rendus** sur les cinq étapes, tolérance de
 * 10 % — soit 54 à 66. Le test d'écran mesure le DOM ; ces constantes fixent la cible, et
 * `motsDeLaReplique` la borne unitaire.
 */
export const MOTS_MAX_REPLIQUE = 12;
export const MOTS_CIBLE_JOURNEE = 60;
export const MOTS_TOLERANCE_JOURNEE = 0.1;
export const MOTS_MIN_JOURNEE = Math.round(MOTS_CIBLE_JOURNEE * (1 - MOTS_TOLERANCE_JOURNEE));
export const MOTS_MAX_JOURNEE = Math.round(MOTS_CIBLE_JOURNEE * (1 + MOTS_TOLERANCE_JOURNEE));

/**
 * Vitesse de lecture retenue pour la mesure : **180 mots par minute**, la lecture d'un
 * écran par un testeur, pas celle d'un correcteur.
 */
export const MOTS_PAR_MINUTE = 180;

/**
 * Les mots que l'étape demande de lire : son titre, son texte, le libellé du geste et la
 * ligne de la Direction (31/10/2026 — elle se lit aussi).
 */
export function motsDeLEtape(etape: EtapeJournee): number {
  return `${etape.titre} ${etape.texte} ${etape.action} ${etape.direction}`.split(/\s+/).filter(Boolean).length;
}

/**
 * Les mots d'une réplique **rendue** : le nom du locuteur compte (D-181 (3)). Une réplique
 * se mesure en mots, pas en phrases — « Vingt cartes, comptées. » en fait trois.
 */
export function motsDeLaReplique(etape: EtapeJournee): number {
  return `${LOCUTEUR_JOURNEE} ${etape.direction}`.split(/\s+/).filter(Boolean).length;
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
