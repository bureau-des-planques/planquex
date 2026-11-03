/**
 * **Le faux serveur de Deck** des tests (#491, D-153 (3)).
 *
 * `synchroniserDeck` envoie le lot à `public.rejouer_deck`. Un test ne touche **jamais** le
 * réseau : il branche ici une configuration, un jeton et un `fetch` factices, par la couture
 * `definirSourcesDeck` de `@/lib/deck`.
 */
import { vi, type Mock } from 'vitest';
import { definirSourcesDeck, type OperationDeck, type SourcesDeck } from '@/lib/deck';

export interface OptionsFauxServeurDeck {
  /** La configuration du backend ; celle de test par défaut, `null` pour « pas de backend ». */
  configuration?: SourcesDeck['configuration'];
  /** Le statut HTTP ; 200 par défaut. */
  statut?: number;
  /** Le jeton de session ; `null` fige le cas « personne n'est connecté ». */
  jeton?: string | null;
  /** Le réseau est-il là ? `true` par défaut. */
  enLigne?: boolean;
  /** Un `fetch` de remplacement (panne réseau, réponse illisible…). */
  fetchImpl?: SourcesDeck['fetchImpl'];
}

/** Une réponse HTTP factice, construite sans réseau. */
export function reponseDeck(corps: unknown = [], statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Branche un faux serveur de Deck pour le test courant. Rend le `fetch` factice, ce qui
 * permet d'inspecter les appels (nombre, URL, clé d'idempotence, opérations).
 */
export function simulerDeck(options: OptionsFauxServeurDeck = {}): Mock {
  const fetchImpl = options.fetchImpl ?? vi.fn(async () => reponseDeck([], options.statut ?? 200));

  definirSourcesDeck({
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

/** Le corps du `n`-ième appel au rejeu (0 par défaut). */
export function corpsDeck(fetchImpl: Mock, appel = 0): { p_operations: OperationDeck[]; p_cle: string } {
  const init = fetchImpl.mock.calls[appel]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? '{}')) as { p_operations: OperationDeck[]; p_cle: string };
}

/** Remet les sources de production — à appeler après chaque test. */
export function reinitialiserDeck(): void {
  definirSourcesDeck(null);
}
