import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { STORAGE_KEY, useStore } from '@/store/useStore';

export function Settings() {
  const { name, setName, reducedMotion, setReducedMotion, reset } = useStore();
  const [draft, setDraft] = useState(name);

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
        <h2>Données locales</h2>
        <p className="muted">
          Progression enregistrée dans le navigateur sous la clé <code>{STORAGE_KEY}</code>. Rien n’est envoyé à un serveur.
        </p>
        <button type="button" className="button" onClick={reset}>
          <RotateCcw size={16} /> Réinitialiser la progression
        </button>
      </section>
    </div>
  );
}
