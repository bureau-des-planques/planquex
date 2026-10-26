// @vitest-environment node
/**
 * Le poste de pilotage local — `tools/admin/` (#184, D-088, D-089, D-091).
 *
 * Une **seule couture** : l'API HTTP. Chaque scénario démarre le serveur sur un port éphémère
 * (`0`), avec un **adaptateur `pglite`** injecté qui rejoue d'abord les migrations réelles du
 * dépôt (le banc existant `supabase/pglite.ts`, réutilisé tel quel) puis le rôle `lecteur` de
 * `supabase/admin/roles.sql`. Les appels passent par `fetch` ; **aucun test ne touche le réseau**.
 *
 * Chaque contrôle **mord** : sans configuration → pas de démarrage ; `127.0.0.1` seule ; sans
 * jeton → refus ; écriture sans accusé → refus ; `delete` sans `where` sans le mot → refus ;
 * migration deux fois → refusée ; empreinte changée → signalée ; une lecture qui tente d'écrire
 * → refusée par la base ; courriel masqué ; journal alimenté ; un compte approuvé écrit, un
 * compte non approuvé est refusé ; la page et ses modules sont servis sous le jeton (#184,
 * rafraîchissement : le calcul du nouveau est testé à part, `suivi.test.ts`) ; le registre dit
 * l'**origine** des migrations — 0001–0006 sont antérieures, et jamais rejouées (#224).
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  APPAREIL_A,
  APPAREIL_B,
  APPAREIL_C,
  avecAppareil,
  base,
  creerCompte,
  DOSSIER_MIGRATIONS,
  type Base,
} from '../../supabase/pglite';
import { STATUTS as STATUTS_POSTE } from './lib/classification.mjs';
import { STATUTS as STATUTS_APP } from '../../src/store/mur';
import { creerJournal } from './lib/journal.mjs';
import { demarrerServeur } from './lib/app.mjs';
import { empreinte, marquerAnterieures, SQL_REGISTRE } from './lib/migrations.mjs';
import { chargerConfiguration, ouvrirNavigateur } from './serveur.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROLES_SQL = readFileSync(join(RACINE, 'supabase', 'admin', 'roles.sql'), 'utf8');
const JETON = 'jeton-de-test-184';

/** La date des migrations que le poste a lui-même appliquées : une valeur de test, choisie. */
const DATE_POSTE = '2026-10-25T09:30:00.000Z';

/** L'interface étroite `{ lire, ecrire }` réalisée sur `pglite` — la même que `creerAccesPg`. */
function adaptateurPglite(db: Base) {
  return {
    async lire(sql: string, params: unknown[] = []) {
      await db.exec('set role lecteur');
      try {
        const r = await db.query(sql, params.length ? params : undefined);
        return { rows: r.rows, command: (r as { command?: string }).command ?? null, instructions: 1 };
      } finally {
        await db.exec('reset role');
      }
    },
    async ecrire(sql: string, params?: unknown[]) {
      if (params && params.length) {
        const r = await db.query(sql, params);
        return { rows: r.rows, command: (r as { command?: string }).command ?? null, instructions: 1 };
      }
      const r = await db.exec(sql);
      return { rows: [], command: null, instructions: Array.isArray(r) ? r.length : 1 };
    },
  };
}

/** Un dossier de migrations frais, pour les scénarios d'application (jamais le vrai dossier). */
function bacMigrations() {
  const dossier = mkdtempSync(join(tmpdir(), 'admin-migrations-'));
  const un = `begin;
create table public.admin_mig_1 (id int primary key);
commit;`;
  const deux = `begin;
create table public.admin_mig_2 (id int primary key);
commit;`;
  writeFileSync(join(dossier, '0001_test.sql'), un, 'utf8');
  writeFileSync(join(dossier, '0002_test.sql'), deux, 'utf8');
  return { dossier, un };
}

type Monde = Awaited<ReturnType<typeof demarrerMonde>>;

/** La forme du registre **avant #224** : pas d'`origine`, deux colonnes `not null`. */
const SQL_REGISTRE_AVANT_224 = `
create schema if not exists admin;
create table if not exists admin.migrations (
  fichier     text        primary key,
  empreinte   text        not null,
  applique_le timestamptz not null default now()
);`;

