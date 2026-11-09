import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';

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
 * `scripts/gardes/compteurs.test.ts` garde les **décomptes de cartes**, `scripts/gardes/decisions.test.ts`
 * la **continuité du journal**, `scripts/generateurs/index-decisions.test.ts` la **synchro de l'index**.
 * Ici, six contrôles, tous par **lecture de fichier** (aucun réseau, aucune commande) :
 *
 * 1. le **compte de décisions** annoncé dans `AGENTS.md` §1 et dans
 *    `docs/DECISIONS-INDEX.md` égale le nombre de lignes `| D-` du journal ; `.prettierignore`
 *    ne doit **pas** le recopier (un fait, une source — #707) ;
 * 2. les **commandes**, dans les deux sens : toute `npm run X` citée dans
 *    `docs/COMMANDES.md` existe dans `package.json`, et tout script de `package.json` est cité
 *    dans `docs/COMMANDES.md` ;
 * 3. le **vocabulaire retiré** — `Chariot` (D-075), `Rack` (D-083), `Parc` pour la collection
 *    (D-075) — n'est plus employé **nu** dans les documents d'autorité et les docs vivants ;
 * 4. `README.md` **renvoie** à `docs/COMMANDES.md` au lieu de recopier ses commandes ;
 * 5. le **compte des cartes de base** cité dans un document vivant (« Les N cartes de base
 *    ont leur illustration ») égale le nombre de cartes d'`ALL_CARDS` sans `variantOf` (#625).
 *    Un document qui parle aux testeurs fait une **promesse** : « 225 cartes » pour 233 était
 *    une promesse fausse, trouvée par hasard ;
 * 6. la **nomenclature des raretés** (D-180) — les huit noms et leurs objets de bureau, lus
 *    dans les tableaux de `docs/JEU.md` §3 et de `DESIGN.md` §3, et dans la ligne D-180.
 *
 * Le point (4) ne refait **pas** le contrôle de `scripts/gardes/compteurs.test.ts` : celui-ci exige
 * déjà `npm run status` dans `README.md` et `docs/COMMANDES.md` (« les deux renvoient à
 * `npm run status`, la source unique »). Le refaire ici dupliquerait la garde, et une garde en
 * double se corrige deux fois ; seul le renvoi vers la table des commandes est ajouté.
 *
 * Chaque contrôle **mord** : un bloc de tests le confronte à un texte **fabriqué** (un faux
 * `AGENTS.md`, une fausse table de commandes, un faux doc avec « Chariot ») et exige l'échec.
 * Sans ce bloc, la garde s'appuierait sur des fichiers sains aujourd'hui — une assertion qui ne
 * peut pas échouer ne garde rien (`AGENTS.md` §6, #112).
 */

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const chemin = (file: string) => fileURLToPath(new URL(`../../${file}`, import.meta.url));

// ---------------------------------------------------------------------------------------
// 1. Le compte de décisions
// ---------------------------------------------------------------------------------------

/**
 * Les **deux** endroits qui annoncent le nombre de décisions du journal. Il n'y a **pas** de
 * source unique : le compte se dérive du journal lui-même (`^| D-`), et c'est ce que fait ce
 * contrôle. Un troisième endroit qui annoncerait le nombre est à ajouter ici, sinon il dérive
 * en silence — c'est exactement l'incident de `AGENTS.md` §1 (113 annoncées, 133 réelles).
 *
 * `.prettierignore` n'en fait **plus** partie (#707) : son commentaire recopiait le compte,
 * chaque décision le périmait, et la PR sortait du chemin rapide de D-143 (#689–#692). Il est
 * désormais **interdit** d'y recopier un compte : `AGENTS.md` §1 en est la source.
 *
 * Les deux autres mentions du nombre dans le dépôt sont des **citations datées** et ne sont pas
 * gardées : `scripts/generateurs/index-decisions.mjs` et `scripts/generateurs/index-decisions.test.ts` racontent que
 * §1.1 disait « 113 décisions » — c'est l'histoire de la règle, pas son état.
 */
const SITES_DU_COMPTE = ['AGENTS.md', 'docs/DECISIONS-INDEX.md'] as const;

/** `(133 décisions, 36 000 jetons)` — la phrase de `AGENTS.md` §1. */
const ANNONCE_COMPTE = /\((\d+)\s+décisions?\b/;

/** `> 133 décisions. Le journal fait 36 000 jetons…` — l'en-tête de l'index dérivé. */
const ENTETE_INDEX = /^>\s*(\d+)\s+décisions?\b/m;

/**
 * Un compte de décisions recopié dans `.prettierignore` (#707). Le fichier n'a **pas** à
 * l'annoncer : `AGENTS.md` §1 est la source, et une copie se périme à chaque décision.
 */
const COMPTE_DANS_PRETTIER = /\b\d+\s+décisions?\b/;

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
  const motif = site === 'docs/DECISIONS-INDEX.md' ? ENTETE_INDEX : ANNONCE_COMPTE;
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
 * - `docs/STATUS.md`, `docs/archives/AUDIT-*.md`, `docs/preuves/**` — **instantanés et transcriptions
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
  'PRODUCT.md',
  'docs/ARCHITECTURE.md',
  'docs/CARD-SPEC.md',
  'docs/FACTIONS.md',
  'docs/COMMANDES.md',
  'docs/VERSIONS.md',
  'docs/COMITE.md',
  'docs/ALPHA-TESTEURS.md',
  'docs/INTEGRATIONS-DISCORD.md',
  'docs/SPEC-COMBAT-UI.md',
  'docs/MIROIR-2026-DELTAS.md',
  'docs/IMPECCABLE.md'
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
// 4. Le compte des cartes de base cité dans un document vivant
// ---------------------------------------------------------------------------------------

/**
 * Le nombre de **bases** du set — la seule définition, déjà employée par
 * `scripts/preuves/status.mjs` (`cards.base`) et `scripts/preuves/mesure-illustrations.mjs` :
 * une carte d'`ALL_CARDS` **sans `variantOf`**. `ALL_CARDS` compte les variantes aussi : un
 * compte naïf d'`ALL_CARDS` serait faux, et c'est pourquoi la définition se dit ici une fois.
 *
 * Il ne se recopie **pas** : `docs/ALPHA-TESTEURS.md` a annoncé « les 225 cartes de base ont
 * leur illustration » alors que le set en comptait 233, et le chiffre faux est resté jusqu'à ce
 * qu'on tombe dessus par hasard (#625).
 */
const basesDuSet = (cartes: readonly { variantOf?: string }[]): number => cartes.filter((card) => !card.variantOf).length;

/**
 * « Les N cartes de base ont leur illustration » — **une** formulation, gardée ici.
 *
 * Le ticket #625 le dit : ne pas élargir aux variantes ni aux planches sans le dire. Le jour où
 * un document vivant invente « N bases illustrées », c'est cette formulation-là qu'il faudra
 * couvrir ; d'ici là, une garde large refuserait des citations légitimes (les preuves datées,
 * `docs/NOMMAGE.md` gelé).
 */
const COMPTE_DE_BASES = /\b(\d+)\s+cartes?\s+de\s+base\b/gi;

/** Un compte de bases cité : son chiffre, sa ligne, la phrase qui le porte. */
type CompteCite = { ligne: number; chiffre: number; extrait: string };

/** Les comptes de bases cités dans un texte, une entrée par occurrence. */
function comptesDeBases(texte: string): CompteCite[] {
  const trouves: CompteCite[] = [];
  texte.split('\n').forEach((brute, index) => {
    for (const trouve of brute.matchAll(COMPTE_DE_BASES)) {
      trouves.push({ ligne: index + 1, chiffre: Number(trouve[1]), extrait: brute.trim().slice(0, 160) });
    }
  });
  return trouves;
}

/** Les comptes cités qui ne sont pas le compte réel. */
function comptesFaux(texte: string, reel: number): CompteCite[] {
  return comptesDeBases(texte).filter(({ chiffre }) => chiffre !== reel);
}

/** Le rapport lisible : fichier, ligne, chiffre écrit, chiffre compté. */
function rendreComptes(fichier: string, fautes: CompteCite[], reel: number): string {
  return fautes
    .map(({ ligne, chiffre, extrait }) => `${fichier}:${ligne} — écrit ${chiffre}, compté ${reel} — ${extrait}`)
    .join('\n  ');
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
        'la phrase porte « (N décisions, …) » (AGENTS.md §1) ou « > N décisions » (en-tête de ' +
        'l’index). `npm run index:decisions` réécrit l’index, pas AGENTS.md.'
    ).not.toBeNull();
    expect(
      annonce,
      `${site} annonce ${annonce} décisions pour un journal qui en porte ${reel} — ` +
        `corriger le nombre à la source de lecture : \`grep -c '^| D-' docs/DECISIONS.md\` ` +
        `donne ${reel}.`
    ).toBe(reel);
  });

  it('.prettierignore ne recopie pas le compte de décisions (AGENTS.md §1 en est la source, #707)', () => {
    // Une copie se périme à chaque décision : #689–#692 ont ainsi rejoué dix minutes d'écrans
    // pour rien, et la PR sortait du chemin rapide de D-143. Le contrôle est **inverse** de
    // celui des deux sites : ici, un nombre est une faute, pas une absence.
    expect(read('.prettierignore')).not.toMatch(COMPTE_DANS_PRETTIER);
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
  it('PRODUCT.md est un document vivant dont le vocabulaire est gardé', () => {
    expect(DOCUMENTS_VIVANTS).toContain('PRODUCT.md');
  });

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
   * `npm run status` comme source des décomptes est déjà gardé par `scripts/gardes/compteurs.test.ts`
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

describe('Cohérence des documents — le compte des cartes de base (#625)', () => {
  const reel = basesDuSet(ALL_CARDS);

  it('le compte des bases se lit dans ALL_CARDS, qui mélange bases et variantes', () => {
    expect(reel, `aucune carte de base dans ALL_CARDS (${chemin('src/data/index.ts')})`).toBeGreaterThan(0);
    expect(
      ALL_CARDS.some((card) => card.variantOf),
      'ALL_CARDS ne porte aucune variante : « une base est une carte sans `variantOf` » ne ' +
        'discrimine plus rien, et le compte passerait pour la mauvaise raison. Vérifier la ' +
        'définition avant de conclure que le set est sain.'
    ).toBe(true);
  });

  it.each([...DOCUMENTS_VIVANTS])('%s ne cite que le compte réel de cartes de base', (fichier) => {
    expect(existsSync(chemin(fichier)), `${fichier} a disparu : la garde du compte des bases ne le lit plus`).toBe(
      true
    );
    const fautes = comptesFaux(read(fichier), reel);
    expect(
      fautes,
      `compte de cartes de base faux dans ${fichier} :\n  ${rendreComptes(fichier, fautes, reel)}\n` +
        'Le compte ne se recopie pas : une **base** est une carte d’`ALL_CARDS` sans `variantOf` ' +
        `(\`src/data/index.ts\`), et \`npm run status\` la publie en \`cards.base\` — ${reel} ` +
        'aujourd’hui. Corriger le chiffre écrit, jamais le compte.'
    ).toEqual([]);
  });

  it('un document vivant cite encore « N cartes de base » (sinon la garde n’a plus de sujet)', () => {
    const cites = DOCUMENTS_VIVANTS.flatMap((fichier) =>
      comptesDeBases(read(fichier)).map(({ ligne, chiffre }) => `${fichier}:${ligne} (${chiffre})`)
    );
    expect(
      cites.length,
      'aucun document vivant ne cite « N cartes de base » : la garde ne garde plus rien. Si la ' +
        'formulation a changé, couvrir la nouvelle dans `COMPTE_DE_BASES` ; si la promesse a ' +
        'disparu du document, retirer cette garde en le disant.'
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------
// 6. La nomenclature des raretés (D-180)
// ---------------------------------------------------------------------------------------

/**
 * Les huit raretés et leur nomenclature — D-180. Le code garde le libellé compact de
 * `RARITY_META` ; les **noms** et les **objets** sont une décision documentaire, et les deux
 * documents qui la portent (`docs/JEU.md` §3, `DESIGN.md` §3) doivent dire la même chose.
 *
 * Le test lit les **tableaux** des deux fichiers : une ligne par rareté, dont le code ouvre la
 * première cellule. Il ne se contente pas de vérifier que le nom apparaît quelque part — un
 * nom déplacé dans un paragraphe ne fait pas une nomenclature.
 */
type Rarete = { code: string; nom: string; objet: string };

const RARETES_D180: readonly Rarete[] = [
  { code: '1D', nom: 'À l’essai', objet: 'badge à pince' },
  { code: '2D', nom: 'Titularisé', objet: 'clé de vestiaire' },
  { code: '3D', nom: 'Confirmé', objet: 'perforatrice' },
  { code: '4D', nom: 'Promu', objet: 'fauteuil' },
  { code: '1S', nom: 'Distingué', objet: 'médaille' },
  { code: '2S', nom: 'Inamovible', objet: 'plaque' },
  { code: '3S', nom: 'Émérite', objet: 'montre' },
  { code: 'COU', nom: 'Légataire', objet: 'passe-partout' }
];

/** La ligne de tableau dont la première cellule est le code d'une rareté. */
function ligneRarete(texte: string, code: string): string | null {
  const motif = new RegExp('^\\|\\s*`' + code + '`\\s*\\|');
  return texte.split('\n').find((ligne) => motif.test(ligne.trim())) ?? null;
}

/** Ce qui manque à un texte pour porter la nomenclature de D-180. */
function ecartsNomenclature(texte: string): string[] {
  return RARETES_D180.flatMap(({ code, nom, objet }) => {
    const ligne = ligneRarete(texte, code);
    if (!ligne) return [`${code} : ligne absente`];
    const ecarts: string[] = [];
    if (!ligne.includes(nom)) ecarts.push(`${code} : nom « ${nom} » absent`);
    if (!ligne.includes(objet)) ecarts.push(`${code} : objet « ${objet} » absent`);
    return ecarts;
  });
}

/** La ligne de la décision D-180 dans le journal. */
function ligneDecision(numero: string): string | null {
  return read('docs/DECISIONS.md')
    .split('\n')
    .find((ligne) => ligne.trimStart().startsWith(`| ${numero} |`)) ?? null;
}

describe('Cohérence des documents — la nomenclature des raretés (D-180)', () => {
  it('la décision D-180 est datée et porte les huit noms, les objets et la tasse écartée', () => {
    const ligne = ligneDecision('D-180');
    expect(ligne, 'D-180 introuvable dans docs/DECISIONS.md').not.toBeNull();
    expect(ligne).toContain('04/11/2026');
    expect(ligne).toContain('Bastien, 03/11/2026');
    expect(ligne).toContain('perforatrice');
    expect(ligne).toContain('tasse');
    expect(ligne).toContain('écartée');
    for (const { code, nom, objet } of RARETES_D180) {
      expect(ligne, `D-180 ne porte pas ${code}`).toContain(code);
      expect(ligne, `D-180 ne porte pas « ${nom} »`).toContain(nom);
      expect(ligne, `D-180 ne porte pas « ${objet} »`).toContain(objet);
    }
  });

  it.each(['docs/JEU.md', 'DESIGN.md'])('%s porte les huit noms et leurs objets', (fichier) => {
    const ecarts = ecartsNomenclature(read(fichier));
    expect(ecarts, `nomenclature de D-180 incomplète dans ${fichier} :\n  ${ecarts.join('\n  ')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------
// Le contrôle mord — les textes fabriqués
// ---------------------------------------------------------------------------------------

/**
 * Sans ce bloc, les gardes s'appuient sur des fichiers **sains aujourd'hui** : une
 * assertion qui ne peut pas échouer ne garde rien (`AGENTS.md` §6, #112). C'est le patron du
 * bloc « La garde des décomptes mord » de `scripts/gardes/compteurs.test.ts`.
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

    // L'en-tête de l'index dérivé.
    expect(compteAnnonce('> 112 décisions. Le journal fait 36 000 jetons :', 'docs/DECISIONS-INDEX.md')).toBe(112);

    // Un site qui n'annonce plus rien est un échec, pas un silence.
    expect(compteAnnonce('Lire le journal avant de coder.', 'AGENTS.md')).toBeNull();
  });

  it('le contrôle mord : un compte recopié dans .prettierignore est refusé (#707)', () => {
    // Le commentaire d'avant #707, qui a coûté quatre passages d'écrans (#689–#692).
    expect('Prettier reformaterait 183 décisions et 30 docs.').toMatch(COMPTE_DANS_PRETTIER);
    // La formulation retenue ne porte plus de compte : elle passe.
    expect('Prettier reformaterait le journal et les docs.').not.toMatch(COMPTE_DANS_PRETTIER);
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

  it('le contrôle mord : « 225 cartes de base » est refusé, le compte réel passe (#625)', () => {
    const reel = basesDuSet(ALL_CARDS);
    // La phrase exacte que portait `docs/ALPHA-TESTEURS.md` : 225 annoncées pour 233 réelles.
    const fautive =
      'la fiche de chaque carte. **Les 225 cartes de base ont leur illustration**, et chaque variante';
    expect(comptesDeBases(fautive).map(({ ligne, chiffre }) => `${ligne}:${chiffre}`)).toEqual(['1:225']);
    const fautes = comptesFaux(fautive, reel);
    expect(fautes).toHaveLength(1);
    // Le message doit être actionnable : fichier, ligne, chiffre écrit, chiffre compté.
    const rapport = rendreComptes('docs/fabrique.md', fautes, reel);
    expect(rapport).toContain('docs/fabrique.md:1');
    expect(rapport).toContain(`écrit 225, compté ${reel}`);
    // Le bon chiffre passe, et deux occurrences sur deux lignes sont vues séparément.
    expect(comptesFaux(`**Les ${reel} cartes de base ont leur illustration**`, reel)).toEqual([]);
    expect(
      comptesDeBases(`Les ${reel} cartes de base.\n\nLes 225 cartes de base.`).map(({ ligne }) => ligne)
    ).toEqual([1, 3]);
  });

  it('le contrôle mord : l’objet du 3D est refusé si la tasse revient (D-180)', () => {
    const faux = [
      '| `1D` | **À l’essai** | badge à pince |',
      '| `2D` | **Titularisé** | clé de vestiaire |',
      // La tasse écartée par D-180 : la nomenclature doit exiger la perforatrice.
      '| `3D` | **Confirmé** | tasse à café |',
      '| `4D` | **Promu** | fauteuil |',
      '| `1S` | **Distingué** | médaille |',
      '| `2S` | **Inamovible** | plaque |',
      '| `3S` | **Émérite** | montre |',
      '| `COU` | **Légataire** | passe-partout |'
    ].join('\n');
    expect(ecartsNomenclature(faux)).toEqual(['3D : objet « perforatrice » absent']);
  });

  it('le contrôle mord : une rareté absente du tableau est refusée (D-180)', () => {
    expect(ecartsNomenclature('| `1D` | **À l’essai** | badge à pince |')).toContain('2D : ligne absente');
  });
});
