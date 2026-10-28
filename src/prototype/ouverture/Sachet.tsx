/* PROTOTYPE JETABLE (#283) — l'étiquette et la déchirure, en **photos successives**.
 *
 * Chaque état du sachet est une photo tirée par gflow depuis la précédente : même pochette, même
 * cadrage, même lumière. Le geste ne dessine rien, il **fond** d'une photo à l'autre.
 *
 * Corrections du 28/10 après essai sur téléphone :
 *  - l'étiquette se décolle **dans le sens du doigt** (les plaques sont miroir quand on tire à gauche)
 *    et plus lentement (170 px de course au lieu de 96) ;
 *  - le **son ne se déclenche plus au clic** : il est synthétisé (bruit filtré) et ne craque que
 *    pendant le mouvement — donc il suit le doigt et se tait quand on s'arrête. Aucun asset, donc
 *    aucune question de licence ;
 *  - la **déchirure** ne fait que suivre le doigt le long des pointillés ; elle n'ouvre le sachet
 *    qu'une fois la ligne parcourue **en entier**, et c'est là que les cartes sortent.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CARDS } from '@/data';
import { CardView } from '@/components/CardView';
import { avancer, creer, demarrer, relacher, SEUIL_DECHIRURE, type Etat, type Zone } from './gestes';

const PLAQUES = [
  new URL('./plates/p0.jpg', import.meta.url).href,
  new URL('./plates/p1.jpg', import.meta.url).href,
  new URL('./plates/p2.jpg', import.meta.url).href,
  new URL('./plates/p3.jpg', import.meta.url).href,
  new URL('./plates/p4.jpg', import.meta.url).href,
  new URL('./plates/p5.jpg', import.meta.url).href,
  new URL('./plates/p6.jpg', import.meta.url).href
];

/** L'autocollant détouré, tiré par gflow puis détouré sur fond noir : il s'envole, il ne s'efface pas. */
const VOLEE = new URL('./plates/etiquette-volee.png', import.meta.url).href;

/** La boîte de l'étiquette, en fraction de la zone. */
const ETIQUETTE = { x: 0.285, y: 0.1, w: 0.43, h: 0.11 };
/** L'ordonnée de la ligne de pointillés, en fraction de la hauteur. */
const LIGNE = 0.075;

export function opacites(etat: Etat): number[] {
  const vides = PLAQUES.map(() => 0);
  if (etat.phase === 'ferme') {
    vides[0] = 1;
    return vides;
  }
  if (etat.phase === 'ouvert') {
    vides[6] = 1;
    return vides;
  }
  const position = etat.phase === 'etiquette' ? Math.min(3, etat.etiquette * 3) : 3 + Math.min(3, etat.dechirure * 3);
  const bas = Math.min(PLAQUES.length - 1, Math.floor(position));
  const haut = Math.min(PLAQUES.length - 1, bas + 1);
  const f = position - bas;
  if (bas === haut) {
    vides[bas] = 1;
    return vides;
  }
  vides[bas] = 1 - f;
  vides[haut] = f;
  return vides;
}

