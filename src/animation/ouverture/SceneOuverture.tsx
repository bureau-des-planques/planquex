/*
 * **L'ouverture d'un Arrivage** (#283, `docs/SPEC-OUVERTURE-ARRIVAGE.md`).
 *
 * Quatre temps : le sachet se creuse sous le doigt, l'autocollant se décolle, la ligne de pointillés
 * se déchire, les cartes sortent **de l'intérieur**. Les règles vivent dans `etats.ts` (pur, testé) ;
 * ici il n'y a que le rendu et les gestes.
 *
 * Trois choses ne sont **pas** facultatives, et viennent des décisions :
 *  - **Mouvement réduit** (D-098) : sous la bascule du store ou `prefers-reduced-motion`, on arrive
 *    directement à l'état final, cartes à plat, sans shader ni cascade ;
 *  - **le bouton « Ouvrir »** (les critères WCAG de l'accès au pointeur, `SPEC-OUVERTURE-ARRIVAGE.md` §5) : le glissement n'est jamais le seul chemin,
 *    et c'est aussi l'entrée clavier ;
 *  - **aucune information ne vit dans l'animation** : le tirage, le badge « Nouvelle » et le bouton
 *    restent lisibles à l'arrêt.
 *
 * Le rendu du creux est **facultatif** : sans WebGL2, on garde les photos et les gestes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@/data/types';
import { CardView } from '@/components/CardView';
import { useMouvementReduit } from '@/components/use-mouvement-reduit';
import { creerCreux, creerMotif, type Creux, type Motif } from './creux';
import { avancer, creer, demarrer, relacher, zone, type EtatOuverture, type Geometrie } from './etats';

import p0 from './plates/p0.webp';
import p1 from './plates/p1.webp';
import p2 from './plates/p2.webp';
import p3 from './plates/p3.webp';
import p4 from './plates/p4.webp';
import p5 from './plates/p5.webp';
import p6 from './plates/p6.webp';
import masque from './plates/masque.webp';
import etiquetteVolee from './plates/etiquette-volee.webp';

/** Les sept états du sachet, dans l'ordre du geste. */
const PLAQUES = [p0, p1, p2, p3, p4, p5, p6];

/** La boîte de l'étiquette, en fraction de la zone (relevée sur la photo). */
const BOITE_ETIQUETTE = { x: 0.285, y: 0.1, w: 0.43, h: 0.11 };
/** L'ordonnée de la ligne de pointillés, en fraction de la hauteur. */
const LIGNE = 0.075;
/** Demi-bande où la ligne accepte le doigt. */
const TOLERANCE = 0.08;

interface Props {
  /** Le tirage réel : les cartes montrées sont celles-là, jamais d'autres. */
  cartes: readonly Card[];
  /** Les index des cartes que le testeur n'avait pas. */
  neuves?: ReadonlySet<number>;
  onRanger: () => void;
}

/** Les opacités des plaques : deux voisines se croisent, jamais plus. */
export function opacites(etat: EtatOuverture): number[] {
  const poids = PLAQUES.map(() => 0);
  if (etat.phase === 'ferme') {
    poids[0] = 1;
    return poids;
  }
  if (etat.phase === 'ouvert') {
    poids[6] = 1;
    return poids;
  }
  const position = etat.phase === 'etiquette' ? Math.min(3, etat.etiquette * 3) : 3 + Math.min(3, etat.dechirure * 3);
  const bas = Math.min(PLAQUES.length - 1, Math.floor(position));
  const haut = Math.min(PLAQUES.length - 1, bas + 1);
  if (bas === haut) {
    poids[bas] = 1;
    return poids;
  }
  const f = position - bas;
  poids[bas] = 1 - f;
  poids[haut] = f;
  return poids;
}

