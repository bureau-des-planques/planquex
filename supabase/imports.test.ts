// @vitest-environment node
/**
 * L'import du fichier du mur dans la base — #136, critère « les post-its déjà présents
 * sont dans la base, avec leurs statuts et leurs pseudos ».
 *
 * Le fichier `docs/comite.json` est la **trace de ce qui a été collecté avant** D-097 (D-058) :
 * les deux post-its d'avant le mur en base n'ont pas d'auteur — leur identité anonyme de
 * l'époque n'a pas de compte —, donc l'import leur donne l'**auteur sentinelle**
 * (`00000000-…`), qu'aucun `auth.uid()` ne peut valoir. Personne ne les revendique : ils se
 * lisent, ne se modifient pas, et le geste pour les rattacher à un compte est explicite
 * (`supabase/README.md` §5.4).
 *
 * Ce que la garde exige :
 *
 * 1. le fichier du dépôt et l'import `supabase/imports/` **disent la même chose** — un
 *    post-it ajouté au JSON sans être ajouté à l'import fait échouer ce test ;
 * 2. les deux lignes arrivent en base avec leur `statut`, leur `pseudo`, leur famille
 *    (`kind` ou `gueulage`) et leur place ;
 * 3. la vue `postits_avec_votes` les rend dans la **forme du contrat** (`lirePostitsDeLaBase`
 *    est le juge : le même validateur que la page) ;
 * 4. rejouer l'import ne duplique rien.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { lirePostitsDeLaBase } from '@/lib/murBase';
import { base, type Base } from './pglite';

const DOSSIER_IMPORTS = new URL('./imports/', import.meta.url);
const FICHIER_MUR = new URL('../docs/comite.json', import.meta.url);

interface PostitDuFichier {
  id: string;
  kind?: string;
  titre: string;
  texte: string;
  ecran: string;
  pseudo: string;
  version: string;
  statut: string;
  raison: string;
  ticket: number | null;
  gueulage: boolean;
  lie: string | null;
  position: { x: number; y: number; angle: number };
}

function postitsDuFichier(): PostitDuFichier[] {
  const lu: unknown = JSON.parse(readFileSync(FICHIER_MUR, 'utf8'));
  if (!lu || typeof lu !== 'object' || !('postits' in lu)) {
    throw new Error('docs/comite.json n’a pas de tableau `postits`');
  }
  const { postits } = lu as { postits: unknown };
  if (!Array.isArray(postits)) throw new Error('`postits` n’est pas un tableau');
  return postits as PostitDuFichier[];
}

/** Tous les fichiers SQL d'import, dans l'ordre de leur nom. */
function sqlDesImports(): string[] {
  return readdirSync(DOSSIER_IMPORTS)
    .filter((nom) => nom.endsWith('.sql'))
    .sort()
    .map((nom) => readFileSync(new URL(nom, DOSSIER_IMPORTS), 'utf8'));
}

let db: Base;

beforeAll(async () => {
  db = await base();
  for (const sql of sqlDesImports()) await db.exec(sql);
});

