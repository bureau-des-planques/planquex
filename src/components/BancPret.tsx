import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { lireEnvironnement, situationDInstallation, type Environnement } from '@/lib/installation';
import { capteurInvite, type CapteurInvite, type ResultatInstallation } from '@/lib/invite-installation';

/**
 * **Le module « Banc prêt »** — le haut de `/installation` : le bouton « Installer le jeu »,
 * ou ce qui le remplace quand l'appareil ne le permet pas.
 *
 * C'est la page où **la vitrine** (`planquex-site`, dossier frère) envoie ses visiteurs : la
 * vitrine n'a ni le manifeste ni le service worker du jeu, elle ne peut donc rien installer.
 * L'installation se fait ici, sur l'adresse du jeu.
 *
 * Cinq situations (`src/lib/installation.ts` dit lesquelles, et dans quel ordre) :
 *
 * - **invite** (Chrome, Edge, Brave, Samsung Internet) — un bouton rejoue l'invite du
 *   navigateur, captée au démarrage par `main.tsx` ;
 * - **ios** — Safari n'a pas d'invite : on renvoie vers les gestes de la page, et on prévient
 *   que l'icône **ne partage pas les données de Safari** (`docs/DISTRIBUTION.md` §3) ;
 * - **messagerie** — rien ne s'installe dans le navigateur d'une messagerie : on propose de
 *   copier le lien, pour le rouvrir dans Chrome ou Safari ;
 * - **installe** — déjà dans l'application, ou installation tout juste acceptée ;
 * - **manuel** — le reste : les étapes de la page, par le menu du navigateur.
 *
 * Les **étapes appareil par appareil restent affichées** sous ce module, quelle que soit la
 * situation : la reconnaissance de l'appareil est une heuristique, elle ne cache rien.
 *
 * Trois coutures, pour les tests : le capteur, l'environnement, le presse-papiers.
 */

const copierDansLePressePapiers = async (texte: string): Promise<void> => {
  if (!navigator.clipboard) throw new Error('Presse-papiers indisponible');
  await navigator.clipboard.writeText(texte);
};

type Copie = 'aucune' | 'faite' | 'refusee';

export function BancPret({
  lien,
  capteur = capteurInvite(),
  environnement,
  copier = copierDansLePressePapiers
}: {
  /** L'adresse à rouvrir dans un vrai navigateur (cas de la messagerie). */
  lien: string;
  capteur?: CapteurInvite;
  environnement?: Environnement;
  copier?: (texte: string) => Promise<void>;
}) {
  const [env] = useState(() => environnement ?? lireEnvironnement());
  const invite = useSyncExternalStore(capteur.abonner, capteur.etat);
  const [resultat, setResultat] = useState<ResultatInstallation | null>(null);
  const [copie, setCopie] = useState<Copie>('aucune');

  const situation = situationDInstallation(env, invite);

  const installer = async () => {
    setResultat(await capteur.installer());
  };

  const copierLeLien = async () => {
    try {
      await copier(lien);
      setCopie('faite');
    } catch {
      setCopie('refusee');
    }
  };

  return (
    <section className="section panel" aria-label="Banc prêt">
      <p className="m-0 font-mono text-[0.75rem] font-semibold tracking-[0.16em] text-[var(--gold-soft)] uppercase">
        Banc prêt
      </p>

      {situation === 'invite' && (
        <>
          <h2 className="m-0">Installer en un geste</h2>
          <p className="muted m-0 max-w-[62ch]">
            Ton navigateur sait installer le jeu : l’icône Planquex rejoint tes applications, et le jeu s’ouvre dans sa
            propre fenêtre, sans la barre du navigateur.
          </p>
          <div>
            <button type="button" className="button button--gold button--big" onClick={() => void installer()}>
              Installer le jeu
            </button>
          </div>
        </>
      )}

      {situation === 'installe' && !env.standalone && (
        <>
          <h2 className="m-0">C’est installé</h2>
          <p className="m-0 max-w-[62ch]">
            L’icône Planquex est sur ton écran d’accueil : ouvre le jeu depuis là, il démarre dans sa propre fenêtre.
          </p>
        </>
      )}

      {situation === 'installe' && env.standalone && (
        <>
          <h2 className="m-0">Tu es déjà dans l’application</h2>
          <p className="muted m-0 max-w-[62ch]">
            Le jeu est installé sur cet appareil. <Link to="/">Retour au bureau</Link>
          </p>
        </>
      )}

      {situation === 'ios' && (
        <>
          <h2 className="m-0">Sur iPhone et iPad, l’ajout se fait dans Safari</h2>
          <p className="muted m-0 max-w-[62ch]">
            Safari n’a pas de bouton d’installation : suis les gestes « Sur iPhone et iPad », plus bas.
          </p>
          <p className="notice notice--warn max-w-[62ch]">
            Ajoute l’icône avant ta première partie : sur iPhone, l’application de l’écran d’accueil ne partage pas les
            données de Safari. Une Collection commencée dans Safari ne la suit pas.
          </p>
        </>
      )}

      {situation === 'messagerie' && (
        <>
          <h2 className="m-0">Ouvre ce lien dans ton navigateur</h2>
          <p className="m-0 max-w-[62ch]">
            Ce lien s’est ouvert dans une messagerie, où l’on ne peut rien installer. Ouvre-le dans Chrome ou dans
            Safari.
          </p>
          <div>
            <button type="button" className="button button--gold button--big" onClick={() => void copierLeLien()}>
              Copier le lien
            </button>
          </div>
          {copie === 'faite' && (
            <p className="notice notice--ok" role="status">
              Lien copié : colle-le dans la barre d’adresse de ton navigateur.
            </p>
          )}
          {copie === 'refusee' && (
            <p className="notice notice--warn" role="status">
              Copie impossible ici. Recopie l’adresse à la main : {lien}
            </p>
          )}
        </>
      )}

      {situation === 'manuel' && (
        <>
          <h2 className="m-0">Installer depuis le menu du navigateur</h2>
          <p className="muted m-0 max-w-[62ch]">
            Ton navigateur ne propose pas d’installation en un geste ici. Suis les étapes de ton appareil ci-dessous ;
            si le jeu est déjà installé, ouvre-le depuis ton écran d’accueil.
          </p>
          {resultat === 'dismissed' && (
            <p className="notice" role="status">
              Installation annulée. Tu pourras la relancer plus tard depuis le menu de ton navigateur.
            </p>
          )}
          {resultat === 'indisponible' && (
            <p className="notice notice--warn" role="status">
              Le navigateur n’a pas ouvert l’installation : passe par son menu, avec les étapes ci-dessous.
            </p>
          )}
        </>
      )}
    </section>
  );
}
