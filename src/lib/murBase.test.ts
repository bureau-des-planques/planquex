// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ClientMur, RequeteMur, ReponseMur } from '@/lib/supabase';
import {
  chargerPostitsDuMur,
  composerLignePostit,
  idPostit,
  lirePostitsDeLaBase,
  murEstConfigure,
  positionDepuisId,
  posterPostit,
  texteAvecCapture,
  titreDepuisTexte,
} from '@/lib/murBase';

/**
 * La couture du mur (#136), testée **sans réseau** : un faux client rend ce qu'on décide.
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. **sans configuration, rien n'est écrit** et la lecture rend `null` (la page garde le
 *    fichier) ;
 * 2. la lecture **signe l'appareil anonymement** avant de demander la vue — les droits de
 *    `0001_mur.sql` sont donnés à `authenticated`, pas à `anon` ;
 * 3. le client **n'écrit jamais `auteur`**, et **un seul statut** : `en attente` ;
 * 4. un gueulage part **sans famille** dans le contrat, même si la base appliquée exige
 *    encore `kind not null` : il est rangé `IP` en base et retiré à la lecture (D-085) ;
 * 5. une panne de lecture **lève** (la page retombe sur le fichier) au lieu de rendre un
 *    mur vide qui aurait l'air vrai.
 */

/** Une ligne de `postits_avec_votes`, dans la forme que la vue compose. */
const LIGNE = {
  id: 'p-001',
  kind: 'OUF',
  titre: 'Le bouton Fin du tour reste grisé',
  texte: 'Ce que tu faisais : j’étais au combat.',
  ecran: 'Combat',
  pseudo: 'Employé 404',
  version: 'Alpha · 0.1.6',
  statut: 'en attente',
  raison: '',
  ticket: null,
  gueulage: false,
  position: { x: 12, y: 34, angle: -2 },
  votes: { up: 2, down: 1 },
  auteur: 'appareil-A',
  created_at: '2026-10-23T09:00:00.000Z',
};

interface Reponses {
  lignes?: unknown[];
  erreurLecture?: string;
  erreurInsertion?: string;
  session?: boolean;
}

/** Un faux client : il note les insertions et rend les lignes (ou l'erreur) demandées. */
function fauxClient(reponses: Reponses = {}) {
  const insertions: Array<{ table: string; ligne: Record<string, unknown> }> = [];
  const signIn = vi.fn(async () => ({
    data: { user: { id: 'appareil-neuf' } },
    error: null,
  }));
  const getSession = vi.fn(async () => ({
    data: {
      session: reponses.session === false ? null : { user: { id: 'appareil-A' } },
    },
  }));

  const client = {
    auth: { getSession, signInAnonymously: signIn },
    from(table: string): RequeteMur {
      const requete: RequeteMur = {
        select: () => requete,
        order: () => requete,
        insert: (ligne) => {
          insertions.push({ table, ligne });
          return requete;
        },
        then: (onfulfilled, onrejected) => {
          const reponse: ReponseMur<unknown> =
            table === 'postits'
              ? {
                  data: null,
                  error: reponses.erreurInsertion
                    ? { message: reponses.erreurInsertion }
                    : null,
                }
              : {
                  data: reponses.lignes ?? [],
                  error: reponses.erreurLecture
                    ? { message: reponses.erreurLecture }
                    : null,
                };
          return Promise.resolve(reponse).then(onfulfilled, onrejected);
        },
      };
      return requete;
    },
  };

  return { client: client as unknown as ClientMur, insertions, signIn, getSession };
}

