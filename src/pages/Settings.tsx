import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardPaste, Copy, History, RotateCcw, ShieldCheck } from 'lucide-react';
import { Confirmation } from '@/components/Confirmation';
import { InvitationTesteurs } from '@/components/InvitationTesteurs';
import { PresentationRegles } from '@/components/PresentationRegles';
import { LIBELLE_DIFFICULTE, LIBELLE_POLITIQUE, RESUME_POLITIQUE } from '@/components/difficulte';
import { reglageDirection } from '@/game/deck-direction';
import { DIFFICULTES } from '@/game/ia';
import { estApprouve, libelleEtat } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';
import { STORAGE_KEY, useStore } from '@/store/useStore';
import { APP_LABEL } from '@/version';

/**
 * Les catégories des Réglages (#277), dans l'ordre où un testeur les cherche : d'abord qui
 * il est et où en est son compte, puis ce qui change son confort (accessibilité), puis les
 * parcours de découverte, puis ce qu'il peut sauver ou effacer, et enfin ce qui engage le
 * jeu (confidentialité, version).
 *
 * **La liste est la garde** : `Settings.test.tsx` vérifie que chaque catégorie est rendue,
 * porte au moins un réglage, et qu'aucune autre n'apparaît (pas de réglage orphelin, pas
 * de réglage en double). `Impeccable` n'a rien à y redire : chaque bloc reste un `.panel`.
 *
 * **Pourquoi « Affichage » n'y est plus** : ses deux seuls réglages — « Réduire les
 * animations » et « Raccourcis clavier au combat » — sont des réglages d'**accessibilité**
 * (D-060, #189 ; recherche du 27/10/2026). Un bloc vidé de son contenu ne se garde pas pour
 * l'esthétique : il ferait un titre sans réglage.
 */
export const CATEGORIES_REGLAGES = [
  'Identité',
  'Compte',
  'Installer le jeu',
  'Difficulté',
  'Accessibilité',
  'Journée d’intégration',
  'Les règles',
  'Pas-à-pas du combat',
  'Sauvegarde',
  'Traces de combat',
  'Revoir une partie',
  'Données locales',
  'Confidentialité',
  'Version'
] as const;