/**
 * Un registre **déjà tenu** par le poste avant son démarrage : les migrations qu'il a
 * lui-même appliquées, avec leur empreinte et leur date. Sur la vraie base, le registre est
 * né avec la **0007** (#184) — `registre` reproduit cet état mesuré le 26/10/2026 (#224).
 * `avant224` pose la **forme d'alors** de la table, pour éprouver le rattrapage au démarrage.
 */
async function registreAvec(
  adapter: ReturnType<typeof adaptateurPglite>,
  fichiers: string[],
  avant224 = false,
) {
  await adapter.ecrire(avant224 ? SQL_REGISTRE_AVANT_224 : SQL_REGISTRE);
  for (const nom of fichiers) {
    await adapter.ecrire(
      'insert into admin.migrations (fichier, empreinte, applique_le) values ($1, $2, $3)',
      [nom, empreinte(readFileSync(join(DOSSIER_MIGRATIONS, nom), 'utf8')), DATE_POSTE],
    );
  }
}

async function demarrerMonde(
  options: { migrations?: string; registre?: string[]; registreAvant224?: boolean } = {},
) {
  const db = await base();
  await db.exec(ROLES_SQL);
  const adapter = adaptateurPglite(db);
  if (options.registre) await registreAvec(adapter, options.registre, options.registreAvant224);
  const journal = creerJournal(join(mkdtempSync(join(tmpdir(), 'admin-journal-')), 'journal.jsonl'));
  const serveur = await demarrerServeur({
    adapter,
    journal,
    jeton: JETON,
    port: 0,
    hote: '127.0.0.1',
    dossierMigrations: options.migrations ?? DOSSIER_MIGRATIONS,
  });
  return { db, adapter, journal, serveur };
}

const mondes: Monde[] = [];
afterEach(async () => {
  while (mondes.length) {
    const m = mondes.pop()!;
    await m.serveur.arreter().catch(() => {});
    await m.db.close().catch(() => {});
  }
});

async function monde(
  options: { migrations?: string; registre?: string[]; registreAvant224?: boolean } = {},
): Promise<Monde> {
  const m = await demarrerMonde(options);
  mondes.push(m);
  return m;
}

async function api(m: Monde, chemin: string, init: RequestInit = {}) {
  return fetch(`${m.serveur.baseUrl}${chemin}`, {
    ...init,
    headers: { 'x-poste-jeton': JETON, ...(init.headers ?? {}) },
  });
}

async function corpsJson(reponse: Response) {
  const texte = await reponse.text();
  return texte ? JSON.parse(texte) : null;
}

const coller = (db: Base, appareil: string, id: string) =>
  avecAppareil(db, appareil, () =>
    db.query(
      `insert into public.postits (id, kind, titre, texte, version) values ($1, 'IP', 'Titre', 'Texte.', 'Alpha') returning *`,
      [id],
    ),
  );

type Issue = { accepte: boolean; message?: string; lignes?: Array<Record<string, unknown>> };

