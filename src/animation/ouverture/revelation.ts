/*
 * **La révélation des cartes d'un Arrivage** — les règles de mise en scène, sans DOM (#283).
 *
 * Ce qui se décide ici se teste en TypeScript pur : le **palier** de chaque carte (qui règle la
 * lumière, l'attente avant le retournement, l'annonce et les particules), la **lueur** du sachet
 * (la couleur de la meilleure carte, qui filtre par la déchirure), le **tracé** de la déchirure, et
 * la **disposition** des cartes (étalées face cachée, puis la fiche d'une carte). Le composant ne
 * fait que poser ces nombres.
 *
 * Rien ici ne change le tirage : les cartes sont posées dans l'ordre de `openPackCards`, et c'est
 * le testeur qui choisit laquelle retourner.
 */
import type { Rarity } from '@/data/types';
import { RARITY_META } from '@/data';

/**
 * Les quatre paliers de mise en scène, du plus sobre au plus spectaculaire.
 *
 * - `simple` : ◆ et ◆◆ — la carte se retourne, sans plus ;
 * - `rare` : ◆◆◆ — un halo et une gerbe d'étincelles ;
 * - `brillante` : ◆◆◆◆ — l'attente se tend, la carte tremble, reflet holographique ;
 * - `secrete` : les étoiles et la Couronne — éclair, rayons, pluie d'étoiles.
 */
export type Palier = 'simple' | 'rare' | 'brillante' | 'secrete';

const PALIER: Record<Rarity, Palier> = {
  '1D': 'simple',
  '2D': 'simple',
  '3D': 'rare',
  '4D': 'brillante',
  '1S': 'secrete',
  '2S': 'secrete',
  '3S': 'secrete',
  COU: 'secrete'
};

const RANG: Record<Palier, number> = { simple: 0, rare: 1, brillante: 2, secrete: 3 };

export function palier(rarete: Rarity): Palier {
  return PALIER[rarete];
}

/**
 * L'attente entre le toucher et le retournement, en millisecondes. Elle **croît** avec le palier :
 * une carte banale se retourne aussitôt, une étoile monte au centre, tremble et se fait désirer.
 */
export const SUSPENSE: Record<Palier, number> = { simple: 0, rare: 900, brillante: 1400, secrete: 1900 };

/**
 * Le temps qu'une carte rare **reste au centre**, face visible, avec son annonce, avant de
 * regagner sa place (un toucher l'y renvoie plus tôt). Une carte simple se retourne sur place.
 */
export const TENUE: Record<Palier, number> = { simple: 0, rare: 1900, brillante: 2300, secrete: 2900 };

/**
 * **Les annonces** : la phrase qui s'affiche quand une carte rare se retourne, à la façon d'un
 * jeu de cartes à collectionner qui fête ses légendaires — mais dans la langue de la maison. La
 * chute vise le système, jamais une personne (docs/JEU.md §4.2).
 */
export const ANNONCES: Record<Exclude<Palier, 'simple'>, readonly string[]> = {
  rare: ['Validé en comité !', 'Bon pour accord !', 'Remonté à la hiérarchie !', 'Promotion interne !'],
  brillante: [
    'Entretien annuel : dépasse les attentes !',
    'Prime exceptionnelle !',
    'Nommé référent du référentiel !',
    'Mutation à la Direction !'
  ],
  secrete: [
    'Augmentation accordée !',
    'Hors grille salariale !',
    'Note de service exceptionnelle !',
    'Le COMEX valide sans réunion !',
    'Poste à vie, sans entretien !'
  ]
};

/** L'annonce d'une carte : `null` pour une carte simple, sinon une phrase de son palier, rejouable par `graine`. */
export function annonce(niveau: Palier, graine: number): string | null {
  if (niveau === 'simple') return null;
  const liste = ANNONCES[niveau];
  return liste[Math.floor(hasard(graine)() * liste.length)] ?? liste[0] ?? null;
}

/** La rareté la plus haute du tirage — celle dont la couleur filtre par la déchirure. */
export function meilleure(raretes: readonly Rarity[]): Rarity | undefined {
  let haut: Rarity | undefined;
  for (const r of raretes) if (!haut || RARITY_META[r].order > RARITY_META[haut].order) haut = r;
  return haut;
}

/** Le palier le plus haut du tirage, `simple` pour un tirage vide. */
export function meilleurPalier(raretes: readonly Rarity[]): Palier {
  const haut = meilleure(raretes);
  return haut ? palier(haut) : 'simple';
}

/** Comparer deux paliers : vrai si `a` est au moins aussi haut que `b`. */
export function auMoins(a: Palier, b: Palier): boolean {
  return RANG[a] >= RANG[b];
}

/**
 * La couleur de la lumière : celle de la rareté la plus haute (`RARITY_META`, seule source des
 * couleurs de rareté). Un tirage sans rien de notable garde une lumière froide.
 */
export function lueur(raretes: readonly Rarity[]): string {
  const haut = meilleure(raretes);
  if (!haut || palier(haut) === 'simple') return '#cfe3ff';
  return RARITY_META[haut].color;
}

/** Un générateur pseudo-aléatoire minuscule (mulberry32) : un tracé rejouable par sa graine. */
export function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Le tracé de la déchirure : des points `[x, y]` en **pour cent** de la pochette, de gauche à
 * droite, autour de l'ordonnée `ligne`. Les deux morceaux (bande et corps) découpent **le même**
 * tracé : ils s'emboîtent au pixel.
 */
