/**
 * PROTOTYPE JETABLE — trois rendus de carte au plateau qui s'opposent à la carte actuelle (A).
 *
 * Contraintes mesurées : Poste 88 px de large (`--poste-w`), Banc 56 px (`--banc-w`), main 64 px
 * (`--carte-w`), toujours au format 63 × 88. Ce qui décide au plateau : **le nom**, **le Seuil** et
 * **le Stress qui monte** (D-026). Cafés et Conditions vivent dans la fiche du camp, à côté.
 *
 * - **B · Portrait plein** : l'illustration couvre la carte ; nom en bas sur un voile, Seuil en
 *   pastille, Stress en barre sur le bord bas. L'image d'abord.
 * - **C · Jeton rond** : un Planqué devient un **jeton** — portrait rond cerclé d'un anneau de
 *   Stress (arc qui se remplit), Seuil sous le jeton, nom en ruban. Une Action reste **carrée** :
 *   la forme dit le type.
 * - **D · Lisible d'abord** : illustration réduite au bandeau du haut, nom en grand, Seuil et
 *   Stress écrits en chiffres, barre à dix crans. Le texte d'abord.
 *
 * Le CSS est injecté une fois, en dev seulement : il disparaît avec le dossier.
 */
import type { CSSProperties, ReactNode } from 'react';
import { FACTION_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card } from '@/data/types';
import { artFileOf, artUrl } from '@/art';
import type { VarianteKey } from './variante';

export type Lieu = 'poste' | 'banc' | 'main';

export interface VariantePlateauProps {
  card: Card;
  lieu: Lieu;
  stress?: number;
  seuil?: number;
  annotations?: boolean;
}

const APLAT = 'color-mix(in srgb, var(--accent) 30%, var(--bg-deep))';

function infos({ card, stress, seuil }: VariantePlateauProps) {
  const faction = FACTION_META[card.faction];
  const p = isPlanque(card) ? card : null;
  const url = artUrl(artFileOf(card));
  const max = seuil ?? p?.hp ?? 0;
  const vivant = typeof stress === 'number' && max > 0;
  const s = vivant ? Math.max(0, stress) : 0;
  const pct = vivant ? Math.min(100, Math.round((s / max) * 100)) : 0;
  return {
    p,
    faction,
    url,
    max,
    vivant,
    stress: s,
    pct,
    niveau: pct >= 75 ? 'is-high' : pct >= 50 ? 'is-mid' : '',
    comex: p?.ex === true,
    fond: url ? `url('${url}') 50% 22% / cover no-repeat, ${APLAT}` : APLAT,
    style: {
      '--accent': faction.color,
      '--rarity': RARITY_META[card.rarity].color,
      '--pct': `${pct}%`
    } as CSSProperties
  };
}

function Coque({
  v,
  props,
  style,
  extra = '',
  children
}: {
  v: string;
  props: VariantePlateauProps;
  style: CSSProperties;
  extra?: string;
  children: ReactNode;
}) {
  const comex = isPlanque(props.card) && props.card.ex === true;
  return (
    <div
      className={`pp pp-${v} pp--${props.lieu} ${comex ? 'is-comex' : ''} ${extra}`}
      style={style}
      data-rarity={props.card.rarity}
    >
      {children}
    </div>
  );
}

/* ───────────────────────── B · Portrait plein ───────────────────────── */

export function VarianteB(props: VariantePlateauProps) {
  const { card, annotations } = props;
  const i = infos(props);
  return (
    <Coque v="b" props={props} style={i.style}>
      <div className="pp-b__art" style={{ background: i.fond }}>
        {!i.url && <span className="pp-b__glyphe">{card.glyph}</span>}
      </div>
      <span className="pp-b__faction" aria-hidden>
        {i.faction.glyph}
      </span>
      {i.p && (
        <span className="pp-b__seuil" aria-label={`Seuil ${i.max}`}>
          {i.max}
        </span>
      )}
      <div className="pp-b__bas">
        {!i.p && <span className="pp-b__type">{kindLabel(card).split(' · ')[0]}</span>}
        <span className="pp-b__nom" lang="fr">
          {card.name}
        </span>
        {/* La barre n'existe qu'au plateau (Stress vivant) : en main, un Planqué n'a pas encore de Stress. */}
        {i.p && i.vivant && (
          <span className="pp-b__barre" role="img" aria-label={`Stress ${i.stress} sur ${i.max}`}>
            <span className={`pp-b__fill ${i.niveau}`} />
            {annotations && (
              <b className="pp-b__chiffre">
                {i.stress}/{i.max}
              </b>
            )}
          </span>
        )}
      </div>
    </Coque>
  );
}