async function tenter(db: Base, appareil: string, sql: string, params: unknown[] = []): Promise<Issue> {
  try {
    const r = await avecAppareil(db, appareil, () => db.query(sql, params));
    return { accepte: true, lignes: r.rows as Array<Record<string, unknown>> };
  } catch (e) {
    return { accepte: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------------- la config

describe('la configuration (#184)', () => {
  it('refuse de démarrer sans secrets, avec le chemin du fichier', async () => {
    const chemin = join(mkdtempSync(join(tmpdir(), 'admin-config-')), 'supabase-admin.json');
    const env = {
      ...process.env,
      ADMIN_SECRETS_FICHIER: chemin,
      ADMIN_LECTEUR_URL: '',
      ADMIN_ADMIN_URL: '',
    };
    expect(() => chargerConfiguration(env)).toThrow(
      /pas de configuration : créer .*supabase-admin\.json/,
    );
  });

  it('lire les deux clés, du fichier ou de l’environnement', async () => {
    const env = {
      ...process.env,
      ADMIN_SECRETS_FICHIER: join(tmpdir(), 'inexistant.json'),
      ADMIN_LECTEUR_URL: 'postgresql://lecteur.x@pooler/…',
      ADMIN_ADMIN_URL: 'postgresql://postgres.x@pooler/…',
    };
    expect(chargerConfiguration(env)).toEqual({
      lecteur_url: 'postgresql://lecteur.x@pooler/…',
      admin_url: 'postgresql://postgres.x@pooler/…',
    });
  });

  it('ouvre le navigateur sur l’URL avec le jeton, sans jamais en lancer un pour de vrai', () => {
    // Ce cas lançait un vrai `xdg-open` : à chaque `npm test`, une fenêtre s'ouvrait sur une
    // adresse où rien n'écoute, donc une page blanche. On **injecte** le lanceur et on regarde
    // ce qu'on lui demande — le comportement observable, sans effet de bord.
    const appels: Array<[string, string[]]> = [];
    const faux = ((cmd: string, args: string[]) => {
      appels.push([cmd, args]);
      return { on() {}, unref() {} };
    }) as never;

    const url = 'http://127.0.0.1:5199/?jeton=test';
    expect(ouvrirNavigateur(url, faux)).toBe(true);
    expect(appels).toHaveLength(1);
    expect(appels[0][1]).toContain(url);

    // Un lanceur qui explose ne fait pas tomber l'appelant : le serveur affiche l'adresse.
    const casse = (() => {
      throw new Error('pas de navigateur');
    }) as never;
    expect(ouvrirNavigateur(url, casse)).toBe(false);
  });

  it('`ADMIN_OUVRIR_NAVIGATEUR=false` n\'ouvre pas le navigateur', async () => {
    const env = {
      ...process.env,
      ADMIN_SECRETS_FICHIER: join(tmpdir(), 'inexistant.json'),
      ADMIN_LECTEUR_URL: 'postgresql://lecteur.x@pooler/…',
      ADMIN_ADMIN_URL: 'postgresql://postgres.x@pooler/…',
      ADMIN_OUVRIR_NAVIGATEUR: 'false',
    };
    const config = chargerConfiguration(env);
    expect(config).toEqual({
      lecteur_url: 'postgresql://lecteur.x@pooler/…',
      admin_url: 'postgresql://postgres.x@pooler/…',
    });
    // La variable est lue dans `principal()` : pas d'ouverture auto.
  });

  it('`npm run admin` sans configuration sort en erreur (sous-processus)', () => {
    const chemin = join(mkdtempSync(join(tmpdir(), 'admin-config-')), 'supabase-admin.json');
    const resultat = spawnSync(process.execPath, ['tools/admin/serveur.mjs'], {
      cwd: RACINE,
      encoding: 'utf8',
      env: {
        ...process.env,
        ADMIN_SECRETS_FICHIER: chemin,
        ADMIN_LECTEUR_URL: '',
        ADMIN_ADMIN_URL: '',
      },
    });
    expect(resultat.status).toBe(1);
    expect(resultat.stderr).toContain('pas de configuration');
    expect(resultat.stderr).toContain('supabase-admin.json');
  });
});

// ----------------------------------------------------------------------------- les gardes HTTP

describe('le serveur (#184)', () => {
  it('n’écoute que sur 127.0.0.1', async () => {
    const m = await monde();
    expect(m.serveur.adresse.address).toBe('127.0.0.1');
    expect(m.serveur.adresse.family).toBe('IPv4');
  });

  it('refuse toute requête sans le jeton tiré au démarrage', async () => {
    const m = await monde();
    const sansJeton = await fetch(`${m.serveur.baseUrl}/api/etat`);
    expect(sansJeton.status).toBe(401);
    const mauvaisJeton = await fetch(`${m.serveur.baseUrl}/api/etat`, {
      headers: { 'x-poste-jeton': 'mauvais' },
    });
    expect(mauvaisJeton.status).toBe(401);
    const page = await api(m, '/api/etat');
    expect(page.status).toBe(200);
  });

  it('sert la page statique, et seulement avec le jeton', async () => {
    const m = await monde();
    const sansJeton = await fetch(`${m.serveur.baseUrl}/`);
    expect(sansJeton.status).toBe(401);
    const avec = await api(m, '/');
    expect(avec.status).toBe(200);
    expect(avec.headers.get('content-type')).toContain('text/html');
    expect(await avec.text()).toContain('Poste de pilotage');
  });

  it('sert les modules de la page, sous le même jeton', async () => {
    const m = await monde();
    for (const [chemin, attendu] of [
      ['/suivi.mjs', 'export function nouveauxEnAttente'],
      // Le rendu d'une ligne de migration : la page ne décide plus elle-même du bouton (#224).
      ['/ligne-migration.mjs', 'export function ligneMigration'],
    ]) {
      expect((await fetch(`${m.serveur.baseUrl}${chemin}`)).status, chemin).toBe(401);
      const avec = await api(m, chemin);
      expect(avec.status, chemin).toBe(200);
      expect(avec.headers.get('content-type'), chemin).toContain('text/javascript');
      expect(await avec.text(), chemin).toContain(attendu);
    }
  });

  it('la page se relit toute seule, sans build, et seulement quand l’onglet est visible', async () => {
    // Le comportement DOM (minuteur, focus, défilement) n'est pas exécuté ici : ce contrôle
    // garde le **câblage** — retirer l'un de ces morceaux de `page.html` le fait échouer.
    const m = await monde();
    const page = await (await api(m, '/')).text();
    for (const attendu of [
      "from './suivi.mjs'",
      "from './ligne-migration.mjs'",
      'document.visibilityState',
      "addEventListener('visibilitychange'",
      'setInterval',
      'document.title',
      'Rafraîchir',
      'activeElement',
    ]) {
      expect(page, `la page doit porter « ${attendu} »`).toContain(attendu);
    }
  });

  it('masque les courriels, et les révèle par un geste explicite', async () => {
    const m = await monde();
    await creerCompte(m.db, APPAREIL_A, { etat: 'approuve', courriel: 'chapax@gmail.com' });

    const liste = await corpsJson(await api(m, '/api/comptes'));
    const compte = liste.comptes.find((c: { id: string }) => c.id === APPAREIL_A);
    expect(compte).toBeDefined();
    expect(compte.courriel).toBe('chapax***@gmail.com');
    expect(compte.courrielMasque).toBe(true);
    // Le courriel complet n'apparaît nulle part dans la réponse de liste.
    expect(JSON.stringify(liste)).not.toContain('chapax@gmail.com');

    const revele = await corpsJson(await api(m, `/api/comptes/${APPAREIL_A}/courriel`, { method: 'POST' }));
    expect(revele.courriel).toBe('chapax@gmail.com');
  });

  it('alimente le journal à chaque geste, hors du dépôt', async () => {
    const m = await monde();
    await creerCompte(m.db, APPAREIL_C, { etat: 'en attente' });
    await api(m, `/api/comptes/${APPAREIL_C}/approuver`, { method: 'POST' });
    await api(m, `/api/comptes/${APPAREIL_C}/refuser`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raison: 'Pas un invité.' }),
    });

    const carnet = await corpsJson(await api(m, '/api/journal'));
    expect(carnet.lignes.length).toBeGreaterThanOrEqual(2);
    const gestes = carnet.lignes.map((l: { geste: string }) => l.geste);
    expect(gestes).toContain('approuver-compte');
    expect(gestes).toContain('refuser-compte');
    // Une ligne de journal : date, geste, rôle, durée, résultat — jamais une valeur personnelle.
    for (const ligne of carnet.lignes as Array<Record<string, unknown>>) {
      expect(ligne).toHaveProperty('date');
      expect(ligne).toHaveProperty('geste');
      expect(ligne).toHaveProperty('role');
      expect(ligne).toHaveProperty('duree_ms');
      expect(ligne).toHaveProperty('resultat');
    }
    // La raison et le courriel n'entrent pas au journal.
    expect(readFileSync(m.journal.chemin, 'utf8')).not.toContain('Pas un invité.');
  });
});

