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
    expect(reglesFin[1].corps).toMatch(/background:\s*var\(--surface-claire\)/);
    expect(reglesFin[1].corps).toMatch(/border-color:\s*var\(--scene-go\)/);
    expect(reglesFin[2].corps).toMatch(/background:\s*var\(--scene-steel-deep\)/);
  });
});

/**
 * **La bande de score** (D-166, critique du 31/10/2026) : le score existait en hexagones, mais
 * **aucun chiffre** ne disait combien d'Interventions étaient marquées, ni combien il en faut.
 * Ces gardes tiennent les trois choses qui font exister le score à l'écran : une capsule écrite,
 * des hexagones plus gros que les autres mesures, et des places libres qui ne pèsent plus comme
 * des cartes.
 */
describe('la bande de score et les places libres (D-166)', () => {
  function reglesDe(css: string): { selecteur: string; corps: string }[] {
    const sans = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...sans.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({
      selecteur: m[1].trim().replace(/\s+/g, ' '),
      corps: m[2]
    }));
  }
  const trouve = (selecteur: string) => reglesDe(CSS).find((r) => r.selecteur === selecteur);

  it('le score s’écrit : capsule, chiffres et seuil ont un style (le contrôle mord : sans règle, le score retombe en texte nu)', () => {
    expect(trouve('.piste__score')?.corps).toMatch(/border:\s*1px solid/);
    expect(trouve('.piste__score')?.corps).toMatch(/border-radius:\s*999px/);
    expect(trouve('.piste__points')?.corps).toMatch(/font-size:\s*var\(--fs-md\)/);
    expect(trouve('.piste__seuil')?.corps).toMatch(/font-size:\s*var\(--fs-2xs\)/);
  });

  it('les hexagones du score sont les plus gros éléments de mesure du plateau', () => {
    // 1,35 rem = 21,6 px de haut (17,6 px avant D-166) ; les écrans courts les ramènent d'un cran
    // sous média, et c'est cette première règle-ci qui dit la taille de référence.
    expect(trouve('.piste__hex')?.corps).toMatch(/height:\s*1\.35rem/);
    expect(trouve('.piste__hex')?.corps).toMatch(/width:\s*1\.15rem/);
  });

  it('la place libre s’enfonce dans le feutre au lieu de peser comme une carte', () => {
    const libre = trouve('.bench__slot.is-free');
    expect(libre?.corps).toMatch(/box-shadow:\s*inset/);
    expect(libre?.corps).toMatch(/background:\s*color-mix/);
    // Le filet reste `--text-muted` : c'est lui qui tient les 3:1 (WCAG 1.4.11).
    expect(libre?.corps).toMatch(/border:\s*1px dashed var\(--text-muted\)/);
  });
});

/**
 * **Trois paliers de hauteur, pas un** (D-173, #580) : la référence 420 × 900, le **milieu**
 * 700–860 px (le Pixel 7 en navigation) et le **court** ≤ 700 px. Le palier du milieu n'avait
 * aucune taille propre — il reprenait celles de la référence — et D-173 exige qu'il se
 * **dérive de `100dvh`**, comme le PC de D-158, plutôt qu'un second jeu de constantes figées.
 * La garde vérifie la **forme** de cette dérivation, pas ses chiffres : ce sont les paliers qui
 * dictent les tailles, `npm run capturer` qui dit ce qui tient (D-094, D-157, D-167).
 */
