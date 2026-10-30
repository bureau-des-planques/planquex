// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ClientMur, RequeteMur, ReponseMur } from '@/lib/supabase';
import {
  chargerCommentaires,
  commenterPostit,
  compterApres,
  compterChosesAVoir,
  composerLignePostit,
  gesteDeVote,
  grouperCommentaires,
  idPostit,
  lireCommentaires,
  lirePostitsDeLaBase,
  LIMITE_COMMENTAIRE,
  marquerComiteVu,
  messageDePlace,
  messageDeTri,
  murDuJeu,
  murEstConfigure,
  positionDepuisId,
  supprimerCommentaire,
  texteAvecCapture,
  titreDepuisTexte,
  verifierCommentaire,
  verifierPosition,
  verifierTri
} from '@/lib/murBase';
import type { OptionsMurDuJeu } from '@/lib/murBase';
import type { BrouillonPostit, Correction, OptionsPostit, TriPostit } from '@/lib/mur';
import type { PositionPostit, SensVote } from '@/store/mur';

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

/**
 * Les gestes du mur, vus **à travers le port** (`murDuJeu`) mais dans l'ancien contrat qui
 * lève : les requêtes envoyées à la base sont celles que ces tests gardent depuis #136, et
 * ces sept raccourcis ne font que traduire `{ ok: false, message }` en exception (#254).
 * Aucune page ne les appelle plus ; ils servent à éprouver **le fil** (la base, au niveau de
 * la requête) sans réécrire ce qui était déjà gardé.
 */
type Couture = Pick<OptionsMurDuJeu, 'chargerClient'>;
function leve<T extends { ok: boolean }>(resultat: T | { ok: false; message: string }): Extract<T, { ok: true }> {
  if (!resultat.ok) throw new Error((resultat as { message: string }).message);
  return resultat as Extract<T, { ok: true }>;
}
/** Sans base : `null`, le signal « garde ton fichier ». Base muette : la notice, levée. */
async function chargerPostitsDuMur(chargerClient?: Couture['chargerClient']) {
  const lu = leve(await murDuJeu({ chargerClient }).charger());
  if (lu.source === 'base') return lu.postits;
  if (lu.notice) throw new Error(lu.notice);
  return null;
}
const posterPostit = async (brouillon: BrouillonPostit, options: OptionsPostit & Couture = {}) =>
  leve(await murDuJeu(options).poster(brouillon, options)).postit;
const voterPourPostit = async (id: string, demande: SensVote, actuel: SensVote | null, options: Couture = {}) =>
  leve(await murDuJeu(options).voter(id, demande, actuel)).vote;
const trierPostit = async (id: string, tri: TriPostit, options: Couture = {}) =>
  leve(await murDuJeu(options).trier(id, tri)).tri;
const deplacerPostit = async (id: string, position: PositionPostit, options: Couture = {}) =>
  leve(await murDuJeu(options).deplacer(id, position)).position;
const corrigerPostit = async (id: string, correction: Correction, options: Couture = {}) => {
  const { titre, texte } = leve(await murDuJeu(options).corriger(id, correction));
  return { titre, texte };
};
const retirerPostit = async (id: string, options: Couture = {}) => {
  leve(await murDuJeu(options).retirer(id));
};

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
  created_at: '2026-10-23T09:00:00.000Z'
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
  /** L'erreur que la base rend à un déplacement de post-it (#185). */
  erreurPlace?: string;
  /** Le nombre de lignes qu'une modification ou un retrait de vote touche (défaut : 1). */
  lignesTouchees?: number;
  /** Les lignes de `commentaires` rendues à la lecture, et l'erreur éventuelle (#138). */
  commentaires?: unknown[];
  erreurCommentaires?: string;
  /** La ligne rendue par l'insertion d'un commentaire, et l'erreur éventuelle. */
  commentaire?: unknown;
  erreurCommentaire?: string;
  /** Le nombre de commentaires qu'un retrait touche (défaut : 1). */
  commentairesRetires?: number;
  /** Ce que rend `rpc('corriger_postit', …)` (#139), et son erreur. */
  correction?: unknown;
  erreurCorrection?: string;
  /** La ligne rendue par `deplacer_postit` (0007), et l'erreur éventuelle (#186). */
  deplace?: unknown;
  erreurDeplace?: string;
  /** La ligne que rend le tri d'un post-it (`statut, raison, ticket`), ou `null` (#0006). */
  tri?: unknown;
  /** L'erreur que la base rend au tri (grant, politique, contrainte). */
  erreurTri?: string;
  /** Le repère rendu par `marquer_comite_vu()` (0008), et l'erreur éventuelle (#211). */
  vu?: unknown;
  erreurVu?: string;
  /** La ligne de `comptes` lue par le compteur du comité (#212) : `[{ vu_le }]`. */
  repere?: unknown[];
  erreurRepere?: string;
}

/** Tout ce qui part vers la base en écriture : la table, le geste, les valeurs, les filtres. */
interface Ecriture {
  table: string;
  geste: 'insert' | 'update' | 'delete';
  valeurs?: Record<string, unknown>;
  filtres: Array<[string, string | number]>;
}

/** Un appel de fonction SQL : c'est par là que passe la correction (#139). */
interface AppelRpc {
  nom: string;
  params: Record<string, unknown> | undefined;
}

