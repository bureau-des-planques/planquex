// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ClientMur, RequeteMur, ReponseMur } from '@/lib/supabase';
import {
  chargerPostitsDuMur,
  compterApres,
  composerLignePostit,
  gesteDeVote,
  idPostit,
  lirePostitsDeLaBase,
  murEstConfigure,
  positionDepuisId,
  posterPostit,
  texteAvecCapture,
  titreDepuisTexte,
  voterPourPostit,
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
  /** Les lignes de `votes` rendues à une lecture filtrée sur mon identité (#137). */
  mesVotes?: unknown[];
  erreurLectureVotes?: string;
  /** L'erreur que la base rend à un vote (insertion, modification ou retrait). */
  erreurVote?: string;
  /** Le nombre de lignes qu'une modification ou un retrait de vote touche (défaut : 1). */
  lignesTouchees?: number;
}

/** Tout ce qui part vers la base en écriture : la table, le geste, les valeurs, les filtres. */
interface Ecriture {
  table: string;
  geste: 'insert' | 'update' | 'delete';
  valeurs?: Record<string, unknown>;
  filtres: Array<[string, string]>;
}

/** Un faux client : il note les écritures et rend les lignes (ou l'erreur) demandées. */
function fauxClient(reponses: Reponses = {}) {
  const insertions: Array<{ table: string; ligne: Record<string, unknown> }> = [];
  const ecritures: Ecriture[] = [];
  const lectures: Array<{ table: string; filtres: Array<[string, string]> }> = [];
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
      let ecriture: Ecriture | null = null;
      const filtres: Array<[string, string]> = [];
      const requete: RequeteMur = {
        select: () => requete,
        order: () => requete,
        eq: (colonne, valeur) => {
          filtres.push([colonne, valeur]);
          return requete;
        },
        insert: (ligne) => {
          insertions.push({ table, ligne });
          ecriture = { table, geste: 'insert', valeurs: ligne, filtres };
          ecritures.push(ecriture);
          return requete;
        },
        update: (valeurs) => {
          ecriture = { table, geste: 'update', valeurs, filtres };
          ecritures.push(ecriture);
          return requete;
        },
        delete: () => {
          ecriture = { table, geste: 'delete', filtres };
          ecritures.push(ecriture);
          return requete;
        },
        then: (onfulfilled, onrejected) => {
          let reponse: ReponseMur<unknown>;
          if (table === 'votes' && ecriture) {
            reponse = {
              data:
                ecriture.geste === 'insert'
                  ? null
                  : Array.from({ length: reponses.lignesTouchees ?? 1 }, () => ({ postit_id: 'x' })),
              error: reponses.erreurVote ? { message: reponses.erreurVote } : null,
            };
          } else if (table === 'votes') {
            lectures.push({ table, filtres });
            reponse = {
              data: reponses.mesVotes ?? [],
              error: reponses.erreurLectureVotes ? { message: reponses.erreurLectureVotes } : null,
            };
          } else if (table === 'postits') {
            reponse = {
              data: null,
              error: reponses.erreurInsertion ? { message: reponses.erreurInsertion } : null,
            };
          } else {
            reponse = {
              data: reponses.lignes ?? [],
              error: reponses.erreurLecture ? { message: reponses.erreurLecture } : null,
            };
          }
          return Promise.resolve(reponse).then(onfulfilled, onrejected);
        },
      };
      return requete;
    },
  };

  return { client: client as unknown as ClientMur, insertions, ecritures, lectures, signIn, getSession };
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

