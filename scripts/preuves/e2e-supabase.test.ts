// Lent : deux cas lancent `scripts/preuves/capturer.mjs --e2e` en sous-processus (le module de
// preuve importe Vite et Playwright) ; c'est le contrat de la commande, vérifié en la lançant.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HOTES_PRODUCTION,
  STORAGE_KEY,
  VARIABLES,
  authentifier,
  cleSession,
  diagnosticE2E,
  etatPrepare,
  identifiantsVisibles,
  lireCompteTest,
  refuserProduction,
  REPONSES_404_IGNOREES,
  reponses404Inattendues,
  resumeReponse404,
  verifierCapturesSansIdentifiant,
  verifierEtatPrepare,
  type ClientE2E
} from './e2e-supabase.mjs';

/**
 * #668 — **la preuve E2E du projet de test**, sans réseau.
 *
 * Le module réseau n'est pas joignable depuis un test unitaire (et ne doit pas l'être) : on
 * éprouve ses décisions pures — diagnostic de l'environnement, refus de la production,
 * contrat de l'état préparé, refus des identifiants, refus des captures qui portent un
 * identifiant —, puis la commande **réelle** sans secrets, qui doit sauter et sortir 0.
 *
 * **Le contrôle mord** : chaque garde est confrontée à un cas fautif — une adresse de
 * production, des identifiants refusés, un état qui recopie sa version, une capture qui
 * contient le courriel —, et le workflow protégé est analysé sur un YAML fabriqué fautif.
 */
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

const SESSION = {
  access_token: 'jeton-de-test',
  refresh_token: 'rafraichissement-de-test',
  user: { id: 'compte-de-test' }
};

/** Un environnement de sous-processus **sans** identifiants ni configuration, pour le saut. */
function environnementSansSecrets(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const nom of [
    'BASE_URL',
    'PORT',
    VARIABLES.email,
    VARIABLES.motDePasse,
    VARIABLES.url,
    VARIABLES.cle
  ]) {
    delete env[nom];
  }
  return env;
}

/** Lance `capturer.mjs --e2e` et rend la sortie, ou l'erreur avec son code de sortie. */
function lancerE2E(env: NodeJS.ProcessEnv): { ok: true; stdout: string } | { ok: false; status: number | null; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--e2e'], {
      cwd: root,
      encoding: 'utf8',
      env
    });
    return { ok: true, stdout };
  } catch (erreur) {
    const e = erreur as { status?: number | null; stderr?: Buffer | string };
    return { ok: false, status: e.status ?? null, stderr: String(e.stderr ?? '') };
  }
}

describe('la preuve E2E saute sans secrets (#668)', () => {
  it('saute la partie réseau avec une raison, vérifie le contrat et sort 0', () => {
    const resultat = lancerE2E(environnementSansSecrets());
    expect(resultat.ok, JSON.stringify(resultat)).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.stdout).toContain('Preuve E2E sautée');
    expect(resultat.stdout).toContain(VARIABLES.email);
    expect(resultat.stdout).toContain('Contrat de l’état préparé vérifié');
  });

  it('échoue quand une seule des deux variables est posée au lieu de sauter', () => {
    const env = environnementSansSecrets();
    env[VARIABLES.email] = 'test@exemple.test';
    const resultat = lancerE2E(env);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('vont ensemble');
  });

  it('refuse la production avant toute connexion, et ne sort pas 0', () => {
    const env = environnementSansSecrets();
    env[VARIABLES.email] = 'test@exemple.test';
    env[VARIABLES.motDePasse] = 'mot-de-passe-de-test';
    env[VARIABLES.url] = `https://${HOTES_PRODUCTION[0]}`;
    env[VARIABLES.cle] = 'sb_publishable_de_test';
    const resultat = lancerE2E(env);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('production');
  });
});

