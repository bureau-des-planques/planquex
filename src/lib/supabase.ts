/**
 * Supabase — la configuration du mur, la session du compte (#181, D-088) et l'identité
 * anonyme héritée de l'alpha d'avant (#135).
 *
 * **La contrainte qui commande tout ce fichier** : l'alpha **fonctionne sans backend** — le mur
 * lit `docs/comite.json` (D-058). Ce module est donc **inerte** quand la configuration
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
 * **Identité** : depuis **D-088** (#181), l'alpha s'ouvre par un **compte** (Google ou
 * courriel) validé à la main — c'est `@/lib/comptes` qui porte la connexion et
 * `supabase/migrations/0005_comptes.sql` qui décide qui écrit. Depuis **D-156** (30/10/2026,
 * #527), l'**identité anonyme** de D-059 n'ouvre plus rien — ni le jeu, ni même la lecture
 * du mur : la garde d'entrée renvoie vers `/connexion` tout visiteur sans compte, et ce
 * module **ne signe plus personne** (`identiteSession` rend la session persistée, ou `null`).
 * Les connexions anonymes restent actives côté projet uniquement pour les lignes d'avant la
 * 0005 (les deux post-its, auteur sentinelle, D-107) ; elles se ferment après #527.
 *
 * La bibliothèque est chargée **à la demande** (`import()` dynamique) : sans configuration, son
 * code ne part même pas dans le premier chargement.
 *
 * **La trace des combats** (#173, D-086) se dépose par `ecrireLigne` — même configuration,
 * même session, et **inerte sans configuration**. Ce module ne décide pas *quoi* envoyer :
 * la ligne est construite par `@/store/combats`, seule source de ce qui est gardé.
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
 * Le sous-ensemble d'un client Supabase dont ce module a besoin pour lire **qui** parle.
 * Le déclarer ici, en structurel, c'est ce qui rend `identiteSession` testable **sans
 * réseau** : un faux client à une méthode suffit.
 *
 * Depuis D-156 (#527), il ne **signe** plus : une visite sans compte ne crée plus
 * d'utilisateur anonyme.
 */
export interface SessionPersistee {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null } }>;
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
  /**
   * Filtre : la colonne vaut la valeur. Sert à lire ses propres votes et à viser sa ligne
   * (#137) — et, depuis #138, à viser un commentaire par son `id`, qui est un `bigint` :
   * d'où le nombre accepté ici comme la chaîne.
   */
  eq(colonne: string, valeur: string | number): RequeteMur<T>;
  /**
   * Filtre : la colonne vaut **une** des valeurs. Sert au compteur du comité (#212), qui lit
   * les commentaires de **tous** ses post-its en une seule requête — jamais une par post-it.
   */
  in(colonne: string, valeurs: ReadonlyArray<string | number>): RequeteMur<T>;
  update(valeurs: Record<string, unknown>): RequeteMur<T>;
  delete(): RequeteMur<T>;
}

/** Un client Supabase : la session, l’accès aux tables, et les fonctions SQL. */
export interface ClientMur extends SessionPersistee {
  from(table: string): RequeteMur;
  /**
   * Appelle une fonction SQL (`public.corriger_postit`, 0006). C'est le seul chemin
   * d'écriture du titre et du texte d'un post-it : un grant de colonnes ne sait pas
   * distinguer l'auteur d'un administrateur (#139, `0006_tri_et_corrections.sql`).
   */
  rpc(nom: string, params?: Record<string, unknown>): PromiseLike<ReponseMur<unknown>>;
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
        'pas vivre dans le navigateur. Voir .env.example et supabase/README.md.'
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
        '(voir .env.example). Sans les deux, le mur reste sur son fichier JSON.'
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
        // Le retour de Google arrive avec la session dans l'URL (#181, D-088) : sans cette
        // détection, la connexion OAuth se terminerait sur un écran sans session.
        detectSessionInUrl: true
      }
    });
  }
  return client;
}

/**
 * Le client, réduit à ce que le mur en demande (la session). Le test
 * injecte un faux appareil : c’est ce qui rend `identiteSession` éprouvable **sans réseau**.
 */
export async function clientMur(): Promise<ClientMur | null> {
  return (await clientSupabase()) as ClientMur | null;
}

/**
 * Écrit **une** ligne dans une table, au nom de la session en cours — un **compte** (D-088).
 * Sans session, rien n'est tenté : la raison est rendue, et l'appelant choisit de ne pas
 * interrompre le jeu (#527, D-156 : on ne signe plus pour écrire).
 *
 * Rend l'erreur que la base ou le réseau a donnée (`null` si la ligne est passée) ; **ne
 * décide pas** de ce que l'appelant en fait — `@/store/combats` choisit de ne jamais
 * interrompre le jeu. Sans configuration, rien n'est contacté et la raison est rendue.
 *
 * L'insertion s'appuie sur `auth.uid()` (`auteur` a cette valeur par défaut dans
 * `0002_combats.sql`) : la session doit donc exister **avant** l'écriture, sinon la RLS
 * refuserait la ligne. Depuis D-156, on ne la **fabrique** plus (plus de signature anonyme).
 */
export async function ecrireLigne(table: string, ligne: Record<string, unknown>): Promise<{ erreur: string | null }> {
  const supabase = await clientSupabase();
  if (!supabase) return { erreur: 'Supabase n’est pas configuré.' };

  const identite = await identiteSession(async () => supabase);
  if (!identite) return { erreur: 'Aucune session : la ligne ne peut pas être signée.' };
  const { error } = await supabase.from(table).insert(ligne);
  return { erreur: error ? error.message : null };
}

/**
 * L'identité de la session persistée — un **compte** (D-088) — ou `null`. Rend `null` quand
 * le backend n'est pas configuré, ou quand personne n'est connecté.
 *
 * Depuis **D-156** (#527), elle ne signe **plus** jamais : un visiteur sans compte ne crée
 * plus d'utilisateur anonyme dans Supabase. C'est ce qui a fermé la porte par laquelle #527
 * laissait entrer — le compteur du comité signait l'appareil à chaque montage.
 *
 * `chargerClient` est un paramètre pour que le test puisse injecter un faux appareil, sans
 * réseau ni navigateur.
 */
export async function identiteSession(
  chargerClient: () => Promise<SessionPersistee | null> = clientMur
): Promise<string | null> {
  const supabase = await chargerClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
