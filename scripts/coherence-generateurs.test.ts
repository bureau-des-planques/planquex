import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ETAPES } from './plan-dev.mjs';

/**
 * **Les générateurs et les documents qui les décrivent** — la garde du #359.
 *
 * Le dépôt a deux stades d'écriture : `docs/DECISIONS.md` tranche, `AGENTS.md` résume, et
 * **les scripts font**. Quand une décision bouge le code sans bouger la prose, un agent lit
 * la mauvaise règle. Trois décalages de la même famille en une semaine (le compte de
 * décisions, « le dépôt est privé », « les issues `alpha` » alors que le générateur lit
 * `alpha` **et** `beta`), et le défaut du 28/10/2026 : **deux docs affirmaient un fait faux
 * sur le code** — `supabase/README.md` annonçait un écart déjà levé, `docs/VERSIONS.md`
 * promettait un remplacement (`{libellé}`) qu'**aucun script ne faisait**.
 *
 * **Ce que cette garde ne refait pas**, et pourquoi (une garde en double se corrige deux
 * fois) :
 *
 * - le **compte de décisions** est déjà gardé par `scripts/coherence-docs.test.ts` §1 ;
 * - les **commandes** citées le sont aussi (`docs/COMMANDES.md` ↔ `package.json`), ainsi que
 *   les **décomptes de cartes** (`scripts/compteurs.test.ts`) et la **continuité du
 *   journal** (`scripts/decisions.test.ts`).
 *
 * Ici, trois contrôles neufs, tous par **lecture de fichier** (aucun réseau, aucune
 * commande) :
 *
 * 1. **les étiquettes d'étape du générateur** — `npm run plan:dev` consomme `ETAPES` ; un
 *    document qui décrit le générateur **et nomme une étiquette** doit les nommer
 *    **toutes**. C'est le décalage du 27/10/2026 : « une issue `alpha` périme
 *    `src/data/plan-dev.ts` » alors qu'un ticket `beta` le périme aussi (#336) ;
 * 2. **les fichiers générés et leur script** — tout fichier annoncé comme généré doit avoir
 *    son `npm run X`, et le script doit exister ;
 * 3. **les promesses de remplacement** — un document vivant qui annonce un remplacement
 *    automatique (un texte entre accolades, « sera remplacé par ») doit nommer le code qui
 *    le fait, et ce code doit contenir le marqueur. Une promesse sans code derrière est un
 *    mensonge daté : c'est le défaut du 28/10/2026.
 *
 * Chaque contrôle **mord** : le troisième bloc confronte les fonctions à des textes
 * **fabriqués**, et exige l'échec (`AGENTS.md` §6, #112).
 */

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const chemin = (file: string) => fileURLToPath(new URL(`../${file}`, import.meta.url));

// ---------------------------------------------------------------------------------------
// 1. Les étiquettes d'étape du générateur
// ---------------------------------------------------------------------------------------

/**
 * Les documents qui peuvent décrire `npm run plan:dev`. C'est une **liste**, pas le dépôt
 * entier : les décisions, les instantanés datés et les dossiers d'arbitrage ne se réécrivent
 * pas (D-111, D-112), et un fait daté qui cite l'ancien libellé reste vrai à sa date.
 */
const DOCUMENTS_GENERATEUR = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  'docs/ARCHITECTURE.md',
  'docs/COMMANDES.md',
  'docs/VERSIONS.md',
  'docs/agents/issue-tracker.md'
] as const;

/** Une ligne qui décrit le générateur — par son script ou par son fichier. */
const LIGNE_GENERATEUR = /plan:dev|plan-dev\.ts/;

/**
 * Les **dettes connues** : un document qui nomme une étiquette d'étape **sans les nommer
 * toutes**, avec son ticket. Une dette est vérifiée dans les deux sens — elle doit décrire
 * un manque **réel**, et le test échoue dès que le document est corrigé, pour qu'on la
 * retire au lieu de la laisser traîner.
 */
