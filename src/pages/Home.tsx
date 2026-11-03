import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen, Swords, WifiOff } from 'lucide-react';
import { ALL_CARDS } from '@/data';
import { NOTES_RESUME, type ResumeNote } from '@/data/notes-resume';
import type { Card } from '@/data/types';
import { reprendrePartie } from '@/store/partie';
import { useStore } from '@/store/useStore';
import { useEstCibleJournee } from '@/components/journee-cible';
import { APP_LABEL, APP_VERSION } from '@/version';
import { avancementTirable, PLAFOND_TIRABLE } from '@/components/plafond-collection';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SceneOuverture } from '@/animation/ouverture/SceneOuverture';
import { jouer } from '@/audio/sons';
import { useEnLigne } from '@/components/BandeauHorsLigne';
import { ErreurArrivage, type RaisonArrivage } from '@/lib/arrivage';

/** La date se lit en français (« 21 octobre 2026 ») : `date` est un jour, pas un instant. */
function dateLongue(jour: string): string {
  return new Date(`${jour}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * **La dernière release publiée** (#274) : la note de la version sous les yeux si elle est
 * sortie, sinon la plus récente des notes **publiées** — un brouillon attend sa release et
 * ne s'annonce donc pas ici. La donnée vient de `src/data/notes-resume.ts` (D-090), jamais d'un
 * numéro recopié ; `notes` est injectable pour que le test éprouve le cas du brouillon sans
 * dépendre de l'état du journal un jour donné.
 */
function derniereRelease(notes: readonly ResumeNote[]): ResumeNote | undefined {
  return notes.find((note) => !note.brouillon && note.version === APP_VERSION) ?? notes.find((note) => !note.brouillon);
}

/** La raison d'un échec d'ouverture, telle que l'écran la dit (D-060 (3)). */
function raisonDe(erreur: unknown): RaisonArrivage {
  return erreur instanceof ErreurArrivage ? erreur.raison : 'reseau';
}

export function Home({ notes = NOTES_RESUME }: { notes?: readonly ResumeNote[] } = {}) {
  const { owned, deck, openPack, packsOpened, partie } = useStore();
  /**
   * **La partie qui attend** (#553, reste de #427). La sortie du combat range la partie
   * (`@/store/partie`, #126) ; l'écran de combat le dit au retour, l'accueil ne le disait
   * pas — on rouvrait `/battle` pour l'apprendre. Le tour n'est pas rangé tel quel : il se
   * **rejoue** (`reprendrePartie`, la même lecture que l'écran de combat), et `null` veut
   * dire « rien n'attend » — aucune partie, ou une partie qui ne rejoue pas. Une ligne
   * d'état qui ne s'afficherait pas vaut mieux qu'une ligne qui promet une reprise perdue.
   */
  const partieEnCours = useMemo(() => reprendrePartie(partie), [partie]);
  /** Le halo n'apparaît que si c'est **cette** étape que la Journée tient. */
  const cibleArrivage = useEstCibleJournee('arrivage');
  const derniere = derniereRelease(notes);
  const [lastPack, setLastPack] = useState<Card[] | null>(null);
  /**
   * **Le tirage se garde après la fermeture** (D-170) : les cartes sont acquises dès le clic sur
   * « Ouvrir un Arrivage », donc fermer au milieu ne perd rien — mais l'écran qui le disait
   * disparaissait pour de bon, et un Échap réflexe effaçait le seul moment où l'on apprend ce
   * qu'on a gagné. `lastPack` reste en mémoire, et l'accueil propose de le revoir : la scène se
   * rejoue, sans retirer de paquet ni ajouter de carte.
   */
  const [arrivageOuvert, setArrivageOuvert] = useState(false);
  /** Les cartes de l'Arrivage que le testeur n'avait pas : une carte tirée deux fois n'est neuve qu'une. */
  const [nouvelles, setNouvelles] = useState<ReadonlySet<number>>(() => new Set());
  /**
   * **L'ouverture attend le serveur** (#651, D-179 (2)). Le tirage n'est plus local : le
   * bouton se met en attente, et un second clic ne part pas — la clé d'idempotence du
   * store rendrait le doublon inoffensif, mais l'écran ne le tente pas non plus.
   */
  const [ouvertureEnCours, setOuvertureEnCours] = useState(false);
  /** L'échec nommé de la dernière tentative, ou `null`. Le bouton reste le geste de reprise. */
  const [echec, setEchec] = useState<RaisonArrivage | null>(null);
  /**
   * **L'Arrivage attend le réseau** (D-179 (6)) : hors ligne, l'écran le dit avant le clic,
   * et le bouton ne part pas. C'est un **état** (D-060 (3)), pas un message d'erreur, et
   * aucune file d'attente ne retient le geste.
   */
  const enLigne = useEnLigne();

  const uniqueOwned = Object.keys(owned).filter((id) => (owned[id] ?? 0) > 0).length;
  const totalOwned = Object.values(owned).reduce((sum, count) => sum + count, 0);
  // Le pourcentage se lit **sur ce qu'un Arrivage peut donner** : sept cartes (raretés hautes)
  // n'en sortent jamais, donc diviser par tout le catalogue promettrait un 100 % inatteignable.
  const { pourcent: completion } = avancementTirable(owned);

  const handleOpenPack = async () => {
    // Un second clic pendant l'attente ne part pas : le geste est déjà en vol.
    if (ouvertureEnCours) return;
    // **Le son de l'Arrivage part au clic** (D-137) : le geste est ce qui autorise l'audio, et le
    // son accompagne l'ouverture, pas la révélation. Il ne se déplace pas dans la réponse : la
    // révélation vient plus tard, et un son différé n'accompagnerait plus le geste.
    jouer('arrivage');
    const connues = new Set(Object.keys(owned).filter((id) => (owned[id] ?? 0) > 0));
    setOuvertureEnCours(true);
    setEchec(null);
    try {
      // **Les cartes viennent du serveur** (#651, D-179 (2)) : la scène ne s'ouvre que
      // lorsqu'elles sont là, donc jamais sur un tirage local ni sur une promesse vide.
      const cartes = await openPack();
      const neuves = new Set<number>();
      cartes.forEach((card, index) => {
        if (connues.has(card.id)) return;
        connues.add(card.id);
        neuves.add(index);
      });
      setNouvelles(neuves);
      setLastPack(cartes);
      setArrivageOuvert(true);
    } catch (erreur) {
      // L'échec est un **état** de l'écran (D-060 (3)) : rien n'est acquis, rien n'est
      // perdu. Un retry reprend avec la même clé, donc sans double crédit.
      setEchec(raisonDe(erreur));
    } finally {
      setOuvertureEnCours(false);
    }
  };

  return (
    <div className="page home">
      <section className="hero">
        <h1>
          Ton atelier. <br />
          Tes Interventions. <br />
          Ta survie.
        </h1>
        <p className="hero__lead">
          Ouvre des Arrivages, collectionne les Planqués et affronte la Direction. Le seul TCG où le boss est déjà dans
          ta main.
        </p>
        <div className="hero__actions">
          {/* **Le geste de la Journée** (30/10/2026) : tant qu'elle n'est pas finie, ce
              bouton est l'élément qu'elle désigne — le halo vient de `[data-journee-cible]`,
              et la garde du panneau laisse passer ce clic-là. Rien ne change une fois le
              tutoriel vu. */}
          <button
            type="button"
            className="button button--gold button--big hero__ouvrir"
            data-journee-cible={cibleArrivage ? 'arrivage' : undefined}
            onClick={handleOpenPack}
            // Hors ligne, le bouton ne part pas (D-179 (6)) ; pendant l'attente, il ne part
            // pas deux fois. La scène, elle, ne s'ouvre qu'à la réponse du serveur.
            disabled={!enLigne || ouvertureEnCours}
            aria-busy={ouvertureEnCours}
          >
            <PackageOpen size={22} /> Ouvrir un Arrivage
          </button>
          <Link className="button button--primary button--big" to="/battle">
            <Swords size={20} /> Affronter la Direction
          </Link>
        </div>
        {/* **L'Arrivage attend le réseau** (D-179 (6), D-060 (3)) : un état, pas une erreur —
            « connecte-toi pour ouvrir », sans file d'attente et sans tirage local. */}
        {!enLigne && (
          <p className="muted hero__attente" role="status">
            <WifiOff size={16} aria-hidden /> Hors ligne : connecte-toi pour ouvrir un Arrivage. Le combat, la
            Collection et le Deck continuent sans réseau.
          </p>
        )}
        {/* **L'échec d'une ouverture** (#651) : réseau, refus ou configuration. Réessayer est le
            même bouton, avec la même clé d'idempotence : le serveur ne crédite qu'une fois. */}
        {echec && enLigne && (
          <p className="muted hero__attente" role={echec === 'reseau' ? 'alert' : 'status'}>
            {echec === 'refus' && 'Connecte-toi pour ouvrir un Arrivage.'}
            {echec === 'reseau' && 'L’ouverture n’a pas abouti : réessaie. Les cartes ne seront créditées qu’une fois.'}
            {echec === 'hors-ligne' && 'Hors ligne : connecte-toi pour ouvrir un Arrivage. Le reste du jeu continue.'}
            {echec === 'configuration' && 'Le serveur du jeu n’est pas configuré : l’Arrivage ne peut pas s’ouvrir.'}
          </p>
        )}
        {/* **La partie qui attend** (#553) : la même action mène au combat, mais elle
            reprend une partie au lieu d'en commencer une — et le dire ici évite de le
            découvrir sur l'écran de combat. La copie est une écriture d'écran, à valider
            par Bastien ; elle n'a **pas** de date : `PartieSauvegardee` n'en range aucune
            (`@/store/partie`), et l'ajouter demanderait une forme persistée de plus. */}
        {partieEnCours && (
          <p className="muted hero__attente">Une partie t’attend au tour {partieEnCours.state.turn}.</p>
        )}
        {/* Le compteur (#273) : ce qu'un testeur a ouvert depuis le début. L'alpha ne limite
            rien (D-127, Arrivages illimités et gratuits) : aucun quota, aucun prix, aucun
            bouton grisé ici — la cadence est une décision de beta. */}
        <div className="hero__packs">
          <p className="hero__packs-compteur">
            {/* La phrase et le chiffre dans le **même** nœud de texte : le compteur se lit
                d'un bloc, et un test qui cherche « 3 Arrivages ouverts » le trouve. */}
            <strong className="hero__packs-nombre">
              {packsOpened} Arrivage{packsOpened > 1 ? 's' : ''} ouvert{packsOpened > 1 ? 's' : ''}
            </strong>
          </p>
          {packsOpened === 0 && <p className="hero__packs-invite">Aucun Arrivage ouvert : le premier est pour toi.</p>}
          {lastPack && !arrivageOuvert && (
            <button type="button" className="button hero__revoir" onClick={() => setArrivageOuvert(true)}>
              Revoir le dernier Arrivage
            </button>
          )}
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-card__label">Collection</span>
          <strong>{completion}%</strong>
          {/* La jauge redit le pourcentage écrit au-dessus : décorative (le rail coupe au-delà de 100 %). */}
          <span className="stat-card__jauge" aria-hidden="true">
            <span style={{ width: `${completion}%` }} />
          </span>
          <span className="muted">
            {uniqueOwned}/{ALL_CARDS.length} cartes uniques · plafond {PLAFOND_TIRABLE} par Arrivage
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Exemplaires</span>
          <strong>{totalOwned}</strong>
          <span className="muted">toutes raretés</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Deck</span>
          <strong>{deck.length}/20</strong>
          <span className="muted">cartes équipées</span>
        </article>
      </section>

      {/* La dernière release (#274) : une seule, avec sa date, et une porte vers l'historique
          complet. L'accueil est un écran de jeu, pas un journal : les précédentes restent sur
          `/feuille-de-route`. Le libellé vient de `APP_LABEL`, la note de `versions.ts` — rien
          n'est recopié (`src/version.test.ts` le refuse). */}
      <section className="section panel home__version">
        <div className="home__version-texte">
          <h2 className="home__version-titre">La dernière version</h2>
          <p className="home__version-libelle">
            <strong className="settings__version">{APP_LABEL}</strong>
            {derniere && <span className="muted"> · {derniere.titre}</span>}
          </p>
          <p className="muted home__version-date">
            {derniere ? (
              <>
                Publiée le <time dateTime={derniere.date}>{dateLongue(derniere.date)}</time>
              </>
            ) : (
              'Cette build n’a pas encore sa note : elle arrive avec la publication.'
            )}
          </p>
        </div>
        <Link className="button" to="/feuille-de-route">
          Voir toutes les versions
        </Link>
      </section>

      {/* L'Arrivage est un dialogue du composant générique (D-035, #131) : rôle, Échap et
          focus piégé en viennent. `lastPack` **survit** à la fermeture (D-170) : l'accueil
          propose de revoir le tirage, sans redistribuer de cartes. */}
      <Dialog open={arrivageOuvert} onOpenChange={(ouvert) => !ouvert && setArrivageOuvert(false)}>
        <DialogContent className="pack-reveal">
          <DialogTitle className="sr-only">Arrivage</DialogTitle>
          <DialogDescription className="sr-only">
            Les cartes de l’Arrivage sont rangées dans ta Collection.
          </DialogDescription>
          {lastPack && (
            <SceneOuverture cartes={lastPack} neuves={nouvelles} onRanger={() => setArrivageOuvert(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
