import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { CARD_BY_ID, FACTION_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { artFileOf, artUrl } from '@/art';
import { WEAKNESS_BONUS } from '@/game/rules';
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
   * la pastille de la carte (`card.hp`) ; c'est la **barre** qui change de sens. Omis, il n'y a
   * pas de barre : une carte de Collection ou de main n'a pas encore de Stress.
   */
  stress?: number;
  seuil?: number;
  /**
   * **Au plateau** — le portrait plein (#187, prototype B du 28/10/2026) : l'illustration
   * couvre la carte, et seuls le nom, le Seuil et le Stress s'y posent. À 56–88 px de large,
   * une carte ne peut pas raconter la même chose qu'une carte de Collection : le reste vit
   * dans l'inspecteur (#188).
   */
  plateau?: boolean;
  /**
   * **Le nom lu par un lecteur d'écran**, quand la carte est un bouton. Sans lui, le nom
   * accessible est tout le contenu de la carte (nom, Seuil, Pressions, Vuln., rareté…) et
   * **ne dit ni la possession ni le Deck** : sur 308 cartes, l'écran ne se trie plus
   * (critique du 30/10/2026, P1). Les cartes d'un plateau n'en ont pas besoin.
   */
  label?: string;
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

/** La règle d'une carte Action, en un mot (AGENTS.md §4) : c'est elle qui décide quand la jouer. */
const REGLE_ACTION = { OBJET: 'illimité', COLLEAGUE: '1 par tour' } as const;

/** Au-delà de ce nombre de signes, le nom passe un cran plus petit pour tenir sur deux lignes. */
const NOM_LONG = 18;

export function CardView({
  card,
  onClick,
  compact,
  selected,
  calme,
  stress,
  seuil,
  plateau,
  annotations,
  label
}: Props) {
  // La planche de la carte, ou celle de sa base (D-139) : une seule résolution.
  const art = artFileOf(card);
  const url = artUrl(art);
  const faction = FACTION_META[card.faction];
  const rarity = RARITY_META[card.rarity];
  const planque = isPlanque(card) ? card : null;
  // La faiblesse se lit sur la faction, comme les 20 de `WEAKNESS_BONUS` (AGENTS §5 : l'Intérimaire n'en a pas).
  const weakness = faction.weakness ? FACTION_META[faction.weakness] : null;
  const comex = planque?.ex === true;
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

  // Le Stress **vivant** n'a de sens qu'avec son Seuil : sans les deux, il n'y a pas de barre —
  // une carte de Collection ou de main n'a pas encore de Stress.
  const vivant =
    planque && typeof stress === 'number' && typeof seuil === 'number' && seuil > 0 ? { stress, seuil } : null;
  const pctStress = vivant ? Math.max(0, Math.min(100, Math.round((vivant.stress / vivant.seuil) * 100))) : 0;
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

  // **Un seul** chemin de fond, le raccourci `background`. Mélanger le raccourci et
  // `backgroundImage` fait **annuler** l'aplat par React — il écrit `""` sur le longhand, ce
  // qui retire la couche image posée par le raccourci. Cadrage **haut** (50% 22%) : les
  // illustrations sont des portraits. L'URL vient de `@/art` (D-045). **Chargement** (#131) :
  // sous l'image, l'aplat de faction en seconde couche — le temps que l'illustration arrive, ou
  // si elle ne vient pas (hors ligne), la carte garde son fond au lieu d'un trou. **Une variante
  // sans planche montre celle de sa base** (D-139) : le repli se fait par résolution (`artFileOf`).
  const fenetre = (
    <div
      className="card__art"
      style={{ background: url ? `url('${url}') 50% 22% / cover no-repeat, ${APLAT_FACTION}` : APLAT_FACTION }}
    >
      {/* Spec #95 : « l'image **si elle existe** ; sinon l'aplat **+ glyphe** ». */}
      {!card.art && <span className="card__glyph">{card.glyph}</span>}
      {!plateau && (
        <span className="card__stage">
          {kindLabel(card)}
          {comex && <b className="card__comex">COMEX</b>}
        </span>
      )}
    </div>
  );

  // La barre de Stress **vivant** (D-026) : au plateau, elle **est** la mesure, donc elle se lit
  // à voix haute pour qui ne la voit pas. Le chiffre n'est qu'une **annotation** (#189).
  const barre = vivant && (
    <div className="card__seuil">
      <span className="stress card__seuil-bar" role="img" aria-label={`Stress ${vivant.stress} sur ${vivant.seuil}`}>
        <span className={`stress__fill ${niveauStress}`} style={{ width: `${pctStress}%` }} />
      </span>
      {annotations && (
        <span className="card__stress-chiffre">
          {vivant.stress}/{vivant.seuil}
        </span>
      )}
    </div>
  );

  const seuilBadge = planque && (
    // Le mot « Seuil » est dessiné en CSS (`data-label`) : il n'ajoute pas un « Seuil » de plus
    // au texte de chaque carte ; le nom accessible est l'`aria-label`.
    <span className="card__seuil-badge" data-label="Seuil" aria-label={`Seuil ${planque.hp}`}>
      {planque.hp}
    </span>
  );

  const pressions = planque
    ? planque.attacks.map((attack) => (
        <div className="attack" key={attack.name}>
          <CafePips symbols={attack.cost} />
          <span className="attack__name">{attack.name}</span>
          <span className="attack__dmg">{attack.damage}</span>
          {!reduite && !plateau && attack.text && <small className="attack__effet">{attack.text}</small>}
        </div>
      ))
    : null;

  const contenu = plateau ? (
    // **Au plateau — portrait plein** (prototype B, 28/10/2026) : l'illustration couvre la
    // carte ; nom, Stress et (en `détaillé`) Pressions sont sur un voile en bas, le Seuil en
    // plaque discrète dans le coin. À 56–88 px de large, l'image est ce qui se reconnaît.
    <div className="card__face">
      {fenetre}
      <span className="card__emblem" title={faction.name} aria-hidden>
        {faction.glyph}
      </span>
      {seuilBadge}
      <div className="card__voile">
        {!planque && <span className="card__stage">{kindLabel(card).split(' · ')[0]}</span>}
        <span className="card__name">{card.name}</span>
        {/* Les Pressions sont une **annotation** du plateau (#189) : `sobre` ne les rend pas. */}
        {planque && annotations && <div className="card__attacks">{pressions}</div>}
        {barre}
      </div>
    </div>
  ) : (
    // **Hors plateau — gabarit Pocket** (prototype C, 28/10/2026, relu) : en-tête nom / Seuil /
    // faction, fenêtre d'illustration à ratio fixe portant le stade, légende d'évolution,
    // Talent et Pressions en colonnes, Vulnérabilité / Rotation, pied rareté + sigle.
    <div className="card__face">
      <header className="card__top">
        <span className="card__name" data-long={card.name.length > NOM_LONG || undefined}>
          {card.name}
        </span>
        {seuilBadge}
        <span className="card__emblem" title={faction.name} aria-hidden>
          {faction.glyph}
        </span>
      </header>
      {fenetre}
      <div className="card__legende">
        {planque
          ? planque.evolvesFrom && CARD_BY_ID.get(planque.evolvesFrom)
            ? `évolue de ${CARD_BY_ID.get(planque.evolvesFrom)!.name}`
            : faction.name
          : `${kindLabel(card).split(' · ')[0]} · ${isPlanque(card) ? '' : REGLE_ACTION[card.kind]}`}
      </div>
      {barre}
      <div className="card__attacks">
        {planque?.ability && (
          <div className="card__talent">
            <em>Talent</em>
            <span>{planque.ability.name}</span>
            {!reduite && <small className="attack__effet">{planque.ability.text}</small>}
          </div>
        )}
        {pressions ?? <p className="card__texte">{isPlanque(card) ? '' : card.text}</p>}
      </div>
      {!reduite && <p className="card__flavor">{card.flavor}</p>}
      {planque && (
        <div className="card__bas">
          <span>
            <small>{reduite ? 'Vuln.' : 'Vulnérabilité'}</small>
            {weakness ? (
              <b>
                <i style={{ background: weakness.color }} aria-hidden>
                  {weakness.glyph}
                </i>
                {weakness.short} +{WEAKNESS_BONUS}
              </b>
            ) : (
              <b>aucune</b>
            )}
          </span>
          <span>
            <small>{reduite ? 'Rot.' : 'Rotation'}</small>
            <CafePips
              symbols={Array.from({ length: planque.retreat }, () => 'INCOLORE' as const)}
              label={`Rotation ${planque.retreat}`}
            />
          </span>
        </div>
      )}
      <footer className="card__footer">
        <span className="card__rarity" title={`Rareté ${card.rarity}`}>
          {rarity.label}
        </span>
        <span className="card__faction" title={faction.name}>
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

  // Une carte **figée sans geste** n'est pas un bouton : huit boutons muets feraient huit
  // arrêts de tabulation pour rien. Un plateau se parcourt au clavier (#188).
  return immobile && !onClick ? (
    <motion.div {...commun}>{contenu}</motion.div>
  ) : (
    <motion.button type="button" aria-label={label} {...commun}>
      {contenu}
    </motion.button>
  );
}