describe('les pouces : lecture de mon vote et écriture du vote (#137)', () => {
  const AUTRE = { ...LIGNE, id: 'p-002', auteur: 'appareil-B', votes: { up: 0, down: 0 } };

  it('distingue mon vote du total, et reconnaît mes post-its', async () => {
    const faux = fauxClient({
      lignes: [LIGNE, AUTRE],
      mesVotes: [{ postit_id: 'p-002', sens: 'up' }],
    });
    const postits = await chargerPostitsDuMur(async () => faux.client);

    // Le total vient de la vue ; mon vote, de mes lignes de `votes` — jamais mélangés.
    expect(postits?.[0]).toMatchObject({ id: 'p-001', votes: { up: 2, down: 1, mon: null }, mien: true });
    expect(postits?.[1]).toMatchObject({ id: 'p-002', votes: { up: 0, down: 0, mon: 'up' }, mien: false });
  });

  it('ne lit que MES votes : la lecture est filtrée sur mon identité', async () => {
    const faux = fauxClient({ lignes: [LIGNE] });
    await chargerPostitsDuMur(async () => faux.client);
    expect(faux.lectures).toEqual([{ table: 'votes', filtres: [['votant', 'appareil-A']] }]);
    // Aucune écriture à la lecture.
    expect(faux.ecritures).toHaveLength(0);
  });

  it('une panne de lecture de mes votes lève : la page retombe sur le fichier, sans pouces', async () => {
    const faux = fauxClient({ lignes: [LIGNE], erreurLectureVotes: 'TypeError: Failed to fetch' });
    await expect(chargerPostitsDuMur(async () => faux.client)).rejects.toThrow(
      /Lecture de tes votes impossible/,
    );
  });

  it('sans configuration, voter n’écrit rien et le dit', async () => {
    await expect(voterPourPostit('p-001', 'up', null, { chargerClient: async () => null })).rejects.toThrow(
      /pas configuré/,
    );
  });

  it('un premier vote est une insertion de `postit_id` et `sens` — jamais de `votant`', async () => {
    const faux = fauxClient();
    const apres = await voterPourPostit('p-001', 'up', null, { chargerClient: async () => faux.client });

    expect(apres).toBe('up');
    expect(faux.ecritures).toEqual([
      { table: 'votes', geste: 'insert', valeurs: { postit_id: 'p-001', sens: 'up' }, filtres: [] },
    ]);
    expect(faux.ecritures[0].valeurs).not.toHaveProperty('votant');
  });

  it('l’autre pouce change mon vote : une modification de MA ligne, pas une seconde ligne', async () => {
    const faux = fauxClient();
    const apres = await voterPourPostit('p-001', 'down', 'up', { chargerClient: async () => faux.client });

    expect(apres).toBe('down');
    expect(faux.ecritures).toHaveLength(1);
    expect(faux.ecritures[0]).toMatchObject({
      table: 'votes',
      geste: 'update',
      valeurs: { sens: 'down' },
      filtres: [
        ['postit_id', 'p-001'],
        ['votant', 'appareil-A'],
      ],
    });
    expect(faux.ecritures[0].valeurs).not.toHaveProperty('votant');
  });

  it('le même pouce retire mon vote', async () => {
    const faux = fauxClient();
    const apres = await voterPourPostit('p-001', 'up', 'up', { chargerClient: async () => faux.client });

    expect(apres).toBeNull();
    expect(faux.ecritures).toEqual([
      {
        table: 'votes',
        geste: 'delete',
        filtres: [
          ['postit_id', 'p-001'],
          ['votant', 'appareil-A'],
        ],
      },
    ]);
  });

  it('une erreur réseau lève : l’appelant rétablit l’affichage', async () => {
    const faux = fauxClient({ erreurVote: 'TypeError: Failed to fetch' });
    await expect(voterPourPostit('p-001', 'up', null, { chargerClient: async () => faux.client })).rejects.toThrow(
      /Le vote n’est pas passé \(TypeError: Failed to fetch\)/,
    );
  });

  it('les refus de la base sont dits en français : pour soi, post-it effacé, double vote', async () => {
    const refus = async (erreurVote: string) => {
      const faux = fauxClient({ erreurVote });
      return voterPourPostit('p-001', 'up', null, { chargerClient: async () => faux.client }).catch(
        (erreur: Error) => erreur.message,
      );
    };
    expect(await refus('new row violates row-level security policy for table "votes"')).toMatch(/propre post-it/);
    expect(await refus('insert or update on table "votes" violates foreign key constraint')).toMatch(/n’existe plus/);
    expect(await refus('duplicate key value violates unique constraint "votes_pkey"')).toMatch(/déjà voté/);
  });

  it('un retrait ou un changement qui ne touche aucune ligne est une erreur, pas un succès', async () => {
    const faux = fauxClient({ lignesTouchees: 0 });
    await expect(voterPourPostit('p-001', 'up', 'up', { chargerClient: async () => faux.client })).rejects.toThrow(
      /n’existe plus/,
    );
    await expect(voterPourPostit('p-001', 'down', 'up', { chargerClient: async () => faux.client })).rejects.toThrow(
      /n’existe plus/,
    );
  });

  it('l’ordre de priorité d’un clic : même pouce = retirer, autre pouce = changer, rien = voter', () => {
    expect(gesteDeVote(null, 'up')).toEqual({ geste: 'inserer', apres: 'up' });
    expect(gesteDeVote('up', 'up')).toEqual({ geste: 'retirer', apres: null });
    expect(gesteDeVote('up', 'down')).toEqual({ geste: 'changer', apres: 'down' });
    expect(gesteDeVote('down', 'up')).toEqual({ geste: 'changer', apres: 'up' });
  });

  it('(d) un vote défait remet le compteur ; changer d’avis le déplace, sans le doubler', () => {
    const depart = { up: 2, down: 1, mon: null };
    const vote = compterApres(depart, null, 'up');
    expect(vote).toEqual({ up: 3, down: 1, mon: 'up' });
    // Défait : on retombe exactement sur le compteur de départ.
    expect(compterApres(vote, 'up', null)).toEqual(depart);
    // Changé : un pouce de moins d'un côté, un de plus de l'autre.
    expect(compterApres(vote, 'up', 'down')).toEqual({ up: 2, down: 2, mon: 'down' });
    // Jamais sous zéro.
    expect(compterApres({ up: 0, down: 0, mon: 'up' }, 'up', null)).toEqual({ up: 0, down: 0, mon: null });
  });
});
