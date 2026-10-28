/**
 * PROTOTYPE JETABLE — trois dispositions de carte qui s'opposent à la carte actuelle (A).
 *
 * - **B · Pleine illustration** : l'image occupe toute la carte ; titre et Seuil flottent en
 *   haut, Pressions et méta dans un panneau voilé en bas. L'illustration d'abord.
 * - **C · Gabarit Pocket** : corps teinté de la faction, Seuil en haut à droite, fenêtre
 *   d'illustration à ratio fixe, légende d'évolution, Talent, Pressions en colonnes, ligne
 *   Vulnérabilité / Rotation en pictos. La lecture de jeu d'abord.
 * - **D · Badge d'employé** : la carte devient le badge du site — bandeau de service,
 *   photo d'identité, jauge « Seuil de tolérance », Pressions en liste de missions, code-barres.
 *   La satire d'abord.
 *
 * Pas de tests, pas d'abstraction partagée entre variantes (seul `infos` lit les données).
 * Le CSS est injecté une fois, en dev seulement : il disparaît avec le dossier.
 */
import type { CSSProperties, ReactNode } from 'react';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card } from '@/data/types';
import { artFileOf, artUrl } from '@/art';
import { WEAKNESS_BONUS } from '@/game/rules';
import { CafePips } from '../CafePips';
import type { VarianteKey } from './variante';

export interface VarianteProps {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  /** La carte en grand (fiche) : la flavour revient, le texte grossit avec la carte. */
  grand?: boolean;
}

const SEUIL_MAX = Math.max(...ALL_CARDS.map((c) => (isPlanque(c) ? c.hp : 0)));
const APLAT = 'color-mix(in srgb, var(--accent) 26%, var(--bg-deep))';

function infos(card: Card) {
  const faction = FACTION_META[card.faction];
  const planque = isPlanque(card);
  const url = artUrl(artFileOf(card));
  const weakness = faction.weakness ? FACTION_META[faction.weakness] : null;
  const parent = planque && card.evolvesFrom ? CARD_BY_ID.get(card.evolvesFrom) : undefined;
  return {
    faction,
    planque,
    url,
    weakness,
    parent,
    rarity: RARITY_META[card.rarity],
    stade: kindLabel(card),
    comex: planque && card.ex === true,
    fond: url ? `url('${url}') 50% 22% / cover no-repeat, ${APLAT}` : APLAT,
    style: { '--accent': faction.color, '--rarity': RARITY_META[card.rarity].color } as CSSProperties
  };
}

function Coque({
  variante,
  props,
  style,
  children
}: {
  variante: string;
  props: VarianteProps;
  style: CSSProperties;
  children: ReactNode;
}) {
  const classes = ['pv', `pv-${variante}`, props.selected ? 'is-selected' : '', props.grand ? 'is-grand' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} style={style} onClick={props.onClick} data-rarity={props.card.rarity}>
      <div className="pv__face">{children}</div>
    </button>
  );
}

/* ───────────────────────── B · Pleine illustration ───────────────────────── */

export function VarianteB(props: VarianteProps) {
  const { card, grand } = props;
  const i = infos(card);
  const p = isPlanque(card) ? card : null;
  return (
    <Coque variante="b" props={props} style={i.style}>
      <div className="pv-b__art" style={{ background: i.fond }}>
        {!i.url && <span className="pv-b__glyphe">{card.glyph}</span>}
      </div>
      <div className="pv-b__haut">
        {p && (
          <span className="pv-b__seuil">
            <small>Seuil</small>
            {p.hp}
          </span>
        )}
        <div className="pv-b__titre">
          <span className="pv-b__stade">
            {i.stade}
            {i.comex && <b className="pv-comex">COMEX</b>}
          </span>
          <span className="pv-b__nom">{card.name}</span>
        </div>
      </div>
      <div className="pv-b__bas">
        {p && p.ability && (
          <div className="pv-b__talent">
            <em>Talent</em> {p.ability.name}
          </div>
        )}
        {p ? (
          p.attacks.map((a) => (
            <div className="pv-b__pression" key={a.name}>
              <CafePips symbols={a.cost} />
              <span className="pv-b__pnom">{a.name}</span>
              <span className="pv-b__dgt">{a.damage || ''}</span>
            </div>
          ))
        ) : (
          <p className="pv-b__texte">{isPlanque(card) ? '' : card.text}</p>
        )}
        {grand && <p className="pv-b__flavour">{card.flavor}</p>}
        <div className="pv-b__meta">
          <span className="pv-b__faction">
            <i>{i.faction.glyph}</i>
            {i.faction.short}
          </span>
          <span className="pv-b__rarete">{i.rarity.label}</span>
          {p && (
            <span className="pv-b__regles">
              {i.weakness ? `Vuln. ${i.weakness.short} +${WEAKNESS_BONUS}` : 'Aucune vuln.'} · Rot. {p.retreat}
            </span>
          )}
        </div>
      </div>
    </Coque>
  );
}

