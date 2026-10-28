// @vitest-environment node
// Lent : un cas par scénario, chacun avec son SQL ; `base()` reprend une instance PGlite vidée au lieu de la remonter (D-143 (4), #422) — il reste le travail SQL, pas la règle testée.
/**
 * Le mur s'annonce dans #comite — la migration `0013_discord_comite.sql` (#318, D-120 (2),
 * (3) et (5)), et son annonce d'arrivée remplacée par `0017_annonce_resume.sql` (#339).
 *
 * Même banc que les autres gardes de la base : **toutes** les migrations réelles, lues sur
 * disque et jouées dans PGlite (PostgreSQL en WASM, RLS comprise). Rien n'est recopié.
 *
 * Ce que le tuyau doit tenir, et que ce fichier éprouve :
 *
 *   (a) un post-it neuf produit **une** annonce — famille, titre, pseudo, **résumé**, **points**,
 *       lien (0017) ;
 *   (b) un gueulage s'annonce **sans titre, sans texte et sans résumé** (D-085) : la fuite la
 *       plus grave du flux ;
 *   (c) un vrai changement de statut s'annonce **une fois**, avec la raison d'un `écarté` ;
 *       une écriture qui nomme `statut` sans le changer, une correction de texte, un
 *       déplacement, un vote ou un commentaire n'annoncent **rien** ;
 *   (d) la phrase est composée par la base, **mot pour mot** — IP, OUF, gueulage, chaque
 *       statut, une raison très longue (tronquée) ;
 *   (e) le transport est **une seule couture** (`poster_discord(url, corps)`), remplacée par
 *       un faux : aucun test ne parle à Discord, et le vrai `net.http_post` n'est appelé qu'ici ;
 *   (f) « remis » ≠ « livré » : 2xx livre, non-2xx ramène en attente, la 5ᵉ abandonne, un
 *       silence d'un quart d'heure compte comme un échec ;
 *   (g) dix par passe, dans l'ordre : vingt-cinq annonces se vident en trois passes ;
 *   (h) le webhook vient de **Vault** : sans secret, rien n'est remis ni marqué livré ;
 *   (i) à l'installation, le passé est `sans_webhook` — il ne déferle pas dans le salon ;
 *   (j) `anon` et `authenticated` n'ont **aucun** privilège sur la table.
 *
 * **Le contrôle mord** (#112) : la migration est relue, un motif est remplacé, puis rejouée —
 * le déclencheur neutralisé doit produire le **doublon**, la condition à `true` la **fuite**,
 * et le plafond retiré la **rafale**. Les motifs sont des ancres : si la migration change de
 * forme, la mutation échoue bruyamment au lieu de se décaler en silence. Depuis #339, les
 * mutations du **résumé** visent `0017` : c'est elle qui compose la phrase d'arrivée.
 */
import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  APPAREIL_A,
  APPAREIL_B,
  avecAppareil,
  base,
  creerCompte,
  fichiersMigrations,
  type Base
} from './pglite';

const MIGRATION_DISCORD = fichiersMigrations().find(
  (sql) => sql.includes('poster_discord') && sql.includes('annonces_discord')
);
if (!MIGRATION_DISCORD) throw new Error('supabase/migrations/0013_discord_comite.sql introuvable');

/** `0017_annonce_resume.sql` : elle remplace la phrase d'arrivée, résumé et points compris. */
const MIGRATION_RESUME = fichiersMigrations().find((sql) => sql.includes('public.resume_postit'));
if (!MIGRATION_RESUME) throw new Error('supabase/migrations/0017_annonce_resume.sql introuvable');

/** Les migrations **avant** celle-ci : l'état du mur le jour de l'installation. */
const AVANT_DISCORD = fichiersMigrations().filter((sql) => sql !== MIGRATION_DISCORD && sql !== MIGRATION_RESUME);

const URL_WEBHOOK = 'https://discord.test/api/webhooks/1/jeton-de-test';
const LIEN = 'https://planquex.4k7.org/comite';
const VERSION = 'Alpha · 0.1.13';

/* -------------------------------------------------------------------------------------------
 * Le banc : des comptes, un secret, et un faux à la couture
 * ---------------------------------------------------------------------------------------- */

/** Le monde de la garde : A et B approuvés, un administrateur. */
async function monde(db: Base): Promise<void> {
  await creerCompte(db, APPAREIL_A, { etat: 'approuve' });
  await creerCompte(db, APPAREIL_B, { etat: 'approuve' });
  await creerCompte(db, ADMIN, { etat: 'approuve', administrateur: true });
}

/** Le webhook vit dans Vault (D-120 (3)) : le test le pose là, et jamais ailleurs. */
async function poserWebhook(db: Base, url: string = URL_WEBHOOK): Promise<void> {
  await db.query(`select vault.create_secret($1, 'discord_webhook_comite')`, [url]);
}

