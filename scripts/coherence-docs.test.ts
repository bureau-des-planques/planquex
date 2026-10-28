import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Cohérence des documents — le verrou posé après l'audit du 27/10/2026.
 *
 * L'audit a trouvé **dix-neuf** faits faux dans les docs, dont trois dans les documents
 * d'autorité : `AGENTS.md` disait que la collection s'appelait « le Parc » (mot retiré par
 * D-075), un compte de décisions périmé (113 au lieu de 133) traînait dans §1, et
 * `STORAGE_VERSION` était annoncé à 7 puis 8 alors qu'il valait 10. Chaque correction a été
 * faite **à la main**, et rien n'empêchait la suivante : un document n'est lu par aucun test.
 *
 * Le dépôt avait déjà ce patron, et ce fichier s'y range plutôt que d'inventer le sien :
 * `scripts/compteurs.test.ts` garde les **décomptes de cartes**, `scripts/decisions.test.ts`
 * la **continuité du journal**, `scripts/index-decisions.test.ts` la **synchro de l'index**.
 * Ici, quatre contrôles, tous par **lecture de fichier** (aucun réseau, aucune commande) :
 *
 * 1. le **compte de décisions** annoncé dans `AGENTS.md` §1, dans `docs/DECISIONS-INDEX.md`
 *    et dans `.prettierignore` égale le nombre de lignes `| D-` du journal ;
 * 2. les **commandes**, dans les deux sens : toute `npm run X` citée dans
 *    `docs/COMMANDES.md` existe dans `package.json`, et tout script de `package.json` est cité
 *    dans `docs/COMMANDES.md` ;
 * 3. le **vocabulaire retiré** — `Chariot` (D-075), `Rack` (D-083), `Parc` pour la collection
 *    (D-075) — n'est plus employé **nu** dans les documents d'autorité et les docs vivants ;
 * 4. `README.md` **renvoie** à `docs/COMMANDES.md` au lieu de recopier ses commandes.
 *
 * Le point (4) ne refait **pas** le contrôle de `scripts/compteurs.test.ts` : celui-ci exige
 * déjà `npm run status` dans `README.md` et `docs/COMMANDES.md` (« les deux renvoient à
 * `npm run status`, la source unique »). Le refaire ici dupliquerait la garde, et une garde en
 * double se corrige deux fois ; seul le renvoi vers la table des commandes est ajouté.
 *
 * Chaque contrôle **mord** : un bloc de tests le confronte à un texte **fabriqué** (un faux
 * `AGENTS.md`, une fausse table de commandes, un faux doc avec « Chariot ») et exige l'échec.
 * Sans ce bloc, la garde s'appuierait sur des fichiers sains aujourd'hui — une assertion qui ne
 * peut pas échouer ne garde rien (`AGENTS.md` §6, #112).
 */

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const chemin = (file: string) => fileURLToPath(new URL(`../${file}`, import.meta.url));

// ---------------------------------------------------------------------------------------
// 1. Le compte de décisions
// ---------------------------------------------------------------------------------------

/**
 * Les trois endroits qui annoncent le nombre de décisions du journal. Il n'y a **pas** de
 * source unique : le compte se dérive du journal lui-même (`^| D-`), et c'est ce que fait ce
 * contrôle. Un quatrième endroit qui annoncerait le nombre est à ajouter ici, sinon il dérive
 * en silence — c'est exactement l'incident de `AGENTS.md` §1 (113 annoncées, 133 réelles).
 *
 * Les deux autres mentions du nombre dans le dépôt sont des **citations datées** et ne sont pas
 * gardées : `scripts/index-decisions.mjs` et `scripts/index-decisions.test.ts` racontent que
 * §1.1 disait « 113 décisions » — c'est l'histoire de la règle, pas son état.
 */
const SITES_DU_COMPTE = ['AGENTS.md', 'docs/DECISIONS-INDEX.md', '.prettierignore'] as const;

/** `(133 décisions, 36 000 jetons)` — la phrase de `AGENTS.md` §1. */
const ANNONCE_COMPTE = /\((\d+)\s+décisions?\b/;

/** `> 133 décisions. Le journal fait 36 000 jetons…` — l'en-tête de l'index dérivé. */
const ENTETE_INDEX = /^>\s*(\d+)\s+décisions?\b/m;

/** `Prettier reformaterait 133 décisions et 30 docs.` — le commentaire de `.prettierignore`. */
const MENTION_PRETTIER = /(\d+)\s+décisions?\b/;

/** Une ligne du journal : `| D-001 | 18/10/2026 | … | … |`. */
const LIGNE_JOURNAL = /^\|\s*D-\d+\s*\|/gm;

/** Le nombre de décisions que le journal porte réellement. */
function compteJournal(journal: string): number {
  return (journal.match(LIGNE_JOURNAL) ?? []).length;
}

/**
 * Le nombre annoncé dans un texte, selon l'endroit où on le lit. `null` quand le texte ne
 * l'annonce plus du tout : une garde qui ne trouve rien doit **échouer** (un site périmé est
 * une garde morte), pas se taire.
 */
function compteAnnonce(texte: string, site: string): number | null {
  const motif =
    site === 'docs/DECISIONS-INDEX.md' ? ENTETE_INDEX : site === '.prettierignore' ? MENTION_PRETTIER : ANNONCE_COMPTE;
  const trouve = motif.exec(texte);
  return trouve ? Number(trouve[1]) : null;
}

// ---------------------------------------------------------------------------------------
// 2. Les commandes, dans les deux sens
// ---------------------------------------------------------------------------------------

/**
 * Les scripts de `package.json` que `docs/COMMANDES.md` **n'a pas à citer**.
 *
 * Vide, et c'est délibéré : les quatre entrées qui manquaient le 27/10/2026 (`icones`,
 * `mur:import`, `admin`, `detect:ui`) ont été documentées plutôt que blanchies — une commande
 * qu'un agent ne trouve pas dans la table est une commande qu'il réinvente. N'ajouter ici que
 * des **internes** : un script que npm lance implicitement (`predev`, `prebuild`, `pretest`) et
 * qu'aucune personne ne tape. Rien de tel aujourd'hui.
 */
const SANS_ENTREE = new Set<string>([]);

/** `npm run mur:import`, `npm test`, `npm run status -- --problemes` : la commande citée. */
const CITATION = /\bnpm\s+(?:run\s+)?([a-z][a-z0-9:_-]*)/g;

/**
 * Ce qui n'est pas un script de `package.json` : `npm install`, `npm ci`, `npm exec`.
 * `npm exec` est une sous-commande d'npm, pas un script — la CI s'en sert pour lancer
 * `impeccable` sans réseau (`npm exec --no -- impeccable detect src/`), et la ligne de
 * `docs/COMMANDES.md` qui le cite ne promet aucun script de ce nom.
 */
const PAS_UN_SCRIPT = new Set(['install', 'ci', 'exec']);

/** Les scripts que la table cite. */
function commandesCitees(table: string): string[] {
  return [...new Set([...table.matchAll(CITATION)].map(([, nom]) => nom))].filter((nom) => !PAS_UN_SCRIPT.has(nom));
}

/** Les commandes citées qui n'existent pas : des commandes **fantômes**. */
function commandesFantomes(table: string, scripts: string[]): string[] {
  return commandesCitees(table).filter((nom) => !scripts.includes(nom));
}

/** Les scripts qui existent sans être documentés. */
function commandesNonCitees(table: string, scripts: string[]): string[] {
  const citees = commandesCitees(table);
  return scripts.filter((nom) => !citees.includes(nom) && !SANS_ENTREE.has(nom));
}

// ---------------------------------------------------------------------------------------
// 3. Le vocabulaire retiré
// ---------------------------------------------------------------------------------------

/**
 * Les documents dont le vocabulaire engage l'**état courant** : documents d'autorité (`AGENTS.md`
 * §2) et docs vivants. C'est une **liste**, pas le dépôt entier — le dépôt contient des
 * documents **gelés** et un journal qui ne se réécrit pas (D-111, D-112) :
 *
 * - `docs/DECISIONS.md`, `docs/DECISIONS-INDEX.md` — le journal et son index dérivé : un acte
 *   daté ne se réécrit pas (D-075, D-083, D-111), et l'index hérite de ses intitulés ;
 * - `docs/PROPOSITION.md` §3–5, `docs/CORRESPONDANCES.md`, `docs/NOMMAGE.md` — **gelés** (D-112) ;
 * - `docs/PROTOCOLE-ASTUCES.md` — gelé lui aussi par D-083 (protocole daté du 20/10) ;
 * - `docs/CAPTURES-UI.md` — protocole daté du 19/10 : il nomme des **fichiers de capture** qui
 *   existent (`B05-chariot.png`), et un nom de fichier est un fait, pas un usage ;
 * - `docs/arbitrages/` — dossiers d'arbitrage **datés** (21/10) qui citent le brief mot pour mot ;
 * - `docs/STATUS.md`, `docs/AUDIT-*.md`, `docs/preuves/**` — **instantanés et transcriptions
 *   datés** (§2.6, D-083) ;
 * - `src/data/cards.test.ts` — il **nomme** ce qu'il interdit (`FORBIDDEN_ANY_CASE`), c'est sa fonction.
 */
const DOCUMENTS_VIVANTS = [
  'AGENTS.md',
  'docs/JEU.md',
  'README.md',
  'CONTRIBUTING.md',
  'GLOSSARY.md',
  'DESIGN.md',
  'docs/ARCHITECTURE.md',
  'docs/CARD-SPEC.md',
  'docs/FACTIONS.md',
  'docs/COMMANDES.md',
  'docs/VERSIONS.md',
  'docs/COMITE.md',
  'docs/ALPHA-TESTEURS.md',
  'docs/INTEGRATIONS-DISCORD.md',
  'docs/SPEC-COMBAT-UI.md',
  'docs/MIROIR-2026-DELTAS.md'
] as const;

/** Les trois mots retirés : « Chariot » (D-075), « Rack » (D-083), « Parc » (D-075). */
const MOTS_RETIRES = /\b(chariots?|racks?|parcs?)\b/gi;

/**
 * Ce que D-075 **garde** : le nom d'attaque « Chariot élévateur » est celui de l'engin de
 * l'Atelier, pas le terme du jeu. Il reste dicible, donc il est retiré avant le contrôle.
 */
const NOM_DE_L_ENGIN = /chariot[s]? élévateur[s]?/gi;

/** Une occurrence fautive, réduite à ce qui se lit dans le rapport d'échec. */
type Occurrence = { ligne: number; mot: string; extrait: string };

/**
 * Les mots retirés employés **nus** dans un texte.
 *
 * Une **mention** n'est pas un **emploi** : `docs/JEU.md` §3.1 écrit que le deck s'appelait
 * « Chariot » de D-026 à D-075, et `docs/DECISIONS.md` que les routes `/parc` et `/chariot`
 * redirigent. Ces formes-là sont donc retirées avant le contrôle — le mot entre « guillemets »
 * ou entre `backticks` cite, il n'emploie pas. Ce qui reste est le mot **nu**, et c'est celui
 * qui ment : « la collection s'appelle **le Parc** » était bien nu.
 *
 * Conséquence assumée : un document pourrait cacher un emploi fautif entre guillemets. C'est le
 * prix de la citation honnête, et le contrôle mord quand même sur le cas réel de l'audit.
 */
function vocabulaireRetire(texte: string): Occurrence[] {
  const fautes: Occurrence[] = [];
  texte.split('\n').forEach((brute, index) => {
    const nue = brute
      .replace(/«[^»]*»/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(NOM_DE_L_ENGIN, ' ');
    for (const trouve of nue.matchAll(MOTS_RETIRES)) {
      fautes.push({ ligne: index + 1, mot: trouve[0], extrait: brute.trim().slice(0, 140) });
    }
  });
  return fautes;
}

/** Le rapport lisible d'une liste d'occurrences. */
function rendreFautes(fichier: string, fautes: Occurrence[]): string {
  return fautes.map(({ ligne, mot, extrait }) => `${fichier}:${ligne} « ${mot} » — ${extrait}`).join('\n  ');
}

// ---------------------------------------------------------------------------------------
// Les contrôles sur les fichiers du dépôt
// ---------------------------------------------------------------------------------------

describe('Cohérence des documents — le compte de décisions (27/10/2026)', () => {
  it('le journal est lu et n’est pas vide (sinon rien n’est gardé)', () => {
    expect(
      compteJournal(read('docs/DECISIONS.md')),
      `aucune ligne | D-NNN | dans ${chemin('docs/DECISIONS.md')}`
    ).toBeGreaterThan(0);
  });

  it.each([...SITES_DU_COMPTE])('%s annonce le nombre de lignes du journal', (site) => {
    const reel = compteJournal(read('docs/DECISIONS.md'));
    const annonce = compteAnnonce(read(site), site);
    expect(
      annonce,
      `${site} n’annonce plus le nombre de décisions — la garde ne garde plus rien : ` +
        'la phrase porte « (N décisions, …) » (AGENTS.md §1), « > N décisions » (en-tête de ' +
        'l’index) ou « N décisions » (.prettierignore). `npm run index:decisions` réécrit l’index, ' +
        'pas les deux autres.'
    ).not.toBeNull();
    expect(
      annonce,
      `${site} annonce ${annonce} décisions pour un journal qui en porte ${reel} — ` +
        `corriger le nombre à la source de lecture : \`grep -c '^| D-' docs/DECISIONS.md\` ` +
        `donne ${reel}.`
    ).toBe(reel);
  });
});

describe('Cohérence des documents — les commandes, dans les deux sens (27/10/2026)', () => {
  const scripts = Object.keys((JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts);

  it('la table est lue et cite des commandes (sinon rien n’est gardé)', () => {
    const citees = commandesCitees(read('docs/COMMANDES.md'));
    expect(citees, `aucune commande « npm run X » lue dans ${chemin('docs/COMMANDES.md')}`).toContain('check');
    expect(citees.length).toBeGreaterThan(10);
  });

  it('toute commande citée dans docs/COMMANDES.md existe dans package.json', () => {
    const fantomes = commandesFantomes(read('docs/COMMANDES.md'), scripts);
    expect(
      fantomes,
      `commande(s) citée(s) dans docs/COMMANDES.md qui n’existent pas dans package.json ` +
        `(\`scripts\`) : ${fantomes.join(', ')} — soit le script a été renommé et la table ment, ` +
        'soit la ligne est à retirer.'
    ).toEqual([]);
  });

  it('tout script de package.json est cité dans docs/COMMANDES.md', () => {
    const orphelins = commandesNonCitees(read('docs/COMMANDES.md'), scripts);
    expect(
      orphelins,
      `script(s) de package.json absent(s) de docs/COMMANDES.md : ${orphelins.join(', ')} — ` +
        'une commande qu’un agent ne trouve pas dans la table est une commande qu’il réinvente. ' +
        'L’ajouter à la table, ou l’inscrire dans `SANS_ENTREE` avec sa raison (les internes ' +
        'de `predev`/`prebuild` seulement).'
    ).toEqual([]);
  });
});

describe('Cohérence des documents — le vocabulaire retiré (D-075, D-083)', () => {
  it.each([...DOCUMENTS_VIVANTS])('%s n’emploie plus Chariot, Rack ni Parc', (fichier) => {
    expect(existsSync(chemin(fichier)), `${fichier} a disparu : la garde du vocabulaire ne le lit plus`).toBe(true);
    const fautes = vocabulaireRetire(read(fichier));
    expect(
      fautes,
      `vocabulaire retiré employé dans ${fichier} (D-075 pour « Chariot » et « Parc », D-083 pour ` +
        `« Rack ») :\n  ${rendreFautes(fichier, fautes)}\n` +
        'Écrire « Deck », « Collection » et « Banc ». Pour **citer** le mot (son histoire, une ' +
        'route, un nom de fichier), le mettre entre « guillemets » ou entre `backticks`.'
    ).toEqual([]);
  });
});

describe('Cohérence des documents — le renvoi, pas la copie (27/10/2026)', () => {
  /**
   * `npm run status` comme source des décomptes est déjà gardé par `scripts/compteurs.test.ts`
   * (« les deux renvoient à `npm run status`, la source unique ») : non dupliqué ici.
   * Ce qui n'était gardé nulle part, c'est le renvoi vers la **table des commandes** elle-même.
   */
  it('README.md renvoie à docs/COMMANDES.md', () => {
    expect(
      read('README.md'),
      'README.md ne renvoie plus à docs/COMMANDES.md — la table des commandes n’est plus ' +
        'trouvable depuis la porte d’entrée, et chaque doc recopie alors ses propres commandes.'
    ).toContain('docs/COMMANDES.md');
  });
});

// ---------------------------------------------------------------------------------------
// Le contrôle mord — les textes fabriqués
// ---------------------------------------------------------------------------------------

/**
 * Sans ce bloc, les trois gardes s'appuient sur des fichiers **sains aujourd'hui** : une
 * assertion qui ne peut pas échouer ne garde rien (`AGENTS.md` §6, #112). C'est le patron du
 * bloc « La garde des décomptes mord » de `scripts/compteurs.test.ts`.
 */
describe('La garde de la cohérence documentaire mord (27/10/2026)', () => {
  const journal = (n: number) =>
    Array.from({ length: n }, (_, i) => `| D-${String(i + 1).padStart(3, '0')} | 18/10/2026 | A | a |`).join('\n');

  it('le contrôle mord : un compte de décisions périmé est refusé', () => {
    // La phrase exacte que portait `AGENTS.md` §1 avant l'audit du 27/10/2026.
    const fauxAgents = 'Lire ce fichier. Pour `docs/DECISIONS.md` (113 décisions, 36 000 jetons), ouvrir son index.';
    expect(compteJournal(journal(133))).toBe(133);
    expect(compteAnnonce(fauxAgents, 'AGENTS.md')).toBe(113);
    expect(compteAnnonce(fauxAgents, 'AGENTS.md')).not.toBe(compteJournal(journal(133)));

    // L'en-tête de l'index dérivé, et sa mention dans `.prettierignore`.
    expect(compteAnnonce('> 112 décisions. Le journal fait 36 000 jetons :', 'docs/DECISIONS-INDEX.md')).toBe(112);
    expect(compteAnnonce('Prettier reformaterait 99 décisions et 30 docs.', '.prettierignore')).toBe(99);

    // Un site qui n'annonce plus rien est un échec, pas un silence.
    expect(compteAnnonce('Lire le journal avant de coder.', 'AGENTS.md')).toBeNull();
  });

  it('le contrôle mord : une commande fantôme et un script non cité sont vus des deux côtés', () => {
    const table = [
      '| Commande | Usage |',
      '|---|---|',
      '| `npm run check` | `tsc -b` |',
      // Commande supprimée de `package.json` depuis : la table ment.
      '| `npm run statut:fantome` | plus rien |',
      '| `npm test -- --project=node` | la moitié `node` |',
      '| `npm install` | installer |'
    ].join('\n');

    expect(commandesCitees(table)).toEqual(['check', 'statut:fantome', 'test']);
    expect(commandesFantomes(table, ['check', 'test', 'build'])).toEqual(['statut:fantome']);
    // `build` existe et n'est pas dans la table ; `test` y est sous la forme `npm test`.
    expect(commandesNonCitees(table, ['check', 'test', 'build'])).toEqual(['build']);
    // `SANS_ENTREE` blanchit un interne, et rien d'autre : c'est une liste courte et commentée.
    expect(commandesNonCitees(table, ['check', 'test', 'predev'])).toEqual(['predev']);
  });

  it('le contrôle mord : « Chariot », « Rack » et « le Parc » nus sont refusés', () => {
    // La phrase corrigée par l'audit du 27/10/2026 : le mot était nu, donc refusé.
    expect(
      vocabulaireRetire('La collection s’appelle **le Parc** et le sac est un Chariot.').map((f) => f.mot)
    ).toEqual(['Parc', 'Chariot']);
    // Une faute par mot, avec sa ligne : le rapport doit être actionnable.
    expect(
      vocabulaireRetire('Le Rack a trois places.\n\nRien ici.\nLe rack encore.').map(
        ({ ligne, mot }) => `${ligne}:${mot}`
      )
    ).toEqual(['1:Rack', '4:rack']);
  });

  it('le contrôle mord : la citation passe, l’emploi non', () => {
    // Une **mention** (`docs/JEU.md` §3.1, l'index du journal) n'est pas un emploi.
    expect(vocabulaireRetire('| Deck | « Chariot » depuis D-026 jusqu’à D-075 |')).toEqual([]);
    // Les routes retirées, en `backticks`, et le nom de l'engin (D-075) restent dicibles.
    expect(vocabulaireRetire('les routes sont `/parc` et `/chariot` redirigent, et le Parc…')).toEqual([
      { ligne: 1, mot: 'Parc', extrait: 'les routes sont `/parc` et `/chariot` redirigent, et le Parc…' }
    ]);
    expect(vocabulaireRetire('l’attaque « Chariot élévateur » de l’Atelier')).toEqual([]);
  });
});
