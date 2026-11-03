/**
 * **Le faux serveur de Collection** des tests (#493, D-179 (3)).
 *
 * `synchroniserCollection` relit la table `public.collection`. Un test ne touche **jamais**
 * le réseau : il branche ici une configuration, un jeton et un `fetch` factices, par la
 * couture `definirSourcesCollection` de `@/lib/collection`.
 */
import { vi, type Mock } from 'vitest';
import { definirSourcesCollection, type SourcesCollection } from '@/lib/collection';

/** Une ligne de `public.collection`, telle que PostgREST la rend. */
export interface LigneCollectionTest {
  carte_id: string;
  quantite: number;
}

export interface OptionsFauxServeurCollection {
  /** La configuration du backend ; celle de test par défaut, `null` pour « pas de backend ». */
  configuration?: SourcesCollection['configuration'];
  /** Les lignes rendues ; vide par défaut. */
  lignes?: readonly LigneCollectionTest[];
  /** Le statut HTTP ; 200 par défaut. */
  statut?: number;
  /** Le jeton de session ; `null` fige le cas « personne n'est connecté ». */
  jeton?: string | null;
  /** Le réseau est-il là ? `true` par défaut. */
  enLigne?: boolean;
  /** Un `fetch` de remplacement (panne réseau, réponse illisible…). */
  fetchImpl?: SourcesCollection['fetchImpl'];
}

/** Une réponse HTTP factice, construite sans réseau. */
export function reponseCollection(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Branche un faux serveur de Collection pour le test courant. Rend le `fetch` factice, ce
 * qui permet d'inspecter les appels (nombre, URL, en-têtes).
 */
export function simulerCollection(options: OptionsFauxServeurCollection = {}): Mock {
  const lignes = options.lignes ?? [];
  const fetchImpl = options.fetchImpl ?? vi.fn(async () => reponseCollection(lignes, options.statut ?? 200));

  definirSourcesCollection({
    configuration:
      options.configuration === undefined
        ? { url: 'https://exemple.test', clePublique: 'sb_publishable_test' }
        : options.configuration,
    jeton: async () => (options.jeton === undefined ? 'jeton-test' : options.jeton),
    enLigne: () => options.enLigne ?? true,
    fetchImpl
  });
  return fetchImpl as unknown as Mock;
}

/** Remet les sources de production — à appeler après chaque test. */
export function reinitialiserCollection(): void {
  definirSourcesCollection(null);
}
