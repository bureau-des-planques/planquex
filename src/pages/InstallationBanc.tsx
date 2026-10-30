/**
 * **Le banc d'installation** — la page `/installation` (#504), branchée dans `src/App.tsx`
 * (chargée à la demande, hors du `Layout`).
 *
 * Il ne lit ni le store, ni le mur, ni le réseau : c'est du rendu pur, plus trois coutures
 * de test (l'environnement, le capteur d'invite, le mouvement réduit).
 *
 * Trois règles d'écriture, reprises de `src/pages/Installation.tsx` :
 *
 * 1. **on reprend les faits déjà écrits, on n'en invente pas** : l'adresse vient de
 *    `ADRESSE`, les gestes d'iPhone viennent de `PROCEDURES` ; l'invite d'installation
 *    vient de `src/lib/invite-installation.ts` (le capteur est posé par `main.tsx`) ;
 * 2. **on dit ce qu'on n'a pas testé** : les durées d'allumage, le lien `intent://` et
 *    l'invite `beforeinstallprompt` n'ont pas été vus sur un vrai téléphone — la page le
 *    dit, au lieu de le promettre ;
 * 3. **la page porte sa date de vérification** (`VERIFIE_LE`), affichée en français.
 *
 * Ce que la page ne fait pas : elle n'appelle pas `getInstalledRelatedApps` (le mode
 * installé se lit par `display-mode: standalone` et `navigator.standalone`, déjà dans
 * `lireEnvironnement`), et elle n'ajoute aucune animation CSS : l'allumage est une suite
 * de lignes de terminal, celle que `.terminal` anime déjà.
 *
 * Quand le jeu tourne **déjà dans son application** (`env.standalone`), la page ne propose
 * rien : à la fin de l'allumage court elle navigue d'elle-même vers `/`, sans bouton
 * « Ouvrir le jeu » (#504). Le mouvement réduit garde la même règle, sans la durée.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RetourEcran } from '@/components/RetourEcran';
import { ADRESSE, PROCEDURES } from '@/pages/Installation';
import { estIOS, estMessagerie, lireEnvironnement, type Environnement } from '@/lib/installation';
import { capteurInvite, type CapteurInvite, type ResultatInstallation } from '@/lib/invite-installation';

/**
 * La date de la dernière relecture, au format ISO. À bouger quand les étapes ont été
 * revérifiées sur un vrai appareil.
 */
export const VERIFIE_LE = '2026-10-29';

/** L'allumage complet, avant la proposition d'installation. */
export const DUREE_ALLUMAGE_COMPLET = 1800;

/** L'allumage court, quand le jeu tourne déjà dans son application (≈ 0,8 s). */
export const DUREE_ALLUMAGE_COURT = 800;

/** Les lignes de la mise sous tension, révélées une à une. */
const LIGNES_ALLUMAGE: readonly string[] = [
  'Alimentation du poste : ok.',
  'Contrôle du mobilier : ok.',
  'Chargement des Planqués…',
  'Banc prêt.'
];

const LIGNES_ALLUMAGE_COURT: readonly string[] = ['Reprise du poste…', 'Banc prêt.'];

/** L'adresse du jeu, avec son schéma, pour un lien ou une intention Android. */
const LIEN_JEU = `https://${ADRESSE}/`;

/** Chromium : Chrome, Edge et Brave partagent le moteur qui envoie `beforeinstallprompt`. */
function estChromium(userAgent: string): boolean {
  return /(?:Chrome|Chromium)\//.test(userAgent);
}

/** Android porte le schéma `intent://`, qui rouvre le lien dans Chrome. */
function estAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/** L'intention Android : ouvrir le lien dans Chrome, avec un repli sur le navigateur. */
function intentionAndroid(adresse: string): string {
  const repli = encodeURIComponent(`https://${adresse}/`);
  return `intent://${adresse}/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${repli};end`;
}

