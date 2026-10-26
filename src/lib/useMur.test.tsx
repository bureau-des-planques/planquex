// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { creerMur, type AdaptateurMur } from '@/lib/mur';
import { adaptateurMemoire } from '@/lib/murAdaptateurs';
import { useMur, type LectureFichier } from '@/lib/useMur';
import type { Postit } from '@/store/mur';

/**
 * L'état optimiste des trois pages (#254, 2e partie), éprouvé **sans écran ni réseau** :
 * le vrai port, sur l'adapter mémoire.
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. un geste **refusé** rend l'état **rollbacké** — le compteur d'un pouce revient à l'état
 *    d'avant, le message du port est rangé **sur le post-it** (« le contrôle mord ») ;
 * 2. un geste optimiste **bouge tout de suite**, avant la réponse de la source ;
 * 3. un double geste sur le même post-it **ne part pas deux fois** ;
 * 4. une base qui ne répond pas **retombe sur le fichier**, avec la notice du port.
 */
afterEach(cleanup);

const POSTIT: Postit = {
  id: 'p-autre',
  kind: 'IP',
  titre: 'Idée d’un collègue',
  texte: 'Un texte.',
  ecran: 'Combat',
  pseudo: 'Employé 404',
  version: 'Alpha · test',
  statut: 'en attente',
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null,
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 2, down: 1, mon: null },
  mien: false
};

const SANS_FICHIER: LectureFichier = { mur: null, erreurs: [] };

/** Le mur d'une page branchée : la base répond, avec ce post-it. */
function monter(adaptateur: AdaptateurMur, lecture: LectureFichier = SANS_FICHIER, secours?: AdaptateurMur) {
  const mur = creerMur(adaptateur, secours ? { secours } : {});
  return renderHook(() => useMur({ branche: true, lecture, mur }));
}

/** Une source dont les votes attendent qu'on les libère : pour regarder **pendant** le vol. */
function sourceEnAttente(base: AdaptateurMur) {
  let libere: (() => void) | undefined;
  const porte = new Promise<void>((resolve) => {
    libere = resolve;
  });
  return {
    adaptateur: {
      ...base,
      voter: async (...args: Parameters<AdaptateurMur['voter']>) => {
        await porte;
        return base.voter(...args);
      }
    } satisfies AdaptateurMur,
    libere: () => libere?.()
  };
}

describe('un geste optimiste bouge tout de suite, puis revient si la source refuse', () => {
  it('un vote accepté : le compteur bouge avant la réponse, et y reste', async () => {
    const memoire = adaptateurMemoire([POSTIT], { mien: false });
    const { adaptateur, libere } = sourceEnAttente(memoire);
    const { result } = monter(adaptateur);
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    let vote!: Promise<unknown>;
    act(() => {
      vote = result.current.voter(POSTIT, 'up');
    });
    // Pendant le vol : le pouce est déjà posé, et le post-it est « en vol ».
    expect(result.current.mur?.postits[0].votes).toEqual({ up: 3, down: 1, mon: 'up' });
    expect(result.current.enVol('voter', 'p-autre')).toBe(true);

    libere();
    await act(async () => {
      await vote;
    });
    expect(result.current.mur?.postits[0].votes).toEqual({ up: 3, down: 1, mon: 'up' });
    expect(result.current.enVol('voter', 'p-autre')).toBe(false);
    expect(result.current.erreur('voter', 'p-autre')).toBeNull();
  });

  it('un vote refusé : le compteur revient EXACTEMENT à l’état d’avant, avec le message', async () => {
    // La source dit que ce post-it est le mien : elle refuse le vote, comme la RLS.
    const memoire = adaptateurMemoire([POSTIT], { mien: true });
    const { adaptateur, libere } = sourceEnAttente(memoire);
    const { result } = monter(adaptateur);
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    let vote!: Promise<unknown>;
    act(() => {
      vote = result.current.voter(POSTIT, 'up');
    });
    expect(result.current.mur?.postits[0].votes.mon).toBe('up'); // l'optimiste a bougé…

    libere();
    await act(async () => {
      await vote;
    });
    // …et le refus l'a défait : ce qui était affiché avant est affiché après.
    expect(result.current.mur?.postits[0].votes).toEqual(POSTIT.votes);
    expect(result.current.erreur('voter', 'p-autre')).toMatch(/on ne vote pas pour son propre post-it/);
    expect(result.current.enVol('voter', 'p-autre')).toBe(false);
  });

  it('un nouveau clic efface le refus d’avant tant qu’il vole', async () => {
    const memoire = adaptateurMemoire([POSTIT], { mien: true });
    const { adaptateur, libere } = sourceEnAttente(memoire);
    const { result } = monter(adaptateur);
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    let premier!: Promise<unknown>;
    act(() => {
      premier = result.current.voter(POSTIT, 'up');
    });
    libere();
    await act(async () => {
      await premier;
    });
    expect(result.current.erreur('voter', 'p-autre')).not.toBeNull();

    let second!: Promise<unknown>;
    act(() => {
      second = result.current.voter(POSTIT, 'down');
    });
    expect(result.current.erreur('voter', 'p-autre')).toBeNull();
    await act(async () => {
      await second;
    });
    expect(result.current.erreur('voter', 'p-autre')).not.toBeNull();
  });

  it('on ne vote pas pour son post-it, et rien ne part', async () => {
    const memoire = adaptateurMemoire([{ ...POSTIT, mien: true }], { mien: true });
    const { result } = monter(memoire);
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    await act(async () => {
      expect(await result.current.voter({ ...POSTIT, mien: true }, 'up')).toBeNull();
    });
    expect(result.current.mur?.postits[0].votes).toEqual(POSTIT.votes);
    expect(result.current.erreur('voter', 'p-autre')).toBeNull();
  });
});

