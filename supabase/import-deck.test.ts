// @vitest-environment node
/**
 * **Le Deck local monte dans le compte, une seule fois** — #492, D-153 (1), D-179 (1),
 * migration `0026_import_deck.sql`.
 *
 * On joue la **migration réelle** dans PGlite (PostgreSQL en WASM, RLS comprise), comme
 * `deck-rejeu.test.ts`. Rien n'est recopié ici : une copie garderait la copie, pas le schéma
 * qu'on applique pour de vrai (#112).
 *
 * Ce que la garde exige, et pourquoi chacun peut échouer :
 *
 * 1. **un compte vide reçoit le Deck local, une fois** : deux appels (deux logins, deux
 *    onglets, deux appareils du même compte) n'importent qu'une fois ;
 * 2. **le marqueur tient même quand le Deck importé est vide** : un second appel avec un
 *    Deck local non vide ne le réimporte pas — c'est le cas que la présence d'un Deck ne
 *    peut pas couvrir ;
 * 3. **un compte qui a déjà un Deck n'est pas écrasé** : le Deck du serveur reste, et
 *    l'import est marqué comme fait ;
 * 4. **la RPC est transactionnelle** : un Deck illégal annule l'import **et** le marqueur,
 *    puis une tentative légale passe ;
 * 5. **le client exécute la fonction, mais n'écrit pas le marqueur**, et `anon` n'exécute
 *    rien ;
 * 6. **le contrôle mord** : le marqueur retiré, le second import passe — sans ce cas, on ne
 *    garderait que l'apparence de l'unicité (#112).
 */
import { describe, expect, it } from 'vitest';
import { APPAREIL_A, APPAREIL_B, avecAppareil, baseAvecAppareils, migrations, type Base } from './pglite';

/** Un geste « remplacer », avec une carte par entrée (l'ordre est celui du tableau). */
function remplacer(cartes: readonly string[]) {
  return {
    type: 'remplacer',
    cartes: cartes.map((carte) => ({ carte, nom: `Carte ${carte}`, stade: 'ENTRANT' }))
  };
}

/** Vingt-et-une cartes distinctes : un Deck illégal par la taille (`0021`). */
const VINGT_ET_UNE = Array.from({ length: 21 }, (_, index) => `carte-${index}`);

interface ResultatImport {
  importe: boolean;
  deck: Array<{ carte: string; quantite: number; rang: number }>;
}

/** Appelle la RPC **comme le client** : rôle `authenticated`, sujet du JWT posé. */
async function importer(db: Base, appareil: string, cle: string, operations: unknown[]): Promise<ResultatImport> {
  return avecAppareil(db, appareil, async () => {
    const resultat = await db.query<{ resultat: ResultatImport }>(
      'select public.importer_deck($1::jsonb, $2) as resultat',
      [JSON.stringify(operations), cle]
    );
    return resultat.rows[0].resultat;
  });
}

/** Le Deck du compte, lu par le compte lui-même (RLS), dans l'ordre des rangs. */
async function deck(db: Base, appareil: string) {
  return avecAppareil(db, appareil, async () => {
    const resultat = await db.query<{ carte_id: string; quantite: number; rang: number }>(
      'select carte_id, quantite, rang from public.deck order by rang'
    );
    return resultat.rows;
  });
}

/** Le nombre de marqueurs d'import (lu hors RLS : `authenticated` n'a aucun droit dessus). */
async function marqueurs(db: Base): Promise<number> {
  const resultat = await db.query<{ n: number }>('select count(*)::int as n from public.deck_imports');
  return resultat.rows[0].n;
}

/** Pose un Deck serveur sans passer par l'import : le rejeu de `0025`, chemin du client. */
async function poserDeck(db: Base, appareil: string, cartes: readonly string[], cle: string): Promise<void> {
  await avecAppareil(db, appareil, async () => {
    await db.query('select public.rejouer_deck($1::jsonb, $2)', [JSON.stringify([remplacer(cartes)]), cle]);
  });
}

