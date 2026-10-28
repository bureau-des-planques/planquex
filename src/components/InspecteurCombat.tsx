import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { FACTION_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card, CardInstance } from '@/data/types';
import { CafePips, cafeLabel } from '@/components/CafePips';
import { STATUS_META } from '@/components/StatusBadge';
import { Dialog, DialogClose, DialogPanneau, DialogPortal, DialogTitle } from '@/components/ui/dialog';

/**
 * **L'inspecteur du combat** (SPEC-COMBAT-UI §3, §6.4, #188) — deux surfaces, un seul contenu.
 *
 * - **Lire** (survol, focus clavier) : une **infobulle** `role="tooltip"`, reliée à la carte par
 *   `aria-describedby`. L'APG interdit qu'elle reçoive le focus : **aucun élément focusable**
 *   dedans, donc **aucun bouton** (la garde `garde-fous.mjs` le vérifie).
 * - **Agir** (clic, tap, Entrée) : un **panneau non modal** — même contenu, plus les gestes de la
 *   carte, pris dans la liste du moteur par l'écran. Pas de voile : il se pose à côté de la carte.
 *
 * Le contenu de lecture (`FicheCarte`) est le même dans les deux surfaces.
 */

/** Le délai avant l'infobulle au survol : assez pour ne pas clignoter en balayant le plateau. */
const DELAI_SURVOL_MS = 300;

/**
 * **L'écran large** (D-142) : à partir de 900 px, ou en paysage de téléphone, le panneau est une
 * colonne de la console, pas une feuille basse. C'est le média de `styles.css` (« Sur écran large,
 * le panneau… ») : les deux se lisent ensemble, sinon le panneau calcule une feuille qu'il n'est pas.
 */
export const ECRAN_LARGE = '(min-width: 900px), (orientation: landscape) and (min-width: 600px)';

function ecranLarge(): boolean {
  // jsdom n'a pas `matchMedia` : la largeur seule y décide, comme avant D-142.
  return typeof window.matchMedia === 'function' ? window.matchMedia(ECRAN_LARGE).matches : window.innerWidth >= 900;
}

/** La carte du plateau portant ce `uid`, pour rendre le focus à la carte qu'on vient de fermer. */
function trouverCarte(uid: string | null): HTMLElement | null {
  if (!uid) return null;
  return [...document.querySelectorAll<HTMLElement>('[data-uid]')].find((el) => el.dataset.uid === uid) ?? null;
}

/**
 * Ce qu'une carte **dit d'elle-même** : nom entier, stade, faction, rareté, Seuil, Stress chiffré,
 * cafés attachés, Conditions en clair, Pressions (coût et Stress), Talent. Aucun bouton.
 * `machine` n'est donné que pour le Poste : la Machine à café est une affaire de camp.
 */
export function FicheCarte({ instance, card, machine }: { instance: CardInstance; card: Card; machine?: string }) {
  const planque = isPlanque(card) ? card : null;
  const seuil = instance.maxHp;
  const stress = instance.maxHp - instance.hp;
  return (
    <div className="inspecteur__fiche">
      {/* Le nom ENTIER : l'écran peut le tronquer, la fiche jamais. */}
      <p className="inspecteur__nom">{card.name}</p>
      <p className="muted inspecteur__ligne">
        {kindLabel(card)} · {FACTION_META[card.faction].name} · Rareté {RARITY_META[card.rarity].label}
      </p>
      {planque && (
        <>
          <p className="inspecteur__stress">
            <strong>
              {stress}/{seuil} de Stress
            </strong>{' '}
            <span className="muted">(Seuil {seuil})</span>
          </p>
          <p className="inspecteur__cafes">
            <span className="muted">Cafés attachés :</span>{' '}
            <CafePips
              symbols={instance.energy}
              label={
                instance.energy.length > 0
                  ? `Cafés attachés : ${instance.energy.map(cafeLabel).join(' · ')}`
                  : 'Aucun café attaché'
              }
            />
          </p>
          <p>
            <strong>Conditions</strong> {instance.statuses.length === 0 && <span className="muted">aucune</span>}
          </p>
          {instance.statuses.map((status) => (
            <p className="inspecteur__regle" key={status}>
              <strong>{STATUS_META[status].label}</strong> : {STATUS_META[status].description}
            </p>
          ))}
          <p>
            <strong>Pressions</strong>
          </p>
          {planque.attacks.map((attaque) => (
            <p className="inspecteur__regle" key={attaque.name}>
              <CafePips symbols={attaque.cost} /> <strong>{attaque.name}</strong> · {attaque.damage} de Stress
            </p>
          ))}
          {planque.ability && (
            <p className="inspecteur__regle">
              <strong>Talent · {planque.ability.name}</strong> — {planque.ability.text}
            </p>
          )}
        </>
      )}
      {machine && <p className="muted inspecteur__machine">{machine}</p>}
    </div>
  );
}