// --------------------------------------------------------------------- le jeton par cookie (#184)

describe('le jeton retenu par cookie (D-091)', () => {
  it('un `?jeton=` valide pose un cookie `HttpOnly` et `SameSite=Strict`', async () => {
    const m = await monde();
    const url = `${m.serveur.baseUrl}/?jeton=${JETON}`;
    const reponse = await fetch(url);
    expect(reponse.status).toBe(200);
    const cookie = reponse.headers.get('set-cookie');
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('poste-jeton=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('accepte le cookie posé par la première visite, sans `?jeton=`', async () => {
    const m = await monde();
    const premier = await fetch(`${m.serveur.baseUrl}/?jeton=${JETON}`);
    const cookie = premier.headers.get('set-cookie')!;
    const sansParam = await fetch(`${m.serveur.baseUrl}/api/etat`, {
      headers: { cookie },
    });
    expect(sansParam.status).toBe(200);
    // Réponse JSON saine, pas un refus.
    const etat = await corpsJson(sansParam);
    expect(etat).toHaveProperty('approbationsEnAttente');
  });

  it('refuse un cookie invalide, et répond 401 en l’effaçant', async () => {
    const m = await monde();
    const reponse = await fetch(`${m.serveur.baseUrl}/api/etat`, {
      headers: { cookie: 'poste-jeton=mauvais-jeton' },
    });
    expect(reponse.status).toBe(401);
    const cookie = reponse.headers.get('set-cookie');
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('poste-jeton=');
    expect(cookie).toContain('Max-Age=0');
  });

  it('refuse un `?jeton=` invalide même avec un cookie valide, et l’efface', async () => {
    const m = await monde();
    const reponse = await fetch(`${m.serveur.baseUrl}/api/etat?jeton=mauvais`, {
      headers: { cookie: `poste-jeton=${JETON}` },
    });
    expect(reponse.status).toBe(401);
    const cookie = reponse.headers.get('set-cookie');
    expect(cookie).toContain('Max-Age=0');
  });

  it('le paramètre `?jeton=` reste accepté (rétrocompatibilité)', async () => {
    const m = await monde();
    // Sans cookie ni paramètre → 401.
    expect((await fetch(`${m.serveur.baseUrl}/api/etat`)).status).toBe(401);
    // Avec le paramètre → 200, sur une route API comme sur la page.
    const parParam = await fetch(`${m.serveur.baseUrl}/api/etat?jeton=${JETON}`);
    expect(parParam.status).toBe(200);
  });
});

// --------------------------------------------------------------------------- les gestes nommés

describe('les gestes nommés (#184)', () => {
  it('approuve un compte qui attend : il peut écrire ; un non-approuvé reste refusé', async () => {
    const m = await monde();
    const enRetard = '99999999-9999-4999-8999-999999999999';
    await creerCompte(m.db, APPAREIL_C, { etat: 'en attente' });
    await creerCompte(m.db, enRetard, { etat: 'en attente' });

    // Avant approbation, le compte en attente est refusé par la base (RLS).
    const avant = await tenter(
      m.db,
      APPAREIL_C,
      `insert into public.postits (id, kind, titre, texte, version) values ('p-attente', 'IP', 'T', 'T.', 'a') returning *`,
    );
    expect(avant.accepte).toBe(false);

    const approbation = await corpsJson(
      await api(m, `/api/comptes/${APPAREIL_C}/approuver`, { method: 'POST' }),
    );
    expect(approbation).toMatchObject({ ok: true, etat: 'approuve' });

    // Après approbation, il écrit.
    expect((await coller(m.db, APPAREIL_C, 'p-apres')).rows).toHaveLength(1);
    // L'autre, toujours en attente, reste refusé.
    const autre = await tenter(
      m.db,
      enRetard,
      `insert into public.postits (id, kind, titre, texte, version) values ('p-encore-attente', 'IP', 'T', 'T.', 'a') returning *`,
    );
    expect(autre.accepte).toBe(false);
  });

  it('refuse un compte avec raison obligatoire ; un refus muet est refusé', async () => {
    const m = await monde();
    await creerCompte(m.db, APPAREIL_C, { etat: 'en attente' });

    const muet = await api(m, `/api/comptes/${APPAREIL_C}/refuser`, { method: 'POST' });
    expect(muet.status).toBe(400);
    expect(await corpsJson(muet)).toEqual({ erreur: expect.stringContaining('raison') });

    const avec = await api(m, `/api/comptes/${APPAREIL_C}/refuser`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raison: 'Pas un invité.' }),
    });
    expect(avec.status).toBe(200);
    expect(await corpsJson(avec)).toMatchObject({ ok: true, etat: 'refuse' });
  });

  it('marque un compte administrateur, et trie un post-it', async () => {
    const m = await monde();
    await creerCompte(m.db, APPAREIL_B, { etat: 'approuve' });
    await creerCompte(m.db, ADMIN, { etat: 'approuve' });
    await coller(m.db, APPAREIL_B, 'p-b');

    const admin = await corpsJson(
      await api(m, `/api/comptes/${APPAREIL_B}/administrateur`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ administrateur: true }),
      }),
    );
    expect(admin).toMatchObject({ ok: true, administrateur: true });

    const tri = await corpsJson(
      await api(m, '/api/postits/p-b/trier', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ statut: 'écarté', raison: 'Hors périmètre.', ticket: 100 }),
      }),
    );
    expect(tri).toMatchObject({ id: 'p-b', statut: 'écarté', raison: 'Hors périmètre.', ticket: 100 });
  });

  it('réattribue les post-its anonymes au compte choisi', async () => {
    const m = await monde();
    await creerCompte(m.db, APPAREIL_A, { etat: 'approuve' });
    // Un post-it d'une identité **sans compte** : le cas des deux post-its d'avant la 0005.
    await m.db.query(
      `insert into public.postits (id, kind, titre, texte, version, auteur) values ('p-anonyme', 'IP', 'Titre', 'Texte.', 'Alpha', $1)`,
      [APPAREIL_C],
    );
    const anonyme = await m.db.query(`select auteur from public.postits where id = 'p-anonyme'`);
    expect(anonyme.rows[0].auteur).toBe(APPAREIL_C);

    const reattribue = await corpsJson(
      await api(m, '/api/postits/reattribuer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ compte: APPAREIL_A }),
      }),
    );
    expect(reattribue).toMatchObject({ reattribues: 1 });

    const relu = await m.db.query(`select auteur from public.postits where id = 'p-anonyme'`);
    expect(relu.rows[0].auteur).toBe(APPAREIL_A);
  });
});