/* ───────────────────────── C · Jeton rond ───────────────────────── */

export function VarianteC(props: VariantePlateauProps) {
  const { card, annotations } = props;
  const i = infos(props);
  return (
    <Coque v="c" props={props} style={i.style} extra={i.p ? 'is-planque' : 'is-action'}>
      <div
        className={`pp-c__anneau ${i.niveau}`}
        role={i.vivant ? 'img' : undefined}
        aria-label={i.vivant ? `Stress ${i.stress} sur ${i.max}` : undefined}
      >
        <div className="pp-c__portrait" style={{ background: i.fond }}>
          {!i.url && <span className="pp-c__glyphe">{card.glyph}</span>}
        </div>
        {i.p ? (
          <span className="pp-c__seuil">{i.vivant && annotations ? `${i.stress}/${i.max}` : i.max}</span>
        ) : (
          <span className="pp-c__seuil pp-c__seuil--type">{kindLabel(card).split(' · ')[0]}</span>
        )}
      </div>
      <span className="pp-c__nom" lang="fr">
        {card.name}
      </span>
    </Coque>
  );
}

/* ───────────────────────── D · Lisible d'abord ───────────────────────── */

export function VarianteD(props: VariantePlateauProps) {
  const { card } = props;
  const i = infos(props);
  const crans = Math.round(i.pct / 10);
  return (
    <Coque v="d" props={props} style={i.style}>
      <div className="pp-d__art" style={{ background: i.fond }}>
        {!i.url && <span className="pp-d__glyphe">{card.glyph}</span>}
        {i.comex && <b className="pp-d__comex">COMEX</b>}
      </div>
      <span className="pp-d__nom" lang="fr">
        {card.name}
      </span>
      {i.p ? (
        <div
          className="pp-d__mesure"
          role={i.vivant ? 'img' : undefined}
          aria-label={`Stress ${i.stress} sur ${i.max}`}
        >
          <span className="pp-d__chiffres">
            {i.vivant ? (
              <>
                <b className={i.niveau}>{i.stress}</b>/{i.max}
              </>
            ) : (
              <>
                <small>Seuil</small> <b>{i.max}</b>
              </>
            )}
          </span>
          <span className="pp-d__crans">
            {Array.from({ length: 10 }, (_, k) => (
              <i key={k} className={k < crans ? `is-on ${i.niveau}` : ''} />
            ))}
          </span>
        </div>
      ) : (
        <span className="pp-d__type">{kindLabel(card)}</span>
      )}
    </Coque>
  );
}

export const COMPOSANTS: Record<Exclude<VarianteKey, 'A'>, (props: VariantePlateauProps) => ReactNode> = {
  B: VarianteB,
  C: VarianteC,
  D: VarianteD
};

/* ───────────────────────── CSS du prototype ───────────────────────── */

