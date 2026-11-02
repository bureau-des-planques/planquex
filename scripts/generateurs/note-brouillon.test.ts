// @vitest-environment node
/**
 * **La note d'une version à venir, écrite par le générateur** — #623.
 *
 * Le défaut mesuré, sur la release 0.1.17 : `docs/VERSIONS.md` §4 disait « écrire la note »
 * dans `src/data/versions.ts`, et ce fichier dit « **ne pas éditer à la main** ». Deux
 * `npm test` rouges ont été nécessaires pour retrouver la mise en forme du générateur, et
 * `src/data/notes-resume.ts` avait été oublié. Ce test éprouve le remplaçant du geste :
 *
 * 1. l'écriture est **réelle**, dans un bac temporaire, et les deux fichiers sortent
 *    **exactement** de `rendreFichier` et `rendreResume` — c'est la forme que
 *    `notes-versions.test.ts` compare au fichier commité ;
 * 2. le brouillon va **en tête**, porte `brouillon: true`, le titre `Version <numéro>` et la
 *    date demandée ;
 * 3. le fichier écrit est **relu** par Node (un processus neuf, donc sans cache de module) :
 *    une entrée mal formée se verrait là, et pas seulement dans une comparaison de chaînes ;
 * 4. **chaque refus** est confronté à son cas fautif, et le refus **n'écrit rien**.
 *
 * Rien n'est écrit dans le dépôt : les chemins sont injectés, comme le fait déjà
 * `scripts/ci/taille-paquets.test.ts` pour son `dist/`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ajouterBrouillon,
  ecrireBrouillon,
  lireArguments,
  lirePoints,
  noteBrouillon
} from './note-brouillon.mjs';
import { rendreFichier, rendreResume } from './notes-versions.mjs';

const CHEMIN = fileURLToPath(new URL('./note-brouillon.mjs', import.meta.url));

/** Les bacs du test, supprimés après chaque cas : aucun fichier ne survit dans /tmp. */
const bacs: string[] = [];

afterEach(() => {
  for (const bac of bacs.splice(0)) rmSync(bac, { recursive: true, force: true });
});

/** Un dépôt en miniature : de quoi écrire les deux fichiers, et rien d'autre. */
function bac(): { dossier: string; cible: string; resume: string } {
  const dossier = mkdtempSync(join(tmpdir(), 'note-brouillon-'));
  bacs.push(dossier);
  const data = join(dossier, 'src', 'data');
  mkdirSync(data, { recursive: true });
  return { dossier, cible: join(data, 'versions.ts'), resume: join(data, 'notes-resume.ts') };
}

/** Deux notes publiées, pour vérifier la place du brouillon et le reste de l'historique. */
const PUBLIEE = {
  version: '0.1.17',
  date: '2026-11-01',
  titre: 'Version 0.1.17',
  points: [{ groupe: 'Jeu', texte: 'une chose corrigée.' }]
};
const ANCIENNE = {
  version: '0.1.16',
  date: '2026-10-30',
  titre: 'Version 0.1.16',
  points: [{ texte: 'une autre chose.' }]
};

const POINTS = [{ groupe: 'Jeu', texte: 'le brouillon dit ce qui arrive.' }];
const ATTENDUE = {
  version: '0.1.18',
  date: '2026-11-02',
  titre: 'Version 0.1.18',
  points: POINTS,
  brouillon: true
};

/** Lance le CLI sur un bac ; rend son code et sa sortie, au lieu de laisser jeter. */
function lancer(args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [CHEMIN, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, stdout, stderr: '' };
  } catch (erreur) {
    const sortie = erreur as { status?: number; stdout?: string; stderr?: string };
    return { code: sortie.status ?? -1, stdout: sortie.stdout ?? '', stderr: sortie.stderr ?? '' };
  }
}

