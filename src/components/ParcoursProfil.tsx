/**
 * Le parcours de première connexion (#325, D-148) : pseudo, puis service, puis intitulé tiré
 * au sort, relançable une fois.
 *
 * L'étape vient du profil lu dans la base (`etapeDuProfil`), pas d'un compteur local : un
 * testeur qui recharge la page reprend là où il en était. Le service est figé dès qu'il est
 * validé, l'intitulé dès qu'il est enregistré ; le store refuse aussi la seconde relance.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { etapeDuProfil } from '@/lib/profil';
import { SERVICES, phraseProfil, tirerIntitule, type CodeService } from '@/game/intitule';
import { useProfil } from '@/store/profil';

export function ParcoursProfil({ uid }: { uid: string }) {
  const profil = useProfil((state) => state.profil);
  const chargement = useProfil((state) => state.chargement);
  const erreur = useProfil((state) => state.erreur);
  const creerPseudo = useProfil((state) => state.creerPseudo);
  const choisirService = useProfil((state) => state.choisirService);
  const relancer = useProfil((state) => state.relancer);
  const valider = useProfil((state) => state.valider);

  const [pseudo, setPseudo] = useState('');
  const [service, setService] = useState<CodeService | null>(null);
  const etape = etapeDuProfil(profil);

  const envoyerPseudo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await creerPseudo(uid, pseudo);
  };

  const envoyerService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (service) await choisirService(uid, service);
  };

  // Le parcours est fini : Connexion renvoie vers le bureau ou l'attente.
  if (etape === 'fait') return null;

  const numero = etape === 'pseudo' ? 1 : etape === 'service' ? 2 : 3;
  const intitule = profil ? tirerIntitule(uid, profil.intitule_relances) : '';

  return (
    <section className="section panel" aria-labelledby="parcours-titre" data-etape={etape}>
      <p className="m-0 text-[0.78rem] text-ink-dim">Étape {numero} sur 3</p>

      {etape === 'pseudo' && (
        <form className="flex flex-col gap-3" onSubmit={envoyerPseudo}>
          <h2 id="parcours-titre">Ton pseudo</h2>
          <label className="field">
            <span className="field__label">Pseudo (24 caractères au plus)</span>
            <input
              type="text"
              maxLength={24}
              required
              value={pseudo}
              onChange={(event) => setPseudo(event.target.value)}
            />
          </label>
          <div className="actions actions--tight">
            <button type="submit" className="button button--primary" disabled={chargement || !pseudo.trim()}>
              {chargement ? 'Patiente…' : 'Continuer'}
            </button>
          </div>
        </form>
      )}

      {etape === 'service' && profil && (
        <form className="flex flex-col gap-3" onSubmit={envoyerService}>
          <h2 id="parcours-titre">Ton service</h2>
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="field__label">Choisis ton groupe</legend>
            {SERVICES.map((option) => (
              <label key={option.code} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="service"
                  value={option.code}
                  checked={service === option.code}
                  onChange={() => setService(option.code)}
                />
                <span>{option.libelle}</span>
              </label>
            ))}
          </fieldset>
          <p className="muted m-0 text-[0.85rem]">Ton service est figé dès que tu le valides.</p>
          <div className="actions actions--tight">
            <button type="submit" className="button button--primary" disabled={chargement || !service}>
              {chargement ? 'Patiente…' : 'Valider mon service'}
            </button>
          </div>
        </form>
      )}

      {etape === 'intitule' && profil && (
        <div className="flex flex-col gap-3">
          <h2 id="parcours-titre">Ton intitulé</h2>
          <p className="m-0">
            Tiré au sort : <strong data-testid="intitule-tire">{intitule}</strong>
          </p>
          <p className="muted m-0 text-[0.85rem]" data-testid="apercu-profil">
            Ton profil : {phraseProfil({ pseudo: profil.pseudo, service: profil.service ?? '', intitule })}
          </p>
          {profil.intitule_relances === 0 ? (
            <p className="muted m-0 text-[0.85rem]">Tu peux le relancer une fois. Après, il est figé.</p>
          ) : (
            <p className="muted m-0 text-[0.85rem]">Tu as relancé : cet intitulé est le dernier.</p>
          )}
          <div className="actions actions--tight">
            {profil.intitule_relances === 0 && (
              <button type="button" className="button" disabled={chargement} onClick={() => void relancer(uid)}>
                Relancer une fois
              </button>
            )}
            <button
              type="button"
              className="button button--primary"
              disabled={chargement}
              onClick={() => void valider(uid, intitule)}
            >
              {chargement ? 'Patiente…' : 'Garder cet intitulé'}
            </button>
          </div>
        </div>
      )}

      {erreur && (
        <p className="notice notice--warn m-0" role="alert">
          {erreur}
        </p>
      )}
    </section>
  );
}