const DETTES_ETIQUETTES: readonly { fichier: string; manque: readonly string[]; ticket: string; raison: string }[] = [
  {
    fichier: 'AGENTS.md',
    manque: ['beta'],
    ticket: '#359',
    raison:
      '§11 dit encore « Fermer ou ouvrir une issue `alpha` périme `src/data/plan-dev.ts` », alors que le ' +
      'générateur lit `alpha` **et** `beta` depuis #336. `AGENTS.md` est un document d’autorité : la ligne ' +
      'appartient à Bastien, pas à un agent. Corriger la phrase, puis retirer cette entrée.'
  }
];

/** Le libellé d'une étiquette, entre backticks ou nu (`` `alpha` ``, « issues alpha »). */
function nommeEtiquette(ligne: string, etiquette: string): boolean {
  return new RegExp(`\`${etiquette}\`|\\b${etiquette}\\b`, 'i').test(ligne);
}

/**
 * Ce qu'un document dit du générateur : les lignes qui le décrivent, et les étiquettes
 * qu'elles nomment. Un document qui nomme le générateur **sans nommer aucune étiquette**
 * n'est pas en faute : il parle du script, pas de ce qu'il lit (`docs/VERSIONS.md` le cite
 * pour la publication, sans dire quelles issues en sortent).
 */
function etiquettesDuGenerateur(texte: string, etapes: readonly string[] = ETAPES) {
  const lignes = texte.split('\n').filter((ligne) => LIGNE_GENERATEUR.test(ligne));
  const nommees = etapes.filter((etape) => lignes.some((ligne) => nommeEtiquette(ligne, etape)));
  return { lignes: lignes.length, nommees };
}

/**
 * Les étiquettes **manquantes** d'un document, une fois la dette connue déduite. Vide quand
 * le document nomme toutes les étiquettes du générateur, ou quand il n'en nomme aucune.
 */
function etiquettesManquantes(
  texte: string,
  dettes: readonly { manque: readonly string[] }[] = [],
  etapes: readonly string[] = ETAPES
): string[] {
  const { lignes, nommees } = etiquettesDuGenerateur(texte, etapes);
  if (lignes === 0 || nommees.length === 0) return [];
  const connues = new Set(dettes.flatMap((dette) => dette.manque));
  return etapes.filter((etape) => !nommees.includes(etape) && !connues.has(etape));
}

// ---------------------------------------------------------------------------------------
// 2. Les fichiers générés et leur script
// ---------------------------------------------------------------------------------------

/**
 * Ce qu'un document annonce comme **généré**, avec la commande qui le génère. La source du
 * nom de la commande est `package.json` : un script renommé fait échouer la garde au lieu de
 * laisser la doc citer une commande morte.
 */
const FICHIERS_GENERES = [
  { fichier: 'src/data/plan-dev.ts', script: 'plan:dev', fichierScript: 'scripts/plan-dev.mjs' },
  { fichier: 'src/data/versions.ts', script: 'notes:versions', fichierScript: 'scripts/notes-versions.mjs' },
  { fichier: 'docs/DECISIONS-INDEX.md', script: 'index:decisions', fichierScript: 'scripts/index-decisions.mjs' }
] as const;

// ---------------------------------------------------------------------------------------
// 3. Les promesses de remplacement
// ---------------------------------------------------------------------------------------

/**
 * Les documents **vivants** lus par la promesse : ceux qu'un agent suit pour produire un
 * artefact (une release, un message, une intégration). Plus étroit que la liste de
 * `scripts/coherence-docs.test.ts` §3, et volontairement : la promesse porte sur un geste,
 * pas sur le vocabulaire. Les décisions et les instantanés datés n'y sont pas — un acte
 * daté ne se réécrit pas (D-111).
 */
const DOCUMENTS_PROMESSES = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  'README.md',
  'docs/ALPHA-TESTEURS.md',
  'docs/ARCHITECTURE.md',
  'docs/COMMANDES.md',
  'docs/INTEGRATIONS-DISCORD.md',
  'docs/VERSIONS.md',
  'docs/agents/issue-tracker.md',
  'docs/agents/parallelisme.md',
  'docs/agents/triage-labels.md'
] as const;