describe('les trois paliers de hauteur du combat (D-173)', () => {
  /** Les blocs `@media` de la feuille, commentaires retirés, avec leur en-tête et leur corps. */
  function medias(css: string): { requete: string; corps: string }[] {
    const sans = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const out: { requete: string; corps: string }[] = [];
    const re = /@media([^{]+)\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sans))) {
      let i = re.lastIndex;
      let profondeur = 1;
      while (i < sans.length && profondeur > 0) {
        if (sans[i] === '{') profondeur++;
        else if (sans[i] === '}') profondeur--;
        i++;
      }
      out.push({ requete: m[1].replace(/\s+/g, ' ').trim(), corps: sans.slice(re.lastIndex, i - 1) });
    }
    return out;
  }

  /** Le palier 700–860 : sa présence, et le fait que ses tailles ne soient pas figées. */
  function fautesDesPaliers(css: string): string[] {
    const blocs = medias(css).filter(
      (b) => /min-height:\s*701px/.test(b.requete) && /max-height:\s*860px/.test(b.requete)
    );
    if (blocs.length === 0) return ['palier 700–860 absent : la bande du Pixel 7 n’a pas de taille propre'];
    const fautes: string[] = [];
    for (const bloc of blocs) {
      if (!/100dvh/.test(bloc.corps)) fautes.push('le palier 700–860 ne dérive pas de 100dvh');
      const poste = bloc.corps.match(/--poste-w:\s*([^;]+);/);
      if (!poste) fautes.push('le palier 700–860 ne pose pas --poste-w');
      else if (!/(clamp|100dvh|var\()/.test(poste[1])) fautes.push(`--poste-w figé : ${poste[1].trim()}`);
      const carte = bloc.corps.match(/--carte-w[^:]*:\s*([^;]+);/);
      if (!carte) fautes.push('le palier 700–860 ne pose pas --carte-w');
      else if (!/(clamp|100dvh|var\()/.test(carte[1])) fautes.push(`--carte-w figé : ${carte[1].trim()}`);
    }
    return fautes;
  }

  it('le palier 700–860 dérive ses tailles de la hauteur de la fenêtre', () => {
    expect(fautesDesPaliers(CSS)).toEqual([]);
  });

  it('la feuille garde les trois paliers : référence > 860, milieu 700–860, court ≤ 700', () => {
    const requetes = medias(CSS).map((b) => b.requete);
    expect(requetes.some((r) => /min-height:\s*701px/.test(r) && /max-height:\s*860px/.test(r))).toBe(true);
    expect(requetes.some((r) => /max-height:\s*700px/.test(r))).toBe(true);
    // La référence (420 × 900) reste le Poste de D-157 : 6 rem.
    expect(CSS).toMatch(/\.board__zone\s*\{[^}]*--poste-w:\s*6rem/);
  });

  it('le contrôle mord : un second jeu de constantes figées est refusé', () => {
    const fautif = `${CSS}\n@media (max-width: 899px) and (min-height: 701px) and (max-height: 860px) { .board__zone { --poste-w: 5.5rem; --banc-w: 3.5rem; } .battle .hand { --carte-w: 4.25rem; } }`;
    expect(fautesDesPaliers(fautif)).toEqual([
      'le palier 700–860 ne dérive pas de 100dvh',
      '--poste-w figé : 5.5rem',
      '--carte-w figé : 4.25rem'
    ]);
  });
});

/**
 * **La ligne de journal visuelle est retirée** (#742). Le journal ne vit plus que dans l'annonce
 * sr-only (`annonce-du-coup`, `aria-live`), et la console de bureau (`.journal-console`) n'existe
 * plus : le CSS n'a donc plus ni la règle `.combat-barre__journal`, ni la console.
 *
 * Le contrôle mord : si l'une des deux règles revient dans `src/styles.css`, la liste n'est plus vide.
 */
describe('le journal visuel n’existe plus dans le CSS (#742)', () => {
  /** Les sélecteurs qui portent encore la ligne de journal ou la console : la liste doit rester vide. */
  function journalDansLeCss(css: string): string[] {
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selecteurs = [...sansCommentaires.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim().replace(/\s+/g, ' '));
    return selecteurs.filter((s) => /combat-barre__journal|journal-console/.test(s));
  }

  it('ni `.combat-barre__journal` ni `.journal-console` ne sont des sélecteurs de src/styles.css', () => {
    expect(journalDansLeCss(CSS)).toEqual([]);
  });

  it('le contrôle mord : une règle `.combat-barre__journal` qui revient est refusée', () => {
    const fautif = '.combat-barre .combat-barre__journal { font-size: 0.8rem; }\n.journal-console { display: grid; }';
    expect(journalDansLeCss(fautif)).toEqual(['.combat-barre .combat-barre__journal', '.journal-console']);
  });
});

/**
 * **Les actions du tour quittent le bas de l'écran** (retour du propriétaire, téléphone). La barre
 * `.combat-barre` n'existe plus : la pile `.actions-flottantes` et la bulle `.combat-superpose` se
 * posent sur la table, en position absolue — jamais en `sticky` ni `static` sous la main.
 *
 * Le contrôle mord : une règle `.combat-barre` qui revient, ou une pile `static`, est refusée.
 */
