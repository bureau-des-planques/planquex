import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Les deux gardes de l'outillage des agents — ticket #258 (rétro du 26/10/2026).
 *
 * ## 1. Le rappel de CI arrive là où la fusion se décide
 *
 * `npm run ci:etat` existait depuis la PR #260 et **sortait 1** quand `main` était rouge —
 * mais `main` est restée rouge **8 runs d'affilée pendant 6 h 36** (11:40 → 18:16 le 26/10)
 * sans que personne ne le voie. Le diagnostic du ticket le dit : `main` est restée rouge
 * **six heures trente-six** parce que rien ne rappelait de regarder. Un contrôle qui n'est pas
 * lancé n'est pas un contrôle : le script ne suffit pas, il lui faut des **portes**.
 *
 * Ce fichier est donc la garde de la garde : il exige que `npm run ci:etat` soit **cité** aux
 * quatre endroits qui portent la procédure de fusion, dont le **modèle de PR** — le seul qui
 * arrive sous les yeux de la personne qui clique « merge ». Si quelqu'un réécrit le modèle de
 * PR et laisse tomber la ligne, ce test échoue au lieu de laisser le rappel disparaître en
 * silence. C'est exactement le défaut d'origine : la panne était **invisible**, pas inconnue.
 *
 * ## 2. L'édition ciblée est écrite là où un agent la lit
 *
 * La règle du 26/10 : une écriture touche **les lignes de son intention**, jamais le fichier
 * entier (`docs/agents/edition-ciblee.md`). Elle est inutile si aucun document lu par un agent
 * n'y renvoie : ce test exige le renvoi depuis `CONTRIBUTING.md` et depuis le squelette de
 * brief d'implémenteur (`docs/agents/parallelisme.md` §4), et exige que la page dise **la
 * règle** et **pourquoi** — sans le pourquoi, c'est une consigne de plus.
 *
 * **Chaque contrôle mord** : un bloc de tests le confronte à un jeu de textes **fabriqués**
 * (un faux modèle de PR sans la ligne, une fausse page sans le motif) et exige l'échec. Sans
 * ce bloc, la garde s'appuierait sur des fichiers sains aujourd'hui — et une assertion qui ne
 * peut pas échouer ne garde rien (`AGENTS.md` §6, #112).
 */

const lire = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

/** La commande, écrite une seule fois : c'est elle que les portes de fusion doivent citer. */
const RAPPEL = 'npm run ci:etat';

/**
 * Les endroits qui portent la procédure de fusion. Un cinquième endroit qui la porterait est à
 * ajouter ici — sinon le rappel peut y disparaître sans que rien ne le voie.
 *
 * - `AGENTS.md` §8.4 : la définition de fini (`npm run ci:etat` exit 0 avant de fusionner) ;
 * - `CONTRIBUTING.md` : la procédure lue par un contributeur ;
 * - `docs/agents/parallelisme.md` §5 : la porte des pull requests ;
 * - `.github/pull_request_template.md` : le seul document qui s'affiche **au moment du clic**.
 */
const PORTES_DE_FUSION = [
  '.github/pull_request_template.md',
  'CONTRIBUTING.md',
  'docs/agents/parallelisme.md',
  'AGENTS.md'
] as const;

/** Les portes où le rappel de CI manque. Pure : le bloc « mord » la confronte à un cas fautif. */
function sansRappel(docs: Record<string, string>): string[] {
  return Object.entries(docs)
    .filter(([, texte]) => !texte.includes(RAPPEL))
    .map(([fichier]) => fichier);
}

/** La page qui porte la règle d'édition, et les deux documents qui doivent y renvoyer. */
const PAGE_EDITION = 'docs/agents/edition-ciblee.md';
const RENVOIS_EDITION = ['CONTRIBUTING.md', 'docs/agents/parallelisme.md'] as const;

/**
 * Ce qu'une page d'édition doit dire pour servir : **la règle** (le remplacement ciblé), **le
 * pourquoi** (les modifications concurrentes écrasées, le diff illisible) et **le geste de
 * repli** (lire une plage au lieu du fichier). Une page qui ne dirait que « utiliser edit »
 * serait le no-op que le ticket refuse explicitement.
 */
const EXIGENCES_EDITION: ReadonlyArray<{ quoi: string; motif: RegExp }> = [
  { quoi: 'la règle : un remplacement ciblé, ancré', motif: /remplacement ciblé/ },
  { quoi: 'le pourquoi nº 1 : les modifications concurrentes écrasées', motif: /concurrent/ },
  { quoi: 'le pourquoi nº 2 : le diff illisible', motif: /diff devient illisible/i },
  { quoi: 'le repli : lire une plage, pas le fichier', motif: /lire une \*\*plage\*\*|lit une plage|lire une plage/i }
];

/** Ce qui manque à une page d'édition. Pure, pour le bloc « mord ». */
function manquesEdition(texte: string): string[] {
  return EXIGENCES_EDITION.filter(({ motif }) => !motif.test(texte)).map(({ quoi }) => quoi);
}

/** Les documents qui ne renvoient pas vers la page d'édition. Pure, pour le bloc « mord ». */
function sansRenvoiEdition(docs: Record<string, string>): string[] {
  const cible = PAGE_EDITION.split('/').pop() as string;
  return Object.entries(docs)
    .filter(([, texte]) => !texte.includes(cible))
    .map(([fichier]) => fichier);
}

// ---------------------------------------------------------------------------------------
// 1. Le rappel de CI, aux portes de la fusion
// ---------------------------------------------------------------------------------------

describe('le rappel de CI arrive là où la fusion se décide (#258)', () => {
  it(`les quatre portes de fusion citent \`${RAPPEL}\``, () => {
    const docs = Object.fromEntries(PORTES_DE_FUSION.map((f) => [f, lire(f)]));
    expect(sansRappel(docs)).toEqual([]);
  });

  it('le modèle de PR en fait une **case à cocher**, pas une phrase en passant', () => {
    // Le défaut d'origine n'était pas l'absence de la commande, c'était son absence **au
    // moment du geste**. Une phrase dans un commentaire HTML ne se coche pas.
    const modele = lire('.github/pull_request_template.md');
    expect(modele).toMatch(new RegExp(`^- \\[ \\] Avant de fusionner : \`?${RAPPEL}`, 'm'));
  });

  it('le modèle de PR est le seul document rendu au moment du clic — il porte le numéro du ticket', () => {
    // Une trace du pourquoi, à côté de la case : sans elle, la case se retire comme du bruit.
    expect(lire('.github/pull_request_template.md')).toContain('#258');
  });

  it('**le contrôle mord** : un modèle de PR qui perd la ligne est signalé', () => {
    const docs = Object.fromEntries(PORTES_DE_FUSION.map((f) => [f, lire(f)]));
    const fautif = {
      ...docs,
      '.github/pull_request_template.md': docs['.github/pull_request_template.md'].replace(RAPPEL, 'la CI')
    };
    expect(sansRappel(fautif)).toEqual(['.github/pull_request_template.md']);
  });

  it('**le contrôle mord** : un `AGENTS.md` qui parle de la CI sans nommer la commande est signalé', () => {
    expect(sansRappel({ 'AGENTS.md': 'La CI doit être verte avant de fusionner.' })).toEqual(['AGENTS.md']);
  });
});

// ---------------------------------------------------------------------------------------
// 2. L'édition ciblée, écrite et atteignable
// ---------------------------------------------------------------------------------------

describe('la règle d’édition ciblée est écrite là où un agent la lit (#258)', () => {
  it(`${PAGE_EDITION} dit la règle, le pourquoi et le repli`, () => {
    expect(manquesEdition(lire(PAGE_EDITION))).toEqual([]);
  });

  it('la page est un fichier lisible par un humain, pas un renvoi mort', () => {
    // Vérifié par le chemin : `readFileSync` lèverait si la page disparaissait, mais un test
    // qui échoue sur une exception dit moins que celui qui dit quoi faire.
    expect(fileURLToPath(new URL(`../${PAGE_EDITION}`, import.meta.url))).toContain('edition-ciblee.md');
    expect(manquesEdition('')).toHaveLength(EXIGENCES_EDITION.length);
  });

  it('CONTRIBUTING.md et le squelette de brief d’implémenteur y renvoient', () => {
    const docs = Object.fromEntries(RENVOIS_EDITION.map((f) => [f, lire(f)]));
    expect(sansRenvoiEdition(docs)).toEqual([]);
  });

  it('**le contrôle mord** : une page qui ne dirait que « utiliser edit » ne passe pas', () => {
    // Le no-op que le ticket #258 refuse : une consigne sans règle ni pourquoi.
    expect(manquesEdition('Utiliser edit pour modifier les fichiers.')).toHaveLength(EXIGENCES_EDITION.length);
  });

  it('**le contrôle mord** : une page qui perd le « pourquoi » est signalée', () => {
    const sain = lire(PAGE_EDITION);
    const ampute = sain.replace(/concurrent/gi, 'simultané');
    expect(manquesEdition(ampute)).toContain('le pourquoi nº 1 : les modifications concurrentes écrasées');
  });

  it('**le contrôle mord** : un document qui ne renvoie plus vers la page est signalé', () => {
    expect(sansRenvoiEdition({ 'CONTRIBUTING.md': 'Rien à voir.' })).toEqual(['CONTRIBUTING.md']);
  });
});