describe('le Deck local monte dans le compte, une seule fois (#492, D-153 (1))', () => {
  it('un compte vide reçoit le Deck local, et deux logins n’importent qu’une fois', async () => {
    const db = await baseAvecAppareils();

    const premier = await importer(db, APPAREIL_A, 'import-1', [remplacer(['a', 'b'])]);
    expect(premier.importe).toBe(true);
    expect(premier.deck).toEqual([
      { carte: 'a', quantite: 1, rang: 0 },
      { carte: 'b', quantite: 1, rang: 1 }
    ]);
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'a', quantite: 1, rang: 0 },
      { carte_id: 'b', quantite: 1, rang: 1 }
    ]);
    expect(await marqueurs(db)).toBe(1);

    // Le second login : une autre clé (le client en crée une à chaque tentative), un autre
    // Deck local — le marqueur arrête tout, et le Deck du compte ne bouge pas.
    const second = await importer(db, APPAREIL_A, 'import-2', [remplacer(['c'])]);
    expect(second.importe).toBe(false);
    expect(second.deck).toEqual([
      { carte: 'a', quantite: 1, rang: 0 },
      { carte: 'b', quantite: 1, rang: 1 }
    ]);
    expect(await deck(db, APPAREIL_A)).toHaveLength(2);
    expect(await marqueurs(db)).toBe(1);
    await db.close();
  });

  it('le marqueur tient même quand le Deck importé est vide', async () => {
    const db = await baseAvecAppareils();

    // Un premier appareil n'a aucun Deck local : l'import est fait, le Deck du compte reste
    // vide. La présence d'un Deck ne peut donc pas servir de garde ici.
    const premier = await importer(db, APPAREIL_A, 'import-vide', [remplacer([])]);
    expect(premier).toEqual({ importe: true, deck: [] });
    expect(await marqueurs(db)).toBe(1);

    // Un second appareil arrive avec un Deck local non vide : il ne doit **rien** importer.
    const second = await importer(db, APPAREIL_A, 'import-second', [remplacer(['arrive'])]);
    expect(second.importe).toBe(false);
    expect(second.deck).toEqual([]);
    expect(await deck(db, APPAREIL_A)).toEqual([]);
    expect(await marqueurs(db)).toBe(1);
    await db.close();
  });

  it('un compte qui a déjà un Deck n’est pas écrasé, et l’import est marqué comme fait', async () => {
    const db = await baseAvecAppareils();
    await poserDeck(db, APPAREIL_A, ['serveur-1', 'serveur-2'], 'deck-serveur');

    const resultat = await importer(db, APPAREIL_A, 'import-local', [remplacer(['local'])]);
    expect(resultat.importe).toBe(false);
    expect(resultat.deck).toEqual([
      { carte: 'serveur-1', quantite: 1, rang: 0 },
      { carte: 'serveur-2', quantite: 1, rang: 1 }
    ]);
    // **Le Deck du serveur reste** : « on n'écrase pas » (D-179 (1)).
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'serveur-1', quantite: 1, rang: 0 },
      { carte_id: 'serveur-2', quantite: 1, rang: 1 }
    ]);
    expect(await marqueurs(db)).toBe(1);

    // Un nouvel appel ne change rien : le marqueur est posé avec l'import refusé.
    expect(await importer(db, APPAREIL_A, 'import-local-2', [remplacer(['autre'])])).toMatchObject({
      importe: false
    });
    expect(await deck(db, APPAREIL_A)).toHaveLength(2);
    await db.close();
  });

  it('la RPC est transactionnelle : un Deck illégal annule l’import et le marqueur', async () => {
    const db = await baseAvecAppareils();

    await expect(importer(db, APPAREIL_A, 'import-illegal', [remplacer(VINGT_ET_UNE)])).rejects.toThrow(/deck_taille/);
    // **Rien ne reste** : ni Deck, ni marqueur. Le marqueur tombe avec l'import.
    expect(await deck(db, APPAREIL_A)).toEqual([]);
    expect(await marqueurs(db)).toBe(0);

    // La tentative suivante, légale, passe : la clé et le marqueur étaient libres.
    const legal = await importer(db, APPAREIL_A, 'import-legal', [remplacer(['enfin'])]);
    expect(legal.importe).toBe(true);
    expect(legal.deck).toEqual([{ carte: 'enfin', quantite: 1, rang: 0 }]);
    expect(await marqueurs(db)).toBe(1);
    await db.close();
  });

  it('un Deck sans compte ou sans clé est refusé nommément', async () => {
    const db = await baseAvecAppareils();

    await expect(
      avecAppareil(db, APPAREIL_A, () => db.query('select public.importer_deck($1::jsonb, $2)', ['[]', '   ']))
    ).rejects.toThrow(/import_deck_sans_cle/);

    // Sans sujet de JWT, `auth.uid()` est nul : la fonction refuse avant d'écrire.
    await db.exec('set role authenticated; reset request.jwt.claim.sub;');
    await expect(db.query('select public.importer_deck($1::jsonb, $2)', ['[]', 'lot'])).rejects.toThrow(
      /import_deck_sans_compte/
    );
    await db.exec('reset role;');
    expect(await marqueurs(db)).toBe(0);
    await db.close();
  });

  it('le client exécute la fonction, mais n’écrit pas le marqueur, et `anon` n’exécute rien', async () => {
    const db = await baseAvecAppareils();

    await expect(importer(db, APPAREIL_A, 'import', [remplacer(['a'])])).resolves.toBeDefined();

    // Aucun `insert` direct dans le marqueur : la fonction seule l'écrit.
    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query('insert into public.deck_imports (compte_id) values ($1)', [APPAREIL_A])
      )
    ).rejects.toThrow(/permission denied/i);

    // `anon` n'exécute pas la fonction.
    await db.exec('set role anon;');
    await expect(db.query('select public.importer_deck($1::jsonb, $2)', ['[]', 'lot'])).rejects.toThrow(
      /permission denied/i
    );
    await db.exec('reset role;');
    await db.close();
  });

  it('un autre compte a son propre marqueur : importer pour A n’importe rien pour B', async () => {
    const db = await baseAvecAppareils();
    await importer(db, APPAREIL_A, 'import-a', [remplacer(['a'])]);

    // B n'a jamais importé : son compte est vide, son Deck local monte.
    const b = await importer(db, APPAREIL_B, 'import-b', [remplacer(['b'])]);
    expect(b.importe).toBe(true);
    expect(await deck(db, APPAREIL_B)).toEqual([{ carte_id: 'b', quantite: 1, rang: 0 }]);
    expect(await marqueurs(db)).toBe(2);
    await db.close();
  });

  describe('le contrôle mord (#112)', () => {
    it('le marqueur retiré, un second import passe', async () => {
      // Le cas fautif : sans la clé primaire du marqueur ni le `on conflict`, l'insertion
      // réussit à chaque appel ; le compte a un Deck vide après le premier import, donc la
      // garde « le Deck existe » ne le retient pas, et le Deck local est réimporté.
      const mutee = migrations()
        .replace(
          'compte_id  uuid        primary key references auth.users (id) on delete cascade',
          'compte_id  uuid        references auth.users (id) on delete cascade'
        )
        .replace('on conflict (compte_id) do nothing', '');
      const db = await baseAvecAppareils(mutee);

      const premier = await importer(db, APPAREIL_A, 'import-vide', [remplacer([])]);
      expect(premier).toEqual({ importe: true, deck: [] });

      const second = await importer(db, APPAREIL_A, 'import-rejoue', [remplacer(['rejoue'])]);
      expect(second.importe).toBe(true);
      expect(await deck(db, APPAREIL_A)).toEqual([{ carte_id: 'rejoue', quantite: 1, rang: 0 }]);
      await db.close();
    });
  });
});