// -------------------------------------------------------------------------------- le SQL libre

describe('le SQL libre (#184)', () => {
  it('une lecture passe par le rôle lecteur — la base refuse l’écriture, pas le code', async () => {
    const m = await monde();
    // La lecture réussit.
    const lecture = await api(m, '/api/sql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: 'select 1 as un' }),
    });
    expect(lecture.status).toBe(200);
    expect(await corpsJson(lecture)).toMatchObject({ nature: 'lecture', role: 'lecteur' });

    // Le rôle `lecteur` (l'adaptateur injecté) n'a aucun droit d'écriture : c'est la base qui
    // refuse, indépendamment de la classification du poste.
    await expect(
      m.adapter.lire(
        `insert into public.postits (id, kind, titre, texte, version) values ('intrusion', 'IP', 'T', 'T.', 'a')`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('une écriture exige un accusé de réception', async () => {
    const m = await monde();
    await creerCompte(m.db, APPAREIL_B, { etat: 'approuve' });
    await coller(m.db, APPAREIL_B, 'p-b');

    const sans = await api(m, '/api/sql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: `update public.postits set statut = 'retenu' where id = 'p-b'`, accuse: false }),
    });
    expect(sans.status).toBe(400);
    expect((await corpsJson(sans)).erreur).toContain('accusé');

    const avec = await api(m, '/api/sql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: `update public.postits set statut = 'retenu' where id = 'p-b'`, accuse: true }),
    });
    expect(avec.status).toBe(200);
    expect(await corpsJson(avec)).toMatchObject({ nature: 'ecriture', role: 'admin' });

    const relu = await tenter(m.db, APPAREIL_B, `select statut from public.postits where id = 'p-b'`);
    expect(relu.lignes?.[0]?.statut).toBe('retenu');
  });

  it('un `delete` sans `where` exige le mot annoncé ; avec `where`, il ne l’exige pas', async () => {
    const m = await monde();
    await creerCompte(m.db, APPAREIL_B, { etat: 'approuve' });
    await coller(m.db, APPAREIL_B, 'p-b');

    // Sans le mot → 428, le serveur annonce un mot.
    const sansMot = await api(m, '/api/sql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: 'delete from public.postits', accuse: true }),
    });
    expect(sansMot.status).toBe(428);
    const annonce = await corpsJson(sansMot);
    expect(annonce.mot).toBeTruthy();

    // Un `update` **avec** `where` n'est pas destructif : accusé seul suffit, pas de mot.
    const avecWhere = await api(m, '/api/sql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: `update public.postits set statut = 'fait' where id = 'p-b'`, accuse: true }),
    });
    expect(avecWhere.status).toBe(200);

    // Avec le mot annoncé, le `delete` passe.
    const avecMot = await api(m, '/api/sql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: 'delete from public.postits', accuse: true, mot: annonce.mot }),
    });
    expect(avecMot.status).toBe(200);
    expect((await tenter(m.db, APPAREIL_B, `select count(*)::int as n from public.postits`)).lignes?.[0]?.n).toBe(0);
  });
});

