// @vitest-environment node
/**
 * **Le Deck se rejoue une seule fois par clé** — #491, D-153 (3), D-179 (4), migration
 * `0025_deck_rejeu.sql`.
 *
 * On joue la **migration réelle** dans PGlite (PostgreSQL en WASM, RLS comprise), comme
 * `mur.test.ts` et `pack-openings.test.ts`. Rien n'est recopié ici : une copie garderait la
 * copie, pas le schéma qu'on applique pour de vrai (#112).
 *
 * Ce que la garde exige, et pourquoi chacun peut échouer :
 *
 * 1. **la même clé rejouée ne double rien** : un retry (réponse perdue, rechargement) rend
 *    le Deck d'origine, et une clé rejouée avec un autre lot ne l'applique pas ;
 * 2. **les opérations se rejouent dans l'ordre** : ajouter puis retirer puis ajouter ne
 *    laisse pas le même Deck que l'ordre inverse ;
 * 3. **un Deck illégal est refusé, rien n'est écrit** : la garde différée `0021` juge au
 *    commit, la transaction est annulée (reçu compris), et la clé reste **libre** pour la
 *    tentative suivante — c'est ce qui laisse la file du client rejouable ;
 * 4. **le client exécute la fonction et n'écrit pas le reçu** : `authenticated` appelle
 *    `rejouer_deck`, mais aucun `insert` direct dans `deck_rejeux` et aucun `anon` ;
 * 5. **le contrôle mord** : l'unicité de la clé retirée, la même clé **rejoue deux fois** —
 *    sans ce cas, on ne garderait que l'apparence de l'idempotence (#112).
 */