/**
 * Ce qui **promet** un remplacement automatique :
 *
 * - un texte entre accolades qui ressemble à un libellé humain — `{libellé}`, `{titre de la
 *   version}`. Les accolades de code (`{"body": …}`, `{env:NOM}`, `{type, message}`) ne
 *   passent pas : elles portent un deux-points, une virgule, des guillemets ou un point ;
 * - la phrase « sera remplacé par », « remplace automatiquement ».
 */
const PROMESSE_LIBELLE = /\{[a-zà-ÿ][a-zà-ÿ '’-]{2,}\}/giu;
const PROMESSE_PHRASE = /sera remplac[ée]e?s? (?:automatiquement )?par|remplac[ée]e?s? automatiquement/giu;

/** Les promesses trouvées dans un texte, avec leur ligne. */
function promesses(texte: string): { ligne: number; marqueur: string }[] {
  const trouvees: { ligne: number; marqueur: string }[] = [];
  texte.split('\n').forEach((brute, index) => {
    for (const motif of [PROMESSE_LIBELLE, PROMESSE_PHRASE]) {
      motif.lastIndex = 0;
      for (const trouve of brute.matchAll(motif)) trouvees.push({ ligne: index + 1, marqueur: trouve[0] });
    }
  });
  return trouvees;
}

/**
 * Les promesses **tenues** : le marqueur, et le code qui le remplace. Vide aujourd'hui, et
 * c'est l'état sain — le `{libellé}` de `docs/VERSIONS.md` a été retiré par #356, parce
 * qu'aucun script ne le remplaçait. Une promesse qui revient sans code échoue ici.
 */
const PROMESSES_TENUES: readonly { document: string; marqueur: string; code: string }[] = [];

/** Une promesse non tenue : elle n'est pas déclarée, ou son code ne porte pas le marqueur. */
function promessesSansCode(
  texte: string,
  document: string,
  tenues: readonly { document: string; marqueur: string; code: string }[] = PROMESSES_TENUES,
  lireCode: (fichier: string) => string | null = (fichier) => (existsSync(chemin(fichier)) ? read(fichier) : null)
): { ligne: number; marqueur: string; raison: string }[] {
  return promesses(texte).flatMap(({ ligne, marqueur }) => {
    const tenue = tenues.find((declaree) => declaree.document === document && declaree.marqueur === marqueur);
    if (!tenue) {
      return [{ ligne, marqueur, raison: 'aucun code déclaré ne la remplace — la retirer, ou la tenir' }];
    }
    const code = lireCode(tenue.code);
    if (code === null) return [{ ligne, marqueur, raison: `${tenue.code} n’existe pas` }];
    if (!code.includes(marqueur)) {
      return [{ ligne, marqueur, raison: `${tenue.code} ne porte pas ${JSON.stringify(marqueur)}` }];
    }
    return [];
  });
}

// ---------------------------------------------------------------------------------------
// 4. La porte des pull requests (#268, D-131)
// ---------------------------------------------------------------------------------------

/** Le protocole de fusion — la porte des PR s'écrit là (D-131), et nulle part ailleurs en double. */
const PROTOCOLE_FUSION = 'docs/agents/parallelisme.md';

/**
 * Ce que la porte **doit** dire, et que ce contrôle exige dans le protocole : les deux cas de
 * PR, la fusion réservée, et le renvoi à la cadence au lieu de sa réécriture (D-128 est écrite
 * dans `docs/VERSIONS.md` §4). Chaque motif peut manquer : c'est la garde qui mord.
 */
const PORTE_ATTENDUE = [
  {
    quoi: 'la fusion réservée à Bastien (D-131)',
    motif: /seul le compte\s+de\s+\*\*Bastien\*\*\s+(?:peut|puisse) fusionner/i
  },
  { quoi: 'la PR de Bastien sans relecture obligatoire', motif: /PR de Bastien[^\n]*pas de relecture obligatoire/i },
  {
    quoi: 'la PR externe relue par un agent qui n’a pas écrit le code',
    motif: /un agent qui n['’]a pas écrit le code/i
  },
  { quoi: 'le compte rendu de relecture publié sur la PR', motif: /compte rendu publié sur la PR/i },
  { quoi: 'la validation écrite de Bastien', motif: /validation écrite/i },
  { quoi: 'le merge commit comme seule forme (D-113)', motif: /merge commit/i },
  {
    quoi: 'le renvoi à la cadence de release (D-128, docs/VERSIONS.md §4)',
    motif: /docs\/VERSIONS\.md\*\* §4|`docs\/VERSIONS\.md` §4/i
  }
] as const;

/** Ce que le protocole ne dit pas — vide quand la porte est complète. */
function porteManquante(
  texte: string,
  attendue: readonly { quoi: string; motif: RegExp }[] = PORTE_ATTENDUE
): string[] {
  return attendue.filter(({ motif }) => !motif.test(texte)).map(({ quoi }) => quoi);
}

// ---------------------------------------------------------------------------------------
// 5. Les étiquettes de travail (#282, D-129)
// ---------------------------------------------------------------------------------------

/** Le document qui fixe le vocabulaire des étiquettes — seule source (D-129). */
const TRIAGE = 'docs/agents/triage-labels.md';

/**
 * Les **cinq rôles canoniques** (D-129) et les **étapes** que la feuille de route lit. Les
 * deux listes viennent de sources différentes et doivent se retrouver dans le même
 * document : renommer une étiquette d'étape dans le générateur (`ETAPES`) sans la renommer
 * ici laisse des tickets étiquetés avec un mot que la page ne lit plus — la feuille de
 * route se vide, sans erreur. Le blocage par un autre ticket ne s'étiquette pas : il
 * s'écrit dans le corps (`docs/agents/triage-labels.md`), et il n'existe pas d'étiquette
 * `blocked`.
 */
const ROLES_TRIAGE = ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', 'wontfix'] as const;

/** Les étiquettes manquantes d'un document, rôle par rôle et étape par étape. */
function etiquettesDeTravailManquantes(
  texte: string,
  roles: readonly string[] = ROLES_TRIAGE,
  etapes: readonly string[] = ETAPES
): string[] {
  return [...roles, ...etapes].filter((etiquette) => !new RegExp(`\`${etiquette}\``).test(texte));
}

// ---------------------------------------------------------------------------------------
// Les contrôles sur les fichiers du dépôt
// ---------------------------------------------------------------------------------------

describe('Générateurs — les étiquettes d’étape (#359)', () => {
  it('le générateur est lu et lit des étapes (sinon rien n’est gardé)', () => {
    expect(ETAPES).toContain('alpha');
    expect(ETAPES.length).toBeGreaterThan(1);
  });

  it.each([...DOCUMENTS_GENERATEUR])('%s nomme toutes les étiquettes du générateur', (fichier) => {
    expect(existsSync(chemin(fichier)), `${fichier} a disparu : la garde ne le lit plus`).toBe(true);
    const dettes = DETTES_ETIQUETTES.filter((dette) => dette.fichier === fichier);
    const manquantes = etiquettesManquantes(read(fichier), dettes);
    expect(
      manquantes,
      `${fichier} décrit \`npm run plan:dev\` sans nommer ${manquantes.join(', ')} : le générateur lit ` +
        `les issues ${ETAPES.map((etape) => `\`${etape}\``).join(' et ')} (#336). Une issue oubliée ` +
        'périme le fichier sans qu’on le sache.'
    ).toEqual([]);
  });

  it('une dette connue décrit un manque réel, et se retire quand il est corrigé', () => {
    for (const dette of DETTES_ETIQUETTES) {
      expect(dette.ticket, `dette sans ticket : ${dette.fichier}`).toMatch(/^#\d+$/);
      expect(
        etiquettesManquantes(read(dette.fichier), []),
        `${dette.fichier} nomme désormais toutes les étiquettes : retirer sa dette (${dette.ticket}) de ` +
          '`DETTES_ETIQUETTES` plutôt que la laisser traîner.'
      ).toEqual(expect.arrayContaining([...dette.manque]));
    }
  });
});

describe('Générateurs — les fichiers générés et leur script (#359)', () => {
  it.each([...FICHIERS_GENERES])('%s est produit par un script qui existe', ({ fichier, script, fichierScript }) => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts[script], `\`npm run ${script}\` a disparu de package.json`).toBe(`node ${fichierScript}`);
    expect(existsSync(chemin(fichierScript)), `${fichierScript} n’existe pas`).toBe(true);
    expect(existsSync(chemin(fichier)), `${fichier} n’existe pas : la doc annonce un fichier absent`).toBe(true);
  });

  it('tout fichier annoncé comme généré par une doc a sa commande', () => {
    // La garde des commandes (`scripts/coherence-docs.test.ts` §2) vérifie que `npm run X`
    // existe ; celle-ci vérifie le lien inverse, celui qui a menti le 28/10/2026 : un
    // fichier annoncé « généré » sans que rien ne le génère.
    const annonces = FICHIERS_GENERES.filter(({ fichier, script }) => {
      const cite = ['AGENTS.md', 'docs/ARCHITECTURE.md', 'docs/COMMANDES.md', 'docs/VERSIONS.md'].some((doc) =>
        read(doc).includes(fichier.replace(/^.*\//, ''))
      );
      return cite && !read('package.json').includes(`"${script}"`);
    });
    expect(annonces, 'un fichier est annoncé comme généré sans commande pour le faire').toEqual([]);
  });
});

describe('Promesses — une annonce de remplacement a du code derrière (#359)', () => {
  it.each([...DOCUMENTS_PROMESSES])('%s ne promet pas un remplacement sans code', (document) => {
    const sansCode = promessesSansCode(read(document), document);
    expect(
      sansCode,
      `promesse(s) sans code dans ${document} :\n  ` +
        sansCode.map(({ ligne, marqueur, raison }) => `${ligne} ${JSON.stringify(marqueur)} — ${raison}`).join('\n  ') +
        '\nUn document vivant n’annonce que ce qui a un script : sinon il promet un geste que personne ne fait.'
    ).toEqual([]);
  });
});

describe('La porte des pull requests est écrite (#268)', () => {
  it('le protocole dit les deux cas, la fusion réservée et la cadence', () => {
    const manquantes = porteManquante(read(PROTOCOLE_FUSION));
    expect(
      manquantes,
      `${PROTOCOLE_FUSION} ne dit plus : ${manquantes.join(' ; ')}. La porte des PR (D-131) se lit là, ` +
        'et un agent qui ne la trouve pas devine — ou fusionne sans relecture.'
    ).toEqual([]);
  });

  it('le contrôle mord : une PR externe sans relecture ni validation est vue', () => {
    // La porte réduite à « CI verte, on fusionne » — le cas fautif.
    const faux =
      'Seul le compte de **Bastien** peut fusionner. Les PR de Bastien se fusionnent sans relecture obligatoire. Merge commit.';
    const manquantes = porteManquante(faux);
    expect(manquantes).toContain('la PR externe relue par un agent qui n’a pas écrit le code');
    expect(manquantes).toContain('la validation écrite de Bastien');
    expect(manquantes).toContain('le renvoi à la cadence de release (D-128, docs/VERSIONS.md §4)');
    expect(manquantes).not.toContain('la fusion réservée à Bastien (D-131)');
  });
});

describe('Les étiquettes de travail sont documentées (#282, D-129)', () => {
  it('le document de triage nomme les cinq rôles et les étapes que la feuille de route lit', () => {
    const manquantes = etiquettesDeTravailManquantes(read(TRIAGE));
    expect(
      manquantes,
      `${TRIAGE} ne nomme plus ${manquantes.join(', ')} : les cinq rôles viennent de D-129, les étapes ` +
        `de \`ETAPES\` (\`scripts/plan-dev.mjs\`). Une étiquette d'étape renommée d'un côté seulement ` +
        'laisse la feuille de route lire un mot que plus aucun ticket ne porte.'
    ).toEqual([]);
  });

  it('le contrôle mord : une étiquette retirée du document est vue', () => {
    const faux = 'Les états sont `needs-triage`, `ready-for-agent`. Les étapes sont `alpha` et `beta`.';
    expect(etiquettesDeTravailManquantes(faux, ROLES_TRIAGE, ['alpha', 'beta'])).toEqual([
      'needs-info',
      'ready-for-human',
      'wontfix'
    ]);
    // Et une étape du générateur absente du document l'est aussi.
    expect(etiquettesDeTravailManquantes('`alpha` seul', ['alpha'], ['alpha', 'beta'])).toEqual(['beta']);
  });

  it('AGENTS.md renvoie aux cinq rôles, et le document les porte', () => {
    // `AGENTS.md` §10 nomme les cinq rôles « par défaut » ; le document les explique. Le
    // raccord se lit dans les deux sens, sinon l'un liste un rôle que l'autre ignore.
    const agents = read('AGENTS.md');
    for (const role of ROLES_TRIAGE) {
      if (!agents.includes(role)) continue; // un rôle que §10 ne cite pas n'a rien à raccorder
      expect(read(TRIAGE), `${role} est cité par AGENTS.md §10 mais absent de ${TRIAGE}`).toContain(role);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Le contrôle mord — les textes fabriqués
// ---------------------------------------------------------------------------------------

describe('La garde des générateurs mord (#359)', () => {
  it('le contrôle mord : une étiquette d’étape oubliée est vue', () => {
    // La phrase exacte que porte `AGENTS.md` §11 avant #359.
    const fauxAgents =
      'Fermer ou ouvrir une issue `alpha` périme `src/data/plan-dev.ts` : `npm run plan:dev` quand on prépare une release.';
    expect(etiquettesDuGenerateur(fauxAgents, ['alpha', 'beta'])).toEqual({ lignes: 1, nommees: ['alpha'] });
    expect(etiquettesManquantes(fauxAgents, [], ['alpha', 'beta'])).toEqual(['beta']);

    // La phrase corrigée passe, et une dette connue l'excuse tant qu'elle est écrite.
    const juste = 'Une issue `alpha` ou `beta` périme `src/data/plan-dev.ts` : `npm run plan:dev`.';
    expect(etiquettesManquantes(juste, [], ['alpha', 'beta'])).toEqual([]);
    expect(etiquettesManquantes(fauxAgents, [{ manque: ['beta'] }], ['alpha', 'beta'])).toEqual([]);

    // Une ligne qui ne parle pas du générateur ne compte pas, même si elle nomme `alpha`.
    expect(etiquettesDuGenerateur('Le jalon `alpha` se lit ici.', ['alpha', 'beta'])).toEqual({
      lignes: 0,
      nommees: []
    });
  });

  it('le contrôle mord : un fichier annoncé comme généré sans script est refusé', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['plan:dev']).toBeDefined();
    // Le nom d'un script absent ne se lit pas dans `package.json` : c'est le cas fautif.
    expect(read('package.json').includes('"plan:dev-fantome"')).toBe(false);
    expect(PROMESSES_TENUES.every(({ code }) => existsSync(chemin(code)))).toBe(true);
    expect(FICHIERS_GENERES.every(({ fichierScript }) => existsSync(chemin(fichierScript)))).toBe(true);
  });

  it('le contrôle mord : une promesse de remplacement sans code est refusée', () => {
    // La phrase que portait `docs/VERSIONS.md` avant #356 : un libellé promis, aucun script.
    const fausse = 'Le corps de la release porte `{libellé}`, et sera remplacé par le script.';
    const trouvees = promesses(fausse);
    expect(trouvees.map(({ marqueur }) => marqueur)).toEqual(['{libellé}', 'sera remplacé par']);
    expect(promessesSansCode(fausse, 'docs/VERSIONS.md').map(({ marqueur }) => marqueur)).toEqual([
      '{libellé}',
      'sera remplacé par'
    ]);

    // Le code qui ne porte pas le marqueur ne tient pas la promesse.
    expect(
      promessesSansCode(fausse, 'docs/VERSIONS.md', [
        { document: 'docs/VERSIONS.md', marqueur: '{libellé}', code: 'package.json' }
      ]).map(({ raison }) => raison)
    ).toEqual(['package.json ne porte pas "{libellé}"', 'aucun code déclaré ne la remplace — la retirer, ou la tenir']);

    // Et les accolades de **code** ne sont pas des promesses : c'est ce qui permet de lire
    // les docs sans crier sur chaque bloc JSON.
    for (const code of [
      '{"body": …}',
      '{env:NOM}',
      '{type, message, status?}',
      '{{ github.token }',
      '{cwd,cmdline,stat}'
    ]) {
      expect(promesses(code), code).toEqual([]);
    }
  });
});