describe('l’environnement de la preuve E2E', () => {
  it('distingue absence, configuration incomplète et configuration prête', () => {
    expect(diagnosticE2E({}).etat).toBe('saute');
    expect(diagnosticE2E({ [VARIABLES.email]: 'a@b.test' }).etat).toBe('cassee');
    expect(
      diagnosticE2E({
        [VARIABLES.email]: 'a@b.test',
        [VARIABLES.motDePasse]: 'secret',
        [VARIABLES.url]: 'https://planquex-test.supabase.co'
      }).etat
    ).toBe('cassee');
    expect(
      diagnosticE2E({
        [VARIABLES.email]: 'a@b.test',
        [VARIABLES.motDePasse]: 'secret',
        [VARIABLES.url]: 'https://planquex-test.supabase.co',
        [VARIABLES.cle]: 'sb_publishable_de_test'
      })
    ).toMatchObject({ etat: 'pret', hote: 'planquex-test.supabase.co' });
  });

  it('refuse une adresse de production, même si elle est en https', () => {
    expect(() => refuserProduction(`https://${HOTES_PRODUCTION[0]}`)).toThrow(/production/);
    expect(() => refuserProduction('https://planquex.4k7.org')).toThrow(/production/);
    expect(() => refuserProduction('http://exemple.test')).toThrow(/https/);
  });

  it('accepte le projet de test et le Supabase local', () => {
    expect(refuserProduction('https://planquex-test.supabase.co')).toBe('planquex-test.supabase.co');
    expect(refuserProduction('http://localhost:54321')).toBe('localhost');
  });
});

describe('l’authentification de la preuve E2E', () => {
  it('lève sur des identifiants refusés, sans transformer le refus en succès', async () => {
    const client = {
      auth: {
        signInWithPassword: async () => ({
          data: { session: null },
          error: { message: 'Invalid login credentials' }
        })
      }
    } as unknown as ClientE2E;
    const erreur = (await authentifier(client, {
      email: 'test@exemple.test',
      motDePasse: 'mot-de-passe-faux'
    }).catch((e) => e)) as Error;
    expect(erreur).toBeInstanceOf(Error);
    expect(erreur.message).toContain('refusée');
    expect(erreur.message).not.toContain('mot-de-passe-faux');
  });

  it('rend la session quand les identifiants sont valides', async () => {
    const client = {
      auth: {
        signInWithPassword: async () => ({
          data: { session: SESSION },
          error: null
        })
      }
    } as unknown as ClientE2E;
    await expect(authentifier(client, { email: 'a@b.test', motDePasse: 'secret' })).resolves.toEqual(SESSION);
  });

  it('lève quand la réponse ne porte aucune session', async () => {
    const client = {
      auth: { signInWithPassword: async () => ({ data: { session: null }, error: null }) }
    } as unknown as ClientE2E;
    await expect(authentifier(client, { email: 'a@b.test', motDePasse: 'secret' })).rejects.toThrow(/sans session/);
  });

  it('exige une ligne de compte non administrateur', async () => {
    const client = (compte: unknown[] | null, error: { message: string } | null = null): ClientE2E =>
      ({
        from: () => ({ select: () => ({ eq: async () => ({ data: compte, error }) }) })
      }) as unknown as ClientE2E;

    await expect(
      lireCompteTest(client([{ id: 'compte-a', etat: 'approuve', administrateur: true }]), 'compte-a')
    ).rejects.toThrow(/administrateur/);
    await expect(lireCompteTest(client([]), 'compte-a')).rejects.toThrow(/public\.comptes/);
    await expect(lireCompteTest(client(null, { message: 'réseau muet' }), 'compte-a')).rejects.toThrow(/réseau muet/);
    await expect(
      lireCompteTest(client([{ id: 'compte-a', etat: 'approuve', administrateur: false }]), 'compte-a')
    ).resolves.toMatchObject({ administrateur: false });
  });
});

