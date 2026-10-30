import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPAREIL_A, base, creerCompte, type Base } from './pglite';

/**
 * La migration `0022_services.sql` — les services deviennent ceux de l'immeuble (D-159).
 *
 * **Ce que ce test garde, et pourquoi il existe** : appliquée en production le 30/10/2026, la
 * première version de cette migration répondait `profils_service_fige` — la garde de 0019
 * refuse *tout* changement de `service` une fois posé, y compris la correction d'une coquille.
 * Les tests de `profils.test.ts` partent d'une base déjà migrée et n'ont aucune ligne
 * `red-chaussee` : ils ne pouvaient pas voir le problème. Ici la base est montée **jusqu'à
 * 0021**, on y pose une ligne comme le ferait un testeur d'avant, puis on rejoue 0022.
 */

/** Les noms des migrations, dans l'ordre — `fichiersMigrations()` de `pglite.ts` rend le contenu. */
const NOMS = readdirSync(new URL('./migrations/', import.meta.url))
  .filter((nom) => nom.endsWith('.sql'))
  .sort();

/** Le contenu d'une migration, par son nom de fichier. */
const lire = (nom: string): string => readFileSync(new URL(`./migrations/${nom}`, import.meta.url), 'utf8');

/** Les migrations **jusqu'à** un fichier donné, bout à bout, comme `supabase db push` les joue. */
const jusqua = (derniere: string): string =>
  NOMS.filter((nom) => nom <= derniere)
    .map(lire)
    .join('\n');

const serviceDe = async (db: Base, appareil: string): Promise<string | null> => {
  const { rows } = await db.query<{ service: string | null }>('select service from public.profils where id = $1', [
    appareil
  ]);
  return rows[0]?.service ?? null;
};

/** Pose un service comme le fait l'écran, et dit si la base l'accepte. */
const poser = async (db: Base, service: string): Promise<boolean> => {
  try {
    await db.query('update public.profils set service = $2 where id = $1', [APPAREIL_A, service]);
    return true;
  } catch {
    return false;
  }
};

describe('la migration 0022 — les services de l’immeuble (D-159)', () => {
  it('réécrit un « Red Chaussée » existant sans que la garde « figé » s’y oppose', async () => {
    const db = await base(jusqua('0021_deck_legal.sql'));
    await creerCompte(db, APPAREIL_A);
    await db.query("insert into public.profils (id, pseudo, service) values ($1, 'Anaïs', 'red-chaussee')", [
      APPAREIL_A
    ]);
    expect(await serviceDe(db, APPAREIL_A)).toBe('red-chaussee');

    // C'est ici que la première version échouait : `profils_service_fige`.
    await db.exec(lire('0022_services.sql'));

    expect(await serviceDe(db, APPAREIL_A)).toBe('rez-de-chaussee');
  });

  it('après la migration, la liste est celle de l’immeuble : « red-chaussee » tombe, « 4e » entre', async () => {
    const db = await base();
    await creerCompte(db, APPAREIL_A);
    await db.query("insert into public.profils (id, pseudo) values ($1, 'Anaïs')", [APPAREIL_A]);

    // Le contrôle mord : l'ancienne valeur est refusée, la nouvelle acceptée.
    expect(await poser(db, 'red-chaussee')).toBe(false);
    expect(await poser(db, '4e')).toBe(true);
    expect(await serviceDe(db, APPAREIL_A)).toBe('4e');
  });

  it('la garde se referme : après la réécriture, un service posé ne bouge plus', async () => {
    const db = await base();
    await creerCompte(db, APPAREIL_A);
    await db.query("insert into public.profils (id, pseudo) values ($1, 'Anaïs')", [APPAREIL_A]);
    await db.query("update public.profils set service = '1er' where id = $1", [APPAREIL_A]);

    // La parenthèse `disable trigger` de 0022 est refermée : c'est 0019 qui parle encore.
    expect(await poser(db, '3e')).toBe(false);
    expect(await serviceDe(db, APPAREIL_A)).toBe('1er');
  });
});