describe('les actions du tour se posent sur la table, pas sous la main', () => {
  /** Les sélecteurs qui visent encore la barre du bas (`.combat-barre`, pas ses `__enfants` gardés). */
  function barreDuBasDans(css: string): string[] {
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selecteurs = [...sansCommentaires.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim().replace(/\s+/g, ' '));
    return selecteurs.filter((s) => /\.combat-barre(?![\w-])/.test(s));
  }

  /** La `position` de la règle `.actions-flottantes` (la première qui la porte), `null` si absente. */
  function positionDeLaPile(css: string): string | null {
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const bloc = sansCommentaires.match(/(?:^|\})\s*\.actions-flottantes\s*\{([^}]*)\}/);
    return bloc ? (bloc[1].match(/position:\s*([a-z]+)/)?.[1] ?? null) : null;
  }

  it('aucune règle `.combat-barre` ne reste dans src/styles.css', () => {
    expect(barreDuBasDans(CSS)).toEqual([]);
  });

  it('la pile d’actions est en position absolue, dans la table', () => {
    expect(positionDeLaPile(CSS)).toBe('absolute');
  });

  it('le contrôle mord : une barre du bas rétablie sous la console, ou une pile `static`, est refusée', () => {
    const fautif = '.battle__console .combat-barre { order: 1; }\n.actions-flottantes { position: static; }';
    expect(barreDuBasDans(fautif)).toEqual(['.battle__console .combat-barre']);
    expect(positionDeLaPile(fautif)).toBe('static');
  });
});

/**
 * La `min-height` (en px) de la **dernière** règle de `selecteur` qui la porte : c'est elle qui
 * l'emporte en cascade. `null` si aucune règle ne la déclare. Lu dans la feuille, pas dans le DOM :
 * jsdom ne calcule pas de mise en page (`getBoundingClientRect` y vaut 0).
 */
function minHeightPx(css: string, selecteur: string): number | null {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  let trouve: number | null = null;
  for (const regle of sansCommentaires.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (regle[1].trim().replace(/\s+/g, ' ') !== selecteur) continue;
    const mesure = regle[2].match(/min-height:\s*([\d.]+)(rem|px)\s*;/);
    if (mesure) trouve = Number(mesure[1]) * (mesure[2] === 'rem' ? 16 : 1);
  }
  return trouve;
}

describe('le bouton du Rebut tient 44 px de haut (#740, D-116 (1))', () => {
  it('la règle `.battle .pile--rebut` déclare au moins 44 px de `min-height`', () => {
    expect(minHeightPx(CSS, '.battle .pile--rebut')).toBeGreaterThanOrEqual(44);
  });

  it('le contrôle mord : un Rebut de 2 rem (32 px) est refusé, en `rem` comme en `px`', () => {
    expect(minHeightPx('.battle .pile--rebut { min-height: 2rem; }', '.battle .pile--rebut')).toBeLessThan(44);
    expect(minHeightPx('.battle .pile--rebut { min-height: 32px; }', '.battle .pile--rebut')).toBeLessThan(44);
  });

  it('le contrôle mord : sans `min-height`, la mesure ne trouve rien', () => {
    expect(minHeightPx('.battle .pile--rebut { cursor: pointer; }', '.battle .pile--rebut')).toBeNull();
  });
});

/**
 * Le corps de chaque `@media <requete> { … }` de la feuille (accolades appariées, commentaires
 * blanchis). Lu dans la feuille : jsdom ne sait pas évaluer une requête de média.
 */
function corpsDesMedias(css: string, requete: string): string[] {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const debut = `@media ${requete} {`;
  const corps: string[] = [];
  let i = sansCommentaires.indexOf(debut);
  while (i !== -1) {
    const premier = i + debut.length;
    let niveau = 1;
    let k = premier;
    while (k < sansCommentaires.length && niveau > 0) {
      if (sansCommentaires[k] === '{') niveau += 1;
      else if (sansCommentaires[k] === '}') niveau -= 1;
      k += 1;
    }
    corps.push(sansCommentaires.slice(premier, k - 1));
    i = sansCommentaires.indexOf(debut, k);
  }
  return corps;
}

/** Les déclarations de `selecteur` dans un corps de règles ; la dernière règle qui la porte l'emporte. */
function declarationsDe(corps: string, selecteur: string): Map<string, string> {
  const sortie = new Map<string, string>();
  for (const regle of corps.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (regle[1].trim().replace(/\s+/g, ' ') !== selecteur) continue;
    for (const [, propriete, valeur] of regle[2].matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) {
      sortie.set(propriete, valeur.trim());
    }
  }
  return sortie;
}