export function traceDechirure(graine: number, ligne: number, pas = 26): Array<[number, number]> {
  const tirer = hasard(graine);
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= pas; i += 1) {
    const x = (i / pas) * 100;
    // Une dent sur deux part dans l'autre sens : c'est ce qui fait un bord de film déchiré.
    const dent = (i % 2 === 0 ? -1 : 1) * (0.25 + tirer() * 0.55);
    points.push([Number(x.toFixed(2)), Number((ligne + dent).toFixed(2))]);
  }
  return points;
}

/** Les deux `clip-path` d'un tracé : la bande (au-dessus) et le corps (en dessous). */
export function decoupes(trace: ReadonlyArray<[number, number]>): { bande: string; corps: string } {
  const ligne = trace.map(([x, y]) => `${x}% ${y}%`);
  return {
    bande: `polygon(0% 0%, 100% 0%, ${[...ligne].reverse().join(', ')})`,
    corps: `polygon(${ligne.join(', ')}, 100% 100%, 0% 100%)`
  };
}

/** La taille de référence d'une carte de la scène (le format 63 × 88 de `.card`). */
export const CARTE = { largeur: 220, hauteur: Math.round((220 * 88) / 63) };

export interface Pose {
  x: number;
  y: number;
  echelle: number;
  rotation: number;
}

/** L'échelle d'une carte révélée : grande, mais jamais plus haute que 62 % de la scène. */
export function echelleGrande(largeur: number, hauteur: number): number {
  return Math.max(0.5, Math.min(1.45, (largeur * 0.8) / CARTE.largeur, (hauteur * 0.66) / CARTE.hauteur));
}

/**
 * La pose d'une carte **étalée** — face cachée pendant la révélation, face visible ensuite —,
 * centrée dans la scène (positions relatives au centre). La grille est celle qui donne les **plus grandes** cartes : trois colonnes sur un écran
 * large (trois en haut, deux en bas), deux sur un téléphone en hauteur, une rangée sur un écran
 * très large.
 */
export function poseRecap(index: number, total: number, largeur: number, hauteur: number): Pose {
  const ecart = 12;
  const grille = (colonnes: number) => {
    const rangees = Math.ceil(total / colonnes);
    const echelle = Math.min(
      1,
      (largeur * 0.96 - ecart * (colonnes - 1)) / colonnes / CARTE.largeur,
      (hauteur * 0.96 - ecart * (rangees - 1)) / rangees / CARTE.hauteur
    );
    return { colonnes, rangees, echelle };
  };
  const choix = [3, 2, total]
    .filter((c) => c >= 1 && c <= Math.max(1, total))
    .map(grille)
    .reduce((a, b) => (b.echelle > a.echelle + 0.001 ? b : a));
  const { colonnes, rangees } = choix;
  const echelle = Math.max(0.25, choix.echelle);
  const l = CARTE.largeur * echelle;
  const h = CARTE.hauteur * echelle;
  const rangee = Math.floor(index / colonnes);
  const dansRangee = Math.min(colonnes, total - rangee * colonnes);
  const colonne = index - rangee * colonnes;
  const x = (colonne - (dansRangee - 1) / 2) * (l + ecart);
  const y = (rangee - (rangees - 1) / 2) * (h + ecart);
  return { x, y, echelle, rotation: 0 };
}

/** Le léger désordre des cartes encore face cachée, posées à la main sur le bureau. */
export function inclinaisonCachee(index: number): number {
  return [-3, 2, -1.5, 3, -2, 1, -2.5][index % 7] ?? 0;
}

export interface Fiche {
  /** La pose de la carte agrandie. */
  carte: Pose;
  /** Le panneau de texte, en pixels depuis le coin haut-gauche de la scène. */
  panneau: { x: number; y: number; largeur: number; hauteur: number };
  /** `cote` : la carte à gauche, le texte à droite ; `dessous` : la carte en haut, le texte en bas. */
  disposition: 'cote' | 'dessous';
}

/**
 * **La fiche d'une carte** : la carte en grand, et à côté (écran large) ou en dessous (téléphone)
 * **tout ce qu'elle porte** en toutes lettres — les textes que la carte abrège.
 */
export function poseFiche(largeur: number, hauteur: number): Fiche {
  const ecart = 16;
  if (largeur >= hauteur * 1.05) {
    const panneau = Math.min(440, largeur * 0.46);
    const echelle = Math.min(1.6, (hauteur * 0.94) / CARTE.hauteur, (largeur - panneau - ecart * 3) / CARTE.largeur);
    const l = CARTE.largeur * echelle;
    const total = l + ecart + panneau;
    const gauche = (largeur - total) / 2;
    return {
      carte: { x: gauche + l / 2 - largeur / 2, y: 0, echelle, rotation: 0 },
      panneau: { x: gauche + l + ecart, y: hauteur * 0.04, largeur: panneau, hauteur: hauteur * 0.92 },
      disposition: 'cote'
    };
  }
  const echelle = Math.min(1.3, (hauteur * 0.5) / CARTE.hauteur, (largeur * 0.8) / CARTE.largeur);
  const h = CARTE.hauteur * echelle;
  const haut = 4;
  return {
    carte: { x: 0, y: haut + h / 2 - hauteur / 2, echelle, rotation: 0 },
    panneau: { x: 0, y: haut + h + 12, largeur, hauteur: Math.max(120, hauteur - (haut + h + 12)) },
    disposition: 'dessous'
  };
}