export function Settings() {
  const {
    name,
    setName,
    reducedMotion,
    sons,
    setSons,
    setReducedMotion,
    raccourcisCombat,
    setRaccourcisCombat,
    difficulte,
    setDifficulte,
    reset,
    setTutorielVu,
    setPasAPasCombatVu
  } = useStore();
  const exporterSauvegarde = useStore((state) => state.exporterSauvegarde);
  const importerSauvegarde = useStore((state) => state.importerSauvegarde);
  const configure = useComptes((state) => state.configure);
  const session = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const deconnecter = useComptes((state) => state.deconnecter);
  const [draft, setDraft] = useState(name);
  const [sauvegarde, setSauvegarde] = useState('');
  const [message, setMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);
  /** La réinitialisation efface tout, sans retour : elle passe par la confirmation du jeu (#131). */
  const [confirmeReset, setConfirmeReset] = useState(false);

  const creerSauvegarde = () => {
    const texte = exporterSauvegarde();
    setSauvegarde(texte);
    // Le presse-papier peut être refusé (contexte non sécurisé, permission) : le texte
    // reste dans la zone, il suffit de le sélectionner. On ne ment pas dans le message.
    navigator.clipboard?.writeText(texte).then(
      () =>
        setMessage({
          ton: 'ok',
          texte: 'Sauvegarde copiée. Colle-la dans un fichier ou un message : c’est ta seule copie.'
        }),
      () => setMessage({ ton: 'ok', texte: 'Sauvegarde prête ci-dessus — recopie-la à la main.' })
    );
  };

  const restaurerSauvegarde = () => {
    const resultat = importerSauvegarde(sauvegarde);
    setMessage(
      resultat.ok
        ? { ton: 'ok', texte: 'Sauvegarde restaurée : ta Collection et ton Deck sont revenus.' }
        : { ton: 'ko', texte: resultat.raison }
    );
  };

  return (
    <div className="page settings">
      <section className="section__head">
        <div>
          <h1>Ton poste de travail</h1>
        </div>
      </section>

      <section className="section panel" aria-labelledby="reglages-identite">
        <h2 id="reglages-identite">Identité</h2>
        <form
          className="settings__row"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (value) setName(value);
          }}
        >
          <label className="field">
            <span className="field__label">Nom affiché</span>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={24} />
          </label>
          <button type="submit" className="button button--primary" disabled={draft.trim() === name}>
            Enregistrer
          </button>
        </form>
      </section>

      <section className="section panel" aria-labelledby="reglages-compte">
        <h2 id="reglages-compte">Compte</h2>
        {!configure ? (
          <p className="muted m-0 max-w-[62ch]">Pas de compte : ta progression reste dans ce navigateur.</p>
        ) : !session ? (
          <p className="m-0 max-w-[62ch]">
            Aucun compte connecté. <Link to="/connexion">Se connecter</Link> — l’alpha est réservée aux testeurs.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.9rem]">
              <li>
                <strong>Courriel</strong> · {compte?.courriel || session.courriel || '—'}
              </li>
              <li>
                <strong>État</strong> · {compte ? libelleEtat(compte.etat) : 'inconnu'}
                {compte?.administrateur ? ' · administrateur' : ''}
              </li>
              {/* La « Médaille de la période d'essai » (0016, D-130 (3)) : une **ligne de plus**,
                  jamais à la place de l'état ni du courriel. Elle vit ici tant que le profil n'a
                  pas d'intitulé (#325) — c'est la note de lecture de D-130 (3), pas une
                  réécriture de l'acte. Une liste qui se replie tient à 420 px, là où un badge
                  collé à l'état le pousserait hors de la ligne. */}
              {compte?.medaille_periode_essai && (
                <li>
                  <strong>Médaille de la période d’essai</strong> · obtenue pendant l’alpha
                </li>
              )}
            </ul>
            <p className="m-0 max-w-[64ch] text-[0.86rem] text-ink-muted">
              {estApprouve(compte)
                ? 'Ton compte est validé : les post-its, les pouces et les traces de combat sont ouverts.'
                : 'Ton compte attend la validation de Bastien : tu peux jouer et lire, pas encore écrire.'}
            </p>
            <div className="actions actions--tight">
              <Link className="button" to="/attente">
                Mon état de compte
              </Link>
              {compte?.administrateur && (
                <Link className="button" to="/administration">
                  <ShieldCheck size={16} /> Administration des comptes
                </Link>
              )}
              <button type="button" className="button" onClick={() => void deconnecter()}>
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="section panel" aria-labelledby="reglages-installation">
        <h2 id="reglages-installation">Installer le jeu</h2>
        <p className="muted m-0 max-w-[62ch]">Ajoute Planquex à tes applications, depuis la page d’installation.</p>
        <div className="actions actions--tight">
          <Link className="button button--terminal" to="/installation">
            Préarmer le déploiement
          </Link>
        </div>
      </section>

      {/* **La difficulté** (#251, D-145) : un cran règle **deux** choses, et le bloc le dit
          sans chiffre — la politique par son nom, le Deck par le sien. « Normal » est le
          défaut : la recherche à deux coups de D-084, donc rien ne change pour qui n'y touche
          pas. Le réglage est persisté ; le combat en cours garde le cran de son montage. */}
      <section className="section panel" aria-labelledby="reglages-difficulte">
        <h2 id="reglages-difficulte">Difficulté</h2>
        <p className="muted max-w-[62ch]">Règle la Direction et le Deck qu’elle joue. Effet au prochain combat.</p>
        <div className="settings__difficulte" role="radiogroup" aria-label="Difficulté de la Direction">
          {DIFFICULTES.map((cran) => {
            const reglage = reglageDirection(cran);
            return (
              <label key={cran} className="settings__toggle settings__difficulte-cran">
                <input
                  type="radio"
                  name="difficulte"
                  value={cran}
                  checked={difficulte === cran}
                  onChange={() => setDifficulte(cran)}
                />
                <span>
                  <strong>{LIBELLE_DIFFICULTE[cran]}</strong>
                  {' · '}
                  {LIBELLE_POLITIQUE[reglage.politique]} — {RESUME_POLITIQUE[reglage.politique]}
                  <span className="muted"> · Deck « {reglage.deck.name} »</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Accessibilité (#277) : les deux réglages de confort, rassemblés — ils étaient
          rangés dans « Affichage », qui n'existe plus faute de contenu propre. Aucun autre
          réglage n'est ajouté : un réglage qui n'existe pas ne s'invente pas. */}
      <section className="section panel" aria-labelledby="reglages-accessibilite">
        <h2 id="reglages-accessibilite">Accessibilité</h2>
        <label className="settings__toggle">
          <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
          <span>Réduire les animations</span>
        </label>
        {/* D-137 : le jeu n'a **que** deux sons, et une case qui les coupe. Cochée par défaut ; la
            décocher coupe immédiatement, sans rechargement (le module lit le store à chaque lecture). */}
        <label className="settings__toggle">
          <input type="checkbox" checked={sons} onChange={(event) => setSons(event.target.checked)} />
          <span>Sons du jeu</span>
        </label>
        <p className="muted max-w-[62ch]">Ouverture d’un Arrivage et fin de combat.</p>
        {/* Le critère WCAG sur les raccourcis à une touche (#189, SPEC-COMBAT-UI §4.2) : la case **désactive** les deux gestes,
            `I` comme `Ctrl`+`I`. Cochée par défaut, et c'est aussi le rappel des commandes
            du combat (GAG : « allowance reminder of controls »). */}
        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={raccourcisCombat}
            onChange={(event) => setRaccourcisCombat(event.target.checked)}
          />
          <span>Raccourcis clavier au combat</span>
        </label>
        <p className="muted max-w-[62ch]">« I » ou « Ctrl+I » : infos du combat, sobre ou détaillé.</p>
      </section>

      <section className="section panel" aria-labelledby="reglages-journee">
        <h2 id="reglages-journee">Journée d’intégration</h2>
        <p className="muted max-w-[62ch]">Cinq étapes, un geste chacune.</p>
        <button type="button" className="button" onClick={() => setTutorielVu(false)}>
          Revoir la journée d’intégration
        </button>
      </section>

      {/* **Les règles en une minute** (#270) : la présentation du nouvel inscrit, lisible et
          rejouable ici. */}
      <section className="section panel" aria-labelledby="reglages-regles">
        <h2 id="reglages-regles">Les règles</h2>
        <p className="muted max-w-[62ch]">Six étapes, une minute.</p>
        <PresentationRegles>Les règles en une minute</PresentationRegles>
      </section>

      <section className="section panel" aria-labelledby="reglages-pas-a-pas">
        <h2 id="reglages-pas-a-pas">Pas-à-pas du combat</h2>
        <p className="muted max-w-[62ch]">Cinq étapes sur le premier combat.</p>
        <div className="actions actions--tight">
          <button type="button" className="button" onClick={() => setPasAPasCombatVu(false)}>
            Revoir le pas-à-pas du combat
          </button>
          {/* **Le combat guidé** (#272) : une page de combat, pas un état de plus dans le
              store — le lien la rouvre au début, quel que soit l'état du pas-à-pas. */}
          <Link className="button" to="/battle?tutoriel=1">
            Rejouer le combat guidé
          </Link>
        </div>
      </section>

      <section className="section panel" aria-labelledby="reglages-sauvegarde">
        <h2 id="reglages-sauvegarde">Sauvegarde</h2>
        {/* `max-w-[62ch]` (et non la largeur du panneau) : c'est un paragraphe de prose de
            quatre lignes, et `impeccable` (line-length) le refusait dès que le texte tient
            sur des lignes de plus de 80 caractères. Le rendu du texte était le même avant et
            après le passage de Prettier (vérifié : `innerText` identique, sha1 égal) — c'est
            la **largeur de lecture** qui manquait, pas le formateur. Même remède que la
            section « Traces de combat » (#208). */}
        <p className="muted max-w-[62ch]">
          Ton Deck et ta Collection sont encore dans ce navigateur (clé <code>{STORAGE_KEY}</code>) tant que la synchro
          avec le compte n'est pas livrée. Ton nom aussi reste ici.{' '}
          <strong>Vider les données du navigateur efface tout cela</strong> : copie ce texte avant.
        </p>
        <textarea
          className="settings__save"
          value={sauvegarde}
          onChange={(event) => setSauvegarde(event.target.value)}
          placeholder="Ta sauvegarde apparaîtra ici, ou colle un texte pour le restaurer."
          rows={6}
        />
        <div className="actions actions--tight">
          <button type="button" className="button" onClick={creerSauvegarde}>
            <Copy size={16} /> Créer ma sauvegarde
          </button>
          <button type="button" className="button" onClick={restaurerSauvegarde} disabled={!sauvegarde.trim()}>
            <ClipboardPaste size={16} /> Restaurer ce texte
          </button>
        </div>
        {/* Le message est annoncé : un refus d'import se lit aussi au lecteur d'écran. */}
        {message && (
          <p
            className={message.ton === 'ok' ? 'muted' : 'muted settings__message--ko'}
            role={message.ton === 'ok' ? 'status' : 'alert'}
          >
            {message.texte}
          </p>
        )}
      </section>

      <section className="section panel" aria-labelledby="reglages-traces">
        <h2 id="reglages-traces">Traces de combat</h2>
        {/* `max-w-[56ch]` (et non 64) : depuis le texte à deux (D-105), les lignes à 64ch
            dépassaient 80 caractères — `impeccable`, line-length, cliquet #208. */}
        <p className="muted max-w-[56ch]">
          Les parties terminées sont gardées sous ton compte pour améliorer le jeu. Ni ton nom ni aucun texte libre n’y
          figure (D-086, D-105).
        </p>
      </section>

      <section className="section panel" aria-labelledby="reglages-rejeu">
        <h2 id="reglages-rejeu">Revoir une partie</h2>
        <p className="muted max-w-[56ch]">Ta dernière partie terminée, coup par coup.</p>
        <div className="actions actions--tight">
          <Link className="button" to="/rejeu">
            <History size={16} /> Revoir ma dernière partie
          </Link>
        </div>
      </section>

      <section className="section panel" aria-labelledby="reglages-donnees">
        <h2 id="reglages-donnees">Données locales</h2>
        <button type="button" className="button" onClick={() => setConfirmeReset(true)}>
          <RotateCcw size={16} /> Réinitialiser la progression
        </button>
      </section>

      <Confirmation
        open={confirmeReset}
        titre="Réinitialiser la progression ?"
        texte="Ta Collection, ton Deck, ton nom et ta partie en cours sont effacés de ce navigateur, sans retour possible. Crée d’abord ta sauvegarde si tu veux pouvoir revenir."
        confirmer="Tout effacer"
        onConfirm={() => {
          reset();
          setDraft(useStore.getState().name);
          setConfirmeReset(false);
        }}
        onCancel={() => setConfirmeReset(false)}
      />

      <InvitationTesteurs ou="reglages" />

      <section className="section panel" aria-labelledby="reglages-confidentialite">
        <h2 id="reglages-confidentialite">Confidentialité</h2>
        <p className="muted">
          Ce que le jeu garde de toi — un compte, ce que tu écris sur le mur, et le déroulé de tes parties :{' '}
          <Link to="/confidentialite">la page de confidentialité</Link>.
        </p>
      </section>

      <section className="section panel" aria-labelledby="reglages-version">
        <h2 id="reglages-version">Version</h2>
        <p className="muted">
          <strong className="settings__version">{APP_LABEL}</strong> — dis-moi ce libellé si quelque chose ne va pas :
          c’est lui qui dit quelle version tu as sous les yeux. Ce qu’elle contient, et ce que les précédentes ont
          changé, se lit sur <Link to="/feuille-de-route">la feuille de route</Link>.
        </p>
      </section>
    </div>
  );
}
