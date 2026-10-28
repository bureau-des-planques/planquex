/* PROTOTYPE JETABLE (#283) — variante A : une pile de dégradés CSS. Seuls `transform` et `opacity` bougent. */
import { useEffect, useRef } from 'react';
import type { Pression } from './pression';
import { HAUTEUR, LARGEUR } from './base';

interface Props {
  pression: Pression;
  baseUrl: string;
}

export function VarianteA({ pression, baseUrl }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      pression.surveiller((e) => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--px', `${e.px * LARGEUR}px`);
        el.style.setProperty('--py', `${e.py * HAUTEUR}px`);
        el.style.setProperty('--creux', String(Math.max(0, e.creux)));
        el.style.setProperty('--dx', String(e.px - 0.5));
        el.style.setProperty('--dy', String(e.py - 0.5));
      }),
    [pression]
  );

  return (
    <div ref={ref} className="va" style={{ backgroundImage: `url(${baseUrl})` }}>
      <div className="va__creux" />
      <div className="va__anneaux" />
      <div className="va__reflet va__reflet--1" />
      <div className="va__reflet va__reflet--2" />
    </div>
  );
}
