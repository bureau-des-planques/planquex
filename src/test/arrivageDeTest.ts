/**
 * **Le faux serveur d'Arrivage** des tests (#651, D-179 (2)).
 *
 * `openPack` demande maintenant les cartes à l'Edge Function. Un test ne touche **jamais**
 * le réseau : il branche ici une configuration, un jeton et un `fetch` factices, par la
 * couture `definirSourcesArrivage` de `@/lib/arrivage`.
 *
 * Le tirage rendu par défaut est un vrai tirage de `@/game/pack` (graine 7), donc les
 * cartes sont celles du catalogue et l'écran peut les afficher.
 */
import { vi, type Mock } from 'vitest';
import { openPackCards } from '@/game/pack';
import { seedRng } from '@/game/rng';
import type { Card } from '@/data/types';
import { definirSourcesArrivage, type ReponseArrivage, type SourcesArrivage } from '@/lib/arrivage';

/** Cinq cartes réelles, tirées avec la règle du jeu — de quoi afficher une scène. */
export const CARTES_ARRIVAGE: Card[] = openPackCards({ rng: seedRng(7) });

/** La graine qu'annonce la fausse réponse (le client ne s'en sert pas pour créditer). */
export const GRAINE_ARRIVAGE = 7;

export interface OptionsFauxServeur {
  /** Les cartes rendues ; par défaut `CARTES_ARRIVAGE`. */
  cartes?: readonly Card[];
  /** Le statut HTTP ; 200 par défaut. */
  statut?: number;
  /** Le jeton de session ; `null` fige le cas « personne n'est connecté ». */
  jeton?: string | null;
  /** Le réseau est-il là ? `true` par défaut. */
  enLigne?: boolean;
  /** Un `fetch` de remplacement (panne réseau, réponse illisible…). */
  fetchImpl?: SourcesArrivage['fetchImpl'];
}

/** Une réponse HTTP factice, construite sans réseau. */
export function reponseArrivage(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Branche un faux serveur pour le test courant. Rend le `fetch` factice, ce qui permet
 * d'inspecter les appels (nombre, corps, clé d'idempotence).
 */
export function simulerArrivage(options: OptionsFauxServeur = {}): Mock {
  const cartes = options.cartes ?? CARTES_ARRIVAGE;
  const corps: ReponseArrivage = {
    cards: cartes.map((carte) => ({ id: carte.id, rarity: carte.rarity })),
    seed: GRAINE_ARRIVAGE
  };
  const fetchImpl = options.fetchImpl ?? vi.fn(async () => reponseArrivage(corps, options.statut ?? 200));

  definirSourcesArrivage({
    configuration: { url: 'https://exemple.test', clePublique: 'sb_publishable_test' },
    jeton: async () => (options.jeton === undefined ? 'jeton-test' : options.jeton),
    enLigne: () => options.enLigne ?? true,
    fetchImpl
  });
  return fetchImpl as unknown as Mock;
}

/** La clé d'idempotence du `n`-ième appel (0 par défaut). */
export function cleAppelee(fetchImpl: Mock, appel = 0): string {
  const init = fetchImpl.mock.calls[appel]?.[1] as RequestInit | undefined;
  const corps = JSON.parse(String(init?.body ?? '{}')) as { cle?: string };
  return corps.cle ?? '';
}

/** Remet les sources de production — à appeler après chaque test. */
export function reinitialiserArrivage(): void {
  definirSourcesArrivage(null);
}
