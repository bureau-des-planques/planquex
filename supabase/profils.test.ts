// @vitest-environment node
/**
 * Le profil du testeur — la migration `0019_profils.sql` (#325, D-088, D-148).
 *
 * Même banc que `comptes.test.ts` : les migrations **réelles**, jouées dans PGlite (RLS
 * comprise), en rôle `authenticated`. Le profil vit sur le compte, donc il se lit et s'écrit
 * par son propriétaire, et seulement lui.
 *
 * Ce que la base doit tenir :
 *
 *   (a) un testeur **crée** son profil avec son propre identifiant, et **pas** avec celui d'un
 *       autre ;
 *   (b) un testeur **lit** son profil, pas celui d'un autre (un autre donne 0 ligne) ;
 *   (c) un testeur **change** son profil, pas celui d'un autre (0 ligne touchée, sans erreur) ;
 *   (d) le **service** est figé dès qu'il est posé ;
 *   (e) l'**intitulé** est figé dès qu'il est enregistré ;
 *   (f) l'intitulé se **relance une fois** : une seconde relance est refusée (borne), et une
 *       relance après l'enregistrement aussi ;
 *   (g) l'intitulé suppose un service (le parcours avance dans l'ordre) ;
 *   (h) le profil ne se supprime pas depuis le jeu.
 *
 * **Le contrôle mord** : chaque garde de transition (le déclencheur `profils_gardes`) est
 * retirée tour à tour, et le geste fautif doit alors **passer** — sans quoi la garde ne tenait
 * rien. Les bornes `check` sont confrontées au même geste fautif, sans déclencheur.
 */
import { describe, expect, it } from 'vitest';
import { APPAREIL_A, APPAREIL_B, avecAppareil, base, creerCompte, type Base } from './pglite';

type Issue = { accepte: true; lignes: Array<Record<string, unknown>> } | { accepte: false; message: string };