/** Un faux client : il note les écritures et rend les lignes (ou l'erreur) demandées. */
function fauxClient(reponses: Reponses = {}) {
  const insertions: Array<{ table: string; ligne: Record<string, unknown> }> = [];
  const ecritures: Ecriture[] = [];
  const lectures: Array<{ table: string; filtres: Array<[string, string | number]> }> = [];
  const appelsRpc: AppelRpc[] = [];
  const getSession = vi.fn(async () => ({
    data: {
      session: reponses.session === false ? null : { user: { id: 'appareil-A' } }
    }
  }));

  /**
   * Le repère du compte, côté « base » : `marquer_comite_vu()` l'avance **pour de vrai**,
   * comme la fonction de 0008. Sans cela, aucun test ne pourrait vérifier que le compteur
   * **relu** après l'ouverture du suivi rend bien 0 (#212).
   */
  let lignesRepere: unknown[] = reponses.repere ?? [];

  const rpc = vi.fn(async (nom: string, params?: Record<string, unknown>) => {
    appelsRpc.push({ nom, params });
    // Trois fonctions du mur, trois réponses : le tri et la correction (0006), la place
    // (0007), et le repère du suivi (0008, #211).
    if (nom === 'deplacer_postit') {
      return {
        data: reponses.deplace ?? null,
        error: reponses.erreurDeplace ? { message: reponses.erreurDeplace } : null
      };
    }
    if (nom === 'marquer_comite_vu') {
      if (reponses.vu !== undefined && reponses.erreurVu === undefined) {
        lignesRepere = [{ vu_le: reponses.vu }];
      }
      return {
        data: reponses.vu ?? null,
        error: reponses.erreurVu ? { message: reponses.erreurVu } : null
      };
    }
    return {
      data: reponses.correction ?? null,
      error: reponses.erreurCorrection ? { message: reponses.erreurCorrection } : null
    };
  });

  const client = {
    auth: { getSession },
    rpc,
    from(table: string): RequeteMur {
      let ecriture: Ecriture | null = null;
      const filtres: Array<[string, string | number]> = [];
      const requete: RequeteMur = {
        select: () => requete,
        order: () => requete,
        eq: (colonne, valeur) => {
          filtres.push([colonne, valeur]);
          return requete;
        },
        // Le filtre `in` sert au compteur du comité (#212) : les commentaires de **tous**
        // mes post-its en une requête. On le garde lisible dans les filtres (`postit_id in`)
        // pour que le test puisse vérifier qu'il n'y a **pas** une lecture par post-it.
        in: (colonne, valeurs) => {
          filtres.push([`${colonne} in`, valeurs.join(',')]);
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
          if (table === 'comptes') {
            // Le compteur du comité lit son repère (#212) ; `marquer_comite_vu()` l'avance.
            lectures.push({ table, filtres });
            reponse = {
              data: lignesRepere,
              error: reponses.erreurRepere ? { message: reponses.erreurRepere } : null
            };
          } else if (table === 'commentaires') {
            lectures.push({ table, filtres });
            reponse = ecriture
              ? {
                  data:
                    ecriture.geste === 'delete'
                      ? Array.from({ length: reponses.commentairesRetires ?? 1 }, () => ({ id: 1 }))
                      : (reponses.commentaire ?? null),
                  error: reponses.erreurCommentaire ? { message: reponses.erreurCommentaire } : null
                }
              : {
                  data: reponses.commentaires ?? [],
                  error: reponses.erreurCommentaires ? { message: reponses.erreurCommentaires } : null
                };
          } else if (table === 'votes' && ecriture) {
            reponse = {
              data:
                ecriture.geste === 'insert'
                  ? null
                  : Array.from({ length: reponses.lignesTouchees ?? 1 }, () => ({ postit_id: 'x' })),
              error: reponses.erreurVote ? { message: reponses.erreurVote } : null
            };
          } else if (table === 'votes') {
            lectures.push({ table, filtres });
            reponse = {
              data: reponses.mesVotes ?? [],
              error: reponses.erreurLectureVotes ? { message: reponses.erreurLectureVotes } : null
            };
          } else if (table === 'postits') {
            // Le dépôt d'un post-it ne rend rien (il n'écrit pas `select`) ; un retrait
            // rend ses lignes, un tri rend `statut, raison, ticket` (0006), un déplacement
            // rend la ligne visée (#185).
            reponse = {
              data:
                ecriture?.geste === 'delete'
                  ? Array.from({ length: reponses.lignesTouchees ?? 1 }, () => ({ id: 'x' }))
                  : ecriture?.geste === 'update'
                    ? // Un `update(…).select(…)` rend une **liste** de lignes.
                      reponses.tri
                      ? [reponses.tri]
                      : reponses.lignesTouchees === undefined
                        ? null
                        : Array.from({ length: reponses.lignesTouchees }, () => ({ id: 'x' }))
                    : null,
              error: reponses.erreurInsertion
                ? { message: reponses.erreurInsertion }
                : reponses.erreurPlace
                  ? { message: reponses.erreurPlace }
                  : reponses.erreurTri
                    ? { message: reponses.erreurTri }
                    : null
            };
          } else {
            // La vue `postits_avec_votes` (et tout schéma inconnu) : une **lecture** se note,
            // c'est ce qui permet au test du compteur de compter les requêtes (#212).
            lectures.push({ table, filtres });
            reponse = {
              data: reponses.lignes ?? [],
              error: reponses.erreurLecture ? { message: reponses.erreurLecture } : null
            };
          }
          return Promise.resolve(reponse).then(onfulfilled, onrejected);
        }
      };
      return requete;
    }
  };

  return {
    client: client as unknown as ClientMur,
    insertions,
    ecritures,
    lectures,
    appelsRpc,
    getSession
  };
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

  it('lit la vue avec la session du compte, puis rend le contrat', async () => {
    const faux = fauxClient({ lignes: [LIGNE] });
    const postits = await chargerPostitsDuMur(async () => faux.client);

    expect(faux.getSession).toHaveBeenCalledTimes(1);
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
      votes: { up: 2, down: 1 }
    });
  });

  it('sans session, lève : la page retombe sur le fichier, et rien n’est signé (#527)', async () => {
    const faux = fauxClient({ lignes: [LIGNE], session: false });
    await expect(chargerPostitsDuMur(async () => faux.client)).rejects.toThrow(/Aucune session/);
  });

  it('lève quand la base répond une erreur — la page retombe sur le fichier', async () => {
    const faux = fauxClient({ erreurLecture: 'TypeError: Failed to fetch' });
    await expect(chargerPostitsDuMur(async () => faux.client)).rejects.toThrow(
      /Lecture du mur impossible : TypeError: Failed to fetch/
    );
  });

  it('lève quand une ligne n’a pas la forme du contrat, au lieu d’afficher un mur à moitié faux', async () => {
    const faux = fauxClient({ lignes: [{ ...LIGNE, statut: 'peut-être' }] });
    await expect(chargerPostitsDuMur(async () => faux.client)).rejects.toThrow(/forme du contrat/);
  });

  it('retire la famille d’un gueulage lu en base (D-085)', () => {
    const { postits, erreurs } = lirePostitsDeLaBase([
      { ...LIGNE, id: 'p-gueule', kind: 'IP', gueulage: true, titre: 'ça suffit' }
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
        { chargerClient: async () => null }
      )
    ).rejects.toThrow(/pas configuré/);
    expect(faux.insertions).toHaveLength(0);
  });

  it('n’écrit jamais `auteur` ni un autre statut que « en attente »', async () => {
    const faux = fauxClient();
    const postit = await posterPostit(
      { famille: 'OUF', gueulage: false, titre: 'Le bouton reste grisé', texte: 'Au combat.', ecran: 'Combat' },
      { chargerClient: async () => faux.client, pseudo: 'Employé 404', id: 'p-test' }
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
      gueulage: false
    });
    expect(postit).toMatchObject({ id: 'p-test', kind: 'OUF', statut: 'en attente', votes: { up: 0, down: 0 } });
  });

  it('signe « anonyme » quand le pseudo local est vide (D-059)', async () => {
    const faux = fauxClient();
    await posterPostit(
      { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
      { chargerClient: async () => faux.client, pseudo: '   ' }
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
        ecran: ''
      },
      { chargerClient: async () => faux.client }
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
        { chargerClient: async () => faux.client }
      )
    ).rejects.toThrow(/texte du post-it est vide/);
    expect(faux.insertions).toHaveLength(0);
  });

  it('refuse une famille absente sur un post-it qui n’est pas un gueulage', async () => {
    const faux = fauxClient();
    await expect(
      posterPostit(
        { famille: null, gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
        { chargerClient: async () => faux.client }
      )
    ).rejects.toThrow(/Choisis une famille/);
    expect(faux.insertions).toHaveLength(0);
  });

  it('une erreur d’insertion remonte son message, sans prétendre que c’est collé', async () => {
    const faux = fauxClient({ erreurInsertion: 'new row violates row-level security policy' });
    await expect(
      posterPostit(
        { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
        { chargerClient: async () => faux.client }
      )
    ).rejects.toThrow(/n’a pas pu être collé : new row violates row-level security policy/);
  });
});