/** Les déclarations de `selecteur` dans **tous** les médias `requete` de `css`, fusionnées. */
function declarationsDansMedia(css: string, requete: string, selecteur: string): Map<string, string> {
  const fusion = new Map<string, string>();
  for (const corps of corpsDesMedias(css, requete)) {
    for (const [propriete, valeur] of declarationsDe(corps, selecteur)) fusion.set(propriete, valeur);
  }
  return fusion;
}

/** Les déclarations de `selecteur` hors de tout média (règles de base). */
function declarationsDeBase(css: string, selecteur: string): Map<string, string> {
  return declarationsDe(
    css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')),
    selecteur
  );
}

/**
 * **L'écran large (≥ 900 px) suit la composition du téléphone** (D-200, #790) : la table ronde centrée, la
 * main rognée en bas de la fenêtre, « Fin du tour » flottant à droite. La colonne de droite de #750
 * (plateau à gauche, main entière en haut de la colonne, pile d'actions dessous) n'existe plus. Lu dans la
 * feuille, média `(min-width: 900px)` ; le média partagé porte la composition.
 * Le contrôle mord : chaque règle est refusée dans sa forme fautive (l'ancienne règle de colonne).
 */
describe('l’écran large : la composition du téléphone, plus de colonne de droite (D-200, #790)', () => {
  const LARGE = '(min-width: 900px)';
  const PARTAGE = '(max-width: 639px), (min-width: 900px)';

  /** Les règles de **colonne** dans un média ≥ 900 px : la grille du plateau, la pile sous la main, la main entière. */
  function reglesDeColonne(css: string): string[] {
    const trouvees: string[] = [];
    for (const corps of corpsDesMedias(css, LARGE)) {
      const table = declarationsDe(corps, '.battle__table');
      if (table.get('display') === 'grid' || table.has('grid-template-columns'))
        trouvees.push('.battle__table en grille');
      const consoleDeDroite = declarationsDe(corps, '.battle__console');
      if (consoleDeDroite.has('grid-column') || consoleDeDroite.has('grid-row'))
        trouvees.push('.battle__console en colonne');
      const actions = declarationsDe(corps, '.battle .actions-flottantes');
      if (actions.get('top') === 'auto') trouvees.push('pile d’actions sous la main');
      if ((declarationsDe(corps, '.battle .hand').get('height') ?? '').includes('88 / 63'))
        trouvees.push('main entière');
      if (declarationsDe(corps, '.battle .inspecteur').get('position') === 'sticky')
        trouvees.push('inspecteur en colonne');
    }
    return trouvees;
  }

  it('aucune règle de colonne dans le média ≥ 900 px', () => {
    expect(reglesDeColonne(CSS)).toEqual([]);
  });

  it('le contrôle mord : l’ancienne grille à deux colonnes de #750 est refusée', () => {
    const fautif =
      '@media (min-width: 900px) { .battle__table { align-items: start; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); } }';
    expect(reglesDeColonne(fautif)).toEqual(['.battle__table en grille']);
  });

  it('le contrôle mord : l’ancienne pile d’actions sous la main et la main entière sont refusées', () => {
    const fautif =
      '@media (min-width: 900px) { .battle .actions-flottantes { bottom: 1rem; top: auto; } .battle .hand { height: calc(var(--carte-w) * 88 / 63 + 1.2rem); } }';
    expect(reglesDeColonne(fautif)).toEqual(['pile d’actions sous la main', 'main entière']);
  });

  it('le contrôle mord : l’inspecteur collé en haut d’une colonne (sticky) est refusé', () => {
    const fautif = '@media (min-width: 900px) { .battle .inspecteur { position: sticky; top: 0.5rem; } }';
    expect(reglesDeColonne(fautif)).toEqual(['inspecteur en colonne']);
  });

  it('la composition du téléphone est celle du média partagé : table zoomée, main rognée, voile du nom', () => {
    expect(declarationsDansMedia(CSS, PARTAGE, '.battle__table').get('overflow')).toBe('hidden');
    expect(declarationsDansMedia(CSS, PARTAGE, '.battle .board').get('transform')).toContain('rotateX(4deg)');
    expect(declarationsDansMedia(CSS, PARTAGE, '.battle .hand').get('height')).toBe('3.5rem');
    expect(declarationsDansMedia(CSS, PARTAGE, '.battle .hand .card__voile').get('top')).toBe('0');
  });

  it('le téléphone ne bouge pas : la main reste à 3,5 rem dans le média partagé', () => {
    expect(declarationsDansMedia(CSS, PARTAGE, '.battle .hand').get('height')).toBe('3.5rem');
    expect(declarationsDansMedia(CSS, '(max-width: 639px)', '.board').get('padding')).toBe('0.05rem');
  });

  /** La bande de la main sur bureau : 7 % de la hauteur, entre 56 px (3,5 rem) et 72 px (4,5 rem). */
  function bandeDeMain(css: string): { jeton: string | undefined; hauteur: string | undefined } {
    const corps = corpsDesMedias(css, LARGE).join('\n');
    return {
      jeton: declarationsDe(corps, '.app-shell:has(.battle)').get('--main-bande'),
      hauteur: declarationsDe(corps, '.battle .hand').get('height')
    };
  }

  it('la main de bureau montre une bande de 56 à 72 px, qui suit la hauteur de la fenêtre', () => {
    const { jeton, hauteur } = bandeDeMain(CSS);
    expect(jeton).toBe('clamp(3.5rem, 7dvh, 4.5rem)');
    expect(hauteur).toBe('var(--main-bande)');
  });

  it('le contrôle mord : une main entière ou une bande de 8 rem est refusée', () => {
    const fautif =
      '@media (min-width: 900px) { .app-shell:has(.battle) { --main-bande: 8rem; } .battle .hand { height: 9rem; } }';
    expect(bandeDeMain(fautif).jeton).not.toBe('clamp(3.5rem, 7dvh, 4.5rem)');
    expect(bandeDeMain(fautif).hauteur).not.toBe('var(--main-bande)');
  });

  it('la table est un rond centré dont le diamètre suit la hauteur de la fenêtre', () => {
    const corps = corpsDesMedias(CSS, LARGE).join('\n');
    expect(declarationsDe(corps, '.app-shell:has(.battle)').get('--table-d')).toBe('calc(91dvh - 8.3rem)');
    expect(declarationsDe(corps, '.battle .board').get('width')).toBe('min(100%, var(--table-d))');
    expect(declarationsDe(corps, '.battle .board').get('align-self')).toBe('center');
    expect(declarationsDe(corps, '.battle .board::after').get('aspect-ratio')).toBe('1');
  });

  it('« Fin du tour » flotte à droite : la pile garde la règle de base (milieu, à droite), aucune surcharge de bureau', () => {
    expect(declarationsDansMedia(CSS, LARGE, '.battle .actions-flottantes').size).toBe(0);
    const base = declarationsDeBase(CSS, '.actions-flottantes');
    expect(base.get('right')).toBe('0.5rem');
    expect(base.get('top')).toBe('50%');
  });

  it('les piles restent entières sur les côtés de la table : aucun décalage négatif en écran large', () => {
    for (const selecteur of [
      '.battle .board__side.is-direction .piles',
      '.battle .board__side:not(.is-direction) .piles'
    ]) {
      const decl = declarationsDansMedia(CSS, LARGE, selecteur);
      expect(decl.size).toBeGreaterThan(0);
      for (const valeur of [decl.get('left'), decl.get('right')]) {
        expect(valeur ?? '').not.toMatch(/^-/);
      }
    }
  });

  it('le contrôle mord : une pile à moitié sortie (left: -1.7rem) est refusée', () => {
    const fautif = '@media (min-width: 900px) { .battle .board__side.is-direction .piles { left: -1.7rem; } }';
    expect(declarationsDansMedia(fautif, LARGE, '.battle .board__side.is-direction .piles').get('left')).toMatch(/^-/);
  });

  it('l’inspecteur flotte à côté de la carte : position posée par l’écran, hauteur bornée au-dessus de la main', () => {
    const decl = declarationsDansMedia(CSS, LARGE, '.battle .inspecteur');
    expect(decl.get('left')).toBe('var(--inspecteur-gauche, 1rem)');
    expect(decl.get('top')).toBe('var(--inspecteur-haut, 5rem)');
    expect(decl.get('max-height')).toContain('var(--main-bande');
    expect(decl.get('position')).toBeUndefined();
  });
});

