// @vitest-environment node
/**
 * Le reset de la beta — `tools/admin/lib/reset.mjs` (#342, D-130, D-150).
 *
 * Le reset se juge **sur l'état des tables après** (PGlite, les migrations réelles du dépôt, le rôle
 * `lecteur` de `supabase/admin/roles.sql`). Ce qui part : traces de combat, mur, **Deck et Collection
 * du compte** (D-153 (2)). Ce qui reste : chaque compte, `admin.migrations`, `annonces_discord`. La
 * médaille : une seule fois, aux seuls comptes approuvés.
 *
 * Le contrôle mord : chaque mutation de l'instruction (un compte effacé, une trace laissée, une médaille
 * reposée) doit être **vue** — par le compte rendu (anomalie) ou par le fait que la garde échoue.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  APPAREIL_A,
  APPAREIL_B,
  APPAREIL_C,
  ADMIN,
  avecAppareil,
  base,
  creerCompte,
  DOSSIER_MIGRATIONS,
  type Base,
} from '../../supabase/pglite';
import {
  CONFIRMATION,
  PERIMETRE,
  SQL_RESET,
  executerReset,
  apercuReset,
  texteRapport,
  verifierConfirmation,
} from './lib/reset.mjs';
import { demarrerServeur } from './lib/app.mjs';
import { initialiserRegistre } from './lib/migrations.mjs';
import { creerJournal } from './lib/journal.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROLES_SQL = readFileSync(join(RACINE, 'supabase', 'admin', 'roles.sql'), 'utf8');
const PAGE = readFileSync(join(RACINE, 'tools', 'admin', 'page.html'), 'utf8');
const JETON = 'jeton-de-test-342';

/** Sans paramètres, requête simple (plusieurs instructions permises), comme `pg` ; avec, requête préparée. */
async function executer(db: Base, sql: string, params: unknown[]) {
  if (params.length === 0) {
    const resultats = await db.exec(sql);
    const dernier = resultats[resultats.length - 1] ?? { rows: [] };
    return { rows: dernier.rows as Record<string, unknown>[], command: null, instructions: resultats.length };
  }
  const r = await db.query(sql, params);
  return { rows: r.rows as Record<string, unknown>[], command: null, instructions: 1 };
}

/** L'interface `{ lire, ecrire }` sur PGlite — la même forme que `creerAccesPg` (rend toujours `rows`). */
function adaptateur(db: Base) {
  return {
    async lire(sql: string, params: unknown[] = []) {
      await db.exec('set role lecteur');
      try {
        return await executer(db, sql, params);
      } finally {
        await db.exec('reset role');
      }
    },
    async ecrire(sql: string, params: unknown[] = []) {
      return executer(db, sql, params);
    },
  };
}

/** Une base migrée, avec un alpha réaliste : approuvés, en attente, refusé, un administrateur, des traces. */
async function alpha() {
  const db = await base();
  await db.exec(ROLES_SQL);
  await creerCompte(db, APPAREIL_A, { etat: 'approuve', courriel: 'a@exemple.test' });
  await creerCompte(db, APPAREIL_B, { etat: 'en attente', courriel: 'b@exemple.test' });
  await creerCompte(db, APPAREIL_C, { etat: 'refuse', courriel: 'c@exemple.test' });
  await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true, courriel: 'admin@exemple.test' });

  await avecAppareil(db, APPAREIL_A, async () => {
    for (const id of ['p1', 'p2']) {
      await db.query(
        `insert into public.postits (id, kind, titre, texte, version) values ($1, 'IP', 'Titre', 'Texte.', 'Alpha')`,
        [id],
      );
    }
    await db.query(
      `insert into public.combats (mode, graine, decks, types_cafe, journal)
       values ('solo', 1, '{"playerDeck":[],"aiDeck":[]}'::jsonb, '{"playerCafeTypes":[],"aiCafeTypes":[]}'::jsonb, '[]'::jsonb)`,
    );
    await db.query(
      `insert into public.combats (mode, graine, decks, types_cafe, journal)
       values ('solo', 2, '{"playerDeck":[],"aiDeck":[]}'::jsonb, '{"playerCafeTypes":[],"aiCafeTypes":[]}'::jsonb, '[]'::jsonb)`,
    );
  });
  // Le Deck et la Collection vivent sur le compte depuis D-153 : le reset les efface aussi.
  await db.query(
    `insert into public.collection (compte_id, carte_id, quantite)
     values ($1, 'planque-entrant-1', 3), ($1, 'planque-entrant-2', 1)`,
    [APPAREIL_A],
  );
  await db.query(
    `insert into public.deck (compte_id, carte_id, quantite, rang)
     values ($1, 'planque-entrant-1', 2, 0), ($1, 'planque-entrant-2', 1, 1), ($1, 'planque-entrant-3', 1, 2)`,
    [APPAREIL_A],
  );
  await db.query(`insert into public.votes (postit_id, votant, sens) values ('p1', $1, 'up'), ('p2', $1, 'down')`, [APPAREIL_A]);
  await db.query(`insert into public.commentaires (postit_id, auteur, texte) values ('p1', $1, 'Un commentaire.')`, [APPAREIL_A]);
  // Une annonce Discord en attente : elle ne fait pas partie du périmètre et doit survivre au reset.
  await db.query(
    `insert into public.annonces_discord (postit_id, type, etat, corps) values ('p1', 'postit', 'en attente', '{}'::jsonb)`,
  );
  return db;
}

