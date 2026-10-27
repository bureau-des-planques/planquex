import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACTION_META } from '@/data/factions';

/**
 * **Lisibilité du combat** (#290, SPEC-COMBAT-UI §8 T7, DESIGN.md §1.5).
 *
 * Deux gardes, chacune avec son « le contrôle mord » (AGENTS.md §6) :
 *
 * 1. **le plancher typographique** — aucun `font-size` du combat sous `--fs-2xs` ;
 * 2. **la pastille de café se voit** — chaque couleur de faction tient 3:1 contre son liseré
 *    sombre, et l'anneau crème tient 3:1 contre tous les feutres (WCAG 1.4.11, non-texte).
 *
 * Les ratios sont ceux de la formule WCAG 2.1, lus sur les jetons de `src/styles.css` : si un
 * jeton change, le test le suit ; si une teinte de faction devient trop proche du liseré, il échoue.
 */
const CSS = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

/** Les classes qui sont **le combat** : la page, la scène, la barre, les cartes de plateau, la main, les pastilles. */
const SELECTEUR_COMBAT =
  /\.(battle|combat-[a-z]|board|bench|poste|piste|pile|hand|pose|inspecteur|craquage|stress|pips?|status-chip|status-legend|card--plateau|card__stress-chiffre)(?![a-z])/;

/** Les tailles de `:root` (`--fs-*`), lues dans la feuille : une seule source. */
function tailles(css: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [, nom, valeur] of css.matchAll(/--(fs-[a-z0-9]+):\s*([\d.]+)rem;/g)) out.set(nom, Number(valeur));
  return out;
}

function enRem(valeur: string, jetons: Map<string, number>): number | null {
  const rem = valeur.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]);
  const px = valeur.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]) / 16;
  const jeton = valeur.match(/^var\(--(fs-[a-z0-9]+)\)$/);
  if (jeton) return jetons.get(jeton[1]) ?? null;
  return null;
}

/** Les déclarations `font-size` des règles de combat qui passent **sous** `--fs-2xs`. */
function taillesSousLePlancher(css: string): string[] {
  const jetons = tailles(css);
  const plancher = jetons.get('fs-2xs');
  if (plancher === undefined) throw new Error('--fs-2xs introuvable : le plancher n’a plus de référence');
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const fautes: string[] = [];
  for (const regle of sansCommentaires.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selecteur = regle[1].trim().replace(/\s+/g, ' ');
    if (!SELECTEUR_COMBAT.test(selecteur)) continue;
    const taille = regle[2].match(/font-size:\s*([^;]+);/);
    if (!taille) continue;
    const rem = enRem(taille[1].trim(), jetons);
    // Une valeur qu'on ne sait pas lire (`inherit`, `calc`) n'est pas une faute : elle ne passe pas inaperçue
    // pour autant, `null` est refusé ci-dessous pour les unités que la feuille emploie.
    if (rem !== null && rem < plancher) fautes.push(`${selecteur} { font-size: ${taille[1].trim()} }`);
  }
  return fautes;
}

const lin = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Un jeton hexadécimal de la feuille (`--nom: #rrggbb;`), de `:root` ou de `.battle`. */
function jeton(nom: string): string {
  const trouve = CSS.match(new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6});`));
  if (!trouve) throw new Error(`jeton ${nom} introuvable dans styles.css`);
  return trouve[1];
}

describe('plancher typographique du combat (#290)', () => {
  it('aucun font-size du combat sous --fs-2xs', () => {
    expect(taillesSousLePlancher(CSS)).toEqual([]);
  });

  it('le contrôle mord : il voit une taille de 0,42 rem sur la plaque du Seuil, en `rem` comme en `px`', () => {
    const fautif = `${CSS}\n.card--plateau .card__seuil-badge::before { font-size: 0.42rem; }\n.battle .x { font-size: 8px; }`;
    expect(taillesSousLePlancher(fautif)).toEqual([
      '.card--plateau .card__seuil-badge::before { font-size: 0.42rem }',
      '.battle .x { font-size: 8px }'
    ]);
  });

  it('le contrôle ne regarde pas les écrans qui ne sont pas le combat', () => {
    expect(taillesSousLePlancher(`${CSS}\n.reglages-note { font-size: 0.5rem; }`)).toEqual([]);
  });
});

describe('la pastille de café se voit sur la table (#290)', () => {
  const liseré = jeton('--bg-deep');
  const anneau = jeton('--text');
  const feutres = ['--scene-felt', '--scene-felt-lit', '--scene-felt-deep'].map(jeton);

  it('chaque couleur de faction tient 3:1 contre le liseré sombre', () => {
    for (const [faction, meta] of Object.entries(FACTION_META)) {
      expect(ratio(meta.color, liseré), `${faction} ${meta.color} sur ${liseré}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('l’anneau crème tient 3:1 contre les trois feutres', () => {
    for (const feutre of feutres) expect(ratio(anneau, feutre), `anneau sur ${feutre}`).toBeGreaterThanOrEqual(3);
  });

  it('le contrôle mord : l’ancienne pastille (la couleur nue sur le feutre) échouait', () => {
    const direction = FACTION_META.DIRECTION.color;
    expect(ratio(direction, jeton('--scene-felt'))).toBeLessThan(3);
    expect(ratio(direction, jeton('--scene-felt-lit'))).toBeLessThan(3);
    // Et une teinte trop proche du liseré serait vue.
    expect(ratio('#10161f', liseré)).toBeLessThan(3);
  });

  it('la feuille porte bien les pastilles agrandies dans `.battle`', () => {
    expect(CSS).toMatch(/\.battle \.pip\s*\{[^}]*height:\s*14px/);
    expect(CSS).toMatch(/\.battle \.poste__info \.pip\s*\{[^}]*height:\s*18px/);
  });
});

