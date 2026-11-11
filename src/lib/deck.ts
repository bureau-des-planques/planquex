/**
 * **Synchroniser le Deck** — la couture réseau du journal d'intentions (#491, D-153 (3),
 * D-179 (4)).
 *
 * Le Deck est **local d'abord** : chaque geste du store (`addToDeck`, `removeFromDeck`,
 * `setDeck`, `clearDeck`) écrit une **intention** dans une file persistée, et la file part
 * vers le serveur quand le réseau revient. Ce module porte le **fil** — les types de
 * l'intention, la différence entre deux Decks et l'appel de la RPC — pas la file : elle vit
 * dans le store, qui la persiste (`deckOutbox`, v17).
 *
 * **Pourquoi `localStorage` (le `persist` du store) et pas IndexedDB** : le store est déjà
 * persisté au rechargement, sa forme est versionnée et migrée (`migratePersisted`), et la
 * file ne fait que quelques centaines d'octets (des identifiants de carte). IndexedDB
 * ajouterait un second stockage asynchrone, une seconde migration et un second cycle de vie
 * pour un gain qui ne se voit qu'à des dizaines de milliers de gestes — ce que D-153 (3)
 * n'achète pas. Le jour où la file grossit vraiment, la forme persistée se migre comme le
 * reste.
 *
 * **La RPC `public.rejouer_deck(p_operations, p_cle)`** (migration `0025_deck_rejeu.sql`)
 * rejoue les opérations dans l'ordre, **une seule fois par clé** (`p_cle`), dans une
 * transaction. La clé est dérivée de la **première intention** du lot : elle survit au
 * rechargement tant que la première intention n'a pas été acquittée, donc un retry ne
 * double pas le Deck. La base laisse la garde `0021` refuser un Deck final illégal : le lot
 * entier est annulé, la file reste, et l'écran le dit.
 *
 * **Les quatre raisons** (`RaisonDeck`), comme pour l'Arrivage et la Collection :
 * `hors-ligne` (aucun appel), `refus` (401/403, ou un 4xx du serveur — Deck illégal
 * compris), `reseau` (l'appel n'a pas abouti, ou le serveur a répondu 5xx), `configuration`
 * (build sans backend). **Aucun appel réseau n'a lieu dans les tests** : les sources sont
 * injectables (`definirSourcesDeck`), même couture que `@/lib/arrivage`.
 */
import { getCard, isPlanque } from '@/data';
import type { Stage } from '@/data/types';
import { configurerMur, jetonSession } from '@/lib/supabase';
import type { ConfigurationMur } from '@/lib/supabase';

/** Le nom de la fonction SQL, tel que PostgREST la sert. */
export const FONCTION_REJEU_DECK = 'rejouer_deck';

/** Le nom de la fonction d'import, tel que PostgREST la sert (#492). */
export const FONCTION_IMPORT_DECK = 'importer_deck';

/**
 * Le résultat d'un import de Deck (#492) :
 *
 * - `importe` : **cet** appel a importé le Deck local. `false` quand le compte avait déjà un
 *   Deck (on ne l'écrase pas) ou quand l'import avait déjà été fait (second appareil) ;
 * - `deck` : la composition du Deck du compte **après** l'appel, dans l'ordre des rangs. Le
 *   client l'adopte : quand le serveur avait déjà un Deck, c'est lui qui fait autorité.
 */
export interface ResultatImportDeck {
  importe: boolean;
  deck: string[];
}

/**
 * Une ligne de Deck telle que la RPC d'import la rend (0026) : l'identifiant de carte, sa
 * quantité et son rang. La base ne connaît pas le catalogue, donc la forme est vérifiée ici.
 */
interface LigneDeckServeur {
  carte: string;
  quantite: number;
  rang: number;
}

/** Une carte du Deck, telle que le serveur la rejoue : la base ne connaît pas le catalogue. */
export interface CarteDeck {
  /** L'identifiant de carte (`src/data`). */
  carte: string;
  /** Son nom (`getCard(id).name`) : « deux exemplaires du même nom » se compte par nom. */
  nom: string;
  /** Son stade (`Stage`), ou `null` pour une carte Action — sans stade, pas d'Entrant. */
  stade: Stage | null;
}

/**
 * Un geste du Deck, dans le vocabulaire de la RPC. Trois gestes suffisent : `ajouter` et
 * `retirer` un exemplaire, et `remplacer` le Deck entier (Remplir, Vider, charger un Deck
 * proposé, importer un code ou une sauvegarde).
 */
