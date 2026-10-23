/**
 * Supabase — la configuration du mur et l'identité anonyme de l'appareil (#135).
 *
 * **La contrainte qui commande tout ce fichier** : l'alpha **fonctionne sans backend** — le mur
 * lit `docs/boite-a-idees.json` (D-058). Ce module est donc **inerte** quand la configuration
 * manque : il ne lève rien, ne contacte rien, et rend `null`. `npm run build`, `npm run capturer`
 * et l'application servie doivent marcher **sans** `.env`.
 *
 * **Deux variables, et deux seulement** (Vite n'expose que le préfixe `VITE_`) :
 *
 * - `VITE_SUPABASE_URL`
 * - `VITE_SUPABASE_ANON_KEY` — la clé **publique**. **Jamais** la clé de service : elle
 *   contourne les règles d'accès (RLS), et un bundle que le navigateur télécharge ne peut
 *   garder aucun secret. `assertClePublique` refuse une clé de service, et
 *   `src/lib/supabase.test.ts` la fait mordre.
 *
 * `.env.example` porte les deux noms, avec des valeurs **fausses**. Le fichier versionné
 * n'accueille jamais une vraie clé.
 *
 * **Identité** (D-059) : pas de compte, pas de mot de passe, pas de courriel. La bibliothèque
 * `@supabase/supabase-js` signe l'appareil **anonymement** à sa première visite et persiste la
 * session (localStorage) ; l'utilisateur anonyme est un `auth.uid()` comme un autre, donc les
 * politiques de `supabase/migrations/0001_mur.sql` suffisent à dire « chacun lit tout, chacun
 * n'écrit que les siens ».
 *
 * La bibliothèque est chargée **à la demande** (`import()` dynamique) : sans configuration, son
 * code ne part même pas dans le premier chargement.
 *
 * **La trace des combats** (#173, D-086) se dépose par `ecrireLigne` — même configuration,
 * même identité anonyme, et **inerte sans configuration**. Ce module ne décide pas *quoi*
 * envoyer : la ligne est construite par `@/store/combats`, seule source de ce qui est gardé.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Le nom de la variable qui porte l'adresse du projet Supabase. */
export const VARIABLE_URL = 'VITE_SUPABASE_URL';

/** Le nom de la variable qui porte la clé **publique** (anon). Jamais la clé de service. */
export const VARIABLE_CLE = 'VITE_SUPABASE_ANON_KEY';

/** Les préfixes des clés secrètes de Supabase (`sb_secret_…`) : refusées, comme le rôle `service_role`. */
const PREFIXE_CLE_SECRETE = 'sb_secret_';

export interface ConfigurationMur {
  url: string;
  /** La clé publique lue dans `VITE_SUPABASE_ANON_KEY`, jamais une clé de service. */
  clePublique: string;
}

/**
 * Le sous-ensemble d'un client Supabase dont ce module a besoin. Le déclarer ici, en
 * structurel, c'est ce qui rend `identiteAppareil` testable **sans réseau** : un faux client
 * à trois méthodes suffit.
 */
export interface AppareilAnonyme {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null } }>;
    signInAnonymously(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
}

/** Ce que rend une requête Supabase : la donnée, ou l'erreur — jamais les deux. */
export interface ReponseMur<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Le sous-ensemble du constructeur de requêtes de `supabase-js` dont le mur a besoin.
 * Il est `PromiseLike`, comme le vrai : `await client.from(…).select(…)` suffit.
 *
 * Le déclarer **ici** garde `src/lib/murBase.ts` testable sans réseau : un faux client à
 * trois méthodes rend les lignes qu'on veut, ou l'erreur qu'on veut.
 */
export interface RequeteMur<T = unknown> extends PromiseLike<ReponseMur<T>> {
  select(colonnes?: string): RequeteMur<T>;
  order(colonnes: string, options?: { ascending?: boolean }): RequeteMur<T>;
  insert(ligne: Record<string, unknown>): RequeteMur<T>;
}

/** Un client Supabase : l'identité anonyme, et l'accès aux tables. */
export interface ClientMur extends AppareilAnonyme {
  from(table: string): RequeteMur;
}

type Environnement = Record<string, string | boolean | undefined>;

