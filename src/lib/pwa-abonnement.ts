/**
 * L'abonnement réel au service worker (#355) — **le seul fichier qui touche le module
 * virtuel** `virtual:pwa-register`.
 *
 * Il est isolé pour une raison précise : `vitest` ne connaît pas les modules virtuels de
 * `vite-plugin-pwa` (le plugin n'est pas enregistré dans `vitest.config.ts`). Un import
 * littéral dans un composant ferait échouer la **transformation** du composant, donc tous
 * ses tests d'écran. Isolé ici et chargé par `import()` dynamique, il n'existe qu'au build
 * de Vite : sous `vitest`, l'import échoue et l'échec est traité comme « pas de service
 * worker » — exactement ce qu'on veut.
 *
 * `registerSW` est appelé avec `onNeedReload` : en `registerType: 'autoUpdate'`, c'est cette
 * option qui **remplace** le rechargement automatique par notre signal (voir
 * `client/build/register.js` de `vite-plugin-pwa`). Consommer ce module virtuel empêche
 * aussi le plugin d'injecter son script d'auto-rechargement.
 */
export async function abonnerAuServiceWorkerReel(signale: () => void): Promise<() => void> {
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({
    immediate: true,
    onNeedReload: () => signale()
  });
  // `registerSW` ne rend pas de désabonnement (`workbox-window` vit avec la page) : la
  // fonction vide garde le contrat de l'interface.
  return () => {};
}