describe('un double geste sur le même post-it ne part pas deux fois', () => {
  it('le second clic est refusé tant que le premier vole', async () => {
    let appels = 0;
    const memoire = adaptateurMemoire([POSTIT], { mien: false });
    const { adaptateur, libere } = sourceEnAttente({
      ...memoire,
      voter: async (...args) => {
        appels += 1;
        return memoire.voter(...args);
      }
    });
    const { result } = monter(adaptateur);
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    let premier!: Promise<unknown>;
    let second: unknown;
    act(() => {
      premier = result.current.voter(POSTIT, 'up');
    });
    await act(async () => {
      second = await result.current.voter(POSTIT, 'up');
    });
    expect(second).toMatchObject({ ok: false });

    libere();
    await act(async () => {
      await premier;
    });
    expect(appels).toBe(1);
    expect(result.current.mur?.postits[0].votes).toEqual({ up: 3, down: 1, mon: 'up' });
  });
});

describe('les autres gestes appliquent la réussite, ou rangent le refus sur le post-it', () => {
  it('corriger : le titre et le texte changent après la réponse', async () => {
    const { result } = monter(adaptateurMemoire([{ ...POSTIT, mien: true }], { mien: true }));
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    await act(async () => {
      await result.current.corriger('p-autre', { titre: ' Neuf ', texte: ' Dit mieux. ' });
    });
    expect(result.current.mur?.postits[0]).toMatchObject({ titre: 'Neuf', texte: 'Dit mieux.' });
  });

  it('corriger un post-it qui a bougé de statut : refusé, texte intact, message sur le post-it', async () => {
    const trie: Postit = { ...POSTIT, mien: true, statut: 'retenu' };
    const { result } = monter(adaptateurMemoire([trie], { mien: true }));
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    await act(async () => {
      await result.current.corriger('p-autre', { titre: 'Neuf', texte: 'Neuf.' });
    });
    expect(result.current.mur?.postits[0].titre).toBe(POSTIT.titre);
    expect(result.current.erreur('corriger', 'p-autre')).toMatch(/a bougé de statut/);
  });

  it('retirer : le post-it sort du mur seulement quand la source l’a supprimé', async () => {
    const lui: Postit = { ...POSTIT, mien: true, statut: 'retenu' };
    const sansDroit = monter(adaptateurMemoire([lui], { mien: true, administrateur: false }));
    await waitFor(() => expect(sansDroit.result.current.mur?.postits).toHaveLength(1));
    await act(async () => {
      await sansDroit.result.current.retirer('p-autre');
    });
    expect(sansDroit.result.current.mur?.postits).toHaveLength(1);
    expect(sansDroit.result.current.erreur('retirer', 'p-autre')).toMatch(/n’a retiré aucun post-it/);

    const admin = monter(adaptateurMemoire([lui], { administrateur: true }));
    await waitFor(() => expect(admin.result.current.mur?.postits).toHaveLength(1));
    await act(async () => {
      await admin.result.current.retirer('p-autre');
    });
    expect(admin.result.current.mur?.postits).toHaveLength(0);
  });

  it('trier : le statut écrit remplace celui du post-it ; un écarté sans raison est refusé par le port', async () => {
    const { result } = monter(adaptateurMemoire([POSTIT], { administrateur: true }));
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    await act(async () => {
      await result.current.trier('p-autre', { statut: 'écarté', raison: ' ', ticket: null });
    });
    expect(result.current.mur?.postits[0].statut).toBe('en attente');
    expect(result.current.erreur('trier', 'p-autre')).toMatch(/exige une raison écrite/);

    await act(async () => {
      await result.current.trier('p-autre', { statut: 'en cours', raison: '', ticket: 254 });
    });
    expect(result.current.mur?.postits[0]).toMatchObject({ statut: 'en cours', ticket: 254 });
    expect(result.current.erreur('trier', 'p-autre')).toBeNull();
  });

  it('poster : le post-it rejoint le mur après la réponse', async () => {
    const { result } = monter(adaptateurMemoire([POSTIT]));
    await waitFor(() => expect(result.current.mur?.postits).toHaveLength(1));

    let resultat: Awaited<ReturnType<typeof result.current.poster>> | undefined;
    await act(async () => {
      resultat = await result.current.poster({
        famille: 'IP',
        gueulage: false,
        titre: 'Un titre',
        texte: 'Un texte.',
        ecran: ''
      });
    });
    expect(resultat?.ok).toBe(true);
    expect(result.current.mur?.postits.map((postit) => postit.titre)).toEqual(['Idée d’un collègue', 'Un titre']);
  });
});