describe('l’état préparé de la preuve E2E', () => {
  it('range la session sous la clé de Supabase et le store du jeu sans version recopiée', () => {
    const etat = etatPrepare({
      origine: 'http://localhost:4180',
      url: 'https://abcdefghijkl.supabase.co',
      session: SESSION
    });
    expect(cleSession('https://abcdefghijkl.supabase.co')).toBe('sb-abcdefghijkl-auth-token');
    expect(etat.cookies).toEqual([]);
    expect(etat.origins).toHaveLength(1);
    const [origine] = etat.origins;
    expect(origine.origin).toBe('http://localhost:4180');
    expect(origine.localStorage).toHaveLength(2);
    expect(origine.localStorage[0]).toEqual({
      name: 'sb-abcdefghijkl-auth-token',
      value: JSON.stringify(SESSION)
    });
    expect(origine.localStorage[1].name).toBe(STORAGE_KEY);
    const store = JSON.parse(origine.localStorage[1].value);
    expect(store).toEqual({ state: { tutorielVu: true } });
    expect('version' in store).toBe(false);
    expect(verifierEtatPrepare(etat)).toEqual([]);
  });

  it('le contrôle mord : une version recopiée ou un cookie sont refusés', () => {
    const etat = etatPrepare({
      origine: 'http://localhost:4180',
      url: 'https://abcdefghijkl.supabase.co',
      session: SESSION
    });
    const avecVersion = structuredClone(etat);
    avecVersion.origins[0].localStorage[1].value = JSON.stringify({
      state: { tutorielVu: true },
      version: 42
    });
    expect(verifierEtatPrepare(avecVersion).some((raison) => raison.includes('version'))).toBe(true);

    const avecCookie = structuredClone(etat);
    avecCookie.cookies.push({ name: 'x', value: 'y', domain: 'localhost', path: '/' });
    expect(verifierEtatPrepare(avecCookie).some((raison) => raison.includes('cookies'))).toBe(true);
  });

  it('ne laisse pas un courriel, un identifiant ou un jeton dans le texte d’une page', () => {
    expect(
      identifiantsVisibles('Bonjour test@exemple.test', {
        email: 'test@exemple.test',
        uid: 'compte-a',
        jeton: 'jeton'
      })
    ).toEqual(['courriel']);
    expect(identifiantsVisibles('Bonjour', { email: 'test@exemple.test', uid: 'compte-a', jeton: 'jeton' })).toEqual(
      []
    );
  });

  it('ne contient aucune écriture vers la base (ni insert, update, delete ni rpc)', () => {
    // La preuve **lit** le compte et photographie deux écrans. Une écriture ajoutée ici
    // viserait le projet de test sans le dire, et pourrait un jour viser la production :
    // cette garde tombe dès qu'un verbe d'écriture entre dans le module.
    const source = read('scripts/preuves/e2e-supabase.mjs');
    for (const verbe of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(']) {
      expect(source, `écriture interdite dans la preuve E2E : ${verbe}`).not.toContain(verbe);
    }
  });

  it('refuse une capture qui contient un identifiant, et le dit sans citer la valeur', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'planquex-e2e-'));
    try {
      writeFileSync(join(dossier, 'capture.png'), 'binaire test@exemple.test binaire');
      const trouvees = verifierCapturesSansIdentifiant(dossier, ['test@exemple.test']);
      expect(trouvees).toEqual(['capture.png contient un identifiant']);
      expect(trouvees.join(' ')).not.toContain('test@exemple.test');

      writeFileSync(join(dossier, 'capture.png'), 'binaire sans identifiant');
      expect(verifierCapturesSansIdentifiant(dossier, ['test@exemple.test'])).toEqual([]);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe('le diagnostic des 404 de la preuve E2E (#668)', () => {
  it('nomme la méthode, l’origine et le chemin — jamais la query string', () => {
    const ligne = resumeReponse404(
      'post',
      'https://pqypogotxhdnyyfqsyop.supabase.co/rest/v1/importer_deck?apikey=une-cle&compte=un-identifiant#fragment'
    );
    expect(ligne).toBe('POST https://pqypogotxhdnyyfqsyop.supabase.co/rest/v1/importer_deck');
    expect(ligne).not.toContain('une-cle');
    expect(ligne).not.toContain('un-identifiant');
    expect(ligne).not.toContain('apikey');
  });

  it('masque une UUID dans le chemin, pour qu’un identifiant de ressource ne fuie pas', () => {
    expect(resumeReponse404('GET', 'https://exemple.test/comptes/00000000-0000-4000-8000-000000000000')).toBe(
      'GET https://exemple.test/comptes/:id'
    );
  });

  it('le contrôle mord : une exception ne couvre que l’URL nommée, un 404 inconnu échoue', () => {
    const connue = 'POST https://exemple.test/rest/v1/importer_deck';
    // Aucune exception n'est posée aujourd'hui : un 404 est un défaut, pas un bruit.
    expect(REPONSES_404_IGNOREES).toEqual([]);
    expect(reponses404Inattendues([connue], [connue])).toEqual([]);
    // Le cas fautif : le même chemin avec un autre verbe, ou une autre ressource.
    expect(reponses404Inattendues([connue])).toEqual([connue]);
    expect(reponses404Inattendues(['GET https://exemple.test/autre'], [connue])).toEqual([
      'GET https://exemple.test/autre'
    ]);
  });
});

/**
 * Le workflow protégé (#668). Il n'est pas analysé par un parseur YAML : les invariants qui
 * comptent se lisent dans le texte — un seul déclencheur, l'environnement, les permissions,
 * les actions épinglées, et aucun secret écrit dans une commande. Le contrôle **mord** sur un
 * YAML fabriqué, pas seulement sur le fichier sain du moment.
 */
function sansCommentaires(source: string): string {
  return source
    .split('\n')
    .map((ligne) => ligne.replace(/\s+#.*$/, ''))
    .join('\n');
}

function blocDeclencheurs(source: string): string {
  const lignes = sansCommentaires(source).split('\n');
  const debut = lignes.findIndex((ligne) => /^on:\s*$/.test(ligne));
  if (debut === -1) return '';
  const bloc: string[] = [];
  for (let i = debut + 1; i < lignes.length; i += 1) {
    const ligne = lignes[i];
    if (ligne.trim() !== '' && !/^\s/.test(ligne)) break;
    bloc.push(ligne);
  }
  return bloc.join('\n');
}

function blocsRun(source: string): string[] {
  const lignes = sansCommentaires(source).split('\n');
  const blocs: string[] = [];
  for (let i = 0; i < lignes.length; i += 1) {
    const entete = /^(\s*)run:\s*(.*)$/.exec(lignes[i]);
    if (!entete) continue;
    const indentation = entete[1].length;
    const corps = [entete[2]];
    for (let j = i + 1; j < lignes.length; j += 1) {
      const ligne = lignes[j];
      if (ligne.trim() === '') {
        corps.push('');
        continue;
      }
      if (ligne.length - ligne.trimStart().length <= indentation) break;
      corps.push(ligne);
    }
    blocs.push(corps.join('\n'));
  }
  return blocs;
}

/** Les raisons pour lesquelles le workflow ne garde pas la preuve ; vide = conforme. */
function analyserWorkflow(source: string): string[] {
  const problemes: string[] = [];
  const declencheurs = [...blocDeclencheurs(source).matchAll(/^ {2}([a-zA-Z_]+):/gm)].map(([, nom]) => nom);
  if (declencheurs.length !== 1 || declencheurs[0] !== 'workflow_dispatch') {
    problemes.push(`déclencheurs : workflow_dispatch seul attendu, trouvé ${declencheurs.join(', ') || 'aucun'}`);
  }
  if (!/^\s{4}environment:\s*planquex-test\s*$/m.test(sansCommentaires(source))) {
    problemes.push('environment: planquex-test absent');
  }
  const permissions = /^permissions:\s*\n((?: {2}.*\n?)+)/m.exec(sansCommentaires(source))?.[1] ?? '';
  if (!/^\s{2}contents:\s*read\s*$/m.test(permissions)) problemes.push('permissions: contents: read absent');
  if (/\bwrite\b/.test(permissions)) problemes.push('permissions en écriture');

  for (const [, ref] of source.matchAll(/uses:\s*(\S+)/g)) {
    if (!/@v\d+$/.test(ref)) problemes.push(`action non épinglée par version majeure : ${ref}`);
  }

  for (const [index, bloc] of blocsRun(source).entries()) {
    // On cherche la **valeur** (`$E2E_TEST_EMAIL`, `${{ secrets.… }}`), pas le simple nom
    // d'une variable cité dans un message d'erreur : `echo "E2E_TEST_EMAIL manque"` ne
    // divulgue rien, `echo "$E2E_TEST_EMAIL"` si.
    const secretEcrit =
      /(?:echo|printf|tee)\s[^\n]*\$(?:E2E_TEST_(?:EMAIL|PASSWORD)|\{\{\s*secrets\.)/i.test(bloc) ||
      /\bset\s+-x\b/.test(bloc) ||
      /(?:>>?|tee\s+[^\n]*)\s*\$(?:E2E_TEST_(?:EMAIL|PASSWORD)|\{\{\s*secrets\.)/i.test(bloc);
    if (secretEcrit) problemes.push(`secret écrit dans une commande (run n°${index + 1})`);
  }

  for (const nom of ['E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD']) {
    const motif = new RegExp(`^\\s*${nom}:\\s*\\$\\{\\{\\s*secrets\\.${nom}\\s*\\}\\}\\s*$`, 'm');
    if (!motif.test(source)) problemes.push(`${nom} n’est pas passé par env: depuis les secrets`);
  }
  if (!/if-no-files-found:\s*error/.test(source)) problemes.push('artefact sans if-no-files-found: error');

  return problemes;
}

describe('le workflow navigateur protégé', () => {
  const WORKFLOW = '.github/workflows/preuve-e2e.yml';

  it('ne se déclenche que sur workflow_dispatch, dans planquex-test', () => {
    const source = read(WORKFLOW);
    expect(analyserWorkflow(source)).toEqual([]);
    expect(blocDeclencheurs(source)).toContain('workflow_dispatch');
    expect(source).toMatch(/environment:\s*planquex-test/);
  });

  it('le contrôle mord sur un déclencheur, un environnement ou un secret fautif', () => {
    const valide = [
      'name: Preuve E2E',
      'on:',
      '  workflow_dispatch:',
      'permissions:',
      '  contents: read',
      'jobs:',
      '  preuve:',
      '    runs-on: ubuntu-latest',
      '    environment: planquex-test',
      '    steps:',
      '      - uses: actions/checkout@v7',
      '      - name: Preuve',
      '        env:',
      '          E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}',
      '          E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}',
      '        run: npm run e2e',
      '      - uses: actions/upload-artifact@v4',
      '        with:',
      '          if-no-files-found: error'
    ].join('\n');
    expect(analyserWorkflow(valide)).toEqual([]);

    expect(analyserWorkflow(valide.replace('  workflow_dispatch:', '  push:'))).not.toEqual([]);
    expect(analyserWorkflow(valide.replace('    environment: planquex-test\n', ''))).not.toEqual([]);
    expect(analyserWorkflow(valide.replace('run: npm run e2e', 'run: echo "$E2E_TEST_PASSWORD"'))).not.toEqual([]);
    expect(analyserWorkflow(valide.replace('actions/checkout@v7', 'actions/checkout@main'))).not.toEqual([]);
    expect(analyserWorkflow(valide.replace('  contents: read', '  contents: write'))).not.toEqual([]);
  });
});
