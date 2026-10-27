import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **Les anciens noms de la Boîte à idées ne reviennent pas** (#210, D-097 (9)).
 *
 * D-097 renomme l'entrée en **le comité** : `/idees` devient `/comite`, `BoiteAIdees.tsx`
 * devient `Comite.tsx`, `BulleBoiteAIdees.tsx` devient `AlerteComite.tsx`, et
 * `docs/boite-a-idees.json` devient `docs/comite.json`. Un nom d'écran renommé à moitié se
 * remet à vivre au premier fichier recopié : c'est un *Mysterious Name* (`AGENTS.md` §5),
 * et c'est exactement ce que D-097 (9) demande de refuser.
 *
 * Le contrôle lit le dépôt, comme `scripts/compteurs.test.ts` : pas de linter de plus. Deux
 * exceptions seulement, chacune avec sa raison, et le second test montre que le contrôle
 * **mord** — un bac fabriqué qui réintroduit un nom est trouvé.
 */
const RACINE = process.cwd();
const DOSSIERS = ['src', 'scripts', 'supabase'] as const;

/** Les trois formes interdites : l'adresse du fichier, le module, le document. */
const ANCIENS_NOMS = ['boite-a-idees', 'BoiteAIdees', 'BOITE-A-IDEES'] as const;

const EXCEPTIONS = [
  // **Généré** : `npm run notes:versions` recopie les notes des releases GitHub, qui
  // parlent de `docs/boite-a-idees.json` à leur date. On ne réécrit pas une release.
  'src/data/versions.ts',
  // Ce fichier-ci nomme ce qu'il interdit : il ne peut pas se compter comme une référence.
  'src/renommages.test.ts'
];

/** Un fichier trouvé : son chemin **relatif** (séparateur `/`) et son chemin sur le disque. */
interface Fichier {
  relatif: string;
  chemin: string;
}

/** Les fichiers des chemins donnés — un dossier est parcouru récursivement — hors exceptions nommées. */
function fichiers(root: string, dossiers: readonly string[], exceptions: readonly string[] = []): Fichier[] {
  const trouves: Fichier[] = [];
  const retenir = (chemin: string) => {
    const relatif = relative(root, chemin).split(sep).join('/');
    if (!exceptions.includes(relatif)) trouves.push({ relatif, chemin });
  };
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      else retenir(chemin);
    }
  };
  for (const dossier of dossiers) {
    const chemin = join(root, dossier);
    if (!existsSync(chemin)) continue;
    // Un fichier nommé seul (`README.md`) se lit comme un dossier d'un fichier.
    if (statSync(chemin).isFile()) retenir(chemin);
    else parcourir(chemin);
  }
  return trouves;
}

/** Les fichiers des dossiers donnés qui portent encore un ancien nom, triés. */
function references(root: string, dossiers: readonly string[], exceptions: readonly string[] = []): string[] {
  const trouvees: string[] = [];
  for (const { relatif, chemin } of fichiers(root, dossiers, exceptions)) {
    const texte = readFileSync(chemin, 'utf8');
    for (const nom of ANCIENS_NOMS) {
      if (texte.includes(nom)) trouvees.push(`${relatif} : ${nom}`);
    }
  }
  return trouvees.sort();
}

/**
 * **Les mots que D-075 et D-083 ont retirés ne reviennent pas à l'écran** (#220).
 *
 * D-026 avait nommé le Deck « Chariot », la Collection « Parc » et le Banc « Rack » ; D-075
 * puis D-083 ont rendu au jeu ses mots du réel, et l'écran du Deck disait encore « Chariots
 * proposés » en 0.1.11. La couche d'écran (`src/pages`, `src/components`) est celle que lit
 * l'invité : c'est là que le contrôle mord, et pas dans le moteur, qui garde ses valeurs.
 *
 * Deux **tokens** restent légitimes, et sont blanchis avant la recherche — chacun avec sa raison :
 * - `'rack'` entre guillemets : la **valeur du moteur** (`target`/`slot`), que D-083 dit de ne
 *   pas renommer (`src/game/engine.ts`) ;
 * - `/parc` et `/chariot` : les **anciennes adresses**, qui redirigent (D-075) — `Introuvable`
 *   les cite pour expliquer qu'on n'arrive pas dessus, comme `src/redirections.ts`.
 */