/* ───────────────────────── C · Gabarit Pocket ───────────────────────── */

/** La règle d'une carte Action, en un mot (AGENTS §4) : c'est elle qui décide quand la jouer. */
const REGLE_ACTION = { OBJET: 'illimité', COLLEAGUE: '1 par tour' } as const;

export function VarianteC(props: VarianteProps) {
  const { card, grand } = props;
  const i = infos(card);
  const p = isPlanque(card) ? card : null;
  // La légende ne répète pas le stade (il est sur l'illustration) : elle dit ce qui est nouveau.
  const legende = p
    ? i.parent
      ? `évolue de ${i.parent.name}`
      : i.faction.name
    : `${i.stade.split(' · ')[0]} · ${REGLE_ACTION[card.kind as keyof typeof REGLE_ACTION]}`;
  return (
    <Coque variante="c" props={props} style={i.style}>
      <header className="pv-c__tete">
        <span className="pv-c__nom" data-long={card.name.length > 18 || undefined}>
          {card.name}
        </span>
        {p && (
          <span className="pv-c__seuil" aria-label={`Seuil ${p.hp}`}>
            <small aria-hidden>Seuil</small>
            {p.hp}
          </span>
        )}
        <span className="pv-c__glyphe" title={i.faction.name} aria-hidden>
          {i.faction.glyph}
        </span>
      </header>
      <div className="pv-c__art" style={{ background: i.fond }}>
        {!i.url && <span className="pv-c__glyphe-fond">{card.glyph}</span>}
        <span className="pv-c__stade">
          {i.stade}
          {i.comex && <b className="pv-c__comex">COMEX</b>}
        </span>
      </div>
      <div className="pv-c__legende">{legende}</div>
      <div className="pv-c__corps">
        {p && p.ability && (
          <div className="pv-c__talent">
            <em>Talent</em>
            <span>{p.ability.name}</span>
            {grand && <small className="pv-c__effet">{p.ability.text}</small>}
          </div>
        )}
        {p ? (
          p.attacks.map((a) => (
            <div className="pv-c__pression" key={a.name}>
              <CafePips symbols={a.cost} />
              <span className="pv-c__pnom">{a.name}</span>
              <span className="pv-c__dgt">{a.damage || ''}</span>
              {grand && a.text && <small className="pv-c__effet">{a.text}</small>}
            </div>
          ))
        ) : (
          <p className="pv-c__texte">{isPlanque(card) ? '' : card.text}</p>
        )}
      </div>
      {grand && <p className="pv-c__flavour">{card.flavor}</p>}
      {p && (
        <div className="pv-c__stats">
          <span>
            <small>{grand ? 'Vulnérabilité' : 'Vuln.'}</small>
            {i.weakness ? (
              <b>
                <i style={{ background: i.weakness.color }}>{i.weakness.glyph}</i>
                {i.weakness.short} +{WEAKNESS_BONUS}
              </b>
            ) : (
              <b>aucune</b>
            )}
          </span>
          <span>
            <small>{grand ? 'Rotation' : 'Rot.'}</small>
            <CafePips symbols={Array.from({ length: p.retreat }, () => 'INCOLORE' as const)} />
          </span>
        </div>
      )}
      <footer className="pv-c__pied">
        <span className="pv-c__rarete">{i.rarity.label}</span>
        <span className="pv-c__sigle">· {i.faction.short}</span>
      </footer>
    </Coque>
  );
}

/* ───────────────────────── D · Badge d'employé ───────────────────────── */