import { describe, expect, it } from 'vitest';
import {
  APPAREIL_A,
  APPAREIL_B,
  avecAppareil,
  baseAvecAppareils,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

/** Un geste « ajouter » bien formé, dans le vocabulaire de `src/lib/deck.ts`. */
function ajouter(carte: string, stade: string | null = 'ENTRANT') {
  return { type: 'ajouter', carte, nom: `Carte ${carte}`, stade };
}

/** Un geste « retirer ». */
function retirer(carte: string) {
  return { type: 'retirer', carte };
}

/** Un geste « remplacer », avec une carte par entrée (l'ordre est celui du tableau). */
function remplacer(cartes: readonly string[]) {
  return {
    type: 'remplacer',
    cartes: cartes.map((carte) => ({ carte, nom: `Carte ${carte}`, stade: 'ENTRANT' }))
  };
}

/**
 * Appelle la RPC **comme le client** : rôle `authenticated`, sujet du JWT posé. La fonction
 * est `security definer`, donc `auth.uid()` désigne bien l'appareil.
 */
async function rejouer(db: Base, appareil: string, cle: string, operations: unknown[]) {
  return avecAppareil(db, appareil, async () => {
    const resultat = await db.query<{ deck: unknown }>('select public.rejouer_deck($1::jsonb, $2) as deck', [
      JSON.stringify(operations),
      cle
    ]);
    return resultat.rows[0].deck;
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

/** Le nombre de reçus (lu par le propriétaire, la table n'a aucun droit client). */
async function recus(db: Base): Promise<number> {
  const resultat = await db.query<{ n: number }>('select count(*)::int as n from public.deck_rejeux');
  return resultat.rows[0].n;
}

/** Vingt-et-une cartes distinctes : un Deck illégal par la taille (`0021`). */
const VINGT_ET_UNE = Array.from({ length: 21 }, (_, index) => `carte-${index}`);

describe('le Deck se rejoue une seule fois par clé (#491, D-153 (3))', () => {
  it('la même clé deux fois ne double rien, et un autre lot sous la même clé n’est pas appliqué', async () => {
    const db = await baseAvecAppareils();

    await rejouer(db, APPAREIL_A, 'lot-1', [ajouter('a'), ajouter('a'), ajouter('b')]);
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'a', quantite: 2, rang: 0 },
      { carte_id: 'b', quantite: 1, rang: 1 }
    ]);

    // Le retry : même clé, mêmes opérations — rien ne double.
    await rejouer(db, APPAREIL_A, 'lot-1', [ajouter('a'), ajouter('a'), ajouter('b')]);
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'a', quantite: 2, rang: 0 },
      { carte_id: 'b', quantite: 1, rang: 1 }
    ]);

    // Une clé déjà vue avec un **autre** lot ne l'applique pas : la clé fait foi.
    await rejouer(db, APPAREIL_A, 'lot-1', [ajouter('c')]);
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'a', quantite: 2, rang: 0 },
      { carte_id: 'b', quantite: 1, rang: 1 }
    ]);
    expect(await recus(db)).toBe(1);
    await db.close();
  });

  it('applique les opérations dans l’ordre reçu', async () => {
    const db = await baseAvecAppareils();

    await rejouer(db, APPAREIL_A, 'lot-ordre', [ajouter('a'), ajouter('b'), retirer('a')]);
    expect(await deck(db, APPAREIL_A)).toEqual([{ carte_id: 'b', quantite: 1, rang: 1 }]);

    await rejouer(db, APPAREIL_A, 'lot-ordre-2', [ajouter('a')]);
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'b', quantite: 1, rang: 1 },
      { carte_id: 'a', quantite: 1, rang: 2 }
    ]);
    await db.close();
  });

  it('`remplacer` remet le Deck entier dans l’ordre, doublons compris', async () => {
    const db = await baseAvecAppareils();

    await rejouer(db, APPAREIL_A, 'remplacement', [remplacer(['b', 'a', 'b'])]);
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'b', quantite: 2, rang: 0 },
      { carte_id: 'a', quantite: 1, rang: 1 }
    ]);

    await rejouer(db, APPAREIL_A, 'remplacement-2', [remplacer([])]);
    expect(await deck(db, APPAREIL_A)).toEqual([]);
    await db.close();
  });

  it('un Deck illégal est refusé, rien n’est écrit, et la clé reste libre', async () => {
    const db = await baseAvecAppareils();

    // Un Deck partiel est accepté : `0021` ne juge la taille qu'au plafond.
    await rejouer(db, APPAREIL_A, 'legal', [remplacer(['garde-1', 'garde-2'])]);
    expect(await deck(db, APPAREIL_A)).toHaveLength(2);

    // 21 cartes : la garde `0021` refuse au commit.
    await expect(rejouer(db, APPAREIL_A, 'illegal', [remplacer(VINGT_ET_UNE)])).rejects.toThrow(/deck_taille/);

    // **Rien n'est écrasé** : le Deck d'avant est intact, et le reçu du lot refusé n'existe pas.
    expect(await deck(db, APPAREIL_A)).toEqual([
      { carte_id: 'garde-1', quantite: 1, rang: 0 },
      { carte_id: 'garde-2', quantite: 1, rang: 1 }
    ]);
    expect(await recus(db)).toBe(1);

    // La clé est libre : la tentative suivante, légale, passe sous la **même** clé.
    await rejouer(db, APPAREIL_A, 'illegal', [remplacer(['garde-1'])]);
    expect(await deck(db, APPAREIL_A)).toEqual([{ carte_id: 'garde-1', quantite: 1, rang: 0 }]);
    expect(await recus(db)).toBe(2);
    await db.close();
  });

  it('un deck sans compte ou sans clé est refusé nommément', async () => {
    const db = await baseAvecAppareils();

    await expect(
      avecAppareil(db, APPAREIL_A, () => db.query('select public.rejouer_deck($1::jsonb, $2)', ['[]', '   ']))
    ).rejects.toThrow(/deck_sans_cle/);

    // Sans sujet de JWT, `auth.uid()` est nul : la fonction refuse avant d'écrire.
    await db.exec('set role authenticated; reset request.jwt.claim.sub;');
    await expect(db.query('select public.rejouer_deck($1::jsonb, $2)', ['[]', 'lot'])).rejects.toThrow(
      /deck_sans_compte/
    );
    await db.exec('reset role;');
    await db.close();
  });

  it('un autre compte ne voit pas le Deck du premier', async () => {
    const db = await baseAvecAppareils();
    await rejouer(db, APPAREIL_A, 'lot-a', [ajouter('a')]);
    expect(await deck(db, APPAREIL_A)).toHaveLength(1);
    expect(await deck(db, APPAREIL_B)).toEqual([]);
    await db.close();
  });

  it('le client exécute la fonction, mais n’écrit pas le reçu, et `anon` n’exécute rien', async () => {
    const db = await baseAvecAppareils();

    // `authenticated` appelle la fonction : c'est le chemin du client (`rpc('rejouer_deck')`).
    await expect(rejouer(db, APPAREIL_A, 'lot', [ajouter('a')])).resolves.toBeDefined();

    // Aucun `insert` direct dans le reçu : la fonction seule l'écrit.
    await expect(
      avecAppareil(db, APPAREIL_A, () =>
        db.query(`insert into public.deck_rejeux (compte_id, cle, operations) values ($1, 'forgee', '[]'::jsonb)`, [
          APPAREIL_A
        ])
      )
    ).rejects.toThrow(/permission denied/i);

    // `anon` n'exécute pas la fonction.
    await db.exec('set role anon;');
    await expect(db.query('select public.rejouer_deck($1::jsonb, $2)', ['[]', 'lot'])).rejects.toThrow(
      /permission denied/i
    );
    await db.exec('reset role;');
    await db.close();
  });

  it('la migration se rejoue sur une base déjà à jour', async () => {
    const fichier = fichiersMigrations().find((sql) => sql.includes('create table if not exists public.deck_rejeux'));
    if (!fichier) throw new Error('supabase/migrations/0025_deck_rejeu.sql introuvable');

    const db = await baseAvecAppareils(`${migrations()}\n${fichier}`);
    await rejouer(db, APPAREIL_A, 'rejeu', [ajouter('a')]);
    expect(await deck(db, APPAREIL_A)).toHaveLength(1);
    expect(await recus(db)).toBe(1);
    await db.close();
  });

  describe('le contrôle mord (#112)', () => {
    it('l’unicité de la clé retirée, la même clé rejoue deux fois', async () => {
      // Le cas fautif : sans la contrainte, le `on conflict` ne s'applique plus et le lot
      // repasse par le rejeu. C'est exactement ce que la 0025 empêche.
      const mutee = migrations()
        .replace(
          'constraint deck_rejeux_cle_unique unique (compte_id, cle)',
          'constraint deck_rejeux_cle_unique unique (id)'
        )
        .replace('on conflict on constraint deck_rejeux_cle_unique do nothing', '');
      const db = await baseAvecAppareils(mutee);

      await rejouer(db, APPAREIL_A, 'lot-1', [ajouter('a'), ajouter('b')]);
      await rejouer(db, APPAREIL_A, 'lot-1', [ajouter('a'), ajouter('b')]);

      expect(await deck(db, APPAREIL_A)).toEqual([
        { carte_id: 'a', quantite: 2, rang: 0 },
        { carte_id: 'b', quantite: 2, rang: 1 }
      ]);
      expect(await recus(db)).toBe(2);
      await db.close();
    });
  });
});