describe('la lecture du mur passe par la base quand elle est configurée (#136)', () => {
  it('sans variables, le backend n’est pas armé (`.env.test` les vide pour les tests)', () => {
    expect(murEstConfigure()).toBe(false);
  });

  it('sans configuration, rend null : la page garde le fichier, et ne contacte rien', async () => {
    const charger = vi.fn(async () => null);
    await expect(chargerPostitsDuMur(charger)).resolves.toBeNull();
    expect(charger).toHaveBeenCalledTimes(1);
  });

  it('signe l’appareil anonyme avant de lire la vue, puis rend le contrat', async () => {
    const faux = fauxClient({ lignes: [LIGNE], session: false });
    const postits = await chargerPostitsDuMur(async () => faux.client);

    expect(faux.signIn).toHaveBeenCalledTimes(1);
    expect(postits).toHaveLength(1);
    expect(postits?.[0]).toMatchObject({
      id: 'p-001',
      kind: 'OUF',
      titre: 'Le bouton Fin du tour reste grisé',
      ecran: 'Combat',
      pseudo: 'Employé 404',
      statut: 'en attente',
      ticket: null,
      gueulage: false,
      lie: null,
      position: { x: 12, y: 34, angle: -2 },
      votes: { up: 2, down: 1 },
    });
  });

  it('reprend la session persistée : pas de seconde signature à chaque lecture', async () => {
    const faux = fauxClient({ lignes: [LIGNE] });
    await chargerPostitsDuMur(async () => faux.client);
    expect(faux.signIn).not.toHaveBeenCalled();
  });

  it('lève quand la base répond une erreur — la page retombe sur le fichier', async () => {
    const faux = fauxClient({ erreurLecture: 'TypeError: Failed to fetch' });
    await expect(chargerPostitsDuMur(async () => faux.client)).rejects.toThrow(
      /Lecture du mur impossible : TypeError: Failed to fetch/,
    );
  });

  it('lève quand une ligne n’a pas la forme du contrat, au lieu d’afficher un mur à moitié faux', async () => {
    const faux = fauxClient({ lignes: [{ ...LIGNE, statut: 'peut-être' }] });
    await expect(chargerPostitsDuMur(async () => faux.client)).rejects.toThrow(
      /forme du contrat/,
    );
  });

  it('retire la famille d’un gueulage lu en base (D-085)', () => {
    const { postits, erreurs } = lirePostitsDeLaBase([
      { ...LIGNE, id: 'p-gueule', kind: 'IP', gueulage: true, titre: 'ça suffit' },
    ]);
    expect(erreurs).toEqual([]);
    expect(postits?.[0].kind).toBeNull();
    expect(postits?.[0].gueulage).toBe(true);
  });
});

