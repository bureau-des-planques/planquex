/**
 * **Ouvrir un Arrivage** — la couture réseau du client (#651, D-179 (2)).
 *
 * Le serveur tire et crédite (`supabase/functions/ouvrir-arrivage`) ; le client **demande**
 * et n'avance plus de générateur. Ce module porte la demande, ses refus et ses reprises :
 * `@/store/useStore` s'en sert, `@/pages/Home` lit la **raison** de l'échec pour son état.
 *
 * **La demande ne porte qu'une chose : la clé d'idempotence** choisie par le client. Ni
 * cartes, ni graine — c'est le serveur qui décide ce qui est acquis (D-179 (1)). Rejouer
 * la même clé rend les cartes d'origine sans recréditer : c'est ce qui rend le retry et le
 * double clic inoffensifs, à condition que le client **garde sa clé jusqu'au succès**
 * (c'est `openPack` qui la garde, pas ce module).
 *
 * **Hors ligne, on refuse sans appel** (D-179 (6)) : `navigator.onLine === false` rend
 * `hors-ligne` immédiatement, `fetch` n'est jamais touché. Il n'y a ni file d'attente ni
 * tirage local — les Arrivages étant illimités, le manque est « pas maintenant ».
 *
 * **Les trois raisons que l'écran distingue** (`RaisonArrivage`) : `hors-ligne`, `refus`
 * (401/403 — pas de compte, jeton invalide : « connecte-toi pour ouvrir »), `reseau`
 * (l'appel n'a pas abouti, on peut réessayer). `configuration` est le quatrième cas, pour
 * un build sans backend : l'écran le dit au lieu de faire semblant.
 *
 * **Les sources sont injectables** (`SourcesArrivage`) : c'est la même couture que
 * `ouvrirNavigateur(url, lancer)` — un test branche une configuration, un jeton et un
 * `fetch` factices, et **aucun appel réseau réel** n'a lieu. `definirSourcesArrivage(null)`
 * remet celles de production.
 */
import { getCard } from '@/data';
import type { Card } from '@/data/types';
import { configurerMur, jetonSession } from '@/lib/supabase';
import type { ConfigurationMur } from '@/lib/supabase';

/** Le nom de l'Edge Function, tel que Supabase la sert. */
export const FONCTION_ARRIVAGE = 'ouvrir-arrivage';

/**
 * Pourquoi une ouverture n'a pas abouti. L'écran s'en sert (D-060 (3)) :
 *
 * - `hors-ligne` : pas de réseau, aucun appel émis ;
 * - `refus` : le serveur a dit non (401/403) — pas de compte, session expirée ;
 * - `reseau` : l'appel ou la réponse n'a pas abouti ; réessayer avec la **même** clé ;
 * - `configuration` : pas de backend branché (build sans `.env`) — rien à contacter.
 */
export type RaisonArrivage = 'hors-ligne' | 'refus' | 'reseau' | 'configuration';

/** L'échec d'une ouverture, **nommé** par sa raison : l'écran ne lit pas un message brut. */
export class ErreurArrivage extends Error {
  constructor(
    readonly raison: RaisonArrivage,
    message: string
  ) {
    super(message);
    this.name = 'ErreurArrivage';
  }
}

/**
 * Ce dont une ouverture a besoin du dehors. Tout est injectable pour que le test n'ouvre
 * aucun réseau (AGENTS.md §6 : « injecter le lanceur »).
 */
