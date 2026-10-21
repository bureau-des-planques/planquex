import { useState } from 'react';
import { ClipboardPaste, Copy, RotateCcw } from 'lucide-react';
import { STORAGE_KEY, useStore } from '@/store/useStore';
import { APP_STAGE, APP_VERSION_LABEL } from '@/version';

/** L'étape se déduit du numéro de version — elle ne se saisit pas (D-048). */
const STAGE_LABELS = {
  alpha: 'alpha',
  beta: 'bêta',
  release: 'version finale'
} as const;

export function Settings() {
  const { name, setName, reducedMotion, setReducedMotion, reset, setTutorielVu } = useStore();
  const exporterSauvegarde = useStore((state) => state.exporterSauvegarde);
  const importerSauvegarde = useStore((state) => state.importerSauvegarde);
  const [draft, setDraft] = useState(name);
  const [sauvegarde, setSauvegarde] = useState('');
  const [message, setMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);

  const creerSauvegarde = () => {
    const texte = exporterSauvegarde();
    setSauvegarde(texte);
    // Le presse-papier peut être refusé (contexte non sécurisé, permission) : le texte
    // reste dans la zone, il suffit de le sélectionner. On ne ment pas dans le message.
    navigator.clipboard?.writeText(texte).then(
      () => setMessage({ ton: 'ok', texte: 'Sauvegarde copiée. Colle-la dans un fichier ou un message : c’est ta seule copie.' }),
      () => setMessage({ ton: 'ok', texte: 'Sauvegarde prête ci-dessus — recopie-la à la main.' })
    );
  };

  const restaurerSauvegarde = () => {
    const resultat = importerSauvegarde(sauvegarde);
    setMessage(
      resultat.ok
        ? { ton: 'ok', texte: 'Sauvegarde restaurée : ton Parc et ton Chariot sont revenus.' }
        : { ton: 'ko', texte: resultat.raison }
    );
  };

  return (
    <div className="page settings">
      <section className="section__head">
        <div>
          <p className="eyebrow">Réglages</p>
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
        <h2>Affichage</h2>
        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          <span>Réduire les animations</span>
        </label>
      </section>

      <section className="section panel">
        <h2>Journée d’intégration</h2>
        <p className="muted">Les quatre gestes de la première partie, à revoir quand tu veux.</p>
        <button type="button" className="button" onClick={() => setTutorielVu(false)}>
          Revoir la journée d’intégration
        </button>
      </section>

      <section className="section panel">
        <h2>Sauvegarde</h2>
        <p className="muted">
          Ta progression vit dans ce navigateur sous la clé <code>{STORAGE_KEY}</code> : rien n’est
          envoyé à un serveur, et **vider les données du navigateur l’efface**. Copie ce texte
          quelque part avant, il contient tout — Parc, Chariot, nom.
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
          <button
            type="button"
            className="button"
            onClick={restaurerSauvegarde}
            disabled={!sauvegarde.trim()}
          >
            <ClipboardPaste size={16} /> Restaurer ce texte
          </button>
        </div>
        {message && (
          <p className={message.ton === 'ok' ? 'muted' : 'muted settings__message--ko'}>
            {message.texte}
          </p>
        )}
      </section>

      <section className="section panel">
        <h2>Données locales</h2>
        <button type="button" className="button" onClick={reset}>
          <RotateCcw size={16} /> Réinitialiser la progression
        </button>
      </section>

      <section className="section panel">
        <h2>Version</h2>
        <p className="muted">
          <code>{APP_VERSION_LABEL}</code> · {STAGE_LABELS[APP_STAGE]} — dis-moi ce numéro si
          quelque chose ne va pas : c’est lui qui dit quelle version tu as sous les yeux.
        </p>
      </section>
    </div>
  );
}
