/*
 * PROTOTYPE JETABLE (#283) — le banc d'essai du creux du sachet.
 *
 * Question : « à quoi doit ressembler le creux du sachet ESD sous le doigt ? ». Trois rendus
 * radicalement différents, sur la même image de sachet et le même ressort de pression, commutables
 * par `?variant=A|B|C` ou par la barre flottante (← et → aussi) :
 *   A — dégradés CSS (seuls transform et opacity bougent) ;
 *   B — shader WebGL2 (relief et reflet calculés par pixel) ;
 *   C — filtres SVG (déplacement + éclairage spéculaire).
 * DEV seulement : entrée Vite à part (`ouverture.html`), jamais dans le build ni dans les routes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as PointerReact } from 'react';
import { Pression } from './ouverture/pression';
import { creerBase, HAUTEUR, LARGEUR } from './ouverture/base';
import { VarianteA } from './ouverture/VarianteA';
import { VarianteB } from './ouverture/VarianteB';
import { VarianteC } from './ouverture/VarianteC';

const REFERENCE = new URL('./ouverture/ref-creux.jpg', import.meta.url).href;

type Cle = 'A' | 'B' | 'C';
const VARIANTES: ReadonlyArray<{ cle: Cle; nom: string }> = [
  { cle: 'A', nom: 'Dégradés CSS' },
  { cle: 'B', nom: 'Shader WebGL' },
  { cle: 'C', nom: 'Filtres SVG' }
];

function cleInitiale(): Cle {
  const v = new URLSearchParams(window.location.search).get('variant');
  return v === 'B' || v === 'C' ? v : 'A';
}

declare global {
  interface Window {
    /** Les sondes du banc : c'est par elles qu'une planche de frames règle l'état et le relit. */
    __ouverture?: { jouer: () => void; etat: () => { creux: number; cle: Cle; coutMs: number; graine: number } };
  }
}

export function PrototypeOuverture() {
  const pression = useMemo(() => {
    const g = new URLSearchParams(window.location.search).get('graine');
    return new Pression(g === null ? undefined : Number(g) >>> 0);
  }, []);
  const base = useMemo(creerBase, []);
  const baseUrl = useMemo(() => base.toDataURL('image/png'), [base]);
  const [cle, setCle] = useState<Cle>(cleInitiale);
  const [reference, setReference] = useState(false);
  const [radial, setRadial] = useState(() => new URLSearchParams(window.location.search).get('radial') === '1');
  pression.options.radial = radial;
  const [lecture, setLecture] = useState({ creux: 0, px: 0.5, py: 0.55, cout: 0 });
  const zone = useRef<HTMLDivElement>(null);
  const cleRef = useRef(cle);
  cleRef.current = cle;

  const changer = (suivante: Cle): void => {
    setCle(suivante);
    const url = new URL(window.location.href);
    url.searchParams.set('variant', suivante);
    window.history.replaceState(null, '', url);
  };

  useEffect(() => {
    window.__ouverture = {
      jouer: () => pression.jouer(),
      etat: () => ({
        creux: pression.etat.creux,
        cle: cleRef.current,
        coutMs: pression.coutMs,
        graine: pression.graine
      })
    };
    const lire = window.setInterval(
      () =>
        setLecture({ creux: pression.etat.creux, px: pression.etat.px, py: pression.etat.py, cout: pression.coutMs }),
      100
    );
    const touche = (e: KeyboardEvent): void => {
      const i = VARIANTES.findIndex((v) => v.cle === cleRef.current);
      if (e.key === 'ArrowRight') changer(VARIANTES[(i + 1) % VARIANTES.length].cle);
      if (e.key === 'ArrowLeft') changer(VARIANTES[(i + VARIANTES.length - 1) % VARIANTES.length].cle);
    };
    window.addEventListener('keydown', touche);
    return () => {
      window.clearInterval(lire);
      window.removeEventListener('keydown', touche);
      delete window.__ouverture;
    };
  }, [pression]);

  const point = (e: PointerReact<HTMLDivElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    ];
  };

  const index = VARIANTES.findIndex((v) => v.cle === cle);
  const courante = VARIANTES[index];

  return (
    <div className="proto-ouv">
      <p className="proto-ouv__bandeau">PROTOTYPE JETABLE — le creux du sachet (#283)</p>
      <div className="proto-ouv__scene">
        <div
          ref={zone}
          className="proto-ouv__zone"
          style={{ width: LARGEUR, height: HAUTEUR }}
          data-variante={cle}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pression.appuyer(...point(e));
          }}
          onPointerMove={(e) => pression.deplacer(...point(e))}
          onPointerUp={() => pression.relacher()}
          onPointerCancel={() => pression.relacher()}
          onLostPointerCapture={() => pression.relacher()}
        >
          {cle === 'A' && <VarianteA pression={pression} baseUrl={baseUrl} />}
          {cle === 'B' && <VarianteB pression={pression} base={base} />}
          {cle === 'C' && <VarianteC pression={pression} baseUrl={baseUrl} />}
        </div>
        {reference && (
          <figure className="proto-ouv__ref">
            <img src={REFERENCE} alt="" />
            <figcaption>la cible : image E</figcaption>
          </figure>
        )}
      </div>

      <div className="proto-ouv__regie">
        <button type="button" data-jouer onClick={() => pression.jouer()}>
          Jouer l'appui
        </button>
        <label>
          <input type="checkbox" checked={reference} onChange={(e) => setReference(e.target.checked)} /> montrer la
          cible
        </label>
        <label title="Variante B seulement : plis en étoile (cible E) au lieu d'anneaux (clip 0)">
          <input type="checkbox" checked={radial} onChange={(e) => setRadial(e.target.checked)} /> plis en étoile (B)
        </label>
        <output className="proto-ouv__etat" data-etat>
          {courante.cle} · creux {lecture.creux.toFixed(2)} · point ({lecture.px.toFixed(2)} ; {lecture.py.toFixed(2)})
          · rendu {lecture.cout.toFixed(2)} ms/image · graine {pression.graine}
        </output>
      </div>

      <div className="proto-ouv__barre" role="group" aria-label="Variante du prototype">
        <button
          type="button"
          aria-label="Variante précédente"
          onClick={() => changer(VARIANTES[(index + VARIANTES.length - 1) % VARIANTES.length].cle)}
        >
          ←
        </button>
        <span>
          {courante.cle} ({courante.nom})
        </span>
        <button
          type="button"
          aria-label="Variante suivante"
          onClick={() => changer(VARIANTES[(index + 1) % VARIANTES.length].cle)}
        >
          →
        </button>
      </div>
    </div>
  );
}
