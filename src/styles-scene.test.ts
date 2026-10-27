import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **Les jetons de scène** (T12, #295 ; `docs/SPEC-COMBAT-UI.md` §6.9 et §8 T12 ; DESIGN.md §1.5 et §2.6).
 *
 * Trois gardes, chacune avec son « le contrôle mord » (AGENTS.md §6) :
 *
 * 1. **les jetons `--scene-*` sont déclarés une fois, sous `.battle`**, jamais dans `:root` — la scène
 *    est une couche, elle ne réécrit aucun jeton global ;
 * 2. **les paires de contraste de la direction sont dans DESIGN.md §1.5 avec leur ratio calculé** — si un
 *    jeton change, la ligne du document est périmée et le test le dit ;
 * 3. **aucun halo coloré** sur une surface du combat : le néon est un **état** (filet en ombre
 *    intérieure), pas un style (tell « Dark mode with glowing accents »).
 */
const CSS = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
const DESIGN = readFileSync(join(process.cwd(), 'DESIGN.md'), 'utf8');

/** Les huit jetons de SPEC-COMBAT-UI §6.9 (`-core` compte avec `--scene-neon`). */
const HUIT_JETONS = [
  '--scene-felt',
  '--scene-felt-lit',
  '--scene-card',
  '--scene-neon',
  '--scene-neon-core',
  '--scene-go',
  '--scene-danger',
  '--scene-gold-hot',
  '--scene-parch'
];

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/** Où chaque `--scene-*` est **déclaré** : nom → sélecteurs des blocs qui le déclarent. */
function declarations(css: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const bloc of sansCommentaires(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selecteur = bloc[1].trim().replace(/\s+/g, ' ');
    for (const [, nom] of bloc[2].matchAll(/(--scene-[a-z-]+)\s*:/g)) {
      out.set(nom, [...(out.get(nom) ?? []), selecteur]);
    }
  }
  return out;
}

const lin = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Un jeton hexadécimal de la feuille (`--nom: #rrggbb;`). */
function jeton(nom: string): string {
  const trouve = CSS.match(new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6});`));
  if (!trouve) throw new Error(`jeton ${nom} introuvable dans styles.css`);
  return trouve[1];
}

describe('les jetons --scene-* sont une couche sous .battle (T12, #295)', () => {
  it('chacun des huit jetons de §6.9 est déclaré, une seule fois', () => {
    const decl = declarations(CSS);
    for (const nom of HUIT_JETONS) expect(decl.get(nom), nom).toHaveLength(1);
  });

  it('aucune déclaration --scene-* hors de `.battle`, et aucune dans `:root`', () => {
    const hors = [...declarations(CSS)].filter(([, selecteurs]) => selecteurs.some((s) => s !== '.battle'));
    expect(hors).toEqual([]);
  });

  it('le contrôle mord : un jeton de scène posé dans `:root` est vu', () => {
    const fautif = `${CSS}\n:root { --scene-felt: #000000; }\n`;
    const hors = [...declarations(fautif)].filter(([, selecteurs]) => selecteurs.some((s) => s !== '.battle'));
    expect(hors.map(([nom]) => nom)).toContain('--scene-felt');
    expect([...declarations(fautif).get('--scene-felt')!]).toHaveLength(2);
  });
});