function texte(valeur: string | boolean | undefined): string {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

/**
 * Décode un segment JWT (base64url) en texte. `atob` existe dans le navigateur **et** dans
 * Node : le module est le même des deux côtés.
 */
function decoderSegment(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const reste = base64.length % 4;
  return atob(reste === 0 ? base64 : base64 + '='.repeat(4 - reste));
}

/**
 * Cette clé est-elle une clé **de service** ? Deux familles à reconnaître :
 *
 * - les clés secrètes récentes, préfixées `sb_secret_` ;
 * - les JWT historiques, dont la charge porte `"role": "service_role"`.
 *
 * Une clé publique (`sb_publishable_…`, ou un JWT `"role": "anon"`) n'est pas concernée.
 */
export function cleEstDeService(cle: string): boolean {
  const valeur = cle.trim();
  if (valeur.startsWith(PREFIXE_CLE_SECRETE)) return true;

  const morceaux = valeur.split('.');
  if (morceaux.length !== 3) return false;

  try {
    const charge = JSON.parse(decoderSegment(morceaux[1])) as { role?: unknown };
    return charge.role === 'service_role';
  } catch {
    // Un JWT illisible n'est pas une clé de service : la couche réseau le refusera.
    return false;
  }
}

/**
 * Refuse une clé qui n'est pas publique. C'est la garde du critère « la clé utilisée par le
 * jeu est la clé publique, jamais une clé de service » : une clé de service dans ce module
 * ferait sauter les règles d'accès de la base depuis le navigateur de n'importe qui.
 */
export function assertClePublique(cle: string): void {
  if (cleEstDeService(cle)) {
    throw new Error(
      `Clé de service refusée dans ${VARIABLE_CLE} : le jeu ne lit que la clé publique ` +
        '(anon / publishable). Une clé de service contourne les règles d\u2019accès et ne peut ' +
        'pas vivre dans le navigateur. Voir .env.example et supabase/README.md.',
    );
  }
}

/**
 * Lit la configuration du mur dans l'environnement Vite.
 *
 * - les deux variables vides ou absentes → `null` : **alpha sans backend**, le module est inerte ;
 * - une seule des deux → erreur : une configuration à moitié posée ne doit pas se taire ;
 * - une clé de service → erreur (`assertClePublique`).
 */
export function configurerMur(env: Environnement = import.meta.env): ConfigurationMur | null {
  const url = texte(env[VARIABLE_URL]);
  const clePublique = texte(env[VARIABLE_CLE]);

  if (!url && !clePublique) return null;

  if (!url || !clePublique) {
    throw new Error(
      `Configuration Supabase incomplète : ${VARIABLE_URL} et ${VARIABLE_CLE} vont ensemble ` +
        '(voir .env.example). Sans les deux, le mur reste sur son fichier JSON.',
    );
  }

  assertClePublique(clePublique);
  return { url, clePublique };
}

let configuration: ConfigurationMur | null | undefined;
let client: SupabaseClient | null = null;

/**
 * Le client Supabase, ou `null` si le backend n'est pas configuré (alpha). Créé au premier
 * usage, puis gardé : la bibliothèque garde elle-même la session de l'appareil.
 *
 * Le client réel est plus large que `ClientMur` (toutes les tables, tous les filtres) : la
 * conversion est le prix du sous-ensemble structurel qui rend le mur testable sans réseau.
 */
async function clientSupabase(): Promise<SupabaseClient | null> {
  if (configuration === undefined) configuration = configurerMur();
  if (!configuration) return null;

  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(configuration.url, configuration.clePublique, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Le mur n'est pas une page de retour OAuth : rien à lire dans l'URL.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * Le client, réduit à ce que le mur en demande (session et signature anonyme). Le test
 * injecte un faux appareil : c'est ce qui rend `identiteAppareil` éprouvable **sans réseau**.
 */
export async function clientMur(): Promise<ClientMur | null> {
  return (await clientSupabase()) as ClientMur | null;
}

/**
 * Écrit **une** ligne dans une table, au nom de l'identité anonyme de l'appareil.
 *
 * Rend l'erreur que la base ou le réseau a donnée (`null` si la ligne est passée) ; **ne
 * décide pas** de ce que l'appelant en fait — `@/store/combats` choisit de ne jamais
 * interrompre le jeu. Sans configuration, rien n'est contacté et la raison est rendue.
 *
 * L'insertion s'appuie sur `auth.uid()` (`auteur` a cette valeur par défaut dans
 * `0002_combats.sql`) : on signe donc **avant** d'écrire, sinon la RLS refuserait la ligne.
 */
export async function ecrireLigne(
  table: string,
  ligne: Record<string, unknown>,
): Promise<{ erreur: string | null }> {
  const supabase = await clientSupabase();
  if (!supabase) return { erreur: 'Supabase n’est pas configuré.' };

  await identiteAppareil(async () => supabase);
  const { error } = await supabase.from(table).insert(ligne);
  return { erreur: error ? error.message : null };
}

/**
 * L'identité anonyme de l'appareil : celle de la session persistée si elle existe, sinon une
 * signature anonyme neuve (première visite). Rend `null` quand le backend n'est pas configuré.
 *
 * `chargerClient` est un paramètre pour que le test puisse injecter un faux appareil, sans
 * réseau ni navigateur.
 */
export async function identiteAppareil(
  chargerClient: () => Promise<AppareilAnonyme | null> = clientMur,
): Promise<string | null> {
  const supabase = await chargerClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  const dejaSigne = data.session?.user?.id;
  if (dejaSigne) return dejaSigne;

  const { data: neuve, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(`Identité anonyme impossible : ${error.message}`);
  }
  return neuve.user?.id ?? null;
}
