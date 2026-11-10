/**
 * **Ouvrir un Arrivage — côté serveur** (#651, D-179 (2)).
 *
 * D-179 : « Le serveur tire avec la même règle (`src/game/pack.ts`, pure et seedée), crédite
 * la Collection **une seule fois** (clé d'idempotence, transaction) et rend les cartes ; le
 * client n'avance plus de générateur. »
 *
 * Cette fonction fait trois choses, et rien de plus :
 *
 * 1. **Vérifier le JWT** de l'appelant (`GET /auth/v1/user`, avec la clé publique) : sans compte,
 *    pas d'ouverture — hors ligne, l'écran refuse, il n'y a pas de tirage local.
 * 2. **Tirer** cinq cartes avec la copie **générée** du tirage (`arrivage-genere.ts`), à
 *    partir d'une graine tirée par `crypto`. La copie est produite par
 *    `npm run arrivage:serveur` et gardée par `scripts/gardes/arrivage-serveur.test.ts`.
 * 3. **Créditer une seule fois** par la fonction `public.crediter_arrivage`, dans **une**
 *    transaction : la ligne d'ouverture et la Collection. La même clé rejouée rend les
 *    cartes d'origine sans rien recréditer — un double clic ou un retry réseau ne double pas.
 *
 * **Pourquoi la connexion directe à la base** (`SUPABASE_DB_URL`) et non PostgREST : la
 * fonction `crediter_arrivage` est **fermée au client** (`fonctions.test.ts` : le navigateur
 * ne l'exécute pas, sans quoi il se créditerait les cartes qu'il invente). Elle lit le
 * compte dans `auth.uid()`, donc la transaction doit porter le JWT vérifié. On pose
 * `request.jwt.claim.sub` dans la transaction, puis on appelle la fonction : `auth.uid()`
 * désigne le compte, et aucun client n'a le droit d'appeler la fonction lui-même.
 *
 * **Sans réseau au déploiement ?** La fonction n'appelle que l'API Auth de Supabase et sa
 * base ; elle ne tire aucune ressource externe. Le tirage est **local au dossier**.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { openPackCards, seedRng } from './arrivage-genere.ts';

/** Le corps d'une ouverture : la clé d'idempotence choisie par le client. */
interface Demande {
  cle?: unknown;
}

/** Les en-têtes CORS : le jeu est servi par Vercel, l'Edge Function par Supabase. */
function cors(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function repondre(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() }
  });
}

/** Refus nommé : le client affiche « connecte-toi pour ouvrir » plutôt qu'une erreur nue. */
function refus(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() }
  });
}

/** La connexion à la base, montée une fois par instance de fonction. */
let base: ReturnType<typeof postgres> | null = null;

function connexion(): ReturnType<typeof postgres> {
  base ??= postgres(Deno.env.get('SUPABASE_DB_URL')!, {
    // Le pooler de Supabase peut être en mode transaction : pas d'instructions préparées.
    prepare: false,
    max: 2
  });
  return base;
}

/** Une graine 32 bits, tirée par la source cryptographique de la plateforme. */
function graine(): number {
  const octets = new Uint32Array(1);
  crypto.getRandomValues(octets);
  return octets[0];
}

/**
 * Le compte d'un JWT, vérifié par l'API Auth de Supabase — `GET /auth/v1/user`, le même
 * geste que `auth.getUser(token)` du SDK, sans embarquer le SDK : la fonction n'a besoin
 * que de l'identifiant. Un jeton absent, expiré ou falsifié rend `null`.
 */
async function compteDuJeton(jeton: string): Promise<string | null> {
  const url = new URL('/auth/v1/user', Deno.env.get('SUPABASE_URL')!);
  const reponse = await fetch(url, {
    headers: {
      apikey: Deno.env.get('SUPABASE_ANON_KEY')!,
      Authorization: `Bearer ${jeton}`
    }
  });
  if (!reponse.ok) return null;
  const compte = (await reponse.json()) as { id?: unknown };
  return typeof compte.id === 'string' ? compte.id : null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
  if (req.method !== 'POST') return refus('arrivage_methode : POST attendu', 405);

  // 1. Le compte. Le JWT est vérifié par l'API Auth ; un jeton absent ou falsifié est refusé.
  const entete = req.headers.get('Authorization') ?? '';
  if (!entete.startsWith('Bearer ')) {
    return refus('arrivage_sans_jeton : connecte-toi pour ouvrir', 401);
  }
  const jeton = entete.slice('Bearer '.length).trim();

  const compteId = await compteDuJeton(jeton);
  if (!compteId) {
    return refus('arrivage_jeton_invalide : connecte-toi pour ouvrir', 401);
  }

  // 2. La demande : une clé d'idempotence non vide, et rien d'autre. Le serveur ne prend ni
  // cartes ni graine du client — c'est ce qui fait de l'acquisition une décision serveur.
  let demande: Demande;
  try {
    demande = (await req.json()) as Demande;
  } catch {
    return refus('arrivage_demande_illisible : corps JSON attendu', 400);
  }
  const cle = typeof demande.cle === 'string' ? demande.cle.trim() : '';
  if (cle === '' || cle.length > 200) {
    return refus('arrivage_sans_cle : une ouverture doit porter sa clé', 400);
  }

  // 3. Le tirage, par la copie générée de `src/game/pack.ts`.
  const tirage = graine();
  const cartes = openPackCards({ rng: seedRng(tirage) }).map((carte) => ({
    id: carte.id,
    rarity: carte.rarity
  }));

  // 4. Le crédit, une seule fois, dans une transaction : la ligne et la Collection.
  try {
    const credit = await connexion().begin(async (tx: ReturnType<typeof connexion>) => {
      await tx`select set_config('request.jwt.claim.sub', ${compteId}, true)`;
      const [ligne] = await tx`
        select public.crediter_arrivage(${cle}, ${tx.json(cartes)}, ${tirage}) as cartes
      `;
      // **La graine rendue est celle de la ligne**, pas celle du tirage courant : au rejeu
      // d'une clé, le crédit rend les cartes d'origine, et une graine neuve mentirait sur
      // leur origine — un client qui rejouerait le tirage obtiendrait d'autres cartes que
      // celles créditées (D-179 (8)). Constaté sur une ouverture réelle le 03/11/2026.
      const [ouverture] = await tx`
        select seed from public.pack_openings where user_id = ${compteId} and cle = ${cle}
      `;
      return {
        cartes: ligne.cartes as { id: string; rarity: string }[],
        graine: Number(ouverture.seed)
      };
    });

    return repondre({ cards: credit.cartes, seed: credit.graine });
  } catch (erreur) {
    // **Un compte non approuvé est refusé par la base** (0028, D-199 (4)) : `crediter_arrivage`
    // lève `insufficient_privilege` (42501). On le rend en 403 — le client le lit comme un
    // refus (« disponible après approbation »), pas comme une panne à réessayer.
    if ((erreur as { code?: unknown } | null)?.code === '42501') {
      return refus('arrivage_compte_non_approuve : l’Arrivage s’ouvre après l’approbation du compte', 403);
    }
    console.error('arrivage : le crédit a échoué', erreur);
    return refus('arrivage_credit_refuse : l’ouverture n’a pas été créditée', 500);
  }
});
