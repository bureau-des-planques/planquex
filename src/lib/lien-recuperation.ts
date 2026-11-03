/**
 * Le drapeau du lien de récupération (D-159 (3), #654).
 *
 * **Pourquoi ce module existe.** Le lien envoyé par Supabase revient sur
 * `…/connexion#access_token=…&type=recovery`. Le client Supabase est créé avec
 * `detectSessionInUrl: true` : **sa création consomme et efface le fragment**. Or `App` crée
 * ce client dans un effet au montage, alors que le morceau paresseux `/connexion` se rend
 * après (mesuré en production : fragment effacé à 254 ms, `Connexion` rendu à 260 ms). Un
 * `Connexion` qui relisait `window.location.hash` à son premier rendu lisait donc le vide :
 * le testeur arrivait au bureau avec une session, sans jamais choisir de nouveau mot de passe.
 *
 * **Ce que fait ce module.** Il lit le drapeau **au chargement**, avant `createRoot` et donc
 * avant tout client Supabase (`src/main.tsx`). `Connexion` le **lit**, il ne relit plus le
 * fragment — le drapeau ne dépend donc plus du moment où l'écran se rend.
 *
 * `oublierLienDeRecuperation()` sert une fois le mot de passe changé : le lien ne doit plus
 * arrêter la garde, ni resurgir à un rechargement.
 */
const FRAGMENT_RECUPERATION = /(^|[#&])type=recovery/;

function lireLeFragment(): boolean {
  return typeof window !== 'undefined' && FRAGMENT_RECUPERATION.test(window.location.hash);
}

let drapeau = lireLeFragment();

/** Le lien de récupération a-t-il été reçu ? Vrai tant qu'il n'a pas servi. */
export function lienDeRecuperation(): boolean {
  return drapeau;
}

/**
 * Retient le drapeau. Appelé par `main.tsx` **avant** `createRoot` : c'est la garantie qu'il
 * est lu avant que le client Supabase ne consomme le fragment. Idempotent — un drapeau déjà
 * posé ne se perd pas.
 */
export function retenirLienDeRecuperation(): void {
  if (!drapeau) drapeau = lireLeFragment();
}

/** Le mot de passe a été changé : le lien a servi, et ne doit plus retenir la garde. */
export function oublierLienDeRecuperation(): void {
  drapeau = false;
}