export interface SourcesArrivage {
  /** La configuration Supabase, ou `null` quand le backend n'est pas branché. */
  configuration: ConfigurationMur | null;
  /** Le jeton de la session — `null` quand personne n'est connecté. */
  jeton: () => Promise<string | null>;
  /** Le réseau est-il là ? Lit `navigator.onLine` en production. */
  enLigne: () => boolean;
  /** L'appel HTTP, résolu **à l'appel** pour qu'un test puisse le remplacer. */
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Ce qu'une ouverture réussie rend : les cartes créditées, dans l'ordre du serveur. */
export interface ReponseArrivage {
  cards: { id: string; rarity?: string }[];
  seed?: number;
}

/** Les sources de production : la configuration du mur, la session, et le vrai `fetch`. */
export function sourcesArrivage(): SourcesArrivage {
  return {
    configuration: lireConfiguration(),
    jeton: () => jetonSession(),
    enLigne: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    fetchImpl: (url, init) => fetch(url, init)
  };
}

/** Une configuration **cassée** est un refus nommé, pas une exception qui fuit. */
function lireConfiguration(): ConfigurationMur | null {
  try {
    return configurerMur();
  } catch {
    return null;
  }
}

/** Les sources remplacées par un test ; `null` = celles de production. */
let sourcesRemplacees: SourcesArrivage | null = null;

/**
 * Remplace les sources d'ouverture. **Réservé aux tests** : l'écran et le store ne
 * l'appellent jamais. `null` remet la production.
 */
export function definirSourcesArrivage(sources: SourcesArrivage | null): void {
  sourcesRemplacees = sources;
}

/** L'URL de l'Edge Function, construite sur `VITE_SUPABASE_URL`. */
export function urlArrivage(configuration: ConfigurationMur): string {
  return `${configuration.url.replace(/\/+$/, '')}/functions/v1/${FONCTION_ARRIVAGE}`;
}

/**
 * Demande **une** ouverture au serveur. Ne crédite rien localement : le store le fait avec
 * les cartes rendues. Lève une `ErreurArrivage` nommée, jamais une erreur nue.
 *
 * `cle` doit être **stable** pour une même ouverture : c'est l'appelant qui la garde entre
 * deux tentatives (voir `openPack`).
 */
export async function ouvrirArrivage(cle: string): Promise<Card[]> {
  const sources = sourcesRemplacees ?? sourcesArrivage();

  // 1. Le réseau d'abord : hors ligne, aucun appel n'est émis (D-179 (6)).
  if (!sources.enLigne()) {
    throw new ErreurArrivage('hors-ligne', 'Hors ligne : connecte-toi pour ouvrir un Arrivage.');
  }

  // 2. La configuration et la session. Sans l'une ou l'autre, il n'y a rien à demander.
  const configuration = sources.configuration;
  if (!configuration) {
    throw new ErreurArrivage(
      'configuration',
      'Le serveur du jeu n’est pas configuré : l’Arrivage ne peut pas s’ouvrir.'
    );
  }
  const jeton = await sources.jeton();
  if (!jeton) {
    throw new ErreurArrivage('refus', 'Connecte-toi pour ouvrir un Arrivage.');
  }

  // 3. L'appel. Une panne de transport est `reseau` — la clé reste valable pour réessayer.
  let reponse: Response;
  try {
    reponse = await sources.fetchImpl(urlArrivage(configuration), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jeton}`,
        apikey: configuration.clePublique
      },
      body: JSON.stringify({ cle })
    });
  } catch {
    throw new ErreurArrivage('reseau', 'L’ouverture n’a pas abouti : réessaie.');
  }

  // 4. Un refus du serveur est nommé : 401/403 veut dire « pas de compte, ou session finie ».
  if (reponse.status === 401 || reponse.status === 403) {
    throw new ErreurArrivage('refus', 'Connecte-toi pour ouvrir un Arrivage.');
  }
  if (!reponse.ok) {
    throw new ErreurArrivage('reseau', 'L’ouverture n’a pas abouti : réessaie.');
  }

  // 5. La réponse : cinq cartes du catalogue. Une réponse illisible est un échec réseau —
  // on ne crédite jamais une carte qu'on ne sait pas nommer.
  let corps: ReponseArrivage;
  try {
    corps = (await reponse.json()) as ReponseArrivage;
  } catch {
    throw new ErreurArrivage('reseau', 'La réponse du serveur est illisible : réessaie.');
  }
  if (!Array.isArray(corps?.cards)) {
    throw new ErreurArrivage('reseau', 'La réponse du serveur est illisible : réessaie.');
  }

  const cartes: Card[] = [];
  for (const ligne of corps.cards) {
    const carte = typeof ligne?.id === 'string' ? getCard(ligne.id) : undefined;
    if (!carte) {
      throw new ErreurArrivage('reseau', `Le serveur a rendu une carte inconnue (${String(ligne?.id)}).`);
    }
    // La rareté vient du catalogue : le serveur la redit, on ne s'en sert pas pour décider
    // d'une règle — il rend les **ids** crédités, et le client les affiche.
    cartes.push(carte);
  }
  return cartes;
}
