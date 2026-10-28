/* PROTOTYPE JETABLE (#283) — l'étiquette et la déchirure, en **photos successives**.
 *
 * Chaque état du sachet est une photo tirée par gflow depuis la précédente : la même pochette,
 * le même cadrage, la même lumière. Le geste ne dessine rien : il **fond** d'une photo à l'autre
 * (p0 étiquette collée → p2 étiquette levée → p3 partie → p5 déchirée → p6 ouverte).
 * C'est ce qui rend le réel : aucun tracé ne peut imiter les plis d'un film photographié.
 *
 * Le son est celui du clip 1b (piste Veo), posé ici pour juger le geste : sa licence et le
 * « deux sons » de D-137 se tranchent dans #378 et #379, pas dans ce banc.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { avancer, creer, demarrer, relacher, type Etat, type Son, type Zone } from './gestes';

const PLAQUES = [
  new URL('./plates/p0.jpg', import.meta.url).href,
  new URL('./plates/p1.jpg', import.meta.url).href,
  new URL('./plates/p2.jpg', import.meta.url).href,
  new URL('./plates/p3.jpg', import.meta.url).href,
  new URL('./plates/p4.jpg', import.meta.url).href,
  new URL('./plates/p5.jpg', import.meta.url).href,
  new URL('./plates/p6.jpg', import.meta.url).href
];

const SON = new URL('./son-decollage.wav', import.meta.url).href;

/** La boîte de l'étiquette, en fraction de la zone : c'est là que le doigt doit se poser. */
const ETIQUETTE = { x: 0.285, y: 0.1, w: 0.43, h: 0.11 };
/** L'ordonnée de la ligne de pointillés, en fraction de la hauteur. */
const LIGNE = 0.075;

/**
 * Les opacités des sept plaques. Deux plaques voisines se croisent, jamais plus : un fondu à
 * trois se lit comme un voile, pas comme un geste.
 */
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
  // En geste, la position court de la plaque 0 à la plaque 3 (étiquette), puis 3 à 6 (déchirure).
  const position = etat.phase === 'etiquette' ? Math.min(3, etat.etiquette * 3) : 3 + Math.min(3, etat.dechirure * 3);
  const bas = Math.min(PLAQUES.length - 1, Math.floor(position));
  const haut = Math.min(PLAQUES.length - 1, bas + 1);
  const f = position - bas;
  // Au bout de la course, `bas` et `haut` sont la même plaque : une seule, pleine. Sans ce cas,
  // `1 - f` et `f` s'écrasent à zéro et l'écran devient noir (vu sur la planche).
  if (bas === haut) {
    vides[bas] = 1;
    return vides;
  }
  vides[bas] = 1 - f;
  vides[haut] = f;
  return vides;
}

export function Sachet() {
  const [etat, setEtat] = useState<Etat>(creer);
  const [muet, setMuet] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const depart = useRef({ x: 0, y: 0 });
  const prise = useRef<Zone | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const tampon = useRef<AudioBuffer | null>(null);
  const [sonPret, setSonPret] = useState(false);

  // Toutes les plaques sont décodées d'avance : un fondu vers une image non décodée fait un blanc.
  useEffect(() => {
    for (const src of PLAQUES) {
      const image = new Image();
      image.src = src;
      void image.decode().catch(() => undefined);
    }
  }, []);

  // Le contexte audio ne se crée qu'au premier geste : iOS refuse le son avant.
  const reveiller = useCallback(() => {
    if (audio.current) {
      void audio.current.resume();
      return;
    }
    const ctx = new AudioContext();
    audio.current = ctx;
    void fetch(SON)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => {
        tampon.current = buf;
        setSonPret(true);
      })
      .catch(() => undefined);
    void ctx.resume();
  }, []);

  const jouer = useCallback(
    (quoi: Son | null) => {
      if (!quoi || muet || !audio.current || !tampon.current) return;
      if (audio.current.state !== 'running') return;
      const src = audio.current.createBufferSource();
      src.buffer = tampon.current;
      if (quoi === 'recolle') src.playbackRate.value = 1.35;
      src.connect(audio.current.destination);
      src.start();
    },
    [muet]
  );

  const point = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const surAppui = (e: React.PointerEvent<HTMLDivElement>) => {
    reveiller();
    const [x, y] = point(e);
    const largeur = e.currentTarget.clientWidth;
    const hauteur = e.currentTarget.clientHeight;
    depart.current = { x, y };
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
    // React annule `currentTarget` après le gestionnaire : on lit la largeur maintenant.
    const largeur = e.currentTarget.clientWidth;
    setEtat((courant) => avancer(courant, x - depart.current.x, y - depart.current.y, largeur));
  };

  const surRelache = () => {
    if (!prise.current) return;
    prise.current = null;
    reveiller();
    setEtat((courant) => {
      const { etat: suivant, son } = relacher(courant);
      jouer(son);
      return suivant;
    });
  };

  const poids = opacites(etat);

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
        {PLAQUES.map((src, i) => (
          <img key={src} className="sachet__plaque" src={src} alt="" draggable={false} style={{ opacity: poids[i] }} />
        ))}
      </div>

      <p className="sachet__consigne" data-consigne>
        {etat.phase === 'ferme' && "Attrape l'étiquette et tire-la vers le haut"}
        {etat.phase === 'etiquette' && 'Encore un peu, ou lâche : elle se recolle'}
        {etat.phase === 'dechirure' && 'Glisse le doigt le long des pointillés, de gauche à droite'}
        {etat.phase === 'ouvert' && 'Le sachet est ouvert'}
      </p>
      <p className="sachet__etat">
        {etat.phase} · étiquette {etat.etiquette.toFixed(2)} · déchirure {etat.dechirure.toFixed(2)} · son{' '}
        {muet ? 'coupé' : sonPret ? 'prêt' : 'en attente du geste'}
        <button type="button" className="sachet__muet" onClick={() => setMuet((m) => !m)}>
          {muet ? 'rétablir le son' : 'couper le son'}
        </button>
      </p>
    </div>
  );
}
