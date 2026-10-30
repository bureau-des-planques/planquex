/**
 * Le parcours de première connexion (#325, D-148) : pseudo, puis service, puis intitulé tiré
 * au sort, relançable une fois.
 *
 * L'étape vient du profil lu dans la base (`etapeDuProfil`), pas d'un compteur local : un
 * testeur qui recharge la page reprend là où il en était. Le service est figé dès qu'il est
 * validé, l'intitulé dès qu'il est enregistré ; le store refuse aussi la seconde relance.
 *
 * **Ce que l'écran doit à un humain** (revue du 30/10/2026) : une cible de doigt de 44 px et l'accent du jeu
 * sur les radios, le focus porté sur le titre à chaque changement d'étape (sinon il retombe sur
 * `<body>` et un lecteur d'écran ne sait pas qu'on a changé d'étape), `Entrée` qui valide
 * l'intitulé comme partout ailleurs, et des phrases qui disent **ce que le choix engage** —
 * le service ne change aucune règle (D-135), le pseudo suit le testeur sur le mur.
 */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { etapeDuProfil } from '@/lib/profil';
import { SERVICES, phraseProfil, tirerIntitule, type CodeService } from '@/game/intitule';
import { useProfil } from '@/store/profil';

/** Le titre de chaque étape : une étape, une phrase, et c'est le titre qui prend le focus. */
const TITRES = {
  pseudo: 'Ton pseudo',
  service: 'Ton service',
  intitule: 'Ton intitulé'
} as const;

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

  // Le focus suit l'étape : sans ça, valider une étape démonte le bouton et le focus retombe
  // sur `<body>` — un lecteur d'écran n'annonce alors ni « Étape 2 », ni le nouveau titre.
  const titre = useRef<HTMLHeadingElement>(null);
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    titre.current?.focus();
  }, [etape]);

  const envoyerPseudo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await creerPseudo(uid, pseudo);
  };

  const envoyerService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (service) await choisirService(uid, service);
  };

  // Le parcours est fini : Connexion montre le badge, puis renvoie vers le bureau ou l'attente.
  if (etape === 'fait') return null;

  const numero = etape === 'pseudo' ? 1 : etape === 'service' ? 2 : 3;
  const intitule = profil ? tirerIntitule(uid, profil.intitule_relances) : '';
  // Le tirage est **déterministe** : on sait d'avance ce que la relance donnerait. Sur huit
  // intitulés, une relance sur huit environ rend le même titre — la montrer pour la consommer
  // serait un piège, alors on ne la propose pas et on le dit.
  const suivant = profil ? tirerIntitule(uid, profil.intitule_relances + 1) : '';
  const relanceIdentique = profil !== null && profil.intitule_relances === 0 && suivant === intitule;
  const relancePossible = profil !== null && profil.intitule_relances === 0 && !relanceIdentique;

  const garder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await valider(uid, intitule);
  };

  return (
    <section className="section panel parcours" aria-labelledby="parcours-titre" data-etape={etape}>
      <div className="parcours__rail" aria-hidden="true">
        {[1, 2, 3].map((pas) => (
          <span key={pas} className={pas <= numero ? 'parcours__pas parcours__pas--fait' : 'parcours__pas'} />
        ))}
      </div>

      <h2 id="parcours-titre" ref={titre} tabIndex={-1}>
        {TITRES[etape]}
      </h2>
      <p className="parcours__etape m-0" role="status">
        Étape {numero} sur 3
      </p>

      {etape === 'pseudo' && (
        <form className="flex flex-col gap-3" onSubmit={envoyerPseudo}>
          <label className="field">
            <span className="field__label">Pseudo</span>
            <input
              type="text"
              maxLength={24}
              required
              value={pseudo}
              aria-describedby="parcours-pseudo-aide"
              onChange={(event) => setPseudo(event.target.value)}
            />
          </label>
          <p id="parcours-pseudo-aide" className="parcours__aide m-0">
            {pseudo.length} sur 24 caractères. Il te suivra sur le mur et dans tes traces de combat.
          </p>
          <div className="actions actions--tight">
            <button type="submit" className="button button--primary" disabled={chargement || !pseudo.trim()}>
              {chargement ? 'Patiente…' : 'Continuer'}
            </button>
          </div>
        </form>
      )}

      {etape === 'service' && profil && (
        <form className="flex flex-col gap-3" onSubmit={envoyerService}>
          <fieldset className="parcours__services">
            <legend className="field__label">Choisis ton service</legend>
            {SERVICES.map((option) => (
              <label key={option.code} className="parcours__service">
                <input
                  type="radio"
                  name="service"
                  value={option.code}
                  checked={service === option.code}
                  onChange={() => setService(option.code)}
                />
                <span className="parcours__service-texte">
                  <span className="parcours__service-nom">{option.libelle}</span>
                  <span className="parcours__service-dit">{option.dit}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="parcours__aide m-0">
            Ton service ne change aucune règle du jeu : il dit seulement d’où tu parles. Il est figé dès que tu le
            valides.
          </p>
          <div className="actions actions--tight">
            <button type="submit" className="button button--primary" disabled={chargement || !service}>
              {chargement ? 'Patiente…' : 'Valider mon service'}
            </button>
          </div>
        </form>
      )}

      {etape === 'intitule' && profil && (
        <form className="flex flex-col gap-3" onSubmit={garder}>
          <p className="m-0">
            Tiré au sort : <strong data-testid="intitule-tire">{intitule}</strong>
          </p>
          <p className="parcours__badge m-0" data-testid="apercu-profil">
            Ton profil : {phraseProfil({ pseudo: profil.pseudo, service: profil.service ?? '', intitule })}
          </p>
          <p className="parcours__aide m-0">
            {relanceIdentique
              ? 'Le sort s’acharne : ta relance donnerait le même titre. Celui-ci est donc le dernier.'
              : profil.intitule_relances === 0
                ? 'Tu peux le relancer une fois. Après, il est figé.'
                : 'Tu as relancé : cet intitulé est le dernier.'}
          </p>
          <div className="actions actions--tight">
            {relancePossible && (
              <button type="button" className="button" disabled={chargement} onClick={() => void relancer(uid)}>
                Essayer un autre titre
              </button>
            )}
            <button type="submit" className="button button--primary" disabled={chargement}>
              {chargement ? 'Patiente…' : 'Garder celui-là'}
            </button>
          </div>
        </form>
      )}

      {erreur && (
        <p className="notice notice--warn m-0" role="alert">
          {erreur}
        </p>
      )}
    </section>
  );
}