export function VarianteD(props: VarianteProps) {
  const { card, grand } = props;
  const i = infos(card);
  const p = isPlanque(card) ? card : null;
  const matricule = `${i.faction.short}-${card.id.split('-').slice(1).join('').slice(0, 6).toUpperCase()}`;
  return (
    <Coque variante="d" props={props} style={i.style}>
      <div className="pv-d__bandeau">
        <span className="pv-d__trou" aria-hidden />
        <span className="pv-d__service">
          <i>{i.faction.glyph}</i> Service {i.faction.name}
        </span>
      </div>
      <div className="pv-d__photo" style={{ background: i.fond }}>
        {!i.url && <span className="pv-d__glyphe">{card.glyph}</span>}
      </div>
      <div className="pv-d__qui">
        <span className="pv-d__nom">{card.name}</span>
        <span className="pv-d__poste">
          {p ? `Poste : ${i.stade}` : i.stade}
          {i.comex && <b className="pv-comex">COMEX</b>}
        </span>
      </div>
      {p && (
        <div className="pv-d__seuil">
          <span className="pv-d__seuil-lib">Seuil de tolérance</span>
          <span className="pv-d__jauge">
            <span style={{ width: `${Math.round((p.hp / SEUIL_MAX) * 100)}%` }} />
          </span>
          <b>{p.hp}</b>
        </div>
      )}
      <ol className="pv-d__missions">
        {p ? (
          <>
            {p.ability && (
              <li className="pv-d__talent">
                <span className="pv-d__case">★</span>
                <span className="pv-d__pnom">{p.ability.name}</span>
                <span className="pv-d__dgt">Talent</span>
              </li>
            )}
            {p.attacks.map((a) => (
              <li key={a.name}>
                <CafePips symbols={a.cost} />
                <span className="pv-d__pnom">{a.name}</span>
                <span className="pv-d__dgt">{a.damage || ''}</span>
              </li>
            ))}
          </>
        ) : (
          <li className="pv-d__texte">{isPlanque(card) ? '' : card.text}</li>
        )}
      </ol>
      {grand && <p className="pv-d__flavour">{card.flavor}</p>}
      <div className="pv-d__pied">
        <span className="pv-d__code" aria-hidden />
        <span className="pv-d__matricule">{matricule}</span>
        <span className="pv-d__rarete">{i.rarity.label}</span>
        {p && (
          <span className="pv-d__regles">
            {i.weakness ? `Allergique à ${i.weakness.short} (+${WEAKNESS_BONUS})` : 'Aucune allergie'} · Rotation{' '}
            {p.retreat}
          </span>
        )}
      </div>
    </Coque>
  );
}

export const COMPOSANTS: Record<Exclude<VarianteKey, 'A'>, (props: VarianteProps) => ReactNode> = {
  B: VarianteB,
  C: VarianteC,
  D: VarianteD
};

/* ───────────────────────── CSS du prototype ───────────────────────── */