/**
 * **La bulle du tour s'efface** (D-193 (2), #750) : `.combat-toast--sorti` fond par `opacity` et
 * `visibility`, sans `display` (qui referait la mise en page). Sous « Mouvement réduit », aucune
 * transition : la bulle disparaît à la même échéance.
 */
describe('la bulle du tour s’efface sans changer la mise en page (#750)', () => {
  const FONDU = '.battle .combat-toast--sorti';
  const REDUIT = ":root[data-mouvement-reduit='true'] .battle .combat-toast--sorti";

  it('la classe cachée rend la bulle transparente et invisible, sans `display: none`', () => {
    const decl = declarationsDeBase(CSS, FONDU);
    expect(decl.get('opacity')).toBe('0');
    expect(decl.get('visibility')).toBe('hidden');
    expect(decl.get('display')).toBeUndefined();
  });

  it('sous « Mouvement réduit », la transition est coupée', () => {
    expect(declarationsDeBase(CSS, REDUIT).get('transition')).toBe('none');
  });

  it('le contrôle mord : une bulle cachée par `display: none` saute la mise en page et est refusée', () => {
    const fautif = '.battle .combat-toast--sorti { display: none; }';
    expect(declarationsDeBase(fautif, FONDU).get('display')).toBe('none');
  });

  it('le contrôle mord : sans `opacity: 0`, la bulle ne fond pas et est refusée', () => {
    const fautif = '.battle .combat-toast--sorti { visibility: hidden; }';
    expect(declarationsDeBase(fautif, FONDU).get('opacity')).not.toBe('0');
  });
});

