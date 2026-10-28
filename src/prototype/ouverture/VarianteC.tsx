/* PROTOTYPE JETABLE (#283) — variante C : des filtres SVG (déplacement + éclairage spéculaire) sur l'image du sachet. */
import { useEffect, useMemo, useRef } from 'react';
import type { Pression } from './pression';
import { HAUTEUR, LARGEUR } from './base';

interface Props {
  pression: Pression;
  baseUrl: string;
}

const TAILLE_CARTE = 240;

/**
 * La carte de relief, peinte une fois : R et G portent le sens du déplacement (vers le centre), B la
 * hauteur (une bosse douce et des anneaux). Le filtre la déplace ensuite par `x`/`y`, sans la réencoder.
 */
function creerCarte(): string {
  const c = document.createElement('canvas');
  c.width = TAILLE_CARTE;
  c.height = TAILLE_CARTE;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  const image = g.createImageData(TAILLE_CARTE, TAILLE_CARTE);
  const m = TAILLE_CARTE / 2;
  for (let y = 0; y < TAILLE_CARTE; y += 1) {
    for (let x = 0; x < TAILLE_CARTE; x += 1) {
      const dx = (x - m) / m;
      const dy = (y - m) / m;
      const r = Math.hypot(dx, dy);
      const f = Math.exp(-(r * r) / (2 * 0.38 * 0.38));
      const nx = r > 0.0001 ? -dx / r : 0;
      const ny = r > 0.0001 ? -dy / r : 0;
      const plis = 0.5 + 0.5 * Math.cos(r * 34) * Math.exp(-(r * r) / (2 * 0.55 * 0.55));
      const i = (y * TAILLE_CARTE + x) * 4;
      image.data[i] = 128 + 127 * nx * f;
      image.data[i + 1] = 128 + 127 * ny * f;
      image.data[i + 2] = 255 * Math.min(1, 0.55 * f + 0.4 * plis * Math.min(1, f * 2.2));
      image.data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return c.toDataURL('image/png');
}

export function VarianteC({ pression, baseUrl }: Props) {
  const defs = useRef<SVGDefsElement>(null);
  const cible = useRef<HTMLDivElement>(null);
  const compteur = useRef(0);
  const carte = useMemo(creerCarte, []);

  useEffect(
    () =>
      pression.surveiller((e) => {
        const d = defs.current;
        const el = cible.current;
        if (!d || !el) return;
        const c = Math.max(0, e.creux);
        // WebKit met la sortie d'un filtre en cache par `id` : un `id` neuf à chaque image.
        compteur.current += 1;
        const id = `creux${compteur.current}`;
        const x = e.px * LARGEUR - TAILLE_CARTE / 2;
        const y = e.py * HAUTEUR - TAILLE_CARTE / 2;
        d.innerHTML = `<filter id="${id}" x="0" y="0" width="${LARGEUR}" height="${HAUTEUR}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
  <feFlood flood-color="rgb(128,128,0)" result="neutre"/>
  <feImage href="${carte}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${TAILLE_CARTE}" height="${TAILLE_CARTE}" preserveAspectRatio="none" result="bosse"/>
  <feMerge result="relief"><feMergeNode in="neutre"/><feMergeNode in="bosse"/></feMerge>
  <feDisplacementMap in="SourceGraphic" in2="relief" scale="${(30 * c).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="deplace"/>
  <feColorMatrix in="relief" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="haut"/>
  <feGaussianBlur in="haut" stdDeviation="2" result="hautFlou"/>
  <feSpecularLighting in="hautFlou" surfaceScale="${(10 * c).toFixed(2)}" specularConstant="1.1" specularExponent="26" lighting-color="#e4eeff" result="spec"><fePointLight x="70" y="60" z="150"/></feSpecularLighting>
  <feComposite in="spec" in2="deplace" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="somme"/>
  <feComposite in="somme" in2="SourceAlpha" operator="in"/>
</filter>`;
        el.style.filter = `url(#${id})`;
      }),
    [pression, carte]
  );

  return (
    <>
      <svg width="0" height="0" aria-hidden="true" className="vc__defs">
        <defs ref={defs} />
      </svg>
      <div ref={cible} className="vc" style={{ backgroundImage: `url(${baseUrl})` }} />
    </>
  );
}
