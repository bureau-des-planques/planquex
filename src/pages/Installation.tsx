/**
 * **Le guide d'installation et de compatibilité** — public, et **hors de la garde des
 * comptes** (#300).
 *
 * La note de release y renvoie, et un testeur doit pouvoir le lire **avant** de créer un
 * compte : la route est donc déclarée avant le `Layout`, comme `/feuille-de-route` et
 * `/confidentialite`. Derrière la garde, elle renverrait à `/connexion` au lieu de
 * répondre.
 *
 * Trois règles d'écriture :
 *
 * 1. **on reprend les faits déjà écrits, on n'en invente pas** : la sauvegarde par
 *    Réglages et la règle des données locales viennent de `docs/ALPHA-TESTEURS.md` ; les
 *    contraintes d'installation viennent de `docs/DISTRIBUTION.md` §3 (Safari iOS :
 *    ajout manuel) et de D-054 (Chromium) ;
 * 2. **on dit ce qu'on n'a pas testé** : Firefox et les autres navigateurs ne portent
 *    aucune procédure inventée — le jeu s'y ouvre, l'installation n'est pas promise ;
 * 3. **la page porte sa date de vérification** : elle est revue à chaque release, et au
 *    plus tard à chaque changement d'étape (`VERIFIE_LE`).
 *
 * **Le module « Banc prêt »** (`BancPret`) ouvre la page, sous l'introduction : le bouton
 * « Installer le jeu » quand le navigateur le permet, sinon l'aide qui le remplace (iPhone,
 * navigateur d'une messagerie, application déjà installée). C'est ici que **la vitrine**
 * (`planquex-site`, dossier frère) envoie ses visiteurs, parce que seule l'adresse du jeu
 * peut installer le jeu. Les procédures restent affichées en dessous, dans tous les cas.
 *
 * Le libellé d'un menu change avec la version du navigateur : on décrit le **chemin**, pas
 * une capture qui vieillit. Des captures servent à juger le rendu de cette page
 * (`npm run capturer`), pas à guider un doigt.
 */
import { Link } from 'react-router-dom';
import { BancPret } from '@/components/BancPret';
import { RetourEcran } from '@/components/RetourEcran';

/**
 * L'adresse servie en production (D-071), **sans** le schéma : on l'affiche comme on la
 * lit dans la barre d'adresse. `src/pages/Installation.test.tsx` la compare à
 * `docs/ALPHA-TESTEURS.md` — deux adresses divergentes enverraient le testeur ailleurs.
 */
export const ADRESSE = 'planquex.4k7.org';

/**
 * La date de la dernière relecture, au format ISO. La page l'affiche en français, et le
 * test garde le format. À bouger quand on revérifie les étapes sur un vrai appareil.
 */
export const VERIFIE_LE = '2026-10-27';

interface Procedure {
  /** Le titre de la section, qui nomme aussi la liste ordonnée. */
  titre: string;
  /** Le navigateur concerné, en une ligne. */
  navigateur: string;
  etapes: readonly string[];
}

/**
 * Les **trois** appareils retenus pour l'alpha. Chaque étape est un geste, dans l'ordre :
 * une liste à puces ne dirait pas dans quel ordre toucher.
 */
export const PROCEDURES: readonly Procedure[] = [
  {
    titre: 'Sur iPhone et iPad',
    navigateur: 'Safari',
    etapes: [
      'Ouvre l’adresse du jeu dans Safari.',
      'Touche le bouton Partager (le carré avec une flèche).',
      'Choisis « Sur l’écran d’accueil ».',
      'Touche « Ajouter » : l’icône Planquex apparaît avec tes autres applications.'
    ]
  },
  {
    titre: 'Sur Android',
    navigateur: 'Chrome',
    etapes: [
      'Ouvre l’adresse du jeu dans Chrome.',
      'Touche le menu ⋮, en haut à droite.',
      'Choisis « Installer l’application », ou « Ajouter à l’écran d’accueil » selon la version.',
      'Confirme : l’icône Planquex apparaît avec tes autres applications.'
    ]
  },
  {
    titre: 'Sur ordinateur',
    navigateur: 'Chrome, Edge ou Brave ; Safari sur Mac',
    etapes: [
      'Ouvre l’adresse du jeu dans ton navigateur.',
      'Dans Chrome, Edge ou Brave, touche l’icône d’installation dans la barre d’adresse — ou ouvre le menu, puis « Installer Planquex ».',
      'Dans Safari sur Mac, ouvre le menu Fichier, puis « Ajouter au Dock ».',
      'Le jeu s’ouvre alors dans sa propre fenêtre, sans la barre du navigateur.'
    ]
  }
];

/** Les étapes de la sauvegarde, reprises de `docs/ALPHA-TESTEURS.md` et de Réglages. */
const SAUVEGARDE: readonly string[] = [
  'Dans le jeu, ouvre Réglages.',
  'Touche « Créer ma sauvegarde » : le texte apparaît dans la zone.',
  'Copie ce texte et garde-le hors du navigateur : une note, un message à toi-même.',
  'Pour revenir : colle-le dans la même zone, puis touche « Restaurer ce texte ».'
];

/** Les moments où la sauvegarde est le seul moyen de ne pas perdre sa Collection. */
const AVANT: readonly string[] = [
  'Changer d’appareil ou de navigateur.',
  'Vider les données du navigateur.',
  'Désinstaller l’application.'
];

