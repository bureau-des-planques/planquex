/**
 * Les anciennes adresses du jeu et leur destination (D-075, #168).
 *
 * « Chariot » est devenu **Deck** et « Parc » **Collection** : les liens déjà donnés
 * aux testeurs de l'alpha (`/parc`, `/chariot`) ne doivent pas mener à un écran qui
 * ne les connaît plus. Source **unique** de ces correspondances :
 *
 * - `src/App.tsx` en fait des routes qui redirigent (`Navigate`) — c'est ce qui sert une
 *   visite à l'intérieur de l'application, et une application **installée** : le service
 *   worker répond alors par l'écran d'accueil sans passer par l'hébergeur ;
 * - `vercel.json` les porte aussi en `308` (`redirects`), pour une visite **directe** ;
 *   `src/redirections.test.ts` compare les deux.
 *
 * Les noms de route sont en anglais (`/collection`, `/deck`, `/battle`, `/settings`) :
 * seuls les libellés affichés sont en français.
 */
export const REDIRECTIONS: Readonly<Record<string, string>> = {
  '/parc': '/collection',
  '/chariot': '/deck'
};