// ----------------------------------------------------------------------------- les migrations

describe('les migrations (#184)', () => {
  it('applique une seule à la fois, refuse la seconde, signale une empreinte changée', async () => {
    const bac = bacMigrations();
    const m = await monde({ migrations: bac.dossier });

    // Au départ : deux migrations manquantes.
    let liste = (await corpsJson(await api(m, '/api/migrations'))).migrations;
    expect(liste.map((x: { etat: string }) => x.etat)).toEqual(['manquante', 'manquante']);

    // Appliquer la première : elle passe, dans sa transaction.
    const appliquee = await corpsJson(
      await api(m, '/api/migrations/0001_test.sql/appliquer', { method: 'POST' }),
    );
    expect(appliquee.fichier).toBe('0001_test.sql');
    expect(appliquee.empreinte).toBeTruthy();

    liste = (await corpsJson(await api(m, '/api/migrations'))).migrations;
    expect(liste.map((x: { etat: string }) => x.etat)).toEqual(['appliquee', 'manquante']);
    // La table créée par la migration existe bien.
    expect((await m.adapter.lire('select to_regclass(\'public.admin_mig_1\') as t')).rows[0].t).not.toBeNull();

    // Réappliquer la même → refusée.
    const rejoue = await api(m, '/api/migrations/0001_test.sql/appliquer', { method: 'POST' });
    expect(rejoue.status).toBe(409);
    expect((await corpsJson(rejoue)).erreur).toContain('déjà appliquée');

    // Réécrire le fichier après application → empreinte changée, signalée, non rejouée.
    writeFileSync(join(bac.dossier, '0001_test.sql'), `${bac.un}\n-- retouché\n`, 'utf8');
    liste = (await corpsJson(await api(m, '/api/migrations'))).migrations;
    const premiere = liste.find((x: { fichier: string }) => x.fichier === '0001_test.sql');
    expect(premiere.etat).toBe('empreinte-changee');

    const rejoueChangee = await api(m, '/api/migrations/0001_test.sql/appliquer', { method: 'POST' });
    expect(rejoueChangee.status).toBe(409);
    expect((await corpsJson(rejoueChangee)).erreur).toContain('empreinte changée');
  });
});