export type OperationDeck =
  | { type: 'ajouter'; carte: string; nom: string; stade: Stage | null }
  | { type: 'retirer'; carte: string }
  | { type: 'remplacer'; cartes: CarteDeck[] };

/**
 * Une intention de la file : son identité, son ordre et le geste. `id` sert aussi de base à
 * la clé d'idempotence du lot (voir `cleDeck`), et `ordre` garde la suite des gestes.
 */
export interface IntentionDeck {
  id: string;
  ordre: number;
  operation: OperationDeck;
}

/**
 * Pourquoi une synchronisation n'a pas abouti. L'écran s'en sert (D-060 (3)) :
 *
 * - `hors-ligne` : pas de réseau, aucun appel émis ;
 * - `refus` : le serveur a dit non — pas de compte (401/403), ou Deck illégal (4xx) ;
 * - `reseau` : l'appel n'a pas abouti, ou le serveur est en panne (5xx) ;
 * - `configuration` : pas de backend branché (build sans `.env`) — rien à contacter.
 */
export type RaisonDeck = 'hors-ligne' | 'refus' | 'reseau' | 'configuration';

/** L'échec d'un envoi, **nommé** par sa raison : l'écran ne lit pas un message brut. */
export class ErreurDeck extends Error {
  constructor(
    readonly raison: RaisonDeck,
    message: string
  ) {
    super(message);
    this.name = 'ErreurDeck';
  }
}

/**
 * Ce dont un envoi a besoin du dehors. Tout est injectable pour que le test n'ouvre aucun
 * réseau (AGENTS.md §6 : « injecter le lanceur »).
 */
