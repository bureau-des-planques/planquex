import type { Faction, PlanqueCard, Rarity } from './types';
import { FACTION_META } from './factions';

/**
 * Le **socle de faction** (#54) : tout ce que les dix fichiers `src/data/<faction>.ts`
 * recopiaient — le constructeur de Planqué, la variante secrète, le dégradé et le glyphe.
 * Une faction ne déclare plus que ses cartes ; son identité est dans `./factions`.
 *
 * Le vocabulaire du jeu (`AGENTS.md` §3) ne change pas : ces noms sont ceux du code,
 * comme `PlanqueCard` et `isPlanque`.
 */

/**
 * Ce qu'un fichier de faction écrit pour une carte : le socle complète le type, la
 * faction, la vulnérabilité, le dégradé et le glyphe par défaut.
 */
export type PlanqueInput = Omit<PlanqueCard, 'kind' | 'faction' | 'weakness' | 'palette' | 'glyph'> & {
  glyph?: string;
};

/**
 * Raretés qu'une **variante secrète** peut porter (`CARD-SPEC.md` §1) : les deux
 * étoiles basses, 3 étoiles (#87), et la Couronne.
 */
export type SecretRarity = '1S' | '2S' | '3S' | 'COU';

/**
 * Suffixes des variantes secrètes. Le suffixe **porte** la rareté (un id de variante
 * se lit donc sans consulter le catalogue) : `-star`, `-star2`, `-star3`, `-crown`.
 * `crown` est le mot de code de la Couronne (`COU`), comme `star` celui de l'étoile.
 */
export type SecretSuffix = 'star' | 'star2' | 'star3' | 'crown';

/** La rareté portée par chaque suffixe de variante : source unique de `secretVariant`. */
export const SECRET_RARITY: Record<SecretSuffix, SecretRarity> = {
  star: '1S',
  star2: '2S',
  star3: '3S',
  crown: 'COU'
};

/** L'inverse de `SECRET_RARITY`, dérivé pour ne pas tenir deux tables à jour. */
const RARITY_SUFFIX = Object.fromEntries(
  Object.entries(SECRET_RARITY).map(([suffix, rarity]) => [rarity, suffix])
) as Record<SecretRarity, SecretSuffix>;

/** Le suffixe d'une rareté secrète, ou `undefined` pour une rareté sans variante. */
export function secretSuffix(rarity: Rarity): SecretSuffix | undefined {
  return (RARITY_SUFFIX as Partial<Record<Rarity, SecretSuffix>>)[rarity];
}

/** Vrai pour un suffixe de variante secrète connu — employé par les tests de nommage. */
export function isSecretSuffix(value: string): value is SecretSuffix {
  return Object.hasOwn(SECRET_RARITY, value);
}

/** Un dégradé à trois arrêts, en degrés : c'est l'angle des cartes existantes. */
const GRADIENT_ANGLE = 155;

/** Clarté de l'arrêt clair et de l'arrêt sombre, en fraction de la clarté de la couleur. */
const LIGHT_RATIO = 0.36;
const DARK_RATIO = 0.16;

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function toHsl(hex: string): Hsl {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Couleur de faction invalide : ${hex}`);
  const int = Number.parseInt(match[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  const raw =
    max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  return { h: (raw + 360) % 360, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((stop) =>
      Math.round((stop + m) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

/**
 * Le dégradé d'une carte, **dérivé** de la seule couleur de la faction : un arrêt clair,
 * la couleur, un arrêt sombre. Une faction nouvelle n'a donc plus de fond à dessiner.
 */
export function planquePalette(color: string): string {
  const { h, s, l } = toHsl(color);
  const light = toHex({ h, s: Math.min(1, s * 1.05), l: Math.max(0.07, l * LIGHT_RATIO) });
  const dark = toHex({ h, s: Math.min(1, s * 0.9), l: Math.max(0.04, l * DARK_RATIO) });
  return `linear-gradient(${GRADIENT_ANGLE}deg, ${light} 0%, ${color} 48%, ${dark} 100%)`;
}

/**
 * Le constructeur des Planqués d'une faction. Il pose le type, la faction, la
 * **vulnérabilité** (portée par `FACTION_META`, jamais par la carte), le dégradé dérivé
 * de la couleur unique, et le glyphe de la faction sauf surcharge.
 */
export function planqueBase(faction: Faction): (card: PlanqueInput) => PlanqueCard {
  const meta = FACTION_META[faction];
  const palette = planquePalette(meta.color);
  return (card) => ({
    ...card,
    kind: 'PLANQUE',
    faction,
    weakness: meta.weakness,
    palette,
    glyph: card.glyph ?? meta.glyph
  });
}

/**
 * Une **variante secrète** d'une carte : elle hérite de tout (stats, Pressions, Talent,
 * flavour) et ne change que son identifiant, sa rareté et, au besoin, son glyphe.
 * Le suffixe porte la rareté : `star` → `1S`, `star2` → `2S`, `star3` → `3S`,
 * `crown` → `COU` (#87).
 */
export function secretVariant(
  cards: readonly PlanqueCard[],
  baseId: string,
  suffix: SecretSuffix,
  glyph?: string
): PlanqueCard {
  const source = cards.find((card) => card.id === baseId);
  if (!source) throw new Error(`Carte introuvable : ${baseId}`);
  return {
    ...source,
    id: `${baseId}-${suffix}`,
    rarity: SECRET_RARITY[suffix],
    variantOf: baseId,
    glyph: glyph ?? source.glyph
  };
}
