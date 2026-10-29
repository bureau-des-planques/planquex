import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STATUTS, lireMur } from '../../src/store/mur';

/**
 * Le déplacement d'un post-it du mur (#140).
 *
 * Le script est testé **comme une commande** — c'est `npm run statut` que Bastien lancera,
 * pas une fonction (même technique que `mur-import.test.ts`). Aucun test ne touche au vrai
 * `docs/comite.json` : `--fichier` pointe une **copie** dans un bac temporaire, et
 * chaque refus est vérifié par les **octets** du fichier, pas par une impression.
 *
 * Les gardes doivent **mordre** (ticket #112) : chacune est confrontée à un cas fautif —
 * un statut inventé, un écarté sans raison, un ticket qui n'est pas un entier, un id
 * inconnu, un fichier déjà invalide, et une relecture fautive qui doit restaurer
 * l'original. Neutraliser le contrôle correspondant fait échouer le test.
 */
const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const MUR_SOURCE = join(RACINE, 'docs', 'comite.json');
const SCRIPT = 'scripts/generateurs/statut-mur.mjs';

/** Le post-it structuré (OUF) du fichier réel — celui qu'on déplace dans les tests. */
const ID = 'p-23-10-2026-01-37-45-papi';
/** Le gueulage, qui ne porte **aucune** famille (D-085). */
const GUEULAGE = 'p-23-10-2026-01-36-03-c-est-de-la-merde-ton-jeux';

type Postit = Record<string, unknown> & {
  id: string;
  statut: string;
  raison: string;
  ticket: number | null;
};
type Document = Record<string, unknown> & { postits: Postit[] };

function postitDe(document: Document, id: string): Postit {
  const postit = document.postits.find((entree) => entree.id === id);
  if (!postit) throw new Error(`fixture : post-it « ${id} » absent`);
  return postit;
}

/**
 * Une **copie** du vrai mur dans un bac temporaire, plus deux champs que le script ne
 * connaît pas : ils doivent traverser l'écriture intacts (le fichier appartient au dépôt,
 * pas au script).
 */