const dbs: Base[] = [];
async function nouvelleAlpha(): Promise<{ db: Base; a: ReturnType<typeof adaptateur> }> {
  const db = await alpha();
  dbs.push(db);
  return { db, a: adaptateur(db) };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.close().catch(() => {});
});

async function compter(db: Base, sql: string): Promise<number> {
  const r = await db.query<{ n: number }>(sql);
  return Number(r.rows[0].n);
}

/** Les comptes tels qu'on les garde : identité, état, raison, drapeau, dates et décision. */
async function comptes(db: Base) {
  const r = await db.query(
    `select id, courriel, etat, raison, administrateur, created_at, decide_par, decide_le
       from public.comptes order by id`,
  );
  return JSON.stringify(r.rows);
}

async function medailles(db: Base) {
  const r = await db.query<{ id: string; medaille: boolean; le: unknown }>(
    `select id, medaille_periode_essai as medaille, medaille_periode_essai_le as le from public.comptes order by id`,
  );
  return Object.fromEntries(r.rows.map((l) => [l.id, { medaille: l.medaille, le: l.le }]));
}

describe('le reset de la beta (#342, D-130)', () => {
  it('vide traces et mur, garde chaque compte, pose la médaille aux seuls comptes approuvés', async () => {
    const { db, a: brut } = await nouvelleAlpha();
    // **D-150 (1)** : le reset est **une seule instruction**, un seul aller-retour. Le pilote
    // accepte plusieurs instructions dans un même envoi ; sans cette assertion, la règle ne
    // tiendrait que par la forme du littéral, et une seconde instruction glissée dans `SQL_RESET`
    // passerait inaperçue.
    const envoyees: number[] = [];
    const a = {
      ...brut,
      async ecrire(sql: string, params: unknown[] = []) {
        const lu = await brut.ecrire(sql, params);
        envoyees.push(lu.instructions ?? 1);
        return lu;
      }
    };
    const comptesAvant = await comptes(db);
    await initialiserRegistre(brut);
    const migrationsAvant = await compter(db, 'select count(*)::int as n from admin.migrations');
    // Les annonces partent d'un déclencheur à chaque post-it : on mesure leur état, pas un nombre supposé.
    const annoncesAvant = await compter(db, "select count(*)::int as n from public.annonces_discord where etat = 'en attente'");

    const { rapport } = await executerReset(a, CONFIRMATION);
    expect(envoyees, 'le reset doit tenir en une seule instruction').toEqual([1]);

    expect(await compter(db, 'select count(*)::int as n from public.combats')).toBe(0);
    expect(await compter(db, 'select count(*)::int as n from public.postits')).toBe(0);
    expect(await compter(db, 'select count(*)::int as n from public.votes')).toBe(0);
    expect(await compter(db, 'select count(*)::int as n from public.commentaires')).toBe(0);
    expect(await compter(db, 'select count(*)::int as n from public.collection')).toBe(0);
    expect(await compter(db, 'select count(*)::int as n from public.deck')).toBe(0);

    // Chaque compte est là, à l'identique (courriel, mot de passe hors table, état, raison, décision).
    expect(await comptes(db)).toBe(comptesAvant);

    const m = await medailles(db);
    expect(m[APPAREIL_A].medaille).toBe(true);
    expect(m[ADMIN].medaille).toBe(true);
    expect(m[APPAREIL_B].medaille).toBe(false);
    expect(m[APPAREIL_C].medaille).toBe(false);
    expect(m[APPAREIL_A].le).not.toBeNull();

    // Le registre des migrations et l'annonce Discord ne bougent pas.
    expect(await compter(db, 'select count(*)::int as n from admin.migrations')).toBe(migrationsAvant);
    expect(await compter(db, "select count(*)::int as n from public.annonces_discord where etat = 'en attente'")).toBe(annoncesAvant);

    // Le compte rendu dit ce qui a été fait, par table, sans anomalie.
    const par = Object.fromEntries(rapport.tables.map((t: { table: string; lignes: number }) => [t.table, t.lignes]));
    expect(par['public.combats']).toBe(2);
    expect(par['public.postits']).toBe(2);
    expect(par['public.votes']).toBe(2);
    expect(par['public.commentaires']).toBe(1);
    expect(par['public.collection']).toBe(2);
    expect(par['public.deck']).toBe(3);
    expect(par['public.comptes']).toBe(4);
    expect(par['public.comptes (médaille)']).toBe(2);
    expect(rapport.anomalies).toEqual([]);
  });

  it('une confirmation mal tapée est refusée, et rien n’est effacé', async () => {
    const { db, a } = await nouvelleAlpha();
    const comptesAvant = await comptes(db);

    for (const saisie of ['', 'remettre a zero la beta', 'Remettre à zéro la beta', `${CONFIRMATION} `, undefined]) {
      await expect(executerReset(a, saisie as string)).rejects.toMatchObject({ statut: 400, code: 'confirmation-refusee' });
    }
    expect(verifierConfirmation(CONFIRMATION)).toBeUndefined();

    expect(await compter(db, 'select count(*)::int as n from public.combats')).toBe(2);
    expect(await compter(db, 'select count(*)::int as n from public.postits')).toBe(2);
    expect(await comptes(db)).toBe(comptesAvant);
    expect((await medailles(db))[APPAREIL_A].medaille).toBe(false);
  });

  it('rejoué, la médaille n’est pas reposée, et un compte approuvé depuis n’en reçoit pas', async () => {
    const { db, a } = await nouvelleAlpha();
    await executerReset(a, CONFIRMATION);
    const premiere = await medailles(db);

    // Un testeur approuvé après le premier reset : il ne doit jamais recevoir la médaille de l'alpha.
    await creerCompte(db, APPAREIL_B, { etat: 'approuve' });

    const { rapport } = await executerReset(a, CONFIRMATION);
    const seconde = await medailles(db);
    expect(seconde[APPAREIL_A]).toEqual(premiere[APPAREIL_A]);
    expect(seconde[APPAREIL_B].medaille).toBe(false);
    expect(rapport.medaillesDejaPosees).toBe(2);
    expect(rapport.tables.find((t: { table: string }) => t.table === 'public.comptes (médaille)').lignes).toBe(0);
  });

  it('l’aperçu dit ce qui partirait sans rien effacer', async () => {
    const { db, a } = await nouvelleAlpha();
    const apercu = await apercuReset(a);
    expect(Object.keys(apercu)).not.toContain('annoncesEnAttente');
    expect(apercu).toMatchObject({
      combats: 2,
      postits: 2,
      votes: 2,
      commentaires: 1,
      collection: 2,
      deck: 3,
      comptes: 4,
      approuves: 2,
      medaillesPosees: 0,
    });
    expect(await compter(db, 'select count(*)::int as n from public.postits')).toBe(2);
  });

  it('le compte rendu texte porte le même chiffre que l’objet', async () => {
    const { a } = await nouvelleAlpha();
    const { rapport, texte } = await executerReset(a, CONFIRMATION);
    expect(texte).toBe(texteRapport(rapport));
    expect(texte).toContain('public.combats');
    expect(texte).toContain('2 ligne(s) supprimée(s)');
    expect(texte).toContain('2 médaille(s) attribuée(s)');
  });
});

