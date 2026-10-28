import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { FACTION_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { artFileOf, artUrl } from '@/art';
import { CafePips } from './CafePips';

interface Props {
  card: Card;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
  /**
   * **Calme** — la carte telle qu'elle doit être **sur le plateau** (D-093, #187 ;
   * `SPEC-COMBAT-UI` §8 T2, D-116, #285) : aucune micro-animation de survol, et le gabarit
   * **réduit** (`card--compact`) qu'il **impose** — une carte de plateau ne se rend pas en
   * grand. C'est le **seul** nom du cas d'usage : la prop `figee`, qui ne coupait que le
   * geste, a été retirée (#324), et `calme` la couvre.
   *
   * Sur un plateau de combat, huit cartes qui se soulèvent au passage du pointeur font du
   * bruit, et le survol y sert à **lire** (l'inspecteur), pas à décorer. La classe
   * `card--figee` reste le nom que `styles.css` reconnaît pour ce silence (#324 : le
   * renommage de la classe appartient à la feuille de style).
   */
  calme?: boolean;
  /**
   * **L'état vivant de la carte au plateau** : le Stress qui monte (D-026). Le Seuil reste
   * la pastille de la carte (`card.hp`) ; c'est la **barre** qui change de sens. Omis, la
   * barre montre la capacité, pleine — le gabarit de la Collection.
   */
  stress?: number;
  seuil?: number;
  /**
   * **Au plateau** — le gabarit se dépouille (#187) : ni stade, ni Pressions, ni pied, ni
   * flavour. À 64 px de large, une carte ne peut pas raconter la même chose qu'une carte
   * de Collection : elle montre son illustration, son nom et son Stress ; le reste vit
   * dans l'inspecteur (#188).
   */
  plateau?: boolean;
  /**
   * **Les annotations remises** (#189, `SPEC-COMBAT-UI` §4.3) : le mode `détaillé` du combat
   * réaffiche ce que `plateau` avait coupé — le nom des Pressions et leurs dégâts sur la
   * carte du Poste, le chiffre du Stress. Rien de ce qui décide n'apparaît ni ne disparaît
   * avec ce drapeau : la barre, le nom, le Seuil et l'illustration restent dans les deux modes.
   */
  annotations?: boolean;
}

/** Les raretés à traitement holographique (`CARD-SPEC.md` §1) : étoiles et Couronne. */
const HOLO_RARITIES: Rarity[] = ['1S', '2S', '3S', 'COU'];

/**
 * **L'aplat de faction** sous l'illustration — un **aplat**, pas un dégradé (#208).
 *
 * Il est calculé par `color-mix` sur `--accent`, que la carte porte déjà : aucune couleur
 * n'est recopiée. La palette dérivée de `FACTION_META` (`card.palette`, un dégradé) reste la
 * donnée d'identité et le repli documentaire, mais elle n'est plus peinte dans la fenêtre :
 * un dégradé **violet** ou **cyan** sur fond sombre est un tell d'UI générée
 * (`impeccable`, `ai-color-palette`, relevé sur `/collection` et `/deck`) — et la teinte de
 * faction, elle, ne change pas.
 */
const APLAT_FACTION = 'color-mix(in srgb, var(--accent) 26%, var(--bg-deep))';

export function CardView({ card, onClick, compact, selected, calme, stress, seuil, plateau, annotations }: Props) {
  // La planche de la carte, ou celle de sa base (D-139) : une seule résolution.
  const art = artFileOf(card);
  const faction = FACTION_META[card.faction];
  const rarity = RARITY_META[card.rarity];
  const planque = isPlanque(card);
  const comex = planque && card.ex === true;
  // **Calme** coupe le geste (#285) et **impose** le format réduit : une carte de plateau ne
  // se rend pas en grand. Un seul drapeau pour un seul comportement (#324).
  const immobile = calme === true;
  const reduite = compact === true || calme === true;
  // `--accent` = couleur **de la faction** (source unique : `FACTION_META`) ; `--rarity`
  // = celle de la rareté. Les deux pilotent le cadre et les accents de la carte.
  const style = {
    '--accent': faction.color,
    '--rarity': rarity.color,
    '--card-palette': card.palette
  } as CSSProperties;

  // Le Stress **vivant** n'a de sens qu'avec son Seuil : sans les deux, la barre garde son
  // rôle de capacité (pleine) — c'est la carte de la Collection, pas celle du plateau.
  const vivant = typeof stress === 'number' && typeof seuil === 'number' && seuil > 0 ? { stress, seuil } : null;
  const pctStress = vivant ? Math.max(0, Math.min(100, Math.round((vivant.stress / vivant.seuil) * 100))) : 100;
  const niveauStress = pctStress >= 75 ? 'is-high' : pctStress >= 50 ? 'is-mid' : '';

  const classes = [
    'card',
    comex ? 'card--comex' : '',
    HOLO_RARITIES.includes(card.rarity) ? 'card--holo' : '',
    reduite ? 'card--compact' : '',
    selected ? 'card--selected' : '',
    // La classe du geste coupé porte le **style** (curseur, `transition: none`) et garde le nom
    // que `styles.css` reconnaît (`card--figee`) : `calme` l'obtient sans quoi il couperait les
    // animations `framer-motion` mais pas la transition CSS.
    immobile ? 'card--figee' : '',
    plateau ? 'card--plateau' : '',
    plateau && annotations ? 'card--annotations' : ''
  ]
    .filter(Boolean)
    .join(' ');

  // Une carte **figée sans geste** n'est pas un bouton : huit boutons muets feraient huit
  // arrêts de tabulation pour rien. Un plateau se parcourt au clavier (#188) ; ici, le
  // contenu reste du texte lisible, et rien ne promet un clic qui n'existe pas.
  const contenu = (
    <div className="card__face">
      <header className="card__top">
        <div className="card__title">
          <span className="card__kind">
            <span
              className={`card__stage ${
                planque ? `card__stage--${card.stage.toLowerCase().replace('+', '')}` : 'card__stage--action'
              }`}
            >
              {kindLabel(card)}
            </span>
            {comex && <span className="card__comex">COMEX</span>}
          </span>
          <span className="card__name">{card.name}</span>
        </div>
        {/* Le Seuil en pastille, en haut à droite : la place d'une jauge de vie sur une
            carte. Son libellé est dessiné en CSS (`data-label`) : il n'ajoute pas un
            « Seuil » de plus au texte de chaque carte. */}
        {planque && (
          <span className="card__seuil-badge" data-label="Seuil" title="Seuil" aria-label={`Seuil ${card.hp}`}>
            {card.hp}
          </span>
        )}
      </header>

      <div
        className="card__art"
        style={{
          // **Un seul** chemin de fond, le raccourci `background`. Mélanger le raccourci
          // et `backgroundImage` fait **annuler** l'aplat par React — il écrit `""` sur le
          // longhand, ce qui retire la couche image posée par le raccourci (React signale
          // lui-même ce mélange comme source de bugs de style). Les ~276 cartes sans
          // illustration perdaient donc leur fond de faction.
          // Cadrage **haut** (50% 28%) : les illustrations sont des portraits, un cadrage
          // centré leur coupe la tête dès que la fenêtre est plus large que haute.
          //
          // L'URL vient de `@/art` (D-045) : Vite la résout et la hache. Il n'y a plus de
          // copie servie dans `public/` — une image du registre est servie, ou rien.
          //
          // **Chargement** (#131) : sous l'image, l'aplat de faction (`APLAT_FACTION`) en
          // seconde couche — le temps que l'illustration arrive, ou si elle ne vient pas
          // (hors ligne, hors précache), la carte garde son fond au lieu d'un trou.
          // **Une variante sans planche montre celle de sa base** (D-139) : le repli se fait
          // par **résolution** (`artFileOf`), jamais par une copie dans les données.
          background: artUrl(art)
            ? `url('${artUrl(art)}') 50% 28% / cover no-repeat, ${APLAT_FACTION}`
            : APLAT_FACTION
        }}
      >
        {/* Spec #95 : « l'image **si elle existe** ; sinon l'aplat **+ glyphe** ». Le
            glyphe ne se superpose donc pas à une illustration. */}
        {!card.art && <span className="card__glyph">{card.glyph}</span>}
        <span className="card__shine" />
        {/* L'emblème de la faction, au coin de l'illustration : sa couleur et son glyphe
            viennent de `FACTION_META`. Le nom de la faction est écrit au pied. Sans illustration,
            le glyphe du fond (`.card__glyph`) tient déjà ce rôle : pas de doublon. */}
        {card.art && (
          <span className="card__emblem" title={faction.name} aria-hidden>
            {faction.glyph}
          </span>
        )}
      </div>

      {planque && (
        <div className="card__seuil">
          {vivant ? (
            // Au plateau, la barre **est** la mesure : elle monte avec le Stress (D-026),
            // donc elle se lit à voix haute pour qui ne la voit pas.
            <span
              className="stress card__seuil-bar"
              role="img"
              aria-label={`Stress ${vivant.stress} sur ${vivant.seuil}`}
            >
              <span className={`stress__fill ${niveauStress}`} style={{ width: `${pctStress}%` }} />
            </span>
          ) : (
            <span className="stress card__seuil-bar" aria-hidden>
              <span className="stress__fill" style={{ width: '100%' }} />
            </span>
          )}
          {/* Le chiffre n'est qu'une **annotation** (#189) : `sobre` garde la barre seule,
              `détaillé` remet le nombre. */}
          {vivant && annotations && (
            <span className="card__stress-chiffre">
              {vivant.stress}/{vivant.seuil}
            </span>
          )}
        </div>
      )}

      {/* Sur le plateau `sobre`, les Pressions sont une **annotation** (#189) : elles ne
          sont pas rendues du tout, au lieu d'un texte caché. `détaillé` les remet sur la
          carte du Poste ; une Action garde son texte dans les deux cas. */}
      {(!plateau || annotations || !planque) && (
        <div className="card__attacks">
          {planque ? (
            card.attacks.map((attack) => (
              <div className="attack" key={attack.name}>
                <CafePips symbols={attack.cost} />
                <span className="attack__name">{attack.name}</span>
                <span className="attack__dmg">{attack.damage}</span>
              </div>
            ))
          ) : (
            <div className="attack">
              <span className="attack__name">{card.text}</span>
            </div>
          )}
        </div>
      )}

      {!reduite && <p className="card__flavor">{card.flavor}</p>}

      <footer className="card__footer">
        <span className="card__rarity" title={`Rareté ${card.rarity}`}>
          {rarity.label}
        </span>
        <span className="card__faction" title={faction.name}>
          <i className="card__faction-dot" aria-hidden />
          {faction.short}
        </span>
        {!reduite && <span className="card__id">#{card.id.split('-').slice(-1)[0]}</span>}
      </footer>
    </div>
  );

  const commun = {
    className: classes,
    // La rareté en **attribut** (en plus de `--rarity`) : c'est ce qui permet au CSS de
    // traiter une rareté en particulier (le filet plat de la Couronne, #208) sans recopier
    // un hex.
    'data-rarity': card.rarity,
    style,
    onClick,
    // Immobile : le plateau ne bouge pas au passage du pointeur (D-093). Le survol y ouvre
    // l'inspecteur ; une carte qui se soulève en même temps brouille ce geste. `calme` est ce
    // silence, et c'est le seul drapeau qui le porte (#285, #324).
    whileHover: immobile ? undefined : { y: -4, scale: 1.01 },
    whileTap: immobile ? undefined : { scale: 0.99 },
    transition: immobile ? undefined : { type: 'spring' as const, stiffness: 320, damping: 26 }
  };

  return immobile && !onClick ? (
    <motion.div {...commun}>{contenu}</motion.div>
  ) : (
    <motion.button type="button" {...commun}>
      {contenu}
    </motion.button>
  );
}
