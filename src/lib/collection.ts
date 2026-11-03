/**
 * **Lire la Collection** — la couture réseau du cache client (#493, D-179 (3)).
 *
 * D-179 : le serveur fait autorité sur la Collection ; le client n'en garde qu'un **cache**.
 * Ce module **lit** la table `public.collection` du compte, et rien d'autre : il n'écrit pas,
 * ne fusionne pas et ne tient aucun compteur. L'écriture, c'est l'ouverture d'un Arrivage
 * (`supabase/functions/ouvrir-arrivage`, D-179 (2)) — un autre ticket, un autre chemin.
 *
 * **La RLS suffit, et c'est vérifié** : `supabase/migrations/0020_deck_et_collection.sql`
 * porte `create policy "collection : chacun lit la sienne" on public.collection for select
 * to authenticated using (compte_id = auth.uid())`. La requête ne filtre donc pas par compte
 * elle-même : le jeton de session dit qui lit, et la base ne rend que ses lignes. Ajouter un
 * filtre côté client ne protégerait rien de plus (et un client peut mentir) ; la garde est
 * dans la base.
 *
 * **Les quatre raisons** (`RaisonCollection`), comme pour l'Arrivage : `hors-ligne`,
 * `refus` (401/403 — pas de compte, session finie), `reseau` (l'appel n'a pas abouti ou la
 * réponse est illisible), `configuration` (build sans backend). Un échec **ne vide rien** :
 * c'est à l'appelant de garder son cache (voir `synchroniserCollection`).
 *
 * **Les sources sont injectables** (`SourcesCollection`) : même couture que
 * `@/lib/arrivage`. Un test branche une configuration, un jeton et un `fetch` factices, et
 * **aucun appel réseau réel** n'a lieu. `definirSourcesCollection(null)` remet la production.
 */
import { getCard } from '@/data';
import { configurerMur, jetonSession } from '@/lib/supabase';
import type { ConfigurationMur } from '@/lib/supabase';

/** La table lue, telle que PostgREST la sert. */
export const TABLE_COLLECTION = 'collection';

/**
 * Pourquoi une lecture n'a pas abouti. L'écran s'en sert (D-060 (3)) :
 *
 * - `hors-ligne` : pas de réseau, aucun appel émis ;
 * - `refus` : le serveur a dit non (401/403) — pas de compte, session expirée ;
 * - `reseau` : l'appel ou la réponse n'a pas abouti ; on garde le cache et on réessaiera ;
 * - `configuration` : pas de backend branché (build sans `.env`) — rien à contacter.
 */
export type RaisonCollection = 'hors-ligne' | 'refus' | 'reseau' | 'configuration';

/** L'échec d'une lecture, **nommé** par sa raison : l'écran ne lit pas un message brut. */
export class ErreurCollection extends Error {
  constructor(
    readonly raison: RaisonCollection,
    message: string
  ) {
    super(message);
    this.name = 'ErreurCollection';
  }
}

/**
 * Ce dont une lecture a besoin du dehors. Tout est injectable pour que le test n'ouvre
 * aucun réseau (AGENTS.md §6 : « injecter le lanceur »).
 */