describe('le contrôle mord : une mutation de l’instruction est vue', () => {
  it('un compte effacé produit une anomalie', async () => {
    const { a } = await nouvelleAlpha();
    const mutant = SQL_RESET.replace(
      'medailles as (',
      'comptes_vides as (delete from public.comptes where etat = \'refuse\' returning 1),\n  medailles as (',
    );
    expect(mutant).not.toBe(SQL_RESET);
    const { rapport } = await executerReset(a, CONFIRMATION, { sql: mutant });
    expect(rapport.anomalies.join('\n')).toMatch(/compte disparu après le reset/);
  });

  it('une trace laissée par le reset produit une anomalie', async () => {
    const { a } = await nouvelleAlpha();
    const mutant = SQL_RESET.replace(
      'combats_vides as (delete from public.combats returning 1),',
      'combats_vides as (select 1 from public.combats),',
    );
    expect(mutant).not.toBe(SQL_RESET);
    const { rapport } = await executerReset(a, CONFIRMATION, { sql: mutant });
    expect(rapport.anomalies.join('\n')).toMatch(/combats : 2 ligne\(s\) restée\(s\)/);
  });

  it('un Deck laissé par le reset produit une anomalie', async () => {
    const { a } = await nouvelleAlpha();
    const mutant = SQL_RESET.replace(
      'deck_vides as (delete from public.deck returning 1),',
      'deck_vides as (select 1 from public.deck),',
    );
    expect(mutant).not.toBe(SQL_RESET);
    const { rapport } = await executerReset(a, CONFIRMATION, { sql: mutant });
    expect(rapport.anomalies.join('\n')).toMatch(/deck : 3 ligne\(s\) restée\(s\)/);
  });

  it('une Collection laissée par le reset produit une anomalie', async () => {
    const { a } = await nouvelleAlpha();
    const mutant = SQL_RESET.replace(
      'collection_vides as (delete from public.collection returning 1),',
      'collection_vides as (select 1 from public.collection),',
    );
    expect(mutant).not.toBe(SQL_RESET);
    const { rapport } = await executerReset(a, CONFIRMATION, { sql: mutant });
    expect(rapport.anomalies.join('\n')).toMatch(/collection : 2 ligne\(s\) restée\(s\)/);
  });

  it('sans la garde « une seule fois », une médaille serait reposée : la vraie instruction l’empêche', async () => {
    const { db, a } = await nouvelleAlpha();
    await executerReset(a, CONFIRMATION);
    const avant = await medailles(db);
    await creerCompte(db, APPAREIL_B, { etat: 'approuve' });

    const sansGarde = SQL_RESET.replace('and not exists (select 1 from public.comptes where medaille_periode_essai)', '');
    expect(sansGarde).not.toBe(SQL_RESET);
    await executerReset(a, CONFIRMATION, { sql: sansGarde });
    expect((await medailles(db))[APPAREIL_B].medaille).toBe(true);

    // Avec la vraie instruction, le même scénario ne pose rien de neuf.
    await db.query(`update public.comptes set medaille_periode_essai = false, medaille_periode_essai_le = null where id = $1`, [APPAREIL_B]);
    await executerReset(a, CONFIRMATION);
    expect((await medailles(db))[APPAREIL_B].medaille).toBe(false);
    expect((await medailles(db))[APPAREIL_A]).toEqual(avant[APPAREIL_A]);
  });
});