/** Le craquement : du bruit blanc filtré, en grains courts. Pas d'asset, donc pas de licence. */
function synthetiseur() {
  let ctx: AudioContext | null = null;
  let bruit: AudioBuffer | null = null;
  const demarrer = (): AudioContext => {
    if (!ctx) {
      ctx = new AudioContext();
      bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = bruit.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    }
    void ctx.resume();
    return ctx;
  };
  const grain = (c: AudioContext, frequence: number, duree: number, gain: number, q = 3): void => {
    if (!bruit) return;
    const src = c.createBufferSource();
    src.buffer = bruit;
    src.playbackRate.value = 0.6 + Math.random() * 0.8;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = frequence;
    bp.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t, Math.random() * 0.5, duree + 0.02);
    src.stop(t + duree + 0.03);
  };
  return {
    reveiller: demarrer,
    /** Un craquement de film : plus on tire vite, plus il est dense et clair. */
    craquer(intensite: number): void {
      if (!ctx || ctx.state !== 'running' || !bruit) return;
      const n = 1 + Math.round(intensite * 2);
      for (let i = 0; i < n; i += 1) {
        window.setTimeout(
          () =>
            grain(
              ctx as AudioContext,
              900 + Math.random() * 2600,
              0.02 + Math.random() * 0.05,
              0.05 + intensite * 0.12
            ),
          i * 18
        );
      }
    },
    /** La déchirure : un souffle descendant, une fois. */
    dechirer(): void {
      if (!ctx || ctx.state !== 'running' || !bruit) return;
      grain(ctx, 2400, 0.28, 0.3, 1.2);
      grain(ctx, 1200, 0.34, 0.22, 1.5);
    },
    /** L'ouverture : un « pop » grave et court. */
    ouvrir(): void {
      if (!ctx || ctx.state !== 'running') return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(180, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.22, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.4);
    }
  };
}

