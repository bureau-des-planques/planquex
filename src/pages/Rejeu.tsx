import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getCard } from '@/data';
import type { BattleState, EndReason, PlayerId } from '@/data/types';
import { rejouer } from '@/game/rejeu';
import type { RefusRejeu } from '@/game/rejeu';
import { CAMP_NAME } from '@/data/vocabulaire';
import { etapesDuRejeu, ecartVerdict } from '@/store/derniere';
import type { DernierePartie } from '@/store/derniere';
import { useStore } from '@/store/useStore';

/**
 * **Revoir ma dernière partie** — ticket #366 (D-142 : hors du combat).
 *
 * L'écran vit depuis Réglages, jamais dans la barre d'action d'une partie en cours. Il **rejoue**
 * la partie rangée (`derniere`) avec le moteur, il ne la **rejuge** pas : le verdict du rejeu
 * est comparé à celui de la partie d'origine, et un écart s'affiche en alerte.
 *
 * Le pas-à-pas avance et recule étape par étape (boutons, curseur clavier) ; chaque étape
 * montre le plateau des deux camps et le journal qui s'est écrit jusque-là.
 */

const FIN_LIBELLE: Record<EndReason, string> = {
  interventions: 'trois Interventions',
  plateauVide: 'plus aucun Planqué en jeu',
  forfait: 'forfait',
  limiteDeTours: 'limite de tours atteinte'
};

const REFUS_LIBELLE: Record<RefusRejeu, string> = {
  'deck-illegal': 'Les Decks de cette partie ne sont plus légaux : le rejeu est refusé, il ne s’affiche pas à moitié.',
  'journal-incoherent':
    'Le journal ne se rejoue pas tel quel : au moins une action a été refusée en route. Le rejeu est refusé.'
};

function nomCamp(camp: PlayerId | null, deux: boolean): string {
  if (camp === null) return 'Égalité';
  if (deux) return CAMP_NAME[camp].replace(/^camp/, 'Camp');
  return camp === 'player' ? 'Toi' : 'La Direction';
}

function resumeVerdict(verdict: DernierePartie['verdict'], deux: boolean): string {
  const fin = verdict.raison === null ? 'fin inconnue' : FIN_LIBELLE[verdict.raison];
  return `${nomCamp(verdict.vainqueur, deux)} gagne, par ${fin}, en ${verdict.tours} tours.`;
}