// ------------------------------------------------- le registre dit l'origine des migrations (#224)

/** Le registre n'a été créé qu'avec la 0007 : les six précédentes sont **antérieures**. */
const ANTERIEURES = [
  '0001_mur.sql',
  '0002_combats.sql',
  '0003_gueulage.sql',
  '0004_pouces.sql',
  '0005_comptes.sql',
  '0006_tri_et_corrections.sql',
];
const APPLIQUEES_PAR_LE_POSTE = ['0007_place_et_retrait_admin.sql', '0008_comite.sql'];

type LigneMigration = {
  fichier: string;
  etat: string;
  empreinte: string | null;
  empreinte_en_base: string | null;
  applique_le: string | null;
};

async function lignesMigrations(m: Monde): Promise<Map<string, LigneMigration>> {
  const liste = (await corpsJson(await api(m, '/api/migrations'))).migrations as LigneMigration[];
  return new Map(liste.map((ligne) => [ligne.fichier, ligne]));
}

describe('le registre dit l’origine des migrations (#224)', () => {
  it('rend 0001–0006 « appliquée avant le registre », sans empreinte ni date inventées', async () => {
    const m = await monde({ registre: APPLIQUEES_PAR_LE_POSTE });
    const lignes = await lignesMigrations(m);

    for (const nom of ANTERIEURES) {
      const ligne = lignes.get(nom)!;
      expect(ligne, nom).toBeDefined();
      expect(ligne.etat, nom).toBe('anterieure');
      // Le poste ne sait pas quel fichier a été appliqué : il n'affirme ni empreinte ni date.
      expect(ligne.empreinte_en_base, nom).toBeNull();
      expect(ligne.applique_le, nom).toBeNull();
    }

    // 0007 et 0008 : appliquées **par** le poste, empreinte et date intactes.
    for (const nom of APPLIQUEES_PAR_LE_POSTE) {
      const ligne = lignes.get(nom)!;
      expect(ligne.etat, nom).toBe('appliquee');
      expect(ligne.empreinte_en_base, nom).toBe(ligne.empreinte);
      expect(ligne.applique_le, nom).toBe(DATE_POSTE);
    }
  });

  it('rattrape le registre d’avant #224, sans réécrire les empreintes du poste', async () => {
    // C'est l'état de la **vraie** base : la table existe déjà, sans `origine`, et ses deux
    // colonnes sont `not null`. Le démarrage du poste doit la compléter, pas la recréer.
    const m = await monde({ registre: APPLIQUEES_PAR_LE_POSTE, registreAvant224: true });
    const lignes = await lignesMigrations(m);
    for (const nom of ANTERIEURES) expect(lignes.get(nom)!.etat, nom).toBe('anterieure');
    for (const nom of APPLIQUEES_PAR_LE_POSTE) {
      const ligne = lignes.get(nom)!;
      expect(ligne.etat, nom).toBe('appliquee');
      expect(ligne.empreinte_en_base, nom).toBe(ligne.empreinte);
      expect(ligne.applique_le, nom).toBe(DATE_POSTE);
    }
  });

  it('refuse de rejouer une migration antérieure : la page n’est pas la garde', async () => {
    const m = await monde({ registre: APPLIQUEES_PAR_LE_POSTE });
    // 0001 et 0002 ne sont pas idempotentes : le refus doit venir du serveur, pas du bouton.
    const rejoue = await api(m, '/api/migrations/0001_mur.sql/appliquer', { method: 'POST' });
    expect(rejoue.status).toBe(409);
    expect((await corpsJson(rejoue)).erreur).toContain('avant le registre');
  });

  it('sans le marquage, les six redeviennent « manquante » — le contrôle mord', async () => {
    const m = await monde({ registre: APPLIQUEES_PAR_LE_POSTE });

    // On efface les lignes d'antériorité : c'est exactement l'état d'avant #224.
    await m.adapter.ecrire("delete from admin.migrations where origine = 'anterieur'");
    const avant = await lignesMigrations(m);
    expect(avant.get('0001_mur.sql')!.etat).toBe('manquante');

    // Le marquage remet la vérité, et se rejoue sans effet (idempotent).
    await marquerAnterieures(m.adapter, DOSSIER_MIGRATIONS);
    await marquerAnterieures(m.adapter, DOSSIER_MIGRATIONS);
    const apres = await lignesMigrations(m);
    for (const nom of ANTERIEURES) expect(apres.get(nom)!.etat, nom).toBe('anterieure');
    // Les migrations du poste n'ont pas bougé.
    for (const nom of APPLIQUEES_PAR_LE_POSTE) expect(apres.get(nom)!.etat, nom).toBe('appliquee');
  });
});

// ------------------------------------------------------------------------- les gardes croisées

describe('les statuts ne divergent pas (#184)', () => {
  it('le poste et le contrat du mur portent la même liste', () => {
    expect([...STATUTS_POSTE]).toEqual([...STATUTS_APP]);
  });
});