const MOTS_RETIRES = [
  { mot: 'Chariot', motif: /\bchariots?\b/i },
  { mot: 'Rack', motif: /\bracks?\b/i },
  { mot: 'Parc', motif: /\bparcs?\b/i }
] as const;

const TOKENS_LEGITIMES = [/'rack'/g, /"rack"/g, /\/parc\b/g, /\/chariot\b/g];

/** Les écrans : la couche que lit l'invité. */
const ECRANS = ['src/pages', 'src/components'] as const;

/** Les fichiers d'écran qui portent encore un mot retiré, `chemin : mot`, triés. */
function motsRetires(root: string, dossiers: readonly string[] = ECRANS): string[] {
  const trouvees: string[] = [];
  for (const { relatif, chemin } of fichiers(root, dossiers)) {
    let texte = readFileSync(chemin, 'utf8');
    for (const legitime of TOKENS_LEGITIMES) texte = texte.replace(legitime, '');
    for (const { mot, motif } of MOTS_RETIRES) {
      if (motif.test(texte)) trouvees.push(`${relatif} : ${mot}`);
    }
  }
  return trouvees.sort();
}

describe('les anciens noms de la boîte à idées ne reviennent pas (#210, D-097 (9))', () => {
  it('aucune référence dans src/, scripts/ et supabase/', () => {
    expect(references(RACINE, DOSSIERS, EXCEPTIONS)).toEqual([]);
  });

  it('le contrôle mord : un fichier qui réintroduit un ancien nom est trouvé', () => {
    const bac = mkdtempSync(join(tmpdir(), 'renommages-'));
    try {
      mkdirSync(join(bac, 'src', 'pages'), { recursive: true });
      writeFileSync(join(bac, 'src', 'pages', 'Retour.tsx'), "import { x } from '@/pages/BoiteAIdees';\n");
      mkdirSync(join(bac, 'scripts'), { recursive: true });
      writeFileSync(join(bac, 'scripts', 'mur.mjs'), "const fichier = 'docs/boite-a-idees.json';\n");
      writeFileSync(join(bac, 'scripts', 'contrat.mjs'), 'La forme est dans docs/BOITE-A-IDEES.md.\n');

      expect(references(bac, ['src', 'scripts'])).toEqual([
        'scripts/contrat.mjs : BOITE-A-IDEES',
        'scripts/mur.mjs : boite-a-idees',
        'src/pages/Retour.tsx : BoiteAIdees'
      ]);

      // Une exception ne masque que **son** fichier : les deux autres restent trouvés.
      expect(references(bac, ['src', 'scripts'], ['scripts/contrat.mjs'])).toEqual([
        'scripts/mur.mjs : boite-a-idees',
        'src/pages/Retour.tsx : BoiteAIdees'
      ]);
    } finally {
      rmSync(bac, { recursive: true, force: true });
    }
  });
});

/**
 * **« invité » ne désigne plus le testeur de l'alpha** (#306, D-117).
 *
 * D-117 (6) fixe le mot : « **testeur** » remplace « invité » pour désigner le testeur de
 * l'alpha (`AGENTS.md` §3.1). Le renommage a été fait une fois, à la main, dans les textes,
 * les docs et les commentaires ; ce contrôle empêche que le vieux mot revienne avec le
 * prochain fichier recopié — même raison que la Boîte à idées ci-dessus.
 *
 * Trois familles d'occurrences **restent** et sont hors d'atteinte, chacune avec sa raison :
 * - le **flavour** des cartes, où « invité » ne désigne personne de l'alpha mais un
 *   participant à une réunion de bureau (D-074) ;
 * - le **journal** (`docs/DECISIONS.md`) et son index, qui ne se réécrivent pas (D-111) ;
 * - ce fichier-ci, qui nomme ce qu'il interdit.
 */
const FORME_INVITE = /invité/i;

/** Les portées du contrôle : le code, les écrans, les docs, la base et le prompt des agents. */
const PORTEES_INVITE = ['src', 'docs', 'supabase', '.opencode', 'README.md', 'DESIGN.md'] as const;