/** `prefers-reduced-motion`, lu une fois au montage. */
function mouvementReduit(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface InstallationBancProps {
  /** Ce que la page lit du navigateur. Par défaut, le vrai environnement. */
  environnement?: Environnement;
  /** La couture de l'invite (`beforeinstallprompt`). Par défaut, le capteur du jeu. */
  capteur?: CapteurInvite;
  /** Force le mouvement réduit. Par défaut, la préférence du système. */
  reduireMouvement?: boolean;
  /** Durée de l'allumage complet, en millisecondes. */
  dureeAllumage?: number;
  /** Durée de l'allumage court (application déjà installée), en millisecondes. */
  dureeCourte?: number;
}

export default function InstallationBanc({
  environnement,
  capteur = capteurInvite(),
  reduireMouvement,
  dureeAllumage = DUREE_ALLUMAGE_COMPLET,
  dureeCourte = DUREE_ALLUMAGE_COURT
}: InstallationBancProps = {}) {
  const [env] = useState(() => environnement ?? lireEnvironnement());
  const [reduit] = useState(() => reduireMouvement ?? mouvementReduit());
  const naviguer = useNavigate();
  const invite = useSyncExternalStore(capteur.abonner, capteur.etat);
  const [resultat, setResultat] = useState<ResultatInstallation | null>(null);
  const [enAttente, setEnAttente] = useState(false);

  const dejaInstalle = env.standalone;
  const duree = dejaInstalle ? dureeCourte : dureeAllumage;
  const animer = !reduit && duree > 0;

  const [allume, setAllume] = useState(!animer);
  const [lignes, setLignes] = useState(0);

  useEffect(() => {
    if (!animer) return;
    const texte = dejaInstalle ? LIGNES_ALLUMAGE_COURT : LIGNES_ALLUMAGE;
    const pas = Math.max(1, Math.round(duree / texte.length));
    const intervalle = window.setInterval(() => {
      setLignes((nombre) => Math.min(nombre + 1, texte.length));
    }, pas);
    const fin = window.setTimeout(() => setAllume(true), duree);
    return () => {
      window.clearInterval(intervalle);
      window.clearTimeout(fin);
    };
  }, [animer, duree, dejaInstalle]);

  // Le jeu tourne déjà dans son application : l'allumage court le rouvre tout seul, sans
  // bouton. Avec le mouvement réduit, `allume` vaut vrai dès le montage : l'ouverture est
  // immédiate, la même règle passant simplement sous la durée.
  useEffect(() => {
    if (!dejaInstalle || !allume) return;
    naviguer('/', { replace: true });
  }, [dejaInstalle, allume, naviguer]);

  const installer = async () => {
    setEnAttente(true);
    const reponse = await capteur.installer();
    setEnAttente(false);
    setResultat(reponse);
  };

  const verifieLe = new Date(`${VERIFIE_LE}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });

  if (!allume) {
    const texte = dejaInstalle ? LIGNES_ALLUMAGE_COURT : LIGNES_ALLUMAGE;
    return (
      <div className="page page--nue installation">
        <RetourEcran vers="/" libelle="Retour au bureau" />
        <section className="section panel" aria-busy="true" aria-live="polite">
          <p className="eyebrow text-gold-soft">Mise sous tension</p>
          <h1 className="m-0 font-heading text-[1.5rem] font-bold">Le banc s’allume</h1>
          <div className="terminal" role="log" aria-label="Mise sous tension">
            {texte.slice(0, lignes).map((ligne) => (
              <p key={ligne} className="m-0">
                {ligne}
              </p>
            ))}
            <p className="m-0">
              <span className="terminal__curseur" aria-hidden="true" />
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page page--nue installation">
      <RetourEcran vers="/" libelle="Retour au bureau" />

      <section className="section panel">
        <h1 className="m-0 font-heading text-[1.5rem] font-bold">Installer le jeu</h1>
        <p className="muted m-0 max-w-[62ch]">
          Le Bureau des Planqués est un site : il n’y a rien à télécharger. Garde l’adresse{' '}
          <code className="settings__version">{ADRESSE}</code>. L’installation ajoute seulement l’icône à ton écran
          d’accueil ou à ton Dock.
        </p>
      </section>

      {dejaInstalle && (
        <section className="section panel" aria-label="Application déjà installée">
          <p className="eyebrow text-gold-soft">Banc prêt</p>
          <h2 className="m-0">Tu es déjà dans l’application</h2>
          <p className="muted m-0 max-w-[62ch]">Le jeu est installé sur cet appareil : le bureau s’ouvre tout seul.</p>
          <p className="notice" role="status">
            Ouverture du jeu en cours…
          </p>
        </section>
      )}

      {!dejaInstalle && estMessagerie(env.userAgent) && (
        <section className="section panel" aria-label="Application embarquée">
          <p className="eyebrow text-gold-soft">Navigateur d’une application</p>
          <h2 className="m-0">Ouvre le jeu dans ton navigateur</h2>
          <p className="m-0 max-w-[62ch]">
            Ce lien s’est ouvert dans l’application d’une messagerie, où l’on ne peut rien installer. Rouvre-le dans
            Chrome ou dans Safari pour avoir le bouton d’installation.
          </p>
          {estAndroid(env.userAgent) ? (
            <div>
              <a className="button button--gold button--big" href={intentionAndroid(ADRESSE)}>
                Ouvrir dans le navigateur
              </a>
            </div>
          ) : estIOS(env) ? (
            <p className="notice notice--warn max-w-[62ch]">
              Ouvre cette adresse dans Safari : <code className="settings__version">{ADRESSE}</code>.
            </p>
          ) : (
            <div>
              <a className="button button--gold button--big" href={LIEN_JEU} target="_blank" rel="noreferrer noopener">
                Ouvrir dans le navigateur
              </a>
            </div>
          )}
        </section>
      )}

      {!dejaInstalle && !estMessagerie(env.userAgent) && estIOS(env) && (
        <section className="section panel" aria-label="iPhone et iPad">
          <p className="eyebrow text-gold-soft">iPhone et iPad</p>
          <h2 className="m-0">L’ajout se fait dans Safari</h2>
          <p className="muted m-0 max-w-[62ch]">
            Safari n’a pas de bouton d’installation. Suis ces gestes, dans l’ordre :
          </p>
          <ol
            aria-label={PROCEDURES[0]!.titre}
            className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed"
          >
            {PROCEDURES[0]!.etapes.map((etape) => (
              <li key={etape}>{etape}</li>
            ))}
          </ol>
        </section>
      )}

      {!dejaInstalle && !estMessagerie(env.userAgent) && !estIOS(env) && estChromium(env.userAgent) && (
        <section className="section panel" aria-label="Installer le jeu">
          <p className="eyebrow text-gold-soft">Chrome, Edge, Brave</p>
          <h2 className="m-0">Installer en un geste</h2>
          <p className="muted m-0 max-w-[62ch]">
            L’icône Planquex rejoint tes applications et ouvre le jeu sans la barre du navigateur.
          </p>
          {invite.disponible ? (
            <div>
              <button
                type="button"
                className="button button--gold button--big"
                disabled={enAttente}
                onClick={() => void installer()}
              >
                {enAttente ? 'Installation en cours…' : 'Installer le jeu'}
              </button>
            </div>
          ) : (
            <p className="muted m-0 max-w-[62ch]">
              Le navigateur n’a pas encore proposé l’installation. Tu peux l’installer depuis son menu, ou jouer sans
              installer.
            </p>
          )}
          {resultat === 'accepted' && (
            <p className="notice notice--ok" role="status">
              L’application est installée : son icône est avec tes autres applications.
            </p>
          )}
          {resultat === 'dismissed' && (
            <p className="notice" role="status">
              Installation annulée. Tu pourras la relancer plus tard depuis le menu de ton navigateur.
            </p>
          )}
          {resultat === 'indisponible' && (
            <p className="notice notice--warn" role="status">
              Le navigateur n’a pas ouvert l’installation : passe par son menu.
            </p>
          )}
        </section>
      )}

      {!dejaInstalle && !estMessagerie(env.userAgent) && !estIOS(env) && !estChromium(env.userAgent) && (
        <section className="section panel" aria-label="Autre navigateur">
          <p className="eyebrow text-gold-soft">Ce navigateur</p>
          <h2 className="m-0">Le jeu s’ouvre, l’installation n’est pas proposée</h2>
          <p className="muted m-0 max-w-[62ch]">
            Ce navigateur ne propose pas l’installation en un geste, et nous ne l’avons pas testé. Le jeu marche quand
            même : garde l’adresse en favori.
          </p>
        </section>
      )}

      <section className="section panel">
        <p className="muted m-0 text-[0.82rem]">
          <Link to="/">Jouer dans le navigateur</Link> — sans rien installer.
        </p>
        <p className="muted m-0 text-[0.76rem]">
          Cette page a été vérifiée le {verifieLe}. L’allumage, l’invite d’installation et le lien Android n’ont pas
          encore été essayés sur un vrai téléphone.
        </p>
      </section>
    </div>
  );
}
