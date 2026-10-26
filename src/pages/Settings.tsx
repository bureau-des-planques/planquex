import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardPaste, Copy, RotateCcw, ShieldCheck } from 'lucide-react';
import { Confirmation } from '@/components/Confirmation';
import { estApprouve, libelleEtat } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';
import { STORAGE_KEY, useStore } from '@/store/useStore';
import { APP_LABEL } from '@/version';

export function Settings() {
  const {
    name,
    setName,
    reducedMotion,
    setReducedMotion,
    raccourcisCombat,
    setRaccourcisCombat,
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

      <section className="section panel">
        <h2>Identité</h2>
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

      <section className="section panel">
        <h2>Compte</h2>
        {!configure ? (
          <p className="muted m-0 max-w-[62ch]">
            Le jeu n’est pas relié à une base : il n’y a ni compte ni connexion. Ta progression reste dans ce
            navigateur, et le mur lit le fichier du dépôt.
          </p>
        ) : !session ? (
          <p className="m-0 max-w-[62ch]">
            Aucun compte connecté. <Link to="/connexion">Se connecter</Link> — l’alpha est réservée aux invités.
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

      <section className="section panel">
        <h2>Affichage</h2>
        <label className="settings__toggle">
          <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
          <span>Réduire les animations</span>
        </label>
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
        <p className="muted">
          Cochée, « I » ou « Ctrl+I » bascule les infos du combat entre sobre et détaillé. Décochée, les deux ne font
          plus rien — taper « i » dans le code d’une partie à deux reste toujours un « i ».
        </p>
      </section>

      <section className="section panel">
        <h2>Journée d’intégration</h2>
        <p className="muted">
          Quatre étapes, et chacune ouvre son écran : le Seuil et le Stress, l’Arrivage, le Deck, la fin d’un combat. À
          revoir quand tu veux.
        </p>
        <button type="button" className="button" onClick={() => setTutorielVu(false)}>
          Revoir la journée d’intégration
        </button>
      </section>

      <section className="section panel">
        <h2>Pas-à-pas du combat</h2>
        <p className="muted">
          Cinq étapes sur le premier combat : le Poste, le Banc, le café, la Pression, les Conditions et la fin. À
          revoir quand tu veux.
        </p>
        <button type="button" className="button" onClick={() => setPasAPasCombatVu(false)}>
          Revoir le pas-à-pas du combat
        </button>
      </section>

      <section className="section panel">
        <h2>Sauvegarde</h2>
        <p className="muted">
          Ta progression de jeu — Collection, Deck, nom — vit dans ce navigateur sous la clé <code>{STORAGE_KEY}</code>{' '}
          : elle n’est pas envoyée à la base, et <strong>vider les données du navigateur l’efface</strong>. Copie ce
          texte quelque part avant, il contient tout. Les traces de combat, elles, partent à la base quand elle est
          configurée (voir plus bas).
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

      <section className="section panel">
        <h2>Traces de combat</h2>
        {/* `max-w-[56ch]` (et non 64) : depuis le texte à deux (D-105), les lignes à 64ch
            dépassaient 80 caractères — `impeccable`, line-length, cliquet #208. */}
        <p className="muted max-w-[56ch]">
          Les parties terminées sont gardées sous ton compte, solo comme à deux — la graine, les deux Decks, les types
          de café et le journal des coups — pour voir comment le jeu se joue et l’améliorer. Ni ton nom ni aucun texte
          libre n’est envoyé ; seul ton identifiant de compte relie la trace à toi (D-086, D-088, D-105).
        </p>
      </section>

      <section className="section panel">
        <h2>Données locales</h2>
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

      <section className="section panel">
        <h2>Confidentialité</h2>
        <p className="muted">
          Ce que le jeu garde de toi — un compte, ce que tu écris sur le mur, et le déroulé de tes parties :{' '}
          <Link to="/confidentialite">la page de confidentialité</Link>.
        </p>
      </section>

      <section className="section panel">
        <h2>Version</h2>
        <p className="muted">
          <strong className="settings__version">{APP_LABEL}</strong> — dis-moi ce libellé si quelque chose ne va pas :
          c’est lui qui dit quelle version tu as sous les yeux. Ce qu’elle contient, et ce que les précédentes ont
          changé, se lit sur <Link to="/feuille-de-route">la feuille de route</Link>.
        </p>
      </section>
    </div>
  );
}
