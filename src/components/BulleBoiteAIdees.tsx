/**
 * La **bulle** de la Boîte à idées (D-058) — l'entrée du mur, présente partout sauf
 * pendant un combat.
 *
 * Elle est **sans pastille ni compteur** : le mur de l'alpha n'a rien à compter. Son
 * libellé se raccourcit en « Idées » sous 480 px, où la place manque, et c'est le nom
 * complet qui s'affiche au-delà — `aria-label` et `title` portent le nom entier dans
 * tous les cas, donc il ne se perd jamais.
 *
 * Le placement est celui de D-058 : **en bas à droite, juste au-dessus des onglets**. Le
 * décalage de droite suit la marge de la coquille (`.app-shell`, 1080 px centré), pour
 * qu'elle ne s'échoue pas au bord de l'écran quand celui-ci est large.
 */
import { Link } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';

export function BulleBoiteAIdees() {
  return (
    <Link
      to="/idees"
      title="La Boîte à idées"
      aria-label="Ouvrir la Boîte à idées"
      className="fixed bottom-[4.6rem] right-[max(1rem,calc((100vw-1080px)/2+1rem))] z-30 inline-flex items-center gap-2 rounded-full border border-gold-deep/70 bg-bg-raised/95 px-3.5 py-2.5 text-[0.8rem] font-semibold text-gold-soft shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-[10px] transition-colors hover:border-gold hover:text-gold"
    >
      <Lightbulb size={18} aria-hidden="true" />
      <span className="min-[480px]:hidden">Idées</span>
      <span className="hidden min-[480px]:inline">La Boîte à idées</span>
    </Link>
  );
}
