import { useState, useSyncExternalStore } from 'react';
import { Lock } from 'lucide-react';
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
 * - **application** — la page tourne déjà dans la fenêtre de l'application ;
 * - **installe** — l'installation vient d'être faite : on dit où est passée l'icône ;
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
  /** La fenêtre du navigateur est ouverte : l'invite est consommée, la réponse pas encore là. */
  const [enAttente, setEnAttente] = useState(false);
  /** Le premier geste arme ; rien ne part tant que le second ne l'a pas lancé. */
  const [arme, setArme] = useState(false);

  const situation = situationDInstallation(env, invite);

  const installer = async () => {
    setEnAttente(true);
    const reponse = await capteur.installer();
    setEnAttente(false);
    setResultat(reponse);
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
      <p className="eyebrow text-gold-soft">Banc prêt</p>

      {situation === 'invite' && !enAttente && (
        <>
          <h2 className="m-0">Installer en un geste</h2>
          <p className="muted m-0 max-w-[62ch]">
            L’icône Planquex rejoint tes applications et ouvre le jeu sans la barre du navigateur.
          </p>
          {arme ? (
            <div className="actions actions--tight">
              <button
                type="button"
                className="button button--big button--tir"
                onClick={() => {
                  setArme(false);
                  void installer();
                }}
              >
                Lancer l’installation
              </button>
              <button type="button" className="button" onClick={() => setArme(false)}>
                Désarmer
              </button>
            </div>
          ) : (
            <div>
              <button type="button" className="button button--big button--prearm" onClick={() => setArme(true)}>
                <Lock size={18} aria-hidden="true" /> Préarmer
              </button>
            </div>
          )}
        </>
      )}

      {enAttente && (
        <>
          <h2 className="m-0">Confirme dans la fenêtre du navigateur</h2>
          <p className="muted m-0 max-w-[62ch]" role="status">
            Ton navigateur te demande de confirmer l’installation.
          </p>
        </>
      )}

      {situation === 'installe' && (
        <>
          <h2 className="m-0">C’est installé</h2>
          <p className="m-0 max-w-[62ch]">
            L’icône Planquex est avec tes applications : sur ton écran d’accueil au téléphone, dans le menu des
            applications ou le Dock sur ordinateur. Ouvre le jeu depuis là, il démarre dans sa propre fenêtre.
          </p>
        </>
      )}

      {situation === 'application' && (
        <>
          <h2 className="m-0">Tu es déjà dans l’application</h2>
          <p className="muted m-0 max-w-[62ch]">Le jeu est installé sur cet appareil : il n’y a plus rien à faire.</p>
        </>
      )}

      {situation === 'ios' && (
        <>
          <h2 className="m-0">Sur iPhone et iPad, l’ajout se fait dans Safari</h2>
          <p className="muted m-0 max-w-[62ch]">
            Safari n’a pas de bouton d’installation : suis les gestes « Sur iPhone et iPad », plus bas.
          </p>
          <p className="notice notice--warn max-w-[62ch]">
            Ajoute l’icône avant ta première partie : sur iPhone et iPad, l’application de l’écran d’accueil ne partage
            pas les données de Safari. Une Collection commencée dans Safari ne la suit pas.
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

      {situation === 'manuel' && !enAttente && (
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