export function Sachet() {
  const [etat, setEtat] = useState<Etat>(creer);
  const [muet, setMuet] = useState(false);
  const [vol, setVol] = useState(false);
  const [sortie, setSortie] = useState<'aucune' | 'montent' | 'eventail'>('aucune');
  const zone = useRef<HTMLDivElement>(null);
  const depart = useRef({ x: 0, y: 0, t: 0 });
  const prise = useRef<Zone | null>(null);
  const sens = useRef(1);
  const son = useMemo(synthetiseur, []);
  const dernierCrac = useRef(0);

  useEffect(() => {
    for (const src of PLAQUES) {
      const image = new Image();
      image.src = src;
      void image.decode().catch(() => undefined);
    }
  }, []);

  // La déchirure finie ouvre le sachet : les cartes montent de l'intérieur, puis s'ouvrent
  // en éventail devant, pendant que le sachet descend.
  useEffect(() => {
    if (etat.phase !== 'ouvert') return undefined;
    son.ouvrir();
    setSortie('montent');
    const t = window.setTimeout(() => setSortie('eventail'), 560);
    return () => window.clearTimeout(t);
  }, [etat.phase, son]);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const surAppui = (e: React.PointerEvent<HTMLDivElement>) => {
    son.reveiller();
    const [x, y] = point(e);
    const largeur = e.currentTarget.clientWidth;
    const hauteur = e.currentTarget.clientHeight;
    depart.current = { x, y, t: performance.now() };
    sens.current = 1;
    const dansEtiquette =
      x >= ETIQUETTE.x * largeur &&
      x <= (ETIQUETTE.x + ETIQUETTE.w) * largeur &&
      y >= ETIQUETTE.y * hauteur &&
      y <= (ETIQUETTE.y + ETIQUETTE.h) * hauteur;
    const presDeLaLigne = Math.abs(y - LIGNE * hauteur) < hauteur * 0.08;
    if (dansEtiquette && etat.phase === 'ferme') {
      prise.current = 'etiquette';
      e.currentTarget.setPointerCapture(e.pointerId);
      setEtat(demarrer(etat, 'etiquette'));
    } else if (presDeLaLigne && etat.phase === 'dechirure') {
      prise.current = 'dechirure';
      e.currentTarget.setPointerCapture(e.pointerId);
      setEtat(demarrer(etat, 'dechirure'));
    } else {
      prise.current = null;
    }
  };

  const surMouvement = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!prise.current) return;
    const [x, y] = point(e);
    const dx = x - depart.current.x;
    const dy = y - depart.current.y;
    const largeur = e.currentTarget.clientWidth;
    const avant = etat;
    setEtat((courant) => avancer(courant, dx, dy, largeur));

    // Le son suit le mouvement : il craque pendant le geste et se tait quand le doigt s'arrête.
    if (!muet) {
      const maintenant = performance.now();
      if (maintenant - dernierCrac.current > 45) {
        dernierCrac.current = maintenant;
        const vitesse = Math.min(1, Math.hypot(dx, dy) / 40);
        son.craquer(vitesse);
      }
    }
    if (avant.phase === 'etiquette' && Math.abs(dx) > 24) sens.current = Math.sign(dx) || 1;
  };

  const surRelache = () => {
    if (!prise.current) return;
    prise.current = null;
    setEtat((courant) => {
      const { etat: suivant } = relacher(courant);
      if (suivant.phase === 'dechirure' && courant.phase === 'etiquette') {
        son.dechirer();
        setVol(true);
        window.setTimeout(() => setVol(false), 900);
      }
      return suivant;
    });
  };

  const poids = opacites(etat);
  const carts = useMemo(() => ALL_CARDS.slice(0, 5), []);
  const miroir = etat.phase === 'etiquette' ? sens.current : 1;

  return (
    <div className="sachet">
      <div
        ref={zone}
        className="sachet__zone"
        data-etape={etat.phase}
        data-etiquette={etat.etiquette.toFixed(2)}
        data-dechirure={etat.dechirure.toFixed(2)}
        onPointerDown={surAppui}
        onPointerMove={surMouvement}
        onPointerUp={surRelache}
        onPointerCancel={surRelache}
        onLostPointerCapture={surRelache}
      >
        {sortie === 'montent' && (
          <div className="sachet__interieur" aria-hidden="true">
            {carts.map((carte, i) => (
              <div
                key={carte.id}
                className="sachet__carte sachet__carte--monte"
                style={{ ['--i' as string]: String(i) }}
              >
                <CardView card={carte} compact />
              </div>
            ))}
          </div>
        )}

        <div className={`sachet__sac${etat.phase === 'ouvert' ? ' sachet__sac--descend' : ''}`}>
          {PLAQUES.map((src, i) => (
            <img
              key={src}
              className="sachet__plaque"
              src={src}
              alt=""
              draggable={false}
              style={{ opacity: poids[i], transform: `scaleX(${miroir})` }}
            />
          ))}
        </div>

        {sortie === 'eventail' && (
          <div className="sachet__devant">
            {carts.map((carte, i) => (
              <div
                key={carte.id}
                className="sachet__carte sachet__carte--eventail"
                style={{ ['--i' as string]: String(i) }}
              >
                <CardView card={carte} compact />
              </div>
            ))}
          </div>
        )}

        {vol && (
          <img
            className="sachet__vole"
            src={VOLEE}
            alt=""
            draggable={false}
            style={{ ['--sens' as string]: String(sens.current) }}
          />
        )}

        {etat.phase === 'dechirure' && etat.dechirure > 0.02 && (
          <span
            className="sachet__front"
            aria-hidden="true"
            style={{ left: `${etat.dechirure * 100}%`, top: `${LIGNE * 100}%` }}
          />
        )}
      </div>

      <p className="sachet__consigne" data-consigne>
        {etat.phase === 'ferme' && "Attrape l'étiquette et tire-la dans le sens que tu veux"}
        {etat.phase === 'etiquette' && 'Continue, ou lâche : elle se recolle'}
        {etat.phase === 'dechirure' &&
          `Glisse le doigt sur les pointillés — ${Math.round(etat.dechirure * 100)} % ` +
            (etat.dechirure >= SEUIL_DECHIRURE ? '· lâche pour ouvrir' : '')}
        {etat.phase === 'ouvert' && 'Le sachet est ouvert'}
      </p>
      <p className="sachet__etat">
        {etat.phase} · étiquette {etat.etiquette.toFixed(2)} · déchirure {etat.dechirure.toFixed(2)}
        <button type="button" className="sachet__muet" onClick={() => setMuet((m) => !m)}>
          {muet ? 'rétablir le son' : 'couper le son'}
        </button>
      </p>
    </div>
  );
}