export interface SourcesDeck {
  /** La configuration Supabase, ou `null` quand le backend n'est pas branché. */
  configuration: ConfigurationMur | null;
  /** Le jeton de la session — `null` quand personne n'est connecté. */
  jeton: () => Promise<string | null>;
  /** Le réseau est-il là ? Lit `navigator.onLine` en production. */
  enLigne: () => boolean;
  /** L'appel HTTP, résolu **à l'appel** pour qu'un test puisse le remplacer. */
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Les sources de production : la configuration du mur, la session, et le vrai `fetch`. */
export function sourcesDeck(): SourcesDeck {
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
let sourcesRemplacees: SourcesDeck | null = null;

/**
 * Remplace les sources d'envoi. **Réservé aux tests** : l'écran et le store ne l'appellent
 * jamais. `null` remet la production.
 */
export function definirSourcesDeck(sources: SourcesDeck | null): void {
  sourcesRemplacees = sources;
}

/** L'URL de la RPC, construite sur `VITE_SUPABASE_URL` et le chemin REST de PostgREST. */
export function urlRejeuDeck(configuration: ConfigurationMur): string {
  return urlFonctionDeck(configuration, FONCTION_REJEU_DECK);
}

/** L'URL de la RPC d'import, même chemin REST que le rejeu (#492). */
export function urlImportDeck(configuration: ConfigurationMur): string {
  return urlFonctionDeck(configuration, FONCTION_IMPORT_DECK);
}

/**
 * Le chemin REST d'une fonction du Deck : une seule construction pour les deux appels.
 *
 * **`/rpc/` est obligatoire** (PostgREST) : sans lui, le chemin désigne une **table**.
 * Le 04/11/2026, la preuve E2E (#668) a montré l'écart que ce détail creusait — deux 404
 * `PGRST205` (« Could not find the table public.importer_deck ») à chaque chargement de
 * page connectée. Le rejeu et l'import ne partaient donc jamais, et la preuve échouait sur
 * une erreur de console qu'aucun test ne reliait à cette URL.
 */
function urlFonctionDeck(configuration: ConfigurationMur, nom: string): string {
  return `${configuration.url.replace(/\/+$/, '')}/rest/v1/rpc/${nom}`;
}

/** Ce que le catalogue sait de la carte, tel que la base le reçoit (`nom`, `stade`). */
export function carteDuDeck(carte: string): CarteDeck {
  const trouvee = getCard(carte);
  return {
    carte,
    nom: trouvee?.name ?? carte,
    stade: isPlanque(trouvee) ? trouvee.stage : null
  };
}

/**
 * Le geste qui mène d'un Deck à l'autre, ou `null` quand rien n'a bougé. C'est **le seul
 * endroit** qui traduit une écriture du store en intention : les actions ne poussent pas
 * dans la file, elles passent par `ecrireDeck` (`@/store/useStore`), qui appelle cette
 * fonction.
 *
 * Une insertion ou un retrait d'**un** exemplaire devient `ajouter` / `retirer` — l'ordre
 * des gestes est ainsi rejoué par le serveur, pas écrasé. Tout autre changement (remplacer
 * le Deck entier, en réordonner les cartes, en changer une à la même taille) devient
 * `remplacer`, qui est la seule opération capable de le décrire.
 */
export function operationDeck(avant: readonly string[], apres: readonly string[]): OperationDeck | null {
  if (avant.length === apres.length && avant.every((carte, index) => carte === apres[index])) return null;

  if (apres.length === avant.length + 1) {
    const index = indiceInsere(avant, apres);
    if (index >= 0) return { type: 'ajouter', ...carteDuDeck(apres[index] as string) };
  }
  if (avant.length === apres.length + 1) {
    const index = indiceRetire(avant, apres);
    if (index >= 0) return { type: 'retirer', carte: avant[index] as string };
  }
  return { type: 'remplacer', cartes: apres.map((carte) => carteDuDeck(carte)) };
}

/** L'indice de l'élément inséré, ou `-1` si `apres` n'est pas `avant` plus un élément. */
function indiceInsere(avant: readonly string[], apres: readonly string[]): number {
  const taille = avant.length;
  for (let index = 0; index <= taille; index += 1) {
    if (apres[index] !== avant[index]) {
      for (let reste = index; reste < taille; reste += 1) {
        if (avant[reste] !== apres[reste + 1]) return -1;
      }
      return index;
    }
  }
  return -1;
}

/** L'indice de l'élément retiré, ou `-1` si `apres` n'est pas `avant` moins un élément. */
function indiceRetire(avant: readonly string[], apres: readonly string[]): number {
  const taille = apres.length;
  for (let index = 0; index <= taille; index += 1) {
    if (avant[index] !== apres[index]) {
      for (let reste = index; reste < taille; reste += 1) {
        if (avant[reste + 1] !== apres[reste]) return -1;
      }
      return index;
    }
  }
  return -1;
}

/**
 * La clé d'idempotence du lot : celle de sa **première** intention. Tant que ce lot n'est
 * pas acquitté, un retry (ou un rechargement) rejoue la **même** clé, et le serveur ne
 * rejoue les opérations qu'une fois. Acquitté, la première intention quitte la file — la
 * clé du lot suivant est donc neuve.
 */
export function cleDeck(intentions: readonly IntentionDeck[]): string {
  return `deck:${intentions[0]?.id ?? 'vide'}`;
}

/** Ajoute une intention à la file ; une opération nulle (rien n'a bougé) ne l'allonge pas. */
export function ajouterIntention(file: readonly IntentionDeck[], operation: OperationDeck | null): IntentionDeck[] {
  if (!operation) return [...file];
  return [...file, { id: crypto.randomUUID(), ordre: (file.at(-1)?.ordre ?? 0) + 1, operation }];
}

/** Vrai pour une opération bien formée — une file trafiquée ne fait pas lever le rejeu. */
function operationValide(valeur: unknown): valeur is OperationDeck {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const operation = valeur as Record<string, unknown>;
  if (operation.type === 'ajouter' || operation.type === 'retirer') {
    return typeof operation.carte === 'string' && operation.carte !== '';
  }
  if (operation.type === 'remplacer') {
    return (
      Array.isArray(operation.cartes) &&
      operation.cartes.every(
        (carte: unknown) =>
          typeof carte === 'object' &&
          carte !== null &&
          typeof (carte as Record<string, unknown>).carte === 'string' &&
          (carte as Record<string, unknown>).carte !== ''
      )
    );
  }
  return false;
}

/**
 * La file telle qu'on la relit d'un état persisté : on **garde** les intentions bien formées,
 * on écarte les autres. Une file trafiquée (`localStorage` modifié à la main) ne doit ni
 * lever au chargement ni envoyer n'importe quoi au serveur.
 */
export function normaliserOutbox(valeur: unknown): IntentionDeck[] {
  if (!Array.isArray(valeur)) return [];
  const gardees: IntentionDeck[] = [];
  for (const entree of valeur) {
    if (typeof entree !== 'object' || entree === null) continue;
    const { id, ordre, operation } = entree as Partial<IntentionDeck>;
    if (typeof id !== 'string' || id === '' || id.length > 100) continue;
    if (typeof ordre !== 'number' || !Number.isInteger(ordre)) continue;
    if (!operationValide(operation)) continue;
    gardees.push({ id, ordre, operation });
  }
  return gardees.sort((a, b) => a.ordre - b.ordre);
}

/**
 * Envoie **un** lot d'opérations à la RPC, avec sa clé d'idempotence. Ne touche pas au
 * store : c'est `synchroniserDeck` qui vide la file au succès et la garde au refus.
 *
 * Lève une `ErreurDeck` nommée, jamais une erreur nue.
 */
export async function envoyerDeck(operations: readonly OperationDeck[], cle: string): Promise<void> {
  if (operations.length === 0) return;
  await appelerDeck(FONCTION_REJEU_DECK, { p_operations: operations, p_cle: cle });
}

/**
 * **Importe le Deck local dans le compte, une seule fois** (#492, D-153 (1), D-179 (1)).
 *
 * La RPC `public.importer_deck` (migration `0026_import_deck.sql`) pose d'abord un marqueur
 * atomique par compte, puis applique les opérations **seulement si le compte n'a pas encore
 * de Deck**. Quand le compte en a déjà un, elle n'écrase rien et rend le Deck du serveur :
 * c'est lui qui fait autorité (D-179 (1)), et le client l'adopte.
 *
 * `cle` est la clé d'idempotence du lot côté `rejouer_deck`. Le client en crée une **neuve**
 * à chaque tentative : c'est le marqueur de `0026` qui empêche le double import, pas le reçu
 * du rejeu — sinon le « contrôle mord » de la migration ne mordrait rien.
 *
 * Lève une `ErreurDeck` nommée, jamais une erreur nue. Un échec ne touche pas au Deck local :
 * c'est `importerDeckLocal` (store) qui garde l'état et laisse réessayer.
 */
export async function importerDeck(operations: readonly OperationDeck[], cle: string): Promise<ResultatImportDeck> {
  const reponse = await appelerDeck(FONCTION_IMPORT_DECK, { p_operations: operations, p_cle: cle });

  // La réponse est un objet `{ importe, deck }`. Une réponse illisible est un échec réseau :
  // on n'écrit jamais un Deck qu'on ne comprend pas.
  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');
  }
  if (typeof corps !== 'object' || corps === null) {
    throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');
  }

  const { importe, deck } = corps as { importe?: unknown; deck?: unknown };
  if (typeof importe !== 'boolean' || !Array.isArray(deck)) {
    throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');
  }

  const lignes: LigneDeckServeur[] = [];
  for (const ligne of deck) {
    if (typeof ligne !== 'object' || ligne === null) {
      throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');
    }
    const { carte, quantite, rang } = ligne as Record<string, unknown>;
    if (
      typeof carte !== 'string' ||
      carte === '' ||
      typeof quantite !== 'number' ||
      !Number.isInteger(quantite) ||
      quantite < 1 ||
      typeof rang !== 'number' ||
      !Number.isInteger(rang) ||
      rang < 0
    ) {
      throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');
    }
    lignes.push({ carte, quantite, rang });
  }

  // L'ordre du Deck est celui des rangs (0020) ; une carte que le catalogue ne connaît plus
  // est écartée, comme le cache de Collection (`@/lib/collection`) : on ne sait pas l'afficher.
  lignes.sort((a, b) => a.rang - b.rang);
  const ids: string[] = [];
  for (const ligne of lignes) {
    if (!getCard(ligne.carte)) continue;
    for (let exemplaire = 0; exemplaire < ligne.quantite; exemplaire += 1) ids.push(ligne.carte);
  }
  return { importe, deck: ids };
}

/**
 * L'appel commun aux deux RPC du Deck : réseau, configuration, session, statut. Rend la
 * réponse HTTP ; c'est l'appelant qui décide s'il la lit. Les quatre raisons de `ErreurDeck`
 * sont posées **ici**, une seule fois, pour que le rejeu et l'import refusent pareil.
 */
async function appelerDeck(nom: string, corps: Record<string, unknown>): Promise<Response> {
  const sources = sourcesRemplacees ?? sourcesDeck();

  // 1. Le réseau d'abord : hors ligne, aucun appel n'est émis (D-179 (6)).
  if (!sources.enLigne()) {
    throw new ErreurDeck('hors-ligne', 'Hors ligne : le Deck partira au retour du réseau.');
  }

  // 2. La configuration et la session. Sans l'une ou l'autre, il n'y a rien à envoyer.
  const configuration = sources.configuration;
  if (!configuration) {
    throw new ErreurDeck('configuration', 'Le serveur du jeu n’est pas configuré : le Deck ne peut pas partir.');
  }
  const jeton = await sources.jeton();
  if (!jeton) {
    throw new ErreurDeck('refus', 'Connecte-toi pour synchroniser ton Deck.');
  }

  // 3. L'appel. Une panne de transport est `reseau` — la clé reste valable pour réessayer.
  let reponse: Response;
  try {
    reponse = await sources.fetchImpl(urlFonctionDeck(configuration, nom), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jeton}`,
        apikey: configuration.clePublique
      },
      body: JSON.stringify(corps)
    });
  } catch {
    throw new ErreurDeck('reseau', 'Le Deck n’a pas pu être synchronisé : réessaie.');
  }

  // 4. Un refus du serveur est nommé : 401/403 veut dire « pas de compte, ou session finie »,
  // et un autre 4xx dit que le Deck a été refusé (la garde 0021 le juge au commit). Le lot
  // reste dans la file : rien n'est écrasé.
  if (reponse.status === 401 || reponse.status === 403) {
    throw new ErreurDeck('refus', 'Connecte-toi pour synchroniser ton Deck.');
  }
  if (reponse.status >= 500) {
    throw new ErreurDeck('reseau', 'Le Deck n’a pas pu être synchronisé : réessaie.');
  }
  if (!reponse.ok) {
    throw new ErreurDeck('refus', 'Le serveur a refusé ce Deck : il reste sur cet appareil.');
  }
  return reponse;
}

/** L'URL REST du Deck du compte, dans l'ordre des rangs (la RLS de `0020` ne rend que le sien). */
export function urlLectureDeck(configuration: ConfigurationMur): string {
  return `${configuration.url.replace(/\/+$/, '')}/rest/v1/deck?select=carte_id,quantite,rang&order=rang`;
}

/**
 * **Lit le Deck du compte** tel que la base le tient (#495) : la source de vérité de
 * l'export. Rend les identifiants de carte dans l'ordre des rangs, une entrée par exemplaire.
 * Une carte que le catalogue ne connaît plus est écartée, comme dans `importerDeck`.
 *
 * Lève une `ErreurDeck` nommée (mêmes quatre raisons que le rejeu), jamais une erreur nue.
 */
export async function lireDeck(): Promise<string[]> {
  const sources = sourcesRemplacees ?? sourcesDeck();
  if (!sources.enLigne()) throw new ErreurDeck('hors-ligne', 'Hors ligne : le Deck du compte ne se relit pas.');
  const configuration = sources.configuration;
  if (!configuration) throw new ErreurDeck('configuration', 'Le serveur du jeu n’est pas configuré.');
  const jeton = await sources.jeton();
  if (!jeton) throw new ErreurDeck('refus', 'Connecte-toi pour relire ton Deck.');

  let reponse: Response;
  try {
    reponse = await sources.fetchImpl(urlLectureDeck(configuration), {
      method: 'GET',
      headers: { Authorization: `Bearer ${jeton}`, apikey: configuration.clePublique }
    });
  } catch {
    throw new ErreurDeck('reseau', 'Le Deck n’a pas pu être relu : réessaie.');
  }
  if (reponse.status === 401 || reponse.status === 403) {
    throw new ErreurDeck('refus', 'Connecte-toi pour relire ton Deck.');
  }
  if (!reponse.ok) throw new ErreurDeck('reseau', 'Le Deck n’a pas pu être relu : réessaie.');

  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');
  }
  if (!Array.isArray(corps)) throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');

  const lignes: LigneDeckServeur[] = [];
  for (const ligne of corps) {
    const { carte_id: carte, quantite, rang } = (ligne ?? {}) as Record<string, unknown>;
    if (
      typeof carte !== 'string' ||
      carte === '' ||
      typeof quantite !== 'number' ||
      !Number.isInteger(quantite) ||
      quantite < 1 ||
      typeof rang !== 'number' ||
      !Number.isInteger(rang) ||
      rang < 0
    ) {
      throw new ErreurDeck('reseau', 'La réponse du serveur est illisible : réessaie.');
    }
    lignes.push({ carte, quantite, rang });
  }
  lignes.sort((a, b) => a.rang - b.rang);
  const ids: string[] = [];
  for (const ligne of lignes) {
    if (!getCard(ligne.carte)) continue;
    for (let exemplaire = 0; exemplaire < ligne.quantite; exemplaire += 1) ids.push(ligne.carte);
  }
  return ids;
}