function bac(): { mur: string; texteInitial: string; document: Document } {
  const dossier = mkdtempSync(join(tmpdir(), 'statut-mur-'));
  const mur = join(dossier, 'comite.json');
  const document = JSON.parse(readFileSync(MUR_SOURCE, 'utf8')) as Document;
  document.champ_inconnu = { garder: true };
  postitDe(document, ID).note_interne = 'à garder';
  writeFileSync(mur, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return { mur, texteInitial: readFileSync(mur, 'utf8'), document };
}

function lancer(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: RACINE,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

const ecrire = (chemin: string, document: Document) =>
  writeFileSync(chemin, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

describe('npm run statut — déplacer un post-it', () => {
  it('déplace le statut, sans toucher à la forme ni aux champs inconnus', () => {
    const { mur, texteInitial, document } = bac();

    const resultat = lancer([ID, 'en cours', '--fichier', mur]);
    expect(resultat.stderr).toBe('');
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain(`statut « en cours »`);

    const texte = readFileSync(mur, 'utf8');
    // Le format du dépôt : deux espaces d'indentation et un saut de ligne final. Comparé
    // au document attendu, pas à lui-même — c'est ce qui prouve que rien n'a bougé.
    const attendu = structuredClone(document);
    postitDe(attendu, ID).statut = 'en cours';
    expect(texte).toBe(`${JSON.stringify(attendu, null, 2)}\n`);

    const ecrit = JSON.parse(texte) as Document;
    expect(ecrit.champ_inconnu).toEqual({ garder: true });
    expect(postitDe(ecrit, ID).note_interne).toBe('à garder');
    // Et ce que le script a écrit passe le vrai contrat du mur.
    expect(lireMur(ecrit).erreurs).toEqual([]);
    expect(texteInitial).not.toBe(texte);
  });

  it('dit dans quel monde il a trié : sans base, c’est le fichier que le mur lit', () => {
    const { mur } = bac();
    // L'environnement du test ne porte pas les variables Supabase (elles vivent dans `.env`,
    // que Vite lit et que ce script ne lit pas) : le message doit donc dire « fichier ».
    const resultat = lancer([ID, 'retenu', '--fichier', mur], {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: ''
    });
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('La base n’est pas configurée');
    expect(resultat.stdout).toContain('ce fichier est ce que le mur lit');
  });

  it('dit aussi quand la base est configurée : le fichier n’est plus que le secours', () => {
    const { mur } = bac();
    const resultat = lancer([ID, 'retenu', '--fichier', mur], {
      VITE_SUPABASE_URL: 'https://exemple.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'cle-publique-de-test'
    });
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('La base est configurée');
    expect(resultat.stdout).toContain('/administration');
  });

  it('un gueulage se déplace comme les autres, et reste sans famille (D-085)', () => {
    const { mur } = bac();
    const resultat = lancer([GUEULAGE, 'retenu', '--fichier', mur]);
    expect(resultat.status).toBe(0);

    const ecrit = JSON.parse(readFileSync(mur, 'utf8')) as Document;
    const gueulage = postitDe(ecrit, GUEULAGE);
    expect(gueulage.statut).toBe('retenu');
    expect(gueulage).not.toHaveProperty('kind');
    expect(lireMur(ecrit).erreurs).toEqual([]);
  });

  it('refuse un statut inventé, et n’écrit pas un octet', () => {
    const { mur, texteInitial } = bac();

    const resultat = lancer([ID, 'terminé', '--fichier', mur]);
    expect(resultat.status).toBe(1);
    // Le refus vient de l'**argument**, avant toute lecture : le contrôle du fichier
    // refuserait aussi, mais plus tard, et le message ne serait pas le même.
    expect(resultat.stderr).toContain('statut-mur — « terminé » n’est pas un statut admis');
    // La liste vient du contrat : le message la cite en entier.
    for (const statut of STATUTS) expect(resultat.stderr).toContain(statut);
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('refuse d’écarter sans raison non vide', () => {
    const { mur, texteInitial } = bac();

    const sansRaison = lancer([ID, 'écarté', '--fichier', mur]);
    expect(sansRaison.status).toBe(1);
    expect(sansRaison.stderr).toContain('exige une raison');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);

    const vide = lancer([ID, 'écarté', '--raison', '   ', '--fichier', mur]);
    expect(vide.status).toBe(1);
    expect(vide.stderr).toContain('raison ne peut pas être vide');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('écarte avec sa raison, et la garde sur le mur', () => {
    const { mur } = bac();

    const resultat = lancer([ID, 'écarté', '--raison', 'doublon de #100', '--fichier', mur]);
    expect(resultat.stderr).toBe('');
    expect(resultat.status).toBe(0);

    const ecrit = JSON.parse(readFileSync(mur, 'utf8')) as Document;
    expect(postitDe(ecrit, ID)).toMatchObject({ statut: 'écarté', raison: 'doublon de #100' });
    expect(lireMur(ecrit).erreurs).toEqual([]);
  });

  it('refuse une raison sur un post-it qui n’est pas écarté', () => {
    const { mur, texteInitial } = bac();

    const resultat = lancer([ID, 'retenu', '--raison', 'hors sujet', '--fichier', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('qu’avec le statut « écarté »');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('lie un ticket entier, et laisse le statut en place', () => {
    const { mur } = bac();

    const resultat = lancer([ID, '--ticket', '140', '--fichier', mur]);
    expect(resultat.stderr).toBe('');
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('ticket #140');

    const ecrit = JSON.parse(readFileSync(mur, 'utf8')) as Document;
    expect(postitDe(ecrit, ID)).toMatchObject({ ticket: 140, statut: 'en attente' });
    expect(lireMur(ecrit).erreurs).toEqual([]);
  });

  it('refuse un ticket qui n’est pas un entier positif', () => {
    for (const ticket of ['12.5', 'abc', '0', '-3', '140abc']) {
      const { mur, texteInitial } = bac();
      const resultat = lancer([ID, '--ticket', ticket, '--fichier', mur]);
      expect(resultat.status, `ticket « ${ticket} »`).toBe(1);
      expect(resultat.stderr).toContain('n’est pas un numéro de ticket');
      expect(readFileSync(mur, 'utf8'), `ticket « ${ticket} »`).toBe(texteInitial);
    }
  });

  it('refuse un id inconnu, et n’écrit rien', () => {
    const { mur, texteInitial } = bac();

    const resultat = lancer(['p-inexistant', 'retenu', '--fichier', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('aucun post-it « p-inexistant »');
    // Le message nomme les ids réels : c'est ce qui rend l'erreur réparable.
    expect(resultat.stderr).toContain(ID);
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });

  it('refuse d’écrire dans un mur déjà invalide, et le laisse tel quel', () => {
    const { mur, document } = bac();
    postitDe(document, ID).statut = 'terminé';
    ecrire(mur, document);
    const invalide = readFileSync(mur, 'utf8');

    const resultat = lancer([GUEULAGE, 'retenu', '--fichier', mur]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('déjà invalide');
    expect(resultat.stderr).toContain('statut');
    expect(readFileSync(mur, 'utf8')).toBe(invalide);
  });

  it('un fichier relu invalide est remis dans son état d’origine', () => {
    const { mur, texteInitial } = bac();

    // La relecture est fautive **par injection** (réservée à `--fichier`) : sans la
    // restauration, c'est le document déplacé qui resterait sur le disque.
    const resultat = lancer([ID, 'en cours', '--fichier', mur], {
      STATUT_MUR_RELECTURE_CORROMPUE: '1'
    });
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('l’original a été restauré');
    expect(readFileSync(mur, 'utf8')).toBe(texteInitial);
  });
});

describe('npm run statut — la commande elle-même', () => {
  it('est déclarée dans package.json', () => {
    const pkg = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.statut).toBe('node scripts/generateurs/statut-mur.mjs');
  });

  it('--aide ne lit aucun fichier et sort à zéro', () => {
    const resultat = lancer(['--aide']);
    expect(resultat.status).toBe(0);
    expect(resultat.stdout).toContain('npm run statut');
    expect(resultat.stdout).toContain('écarté');
  });

  it('sans argument, explique l’usage et sort en erreur', () => {
    const resultat = lancer([]);
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('un post-it est requis');
  });
});
