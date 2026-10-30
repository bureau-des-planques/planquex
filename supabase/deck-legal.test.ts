// @vitest-environment node
/**
 * Un Deck en base reste légal — la migration `0021_deck_legal.sql` (#490, D-153).
 *
 * Même banc que `deck-collection.test.ts` : les migrations **réelles**, jouées dans PGlite
 * (RLS comprise), en rôle `authenticated`. Le Deck vit sur le compte ; la base refuse ce que
 * `deckLegal` (`src/game/deck.ts`) refuse :
 *
 *   (a) plus de **20** cartes ;
 *   (b) plus de **2** exemplaires du **même nom** (une variante partage le nom de sa base) ;
 *   (c) un Deck **complet** sans **Planqué Entrant** ;
 *   (d) un Deck **partiel** sans Entrant n'est pas encore jugé : il n'est pas encore un Deck ;
 *   (e) un Deck **légal** passe ;
 *   (f) la migration **se rejoue** ;
 *   (g) **une seule source** : les trois constantes du déclencheur disent la même chose que
 *       `DECK_SIZE`, `MAX_COPIES_PER_NAME` (`src/game/deck.ts`) et le stade `ENTRANT`
 *       (`Stage`, `STAGE_META`) — changer l'un sans l'autre fait échouer (g) ;
 *   (h) **le contrôle mord** : la 0021 neutralisée laisse passer les cas fautifs.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAGE_META } from '@/data';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';
import {
  APPAREIL_A,
  APPAREIL_B,
  avecAppareil,
  base,
  creerCompte,
  fichiersMigrations,
  migrations,
  type Base
} from './pglite';

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

/** Pose une carte au Deck. `nom` vaut l'identifiant par défaut ; `stade` reste nul si omis. */
const ajouterAuDeck = (
  db: Base,
  appareil: string,
  carte: string,
  rang: number,
  quantite = 1,
  nom: string = carte,
  stade: string | null = null
) =>
  tenter(
    db,
    appareil,
    `insert into public.deck (compte_id, carte_id, quantite, rang, nom, stade)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [appareil, carte, quantite, rang, nom, stade]
  );

/** Une base neuve, deux comptes approuvés. */
async function monde(): Promise<Base> {
  const db = await base();
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  return db;
}

/** La 0021, lue paresseusement : sans elle, les scénarios parleraient d'un fichier absent. */
function migrationDeckLegal(): string {
  const trouvee = fichiersMigrations().find((sql) => sql.includes('create or replace function public.deck_gardes'));
  if (!trouvee) throw new Error('supabase/migrations/0021_deck_legal.sql introuvable');
  return trouvee;
}

/**
 * Un Deck de `nombre` cartes distinctes (`carte-0`, `carte-1`…), posées une à une.
 * L'Entrant, quand il y en a un, vient **en premier** : c'est l'ordre que suit le client
 * (`autoDeck`), et il permet de distinguer « pas encore complet » de « complet sans Entrant ».
 */
async function remplir(
  db: Base,
  appareil: string,
  nombre: number,
  options: { entrant?: boolean; stade?: string | null } = {}
): Promise<void> {
  for (let i = 0; i < nombre; i++) {
    const stade = options.entrant && i === 0 ? 'ENTRANT' : (options.stade ?? null);
    accepte(await ajouterAuDeck(db, appareil, `carte-${i}`, i, 1, `Carte ${i}`, stade));
  }
}

describe('un Deck en base reste légal (#490, D-153)', () => {
  it('(a) un Deck de 21 cartes est refusé', async () => {
    const db = await monde();
    await remplir(db, APPAREIL_A, DECK_SIZE, { entrant: true });

    const vingtEtUnieme = await ajouterAuDeck(db, APPAREIL_A, 'carte-20', 20, 1, 'Carte 20');
    refuse(vingtEtUnieme, /deck_taille/);
    if (!vingtEtUnieme.accepte) expect(vingtEtUnieme.message).toContain('au plus 20 cartes');
  });

  it('(b) un Deck avec trois exemplaires du même nom est refusé', async () => {
    const db = await monde();
    // Trois exemplaires d'un même identifiant : la quantité le dit.
    refuse(await ajouterAuDeck(db, APPAREIL_A, 'carte-a', 0, 3, 'Infirmier', 'ENTRANT'), /deck_exemplaires/);

    // Deux exemplaires de la base, puis un de sa variante : la clé est le **nom**, pas
    // l'identifiant — c'est ce que `deckCountsByName` compte (src/game/deck.ts).
    accepte(await ajouterAuDeck(db, APPAREIL_A, 'carte-a', 0, 2, 'Infirmier', 'ENTRANT'));
    const variante = await ajouterAuDeck(db, APPAREIL_A, 'carte-a-star', 1, 1, 'Infirmier', 'N+1');
    refuse(variante, /deck_exemplaires/);
    if (!variante.accepte) expect(variante.message).toContain('2 exemplaires au plus du même nom');
  });

  it('(c) un Deck complet sans Planqué Entrant est refusé', async () => {
    const db = await monde();
    // 19 cartes, aucune Entrante : tant qu'il n'est pas complet, il n'est pas jugé.
    await remplir(db, APPAREIL_A, DECK_SIZE - 1);

    const vingtieme = await ajouterAuDeck(db, APPAREIL_A, 'carte-19', 19, 1, 'Carte 19', 'N+1');
    refuse(vingtieme, /deck_entrant/);
    if (!vingtieme.accepte) expect(vingtieme.message).toContain('au moins un Planqué Entrant');
  });

  it('(d) un Deck partiel sans Entrant passe : il n’est pas encore un Deck', async () => {
    const db = await monde();
    accepte(await ajouterAuDeck(db, APPAREIL_A, 'carte-0', 0, 1, 'Carte 0', 'N+1'));
    accepte(await ajouterAuDeck(db, APPAREIL_A, 'carte-1', 1, 1, 'Carte 1', 'N+2'));
  });

  it('(e) un Deck légal passe', async () => {
    const db = await monde();
    await remplir(db, APPAREIL_A, DECK_SIZE, { entrant: true });

    const lu = await tenter(db, APPAREIL_A, 'select count(*)::int as n from public.deck');
    accepte(lu);
    if (lu.accepte) expect(lu.lignes[0]?.n).toBe(DECK_SIZE);
  });

  it('(f) la migration se rejoue sans erreur', async () => {
    const db = await monde();
    await db.exec(migrationDeckLegal());
    await db.exec(migrationDeckLegal());
    const colonnes = await db.query<{ nom: string }>(
      `select column_name as nom from information_schema.columns
        where table_schema = 'public' and table_name = 'deck' and column_name in ('nom', 'stade')
        order by 1`
    );
    expect(colonnes.rows.map((ligne) => ligne.nom)).toEqual(['nom', 'stade']);
  });
});

describe('une seule source pour les nombres (#490)', () => {
  const sql = migrationDeckLegal();
  const deckTs = readFileSync(new URL('../src/game/deck.ts', import.meta.url), 'utf8');

  /** La valeur d'une constante `nom constant <type> := <valeur>` du déclencheur. */
  function constante(motif: RegExp): string {
    const trouvee = motif.exec(sql);
    expect(trouvee, `constante introuvable dans la 0021 : ${motif}`).not.toBeNull();
    return trouvee![1] as string;
  }

  it('(g) DECK_SIZE et MAX_COPIES_PER_NAME sont ceux de src/game/deck.ts', () => {
    expect(Number(constante(/taille_max\s+constant\s+integer\s*:=\s*(\d+)/))).toBe(DECK_SIZE);
    expect(Number(constante(/max_par_nom\s+constant\s+integer\s*:=\s*(\d+)/))).toBe(MAX_COPIES_PER_NAME);
  });

  it('(g) le Planqué Entrant est le même des deux côtés', () => {
    const stade = constante(/stade_entrant\s+constant\s+text\s*:=\s*'([^']+)'/);
    // Le stade du catalogue (`Stage`) : la base et le client nomment le même.
    expect(Object.keys(STAGE_META)).toContain(stade);
    expect(STAGE_META[stade as keyof typeof STAGE_META].label).toBe('Entrant');
    // Le mot de la règle, dans le message du client et dans celui de la base.
    expect(deckTs).toContain('Planqué Entrant');
    expect(sql).toContain('Planqué Entrant');
  });
});

describe('le contrôle mord — la 0021 neutralisée laisse passer le Deck illégal', () => {
  /** Les migrations réelles, la 0021 remplacée par une version dont la garde est coupée. */
  function migrationsSansGarde(motif: string, remplacement: string): string {
    const sql = migrationDeckLegal();
    const mutee = sql.replace(motif, () => remplacement);
    expect(mutee, `motif introuvable dans la 0021 : ${motif}`).not.toBe(sql);
    return migrations().replace(sql, () => mutee);
  }

  it('sans la garde de taille, un Deck de 21 cartes est accepté', async () => {
    const db = await base(migrationsSansGarde('if total > taille_max then', 'if false then'));
    await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
    await remplir(db, APPAREIL_A, DECK_SIZE, { entrant: true });

    accepte(await ajouterAuDeck(db, APPAREIL_A, 'carte-20', 20, 1, 'Carte 20'));
  });

  it('sans la garde d’Entrant, un Deck complet sans Entrant est accepté', async () => {
    const db = await base(migrationsSansGarde('if total = taille_max then', 'if false then'));
    await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
    await remplir(db, APPAREIL_A, DECK_SIZE - 1);

    accepte(await ajouterAuDeck(db, APPAREIL_A, 'carte-19', 19, 1, 'Carte 19', 'N+1'));
  });
});