describe('la lecture : la source et la notice viennent du port', () => {
  const FICHIER: LectureFichier = {
    mur: { formulaire: 'https://exemple.test/formulaire', postits: [{ ...POSTIT, id: 'p-fichier' }] },
    erreurs: []
  };

  it('une base qui répond : source « base », pas de notice, formulaire du fichier gardé', async () => {
    const { result } = monter(adaptateurMemoire([POSTIT]), FICHIER);
    expect(result.current.chargement).toBe(true);
    expect(result.current.mur).toBeNull();

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.source).toBe('base');
    expect(result.current.notice).toBeNull();
    expect(result.current.mur?.formulaire).toBe('https://exemple.test/formulaire');
  });

  it('une base muette : le fichier ENTIER, et la notice dit la panne', async () => {
    const muette: AdaptateurMur = {
      ...adaptateurMemoire([]),
      charger: async () => {
        throw new Error('TypeError: Failed to fetch');
      }
    };
    const { result } = monter(muette, FICHIER);

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.source).toBe('fichier');
    expect(result.current.mur?.postits.map((postit) => postit.id)).toEqual(['p-fichier']);
    expect(result.current.notice).toMatch(/La base n’a pas répondu/);
    expect(result.current.notice).toMatch(/Failed to fetch/);
  });

  it('sans repli (l’administration) : la panne est rendue, le fichier n’est pas trié à sa place', async () => {
    const muette: AdaptateurMur = {
      ...adaptateurMemoire([]),
      charger: async () => {
        throw new Error('TypeError: Failed to fetch');
      }
    };
    const mur = creerMur(muette);
    const { result } = renderHook(() => useMur({ branche: true, lecture: FICHIER, repli: false, mur }));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.erreurChargement).toMatch(/Failed to fetch/);
    expect(result.current.mur).toBeNull();
    expect(result.current.notice).toBeNull();
  });

  it('non branché : le fichier est là d’emblée, et le port n’est pas appelé', () => {
    let lectures = 0;
    const adaptateur: AdaptateurMur = {
      ...adaptateurMemoire([]),
      charger: async () => {
        lectures += 1;
        return [];
      }
    };
    const mur = creerMur(adaptateur);
    const { result } = renderHook(() => useMur({ branche: false, lecture: FICHIER, mur }));

    expect(result.current.chargement).toBe(false);
    expect(result.current.mur?.postits.map((postit) => postit.id)).toEqual(['p-fichier']);
    expect(lectures).toBe(0);
  });
});
