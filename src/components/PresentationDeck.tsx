import { useMemo } from 'react';
import { Dialog, DialogClose, DialogPanneau, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { FACTION_META, STAGE_META, VIVIER_META, getCard, isPlanque } from '@/data';
import type { Card, Stage } from '@/data/types';
import type { DeckPropose } from '@/data/decks-proposes';

/**
 * **La présentation d'un Deck proposé** (#251) : un **panneau**, pas une route — il sert à
 * choisir, pas à s'y rendre, et se ferme sans quitter l'écran du Deck.
 *
 * Il dit ce que la liste ne dit pas : la **difficulté à jouer** du Deck, et **ce qu'il
 * contient** (stades, factions, exemplaires). Le bouton qui le charge est ici, au même
 * endroit que la lecture : on choisit après avoir lu.
 *
 * Même forme que l'inspecteur du combat (#188) : un dialogue **non modal**, sans voile,
 * qui laisse la page lisible derrière lui.
 */

/** Le libellé de la difficulté à jouer d'un Deck (donnée du Deck, pas de la Direction). */
export const LIBELLE_DIFFICULTE_A_JOUER: Readonly<Record<DeckPropose['difficulteAJouer'], string>> = {
  facile: 'Facile à jouer',
  moyenne: 'Demande un peu de pratique',
  exigeante: 'Exigeante'
};

const STADES: readonly Stage[] = ['ENTRANT', 'N+1', 'N+2'];

/** Les cartes du Deck groupées par nom, exemplaires comptés : 13 lignes au plus. */
function contenuDuDeck(deck: DeckPropose): { nom: string; copies: number }[] {
  const parNom = new Map<string, { nom: string; copies: number }>();
  for (const id of deck.cartes) {
    const card: Card | undefined = getCard(id);
    const nom = card?.name ?? 'Carte inconnue';
    const ligne = parNom.get(nom);
    if (ligne) ligne.copies += 1;
    else parNom.set(nom, { nom, copies: 1 });
  }
  return [...parNom.values()];
}

/** Ce que le Deck porte, par stade et par faction : la lecture d'une liste, jamais une règle. */
function resumeDuDeck(deck: DeckPropose) {
  const cartes = deck.cartes.map((id) => getCard(id)).filter((card): card is Card => card !== undefined);
  const planques = cartes.filter(isPlanque);
  const stades = STADES.map((stage) => ({
    stage,
    label: STAGE_META[stage].label,
    nombre: planques.filter((card) => card.stage === stage).length
  })).filter((ligne) => ligne.nombre > 0);
  const actions = cartes.length - planques.length;
  const factions = [...new Set(planques.map((card) => card.faction))].map((faction) => ({
    nom: FACTION_META[faction].name,
    couleur: FACTION_META[faction].color,
    nombre: planques.filter((card) => card.faction === faction).length
  }));
  return { stades, actions, factions };
}

export function PresentationDeck({
  deck,
  onClose,
  onCharger
}: {
  deck: DeckPropose;
  onClose: () => void;
  /** Charge ce Deck dans le Deck du joueur, puis ferme le panneau. */
  onCharger: () => void;
}) {
  const contenu = useMemo(() => contenuDuDeck(deck), [deck]);
  const resume = useMemo(() => resumeDuDeck(deck), [deck]);

  return (
    <Dialog modal={false} open onOpenChange={(ouvert) => !ouvert && onClose()}>
      <DialogPortal>
        <DialogPanneau className="presentation-deck">
          <DialogTitle className="presentation-deck__titre">{deck.name}</DialogTitle>
          <p className="muted presentation-deck__ligne">
            {deck.vivier === 'MIXTE' ? 'Mixte' : VIVIER_META[deck.vivier].label} ·{' '}
            {deck.cafeTypes.map((type) => FACTION_META[type].name).join(' · ')}
            {deck.archetype ? ` · Archétype ${deck.archetype}` : ''}
          </p>

          <section className="presentation-deck__bloc" aria-label="Stratégie">
            <h3>Stratégie</h3>
            <p>{deck.strategie}</p>
          </section>

          <section className="presentation-deck__bloc" aria-label="Difficulté à jouer">
            <h3>Difficulté à jouer</h3>
            <p>
              <strong>{LIBELLE_DIFFICULTE_A_JOUER[deck.difficulteAJouer]}</strong> — {deck.pourquoiDifficulte}
            </p>
            <p className="muted">Faible contre : {deck.faiblesse}</p>
          </section>

          <section className="presentation-deck__bloc" aria-label="Contenu du Deck">
            <h3>Ce qu’il contient</h3>
            <p className="muted">
              {deck.cartes.length} cartes · {resume.stades.map((ligne) => `${ligne.nombre} ${ligne.label}`).join(' · ')}
              {resume.actions > 0 ? ` · ${resume.actions} Action${resume.actions > 1 ? 's' : ''}` : ''}
            </p>
            <p className="muted">{resume.factions.map((faction) => `${faction.nom} ${faction.nombre}`).join(' · ')}</p>
            <ul className="presentation-deck__cartes">
              {contenu.map((ligne) => (
                <li key={ligne.nom}>
                  {ligne.nom}
                  {ligne.copies > 1 && <span className="muted"> ×{ligne.copies}</span>}
                </li>
              ))}
            </ul>
          </section>

          <div className="presentation-deck__actions">
            <button type="button" className="button button--primary" onClick={onCharger}>
              Charger ce Deck
            </button>
            <DialogClose className="button">Fermer</DialogClose>
          </div>
        </DialogPanneau>
      </DialogPortal>
    </Dialog>
  );
}