/**
 * **La bulle du tour respire** (#784) : `cramped-padding` (#205) exige 8 px entre le texte et le bord.
 * La bulle n'est affichée que quand un avis existe : à 4,8 px de rembourrage, `npm run detect:ui:page`
 * rougissait `/battle` de façon intermittente (run #844 de `main`).
 */
describe('la bulle du tour garde 8 px de rembourrage vertical (#784)', () => {
  const rem = (v: string) => (v.endsWith('px') ? parseFloat(v) / 16 : parseFloat(v));
  function rembourrageVertical(feuille: string): number[] {
    const sans = feuille.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...sans.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .filter((m) => /\.combat-toast$/.test(m[1].trim().replace(/\s+/g, ' ')))
      .map((m) => m[2].match(/(?:^|[;\s])padding:\s*([^;\s]+)/)?.[1])
      .filter((v): v is string => v !== undefined)
      .map(rem);
  }

  it('toutes les règles de la bulle donnent au moins 0,5 rem en haut et en bas', () => {
    const valeurs = rembourrageVertical(CSS);
    expect(valeurs.length).toBeGreaterThanOrEqual(2);
    expect(valeurs.filter((v) => v < 0.5)).toEqual([]);
  });

  // Sans ce cas, l'assertion ne garderait rien.
  it('le contrôle mord : un rembourrage de 0,3 rem est refusé', () => {
    expect(rembourrageVertical('.battle .combat-toast { padding: 0.3rem 0.6rem; }')).toEqual([0.3]);
    expect(rembourrageVertical('.combat-toast { padding: 8px 10px; }')).toEqual([0.5]);
  });
});

/**
 * **La bulle ne recouvre pas les piles sur bureau** (#784, D-200) : à 1280 × 800 elle allait de 24 à 676 px
 * alors que le Deck de la Direction est à 554–632 px : `text-occlusion` (« Deck » couvert à 100 %), le
 * constat du run #844 de `main`. Depuis D-200 la bulle est centrée au-dessus de la table ronde et sa
 * largeur retire la place des piles (13 rem : deux fois 5 rem de pile et leurs marges) au diamètre de la table.
 */
describe('sur bureau, la bulle du tour laisse la place des piles (#784, D-200)', () => {
  function largeurBureau(feuille: string): string | undefined {
    return declarationsDansMedia(feuille, '(min-width: 900px)', '.battle .combat-superpose').get('width');
  }

  it('la largeur retire 13 rem au diamètre de la table', () => {
    expect(largeurBureau(CSS)).toMatch(/calc\(var\(--table-d\) - 13rem\)/);
  });

  // Sans ce cas, l'assertion ne garderait rien.
  it("le contrôle mord : la largeur d'avant (colonne entière) est refusée", () => {
    const fautif =
      '@media (min-width: 900px) { .battle .combat-superpose { right: auto; width: calc((100% - 0.85rem) * 1.15 / 2.15 - 0.5rem); } }';
    expect(largeurBureau(fautif)).not.toMatch(/calc\(var\(--table-d\) - 13rem\)/);
  });
});