async function tenter(db: Base, appareil: string, sql: string, params: unknown[] = []): Promise<Issue> {
  try {
    const res = await avecAppareil(db, appareil, () => db.query<Record<string, unknown>>(sql, params));
    return { accepte: true, lignes: res.rows };
  } catch (erreur) {
    return { accepte: false, message: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}

const refuse = (issue: Issue, motif: RegExp) => {
  expect(issue.accepte, 'le geste aurait dû être refusé').toBe(false);
  if (!issue.accepte) expect(issue.message).toMatch(motif);
};
const accepte = (issue: Issue) => {
  expect(issue.accepte, issue.accepte ? '' : (issue as { message: string }).message).toBe(true);
};

const creer = (db: Base, appareil: string, pseudo = 'Anaïs') =>
  tenter(db, appareil, 'insert into public.profils (id, pseudo) values ($1, $2) returning *', [appareil, pseudo]);

const poserService = (db: Base, appareil: string, service: string) =>
  tenter(db, appareil, 'update public.profils set service = $2 where id = $1 returning *', [appareil, service]);

const poserIntitule = (db: Base, appareil: string, intitule: string) =>
  tenter(db, appareil, 'update public.profils set intitule = $2 where id = $1 returning *', [appareil, intitule]);

const relancer = (db: Base, appareil: string, relances: number) =>
  tenter(db, appareil, 'update public.profils set intitule_relances = $2 where id = $1 returning *', [
    appareil,
    relances
  ]);

/** Une base neuve, deux comptes approuvés (le profil n'exige pas l'approbation, mais la ligne de compte existe). */
async function monde(): Promise<Base> {
  const db = await base();
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  return db;
}

/** Retire un déclencheur de garde, pour le contrôle mord. */
async function sansGarde(db: Base) {
  await db.exec('drop trigger if exists profils_gardes on public.profils;');
}

describe('profil du testeur (#325, D-088, D-148)', () => {
  it('(a) un testeur crée son profil, pas celui d un autre', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    // B, connecté, ne peut pas écrire une ligne au nom de A.
    const usurpe = await tenter(db, APPAREIL_B, 'insert into public.profils (id, pseudo) values ($1, $2) returning *', [
      APPAREIL_A,
      'Usurpé'
    ]);
    refuse(usurpe, /row-level security|policy/i);
    // L'identifiant de A est déjà pris : on n'écrase pas.
    refuse(await creer(db, APPAREIL_A, 'Autre'), /duplicate key|profils_pkey/i);
  });

  it('(b) un testeur lit son profil, pas celui d un autre', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    const mien = await tenter(db, APPAREIL_A, 'select * from public.profils');
    accepte(mien);
    if (mien.accepte) expect(mien.lignes).toHaveLength(1);
    const autre = await tenter(db, APPAREIL_B, 'select * from public.profils');
    accepte(autre);
    if (autre.accepte) expect(autre.lignes).toHaveLength(0);
  });

  it('(c) un testeur ne change pas le profil d un autre : 0 ligne, sans erreur', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    const issue = await tenter(db, APPAREIL_B, "update public.profils set pseudo = 'Volé' where id = $1 returning *", [
      APPAREIL_A
    ]);
    accepte(issue);
    if (issue.accepte) expect(issue.lignes).toHaveLength(0);
    const relu = await db.query<{ pseudo: string }>('select pseudo from public.profils where id = $1', [APPAREIL_A]);
    expect(relu.rows[0]?.pseudo).toBe('Anaïs');
  });

  it('(d) le service est figé dès qu il est posé', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    accepte(await poserService(db, APPAREIL_A, '2e'));
    refuse(await poserService(db, APPAREIL_A, '3e'), /profils_service_fige/);
  });

  it('(e) l intitulé est figé dès qu il est enregistré', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    accepte(await poserService(db, APPAREIL_A, '1er'));
    accepte(await poserIntitule(db, APPAREIL_A, 'sculpteur de fumée'));
    refuse(await poserIntitule(db, APPAREIL_A, 'autre chose'), /profils_intitule_fige/);
  });

  it('(f) l intitulé se relance une fois : la seconde relance est refusée, et la relance après enregistrement aussi', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    accepte(await poserService(db, APPAREIL_A, '3e'));
    accepte(await relancer(db, APPAREIL_A, 1));
    // La borne de la colonne : pas de deuxième relance.
    refuse(await relancer(db, APPAREIL_A, 2), /intitule_relances_check|check constraint/i);
    accepte(await poserIntitule(db, APPAREIL_A, 'chef de projet fantôme'));
    refuse(await relancer(db, APPAREIL_A, 0), /profils_relance_figee/);
  });

  it('(f bis) pas de relance après enregistrement, même une première', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    accepte(await poserService(db, APPAREIL_A, 'rez-de-chaussee'));
    accepte(await poserIntitule(db, APPAREIL_A, 'sculpteur de fumée'));
    refuse(await relancer(db, APPAREIL_A, 1), /profils_relance_figee/);
  });

  it('(g) un intitulé suppose un service : le parcours avance dans l ordre', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    refuse(
      await poserIntitule(db, APPAREIL_A, 'sculpteur de fumée'),
      /profils_intitule_apres_service|check constraint/i
    );
  });

  it('(h) le profil ne se supprime pas depuis le jeu', async () => {
    const db = await monde();
    accepte(await creer(db, APPAREIL_A));
    // Pas de droit de suppression accordé : la base refuse le geste lui-même.
    refuse(
      await tenter(db, APPAREIL_A, 'delete from public.profils where id = $1 returning *', [APPAREIL_A]),
      /permission denied/i
    );
    const reste = await db.query<{ n: number }>('select count(*)::int as n from public.profils');
    expect(reste.rows[0]?.n).toBe(1);
  });

  it('bornes : pseudo vide ou trop long, service hors liste, intitulé trop long', async () => {
    const db = await monde();
    refuse(await creer(db, APPAREIL_A, '   '), /profils_pseudo_check|check constraint/i);
    refuse(await creer(db, APPAREIL_A, 'x'.repeat(25)), /profils_pseudo_check|check constraint/i);
    accepte(await creer(db, APPAREIL_A, 'Anaïs'));
    refuse(await poserService(db, APPAREIL_A, 'sous-sol'), /profils_service_check|check constraint/i);
    accepte(await poserService(db, APPAREIL_A, '2e'));
    refuse(await poserIntitule(db, APPAREIL_A, 'x'.repeat(81)), /profils_intitule_check|check constraint/i);
  });

  describe('le contrôle mord : chaque garde, retirée, laisse passer le geste fautif', () => {
    it('sans profils_gardes, un service posé peut changer', async () => {
      const db = await monde();
      await sansGarde(db);
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserService(db, APPAREIL_A, '2e'));
      accepte(await poserService(db, APPAREIL_A, '3e'));
    });

    it('sans profils_gardes, un intitulé enregistré peut changer', async () => {
      const db = await monde();
      await sansGarde(db);
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserService(db, APPAREIL_A, '2e'));
      accepte(await poserIntitule(db, APPAREIL_A, 'sculpteur de fumée'));
      accepte(await poserIntitule(db, APPAREIL_A, 'autre chose'));
    });

    it('sans profils_gardes, une relance après enregistrement passe', async () => {
      const db = await monde();
      await sansGarde(db);
      accepte(await creer(db, APPAREIL_A));
      accepte(await poserService(db, APPAREIL_A, '2e'));
      accepte(await poserIntitule(db, APPAREIL_A, 'sculpteur de fumée'));
      accepte(await relancer(db, APPAREIL_A, 1));
    });
  });
});