describe('la place sur le tableau, écrite en base (#185, #186)', () => {
  it('passe par la fonction `deplacer_postit`, seul chemin qui connaisse le droit de ranger', async () => {
    const faux = fauxClient({ deplace: { position_x: 12.3, position_y: 45.7, position_angle: -1.5 } });
    const place = await deplacerPostit(
      'p-001',
      { x: 12.34, y: 45.67, angle: -1.5 },
      { chargerClient: async () => faux.client }
    );

    // Pas d'`update` direct : `position_*` n'est pas dans le grant de la 0006, et une
    // politique RLS ne distingue pas les colonnes (voir l'en-tête de `0007`).
    expect(faux.ecritures).toHaveLength(0);
    expect(faux.appelsRpc).toEqual([
      { nom: 'deplacer_postit', params: { p_id: 'p-001', p_x: 12.3, p_y: 45.7, p_angle: -1.5 } }
    ]);
    // Ce qui revient est ce que la base a gardé : arrondi au dixième.
    expect(place).toEqual({ x: 12.3, y: 45.7, angle: -1.5 });
  });

  it('un déplacement refusé par la base ne se déclare jamais réussi, et le refus est dit en français', async () => {
    const faux = fauxClient({
      erreurDeplace: 'postit_deplace_refuse : ce post-it n’est pas le tien'
    });
    await expect(
      deplacerPostit('p-001', { x: 10, y: 20, angle: 0 }, { chargerClient: async () => faux.client })
    ).rejects.toThrow(/ce post-it n’est pas le tien/);

    const vide = fauxClient();
    await expect(
      deplacerPostit('p-001', { x: 10, y: 20, angle: 0 }, { chargerClient: async () => vide.client })
    ).rejects.toThrow(/n’a pas rendu le post-it déplacé/);
  });

  it('sans configuration, déplacer lève avant tout appel', async () => {
    const faux = fauxClient();
    await expect(
      deplacerPostit('p-001', { x: 10, y: 20, angle: 0 }, { chargerClient: async () => null })
    ).rejects.toThrow(/pas configuré/);
    expect(faux.appelsRpc).toHaveLength(0);
  });

  it('une place hors du tableau est refusée avant de partir, et le refus est dit en français', () => {
    expect(verifierPosition({ x: -1, y: 20, angle: 0 })).toMatch(/entre 0 et 100/);
    expect(verifierPosition({ x: 10, y: 120, angle: 0 })).toMatch(/entre 0 et 100/);
    expect(verifierPosition({ x: 10, y: 20, angle: 9 })).toMatch(/-5 à 5/);
    expect(verifierPosition({ x: Number.NaN, y: 20, angle: 0 })).toMatch(/trois nombres/);
    expect(verifierPosition({ x: 10, y: 20, angle: 0 })).toBeNull();

    expect(messageDePlace('postit_deplace_refuse : ce post-it n’est pas le tien')).toMatch(/n’est pas le tien/);
    expect(messageDePlace('postit_deplace_hors_bornes')).toMatch(/sort du tableau/);
    expect(messageDePlace('postit_deplace_inconnu')).toMatch(/n’existe plus/);
    expect(messageDePlace('JWT expired')).toMatch(/session a expiré/);
  });

  it('une place déjà prise écarte le post-it neuf, et l’insertion part avec cette place', async () => {
    const faux = fauxClient();
    const prise = positionDepuisId('p-deja');
    const postit = await posterPostit(
      { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
      { chargerClient: async () => faux.client, id: 'p-neuf', positionsPrises: [prise] }
    );

    const ligne = faux.insertions[0].ligne;
    const ecart = Math.max(
      Math.abs(Number(ligne.position_x) - prise.x) / 22,
      Math.abs(Number(ligne.position_y) - prise.y) / 30
    );
    expect(ecart).toBeGreaterThanOrEqual(1);
    expect(postit.position).toEqual({
      x: Number(ligne.position_x),
      y: Number(ligne.position_y),
      angle: Number(ligne.position_angle)
    });
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

  it('une place déjà prise est évitée : le post-it neuf ne se colle pas sur le texte d’un autre (#185)', () => {
    const premiere = positionDepuisId('p-001');
    const seconde = positionDepuisId('p-002', [premiere]);

    // Sans les places prises, on retombe sur la place naturelle : rien n'a changé pour les murs existants.
    expect(positionDepuisId('p-002')).not.toEqual(seconde);
    // L'écart se mesure en post-its : une largeur ou une hauteur suffit à ne rien cacher.
    const ecart = Math.max(Math.abs(seconde.x - premiere.x) / 22, Math.abs(seconde.y - premiere.y) / 30);
    expect(ecart).toBeGreaterThanOrEqual(1);
    // Stable et borné : le même appel redonne la même place, dans le cadre du tableau.
    expect(positionDepuisId('p-002', [premiere])).toEqual(seconde);
    expect(seconde.x).toBeGreaterThanOrEqual(0);
    expect(seconde.x).toBeLessThanOrEqual(100);
    expect(seconde.y).toBeGreaterThanOrEqual(0);
    expect(seconde.y).toBeLessThanOrEqual(100);
  });

  it('un tableau déjà chargé ne fait pas sortir la place du cadre, même quand tout est pris', () => {
    const prises = [];
    for (let x = 0; x <= 100; x += 4) {
      for (let y = 0; y <= 100; y += 4) prises.push({ x, y, angle: 0 });
    }
    const place = positionDepuisId('p-042', prises);
    expect(place.x).toBeGreaterThanOrEqual(0);
    expect(place.x).toBeLessThanOrEqual(100);
    expect(place.y).toBeGreaterThanOrEqual(0);
    expect(place.y).toBeLessThanOrEqual(100);
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
        capture: 'https://exemple.test/capture.png'
      })
    ).toBe('Le retour.\n\nCapture : https://exemple.test/capture.png');

    expect(() =>
      texteAvecCapture({
        famille: 'IP',
        gueulage: false,
        titre: 'Une idée',
        texte: 'Le retour.',
        ecran: '',
        capture: 'pas-un-lien'
      })
    ).toThrow(/commencer par http/);
  });

  it('la ligne composée ne porte que les champs du contrat, et un écran vide vaut null', () => {
    const ligne = composerLignePostit(
      { famille: 'IP', gueulage: false, titre: 'Une idée', texte: 'Un texte.', ecran: '' },
      { pseudo: 'Employé 404', version: 'Alpha · 0.1.6', id: 'p-x' }
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
      ].sort()
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
      mesVotes: [{ postit_id: 'p-002', sens: 'up' }]
    });
    const postits = await chargerPostitsDuMur(async () => faux.client);

    // Le total vient de la vue ; mon vote, de mes lignes de `votes` — jamais mélangés.
    expect(postits?.[0]).toMatchObject({ id: 'p-001', votes: { up: 2, down: 1, mon: null }, mien: true });
    expect(postits?.[1]).toMatchObject({ id: 'p-002', votes: { up: 0, down: 0, mon: 'up' }, mien: false });
  });

  it('ne lit que MES votes : la lecture est filtrée sur mon identité', async () => {
    const faux = fauxClient({ lignes: [LIGNE] });
    await chargerPostitsDuMur(async () => faux.client);
    // La vue entière, puis **mes** votes — deux lectures, et le filtre est sur mon identité.
    expect(faux.lectures).toEqual([
      { table: 'postits_avec_votes', filtres: [] },
      { table: 'votes', filtres: [['votant', 'appareil-A']] }
    ]);
    // Aucune écriture à la lecture.
    expect(faux.ecritures).toHaveLength(0);
  });

  it('une panne de lecture de mes votes lève : la page retombe sur le fichier, sans pouces', async () => {
    const faux = fauxClient({ lignes: [LIGNE], erreurLectureVotes: 'TypeError: Failed to fetch' });
    await expect(chargerPostitsDuMur(async () => faux.client)).rejects.toThrow(/Lecture de tes votes impossible/);
  });

  it('sans configuration, voter n’écrit rien et le dit', async () => {
    await expect(voterPourPostit('p-001', 'up', null, { chargerClient: async () => null })).rejects.toThrow(
      /pas configuré/
    );
  });

  it('un premier vote est une insertion de `postit_id` et `sens` — jamais de `votant`', async () => {
    const faux = fauxClient();
    const apres = await voterPourPostit('p-001', 'up', null, { chargerClient: async () => faux.client });

    expect(apres).toBe('up');
    expect(faux.ecritures).toEqual([
      { table: 'votes', geste: 'insert', valeurs: { postit_id: 'p-001', sens: 'up' }, filtres: [] }
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
        ['votant', 'appareil-A']
      ]
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
          ['votant', 'appareil-A']
        ]
      }
    ]);
  });

  it('une erreur réseau lève : l’appelant rétablit l’affichage', async () => {
    const faux = fauxClient({ erreurVote: 'TypeError: Failed to fetch' });
    await expect(voterPourPostit('p-001', 'up', null, { chargerClient: async () => faux.client })).rejects.toThrow(
      /Le vote n’est pas passé \(TypeError: Failed to fetch\)/
    );
  });

  it('les refus de la base sont dits en français : pour soi, post-it effacé, double vote', async () => {
    const refus = async (erreurVote: string) => {
      const faux = fauxClient({ erreurVote });
      return voterPourPostit('p-001', 'up', null, { chargerClient: async () => faux.client }).catch(
        (erreur: Error) => erreur.message
      );
    };
    expect(await refus('new row violates row-level security policy for table "votes"')).toMatch(/propre post-it/);
    expect(await refus('insert or update on table "votes" violates foreign key constraint')).toMatch(/n’existe plus/);
    expect(await refus('duplicate key value violates unique constraint "votes_pkey"')).toMatch(/déjà voté/);
  });

  it('un retrait ou un changement qui ne touche aucune ligne est une erreur, pas un succès', async () => {
    const faux = fauxClient({ lignesTouchees: 0 });
    await expect(voterPourPostit('p-001', 'up', 'up', { chargerClient: async () => faux.client })).rejects.toThrow(
      /n’existe plus/
    );
    await expect(voterPourPostit('p-001', 'down', 'up', { chargerClient: async () => faux.client })).rejects.toThrow(
      /n’existe plus/
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

describe('le fil d’un post-it (#138)', () => {
  const LIGNE_COMMENTAIRE = {
    id: 7,
    postit_id: 'p-001',
    texte: 'Pareil chez moi.',
    pseudo: 'Employé 404',
    auteur: 'appareil-A',
    created_at: '2026-10-23T09:00:00.000Z'
  };

  it('lit les commentaires du plus ancien au plus récent, et distingue les miens sans donner l’identité d’un autre', async () => {
    const faux = fauxClient({
      commentaires: [LIGNE_COMMENTAIRE, { ...LIGNE_COMMENTAIRE, id: 8, auteur: 'appareil-B', pseudo: 'Anonyme' }]
    });
    const liste = await chargerCommentaires(async () => faux.client);

    expect(liste).toHaveLength(2);
    expect(liste[0]).toMatchObject({ id: 7, postitId: 'p-001', mien: true, pseudo: 'Employé 404' });
    expect(liste[1]).toMatchObject({ id: 8, mien: false });
    // La lecture est ordonnée par la base, du plus ancien au plus récent.
    expect(faux.lectures[0]).toEqual({ table: 'commentaires', filtres: [] });
    // `auteur` ne sort pas du module : l'écran n'a que la réponse à « est-ce le mien ? ».
    expect(liste[0]).not.toHaveProperty('auteur');
  });

  it('écarte une ligne illisible au lieu de l’afficher à moitié', () => {
    const lus = lireCommentaires(
      [LIGNE_COMMENTAIRE, { id: 'sept', postit_id: 'p-001', texte: 'x' }, { id: 9, postit_id: '' }],
      'appareil-A'
    );
    expect(lus).toHaveLength(1);
    expect(lus[0].id).toBe(7);
  });

  it('range le fil par post-it, dans l’ordre reçu', () => {
    const parPostit = grouperCommentaires([
      { id: 1, postitId: 'p-a', texte: 'un', pseudo: '', creeLe: '', mien: false },
      { id: 2, postitId: 'p-b', texte: 'deux', pseudo: '', creeLe: '', mien: false },
      { id: 3, postitId: 'p-a', texte: 'trois', pseudo: '', creeLe: '', mien: false }
    ]);
    expect(parPostit['p-a'].map((c) => c.texte)).toEqual(['un', 'trois']);
    expect(parPostit['p-b'].map((c) => c.texte)).toEqual(['deux']);
  });

  it('sans configuration, aucun commentaire et rien n’est contacté', async () => {
    const charger = vi.fn(async () => null);
    await expect(chargerCommentaires(charger)).resolves.toEqual([]);
    expect(charger).toHaveBeenCalledTimes(1);
  });

  it('une panne de lecture lève, pour que l’écran le dise sans jeter le mur', async () => {
    const faux = fauxClient({ erreurCommentaires: 'TypeError: Failed to fetch' });
    await expect(chargerCommentaires(async () => faux.client)).rejects.toThrow(/Lecture des commentaires impossible/);
  });

  it('commente sans jamais écrire `auteur`, et signe le pseudo local', async () => {
    const faux = fauxClient({ commentaire: LIGNE_COMMENTAIRE });
    const commentaire = await commenterPostit('p-001', '  Pareil chez moi.  ', {
      chargerClient: async () => faux.client,
      pseudo: 'Employé 404'
    });

    expect(faux.ecritures).toHaveLength(1);
    expect(faux.ecritures[0]).toMatchObject({ table: 'commentaires', geste: 'insert' });
    expect(faux.ecritures[0].valeurs).toEqual({
      postit_id: 'p-001',
      texte: 'Pareil chez moi.',
      pseudo: 'Employé 404'
    });
    expect(faux.ecritures[0].valeurs).not.toHaveProperty('auteur');
    expect(commentaire).toMatchObject({ id: 7, postitId: 'p-001', mien: true });
  });

  it('signe « anonyme » quand le pseudo local est vide', async () => {
    const faux = fauxClient({ commentaire: LIGNE_COMMENTAIRE });
    await commenterPostit('p-001', 'Pareil.', {
      chargerClient: async () => faux.client,
      pseudo: '   '
    });
    expect(faux.ecritures[0].valeurs?.pseudo).toBe('anonyme');
  });

  it('refuse un commentaire vide ou trop long, avant tout réseau', async () => {
    const faux = fauxClient({ commentaire: LIGNE_COMMENTAIRE });
    await expect(commenterPostit('p-001', '   ', { chargerClient: async () => faux.client })).rejects.toThrow(
      /vide ne dit rien/
    );
    await expect(
      commenterPostit('p-001', 'x'.repeat(LIMITE_COMMENTAIRE + 1), {
        chargerClient: async () => faux.client
      })
    ).rejects.toThrow(/au plus 500 caractères \(le tien en fait 501\)/);
    expect(faux.ecritures).toHaveLength(0);

    expect(verifierCommentaire('x'.repeat(LIMITE_COMMENTAIRE))).toBeNull();
    expect(verifierCommentaire('   ')).toMatch(/vide/);
  });

  it('les refus de la base sont dits en français', async () => {
    const refus = fauxClient({ erreurCommentaire: 'new row violates row-level security policy' });
    await expect(commenterPostit('p-001', 'Pareil.', { chargerClient: async () => refus.client })).rejects.toThrow(
      /ton compte doit être approuvé/
    );

    const disparu = fauxClient({ erreurCommentaire: 'violates foreign key constraint' });
    await expect(commenterPostit('p-001', 'Pareil.', { chargerClient: async () => disparu.client })).rejects.toThrow(
      /n’existe plus/
    );
  });

  it('ne retire que le mien : la requête vise l’id et mon identité', async () => {
    const faux = fauxClient();
    await supprimerCommentaire(7, { chargerClient: async () => faux.client });

    expect(faux.ecritures).toEqual([
      {
        table: 'commentaires',
        geste: 'delete',
        filtres: [
          ['id', 7],
          ['auteur', 'appareil-A']
        ]
      }
    ]);
  });

  it('un retrait qui ne touche aucune ligne est une erreur, pas un succès', async () => {
    const faux = fauxClient({ commentairesRetires: 0 });
    await expect(supprimerCommentaire(7, { chargerClient: async () => faux.client })).rejects.toThrow(/plus le tien/);
  });
});

describe('corriger ou retirer son post-it (#139)', () => {
  it('corrige par la fonction SQL, jamais par un update direct', async () => {
    const faux = fauxClient({
      correction: { ...LIGNE, titre: 'Corrigé', texte: 'Texte corrigé.' }
    });
    const corrige = await corrigerPostit(
      'p-001',
      { titre: '  Corrigé  ', texte: '  Texte corrigé.  ' },
      { chargerClient: async () => faux.client }
    );

    expect(faux.appelsRpc).toEqual([
      { nom: 'corriger_postit', params: { p_id: 'p-001', p_titre: 'Corrigé', p_texte: 'Texte corrigé.' } }
    ]);
    // Aucune écriture de table : le droit direct sur `titre` et `texte` n'existe plus (0006).
    expect(faux.ecritures).toHaveLength(0);
    expect(corrige).toEqual({ titre: 'Corrigé', texte: 'Texte corrigé.' });
  });

  it('refuse un titre ou un texte vide sans appeler la base', async () => {
    const faux = fauxClient();
    await expect(
      corrigerPostit('p-001', { titre: '  ', texte: 'Texte.' }, { chargerClient: async () => faux.client })
    ).rejects.toThrow(/ne peuvent pas être vides/);
    expect(faux.appelsRpc).toHaveLength(0);
  });

  it('un refus nommé de la base est traduit : statut bougé, post-it d’un autre, disparu', async () => {
    const traduit = async (erreurCorrection: string) => {
      const faux = fauxClient({ erreurCorrection });
      return corrigerPostit(
        'p-001',
        { titre: 'T', texte: 'X.' },
        {
          chargerClient: async () => faux.client
        }
      ).catch((erreur: Error) => erreur.message);
    };

    expect(await traduit('postit_corrige_trop_tard : le post-it a bougé de statut (« retenu »)')).toMatch(
      /a bougé de statut/
    );
    expect(await traduit('postit_corrige_refuse : ce post-it n’est pas le tien')).toMatch(/n’est pas le tien/);
    expect(await traduit('postit_corrige_inconnu : ce post-it n’existe plus')).toMatch(/n’existe plus/);
  });

  it('retire un post-it visé par son seul id : c’est la RLS qui sait qui a le droit (#186)', async () => {
    const faux = fauxClient();
    await retirerPostit('p-001', { chargerClient: async () => faux.client });

    expect(faux.ecritures).toEqual([
      {
        table: 'postits',
        geste: 'delete',
        // Pas de filtre sur `auteur` : l'administrateur retire le post-it d'un autre (`0007`).
        filtres: [['id', 'p-001']]
      }
    ]);
  });

  it('un retrait refusé par la base (0 ligne) est une erreur, et le dit', async () => {
    const faux = fauxClient({ lignesTouchees: 0 });
    // Le faux client ne rend « 1 ligne » que sur `votes` / `commentaires` ; une suppression
    // de `postits` y rend `null`, ce qui est exactement le cas « la base n'a rien retiré ».
    await expect(retirerPostit('p-001', { chargerClient: async () => faux.client })).rejects.toThrow(
      /n’a retiré aucun post-it/
    );
  });
});

describe('le tri par l’administration (0006)', () => {
  it('écarter exige une raison, un ticket est un entier positif, un statut existe', () => {
    expect(verifierTri({ statut: 'écarté', raison: '  ', ticket: null })).toMatch(/raison écrite/);
    expect(verifierTri({ statut: 'retenu', raison: '', ticket: 0 })).toMatch(/entier strictement positif/);
    expect(verifierTri({ statut: 'peut-être' as never, raison: '', ticket: null })).toMatch(/n’est pas un statut/);
    expect(verifierTri({ statut: 'écarté', raison: 'Hors périmètre.', ticket: 140 })).toBeNull();
    expect(verifierTri({ statut: 'fait', raison: '', ticket: null })).toBeNull();
  });

  it('envoie statut, raison et ticket sur la ligne visée, et rend ce que la base a écrit', async () => {
    const faux = fauxClient({ tri: { statut: 'en cours', raison: '', ticket: 140 } });
    const tri = await trierPostit(
      'p-001',
      { statut: 'en cours', raison: '  ', ticket: 140 },
      { chargerClient: async () => faux.client }
    );

    expect(faux.ecritures).toEqual([
      {
        table: 'postits',
        geste: 'update',
        valeurs: { statut: 'en cours', raison: '', ticket: 140 },
        filtres: [['id', 'p-001']]
      }
    ]);
    expect(tri).toEqual({ statut: 'en cours', raison: '', ticket: 140 });
  });

  it('un tri refusé par la base ne se déclare jamais réussi (0 ligne)', async () => {
    const faux = fauxClient();
    await expect(
      trierPostit(
        'p-001',
        { statut: 'retenu', raison: '', ticket: null },
        {
          chargerClient: async () => faux.client
        }
      )
    ).rejects.toThrow(/n’est peut-être pas administrateur/);
  });

  it('un refus de permission est dit en français', async () => {
    expect(messageDeTri('permission denied for table postits')).toMatch(/seul un administrateur/);
    expect(messageDeTri('violates check constraint "postits_ecarte_a_sa_raison"')).toMatch(/doit dire pourquoi/);
    expect(messageDeTri('violates check constraint "postits_statut_check"')).toMatch(/Ce statut n’existe pas/);
  });

  it('sans configuration, trier lève avant tout appel', async () => {
    await expect(
      trierPostit(
        'p-001',
        { statut: 'retenu', raison: '', ticket: null },
        {
          chargerClient: async () => null
        }
      )
    ).rejects.toThrow(/pas configuré/);
  });
});

describe('le repère du suivi, posé par la fonction (0008, #211, D-097 (5))', () => {
  it('sans base configurée, ne contacte rien et rend null', async () => {
    const vu = await marquerComiteVu({ chargerClient: async () => null });
    expect(vu).toBeNull();
  });

  it('passe par `marquer_comite_vu()`, sans paramètre et sans `update` de `comptes`', async () => {
    const faux = fauxClient({ vu: '2026-10-26T10:00:00.000Z' });
    const vu = await marquerComiteVu({ chargerClient: async () => faux.client });

    expect(vu).toBe('2026-10-26T10:00:00.000Z');
    expect(faux.appelsRpc).toEqual([{ nom: 'marquer_comite_vu', params: undefined }]);
    // **Jamais** un `update` de `comptes.vu_le` : une politique RLS ne distingue pas les
    // colonnes, et l'écrire en direct rouvrirait `etat` et `raison` à leur propriétaire,
    // que la 0005 réserve à l'administration (0008 le dit, et `supabase/comite.test.ts` le garde).
    expect(faux.ecritures).toEqual([]);
  });

  it('un compte absent est dit en français, pas en jargon SQL', async () => {
    const faux = fauxClient({
      erreurVu: 'comite_vu_sans_compte : il faut un compte pour marquer le suivi'
    });
    await expect(marquerComiteVu({ chargerClient: async () => faux.client })).rejects.toThrow(/un compte/);
  });
});

/**
 * Le compteur « choses à voir » (#212, D-097 (5)).
 *
 * Ce qu'il compte, et **rien d'autre** : (1) **mes** post-its dont le **statut** a bougé
 * depuis `vu_le` — la date que le déclencheur de 0008 pose sur le seul statut ; (2) les
 * **commentaires des autres** arrivés sur **mes** post-its. Ces tests gardent les trois
 * façons de se tromper : compter ce qui ne me concerne pas, crier pour du passé, et relire
 * le mur post-it par post-it (le N+1 que #212 interdit).
 */
describe('le compteur « choses à voir » du comité (#212, D-097 (5))', () => {
  const REPERE = '2026-10-26T10:00:00.000Z';

  /** Ce que la vue rend pour **mes** post-its : `id`, `created_at` et `updated_at`. */
  const MIENS = [
    // Le statut a bougé : `updated_at` est postérieur à la création **et** au repère.
    {
      id: 'p-mien-1',
      created_at: '2026-10-20T09:00:00.000Z',
      updated_at: '2026-10-26T11:00:00.000Z'
    },
    // Rien depuis le repère, et pas de statut bougé : `updated_at = created_at`.
    {
      id: 'p-mien-2',
      created_at: '2026-10-25T09:00:00.000Z',
      updated_at: '2026-10-25T09:00:00.000Z'
    },
    // Le statut a bougé : postérieur à la création **et** au repère.
    {
      id: 'p-mien-3',
      created_at: '2026-10-21T09:00:00.000Z',
      updated_at: '2026-10-26T12:00:00.000Z'
    }
  ];

  /**
   * Un post-it **neuf** : `updated_at` reçoit `now()` au même instant que `created_at` (0008),
   * donc les deux dates sont égales. Son statut n'a jamais bougé — D-097 (5) ne compte que
   * les statuts **changés**, et la pastille ne doit pas crier pour ce que je viens de poser
   * (#239).
   */
  const NEUF = {
    id: 'p-neuf',
    created_at: '2026-10-26T11:00:00.000Z',
    updated_at: '2026-10-26T11:00:00.000Z'
  };

  const COMMENTAIRES = [
    // Un autre, après le repère : compte.
    { postit_id: 'p-mien-1', auteur: 'autre', created_at: '2026-10-26T11:30:00.000Z' },
    // Le mien, après le repère : ne compte jamais (D-097 (5)).
    { postit_id: 'p-mien-2', auteur: 'appareil-A', created_at: '2026-10-26T11:45:00.000Z' },
    // Un autre, mais avant le repère : du passé, il ne réveille personne.
    { postit_id: 'p-mien-3', auteur: 'autre', created_at: '2026-10-25T08:00:00.000Z' }
  ];

  it('sans base configurée, ne contacte rien et rend null (repli inerte)', async () => {
    const charger = vi.fn(async () => null);
    await expect(compterChosesAVoir({ chargerClient: charger })).resolves.toBeNull();
    expect(charger).toHaveBeenCalledTimes(1);
  });

  it('compte mes statuts bougés et les commentaires des autres — 3, pas 5', async () => {
    const faux = fauxClient({
      repere: [{ vu_le: REPERE }],
      lignes: MIENS,
      commentaires: COMMENTAIRES
    });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(3);
  });

  it('ne lit que ce qui me concerne, et les commentaires en **une** requête (pas de N+1)', async () => {
    const faux = fauxClient({
      repere: [{ vu_le: REPERE }],
      lignes: MIENS,
      commentaires: []
    });
    await compterChosesAVoir({ chargerClient: async () => faux.client });

    // Le filtre d'auteur est **côté base** : la lecture ne remonte que mes post-its.
    expect(faux.lectures.find((l) => l.table === 'postits_avec_votes')?.filtres).toEqual([['auteur', 'appareil-A']]);
    // Trois post-its, **une** lecture de commentaires : le `in` porte tous les ids d'un coup.
    const commentaires = faux.lectures.filter((l) => l.table === 'commentaires');
    expect(commentaires).toHaveLength(1);
    expect(commentaires[0].filtres).toEqual([['postit_id in', 'p-mien-1,p-mien-2,p-mien-3']]);
  });

  it('un post-it neuf ne compte pas : son statut n’a jamais bougé (#239)', async () => {
    const faux = fauxClient({ repere: [{ vu_le: REPERE }], lignes: [NEUF], commentaires: [] });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(0);
  });

  it('un post-it neuf posé à côté d’un statut changé : 2, pas 3 (#239)', async () => {
    const faux = fauxClient({
      repere: [{ vu_le: REPERE }],
      lignes: [...MIENS, NEUF],
      commentaires: []
    });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(2);
  });

  it('rend 0 quand rien n’a bougé depuis le repère', async () => {
    const faux = fauxClient({
      repere: [{ vu_le: '2026-10-26T23:00:00.000Z' }],
      lignes: MIENS,
      commentaires: COMMENTAIRES
    });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(0);
  });

  it('sans repère lisible, ne crie pas : 0 (le repère se pose à l’ouverture du suivi)', async () => {
    const faux = fauxClient({ repere: [], lignes: MIENS, commentaires: COMMENTAIRES });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(0);
  });

  it('aucun post-it à moi : le compteur rend 0 sans lire les commentaires', async () => {
    const faux = fauxClient({ repere: [{ vu_le: REPERE }], lignes: [], commentaires: COMMENTAIRES });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(0);
    expect(faux.lectures.filter((l) => l.table === 'commentaires')).toHaveLength(0);
  });

  it('le compteur relu après l’ouverture du suivi rend 0 (`marquerComiteVu`, #211)', async () => {
    const faux = fauxClient({
      repere: [{ vu_le: REPERE }],
      lignes: MIENS,
      commentaires: COMMENTAIRES,
      // Le repère que `marquer_comite_vu()` rend, et que la « base » du faux pose ensuite.
      vu: '2026-10-26T13:00:00.000Z'
    });

    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(3);
    // Ouvrir **Le suivi** pose le repère — le geste existe déjà (#211) et n'est fait qu'une fois.
    await marquerComiteVu({ chargerClient: async () => faux.client });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).resolves.toBe(0);
  });

  it('lève quand la base refuse le repère : la pastille n’invente pas un zéro', async () => {
    const faux = fauxClient({ erreurRepere: 'TypeError: Failed to fetch' });
    await expect(compterChosesAVoir({ chargerClient: async () => faux.client })).rejects.toThrow(
      /repère du comité impossible/
    );
  });
});
