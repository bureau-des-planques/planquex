// @vitest-environment node
// Lenteur justifiée (D-143 (5)) — garde l'isolation : il monte plusieurs bases exprès, dont un cas fautif
/**
 * **La base recyclée ne fuit pas d'un cas à l'autre** (#422, D-143 (4)).
 *
 * `base()` ne monte plus PostgreSQL à chaque appel : il reprend une instance **vidée** au
 * retour du cas précédent (`close()`), ou une base chargée depuis un gabarit migré. C'est ce
 * qui fait passer `discord.test.ts` de 21 démarrages de PostgreSQL à un seul.
 *
 * Le marché est simple, et il se vérifie : **une base rendue est vide**. Si ce fichier tombe,
 * les gardes de RLS (`mur.test.ts`, `mur-ecriture.test.ts`, `comptes.test.ts`) deviennent des
 * faux verts — elles liraient les lignes d'un scénario précédent en croyant les avoir écrites.
 *
 * Le **contrôle mord** est le second bloc : il refait le même scénario contre un vidage
 * **incomplet** (`TABLES_VIDEES` amputé du schéma `auth`) et **exige** d'y voir la fuite. Sans
 * lui, un `truncate` qui ne couvrirait plus rien passerait pour un vidage.
 */
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { APPAREIL_A, avecAppareil, base, baseAvecAppareils, migrations, SHIM, type Base } from './pglite';

/** Les mêmes tables que `vider()` : calculées sur la base, jamais recopiées. */
const TABLES = `select format('%I.%I', schemaname, tablename) as nom
  from pg_tables
 where schemaname not in ('pg_catalog', 'information_schema')`;

/** Le geste de `vider()`, avec un filtre qu'on peut amputer pour fabriquer le cas fautif. */
async function viderSauf(db: Base, exclu: string): Promise<void> {
  const { rows } = await db.query<{ nom: string }>(
    `select format('%I.%I', schemaname, tablename) as nom
       from pg_tables
      where schemaname not in ('pg_catalog', 'information_schema')
        and schemaname <> $1`,
    [exclu]
  );
  await db.exec(`truncate ${rows.map((ligne) => ligne.nom).join(', ')} restart identity cascade`);
}

describe('la base recyclée ne fuit pas d’un cas à l’autre (#422)', () => {
  it('le cas suivant ne voit pas ce que le précédent a écrit', async () => {
    const avant = await baseAvecAppareils();
    const ecrit = await avecAppareil(avant, APPAREIL_A, () =>
      avant.query(
        `insert into public.postits (id, kind, titre, texte, version) values ('f-1', 'IP', 'Fuite', 'Texte.', 'Alpha · 0.1.2') returning id`
      )
    );
    expect(ecrit.rows).toHaveLength(1);
    await avant.close();

    const apres = await base();
    try {
      const sujets = await apres.query('select id from auth.users');
      expect(sujets.rows).toEqual([]);
      const postits = await apres.query(`select id from public.postits`);
      expect(postits.rows).toEqual([]);
    } finally {
      await apres.close();
    }
  });

  it('deux bases vivantes en même temps sont deux connexions distinctes', async () => {
    const a = await base();
    const b = await base();
    try {
      await a.query(`insert into auth.users (id, email) values ($1, 'a@exemple.test')`, [APPAREIL_A]);
      const chezB = await b.query('select id from auth.users');
      expect(chezB.rows).toEqual([]);
    } finally {
      await a.close();
      await b.close();
    }
  });

  it('une base rendue refuse d’être utilisée, au lieu de rendre les lignes du cas suivant', async () => {
    const rendue = await base();
    await rendue.close();
    expect(() => rendue.query('select 1')).toThrow(/rendue à son pool/);
  });

  it('les compteurs d’identité repartent de zéro', async () => {
    const ecrire = async (db: Base) => {
      await avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.postits (id, kind, titre, texte, version)
           values ('p-1', 'IP', 'Titre', 'Texte.', 'Alpha · 0.1.2')`
        )
      );
      return avecAppareil(db, APPAREIL_A, () =>
        db.query(`insert into public.commentaires (postit_id, texte) values ('p-1', 'Un.') returning id`)
      );
    };

    const avant = await baseAvecAppareils();
    const premier = await ecrire(avant);
    await avant.close();

    const apres = await baseAvecAppareils();
    try {
      const second = await ecrire(apres);
      expect(second.rows[0]).toEqual(premier.rows[0]);
    } finally {
      await apres.close();
    }
  });

  it('le contrôle mord : un vidage qui oublie le schéma auth laisse bien fuir', async () => {
    // Le cas fautif fabriqué : le même scénario, mais un vidage amputé de `auth`.
    const fautive = new PGlite();
    await fautive.exec(SHIM);
    await fautive.exec(migrations());
    await fautive.query(`insert into auth.users (id, email) values ($1, 'fuite@exemple.test')`, [APPAREIL_A]);
    await viderSauf(fautive, 'auth');

    const restes = await fautive.query('select id from auth.users');
    await fautive.close();
    // Une fuite **constatée** : c'est elle que `vider()` empêche, et c'est elle que ce test garde.
    expect(restes.rows).toEqual([{ id: APPAREIL_A }]);
  });

  it('le vidage couvre toutes les tables que les migrations créent', async () => {
    const db = await base();
    try {
      const { rows } = await db.query<{ nom: string }>(TABLES);
      const noms = rows.map((ligne) => ligne.nom).sort();
      // Le shim en ajoute une (`auth.users`) ; les 16 migrations, les autres. Un vidage qui
      // perdrait un schéma entier (cron, net, vault, auth) passerait sans ce décompte.
      expect(noms).toContain('auth.users');
      expect(noms).toContain('public.postits');
      expect(noms).toContain('public.comptes');
      expect(noms.filter((nom) => nom.startsWith('vault.'))).not.toHaveLength(0);
      expect(noms.filter((nom) => nom.startsWith('net.'))).not.toHaveLength(0);
      expect(noms.filter((nom) => nom.startsWith('cron.'))).not.toHaveLength(0);
    } finally {
      await db.close();
    }
  });
});