/**
 * **Le faux de la couture** (D-120 (5)). Il remplace `public.poster_discord` et note chaque
 * appel : à partir d'ici, le vrai `net.http_post` n'est plus joignable, donc le test ne peut
 * pas parler à Discord même s'il le voulait.
 */
async function poserLEspion(db: Base): Promise<void> {
  await db.exec(`
    create table if not exists public.discord_espion (
      id      bigserial primary key,
      url     text not null,
      corps   jsonb not null,
      cree_le timestamptz not null default now()
    );
    create or replace function public.poster_discord(p_url text, p_corps jsonb)
      returns bigint language plpgsql as $espion$
    declare
      v_id bigint;
    begin
      insert into public.discord_espion (url, corps) values (p_url, p_corps) returning id into v_id;
      return v_id;
    end;
    $espion$;
  `);
}

async function aPoste(db: Base, titre: string, options: { pseudo?: string; gueulage?: boolean } = {}): Promise<void> {
  await avecAppareil(db, APPAREIL_A, () =>
    db.query(
      `insert into public.postits (id, kind, titre, texte, version, pseudo, gueulage)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `p-${Math.random().toString(36).slice(2, 10)}`,
        options.gueulage ? null : 'IP',
        titre,
        options.gueulage ? `Texte secret du gueulage « ${titre} ».` : `Texte du post-it « ${titre} ».`,
        VERSION,
        options.pseudo ?? 'Nora',
        options.gueulage ?? false
      ]
    )
  );
}

/** Un post-it posé par A, dont on connaît l'identifiant — pour le tri et les annonces. */
async function coller(db: Base, id: string, titre: string, gueulage = false): Promise<void> {
  await collerTexte(
    db,
    id,
    titre,
    gueulage ? 'Ce que je pense de la direction.' : `Texte du post-it « ${titre} ».`,
    gueulage
  );
}

/**
 * Un post-it posé par A, avec **son** texte : c'est lui que la 0017 résume (#339). Le texte
 * d'un gueulage ne sort jamais, mais il est posé là pour que la fuite soit constatable.
 */
async function collerTexte(db: Base, id: string, titre: string, texte: string, gueulage = false): Promise<void> {
  await avecAppareil(db, APPAREIL_A, () =>
    db.query(
      `insert into public.postits (id, kind, titre, texte, version, pseudo, gueulage)
       values ($1, $2, $3, $4, $5, 'Nora', $6)`,
      [id, gueulage ? null : 'IP', titre, texte, VERSION, gueulage]
    )
  );
}

const trier = (db: Base, postit: string, statut: string, raison = '') =>
  avecAppareil(db, ADMIN, () =>
    db.query(`update public.postits set statut = $2, raison = $3 where id = $1`, [postit, statut, raison])
  );

type Annonce = {
  id: number;
  postit_id: string;
  type: string;
  etat: string;
  tentatives: number;
  requete_id: string | null;
  corps: { content: string; allowed_mentions?: { parse: unknown } } | null;
  derniere_erreur: string | null;
};

const annonces = async (db: Base): Promise<Annonce[]> =>
  (await db.query<Annonce>(`select * from public.annonces_discord order by id`)).rows;

const contenu = (annonce: Annonce): string => annonce.corps?.content ?? '';

/** La passe d'envoi — ce que `pg_cron` appelle toutes les minutes. */
const envoyer = async (db: Base): Promise<number> =>
  (await db.query<{ partis: number }>(`select public.envoyer_annonces_discord() as partis`)).rows[0].partis;

/** Ce que le faux de la couture a vu passer, dans l'ordre. */
const appels = async (db: Base): Promise<Array<{ url: string; corps: { content: string } }>> =>
  (
    await db.query<{ url: string; corps: { content: string } }>(
      `select url, corps from public.discord_espion order by id`
    )
  ).rows;

/** La réponse que `pg_net` déposerait plus tard, pour la requête `id`. */
const repondre = (db: Base, id: number | string, status: number | null, options: { muet?: boolean } = {}) =>
  db.query(`insert into net._http_response (id, status_code, content, timed_out) values ($1, $2, '', $3)`, [
    id,
    options.muet ? null : status,
    options.muet ?? false
  ]);

/* -------------------------------------------------------------------------------------------
 * (a) (b) (c) (d) — ce qui annonce, et la phrase, mot pour mot
 * ---------------------------------------------------------------------------------------- */

describe('ce qui annonce (0013)', () => {
  it('(a) un post-it neuf : famille, titre, pseudo, résumé, lien — et aucune donnée de compte', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-neuf', 'Le bouton ne répond pas');

      const lignes = await annonces(db);
      expect(lignes).toHaveLength(1);
      expect(lignes[0].type).toBe('postit');
      expect(lignes[0].etat).toBe('en attente');
      expect(contenu(lignes[0])).toBe(
        `Nouveau post-it IP — « Le bouton ne répond pas » (Nora) · ${LIEN}\nTexte du post-it « Le bouton ne répond pas ».`
      );

      // D-120 (2) : le pseudo est la seule identité admise — ni `auteur`, ni courriel, ni id.
      const brut = JSON.stringify(lignes[0].corps);
      expect(brut).not.toContain(APPAREIL_A);
      expect(brut).not.toContain('@exemple.test');
      // Aucune mention interprétable : un titre qui contient « @everyone » reste du texte.
      expect(lignes[0].corps?.allowed_mentions).toEqual({ parse: [] });
    } finally {
      await db.close();
    }
  });

  it('(a) un OUF porte sa famille', async () => {
    const db = await base();
    try {
      await monde(db);
      await avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `insert into public.postits (id, kind, titre, texte, version, pseudo)
           values ('p-ouf', 'OUF', 'Le deck perd une carte', 'Texte.', 'Alpha · 0.1.13', 'Nora')`
        )
      );
      expect(contenu((await annonces(db))[0])).toBe(
        `Nouveau post-it OUF — « Le deck perd une carte » (Nora) · ${LIEN}\nTexte.`
      );
    } finally {
      await db.close();
    }
  });

  it('(b) un gueulage s’annonce sans titre et sans texte (D-085)', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-gueulage', 'Marre de tout', true);

      const lignes = await annonces(db);
      expect(lignes).toHaveLength(1);
      expect(contenu(lignes[0])).toBe(`Un gueulage vient d’arriver sur le mur (Nora) · ${LIEN}`);

      // La fuite qu'on ne veut pas : ni le titre ni le texte, et pas même la famille (nulle).
      expect(contenu(lignes[0])).not.toContain('Marre de tout');
      expect(contenu(lignes[0])).not.toContain('direction');
    } finally {
      await db.close();
    }
  });

  it('(d) chaque statut a sa phrase, et un écarté porte sa raison tronquée', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-statut', 'Le bouton ne répond pas');

      for (const statut of ['retenu', 'en cours', 'fait']) {
        await trier(db, 'p-statut', statut);
      }
      await trier(db, 'p-statut', 'écarté', 'Doublon avec le post-it qui parle du même bouton.');

      const statuts = (await annonces(db)).filter((ligne) => ligne.type === 'statut');
      expect(statuts.map(contenu)).toEqual([
        `Post-it « Le bouton ne répond pas » (Nora) : retenu · ${LIEN}`,
        `Post-it « Le bouton ne répond pas » (Nora) : en cours · ${LIEN}`,
        `Post-it « Le bouton ne répond pas » (Nora) : fait · ${LIEN}`,
        `Post-it « Le bouton ne répond pas » (Nora) : écarté — Doublon avec le post-it qui parle du même bouton. · ${LIEN}`
      ]);
    } finally {
      await db.close();
    }
  });

  it('(d) une raison très longue est tronquée, et l’annonce tient dans le salon', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-long', 'Le bouton ne répond pas');
      const raison = `${'Parce que. '.repeat(120)}Fin.`;
      await trier(db, 'p-long', 'écarté', raison);

      const phrase = contenu((await annonces(db)).find((ligne) => ligne.type === 'statut')!);
      // La limite du salon est de 2 000 caractères (docs/INTEGRATIONS-DISCORD.md §9).
      expect(phrase.length).toBeLessThanOrEqual(2000);
      expect(phrase).toContain('… · ' + LIEN);
      expect(phrase).not.toContain('Fin.');
      // Le début de la raison est là : on n'a pas coupé avant elle.
      expect(phrase).toContain(': écarté — Parce que. Parce que.');
    } finally {
      await db.close();
    }
  });

  it('(d) un titre très long ne fait pas déborder l’annonce', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-titre', 'T'.repeat(900));
      const phrase = contenu((await annonces(db))[0]);
      expect(phrase.length).toBeLessThanOrEqual(2000);
      expect(phrase).toContain('T…');
    } finally {
      await db.close();
    }
  });

  it('(c) un changement de statut s’annonce une fois, et une seule', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-fois', 'Le bouton ne répond pas');
      await trier(db, 'p-fois', 'retenu');

      expect((await annonces(db)).filter((ligne) => ligne.type === 'statut')).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it('(c) rien d’autre n’annonce : statut réécrit, texte, place, vote, commentaire', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-rien', 'Le bouton ne répond pas');
      const avant = (await annonces(db)).length;

      // 1. une écriture qui **nomme** `statut` sans le changer (le tri qui réécrit le même)
      await trier(db, 'p-rien', 'en attente');
      // 2. une correction de texte, par son auteur (0006)
      await avecAppareil(db, APPAREIL_A, () =>
        db.query(`select public.corriger_postit('p-rien', 'Le bouton ne répond pas', 'Texte corrigé.')`)
      );
      // 3. un déplacement (0007)
      await avecAppareil(db, APPAREIL_A, () =>
        db.query(
          `select public.deplacer_postit('p-rien', 10::double precision, 20::double precision, 0::double precision)`
        )
      );
      // 4. un vote, 5. un commentaire — d'autres tables, donc aucun déclencheur
      await avecAppareil(db, APPAREIL_B, () =>
        db.query(`insert into public.votes (postit_id, sens) values ('p-rien', 'up')`)
      );
      await avecAppareil(db, APPAREIL_B, () =>
        db.query(`insert into public.commentaires (postit_id, texte) values ('p-rien', 'Pareil chez moi.')`)
      );

      expect(await annonces(db)).toHaveLength(avant);
    } finally {
      await db.close();
    }
  });

  it('(c) un retour à `en attente` (le tri qui se ravise) n’annonce pas', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-retour', 'Le bouton ne répond pas');
      await trier(db, 'p-retour', 'retenu');
      await trier(db, 'p-retour', 'en attente');

      const statuts = (await annonces(db)).filter((ligne) => ligne.type === 'statut');
      expect(statuts.map(contenu)).toEqual([`Post-it « Le bouton ne répond pas » (Nora) : retenu · ${LIEN}`]);
    } finally {
      await db.close();
    }
  });
});

/* -------------------------------------------------------------------------------------------
 * (d) — le résumé et les points de l'annonce d'arrivée (0017, #339)
 * ---------------------------------------------------------------------------------------- */

/** La phrase d'un post-it posé avec ce texte, telle que la base la compose. */
async function phraseAvecTexte(texte: string, titre = 'Le bouton ne répond pas'): Promise<string> {
  const db = await base();
  try {
    await monde(db);
    await collerTexte(db, 'p-texte', titre, texte);
    return contenu((await annonces(db))[0]);
  } finally {
    await db.close();
  }
}

const ENTETE = (titre = 'Le bouton ne répond pas', famille = 'IP') =>
  `Nouveau post-it ${famille} — « ${titre} » (Nora) · ${LIEN}`;

describe('l’annonce porte le résumé et les points (0017, #339)', () => {
  it('un post-it sans puce n’annonce que son résumé', async () => {
    const phrase = await phraseAvecTexte(
      'Le bouton ne répond pas depuis hier.\n\nLe détail du second paragraphe ne part pas.'
    );

    expect(phrase).toBe(`${ENTETE()}\nLe bouton ne répond pas depuis hier.`);
    // Le second paragraphe reste sur le mur : le salon est un rappel, pas une copie.
    expect(phrase).not.toContain('second paragraphe');
  });

  it('un post-it à puces annonce son résumé puis ses points, marqueurs retirés', async () => {
    const phrase = await phraseAvecTexte(
      [
        'Trois choses sur le comité.',
        '',
        '- le bouton gris',
        '* le compteur figé',
        '• la pastille qui ne s’éteint plus',
        '→ le tri qui saute',
        '5. la cinquième puce, qui ne part pas'
      ].join('\n')
    );

    expect(phrase).toBe(
      `${ENTETE()}\nTrois choses sur le comité.\n• le bouton gris\n• le compteur figé\n• la pastille qui ne s’éteint plus\n• le tri qui saute`
    );
    // **Quatre au plus** : la cinquième reste sur le mur.
    expect(phrase).not.toContain('cinquième puce');
    // Les marqueurs d'origine ne survivent pas dans la phrase.
    expect(phrase).not.toContain('- le bouton');
    expect(phrase).not.toContain('5.');
  });

  it('un texte long est tronqué proprement : résumé à 200, puce à 100', async () => {
    const phrase = await phraseAvecTexte(`${'A'.repeat(500)}\n\n- ${'B'.repeat(300)}`);
    const [, resume, puce] = phrase.split('\n');

    expect(resume).toBe(`${'A'.repeat(199)}…`);
    expect(resume).toHaveLength(200);
    expect(puce).toBe(`• ${'B'.repeat(99)}…`);
    expect(puce).toHaveLength(102);
    // La limite du salon est de 2 000 caractères (docs/INTEGRATIONS-DISCORD.md §9).
    expect(phrase.length).toBeLessThanOrEqual(2000);
  });

  it('un gueulage ne laisse sortir ni titre, ni texte, ni résumé, ni puce (D-085)', async () => {
    const db = await base();
    try {
      await monde(db);
      await collerTexte(
        db,
        'p-gueulage-muet',
        'Marre de tout',
        'Ce que je pense de la direction.\n\n- la réunion de trop\n- le mail de trop',
        true
      );

      const phrase = contenu((await annonces(db))[0]);
      expect(phrase).toBe(`Un gueulage vient d’arriver sur le mur (Nora) · ${LIEN}`);
      for (const fuite of ['Marre de tout', 'direction', 'réunion', '•']) {
        expect(phrase, `le gueulage laisse fuir « ${fuite} »`).not.toContain(fuite);
      }
    } finally {
      await db.close();
    }
  });

  it('un texte vide ne casse pas l’annonce : l’en-tête et le lien, rien de plus', async () => {
    const db = await base();
    try {
      // Le repli est éprouvé **sur la fonction** : la base refuse un post-it au texte vide
      // (contrainte `texte` de 0001), donc le cas ne peut pas venir d'une ligne réelle.
      for (const vide of ['', '   ', '\n\n', '  \n  \n  ']) {
        const phrase = (
          await db.query<{ phrase: string }>(
            `select public.phrase_postit_neuf('IP', false, 'Le bouton ne répond pas', 'Nora', $1) as phrase`,
            [vide]
          )
        ).rows[0].phrase;
        expect(phrase, `repli pour ${JSON.stringify(vide)}`).toBe(ENTETE());
      }
    } finally {
      await db.close();
    }
  });

  it('0017 remplace la signature à quatre arguments au lieu d’en ajouter une', async () => {
    const db = await base();
    try {
      const signatures = (
        await db.query<{ signature: string }>(
          `select oid::regprocedure::text as signature from pg_proc where proname = 'phrase_postit_neuf'`
        )
      ).rows.map((ligne) => ligne.signature);

      expect(signatures).toEqual(['phrase_postit_neuf(text,boolean,text,text,text)']);
    } finally {
      await db.close();
    }
  });
});

/* -------------------------------------------------------------------------------------------
 * (e) — une seule couture, un faux, et le vrai `net.http_post` jamais appelé
 * ---------------------------------------------------------------------------------------- */

describe('le transport est une seule couture (0013)', () => {
  it('(e) `net.http_post` n’apparaît qu’une fois dans la migration, dans `poster_discord`', () => {
    // Les commentaires (et les `comment on`) parlent de la couture sans l'être : on ne compte
    // que les **appels**, c'est-à-dire les occurrences suivies d'une parenthèse.
    const code = MIGRATION_DISCORD.split('\n')
      .filter((ligne) => !ligne.trim().startsWith('--') && !ligne.trim().startsWith('comment on'))
      .join('\n');

    const appels = code.match(/net\.http_post\(/g) ?? [];
    expect(appels, 'la couture est le seul appel à pg_net').toHaveLength(1);

    const corps = code.slice(
      code.indexOf('create or replace function public.poster_discord'),
      code.indexOf('create or replace function public.reconcilier_annonces_discord')
    );
    expect(corps).toContain('net.http_post(');
  });

  it('(e) le faux reçoit l’URL de Vault et le corps composé, et `pg_net` n’est pas appelé', async () => {
    const db = await base();
    try {
      await monde(db);
      await poserWebhook(db);
      await poserLEspion(db);
      await coller(db, 'p-couture', 'Le bouton ne répond pas');

      expect(await envoyer(db)).toBe(1);

      const vus = await appels(db);
      expect(vus).toHaveLength(1);
      expect(vus[0].url).toBe(URL_WEBHOOK);
      expect(vus[0].corps.content).toBe(
        `Nouveau post-it IP — « Le bouton ne répond pas » (Nora) · ${LIEN}\nTexte du post-it « Le bouton ne répond pas ».`
      );

      // Le vrai transport n'a pas été touché : le test ne parle pas à Discord.
      const requetes = await db.query(`select count(*)::int as n from net._http_request`);
      expect((requetes.rows[0] as { n: number }).n).toBe(0);
    } finally {
      await db.close();
    }
  });

  it('(h) sans secret dans Vault, rien n’est remis ni marqué livré', async () => {
    const db = await base();
    try {
      await monde(db);
      await poserLEspion(db);
      await coller(db, 'p-sans-secret', 'Le bouton ne répond pas');

      expect(await envoyer(db)).toBe(0);
      expect(await appels(db)).toHaveLength(0);

      const [ligne] = await annonces(db);
      expect(ligne.etat).toBe('en attente');
      expect(ligne.tentatives).toBe(0);
      expect(ligne.requete_id).toBeNull();
      expect(ligne.livre_le ?? null).toBeNull();
    } finally {
      await db.close();
    }
  });
});

/* -------------------------------------------------------------------------------------------
 * (f) (g) — « remis » n'est pas « livré », et dix par passe
 * ---------------------------------------------------------------------------------------- */

describe('remis n’est pas livré (0013)', () => {
  it('(f) une réponse 2xx livre la ligne', async () => {
    const db = await base();
    try {
      await monde(db);
      await poserWebhook(db);
      await poserLEspion(db);
      await coller(db, 'p-livre', 'Le bouton ne répond pas');

      await envoyer(db);
      let [ligne] = await annonces(db);
      expect(ligne.etat).toBe('remis');
      expect(ligne.tentatives).toBe(1);
      expect(ligne.livre_le ?? null).toBeNull();

      await repondre(db, ligne.requete_id!, 204);
      await envoyer(db);

      [ligne] = await annonces(db);
      expect(ligne.etat).toBe('livre');
      expect(ligne.livre_le).not.toBeNull();
    } finally {
      await db.close();
    }
  });

  it('(f) un non-2xx garde la ligne et incrémente les tentatives ; la cinquième abandonne', async () => {
    const db = await base();
    try {
      await monde(db);
      await poserWebhook(db);
      await poserLEspion(db);
      await coller(db, 'p-echec', 'Le bouton ne répond pas');

      // La passe réconcilie **puis** renvoie : chaque tour est un essai de plus.
      expect(await envoyer(db)).toBe(1);
      let [ligne] = await annonces(db);
      expect(ligne.etat).toBe('remis');
      expect(ligne.tentatives).toBe(1);

      for (let essai = 1; essai <= 4; essai += 1) {
        await repondre(db, ligne.requete_id!, 500);
        expect(await envoyer(db), `renvoi après l’échec ${essai}`).toBe(1);
        [ligne] = await annonces(db);
        expect(ligne.tentatives, `tentatives après l’échec ${essai}`).toBe(essai + 1);
        expect(ligne.etat).toBe('remis');
      }

      // Cinquième échec : la ligne est abandonnée, et la passe ne renvoie plus rien.
      await repondre(db, ligne.requete_id!, 500);
      expect(await envoyer(db)).toBe(0);

      [ligne] = await annonces(db);
      expect(ligne.etat).toBe('abandonne');
      expect(ligne.tentatives).toBe(5);
      expect(ligne.derniere_erreur).toContain('HTTP 500');

      // La sixième passe ne reprend rien : la ligne est sortie de la file.
      expect(await envoyer(db)).toBe(0);
      expect(await appels(db)).toHaveLength(5);
    } finally {
      await db.close();
    }
  });

  it('(f) un envoi sans réponse au bout d’un quart d’heure compte comme un échec', async () => {
    const db = await base();
    try {
      await monde(db);
      await poserWebhook(db);
      await poserLEspion(db);
      await coller(db, 'p-muet', 'Le bouton ne répond pas');

      await envoyer(db);
      // Cinq minutes plus tard, on attend encore : `pg_net` dépose, Discord peut tarder.
      await db.query(`update public.annonces_discord set remis_le = now() - interval '5 minutes'`);
      expect(await envoyer(db), 'sous le quart d’heure, on ne renvoie pas').toBe(0);
      expect((await annonces(db))[0].etat).toBe('remis');

      // Seize minutes plus tard, le silence est un échec : la ligne revient dans la file et
      // repart dans la même passe, avec une tentative de plus et l'erreur nommée.
      await db.query(`update public.annonces_discord set remis_le = now() - interval '16 minutes'`);
      expect(await envoyer(db)).toBe(1);

      const [ligne] = await annonces(db);
      expect(ligne.etat).toBe('remis');
      expect(ligne.tentatives).toBe(2);
      expect(ligne.derniere_erreur).toContain('quart d’heure');
    } finally {
      await db.close();
    }
  });

  it('(g) dix par passe, dans l’ordre : vingt-cinq annonces se vident en trois passes', async () => {
    const db = await base();
    try {
      await monde(db);
      await poserWebhook(db);
      await poserLEspion(db);
      for (let n = 1; n <= 25; n += 1) {
        await coller(db, `p-${String(n).padStart(2, '0')}`, `Titre ${String(n).padStart(2, '0')}`);
      }

      expect(await envoyer(db)).toBe(10);
      expect(await envoyer(db)).toBe(10);
      expect(await envoyer(db)).toBe(5);
      expect(await envoyer(db)).toBe(0);

      const vus = (await appels(db)).map((appel) => appel.corps.content);
      expect(vus).toHaveLength(25);
      expect(vus[0]).toContain('Titre 01');
      expect(vus[9]).toContain('Titre 10');
      expect(vus[10]).toContain('Titre 11');
      expect(vus[24]).toContain('Titre 25');
      expect(new Set(vus).size).toBe(25);
    } finally {
      await db.close();
    }
  });
});

/* -------------------------------------------------------------------------------------------
 * (i) (j) — le passé, la cadence, et les privilèges client
 * ---------------------------------------------------------------------------------------- */

describe('l’installation se tait sur le passé, et la table est fermée (0013)', () => {
  it('(i) les post-its d’avant la migration sont marqués `sans_webhook` et ne partent pas', async () => {
    const db = await base(AVANT_DISCORD.join('\n'));
    try {
      await monde(db);
      await coller(db, 'p-ancien', 'Un vieux post-it du mur');

      // Le jour de l'installation : la migration arrive sur un mur déjà rempli.
      await db.exec(MIGRATION_DISCORD);
      await db.exec(MIGRATION_RESUME);

      const anciennes = await annonces(db);
      expect(anciennes).toHaveLength(1);
      expect(anciennes[0].etat).toBe('sans_webhook');
      expect(anciennes[0].corps).toBeNull();

      // Le salon ne reçoit pas l'historique.
      await poserWebhook(db);
      await poserLEspion(db);
      expect(await envoyer(db)).toBe(0);
      expect(await appels(db)).toHaveLength(0);

      // … mais ce qui arrive **après** s'annonce normalement.
      await coller(db, 'p-neuf-apres', 'Le bouton ne répond pas');
      expect(await envoyer(db)).toBe(1);
    } finally {
      await db.close();
    }
  });

  it('la migration est rejouable, et ne reprogramme pas le job', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-rejoue', 'Le bouton ne répond pas');
      const avant = await annonces(db);

      await db.exec(MIGRATION_DISCORD);
      await db.exec(MIGRATION_RESUME);

      expect(await annonces(db)).toHaveLength(avant.length);
      const jobs = await db.query<{ jobname: string; schedule: string; command: string }>(
        `select jobname, schedule, command from cron.job`
      );
      expect(jobs.rows).toHaveLength(1);
      expect(jobs.rows[0].jobname).toBe('annonces_discord');
      expect(jobs.rows[0].schedule).toBe('* * * * *');
      expect(jobs.rows[0].command).toContain('public.envoyer_annonces_discord()');
    } finally {
      await db.close();
    }
  });

  it('(j) ni `authenticated` ni `anon` ne lisent ou n’écrivent la table', async () => {
    const db = await base();
    try {
      await monde(db);
      await coller(db, 'p-ferme', 'Le bouton ne répond pas');

      expect(await refus(db, APPAREIL_A, `select * from public.annonces_discord`)).toMatch(/permission denied/i);
      expect(
        await refus(
          db,
          APPAREIL_A,
          `insert into public.annonces_discord (postit_id, type, corps) values ('p-ferme', 'postit', '{}'::jsonb)`
        )
      ).toMatch(/permission denied/i);

      // `anon` n'a même pas le rôle pour essayer : le refus est le même, et il est nommé.
      await db.exec(`set role anon;`);
      try {
        await expect(db.query(`select * from public.annonces_discord`)).rejects.toThrow(/permission denied/i);
      } finally {
        await db.exec(`reset role;`);
      }

      // Et les fonctions du tuyau ne sont pas des points d'entrée clients.
      expect(await refus(db, APPAREIL_A, `select public.envoyer_annonces_discord()`)).toMatch(/permission denied/i);
      expect(await refus(db, APPAREIL_A, `select public.discord_webhook()`)).toMatch(/permission denied/i);
    } finally {
      await db.close();
    }
  });
});

/** Un geste refusé, ou le message vide si la base l'a laissé passer. */
async function refus(db: Base, appareil: string, sql: string): Promise<string> {
  try {
    await avecAppareil(db, appareil, () => db.query(sql));
    return 'accepté';
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : String(erreur);
  }
}

/* -------------------------------------------------------------------------------------------
 * Le contrôle mord — la migration mutée doit laisser voir le défaut
 * ---------------------------------------------------------------------------------------- */

/** Rejoue **toutes** les migrations, celle du Discord **mutée** : c'est le contrôle qui mord. */
async function baseMutee(motif: string, remplacement: string): Promise<Base> {
  return baseMuteeDans(MIGRATION_DISCORD, motif, remplacement);
}

/**
 * La même chose, sur **une** migration nommée : depuis #339, ce qui compose la phrase
 * d'arrivée n'est plus dans 0013 mais dans 0017, et muter la mauvaise ne prouverait rien.
 */
async function baseMuteeDans(
  migration: string,
  motif: string,
  remplacement: string,
  options: { tous?: boolean } = {}
): Promise<Base> {
  const mutee = options.tous ? migration.replaceAll(motif, remplacement) : migration.replace(motif, remplacement);
  if (mutee === migration) {
    throw new Error(`mutation sans effet — le motif n’est plus dans la migration : ${motif}`);
  }
  return base(
    fichiersMigrations()
      .map((sql) => (sql === migration ? mutee : sql))
      .join('\n')
  );
}

describe('le contrôle mord : la migration mutée laisse voir le défaut', () => {
  it('déclencheur de statut neutralisé → le même statut réécrit produit un doublon', async () => {
    const db = await baseMutee('if new.statut is not distinct from old.statut then', 'if false then');
    try {
      await monde(db);
      await coller(db, 'p-doublon', 'Le bouton ne répond pas');
      await trier(db, 'p-doublon', 'retenu');
      await trier(db, 'p-doublon', 'retenu');

      const statuts = (await annonces(db)).filter((ligne) => ligne.type === 'statut');
      expect(statuts, 'la mutation doit produire le doublon').toHaveLength(2);
    } finally {
      await db.close();
    }
  });

  it('condition des quatre statuts à `true` → un retour à `en attente` s’annonce', async () => {
    const db = await baseMutee(`if new.statut not in ('retenu', 'en cours', 'fait', 'écarté') then`, 'if false then');
    try {
      await monde(db);
      await coller(db, 'p-brouillon', 'Le bouton ne répond pas');
      await trier(db, 'p-brouillon', 'retenu');
      await trier(db, 'p-brouillon', 'en attente');

      const statuts = (await annonces(db)).filter((ligne) => ligne.type === 'statut');
      expect(statuts.map(contenu)).toContain(`Post-it « Le bouton ne répond pas » (Nora) : en attente · ${LIEN}`);
    } finally {
      await db.close();
    }
  });

  it('branche du gueulage à `false` → le titre et le texte du gueulage fuient dans le salon', async () => {
    const db = await baseMuteeDans(MIGRATION_RESUME, 'when coalesce(p_gueulage, false) then', 'when false then');
    try {
      await monde(db);
      await coller(db, 'p-fuite', 'Marre de tout', true);

      const phrase = contenu((await annonces(db))[0]);
      expect(phrase, 'la mutation doit laisser fuir le titre').toContain('Marre de tout');
      expect(phrase, 'la mutation doit laisser fuir le texte').toContain('direction');
    } finally {
      await db.close();
    }
  });

  it('plafond retiré → vingt-cinq annonces partent en une seule passe', async () => {
    const db = await baseMutee('limit 10', 'limit 1000');
    try {
      await monde(db);
      await poserWebhook(db);
      await poserLEspion(db);
      for (let n = 1; n <= 25; n += 1) await coller(db, `p-${n}`, `Titre ${n}`);

      expect(await envoyer(db), 'la mutation doit produire la rafale').toBe(25);
    } finally {
      await db.close();
    }
  });

  it('revoke retiré → `authenticated` lit la file des annonces', async () => {
    const db = await baseMutee(
      'revoke all on table public.annonces_discord from public, anon, authenticated;',
      'select 1;'
    );
    try {
      await monde(db);
      await coller(db, 'p-fuite-droits', 'Le bouton ne répond pas');

      const issue = await refus(db, APPAREIL_A, `select count(*) from public.annonces_discord`);
      expect(issue, 'la mutation doit laisser fuir la file').toBe('accepté');
    } finally {
      await db.close();
    }
  });

  it('troncature du résumé retirée → le salon reçoit les 500 caractères du texte', async () => {
    const db = await baseMuteeDans(
      MIGRATION_RESUME,
      'public.resume_postit(p_texte, 200)',
      'public.resume_postit(p_texte, 5000)',
      {
        tous: true
      }
    );
    try {
      await monde(db);
      await collerTexte(db, 'p-sans-troncature', 'Le bouton ne répond pas', 'A'.repeat(500));

      const resume = contenu((await annonces(db))[0]).split('\n')[1];
      expect(resume, 'la mutation doit laisser déborder le résumé').toHaveLength(500);
      expect(resume).not.toContain('…');
    } finally {
      await db.close();
    }
  });

  it('plafond des points retiré → les dix puces partent dans le salon', async () => {
    const db = await baseMuteeDans(MIGRATION_RESUME, 'limit p_max_points', 'limit 100');
    try {
      await monde(db);
      const texte = ['Un post-it à dix puces.', '', ...Array.from({ length: 10 }, (_, i) => `- puce ${i + 1}`)].join(
        '\n'
      );
      await collerTexte(db, 'p-dix-puces', 'Le bouton ne répond pas', texte);

      const puces = contenu((await annonces(db))[0])
        .split('\n')
        .filter((ligne) => ligne.startsWith('• '));
      expect(puces, 'la mutation doit produire les dix puces').toHaveLength(10);
    } finally {
      await db.close();
    }
  });
});
