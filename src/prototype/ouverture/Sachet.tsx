/* PROTOTYPE JETABLE (#283) — l'étiquette autocollante et la déchirure, sur les photos du sachet.
 *
 * L'étiquette est un **élément du DOM**, pas une image : dans le jeu, elle portera le texte écrit par
 * l'application. Elle se lève en **charnière** sur son bord gauche, ombre et reflet suivant la levée ;
 * lâchée trop tôt, elle se recolle ; lâchée au-delà du seuil, elle part.
 *
 * Le son est celui du clip 1b (piste Veo), posé ici **pour juger le geste** : sa licence et le
 * « deux sons » de D-137 se tranchent dans #378 et #379, pas dans ce banc.
 */
import { useCallback, useRef, useState } from 'react';
import { avancer, creer, demarrer, relacher, type Etat, type Son, type Zone } from './gestes';
import { BASE_URL } from './base';

const PHOTOS = {
  sansEtiquette: new URL('./sachet-sans-etiquette.jpg', import.meta.url).href,
  ouvert: new URL('./sachet-ouvert.jpg', import.meta.url).href,
  reference: BASE_URL
};

const SON = new URL('./son-decollage.wav', import.meta.url).href;

/** La boîte de l'étiquette, en fraction de la zone : elle se déduit du gabarit de la photo. */
const ETIQUETTE = { x: 0.285, y: 0.112, w: 0.43, h: 0.092 };
/** L'ordonnée de la ligne de pointillés, en fraction de la hauteur. */
const LIGNE = 0.085;

export function Sachet() {
  const [etat, setEtat] = useState<Etat>(creer);
  const [muet, setMuet] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const depart = useRef({ x: 0, y: 0 });
  const prise = useRef<Zone | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const tampon = useRef<AudioBuffer | null>(null);
  const [sonPret, setSonPret] = useState(false);

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
      // Le déclenchement se cale sur le geste : le décollage est plus long que le recollage.
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
    const presDeLaLigne = Math.abs(y - LIGNE * hauteur) < hauteur * 0.09;
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
    // React annule `currentTarget` après le gestionnaire : on lit la largeur **maintenant**.
    const largeur = e.currentTarget.clientWidth;
    setEtat((courant) => avancer(courant, x - depart.current.x, y - depart.current.y, largeur));
  };

  const surRelache = () => {
    if (!prise.current) return;
    prise.current = null;
    // L'audio se débloque sur `pointerup` au doigt (spec HTML), pas sur `pointerdown`.
    reveiller();
    setEtat((courant) => {
      const { etat: suivant, son } = relacher(courant);
      jouer(son);
      return suivant;
    });
  };

  const photo = etat.phase === 'ouvert' ? PHOTOS.ouvert : PHOTOS.sansEtiquette;
  const p = etat.dechirure;
  const ligne = LIGNE * 100;
  // La bande arrachée : le coin gauche de la ligne de pointillés.
  const bande = `polygon(0 0, ${p * 100}% 0, ${p * 100}% ${ligne}%, 0 ${ligne}%)`;
  // Le corps garde tout sauf cette bande.
  const corps = `polygon(${p * 100}% 0, 100% 0, 100% 100%, 0 100%, 0 ${ligne}%, ${p * 100}% ${ligne}%)`;
  const levee = etat.etiquette;

  return (
    <div className="sachet">
      <div
        ref={zone}
        className="sachet__zone"
        data-etape={etat.phase}
        data-etiquette={levee.toFixed(2)}
        data-dechirure={p.toFixed(2)}
        onPointerDown={surAppui}
        onPointerMove={surMouvement}
        onPointerUp={surRelache}
        onPointerCancel={surRelache}
        onLostPointerCapture={surRelache}
      >
        <img className="sachet__photo" src={photo} alt="" style={{ clipPath: corps }} draggable={false} />
        {p > 0 && p < 1 && (
          <img
            className="sachet__bande"
            src={photo}
            alt=""
            draggable={false}
            style={{
              clipPath: bande,
              transform: `translate(${-p * 5}%, ${-p * 12}%) rotate(${-p * 4}deg)`,
              filter: `drop-shadow(0 ${Math.max(1, p * 5)}px ${Math.max(1, p * 6)}px rgba(0,0,0,${0.15 + p * 0.45}))`
            }}
          />
        )}
        {etat.phase !== 'ouvert' && levee > 0.02 && (
          <span
            className="sachet__ombre"
            aria-hidden="true"
            style={{
              left: `${ETIQUETTE.x * 100}%`,
              top: `${ETIQUETTE.y * 100}%`,
              width: `${ETIQUETTE.w * 100}%`,
              height: `${ETIQUETTE.h * 100}%`,
              opacity: levee * 0.7,
              transform: `translate(${-levee * 2}px, ${levee * 7}px) skewX(${-levee * 8}deg)`
            }}
          />
        )}
        {etat.phase !== 'ouvert' && (
          <div
            className="sachet__etiquette"
            style={{
              left: `${ETIQUETTE.x * 100}%`,
              top: `${ETIQUETTE.y * 100}%`,
              width: `${ETIQUETTE.w * 100}%`,
              height: `${ETIQUETTE.h * 100}%`,
              transform: `perspective(180px) rotateY(${-levee * 78}deg) rotateZ(${levee * 6}deg) translate(${levee * 16}px, ${-levee * 12}px)`,
              transformOrigin: '0% 50%',
              opacity: 1 - Math.max(0, levee - 0.92) / 0.08
            }}
          >
            <span className="sachet__pictogramme" aria-hidden="true" />
            <span className="sachet__lignes" aria-hidden="true" />
            <span className="sachet__reflet" style={{ opacity: levee * 0.75 }} aria-hidden="true" />
          </div>
        )}
      </div>

      <p className="sachet__consigne" data-consigne>
        {etat.phase === 'ferme' && "Attrape l'étiquette et tire-la vers le haut"}
        {etat.phase === 'etiquette' && 'Encore un peu, ou lâche : elle se recolle'}
        {etat.phase === 'dechirure' && 'Glisse le doigt le long des pointillés, de gauche à droite'}
        {etat.phase === 'ouvert' && 'Le sachet est ouvert'}
      </p>
      <p className="sachet__etat">
        {etat.phase} · étiquette {levee.toFixed(2)} · déchirure {p.toFixed(2)} · son{' '}
        {muet ? 'coupé' : sonPret ? 'prêt' : 'en attente du geste'}
        <button type="button" className="sachet__muet" onClick={() => setMuet((m) => !m)}>
          {muet ? 'rétablir le son' : 'couper le son'}
        </button>
      </p>
    </div>
  );
}