const CSS = `
/* Chrome commun : bouton remis à zéro, ratio 63/88, échelle en cqw. */
.pv {
  all: unset;
  aspect-ratio: 63 / 88;
  border-radius: 12px;
  box-sizing: border-box;
  container-type: inline-size;
  cursor: pointer;
  display: block;
  position: relative;
  transition: transform 160ms ease, box-shadow 160ms ease;
  width: 100%;
}
.pv:hover { transform: translateY(-3px); }
.pv:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.pv.is-selected { box-shadow: 0 0 0 2px var(--accent), 0 0 0 6px color-mix(in srgb, var(--accent) 22%, transparent); }
.pv__face {
  border-radius: inherit;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  font-size: 5.6cqw;
  height: 100%;
  line-height: 1.2;
  overflow: hidden;
  position: relative;
}
.pv .pips { gap: 0.15em; }
.pv .pip { height: 0.8em; width: 0.8em; }
.pv-comex {
  background: linear-gradient(180deg, var(--gold-soft), var(--gold));
  border-radius: 0.3em;
  color: #2a1d00;
  font-size: 0.75em;
  font-weight: 800;
  letter-spacing: 0.06em;
  margin-left: 0.4em;
  padding: 0.05em 0.35em;
}
.card-slot.is-missing .pv { filter: grayscale(1) brightness(0.7); }
.card-slot.is-full .pv { opacity: 0.6; }
.pv[data-rarity='1S'], .pv[data-rarity='2S'], .pv[data-rarity='3S'], .pv[data-rarity='COU'] {
  --holo: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 22%) 45%, transparent 60%);
}

/* ── B · Pleine illustration ── */
.pv-b {
  background: var(--rarity);
  box-shadow: 0 10px 22px -8px rgb(0 0 0 / 70%);
  padding: 3px;
}
.pv-b .pv__face { border-radius: 9px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 60%); }
.pv-b__art { inset: 0; position: absolute; }
.pv-b__art::after { background: var(--holo, none); content: ''; inset: 0; mix-blend-mode: screen; position: absolute; }
.pv-b__glyphe {
  color: color-mix(in srgb, var(--accent) 70%, white);
  font-size: 9em; left: 50%; opacity: 0.35; position: absolute; top: 40%; transform: translate(-50%, -50%);
}
.pv-b__haut {
  align-items: flex-start;
  background: linear-gradient(180deg, rgb(4 8 16 / 88%) 0%, rgb(4 8 16 / 55%) 65%, transparent);
  display: flex;
  gap: 0.45em;
  padding: 0.5em 2.6em 1.6em 0.5em;
  position: relative;
}
.pv-b.is-grand .pv-b__haut { padding-right: 0.6em; }
.pv-b__seuil {
  align-items: center;
  background: linear-gradient(180deg, var(--gold-soft), var(--gold-deep));
  border-radius: 0.4em;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 60%);
  color: #241800;
  display: flex;
  flex-direction: column;
  font-family: var(--font-display);
  font-size: 1.35em;
  font-weight: 800;
  line-height: 0.95;
  padding: 0.12em 0.28em 0.15em;
}
.pv-b__seuil small { font-size: 0.36em; letter-spacing: 0.08em; text-transform: uppercase; }
.pv-b__titre { display: flex; flex-direction: column; min-width: 0; }
.pv-b__stade { color: color-mix(in srgb, var(--accent) 45%, white); font-size: 0.72em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.pv-b__nom {
  color: #fff; font-family: var(--font-display); font-size: 1.12em; font-weight: 800; line-height: 1.05;
  text-shadow: 0 1px 2px rgb(0 0 0 / 80%);
}
.pv-b__bas {
  backdrop-filter: blur(6px) saturate(1.2);
  background: linear-gradient(180deg, rgb(7 12 22 / 55%), rgb(7 12 22 / 88%));
  border-top: 1px solid rgb(255 255 255 / 12%);
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  margin-top: auto;
  padding: 0.45em 0.55em 0.4em;
  position: relative;
}
.pv-b__talent { color: var(--gold-soft); font-size: 0.78em; font-weight: 600; }
.pv-b__talent em { background: color-mix(in srgb, var(--gold) 22%, transparent); border-radius: 0.25em; font-style: normal; padding: 0 0.3em; }
.pv-b__pression { align-items: center; display: grid; gap: 0.4em; grid-template-columns: 3.1em 1fr auto; }
.pv-b__pnom { font-size: 0.86em; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-b__dgt { font-family: var(--font-display); font-size: 1.2em; font-weight: 800; }
.pv-b__texte { font-size: 0.8em; margin: 0; }
.pv-b__flavour { color: var(--text-muted); font-size: 0.72em; font-style: italic; margin: 0.2em 0 0; }
.pv-b__meta {
  align-items: center; border-top: 1px solid rgb(255 255 255 / 10%); color: var(--text-muted);
  display: flex; flex-wrap: wrap; font-size: 0.62em; gap: 0.2em 0.6em; padding: 0.3em 22% 0 0;
}
.pv-b.is-grand .pv-b__meta { padding-right: 0; }
.pv-b__faction { align-items: center; color: var(--text); display: inline-flex; font-weight: 700; gap: 0.3em; }
.pv-b__faction i { background: var(--accent); border-radius: 50%; color: #fff; display: inline-grid; font-style: normal; height: 1.5em; place-items: center; width: 1.5em; }
.pv-b__rarete { color: var(--rarity); letter-spacing: 0.05em; }

/* ── C · Gabarit Pocket ── (relu : aplat de faction, plancher de taille, chrome du slot) */
.pv-c {
  background: linear-gradient(160deg, color-mix(in srgb, var(--rarity) 85%, white), color-mix(in srgb, var(--rarity) 55%, #111));
  box-shadow: 0 10px 22px -8px rgb(0 0 0 / 70%);
  padding: 2.5%;
}
.pv-c[data-rarity='COU'] { background: color-mix(in srgb, var(--rarity) 62%, var(--bg-deep)); }
.pv-c:has(.pv-c__comex) { background: linear-gradient(160deg, var(--gold-soft), var(--gold-deep)); }
.pv-c .pv__face {
  background: color-mix(in srgb, var(--accent) 55%, #10161f);
  border-radius: 8px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 18%), inset 0 0 0 1px rgb(0 0 0 / 45%);
  gap: 0.25em;
  padding: 0.35em 0.45em 0.3em;
}
.pv-c .pv__face::before {
  background: var(--holo, none); content: ''; inset: 0; mix-blend-mode: screen; pointer-events: none; position: absolute;
}
.pv-c__tete { align-items: center; display: flex; gap: 0.3em; min-height: 2.3em; }
.pv-c__nom {
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: #fff; display: -webkit-box; flex: 1 1 auto;
  font-family: var(--font-display); font-size: 1em; font-weight: 800; line-height: 1.05; min-width: 0; overflow: hidden;
  text-shadow: 0 1px 0 rgb(0 0 0 / 50%); text-wrap: balance;
}
.pv-c__nom[data-long] { font-size: 0.84em; }
.pv-c__seuil { align-items: baseline; color: #fff; display: flex; flex: none; font-family: var(--font-display); font-size: 1.2em; font-weight: 800; gap: 0.12em; }
.pv-c__seuil small { font-size: 0.42em; font-weight: 700; letter-spacing: 0.04em; opacity: 0.9; text-transform: uppercase; }
.pv-c__glyphe {
  background: var(--accent); border-radius: 50%; box-shadow: 0 0 0 0.1em var(--text), 0 0 0 0.2em rgb(0 0 0 / 40%); color: #fff;
  display: grid; flex: none; font-size: 0.75em; height: 1.45em; place-items: center; width: 1.45em;
}
.pv-c__art {
  aspect-ratio: 4 / 3; border-radius: 0.25em; box-shadow: 0 0 0 0.18em color-mix(in srgb, var(--rarity) 70%, #fff), 0 0.15em 0.4em rgb(0 0 0 / 50%);
  flex: none; margin: 0 0.1em; position: relative;
}
.pv-c__glyphe-fond { color: #fff; font-size: 4em; left: 50%; opacity: 0.4; position: absolute; top: 50%; transform: translate(-50%, -50%); }
.pv-c__stade {
  align-items: center; background: rgb(7 12 22 / 80%); border-radius: 0.5em; color: #fff; display: inline-flex; font-size: 0.66em;
  font-weight: 700; gap: 0.35em; left: 0.35em; letter-spacing: 0.04em; padding: 0.15em 0.45em; position: absolute; top: 0.35em;
}
.pv-c__comex { background: var(--gold); border-radius: 0.3em; color: #1c1304; font-weight: 800; padding: 0 0.3em; }
.pv-c__legende {
  background: rgb(0 0 0 / 28%); border-radius: 0.2em; color: rgb(255 255 255 / 90%); font-size: 0.68em; font-style: italic;
  overflow: hidden; padding: 0.1em 0.5em; text-align: center; text-overflow: ellipsis; white-space: nowrap;
}
.pv-c__corps { display: flex; flex: 1 1 auto; flex-direction: column; gap: 0.2em; justify-content: flex-start; min-height: 0; padding-top: 0.25em; }
.pv-c__talent { align-items: center; display: grid; font-size: 0.8em; gap: 0.1em 0.35em; grid-template-columns: 3.75em 1fr; }
.pv-c__talent em { background: #b3261e; border-radius: 0.2em; color: #fff; font-size: 0.7em; font-style: normal; font-weight: 800; padding: 0.05em 0.35em; text-align: center; text-transform: uppercase; }
.pv-c__talent span { color: #fff; font-weight: 700; }
.pv-c__pression { align-items: center; display: grid; gap: 0.1em 0.35em; grid-template-columns: 3em 1fr auto; min-height: 1.5em; }
.pv-c__pnom { color: #fff; font-size: 0.9em; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-c__dgt { color: #fff; font-family: var(--font-display); font-size: 1.15em; font-variant-numeric: tabular-nums; font-weight: 800; min-width: 1.7em; text-align: right; }
.pv-c__effet {
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: rgb(255 255 255 / 85%); display: -webkit-box; font-size: 0.7em;
  grid-column: 2 / -1; line-height: 1.2; overflow: hidden;
}
.pv-c__talent .pv-c__effet { font-size: 0.85em; }
.pv-c .pip { box-shadow: 0 0 0 1px var(--bg-deep), 0 0 0 1.5px var(--text); height: 0.9em; width: 0.9em; }
.pv-c .pip--free { border-color: var(--text); box-shadow: none; }
.pv-c__texte {
  background: rgb(0 0 0 / 22%); border-radius: 0.3em; color: #fff; font-size: 0.88em; margin: auto 0; padding: 0.5em 0.6em; text-align: center;
}
.pv-c__flavour { color: rgb(255 255 255 / 80%); font-size: 0.68em; font-style: italic; margin: 0; }
.pv-c__stats {
  border-top: 1px solid rgb(255 255 255 / 25%); display: grid; gap: 0.4em; grid-template-columns: 1fr 1fr; padding-top: 0.2em;
}
.pv-c__stats > span { align-items: center; color: #fff; display: flex; gap: 0.3em; justify-content: center; }
.pv-c__stats small { font-size: 0.62em; letter-spacing: 0.04em; opacity: 0.85; text-transform: uppercase; }
.pv-c__stats b { align-items: center; display: inline-flex; font-size: 0.82em; gap: 0.2em; }
.pv-c__stats b i { border-radius: 50%; color: #fff; display: inline-grid; font-size: 0.8em; font-style: normal; height: 1.5em; place-items: center; width: 1.5em; }
.pv-c__pied { align-items: center; display: flex; gap: 0.4em; justify-content: flex-start; min-height: 2.5em; padding-left: 2.2rem; }
.pv-c.is-grand .pv-c__pied { justify-content: center; min-height: 1.4em; padding-left: 0; }
.pv-c__rarete { color: var(--rarity); font-size: 0.85em; letter-spacing: 0.08em; text-shadow: 0 1px 0 rgb(0 0 0 / 70%); }
.pv-c__sigle { color: color-mix(in srgb, var(--accent) 35%, #fff); font-size: 0.75em; font-weight: 700; }
[data-proto-variante='C'] .card-slot__quick { bottom: 0.45rem; left: 0.45rem; right: auto; top: auto; }
.card-slot.is-missing .pv-c { filter: none; }
.card-slot.is-missing .pv-c .pv__face { filter: grayscale(1); }
.card-slot.is-missing .pv-c__art { opacity: 0.4; }
.card-detail__visual:has(.pv-c) { max-width: 280px; }

/* ── D · Badge d'employé ── */
.pv-d {
  background: #e9e4d8;
  box-shadow: 0 10px 22px -8px rgb(0 0 0 / 70%), inset 0 0 0 1px rgb(0 0 0 / 25%);
  color: #1d2230;
}
.pv-d.is-selected { box-shadow: 0 0 0 2px var(--accent), 0 0 0 6px color-mix(in srgb, var(--accent) 22%, transparent); }
.pv-d .pv__face {
  background:
    repeating-linear-gradient(0deg, transparent 0 0.9em, rgb(0 0 0 / 3%) 0.9em calc(0.9em + 1px)),
    linear-gradient(180deg, #f4f0e6, #e3dccb);
  border: 0.18em solid var(--rarity);
  border-radius: 12px;
}
.pv-d__bandeau {
  align-items: center; background: var(--accent); color: #fff; display: flex; flex-direction: column; gap: 0.2em;
  padding: 0.35em 0.4em 0.3em;
}
.pv-d__trou { background: #e9e4d8; border-radius: 1em; box-shadow: inset 0 0.08em 0.2em rgb(0 0 0 / 45%); height: 0.38em; width: 2.6em; }
.pv-d__service { font-size: 0.6em; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.pv-d__service i { font-style: normal; }
.pv-d__photo {
  aspect-ratio: 1; align-self: center; border: 0.18em solid #fff; border-radius: 0.35em;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 30%), 0 0.25em 0.5em rgb(0 0 0 / 25%); margin-top: 0.45em; position: relative; width: 52%;
}
.pv-d__photo::after { background: var(--holo, none); content: ''; inset: 0; mix-blend-mode: screen; position: absolute; }
.pv-d__glyphe { color: #fff; font-size: 3.6em; left: 50%; opacity: 0.6; position: absolute; top: 50%; transform: translate(-50%, -50%); }
.pv-d__qui { align-items: center; display: flex; flex-direction: column; padding: 0.3em 0.5em 0; text-align: center; }
.pv-d__nom { font-family: var(--font-display); font-size: 0.98em; font-weight: 800; line-height: 1.05; text-transform: uppercase; }
.pv-d__poste { align-items: center; color: #4a5266; display: flex; font-size: 0.62em; font-weight: 600; margin-top: 0.1em; }
.pv-d__seuil { align-items: center; display: grid; gap: 0 0.4em; grid-template-columns: 1fr auto; padding: 0.3em 0.6em 0; }
.pv-d__seuil-lib { color: #4a5266; font-size: 0.5em; font-weight: 700; grid-column: 1 / -1; letter-spacing: 0.08em; text-transform: uppercase; }
.pv-d__jauge { background: #cfc8b6; border-radius: 1em; height: 0.45em; overflow: hidden; }
.pv-d__jauge span { background: linear-gradient(90deg, #3a9a6a, #d9a33a 70%, #c8452f); display: block; height: 100%; }
.pv-d__seuil b { font-family: var(--font-display); font-size: 1em; font-weight: 800; }
.pv-d__missions { display: flex; flex: 1 1 auto; flex-direction: column; gap: 0.15em; justify-content: center; list-style: none; margin: 0; padding: 0.2em 0.6em; }
.pv-d__missions li { align-items: center; border-bottom: 1px dashed rgb(0 0 0 / 18%); display: grid; gap: 0.35em; grid-template-columns: 2.8em 1fr auto; padding-bottom: 0.1em; }
.pv-d__missions .pip { box-shadow: 0 0 0 1px rgb(0 0 0 / 45%); }
.pv-d__missions .pip--free { border-color: #4a5266; }
.pv-d__case { color: #b5832a; font-size: 0.8em; text-align: center; }
.pv-d__pnom { font-size: 0.74em; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-d__dgt { font-family: var(--font-display); font-size: 1em; font-weight: 800; }
.pv-d__talent .pv-d__dgt { color: #b5832a; font-family: inherit; font-size: 0.55em; text-transform: uppercase; }
.pv-d__texte { display: block !important; font-size: 0.7em; }
.pv-d__flavour { color: #4a5266; font-size: 0.62em; font-style: italic; margin: 0 0.6em 0.2em; }
.pv-d__pied {
  align-items: center; background: #fff; border-top: 1px solid rgb(0 0 0 / 15%); display: grid; gap: 0 0.4em;
  grid-template-columns: auto 1fr auto; padding: 0.25em 0.5em;
}
.pv-d__code {
  background: repeating-linear-gradient(90deg, #1d2230 0 1px, transparent 1px 3px, #1d2230 3px 5px, transparent 5px 6px, #1d2230 6px 7px, transparent 7px 9px);
  height: 1.3em; width: 3.2em;
}
.pv-d__matricule { font-family: ui-monospace, monospace; font-size: 0.55em; letter-spacing: 0.05em; }
.pv-d__rarete { color: color-mix(in srgb, var(--rarity) 70%, #000); font-size: 0.6em; }
.pv-d__regles { color: #4a5266; font-size: 0.5em; grid-column: 1 / -1; }
[data-proto-variante='D'] .card-slot__plates { bottom: auto; top: 2.4rem; }
[data-proto-variante='B'] .card-slot__plates { bottom: auto; top: 2.3rem; }

/* ── La barre du prototype : volontairement étrangère au design ── */
.proto-switcher {
  align-items: center; background: #fff; border-radius: 999px; bottom: calc(env(safe-area-inset-bottom) + 92px);
  box-shadow: 0 6px 24px rgb(0 0 0 / 55%), 0 0 0 2px #ff2d87; color: #111; display: flex; font: 600 13px/1 system-ui, sans-serif;
  gap: 10px; left: 50%; padding: 6px 8px; position: fixed; transform: translateX(-50%); white-space: nowrap; z-index: 9999;
}
.proto-switcher button {
  background: #111; border: 0; border-radius: 999px; color: #fff; cursor: pointer; font: inherit; height: 28px; width: 28px;
}
.proto-switcher strong { color: #ff2d87; }
`;

if (import.meta.env.DEV && typeof document !== 'undefined' && !document.getElementById('prototype-cartes-css')) {
  const balise = document.createElement('style');
  balise.id = 'prototype-cartes-css';
  balise.textContent = CSS;
  document.head.appendChild(balise);
}