const CSS = `
.pp {
  aspect-ratio: 63 / 88;
  box-sizing: border-box;
  container-type: inline-size;
  position: relative;
  width: 100%;
  --cadre: color-mix(in srgb, var(--rarity) 80%, #222);
  --stress-bas: #3fae7a;
  --stress-mid: #e0a33e;
  --stress-haut: #e0503a;
}
.pp.is-comex { --cadre: var(--gold); }
.pp [lang='fr'] { hyphens: auto; overflow-wrap: normal; word-break: normal; }

/* ── B · Portrait plein ── */
.pp-b {
  border: 2px solid var(--cadre);
  border-radius: 8px;
  box-shadow: 0 6px 14px -6px rgb(0 0 0 / 80%), inset 0 0 0 1px rgb(0 0 0 / 50%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}
.pp-b.is-comex { box-shadow: 0 0 0 1px #000, 0 0 10px -2px var(--gold), 0 6px 14px -6px rgb(0 0 0 / 80%); }
.pp-b__art { inset: 0; position: absolute; }
.pp-b__glyphe { color: #fff; font-size: 48cqw; left: 50%; opacity: 0.35; position: absolute; top: 38%; transform: translate(-50%, -50%); }
.pp-b__faction {
  background: var(--accent); border: 1px solid rgb(0 0 0 / 50%); border-radius: 50%; color: #fff; display: grid;
  font-size: max(8px, 13cqw); height: max(13px, 21cqw); left: 4%; place-items: center; position: absolute; top: 4%; width: max(13px, 21cqw);
}
.pp-b__seuil {
  /* Retouché : une plaque discrète (fond sombre, chiffre or), plus un lingot qui mange l'image. */
  background: rgb(4 8 16 / 78%); border: 1px solid color-mix(in srgb, var(--gold) 60%, transparent); border-radius: 4px;
  color: var(--gold-soft); font-family: var(--font-display); font-size: max(8.5px, 12cqw); font-variant-numeric: tabular-nums;
  font-weight: 800; line-height: 1; padding: 1px 3px; position: absolute; right: 4%; top: 4%;
}
.pp-b__bas {
  background: linear-gradient(180deg, transparent, rgb(4 8 16 / 85%) 30%, rgb(4 8 16 / 95%));
  display: flex; flex-direction: column; gap: 2px; padding: 14% 5% 0; position: relative;
}
.pp-b__type { color: var(--gold-soft); font-size: max(8px, 12cqw); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.pp-b__nom {
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: #fff; display: -webkit-box; font-family: var(--font-display);
  font-size: max(9.5px, 14.5cqw); font-weight: 800; line-height: 1.05; overflow: hidden; text-shadow: 0 1px 2px #000;
}
.pp-b__barre {
  /* Retouché : une jauge qui se voit même vide — piste sombre, filet clair, dix crans. */
  background: rgb(0 0 0 / 60%); border: 1px solid rgb(255 255 255 / 55%); border-radius: 2px; display: block;
  height: max(6px, 10cqw); margin: 3px 0 5%; overflow: hidden; position: relative;
}
.pp-b__barre::after {
  background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgb(0 0 0 / 70%) calc(10% - 1px) 10%);
  content: ''; inset: 0; position: absolute;
}
.pp-b__fill { background: var(--stress-bas); display: block; height: 100%; transition: width 300ms ease; width: var(--pct); }
.pp-b__fill.is-mid { background: var(--stress-mid); }
.pp-b__fill.is-high { background: var(--stress-haut); }
.pp-b__chiffre {
  z-index: 1;
  color: #fff; font-size: max(8px, 11cqw); left: 50%; line-height: 1; position: absolute; text-shadow: 0 0 2px #000, 0 0 2px #000;
  top: 50%; transform: translate(-50%, -50%);
}

/* ── C · Jeton rond ── */
.pp-c { align-items: center; display: flex; flex-direction: column; gap: 3%; justify-content: flex-start; padding-top: 2%; }
.pp-c__anneau {
  aspect-ratio: 1; background: conic-gradient(var(--stress-bas) 0 var(--pct), color-mix(in srgb, var(--cadre) 85%, #000) var(--pct) 100%);
  border-radius: 50%; box-shadow: 0 5px 12px -4px rgb(0 0 0 / 85%); padding: 7%; position: relative; width: 96%;
}
.pp-c__anneau.is-mid { background: conic-gradient(var(--stress-mid) 0 var(--pct), color-mix(in srgb, var(--cadre) 85%, #000) var(--pct) 100%); }
.pp-c__anneau.is-high { background: conic-gradient(var(--stress-haut) 0 var(--pct), color-mix(in srgb, var(--cadre) 85%, #000) var(--pct) 100%); }
.pp-c.is-comex .pp-c__anneau { box-shadow: 0 0 0 2px var(--gold), 0 5px 12px -4px rgb(0 0 0 / 85%); }
.pp-c__portrait { border: 2px solid #0b1220; border-radius: 50%; height: 100%; position: relative; width: 100%; }
.pp-c__glyphe { color: #fff; font-size: 40cqw; left: 50%; opacity: 0.45; position: absolute; top: 50%; transform: translate(-50%, -50%); }
.pp-c.is-action .pp-c__anneau { background: color-mix(in srgb, var(--cadre) 85%, #000); border-radius: 14%; }
.pp-c.is-action .pp-c__portrait { border-radius: 10%; }
.pp-c__seuil {
  background: linear-gradient(180deg, var(--gold-soft), var(--gold-deep)); border: 1px solid #000; border-radius: 999px; bottom: -6%;
  color: #241800; font-family: var(--font-display); font-size: max(9.5px, 15cqw); font-weight: 800; left: 50%; line-height: 1;
  padding: 2px 5px; position: absolute; transform: translateX(-50%); white-space: nowrap;
}
.pp-c__seuil--type { background: #e8eef8; font-family: var(--font-body); font-size: max(8px, 11cqw); text-transform: uppercase; }
.pp-c__nom {
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; background: rgb(4 8 16 / 75%); border-radius: 4px; color: #fff; display: -webkit-box;
  font-family: var(--font-display); font-size: max(9.5px, 13.5cqw); font-weight: 700; line-height: 1.05; margin-top: 6%; max-width: 100%;
  overflow: hidden; padding: 1px 3px; text-align: center;
}

/* ── D · Lisible d'abord ── */
.pp-d {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 35%, #0e1626), #0e1626 70%);
  border: 2px solid var(--cadre); border-radius: 7px; box-shadow: 0 6px 14px -6px rgb(0 0 0 / 80%);
  display: flex; flex-direction: column; overflow: hidden;
}
.pp-d__art { border-bottom: 1px solid rgb(0 0 0 / 60%); flex: 0 0 42%; position: relative; }
.pp-d__glyphe { color: #fff; font-size: 30cqw; left: 50%; opacity: 0.45; position: absolute; top: 50%; transform: translate(-50%, -50%); }
.pp-d__comex {
  background: var(--gold); border-radius: 3px; bottom: 2px; color: #241800; font-size: max(7.5px, 10cqw); font-weight: 800;
  left: 2px; padding: 0 2px; position: absolute;
}
.pp-d__nom {
  -webkit-box-orient: vertical; -webkit-line-clamp: 3; color: #fff; display: -webkit-box; flex: 1 1 auto;
  font-family: var(--font-display); font-size: max(10px, 15cqw); font-weight: 700; line-height: 1.05; overflow: hidden; padding: 4% 5% 0;
}
.pp-d__mesure { display: flex; flex-direction: column; gap: 2px; padding: 0 5% 5%; }
.pp-d__chiffres { color: var(--text-muted); font-family: var(--font-display); font-size: max(9px, 13cqw); line-height: 1; }
.pp-d__chiffres b { color: #fff; font-size: 1.35em; font-weight: 800; }
.pp-d__chiffres b.is-mid { color: var(--stress-mid); }
.pp-d__chiffres b.is-high { color: var(--stress-haut); }
.pp-d__chiffres small { font-size: 0.75em; text-transform: uppercase; }
.pp-d__crans { display: grid; gap: 1px; grid-template-columns: repeat(10, 1fr); height: max(4px, 7cqw); }
.pp-d__crans i { background: rgb(255 255 255 / 14%); border-radius: 1px; }
.pp-d__crans i.is-on { background: var(--stress-bas); }
.pp-d__crans i.is-on.is-mid { background: var(--stress-mid); }
.pp-d__crans i.is-on.is-high { background: var(--stress-haut); }
.pp-d__type { color: var(--gold-soft); font-size: max(8px, 11cqw); font-weight: 700; padding: 0 5% 6%; text-transform: uppercase; }

/* ── La barre du prototype : en haut, étrangère au design ── */
.proto-switcher-plateau {
  align-items: center; background: #fff; border-radius: 999px; box-shadow: 0 6px 24px rgb(0 0 0 / 55%), 0 0 0 2px #ff2d87;
  color: #111; display: flex; font: 600 13px/1 system-ui, sans-serif; gap: 10px; left: 50%; padding: 6px 8px; position: fixed;
  top: 8px; transform: translateX(-50%); white-space: nowrap; z-index: 9999;
}
.proto-switcher-plateau button { background: #111; border: 0; border-radius: 999px; color: #fff; cursor: pointer; font: inherit; height: 28px; width: 28px; }
.proto-switcher-plateau strong { color: #ff2d87; }
`;

if (import.meta.env.DEV && typeof document !== 'undefined' && !document.getElementById('prototype-plateau-css')) {
  const balise = document.createElement('style');
  balise.id = 'prototype-plateau-css';
  balise.textContent = CSS;
  document.head.appendChild(balise);
}
