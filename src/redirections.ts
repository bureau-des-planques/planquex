/**
 * Les anciennes adresses du jeu et leur destination (D-075, #168 ; D-097, #210).
 *
 * « Chariot » est devenu **Deck** et « Parc » **Collection** ; la **Boîte à idées** est
 * devenue **le comité** (`/idees` → `/comite`) et les **nouveautés** ont laissé la place
 * à la **feuille de route** (`/nouveautes` → `/feuille-de-route`) : les liens déjà donnés
 * aux testeurs de l'alpha ne doivent pas mener à un écran qui ne les connaît plus.
 * Source **unique** de ces correspondances :
 *
 * - `src/App.tsx` en fait des routes qui redirigent (`Navigate`) — c'est ce qui sert une
 *   visite à l'intérieur de l'application, et une application **installée** : le service
 *   worker répond alors par l'écran d'accueil sans passer par l'hébergeur ;
 * - `vercel.json` les porte aussi en `308` (`redirects`), pour une visite **directe** ;
 *   `src/redirections.test.tsx` compare les deux.
 *
 * Les noms de route sont en anglais (`/collection`, `/deck`, `/battle`, `/settings`) :
 * seuls les libellés affichés sont en français.
 */
export const REDIRECTIONS: Readonly<Record<string, string>> = {
  '/parc': '/collection',
  '/chariot': '/deck',
  '/idees': '/comite',
  '/nouveautes': '/feuille-de-route'
};

/**
 * Les anciennes adresses dont la **destination est publique**, donc **hors de la garde**
 * des comptes (D-088) : `/feuille-de-route` se lit sans compte, comme les nouveautés
 * avant elle (D-090, D-097 (3)). Rediriger dans le `Layout` enverrait un visiteur vers
 * `/connexion` au lieu de l'écran qu'il demandait.
 */
export const REDIRECTIONS_PUBLIQUES: readonly string[] = ['/nouveautes'];