export function SceneOuverture({ cartes, neuves, onRanger }: Props) {
  const reduit = useMouvementReduit();
  const [etat, setEtat] = useState<EtatOuverture>(() =>
    reduit ? { phase: 'ouvert', etiquette: 1, dechirure: 1 } : creer()
  );
  const [vol, setVol] = useState(false);
  const [sortie, setSortie] = useState<'aucune' | 'montent' | 'eventail'>(() => (reduit ? 'eventail' : 'aucune'));
  const [creuxPret, setCreuxPret] = useState(false);

  const zoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const creux = useRef<Creux | null>(null);
  const motif = useRef<Motif>(creerMotif());
  const depart = useRef({ x: 0, y: 0 });
  const prise = useRef<ReturnType<typeof zone>>(null);
  const sens = useRef(1);
  const enfoncement = useRef(0);
  const cible = useRef(0);
  const point = useRef({ px: 0.5, py: 0.55 });
  const image = useRef(0);
  const lancer = useRef<(() => void) | null>(null);
  const repliRef = useRef<HTMLSpanElement>(null);

  const geometrie = useCallback((): Geometrie => {
    const el = zoneRef.current;
    const largeur = el?.clientWidth || 315;
    const hauteur = el?.clientHeight || 560;
    return { largeur, hauteur, ligne: hauteur * LIGNE, tolerance: hauteur * TOLERANCE };
  }, []);

  // Les plaques sont décodées d'avance : un fondu vers une image non décodée fait un blanc.
  useEffect(() => {
    for (const src of [...PLAQUES, etiquetteVolee]) {
      const image = new Image();
      image.src = src;
      void image.decode?.().catch(() => undefined);
    }
  }, []);

  // Le creux : monté seulement si le mouvement n'est pas réduit, et jamais indispensable.
  useEffect(() => {
    if (reduit) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let vivant = true;
    void creerCreux(canvas, { film: p0, masque }).then((rendu) => {
      if (!vivant) {
        rendu?.detruire();
        return;
      }
      creux.current = rendu;
      if (rendu) {
        const el = zoneRef.current;
        rendu.redimensionner(el?.clientWidth || 315, el?.clientHeight || 560);
        setCreuxPret(true);
      }
    });
    return () => {
      vivant = false;
      creux.current?.detruire();
      creux.current = null;
    };
  }, [reduit]);

  // Le ressort du creux : une seule boucle, qui tourne tant que le film travaille.
  useEffect(() => {
    if (reduit) return undefined;
    let raf = 0;
    let dernier = 0;
    let vitesse = 0;
    const pas = (t: number): void => {
      const dt = Math.min(0.032, (t - dernier) / 1000 || 0.016);
      dernier = t;
      vitesse += (240 * (cible.current - enfoncement.current) - 15 * vitesse) * dt;
      enfoncement.current += vitesse * dt;
      creux.current?.dessiner(point.current.px, point.current.py, enfoncement.current, motif.current);
      if (Math.abs(cible.current - enfoncement.current) > 0.002 || Math.abs(vitesse) > 0.02) {
        raf = requestAnimationFrame(pas);
        return;
      }
      enfoncement.current = cible.current;
      vitesse = 0;
      raf = 0;
      creux.current?.dessiner(point.current.px, point.current.py, enfoncement.current, motif.current);
    };
    lancer.current = (): void => {
      if (raf) return;
      dernier = performance.now();
      raf = requestAnimationFrame(pas);
    };
    return () => {
      if (raf) cancelAnimationFrame(raf);
      lancer.current = () => undefined;
    };
  }, [reduit]);

  // Les cartes : elles émergent de l'intérieur, puis s'ouvrent devant.
  useEffect(() => {
    if (etat.phase !== 'ouvert' || reduit) return undefined;
    setSortie('montent');
    const t = window.setTimeout(() => setSortie('eventail'), 560);
    return () => window.clearTimeout(t);
  }, [etat.phase, reduit]);

  const avancerCreux = useCallback((px: number, py: number, vers: number) => {
    point.current = { px, py };
    cible.current = vers;
    // Sans WebGL, le creux est une **ombre en dégradé** : moins fidèle, mais l'appui répond
    // toujours (spec §7.3 : le repli est obligatoire, pas optionnel).
    const repli = repliRef.current;
    if (!creux.current && repli) {
      repli.style.left = `${px * 100}%`;
      repli.style.top = `${py * 100}%`;
      repli.style.opacity = String(vers);
    }
    lancer.current?.();
  }, []);

  const surAppui = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (etat.phase === 'ouvert') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    depart.current = { x, y };
    sens.current = 1;
    motif.current.renouveler((image.current = (image.current + 1) >>> 0) + Date.now());
    const geo = geometrie();
    const boite = {
      x: BOITE_ETIQUETTE.x * geo.largeur,
      y: BOITE_ETIQUETTE.y * geo.hauteur,
      w: BOITE_ETIQUETTE.w * geo.largeur,
      h: BOITE_ETIQUETTE.h * geo.hauteur
    };
    const attrapee = zone(etat, x, y, boite, geo);
    prise.current = attrapee;
    if (!attrapee) {
      // Aucun geste : c'est le toucher, qui creuse le film.
      avancerCreux(x / geo.largeur, y / geo.hauteur, 1);
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setEtat(demarrer(etat, attrapee));
  };

  const surMouvement = (e: React.PointerEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!prise.current) {
      avancerCreux(x / rect.width, y / rect.height, 1);
      return;
    }
    const dx = x - depart.current.x;
    const dy = y - depart.current.y;
    const geo = geometrie();
    setEtat((courant) => avancer(courant, dx, dy, geo));
    if (etat.phase === 'etiquette' && Math.abs(dx) > 24) sens.current = Math.sign(dx) || 1;
  };

  const surRelache = (): void => {
    avancerCreux(point.current.px, point.current.py, 0);
    if (!prise.current) return;
    prise.current = null;
    setEtat((courant) => {
      const suivant = relacher(courant);
      if (courant.phase === 'etiquette' && suivant.phase === 'dechirure') {
        setVol(true);
        window.setTimeout(() => setVol(false), 900);
      }
      return suivant;
    });
  };

  /** Le chemin sans geste — les critères WCAG d'accès au pointeur, et l'entrée clavier. */
  const toutAfficher = (): void => {
    setEtat({ phase: 'ouvert', etiquette: 1, dechirure: 1 });
    setSortie(reduit ? 'eventail' : 'montent');
    if (!reduit) window.setTimeout(() => setSortie('eventail'), 560);
  };

  const poids = useMemo(() => opacites(etat), [etat]);
  const miroir = etat.phase === 'etiquette' ? sens.current : 1;
  const nombre = cartes.length;

  return (
    <div
      className="ouverture"
      data-etape={etat.phase}
      data-etiquette={etat.etiquette.toFixed(2)}
      data-dechirure={etat.dechirure.toFixed(2)}
      data-testid="ouverture"
    >
      <p className="ouverture__titre">
        Arrivage : {nombre} carte{nombre > 1 ? 's' : ''}
        {neuves && neuves.size > 0 ? ` · ${neuves.size} nouvelle${neuves.size > 1 ? 's' : ''}` : ''}
      </p>

      <div className="ouverture__scene">
        <div
          ref={zoneRef}
          className="ouverture__zone"
          data-zone
          role="group"
          aria-label="Le sachet"
          aria-describedby="ouverture-consigne"
          onPointerDown={surAppui}
          onPointerMove={surMouvement}
          onPointerUp={surRelache}
          onPointerCancel={surRelache}
          onLostPointerCapture={surRelache}
        >
          <div className={`ouverture__sac${etat.phase === 'ouvert' ? ' ouverture__sac--descend' : ''}`}>
            {PLAQUES.map((src, i) => (
              <img
                key={src}
                className="ouverture__plaque"
                src={src}
                alt=""
                draggable={false}
                style={{ opacity: poids[i], transform: `scaleX(${miroir})` }}
              />
            ))}
            {etat.phase === 'dechirure' && etat.dechirure > 0.02 && etat.dechirure < 1 && (
              // Le front de la déchirure : un repère fin qui suit le doigt. Il ne porte **aucune**
              // information (le pourcentage est dans la consigne), il dit seulement où en est la ligne.
              <span
                className="ouverture__front"
                aria-hidden="true"
                style={{ left: `${etat.dechirure * 100}%`, top: `${0.075 * 100}%` }}
              />
            )}
            {!reduit && !creuxPret && etat.phase !== 'ouvert' && (
              <span ref={repliRef} className="ouverture__creux-repli" aria-hidden="true" />
            )}
            {creuxPret && etat.phase !== 'ouvert' && (
              <canvas ref={canvasRef} className="ouverture__creux" aria-hidden="true" />
            )}
          </div>

          {vol && (
            <img
              className="ouverture__vole"
              src={etiquetteVolee}
              alt=""
              draggable={false}
              style={{ ['--sens' as string]: String(sens.current) }}
            />
          )}
        </div>

        {/* Les cartes sont **toujours** dans le DOM, même avant l'ouverture : le tirage et le badge
          « Nouvelle » ne dépendent d'aucune animation (D-098). Elles émergent dans la bande du haut,
          puis se posent en rangée sous le sachet — la largeur de la pochette ne peut pas les tenir. */}
        <div className={`ouverture__cartes ouverture__cartes--${sortie}`} data-cartes>
          {cartes.map((carte, i) => (
            <div key={`${carte.id}-${i}`} className="ouverture__carte" style={{ ['--i' as string]: String(i) }}>
              {neuves?.has(i) && <span className="ouverture__neuve">Nouvelle</span>}
              <CardView card={carte} compact />
            </div>
          ))}
        </div>
      </div>

      <p className="ouverture__consigne" id="ouverture-consigne" data-consigne>
        {etat.phase === 'ferme' && "Touche le sachet, puis tire l'étiquette"}
        {etat.phase === 'etiquette' && 'Tire encore, ou lâche : elle se recolle'}
        {etat.phase === 'dechirure' && 'Glisse le doigt sur les pointillés'}
        {etat.phase === 'ouvert' && 'Tout est sorti'}
      </p>

      <div className="ouverture__actions">
        {etat.phase !== 'ouvert' && (
          <button type="button" className="button" data-tout-afficher onClick={toutAfficher}>
            Tout afficher
          </button>
        )}
        <button type="button" className="button button--primary" onClick={onRanger}>
          Ranger dans la Collection
        </button>
      </div>
    </div>
  );
}