describe('le périmètre, dans le texte de l’instruction', () => {
  it('ne nomme ni le registre, ni les annonces, ni les comptes en écriture', () => {
    for (const interdit of ['admin.migrations', 'annonces_discord', 'auth.', 'profils']) {
      expect(SQL_RESET).not.toContain(interdit);
    }
    expect(SQL_RESET).not.toMatch(/delete\s+from\s+public\.comptes/);
  });

  it('nomme le Deck et la Collection au périmètre vidé et dans l’instruction', () => {
    for (const table of ['public.collection', 'public.deck']) {
      expect(PERIMETRE.vides).toContain(table);
      expect(SQL_RESET).toContain(`delete from ${table}`);
    }
  });
});

describe('la route du poste de pilotage', () => {
  const serveurs: Array<{ arreter: () => Promise<void> }> = [];
  afterEach(async () => {
    while (serveurs.length) await serveurs.pop()!.arreter();
  });

  async function demarrer() {
    const { db, a } = await nouvelleAlpha();
    const journal = creerJournal(join(mkdtempSync(join(tmpdir(), 'reset-journal-')), 'journal.jsonl'));
    const serveur = await demarrerServeur({ adapter: a, journal, jeton: JETON, port: 0, hote: '127.0.0.1', dossierMigrations: DOSSIER_MIGRATIONS });
    serveurs.push(serveur);
    const appel = (methode: string, corps?: unknown) =>
      fetch(`${serveur.baseUrl}/api/reset`, {
        method: methode,
        headers: { 'x-poste-jeton': JETON, 'content-type': 'application/json' },
        body: corps === undefined ? undefined : JSON.stringify(corps),
      });
    return { db, appel };
  }

  it('GET rend l’aperçu, POST sans la bonne phrase répond 400 et ne touche à rien', async () => {
    const { db, appel } = await demarrer();
    const apercu = await appel('GET');
    expect(apercu.status).toBe(200);
    const texte = (await apercu.json()).texte;
    expect(texte).toContain('traces de combat : 2');
    expect(texte).toContain('Collection : 2 ligne(s)');
    expect(texte).toContain('Deck : 3 ligne(s)');

    const refus = await appel('POST', { confirmation: 'oui' });
    expect(refus.status).toBe(400);
    expect(await compter(db, 'select count(*)::int as n from public.postits')).toBe(2);
  });

  it('POST avec la phrase exacte rend le compte rendu', async () => {
    const { db, appel } = await demarrer();
    const reponse = await appel('POST', { confirmation: CONFIRMATION });
    expect(reponse.status).toBe(200);
    const corps = await reponse.json();
    expect(corps.texte).toContain('compte rendu');
    expect(await compter(db, 'select count(*)::int as n from public.postits')).toBe(0);
  });
});

describe('la page du poste reprend la phrase du reset', () => {
  it('la phrase de la page est celle de la bibliothèque', () => {
    expect(PAGE).toContain(`<section id="reset"`);
    expect(PAGE).toContain(`const RESET_PHRASE = '${CONFIRMATION}'`);
    expect(PAGE).toContain(CONFIRMATION);
  });
});