describe('le dépôt d’un post-it depuis le jeu (#136)', () => {
  it('sans configuration, lève avant d’écrire — le bouton n’est qu’une seconde garde', async () => {
    const faux = fauxClient();
    await expect(
      posterPostit(
        { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
        { chargerClient: async () => null },
      ),
    ).rejects.toThrow(/pas configuré/);
    expect(faux.insertions).toHaveLength(0);
  });

  it('n’écrit jamais `auteur` ni un autre statut que « en attente »', async () => {
    const faux = fauxClient();
    const postit = await posterPostit(
      { famille: 'OUF', gueulage: false, titre: 'Le bouton reste grisé', texte: 'Au combat.', ecran: 'Combat' },
      { chargerClient: async () => faux.client, pseudo: 'Employé 404', id: 'p-test' },
    );

    expect(faux.insertions).toHaveLength(1);
    const ligne = faux.insertions[0].ligne;
    expect(faux.insertions[0].table).toBe('postits');
    expect(ligne).not.toHaveProperty('auteur');
    expect(ligne.statut).toBe('en attente');
    expect(ligne).toMatchObject({
      id: 'p-test',
      kind: 'OUF',
      titre: 'Le bouton reste grisé',
      texte: 'Au combat.',
      ecran: 'Combat',
      pseudo: 'Employé 404',
      gueulage: false,
    });
    expect(postit).toMatchObject({ id: 'p-test', kind: 'OUF', statut: 'en attente', votes: { up: 0, down: 0 } });
  });

  it('signe « anonyme » quand le pseudo local est vide (D-059)', async () => {
    const faux = fauxClient();
    await posterPostit(
      { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
      { chargerClient: async () => faux.client, pseudo: '   ' },
    );
    expect(faux.insertions[0].ligne.pseudo).toBe('anonyme');
  });

  it('un gueulage part sans famille dans le contrat, et son titre vient des premiers mots (D-085)', async () => {
    const faux = fauxClient();
    const postit = await posterPostit(
      {
        famille: null,
        gueulage: true,
        titre: '',
        texte: 'Non mais ça va pas la tête de me demander ça',
        ecran: '',
      },
      { chargerClient: async () => faux.client },
    );

    const ligne = faux.insertions[0].ligne;
    // Un gueulage s'écrit sans famille (D-085, migration 0003).
    expect(ligne.kind).toBeNull();
    expect(ligne.gueulage).toBe(true);
    expect(ligne.titre).toBe('Non mais ça va pas la tête de');
    expect(postit.kind).toBeNull();
    expect(postit.gueulage).toBe(true);
  });

  it('refuse un texte vide, et n’écrit rien', async () => {
    const faux = fauxClient();
    await expect(
      posterPostit(
        { famille: 'IP', gueulage: false, titre: 'Une idée', texte: '   ', ecran: '' },
        { chargerClient: async () => faux.client },
      ),
    ).rejects.toThrow(/texte du post-it est vide/);
    expect(faux.insertions).toHaveLength(0);
  });

  it('refuse une famille absente sur un post-it qui n’est pas un gueulage', async () => {
    const faux = fauxClient();
    await expect(
      posterPostit(
        { famille: null, gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
        { chargerClient: async () => faux.client },
      ),
    ).rejects.toThrow(/Choisis une famille/);
    expect(faux.insertions).toHaveLength(0);
  });

  it('une erreur d’insertion remonte son message, sans prétendre que c’est collé', async () => {
    const faux = fauxClient({ erreurInsertion: 'new row violates row-level security policy' });
    await expect(
      posterPostit(
        { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
        { chargerClient: async () => faux.client },
      ),
    ).rejects.toThrow(/n’a pas pu être collé : new row violates row-level security policy/);
  });
});

describe('les petits morceaux du contrat', () => {
  it('l’id est court, stable et ne change pas de forme', () => {
    const id = idPostit(1_700_000_000_000, () => 0.5);
    expect(id).toMatch(/^p-[0-9a-z]+-[0-9a-z]{6}$/);
    expect(id.length).toBeLessThanOrEqual(32);
    expect(idPostit(1_700_000_000_000, () => 0.5)).toBe(id);
  });

  it('la position dérivée de l’id reste en pourcentage, dans les bornes, et stable', () => {
    const position = positionDepuisId('p-001');
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.x).toBeLessThanOrEqual(100);
    expect(position.y).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeLessThanOrEqual(100);
    expect(position.angle).toBeGreaterThanOrEqual(-5);
    expect(position.angle).toBeLessThanOrEqual(5);
    expect(positionDepuisId('p-001')).toEqual(position);
    // Deux ids voisins ne tombent pas forcément au même endroit.
    expect(positionDepuisId('p-002')).not.toEqual(position);
  });

  it('le titre d’un gueulage vient de ses premiers mots, sans être inventé', () => {
    expect(titreDepuisTexte('  un   deux trois  ')).toBe('un deux trois');
    expect(titreDepuisTexte('motverylong '.repeat(10)).endsWith('…')).toBe(true);
  });

  it('le lien de capture rejoint le texte, et un lien qui n’en est pas un est refusé', () => {
    expect(
      texteAvecCapture({
        famille: 'IP',
        gueulage: false,
        titre: 'Une idée',
        texte: 'Le retour.',
        ecran: '',
        capture: 'https://exemple.test/capture.png',
      }),
    ).toBe('Le retour.\n\nCapture : https://exemple.test/capture.png');

    expect(() =>
      texteAvecCapture({
        famille: 'IP',
        gueulage: false,
        titre: 'Une idée',
        texte: 'Le retour.',
        ecran: '',
        capture: 'pas-un-lien',
      }),
    ).toThrow(/commencer par http/);
  });

  it('la ligne composée ne porte que les champs du contrat, et un écran vide vaut null', () => {
    const ligne = composerLignePostit(
      { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
      { pseudo: 'Employé 404', version: 'Alpha · 0.1.6', id: 'p-x' },
    );
    expect(Object.keys(ligne).sort()).toEqual(
      [
        'ecran',
        'gueulage',
        'id',
        'kind',
        'position_angle',
        'position_x',
        'position_y',
        'pseudo',
        'statut',
        'texte',
        'titre',
        'version'
      ].sort(),
    );
    expect(ligne.ecran).toBeNull();
    expect(ligne.version).toBe('Alpha · 0.1.6');
  });
});
