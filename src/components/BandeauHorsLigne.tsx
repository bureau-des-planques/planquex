import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Le navigateur est-il en ligne ? Lu au montage, puis suivi par les événements
 * `online` / `offline`. `navigator.onLine` ne promet que **l'absence** de réseau :
 * « en ligne » veut dire « une interface réseau existe », pas « le serveur répond ».
 * C'est assez pour le bandeau, qui ne parle que de l'absence.
 */
export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const monte = () => setEnLigne(true);
    const tombe = () => setEnLigne(false);
    window.addEventListener('online', monte);
    window.addEventListener('offline', tombe);
    return () => {
      window.removeEventListener('online', monte);
      window.removeEventListener('offline', tombe);
    };
  }, []);

  return enLigne;
}

/**
 * Le **bandeau hors ligne** (#131, D-060 critère 3). Le jeu est une PWA : le service
 * worker précache tout, donc le combat, la Collection et le Deck marchent sans réseau.
 * Le bandeau dit **ce qui continue** et **ce qui attend** — sans quoi un invité hors
 * ligne croirait la page en panne le jour où le mur ou les pouces ne répondent pas.
 */
export function BandeauHorsLigne() {
  const enLigne = useEnLigne();
  if (enLigne) return null;

  return (
    <p className="bandeau-hors-ligne" role="status">
      <WifiOff size={16} aria-hidden />
      <span>
        <strong>Hors ligne.</strong> Le jeu continue : combats, Collection et Deck ne demandent aucun
        réseau. Le mur du comité et les traces de combat attendent le retour de la connexion.
      </span>
    </p>
  );
}