describe('les paires de la direction sont dans DESIGN.md §1.5, calculées (T12, #295)', () => {
  const felt = () => jeton('--scene-felt');
  const parch = () => jeton('--scene-parch');
  const go = () => jeton('--scene-go');
  /** Les paires que le ticket exige, dont les **deux fautes AA** de la vidéo. */
  const paires: [string, () => number][] = [
    ['faute AA n° 1 — crème de la vidéo sur parchemin', () => ratio('#efe0c2', parch())],
    ['faute AA n° 2 — blanc sur vert', () => ratio('#ffffff', go())],
    ['inversion 1 — encre des piles sur parchemin', () => ratio(jeton('--scene-ink-parch'), parch())],
    ['inversion 2 — encre sombre sur vert', () => ratio('#0b1220', go())],
    ['encre de la direction sur parchemin (annoncée à 5,95)', () => ratio('#3a2a18', parch())],
    ['néon sur feutre', () => ratio(jeton('--scene-neon'), felt())],
    ['danger sur feutre', () => ratio(jeton('--scene-danger'), felt())],
    ['parchemin sur feutre', () => ratio(parch(), felt())],
    ['Stress sur feutre', () => ratio(jeton('--scene-gold-hot'), felt())]
  ];

  /** Le ratio, à deux décimales, figure dans le document (virgule ou point). */
  const ratioEcrit = (doc: string, valeur: string) => new RegExp(`\\b${valeur.replace('.', '[.,]')}\\b`).test(doc);

  it.each(paires)('%s : le ratio calculé est écrit dans DESIGN.md', (_nom, calcul) => {
    const ecrit = calcul().toFixed(2);
    expect(ratioEcrit(DESIGN, ecrit), `ratio ${ecrit} absent de DESIGN.md`).toBe(true);
  });

  it('les deux fautes AA tombent bien sous 4,5:1, et leur inversion le dépasse', () => {
    expect(ratio('#efe0c2', parch())).toBeLessThan(4.5);
    expect(ratio('#ffffff', go())).toBeLessThan(4.5);
    expect(ratio(jeton('--scene-ink-parch'), parch())).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#0b1220', go())).toBeGreaterThanOrEqual(4.5);
  });

  it('le contrôle mord : un document qui porte un autre ratio que le calcul est vu', () => {
    const calcule = ratio('#efe0c2', parch()).toFixed(2);
    expect(ratioEcrit('| crème sur parchemin | 2.50 |', calcule)).toBe(false);
    expect(ratioEcrit(`| crème sur parchemin | ${calcule.replace('.', ',')} |`, calcule)).toBe(true);
    // 5,95 est le ratio que la direction annonçait pour `#3a2a18` : le calcul dit autre chose.
    expect(ratio('#3a2a18', parch()).toFixed(2)).not.toBe('5.95');
  });
});

describe('aucun halo coloré sur le combat (T12, #295)', () => {
  const SELECTEUR_COMBAT =
    /\.(battle|combat-[a-z]|board|bench|poste|piste|pile|hand|pose|inspecteur|infobulle|craquage|stress|pips?|status-chip|status-legend|card--plateau|card__stress-chiffre|button--fin|condition|attaque|is-impactee)(?![a-z])/;

  /** Les couches d'`box-shadow` (séparées par une virgule **hors** parenthèses). */
  function couches(valeur: string): string[] {
    const out: string[] = [];
    let profondeur = 0;
    let courante = '';
    for (const c of valeur) {
      if (c === '(') profondeur++;
      if (c === ')') profondeur--;
      if (c === ',' && profondeur === 0) {
        out.push(courante.trim());
        courante = '';
      } else courante += c;
    }
    if (courante.trim()) out.push(courante.trim());
    return out;
  }

  /** Un halo : une couche **extérieure**, **floue**, dont la couleur n'est pas le noir de l'ombre. */
  function halos(css: string): string[] {
    const fautes: string[] = [];
    for (const regle of sansCommentaires(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selecteur = regle[1].trim().replace(/\s+/g, ' ');
      if (!SELECTEUR_COMBAT.test(selecteur)) continue;
      const ombre = regle[2].match(/(?:box-shadow|filter):\s*([^;]+);/g);
      for (const declaration of ombre ?? []) {
        const valeur = declaration.replace(/^(?:box-shadow|filter):\s*/, '').replace(/;$/, '');
        if (/^(none|grayscale|brightness)/.test(valeur)) continue;
        for (const couche of couches(valeur.replace(/^drop-shadow\((.*)\)$/, '$1'))) {
          if (/^inset\b/.test(couche)) continue;
          // Les longueurs de tête (`x y flou étalement`) : « 0 0 22px » a ses trois premiers nombres sans unité ou non.
          const nombres = couche
            .split(/\s+/)
            .filter((_, i, l) => l.slice(0, i + 1).every((t) => /^-?[\d.]+(px|rem|vmin)?$/.test(t)));
          const flou = nombres[2] ? parseFloat(nombres[2]) : 0;
          if (flou > 0 && !/rgb\(0 0 0\b/.test(couche)) fautes.push(`${selecteur} { ${couche} }`);
        }
      }
    }
    return fautes;
  }

  it('aucune ombre extérieure et floue d’une couleur autre que le noir sur le combat', () => {
    expect(halos(CSS)).toEqual([]);
  });

  it('le contrôle mord : un halo néon sur une carte du plateau est vu', () => {
    const fautif = `${CSS}\n.card--plateau { box-shadow: 0 0 22px color-mix(in srgb, var(--scene-neon) 45%, transparent); }\n`;
    expect(halos(fautif)).toHaveLength(1);
  });

  it('le contrôle laisse passer ce qui est un état : le filet néon en ombre intérieure', () => {
    const permis = `${CSS}\n.board__side.is-x { box-shadow: inset 2px 0 0 var(--scene-neon); }\n`;
    expect(halos(permis)).toEqual([]);
  });
});