describe('l’import du mur (docs/comite.json → public.postits, #136)', () => {
  it('le fichier n’a pas de post-it que l’import ignorerait', async () => {
    const duFichier = postitsDuFichier();
    expect(duFichier.length).toBeGreaterThan(0);

    const { rows } = await db.query<{ id: string }>('select id from public.postits order by id');
    const enBase = new Set(rows.map((ligne) => ligne.id));
    for (const postit of duFichier) {
      expect(enBase, `post-it absent de la base : ${postit.id}`).toContain(postit.id);
    }
    // Pas d'égalité stricte : un import **postérieur** (les réponses du formulaire, par
    // exemple) ajoutera légitimement des lignes, et ce test doit garder le fichier, pas
    // interdire la suite.
  });

  it('chaque post-it garde tous ses champs du fichier', async () => {
    // Champ par champ, parce que la duplication entre le JSON et le SQL est le vrai risque :
    // un texte, une place ou une raison recopiés de travers ne se voient nulle part ailleurs.
    const { rows } = await db.query<{
      id: string;
      kind: string | null;
      titre: string;
      texte: string;
      ecran: string | null;
      pseudo: string;
      version: string;
      statut: string;
      raison: string;
      ticket: number | null;
      gueulage: boolean;
      lie: string | null;
      position_x: number;
      position_y: number;
      position_angle: number;
    }>(
      `select id, kind, titre, texte, ecran, pseudo, version, statut, raison, ticket,
              gueulage, lie, position_x, position_y, position_angle
         from public.postits order by id`
    );

    for (const postit of postitsDuFichier()) {
      const ligne = rows.find((candidate) => candidate.id === postit.id);
      expect(ligne, postit.id).toBeDefined();
      expect(ligne?.titre).toBe(postit.titre);
      expect(ligne?.texte).toBe(postit.texte);
      expect(ligne?.pseudo).toBe(postit.pseudo);
      expect(ligne?.statut).toBe(postit.statut);
      expect(ligne?.version).toBe(postit.version);
      expect(ligne?.raison).toBe(postit.raison);
      expect(ligne?.ticket).toBe(postit.ticket);
      // `lie` est **absent** du second post-it du fichier : absent et nul disent la même chose.
      expect(ligne?.lie ?? null).toBe(postit.lie ?? null);
      expect(ligne?.gueulage).toBe(postit.gueulage);
      expect([ligne?.position_x, ligne?.position_y, ligne?.position_angle]).toEqual([
        postit.position.x,
        postit.position.y,
        postit.position.angle
      ]);
      // Un gueulage n'a pas de famille (contrainte `postits_gueulage_sans_famille`) ;
      // les autres en ont une. Le fichier le dit déjà, l'import ne l'invente pas.
      expect(ligne?.kind).toBe(postit.gueulage ? null : postit.kind);
      // L'écran vide du fichier est **nul** en base : la colonne n'admet que les six écrans.
      expect(ligne?.ecran).toBe(postit.ecran === '' ? null : postit.ecran);
    }
  });

  it('aucun post-it importé n’appartient à un compte', async () => {
    const { rows } = await db.query<{ auteur: string }>('select distinct auteur from public.postits');
    expect(rows).toHaveLength(1);
    expect(rows[0].auteur).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('la vue les rend dans la forme du contrat, sans une erreur de lecture', async () => {
    const { rows } = await db.query('select * from public.postits_avec_votes order by created_at');
    expect(rows.length).toBeGreaterThanOrEqual(postitsDuFichier().length);

    const { postits, erreurs } = lirePostitsDeLaBase(rows);
    expect(erreurs).toEqual([]);
    expect(postits).not.toBeNull();
    const attendus = postitsDuFichier().map((postit) => postit.id);
    for (const id of attendus) expect(postits?.map((postit) => postit.id)).toContain(id);
  });

  it('la date vient de la collecte, pas de l’import — et l’id le dit', async () => {
    // L'id porte l'heure locale de collecte : `p-DD-MM-AAAA-HH-MM-SS-…`. L'import la reprend
    // dans `created_at`, heure de Paris. Ce test relie **les deux sources** : si l'une bouge
    // sans l'autre (une date recopiée de travers, un fuseau changé), il tombe. Une assertion
    // sur l'ordre seul ne prouverait rien : deux lignes importées ont le même ordre qu'elles
    // soient datées ou non.
    const { rows } = await db.query<{ id: string; collecte: string; created_at: string }>(
      `select id,
              to_char(created_at at time zone 'Europe/Paris', 'DD-MM-YYYY-HH24-MI-SS') as collecte,
              created_at::text
         from public.postits order by created_at`
    );

    for (const ligne of rows) {
      const dansId = ligne.id.split('-').slice(1, 7).join('-');
      expect(ligne.collecte, `date de collecte de ${ligne.id}`).toBe(dansId);
    }
    // Et le passé ne compte pas : `updated_at` suit `created_at`, sinon le compteur du
    // comité lirait un faux mouvement de statut (#239).
    const { rows: ecarts } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.postits where updated_at <> created_at'
    );
    expect(ecarts[0].n).toBe(0);
    // L'ordre du mur suit cette date : le gueulage (01:36) avant « papi » (01:37).
    expect(rows.map((ligne) => ligne.id)).toEqual(postitsDuFichier().map((postit) => postit.id));
  });

  it('rejouer l’import ne duplique rien', async () => {
    const avant = await db.query<{ n: number }>('select count(*)::int as n from public.postits');
    for (const sql of sqlDesImports()) await db.exec(sql);
    const apres = await db.query<{ n: number }>('select count(*)::int as n from public.postits');
    expect(apres.rows[0].n).toBe(avant.rows[0].n);
  });
});
