/**
 * Le mur des tests d'écran : le **vrai** port, sur une source de fortune (#254).
 *
 * Les tests de page décident ce que « la base » répond avec un `vi.fn()` par geste
 * (`charger`, `voter`, `corriger`…). Depuis #254 les pages ne touchent plus qu'un seul point
 * d'entrée, `murDuJeu()` : ces tests le remplacent par `portDepuisMocks(mocks)`, qui branche
 * `creerMur` — le vrai port, avec ses contrôles, ses messages et son repli sur le fichier —
 * sur un adapter dont chaque geste appelle le `vi.fn()` correspondant. Une exception levée
 * par le mock devient donc un `{ ok: false, message }` **par le port**, pas par la doublure.
 *
 * Les `vi.fn()` gardent la forme qu'ils avaient : `voter(id, demande, actuel)` reçoit le vote
 * **d'avant**, que le port a transformé en geste (`inserer` / `changer` / `retirer`) et que
 * la doublure retraduit à l'identique.
 */
import { creerMur, type AdaptateurMur, type GesteVote } from '@/lib/mur';
import type { GestesMur } from '@/lib/useMur';
import { adaptateurFichier } from '@/lib/murAdaptateurs';
import type { SensVote } from '@/store/mur';

type Mock = (...args: never[]) => unknown;

export interface MocksMur {
  charger?: Mock;
  poster?: Mock;
  voter?: Mock;
  trier?: Mock;
  deplacer?: Mock;
  corriger?: Mock;
  retirer?: Mock;
}

/** Le vote qu'avait le compte avant ce geste : l'inverse de `gesteDeVote`. */
function voteAvant(geste: GesteVote, demande: SensVote): SensVote | null {
  if (geste === 'inserer') return null;
  if (geste === 'retirer') return demande;
  return demande === 'up' ? 'down' : 'up';
}

export function portDepuisMocks(mocks: MocksMur, options: { secours?: boolean } = {}): GestesMur {
  const appeler = (nom: keyof MocksMur) => {
    const geste = mocks[nom] as ((...args: unknown[]) => unknown) | undefined;
    if (!geste) throw new Error(`Le test n’a pas prévu le geste « ${nom} ».`);
    return geste;
  };

  const adaptateur: AdaptateurMur = {
    source: 'base',
    refus: () => null,
    charger: async () => ((await appeler('charger')()) ?? []) as never,
    poster: async (ligne) => (await appeler('poster')(ligne)) as never,
    voter: async (id, demande, geste) => {
      await appeler('voter')(id, demande, voteAvant(geste, demande));
    },
    trier: async (id, tri) => (await appeler('trier')(id, tri)) as never,
    deplacer: async (id, position) => (await appeler('deplacer')(id, position)) as never,
    corriger: async (id, correction) => (await appeler('corriger')(id, correction)) as never,
    retirer: async (id) => {
      await appeler('retirer')(id);
    }
  };

  return creerMur(adaptateur, options.secours === false ? {} : { secours: adaptateurFichier() });
}