export interface SourcesCollection {
  /** La configuration Supabase, ou `null` quand le backend n'est pas branché. */
  configuration: ConfigurationMur | null;
  /** Le jeton de la session — `null` quand personne n'est connecté. */
  jeton: () => Promise<string | null>;
  /** Le réseau est-il là ? Lit `navigator.onLine` en production. */
  enLigne: () => boolean;
  /** L'appel HTTP, résolu **à l'appel** pour qu'un test puisse le remplacer. */
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Une ligne de `public.collection` telle que PostgREST la rend, avant vérification. */
interface LigneCollection {
  carte_id?: unknown;
  quantite?: unknown;
}

/** Les sources de production : la configuration du mur, la session, et le vrai `fetch`. */
export function sourcesCollection(): SourcesCollection {
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
let sourcesRemplacees: SourcesCollection | null = null;

/**
 * Remplace les sources de lecture. **Réservé aux tests** : l'écran et le store ne
 * l'appellent jamais. `null` remet la production.
 */
export function definirSourcesCollection(sources: SourcesCollection | null): void {
  sourcesRemplacees = sources;
}

/**
 * L'URL REST de la Collection. `select` est obligatoire côté PostgREST, et l'on ne demande
 * que les deux colonnes du cache : ni `compte_id` (la RLS l'a déjà filtré), ni les dates.
 */
export function urlCollection(configuration: ConfigurationMur): string {
  return `${configuration.url.replace(/\/+$/, '')}/rest/v1/${TABLE_COLLECTION}?select=carte_id,quantite`;
}

/**
 * Lit la Collection du compte connecté et rend **l'état complet** du serveur, sous la forme
 * que le store persiste (`owned` : identifiant de carte → quantité).
 *
 * Ce n'est **pas** une fusion : l'objet rendu remplace le cache, il ne s'y ajoute pas. Les
 * cartes que le catalogue ne connaît plus sont écartées — le cache sert à afficher, et une
 * carte qu'on ne sait pas nommer ne s'affiche pas ; elle n'est ni perdue ni comptée à tort.
 *
 * Lève une `ErreurCollection` nommée, jamais une erreur nue.
 */
export async function lireCollection(): Promise<Record<string, number>> {
  const sources = sourcesRemplacees ?? sourcesCollection();

  // 1. Le réseau d'abord : hors ligne, aucun appel n'est émis (D-179 (6)).
  if (!sources.enLigne()) {
    throw new ErreurCollection('hors-ligne', 'Hors ligne : la Collection affichée peut être en retard.');
  }

  // 2. La configuration et la session. Sans l'une ou l'autre, il n'y a rien à lire.
  const configuration = sources.configuration;
  if (!configuration) {
    throw new ErreurCollection(
      'configuration',
      'Le serveur du jeu n’est pas configuré : la Collection ne se relit pas.'
    );
  }
  const jeton = await sources.jeton();
  if (!jeton) {
    throw new ErreurCollection('refus', 'Connecte-toi pour relire ta Collection.');
  }

  // 3. L'appel. Une panne de transport est `reseau` — le cache reste affiché.
  let reponse: Response;
  try {
    reponse = await sources.fetchImpl(urlCollection(configuration), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jeton}`,
        apikey: configuration.clePublique
      }
    });
  } catch {
    throw new ErreurCollection('reseau', 'La Collection n’a pas pu être relue : réessaie.');
  }

  // 4. Un refus du serveur est nommé : 401/403 veut dire « pas de compte, ou session finie ».
  if (reponse.status === 401 || reponse.status === 403) {
    throw new ErreurCollection('refus', 'Connecte-toi pour relire ta Collection.');
  }
  if (!reponse.ok) {
    throw new ErreurCollection('reseau', 'La Collection n’a pas pu être relue : réessaie.');
  }

  // 5. La réponse : une liste de `{ carte_id, quantite }`. Une réponse illisible est un
  // échec réseau — on ne remplace jamais le cache par une forme qu'on ne comprend pas.
  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    throw new ErreurCollection('reseau', 'La réponse du serveur est illisible : réessaie.');
  }
  if (!Array.isArray(corps)) {
    throw new ErreurCollection('reseau', 'La réponse du serveur est illisible : réessaie.');
  }

  const owned: Record<string, number> = {};
  for (const ligne of corps as LigneCollection[]) {
    const carteId = typeof ligne?.carte_id === 'string' ? ligne.carte_id : '';
    const quantite = ligne?.quantite;
    // La base garantit `quantite >= 1`, mais une réponse forgée ne passe pas : une carte à
    // zéro n'est pas une ligne (0020), et un compte négatif abîmerait l'affichage.
    if (!carteId || typeof quantite !== 'number' || !Number.isInteger(quantite) || quantite < 1) {
      throw new ErreurCollection('reseau', 'La réponse du serveur est illisible : réessaie.');
    }
    if (!getCard(carteId)) continue;
    owned[carteId] = quantite;
  }
  return owned;
}