/**
 * La carte du plateau, **survolable et désignable** : l'infobulle au survol (souris, après
 * `DELAI_SURVOL_MS`) et au focus ; le panneau au clic, au tap et à Entrée.
 *
 * L'infobulle reste tant que la carte est désignée : elle est **dans** l'enveloppe, donc le pointeur
 * peut passer d'un coup de la carte à elle sans qu'elle se ferme (le critère WCAG sur le contenu au survol : survolable). Échap la
 * ferme sans bouger le pointeur. Quand le panneau se ferme sur cette carte, l'infobulle ne revient
 * pas toute seule : le focus rendu à la carte ne la rouvre pas en double.
 */
export function CarteSurvolable({
  uid,
  nom,
  className,
  fiche,
  inspectee,
  onInspecter,
  onAttacher,
  children
}: {
  uid: string;
  /** Le nom entier : c'est le nom accessible du groupe. */
  nom: string;
  className: string;
  fiche: ReactNode;
  /** Vrai quand le panneau montre cette carte : l'infobulle s'efface devant lui. */
  inspectee: boolean;
  onInspecter: () => void;
  /**
   * **Le café se touche sur le Planqué** (#454, D-145) : quand un café attend en Machine et que
   * cette carte le reçoit, le clic, Entrée et Espace attachent le café au lieu d'ouvrir le
   * panneau. Son nom accessible dit alors l'action. Absent, la carte se comporte comme avant.
   */
  onAttacher?: () => void;
  children: ReactNode;
}) {
  const attachable = onAttacher !== undefined;
  const activer = () => (onAttacher ? onAttacher() : onInspecter());
  const id = useId();
  const [survol, setSurvol] = useState(false);
  const [focus, setFocus] = useState(false);
  const [ecartee, setEcartee] = useState(false);
  const minuterie = useRef<number | null>(null);
  const carte = useRef<HTMLDivElement | null>(null);
  const [ancre, setAncre] = useState<{ x: number; y: number; dessus: boolean } | null>(null);
  const etaitInspectee = useRef(inspectee);

  const annulerMinuterie = () => {
    if (minuterie.current !== null) window.clearTimeout(minuterie.current);
    minuterie.current = null;
  };

  useEffect(() => annulerMinuterie, []);

  useEffect(() => {
    if (etaitInspectee.current && !inspectee) setEcartee(true);
    etaitInspectee.current = inspectee;
  }, [inspectee]);

  const visible = (survol || focus) && !ecartee && !inspectee;

  // **L'infobulle sort du plateau** : le plateau isole ses plans (`isolation`, D-098) pour que le
  // canvas de fond passe sous ses cartes, et cette isolation y enfermait aussi l'infobulle —
  // la main en éventail, qui vit hors du plateau, passait devant elle (mesuré au navigateur :
  // `elementFromPoint` rendait `hand__card`). Elle est donc posée dans `body`, à la verticale de
  // sa carte. Le survol reste continu : la marge haute de l'infobulle fait le pont.
  useEffect(() => {
    if (!visible || !carte.current) return;
    const r = carte.current.getBoundingClientRect();
    // Pas de place sous la carte (le Banc du joueur, sous 900 px) : l'infobulle s'ouvre au-dessus,
    // sinon elle sort de l'écran — mesuré au navigateur, `elementFromPoint` tombait sur la barre.
    const dessus = r.bottom + 220 > window.innerHeight;
    setAncre({ x: r.left + r.width / 2, y: dessus ? r.top : r.bottom, dessus });
  }, [visible]);

  // Échap ferme l'infobulle où que soit le focus (le même critère : fermable sans bouger le pointeur).
  useEffect(() => {
    if (!visible) return;
    const fermer = (evenement: globalThis.KeyboardEvent) => {
      if (evenement.key === 'Escape') setEcartee(true);
    };
    document.addEventListener('keydown', fermer);
    return () => document.removeEventListener('keydown', fermer);
  }, [visible]);

  const onKeyDown = (evenement: KeyboardEvent<HTMLDivElement>) => {
    if (evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault();
      activer();
    }
  };

  return (
    <div
      ref={carte}
      /* **`role="button"`** (#286, T3) : une carte du plateau **agit** — le clic et Entrée ouvrent
         le panneau. `group` la rendait focusable sans dire qu'on agit dessus (le critère WCAG
         « Nom, rôle, valeur » ne promet aucun geste), et un lecteur d'écran ne la trouvait pas
         comme un bouton. Le nom reste celui du Planqué, entier (`aria-label`).
         La carte **dans** la boîte reste inerte (`CardView` figée sans `onClick`) : une seule
         cible de tabulation par Planqué, pas deux. */
      role="button"
      aria-label={attachable ? `Attacher le café à ${nom}` : nom}
      className={attachable ? `${className} is-attachable` : className}
      data-uid={uid}
      tabIndex={0}
      aria-describedby={visible ? id : undefined}
      onClick={activer}
      onKeyDown={onKeyDown}
      onFocus={() => setFocus(true)}
      onBlur={(evenement) => {
        if (!evenement.currentTarget.contains(evenement.relatedTarget as Node | null)) {
          setFocus(false);
          setEcartee(false);
        }
      }}
      onPointerEnter={(evenement) => {
        // Souris seulement : au tactile, le pointeur « entre » au tap, et l'infobulle ferait doublon
        // avec le panneau. Le média `(hover: hover)` se lit donc ici par son type de pointeur.
        if (evenement.pointerType !== 'mouse') return;
        setEcartee(false);
        annulerMinuterie();
        minuterie.current = window.setTimeout(() => setSurvol(true), DELAI_SURVOL_MS);
      }}
      onPointerLeave={(evenement) => {
        if (evenement.pointerType !== 'mouse') return;
        annulerMinuterie();
        setSurvol(false);
        setEcartee(false);
      }}
    >
      {children}
      {visible &&
        ancre &&
        createPortal(
          <div
            role="tooltip"
            id={id}
            className={`infobulle${ancre.dessus ? ' infobulle--dessus' : ''}`}
            style={{ left: `${ancre.x}px`, top: `${ancre.y}px` }}
            onClick={(evenement) => evenement.stopPropagation()}
          >
            {/* Aucun élément focusable ici : l'APG interdit qu'une infobulle reçoive le focus. */}
            <span className="infobulle__corps">{fiche}</span>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Le **panneau** : la même fiche, plus les gestes de la carte (`gestes`, absent pour une carte
 * qu'on ne joue pas). Non modal, sans voile : il se pose sous la carte décrite (feuille basse sur
 * téléphone, colonne à partir de 900 px). Échap le ferme et rend le focus à la carte.
 */
export function InspecteurCombat({
  ouvert,
  onOpenChange,
  nom,
  ancre,
  fiche,
  gestes
}: {
  ouvert: boolean;
  onOpenChange: (ouvert: boolean) => void;
  /** Le nom entier de la carte, titre du panneau. */
  nom: string;
  /** Le `uid` de la carte montrée : c'est elle qu'on ne doit pas recouvrir, et qu'on rend au focus. */
  ancre: string | null;
  fiche: ReactNode;
  /** Les gestes de la carte. `undefined` : carte qu'on ne joue pas, lecture seule. */
  gestes?: ReactNode;
}) {
  /** Le `uid` de la dernière carte montrée : c'est elle qui reçoit le focus à la fermeture. */
  const derniere = useRef<string | null>(null);
  const repere = useRef<HTMLDivElement | null>(null);
  const [haut, setHaut] = useState<number | null>(null);

  useEffect(() => {
    if (ancre) derniere.current = ancre;
  }, [ancre]);

  // Sur téléphone, le panneau est une feuille basse : sa tête se pose **sous** la carte décrite,
  // pour que la carte reste dans la partie haute. Si la carte est trop basse, on la remonte.
  useLayoutEffect(() => {
    if (!ouvert || !ancre) return;
    const carte = trouverCarte(ancre);
    if (!carte || ecranLarge()) {
      setHaut(null);
      return;
    }
    if (carte.getBoundingClientRect().bottom > window.innerHeight - 200) {
      carte.scrollIntoView({ block: 'start' });
    }
    const bas = carte.getBoundingClientRect().bottom;
    setHaut(Math.round(Math.max(bas + 8, window.innerHeight * 0.45)));
  }, [ouvert, ancre]);

  return (
    <>
      {/* Le repère du portail : le panneau est rendu **ici**, dans la console, et non à la fin du
          document — ses règles CSS vivent sous `.battle`, là où sont les jetons de la scène. */}
      <div className="inspecteur-repere" ref={repere} />
      <Dialog modal={false} open={ouvert} onOpenChange={(valeur) => onOpenChange(valeur)}>
        <DialogPortal container={repere}>
          <DialogPanneau
            className="inspecteur"
            style={haut !== null ? ({ '--inspecteur-haut': `${haut}px` } as CSSProperties) : undefined}
            finalFocus={() => trouverCarte(derniere.current)}
          >
            <DialogTitle className="inspecteur__titre">{nom}</DialogTitle>
            {fiche}
            {gestes !== undefined && (
              <section className="inspecteur__gestes" aria-label="Gestes de cette carte">
                {gestes}
              </section>
            )}
            <DialogClose className="button button--small inspecteur__fermer">Fermer</DialogClose>
          </DialogPanneau>
        </DialogPortal>
      </Dialog>
    </>
  );
}
