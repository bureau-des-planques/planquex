import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';

/**
 * Le bandeau « une nouvelle version est prête » (#355) — le testeur **décide** de recharger.
 *
 * **Le défaut qu'il répare** : un testeur pouvait passer la soirée sur une vieille version —
 * le libellé affiché en retard d'un build sur ce que la production servait —, et signaler
 * des bugs déjà corrigés. Le service worker précaché gardait l'ancien build, sans rien dire.
 *
 * **Aucun rechargement automatique** : le service worker de `vite.config.ts` est en
 * `registerType: 'autoUpdate'`, et son inscription par défaut recharge la page dès qu'une
 * mise à jour s'active. On consomme donc `virtual:pwa-register` — c'est ce qui **empêche**
 * `vite-plugin-pwa` d'injecter son script d'auto-rechargement (`injectRegister: 'auto'` se
 * tait dès qu'un module virtuel est utilisé). `onNeedReload` reçoit l'événement à notre
 * place : on affiche, et c'est le bouton qui recharge.
 *
 * **Rien sans mise à jour** : sans service worker (le build sans PWA, les tests), l'import
 * échoue et on ne rend rien — pas de trou, pas d'espace réservé.
 */

/** La couture : s'abonner aux mises à jour, et rendre de quoi se désabonner. */
export type AbonnerAuxVersions = (signale: () => void) => Promise<() => void>;

/**
 * L'abonnement réel. L'import est **dynamique** : `virtual:pwa-register` n'existe qu'au
 * build de Vite, jamais sous `vitest` (voir `src/lib/pwa-abonnement.ts`), et son absence
 * doit être une absence, pas une panne.
 */
export const abonnerAuServiceWorker: AbonnerAuxVersions = (signale) =>
  import('@/lib/pwa-abonnement').then((module) => module.abonnerAuServiceWorkerReel(signale));

/**
 * L'état « une nouvelle version est prête », et le refus de l'afficher.
 *
 * `visible` retombe à `false` dès que le testeur ferme le bandeau ; `prete` ne revient
 * jamais à `false` une fois posé, parce qu'une mise à jour prête le reste jusqu'au
 * rechargement.
 */
export function useNouvelleVersion(abonner: AbonnerAuxVersions = abonnerAuServiceWorker) {
  const [prete, setPrete] = useState(false);
  const [fermee, setFermee] = useState(false);

  useEffect(() => {
    let vivant = true;
    let detacher: (() => void) | undefined;
    abonner(() => {
      if (vivant) setPrete(true);
    })
      .then((off) => {
        detacher = off;
      })
      // Pas de service worker, pas d'abonnement possible : il n'y a rien à annoncer.
      .catch(() => {
        if (vivant) setPrete(false);
      });
    return () => {
      vivant = false;
      detacher?.();
    };
  }, [abonner]);

  return { visible: prete && !fermee, fermer: () => setFermee(true) };
}

export function BandeauNouvelleVersion({
  abonner,
  /** Le rechargement est **injectable** : le test le remplace par un espion, la page par
   *  `window.location.reload()`. */
  recharger = () => window.location.reload()
}: {
  abonner?: AbonnerAuxVersions;
  recharger?: () => void;
}) {
  const { pathname } = useLocation();
  const { visible, fermer } = useNouvelleVersion(abonner);

  /**
   * **Pas de bandeau en combat** (#355) : on ne coupe pas une partie en cours. Il revient
   * de lui-même en quittant `/battle`, puisque `prete` n'est pas effacé.
   */
  if (!visible || pathname.startsWith('/battle')) return null;

  return (
    <div className="bandeau-version" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <p className="bandeau-version__texte">Une nouvelle version est prête.</p>
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          fermer();
          recharger();
        }}
      >
        Recharger
      </button>
      <button type="button" className="button bandeau-version__fermer" aria-label="Fermer" onClick={fermer}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