function Plateau({ state, camp, deux }: { state: BattleState; camp: PlayerId; deux: boolean }) {
  const joueur = state.players[camp];
  const poste = joueur.active;
  const nomPoste = poste ? (getCard(poste.cardId)?.name ?? poste.cardId) : 'aucun Planqué au Poste';
  const bancPlein = joueur.bench.filter((carte) => carte !== null).length;
  return (
    <section className="rejeu__camp panel" aria-label={nomCamp(camp, deux)}>
      <h3>{nomCamp(camp, deux)}</h3>
      <dl className="rejeu__fiche">
        <div>
          <dt>Poste</dt>
          <dd>
            {nomPoste}
            {poste && (
              <span className="muted">
                {' '}
                — stress {poste.maxHp - poste.hp} sur {poste.maxHp}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Banc</dt>
          <dd>
            {bancPlein} sur {joueur.bench.length}
          </dd>
        </div>
        <div>
          <dt>Interventions</dt>
          <dd>{joueur.points} sur 3</dd>
        </div>
        <div>
          <dt>Machine à café</dt>
          <dd>{joueur.energyZone ? 'un café prêt' : 'vide'}</dd>
        </div>
      </dl>
    </section>
  );
}

function Revue({ partie }: { partie: DernierePartie }) {
  const deux = partie.mode === 'deux';
  const rejeu = useMemo(() => rejouer(partie, { deuxCamps: deux }), [partie, deux]);
  const etapes = useMemo(() => (rejeu.ok ? etapesDuRejeu(partie, { deuxCamps: deux }) : []), [rejeu, partie, deux]);
  const [pas, setPas] = useState(0);

  if (!rejeu.ok) {
    return (
      <section className="section panel" role="alert">
        <p>{REFUS_LIBELLE[rejeu.raison]}</p>
      </section>
    );
  }

  const dernierPas = etapes.length - 1;
  const etat = etapes[Math.min(pas, dernierPas)] ?? rejeu.state;
  const ecart = ecartVerdict(rejeu.state, partie.verdict);
  const alle = (n: number) => setPas(Math.max(0, Math.min(dernierPas, n)));
  const lignes = etat.log.slice(-12);

  return (
    <>
      <section className="section panel" aria-labelledby="rejeu-verdict">
        <h2 id="rejeu-verdict">Verdict</h2>
        <p>
          <strong>Partie d’origine :</strong> {resumeVerdict(partie.verdict, deux)}
        </p>
        {ecart === null ? (
          <p role="status">Verdict du rejeu identique : même vainqueur, même fin, mêmes tours.</p>
        ) : (
          <p role="alert">{ecart}</p>
        )}
      </section>

      <section className="section panel rejeu__pas" aria-labelledby="rejeu-pas">
        <h2 id="rejeu-pas">Pas-à-pas</h2>
        <p className="muted" aria-live="polite">
          Étape {Math.min(pas, dernierPas)} sur {dernierPas} · tour {etat.turn}
        </p>
        <div className="rejeu__commandes" role="group" aria-label="Commandes du rejeu">
          <button type="button" className="button" onClick={() => alle(0)} disabled={pas === 0} aria-label="Au début">
            <ChevronsLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="button" onClick={() => alle(pas - 1)} disabled={pas === 0}>
            <ChevronLeft size={18} aria-hidden="true" /> Reculer
          </button>
          <button type="button" className="button" onClick={() => alle(pas + 1)} disabled={pas >= dernierPas}>
            Avancer <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="button"
            onClick={() => alle(dernierPas)}
            disabled={pas >= dernierPas}
            aria-label="À la fin"
          >
            <ChevronsRight size={18} aria-hidden="true" />
          </button>
        </div>
        <label className="rejeu__curseur">
          <span className="muted">Étape</span>
          <input
            type="range"
            min={0}
            max={dernierPas}
            value={Math.min(pas, dernierPas)}
            onChange={(event) => alle(Number(event.target.value))}
            aria-valuetext={`étape ${Math.min(pas, dernierPas)} sur ${dernierPas}`}
          />
        </label>
      </section>

      <div className="rejeu__plateau">
        <Plateau state={etat} camp="player" deux={deux} />
        <Plateau state={etat} camp="ai" deux={deux} />
      </div>

      <section className="section panel" aria-labelledby="rejeu-journal">
        <h2 id="rejeu-journal">Journal</h2>
        {lignes.length === 0 ? (
          <p className="muted">Rien ne s’est encore joué.</p>
        ) : (
          <ol className="rejeu__journal">
            {lignes.map((ligne, index) => (
              <li key={`${index}-${ligne}`}>{ligne}</li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

export function Rejeu() {
  const derniere = useStore((state) => state.derniere);
  return (
    <div className="page rejeu-page">
      <section className="section__head">
        <div>
          <h1>Revoir ma dernière partie</h1>
          <p className="muted">Le rejeu se consulte après coup : il ne joue rien et ne rejuge rien.</p>
        </div>
      </section>
      {derniere === null ? (
        <section className="section panel">
          <p>Aucune partie terminée à revoir. Une partie finie se garde ici dès qu’elle se termine.</p>
          <Link className="button" to="/settings">
            Retour aux Réglages
          </Link>
        </section>
      ) : (
        <Revue partie={derniere} />
      )}
      <p>
        <Link className="button" to="/settings">
          Retour aux Réglages
        </Link>
      </p>
    </div>
  );
}