const EXCEPTIONS_INVITE = [
  // Flavour : « Personne ne l'a invité » (atelier) et « Le Planqué adverse est invité à
  // relâcher les épaules » (sse) parlent d'une scène de bureau, pas du testeur.
  'src/data/atelier.ts',
  'src/data/sse.ts',
  // Le journal ne se réécrit pas (D-111), et l'index est dérivé du journal.
  'docs/DECISIONS.md',
  'docs/DECISIONS-INDEX.md',
  // Un acte **appliqué** ne se réécrit pas non plus : l'empreinte SHA-256 de `0005` est
  // inscrite dans `admin.migrations` (registre de la base réelle), et renommer un mot dans
  // son commentaire l'aurait fait diverger du registre sans rien changer au schéma. Même
  // raison pour l'import de D-106, déjà joué.
  'supabase/migrations/0005_comptes.sql',
  'supabase/imports/comite-fichier-2026-10-26.sql',
  // Ce fichier-ci nomme ce qu'il interdit : il ne peut pas se compter comme une référence.
  'src/renommages.test.ts'
];

/** Les lignes qui disent encore « invité », `chemin:ligne`, triées. */
function formesInvite(root: string, portees: readonly string[] = PORTEES_INVITE): string[] {
  const trouvees: string[] = [];
  for (const { relatif, chemin } of fichiers(root, portees, EXCEPTIONS_INVITE)) {
    readFileSync(chemin, 'utf8')
      .split('\n')
      .forEach((ligne, index) => {
        if (FORME_INVITE.test(ligne)) trouvees.push(`${relatif}:${index + 1}`);
      });
  }
  return trouvees.sort();
}

describe('« invité » ne désigne plus le testeur de l’alpha (#306, D-117)', () => {
  it('il ne reste que le flavour des cartes et le journal', () => {
    expect(formesInvite(RACINE)).toEqual([]);
  });

  it('le contrôle mord : un texte, une doc ou un commentaire qui le réintroduit est trouvé', () => {
    const bac = mkdtempSync(join(tmpdir(), 'vocabulaire-invite-'));
    try {
      mkdirSync(join(bac, 'src', 'pages'), { recursive: true });
      mkdirSync(join(bac, 'docs'), { recursive: true });
      // Le défaut que #306 a corrigé, tel quel : un écran qui parle encore aux « invités ».
      writeFileSync(join(bac, 'src', 'pages', 'Connexion.tsx'), 'L’alpha est réservée aux <strong>invités</strong>.\n');
      // Et une doc, qui doit s'accorder avec les textes qu'elle explique.
      writeFileSync(join(bac, 'docs', 'COMITE.md'), '# Le comité\n\nCe que les invitées remontent.\n');
      // Le flavour, lui, garde le mot : c'est une scène, pas le testeur.
      mkdirSync(join(bac, 'src', 'data'), { recursive: true });
      writeFileSync(join(bac, 'src', 'data', 'atelier.ts'), "flavor: 'Personne ne l’a invité.',\n");

      expect(formesInvite(bac, ['src', 'docs'])).toEqual(['docs/COMITE.md:3', 'src/pages/Connexion.tsx:1']);
    } finally {
      rmSync(bac, { recursive: true, force: true });
    }
  });
});

describe('les mots retirés du vocabulaire ne reviennent pas à l’écran (#220, D-075, D-083)', () => {
  it('ni Chariot, ni Rack, ni Parc dans src/pages et src/components', () => {
    expect(motsRetires(RACINE)).toEqual([]);
  });

  it('le contrôle mord : un écran qui réemploie un mot est trouvé, ses tokens légitimes non', () => {
    const bac = mkdtempSync(join(tmpdir(), 'vocabulaire-'));
    try {
      mkdirSync(join(bac, 'src', 'pages'), { recursive: true });
      mkdirSync(join(bac, 'src', 'components'), { recursive: true });
      // Le défaut de 0.1.11, tel quel : c'est lui que le contrôle doit voir.
      writeFileSync(join(bac, 'src', 'pages', 'Deck.tsx'), '<h2>Chariots proposés</h2>\n');
      writeFileSync(
        join(bac, 'src', 'components', 'Banc.tsx'),
        'Le Planqué du Rack reçoit le café, et le Parc le montre.\n'
      );
      // Les deux tokens gardés exprès : la valeur du moteur, les anciennes adresses.
      writeFileSync(
        join(bac, 'src', 'pages', 'Battle.moteur.test.tsx'),
        "const ability = { target: 'rack' };\n// /parc et /chariot redirigent vers /collection et /deck.\n"
      );

      expect(motsRetires(bac)).toEqual([
        'src/components/Banc.tsx : Parc',
        'src/components/Banc.tsx : Rack',
        'src/pages/Deck.tsx : Chariot'
      ]);
    } finally {
      rmSync(bac, { recursive: true, force: true });
    }
  });
});
