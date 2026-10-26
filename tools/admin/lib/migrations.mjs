/**
 * Le registre des migrations du poste de pilotage (#184) — `admin.migrations`.
 *
 * Il vit **hors du schéma du jeu** : un schéma `admin`, distinct de `public`, que reprendront
 * les migrations du dépôt. Une ligne par **fichier** de `supabase/migrations/`, son **empreinte
 * sha256**, la date d'application et son **origine** (#224) : appliquée par le poste, ou déjà
 * appliquée **avant** que le registre existe — auquel cas ni empreinte ni date ne sont connues,
 * et le poste **ne l'invente pas**. C'est ce qui permet de répondre « déjà appliquée » ou
 * « empreinte changée » au lieu de rejouer une migration par erreur (la cause de l'incident
 * « relation "combats" already exists » du 23/10, écrit dans la spec #183).
 *
 * Contrairement aux migrations elles-mêmes, ceci **n'est pas** un fichier de `supabase/migrations/` :
 * les tests du jeu rejouent ce dossier dans `pglite` (voir `supabase/pglite.ts`), et une table
 * de registre n'a rien à y faire. Le poste l'applique à son démarrage, de façon idempotente.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Le schéma et la table du registre, créés à l'identique d'un geste de « base neuve », puis
 * **complétés** pour une base où le registre existait déjà (#224) : chaque instruction est
 * idempotente, et le registre est un schéma d'outil, pas le schéma du jeu.
 *
 * `origine` dit qui a posé la ligne :
 *   - `poste` : le poste l'a appliquée, et il en connaît l'empreinte et la date ;
 *   - `anterieur` : elle était **déjà appliquée avant que le registre existe** — on n'affirme
 *     ni son empreinte (le fichier a pu changer depuis, on ne peut pas le savoir) ni sa date.
 */
export const SQL_REGISTRE = `
create schema if not exists admin;
create table if not exists admin.migrations (
  fichier     text        primary key,
  empreinte   text,
  applique_le timestamptz default now(),
  origine     text        not null default 'poste'
);
alter table admin.migrations add column if not exists origine text not null default 'poste';
alter table admin.migrations alter column empreinte drop not null;
alter table admin.migrations alter column applique_le drop not null;`;

/** Les deux origines d'une ligne du registre (#224). */
export const ORIGINE_POSTE = 'poste';
export const ORIGINE_ANTERIEURE = 'anterieur';

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

/**
 * Marque « appliquée avant le registre » toute migration du dossier qui **précède** la plus
 * ancienne que le poste a lui-même appliquée (#224). C'est une **déduction**, pas une mesure :
 * le registre n'existait pas encore, donc le poste ne peut dire ni quand ni avec quel contenu
 * ces fichiers sont passés — seulement qu'ils étaient déjà là. Idempotent (`on conflict do
 * nothing`), et sans effet sur une base où le poste n'a rien appliqué encore : là, tout est
 * réellement `manquante`, et le dire est la vérité.
 */
export async function marquerAnterieures(adapter, dossier) {
  const lu = await adapter.lire(
    'select min(fichier) as premier from admin.migrations where origine = $1',
    [ORIGINE_POSTE],
  );
  const premier = lu.rows.length ? lu.rows[0].premier : null;
  if (!premier) return [];

  const marquees = [];
  for (const nom of fichiersMigrations(dossier)) {
    if (nom >= String(premier)) break; // triés : tout ce qui suit est postérieur aussi
    // Ni empreinte ni date : on écrit `null` **explicitement**, sinon le défaut `now()` daterait
    // l'antériorité d'aujourd'hui — la date inventée qu'on veut justement éviter.
    await adapter.ecrire(
      `insert into admin.migrations (fichier, empreinte, applique_le, origine)
       values ($1, null, null, $2)
       on conflict (fichier) do nothing`,
      [nom, ORIGINE_ANTERIEURE],
    );
    marquees.push(nom);
  }
  return marquees;
}

/**
 * Pose le schéma `admin`, sa table de registre, et l'origine des migrations antérieures
 * (idempotent). `dossier` est le dossier des migrations du dépôt.
 */
export async function initialiserRegistre(adapter, dossier) {
  await adapter.ecrire(SQL_REGISTRE);
  await marquerAnterieures(adapter, dossier);
}

/** Une ligne du registre, vue du poste. */
async function registre(adapter) {
  const lu = await adapter.lire(
    'select fichier, empreinte, applique_le, origine from admin.migrations order by fichier',
  );
  return new Map(
    lu.rows.map((ligne) => [
      String(ligne.fichier),
      {
        empreinte: ligne.empreinte === null ? null : String(ligne.empreinte),
        applique_le: ligne.applique_le,
        origine: String(ligne.origine),
      },
    ]),
  );
}

/**
 * L'état de chaque migration du dépôt, comparée au registre :
 *   - `manquante` : pas encore appliquée ;
 *   - `anterieure` : appliquée **avant** que le registre existe (#224) — le poste ne connaît ni
 *     son empreinte ni sa date, et ne la propose donc jamais à l'application ;
 *   - `appliquee` : appliquée **par le poste**, et son empreinte correspond ;
 *   - `empreinte-changee` : appliquée, puis le fichier a été **réécrit** — signalée, jamais rejouée.
 */
export async function listerMigrations(adapter, dossier) {
  const appliquees = await registre(adapter);
  return fichiersMigrations(dossier).map((nom) => {
    const contenu = readFileSync(join(dossier, nom), 'utf8');
    const empreinteFichier = empreinte(contenu);
    const enBase = appliquees.get(nom);

    let etat;
    if (!enBase) etat = 'manquante';
    else if (enBase.origine === ORIGINE_ANTERIEURE) etat = 'anterieure';
    else if (enBase.empreinte === empreinteFichier) etat = 'appliquee';
    else etat = 'empreinte-changee';

    return {
      fichier: nom,
      empreinte: empreinteFichier,
      etat,
      // Une migration antérieure n'a **pas** de date connue : `null`, jamais « aujourd'hui ».
      applique_le: !enBase || enBase.applique_le === null || enBase.applique_le === undefined
        ? null
        : enBase.applique_le instanceof Date
          ? enBase.applique_le.toISOString()
          : String(enBase.applique_le),
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
 * `begin`/`commit`), puis enregistre son empreinte. Une migration appliquée **avant** le
 * registre est refusée — on ne sait pas ce qu'elle contenait alors, et 0001/0002 ne sont pas
 * idempotentes (#224) ; réappliquer la même répond « déjà appliquée » ; une empreinte
 * **changée** est signalée et non rejouée.
 */
export async function appliquerMigration(adapter, dossier, nom) {
  if (!fichiersMigrations(dossier).includes(nom)) {
    throw refus(404, `migration inconnue : ${nom}`, 'inconnue');
  }

  const contenu = readFileSync(join(dossier, nom), 'utf8');
  const empreinteFichier = empreinte(contenu);
  const enBase = (await registre(adapter)).get(nom);

  if (enBase) {
    if (enBase.origine === ORIGINE_ANTERIEURE) {
      throw refus(
        409,
        `appliquée avant le registre : ${nom} n'est pas rejouée (empreinte inconnue)`,
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