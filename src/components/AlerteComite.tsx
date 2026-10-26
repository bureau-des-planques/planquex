/**
 * L'**alerte du comité** (D-058, D-097 (5), #212) — un post-it numéroté, qui mène au
 * **suivi**.
 *
 * Elle ne s'affiche que s'il y a **quelque chose à voir** : c'est le compteur de #212 —
 * **mes** post-its dont le statut a bougé, et les commentaires des autres sur eux, depuis
 * le repère `vu_le` (D-097 (5)). À zéro, sans base et en combat elle est **absente** : la
 * barre du bas porte déjà l'onglet Comité, et une alerte qui ne compte rien est un bruit
 * (D-058 tient : la seule entrée flottante reste celle-ci).
 *
 * Elle mène à `/comite/suivi`, pas au mur : la pastille annonce ce qui **a bougé** sur mes
 * post-its, et c'est le suivi qui le montre (D-097 (2)).
 *
 * Sous 480 px, elle n'est plus qu'une pastille d'icône — avec son nombre : une bulle de
 * texte posée sur les cartes en cachait le bord droit. `aria-label` et `title` portent le
 * nom entier et le compte dans tous les cas, donc rien ne se perd.
 *
 * Le placement est celui de D-058 : **en bas à droite, juste au-dessus des onglets**. Le
 * décalage de droite suit la marge de la coquille (`.app-shell`, 1080 px centré), pour
 * qu'elle ne s'échoue pas au bord de l'écran quand celui-ci est large.
 */
import { Link } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';

export interface AlerteComiteProps {
  /** Les choses à voir (0 = rien : l'alerte n'existe pas). */
  nombre: number;
}

export function AlerteComite({ nombre }: AlerteComiteProps) {
  if (!(nombre > 0)) return null;

  const choses = `${nombre} ${nombre > 1 ? 'choses' : 'chose'} à voir`;

  return (
    <Link
      to="/comite/suivi"
      title={`Le comité — ${choses}`}
      aria-label={`Ouvrir le suivi du comité — ${choses}`}
      className="fixed bottom-[4.6rem] right-[max(0.75rem,calc((100vw-1080px)/2+0.75rem))] z-30 inline-flex size-11 items-center justify-center gap-2 rounded-full border border-gold-deep/70 bg-bg-raised/95 text-[0.8rem] font-semibold text-gold-soft shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-[10px] transition-colors hover:border-gold hover:text-gold min-[480px]:size-auto min-[480px]:px-3.5 min-[480px]:py-2.5"
    >
      <Lightbulb size={18} aria-hidden="true" />
      <span className="hidden min-[480px]:inline">Le comité</span>
      {/* Le nombre, toujours visible : c'est lui qui fait de la bulle une alerte. */}
      <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-gold px-1 py-0.5 text-[0.65rem] font-bold leading-none text-bg">
        {nombre}
      </span>
    </Link>
  );
}