export function Installation() {
  const verifieLe = new Date(`${VERIFIE_LE}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });

  return (
    <div className="page installation">
      <RetourEcran vers="/" libelle="Retour au bureau" />
      <section className="section panel">
        <h1 className="m-0 font-heading text-[1.5rem] font-bold">Installer le jeu</h1>
        <p className="muted m-0 max-w-[62ch]">
          Le Bureau des Planqués est un site : il n’y a rien à télécharger. Garde l’adresse{' '}
          <code className="settings__version">{ADRESSE}</code>. Si tu veux l’icône sur ton écran d’accueil, suis les
          étapes de ton appareil. Le jeu marche aussi sans installation.
        </p>
      </section>

      <BancPret lien={`https://${ADRESSE}/installation`} />

      <section className="section panel">
        <h2 className="m-0">Les navigateurs retenus</h2>
        <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
          <li>
            <strong>Chrome, Edge, Brave</strong> — ordinateur et Android. Retenus : l’installation y est proposée.
          </li>
          <li>
            <strong>Safari</strong> — iPhone, iPad et Mac. Retenu : l’ajout à l’écran d’accueil se fait à la main,
            Safari n’a pas de bouton d’installation.
          </li>
          <li>
            <strong>Firefox et les autres</strong> — le jeu s’y ouvre, mais nous ne l’avons pas testé : l’installation
            n’est pas garantie.
          </li>
        </ul>
        <p className="muted m-0 max-w-[62ch] text-[0.86rem]">
          Un navigateur à jour suffit. Il n’y a ni magasin d’applications, ni fichier à installer, et les libellés des
          menus changent avec la version de ton navigateur.
        </p>
      </section>

      <section className="section">
        <h2>L’installation, appareil par appareil</h2>
        <div className="feuille-de-route__liste">
          {PROCEDURES.map((procedure) => (
            <article key={procedure.titre} className="panel feuille-de-route__note">
              <h2 className="feuille-de-route__titre">{procedure.titre}</h2>
              <p className="muted m-0 text-[0.86rem]">{procedure.navigateur}</p>
              <ol
                aria-label={procedure.titre}
                className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed"
              >
                {procedure.etapes.map((etape) => (
                  <li key={etape}>{etape}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="section panel">
        <h2 className="m-0">Ce qui est gardé, et où</h2>
        <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
          <li>
            <strong>Sur ton appareil</strong> : ton pseudo et ta partie en cours. Rien de cela ne part sur un serveur.
          </li>
          <li>
            <strong>Sur le serveur du jeu</strong> : ton compte, ce que tu écris sur le mur, le déroulé de tes combats
            terminés, et bientôt ton Deck et ta Collection.
          </li>
          <li>
            <strong>Ton compte te suit</strong> d’un appareil à l’autre ; bientôt, ton Deck et ta Collection aussi.
          </li>
        </ul>
        <p className="muted m-0 max-w-[62ch] text-[0.86rem]">
          Le détail de ce qui est gardé est sur <Link to="/confidentialite">la page Confidentialité</Link>, et ce que
          chaque version apporte sur <Link to="/feuille-de-route">la feuille de route</Link>. Les deux se lisent sans
          compte.
        </p>
      </section>

      <section className="section panel">
        <h2 className="m-0">Ta sauvegarde, avant de changer d’appareil</h2>
        <p className="m-0 max-w-[62ch] text-[0.92rem] leading-relaxed">
          Changer d’appareil ou de navigateur, vider les données, désinstaller l’application : dans ces trois cas, la
          Collection, le Deck, ton pseudo et ta partie en cours sont effacés de ce navigateur, sans retour. Bientôt, ton
          Deck et ta Collection seront stockés sur ton compte : tu les retrouveras après un changement d’appareil.
        </p>
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
          {SAUVEGARDE.map((etape) => (
            <li key={etape}>{etape}</li>
          ))}
        </ol>
        <p className="m-0 max-w-[62ch] text-[0.92rem] leading-relaxed">
          <strong>Fais-la avant de</strong> :{' '}
          {AVANT.map((moment, index) => (
            <span key={moment}>
              {index > 0 ? (index === AVANT.length - 1 ? ' ou ' : ', ') : ''}
              {moment.charAt(0).toLowerCase() + moment.slice(1)}
            </span>
          ))}
        </p>
      </section>

      <section className="section panel">
        <h2 className="m-0">Si l’installation ne s’affiche pas</h2>
        <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
          <li>Vérifie que tu es bien sur l’adresse du jeu, en https, et que le navigateur est à jour.</li>
          <li>Recharge la page, puis rouvre le menu.</li>
          <li>Tu peux jouer sans installer : garde l’adresse en favori.</li>
          <li>
            Une étape ne correspond pas à ton écran ? Dis-le sur le mur du comité, avec ton navigateur et sa version.
          </li>
        </ul>
        {/* La date vit **dans** le panneau : posée à même la page, la ligne touchait le bord
            gauche de l’écran (`body-text-viewport-edge`, mesuré le 27/10/2026). */}
        <p className="muted m-0 text-[0.82rem]">
          Cette page a été vérifiée le {verifieLe}. Elle est revue à chaque version.
        </p>
      </section>
    </div>
  );
}