describe('note-brouillon — le fichier de points', () => {
  it('lit `groupe | texte` et `texte`, une ligne par point', () => {
    expect(lirePoints('Jeu | une chose\nune autre, sans groupe\n')).toEqual([
      { groupe: 'Jeu', texte: 'une chose' },
      { texte: 'une autre, sans groupe' }
    ]);
    // Un groupe vide n'invente pas d'étiquette : le pipe est facultatif, pas décoratif.
    expect(lirePoints(' | une chose')).toEqual([{ texte: 'une chose' }]);
    // Le saut de ligne final d'un éditeur n'est pas une ligne vide.
    expect(lirePoints('une chose\n')).toHaveLength(1);
    expect(lirePoints('une chose')).toHaveLength(1);
  });

  it('le contrôle mord : liste vide, ligne vide et point sans texte sont refusés', () => {
    expect(() => lirePoints('')).toThrow(/est vide/);
    expect(() => lirePoints('   \n  ')).toThrow(/est vide/);
    expect(() => lirePoints('une chose\n\ndeux choses')).toThrow(/ligne 2 est vide/);
    expect(() => lirePoints('un groupe |')).toThrow(/ligne 1 n'a pas de texte/);
    expect(() => lirePoints('groupe |   ')).toThrow(/n'a pas de texte/);
  });
});

describe('note-brouillon — l’entrée et sa place', () => {
  it('titre neutre, date demandée, drapeau de brouillon', () => {
    expect(noteBrouillon({ version: '0.1.18', points: POINTS, date: '2026-11-02' })).toEqual(ATTENDUE);
  });

  it('le contrôle mord : une version mal écrite ou sans point est refusée', () => {
    expect(() => noteBrouillon({ version: 'v0.1.18', points: POINTS })).toThrow(/version invalide/);
    expect(() => noteBrouillon({ version: '0.1', points: POINTS })).toThrow(/version invalide/);
    expect(() => noteBrouillon({ version: '0.1.18', points: [] })).toThrow(/aucun point/);
  });

  it('met le brouillon en tête, et refuse une version qui a déjà sa note', () => {
    const notes = ajouterBrouillon([PUBLIEE, ANCIENNE], ATTENDUE);
    expect(notes.map((note) => note.version)).toEqual(['0.1.18', '0.1.17', '0.1.16']);
    // Une version oubliée plus ancienne retrouve sa place : l'ordre est une règle du fichier.
    expect(ajouterBrouillon([PUBLIEE, ANCIENNE], { ...ATTENDUE, version: '0.1.15' }).map((n) => n.version)).toEqual(
      ['0.1.17', '0.1.16', '0.1.15']
    );
    expect(() => ajouterBrouillon([PUBLIEE, ANCIENNE], { ...ATTENDUE, version: '0.1.17' })).toThrow(
      /a déjà sa note/
    );
  });
});

describe('note-brouillon — l’écriture réelle, dans un bac', () => {
  it('écrit les deux fichiers exactement comme le générateur, brouillon en tête', async () => {
    const { cible, resume } = bac();
    writeFileSync(cible, rendreFichier([PUBLIEE, ANCIENNE]));

    const { notes } = await ecrireBrouillon({ version: '0.1.18', points: POINTS, date: '2026-11-02', cible, resume });

    // La forme n'est pas réimplémentée : elle **est** celle de rendreFichier / rendreResume.
    expect(readFileSync(cible, 'utf8')).toBe(rendreFichier([ATTENDUE, PUBLIEE, ANCIENNE]));
    expect(readFileSync(resume, 'utf8')).toBe(rendreResume([ATTENDUE, PUBLIEE, ANCIENNE]));
    expect(notes.map((note) => note.version)).toEqual(['0.1.18', '0.1.17', '0.1.16']);

    const fichier = readFileSync(cible, 'utf8');
    // En tête, et avec le drapeau qui compte pour la garde « on ne publie pas sans note ».
    expect(fichier.indexOf("version: '0.1.18'")).toBeLessThan(fichier.indexOf("version: '0.1.17'"));
    expect(fichier).toContain("titre: 'Version 0.1.18',\n    brouillon: true,");
    expect(fichier).toContain("date: '2026-11-02'");
    // Le résumé ne porte aucun texte de point : les ~19 kB restent hors du paquet principal.
    expect(readFileSync(resume, 'utf8')).not.toContain(POINTS[0].texte);
  });

  it('le fichier écrit se relit par Node, dans un processus neuf', async () => {
    const { dossier, cible, resume } = bac();
    writeFileSync(cible, rendreFichier([PUBLIEE]));
    await ecrireBrouillon({ version: '0.1.18', points: POINTS, date: '2026-11-02', cible, resume });

    // Un fichier qui ne se lit pas est un brouillon perdu : on le **charge**, sans cache.
    const lecteur = join(dossier, 'lire.mjs');
    writeFileSync(
      lecteur,
      "import { NOTES_VERSIONS } from './src/data/versions.ts';\n" +
        'console.log(JSON.stringify(NOTES_VERSIONS[0]));\n'
    );
    const relu = JSON.parse(execFileSync(process.execPath, [lecteur], { encoding: 'utf8' })) as typeof ATTENDUE;

    expect(relu.version).toBe('0.1.18');
    expect(relu.brouillon).toBe(true);
    expect(relu.titre).toBe('Version 0.1.18');
    expect(relu.points).toEqual(POINTS);
  });

  it('le contrôle mord : un refus n’écrit rien', async () => {
    const { cible, resume } = bac();
    const avant = rendreFichier([PUBLIEE, ANCIENNE]);
    writeFileSync(cible, avant);

    await expect(
      ecrireBrouillon({ version: '0.1.17', points: POINTS, date: '2026-11-02', cible, resume })
    ).rejects.toThrow(/a déjà sa note/);

    // L'historique et le résumé sont intacts : un refus à moitié appliqué serait pire que rien.
    expect(readFileSync(cible, 'utf8')).toBe(avant);
    expect(() => readFileSync(resume, 'utf8')).toThrow();
  });
});

describe('note-brouillon — les arguments et la commande', () => {
  it('lit `--version` et `--points`, séparés ou collés', () => {
    expect(lireArguments(['--version', '0.1.18', '--points', 'points.txt'])).toEqual({
      version: '0.1.18',
      points: 'points.txt'
    });
    expect(lireArguments(['--version=0.1.18', '--points=points.txt'])).toEqual({
      version: '0.1.18',
      points: 'points.txt'
    });
  });

  it('le contrôle mord : une option manquante ou inconnue est refusée', () => {
    expect(() => lireArguments([])).toThrow(/aucune version/);
    expect(() => lireArguments(['--version', '0.1.18'])).toThrow(/aucun fichier de points/);
    expect(() => lireArguments(['--version'])).toThrow(/demande une valeur/);
    expect(() => lireArguments(['--version', '0.1.18', '--points', 'p', '--quoi'])).toThrow(/option inconnue/);
  });

  it('le CLI sort 1 et dit pourquoi, sans rien écrire', () => {
    const { dossier } = bac();
    const vide = join(dossier, 'points.txt');
    writeFileSync(vide, 'une chose\n\ndeux choses\n');

    const refus = lancer(['--version', '0.1.18', '--points', vide]);
    expect(refus.code).toBe(1);
    expect(refus.stderr).toContain('ligne 2 est vide');

    // Un fichier de points introuvable est un refus nommé, pas une trace de pile.
    const absent = lancer(['--version', '0.1.18', '--points', join(dossier, 'absent.txt')]);
    expect(absent.code).toBe(1);
    expect(absent.stderr).toContain('introuvable');

    const sansVersion = lancer(['--points', vide]);
    expect(sansVersion.code).toBe(1);
    expect(sansVersion.stderr).toContain('aucune version');
  });

  it('est déclarée dans package.json, et rangée dans scripts/generateurs', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['note:brouillon']).toBe('node scripts/generateurs/note-brouillon.mjs');
    // Le rangement est une règle du dépôt (`scripts/gardes/rangement.test.ts`) : pas de script
    // à la racine de `scripts/`, et celui-ci écrit deux fichiers, donc il est un générateur.
    expect(CHEMIN).toContain(join('scripts', 'generateurs'));
  });
});
