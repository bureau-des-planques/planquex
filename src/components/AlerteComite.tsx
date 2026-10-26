/**
 * L'**entrée du comité** (D-058, D-097) — la bulle qui mène au mur, présente partout sauf
 * pendant un combat. Le fichier porte le nom d'**alerte** parce que D-097 en fait un post-it
 * numéroté (#212) ; tant que ce compteur n'existe pas, la forme et le geste ne changent pas.
 *
 * Elle est **sans pastille ni compteur** : le mur de l'alpha n'a rien à compter. Sous 480 px,
 * elle n'est plus qu'une pastille d'icône : une bulle de texte posée sur les cartes en cachait
 * le bord droit. `aria-label` et `title` portent le nom entier dans tous les cas, donc il ne se perd jamais.
 *
 * Le placement est celui de D-058 : **en bas à droite, juste au-dessus des onglets**. Le
 * décalage de droite suit la marge de la coquille (`.app-shell`, 1080 px centré), pour
 * qu'elle ne s'échoue pas au bord de l'écran quand celui-ci est large.
 */
import { Link } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';

export function AlerteComite() {
  return (
    <Link
      to="/comite"
      title="Le comité"
      aria-label="Ouvrir le comité"
      className="fixed bottom-[4.6rem] right-[max(0.75rem,calc((100vw-1080px)/2+0.75rem))] z-30 inline-flex size-11 items-center justify-center gap-2 rounded-full border border-gold-deep/70 bg-bg-raised/95 text-[0.8rem] font-semibold text-gold-soft shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-[10px] transition-colors hover:border-gold hover:text-gold min-[480px]:size-auto min-[480px]:px-3.5 min-[480px]:py-2.5"
    >
      <Lightbulb size={18} aria-hidden="true" />
      <span className="hidden min-[480px]:inline">Le comité</span>
    </Link>
  );
}