/**
 * **T10 — le retour d'action, sans mouvement quand on le demande** (#293, SPEC-COMBAT-UI §8 T10).
 *
 * Sous « Mouvement réduit » (la préférence système **et** le réglage du store, posé en
 * `data-mouvement-reduit` sur la racine), aucun élément du retour ne porte de `transform` : le
 * chiffre de Stress reste lisible **à sa place**. Il est donc centré sans `transform` — c'est la
 * règle de base qui le dit, pas seulement le repli.
 */
describe('le retour d’action sans mouvement (T10, #293)', () => {
  /** Les blocs `selecteur { corps }` de la feuille, commentaires retirés. */
  function regles(css: string): { selecteur: string; corps: string }[] {
    const sans = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...sans.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({
      selecteur: m[1].trim().replace(/\s+/g, ' '),
      corps: m[2]
    }));
  }

  /** Les règles qui visent le chiffre flottant ET qui sont des replis (« Mouvement réduit »). */
  const repli = /mouvement-reduit|\.is-fixe/;

  /** Les `transform` du chiffre flottant et des boutons qui ne sont pas `none` : la faute. */
  function transformsDuRepli(css: string): string[] {
    const fautes: string[] = [];
    for (const { selecteur, corps } of regles(css)) {
      if (!/stress-flottant|button--fin|\.battle(--mouvement-reduit)? \.button/.test(selecteur)) continue;
      if (!repli.test(selecteur) && !/^\.stress-flottant$/.test(selecteur)) continue;
      const transform = corps.match(/(?:^|[;\s])transform:\s*([^;]+);/);
      if (transform && transform[1].trim() !== 'none')
        fautes.push(`${selecteur} { transform: ${transform[1].trim()} }`);
    }
    return fautes;
  }

  it('le chiffre de Stress et ses replis ne portent aucun transform', () => {
    expect(transformsDuRepli(CSS)).toEqual([]);
  });

  it('le chiffre est centré sans transform, et les replis le laissent visible', () => {
    const base = regles(CSS).find((r) => r.selecteur === '.stress-flottant');
    expect(base?.corps).toMatch(/left:\s*0;/);
    expect(base?.corps).toMatch(/right:\s*0;/);
    expect(base?.corps).toMatch(/text-align:\s*center;/);
    expect(base?.corps).not.toMatch(/transform:/);
    for (const { selecteur, corps } of regles(CSS)) {
      if (!/mouvement-reduit.*\.stress-flottant/.test(selecteur)) continue;
      expect(corps, selecteur).toMatch(/opacity:\s*1;/);
      expect(corps, selecteur).toMatch(/animation:\s*none !important;/);
    }
  });

  it('le contrôle mord : un repli qui recentre par translateX(-50%) est vu', () => {
    const fautif = `${CSS}\n:root[data-mouvement-reduit='true'] .stress-flottant { transform: translateX(-50%); }`;
    expect(transformsDuRepli(fautif)).toEqual([
      ":root[data-mouvement-reduit='true'] .stress-flottant { transform: translateX(-50%) }"
    ]);
  });

  it('le chiffre dure 500 ms, la pile de Deck 150 ms (le CSS suit les constantes)', () => {
    expect(CSS).toMatch(/\.stress-flottant\s*\{[^}]*animation:\s*stress-monte 500ms/);
    expect(CSS).toMatch(/\.pile--deck\.is-piochante::after\s*\{[^}]*animation:\s*piochante-lueur 150ms/);
  });

  it('« Fin du tour » a deux teintes, sans que la bordure ne change d’épaisseur', () => {
    const reglesFin = regles(CSS).filter((r) => /^\.battle \.button--fin/.test(r.selecteur));
    expect(reglesFin.map((r) => r.selecteur)).toEqual([
      '.battle .button--fin',
      '.battle .button--fin.is-a-toi',
      '.battle .button--fin.is-direction'
    ]);
    expect(reglesFin[0].corps).toMatch(/border:\s*2px solid transparent/);
    expect(reglesFin[1].corps).toMatch(/background:\s*var\(--scene-go\)/);
    expect(reglesFin[2].corps).toMatch(/background:\s*var\(--scene-steel-deep\)/);
  });
});
