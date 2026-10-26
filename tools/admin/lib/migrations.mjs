/**
 * Le registre des migrations du poste de pilotage (#184) — `admin.migrations`.
 *
 * Il vit **hors du schéma du jeu** : un schéma `admin`, distinct de `public`, que reprendront
 * les migrations du dépôt. Une ligne par **fichier** de `supabase/migrations/`, son **empreinte
 * sha256**, son **origine** et la date d'inscription. C'est ce qui permet au poste de répondre
 * « déjà appliquée » ou « empreinte changée » au lieu de rejouer une migration par erreur (la
 * cause de l'incident « relation "combats" already exists » du 23/10, écrit dans la spec #183).
 *
 * **`origine`** (#224) : `registre` pour une migration appliquée **par** le poste, `anterieure`
 * pour celles qui l'étaient **avant** que le registre existe (0001-0006, inscrites le
 * 26/10/2026). Pour ces dernières, l'empreinte est celle du fichier au moment du rétablissement
 * — pas une preuve de ce qui a été joué —, `applique_le` est la date d'inscription, et l'état
 * rendu est `anterieure` : jamais « manquante », jamais reproposée, jamais rejouée.
 *
 * Contrairement aux migrations elles-mêmes, ceci **n'est pas** un fichier de `supabase/migrations/` :
 * les tests du jeu rejouent ce dossier dans `pglite` (voir `supabase/pglite.ts`), et une table
 * de registre n'a rien à y faire. Le poste l'applique à son démarrage, de façon idempotente.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Le schéma et la table du registre, créés à l'identique d'un geste de « base neuve ». */
export const SQL_REGISTRE = `
create schema if not exists admin;
create table if not exists admin.migrations (
  fichier     text        primary key,
  empreinte   text        not null,
  -- « registre » : appliquée par le poste, empreinte comparée à chaque lecture.
  -- « anterieure » : appliquée avant que le registre existe (0001-0006, 25/10/2026) —
  -- l'empreinte est celle du fichier au moment du rétablissement, pas une preuve.
  origine     text        not null default 'registre',
  applique_le timestamptz not null default now(),
  constraint migrations_origine check (origine in ('registre', 'anterieure'))
);
-- Une base où le registre existe déjà (créé avant la colonne) suit sans erreur.
alter table admin.migrations add column if not exists origine text not null default 'registre';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'migrations_origine') then
    alter table admin.migrations
      add constraint migrations_origine check (origine in ('registre', 'anterieure'));
  end if;
end $$;`;

/** L'empreinte d'un fichier de migration : le contenu, pas le nom. */
export function empreinte(contenu) {
  return createHash('sha256').update(contenu, 'utf8').digest('hex');
}

/** Les fichiers `.sql` du dossier, dans l'ordre de leur nom (le même tri que `pglite.ts`). */
export function fichiersMigrations(dossier) {
  return readdirSync(dossier)
    .filter((nom) => nom.endsWith('.sql'))
    .sort();
}

/** Pose le schéma `admin` et sa table de registre quand ils manquent (idempotent). */
export async function initialiserRegistre(adapter) {
  await adapter.ecrire(SQL_REGISTRE);
}

/** Une ligne du registre, vue du poste. */
async function registre(adapter) {
  const lu = await adapter.lire(
    'select fichier, empreinte, origine, applique_le from admin.migrations order by fichier',
  );
  return new Map(
    lu.rows.map((ligne) => [
      String(ligne.fichier),
      {
        empreinte: String(ligne.empreinte),
        origine: String(ligne.origine ?? 'registre'),
        applique_le: ligne.applique_le,
      },
    ]),
  );
}

/**
 * L'état de chaque migration du dépôt, comparée au registre :
 *   - `manquante` : pas encore appliquée ;
 *   - `appliquee` : appliquée, et son empreinte correspond ;
 *   - `empreinte-changee` : appliquée, puis le fichier a été **réécrit** — signalée, jamais rejouée.
 */
export async function listerMigrations(adapter, dossier) {
  const appliquees = await registre(adapter);
  return fichiersMigrations(dossier).map((nom) => {
    const contenu = readFileSync(join(dossier, nom), 'utf8');
    const empreinteFichier = empreinte(contenu);
    const enBase = appliquees.get(nom);

    // Une migration appliquée **avant** le registre ne se juge pas sur l'empreinte : celle
    // qu'on a notée est celle du fichier au rétablissement, pas celle qui a été jouée. Elle
    // est donc dite « antérieure », jamais « manquante » ni « empreinte changée » (#224).
    let etat;
    if (!enBase) etat = 'manquante';
    else if (enBase.origine === 'anterieure') etat = 'anterieure';
    else if (enBase.empreinte === empreinteFichier) etat = 'appliquee';
    else etat = 'empreinte-changee';

    return {
      fichier: nom,
      empreinte: empreinteFichier,
      etat,
      origine: enBase ? enBase.origine : null,
      applique_le: enBase ? (enBase.applique_le instanceof Date
        ? enBase.applique_le.toISOString()
        : String(enBase.applique_le ?? '')) : null,
      empreinte_en_base: enBase ? enBase.empreinte : null,
    };
  });
}

/** Une erreur « refus » avec son statut HTTP, distinguée d'une panne du poste. */
function refus(statut, publicMessage, code) {
  const erreur = new Error(publicMessage);
  erreur.statut = statut;
  erreur.publicMessage = publicMessage;
  erreur.code = code;
  return erreur;
}

/**
 * Applique **une seule** migration, dans sa transaction (le fichier porte ses propres
 * `begin`/`commit`), puis enregistre son empreinte. Réappliquer la même répond « déjà
 * appliquée » ; une empreinte **changée** est signalée et non rejouée.
 */
export async function appliquerMigration(adapter, dossier, nom) {
  if (!fichiersMigrations(dossier).includes(nom)) {
    throw refus(404, `migration inconnue : ${nom}`, 'inconnue');
  }

  const contenu = readFileSync(join(dossier, nom), 'utf8');
  const empreinteFichier = empreinte(contenu);
  const enBase = (await registre(adapter)).get(nom);

  if (enBase) {
    if (enBase.origine === 'anterieure') {
      throw refus(
        409,
        `appliquée avant le registre : ${nom} — elle n'est pas rejouée`,
        'anterieure',
      );
    }
    if (enBase.empreinte === empreinteFichier) {
      throw refus(409, `déjà appliquée : ${nom}`, 'deja-appliquee');
    }
    throw refus(
      409,
      `empreinte changée : ${nom} a été réécrit après son application — il n'est pas rejoué`,
      'empreinte-changee',
    );
  }

  // Dans sa transaction : le fichier porte `begin; … commit;`. La sortie du serveur (nombre
  // d'instructions) est conservée et rendue, comme le demande la spec.
  const sortie = await adapter.ecrire(contenu);
  await adapter.ecrire(
    'insert into admin.migrations (fichier, empreinte) values ($1, $2)',
    [nom, empreinteFichier],
  );

  return { fichier: nom, empreinte: empreinteFichier, sortie };
}