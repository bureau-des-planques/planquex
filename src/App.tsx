import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RepliChargement } from '@/components/RepliChargement';
import { Home } from '@/pages/Home';
import { Introuvable } from '@/pages/Introuvable';
import { REDIRECTIONS, REDIRECTIONS_PUBLIQUES } from '@/redirections';
import { useComptes } from '@/store/comptes';
import { useStore } from '@/store/useStore';
import { useMouvementReduitGlobal } from '@/components/use-mouvement-reduit';
import { deverrouiller } from '@/audio/sons';

/**
 * **Les écrans se chargent à leur tour** (#478). Mesuré le 29/10/2026 : un seul morceau mettait
 * **1 026 kB** au premier écran, plateau de combat, administration et guide d'installation
 * compris, et Vite l'annonçait à chaque déploiement (« Some chunks are larger than 500 kB »).
 * Les écrans sortis de ce morceau, il mesure **727 kB** (221 kB gzip) — et **509 kB** si
 * l'Accueil était paresseux lui aussi, ce que #478 interdit : c'est la porte d'entrée, son repli
 * ne doit pas s'afficher. Les dépendances communes expliquent le reste du poids ; c'est #479.
 *
 * **L'Accueil et l'adresse inconnue restent en dur** : le premier est la porte d'entrée de tous
 * les liens, la seconde doit répondre sans attendre un morceau. Tous les autres passent par
 * `lazy`, et le morceau produit entre dans le précache du service worker (`vite.config.ts`,
 * `globPatterns`) : hors ligne, chaque écran s'ouvre encore.
 *
 * Un morceau qui manque (mise à jour du service worker en pleine session) fait échouer
 * l'`import()` : l'erreur remonte au `ErreurDeRendu` du `Layout`, qui affiche « Recharger » —
 * jamais un écran blanc (#131).
 */
/**
 * **La Collection et le Deck sont un seul écran** (#545), deux onglets : son morceau est
 * donc un shell, qui charge à son tour le contenu de l'onglet demandé. Les deux contenus
 * gardent chacun le leur — ouvrir `/collection` ne télécharge pas le Deck.
 */
const CollectionDeck = lazy(() => import('@/pages/CollectionDeck').then((m) => ({ default: m.CollectionDeck })));
const Battle = lazy(() => import('@/pages/Battle').then((m) => ({ default: m.Battle })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const Comite = lazy(() => import('@/pages/Comite').then((m) => ({ default: m.Comite })));
const PauseCafe = lazy(() => import('@/pages/PauseCafe').then((m) => ({ default: m.PauseCafe })));
const Suivi = lazy(() => import('@/pages/Suivi').then((m) => ({ default: m.Suivi })));
const Confidentialite = lazy(() => import('@/pages/Confidentialite').then((m) => ({ default: m.Confidentialite })));
const FeuilleDeRoute = lazy(() => import('@/pages/FeuilleDeRoute').then((m) => ({ default: m.FeuilleDeRoute })));
const InstallationBanc = lazy(() => import('@/pages/InstallationBanc'));
const Connexion = lazy(() => import('@/pages/Connexion').then((m) => ({ default: m.Connexion })));
const Attente = lazy(() => import('@/pages/Attente').then((m) => ({ default: m.Attente })));
const Administration = lazy(() => import('@/pages/Administration').then((m) => ({ default: m.Administration })));

/**
 * Les anciennes adresses (D-075), en routes qui redirigent.
 *
 * Elles se déclarent en **deux endroits** selon leur destination : une adresse publique
 * (`/nouveautes` → `/feuille-de-route`) reste **hors de la garde**, comme l'écran qu'elle
 * ouvre ; les autres vivent dans le `Layout`, avec le reste du jeu.
 */
function routesDeRedirection(publiques: boolean) {
  return Object.entries(REDIRECTIONS)
    .filter(([ancienne]) => REDIRECTIONS_PUBLIQUES.includes(ancienne) === publiques)
    .map(([ancienne, nouvelle]) => (
      <Route key={ancienne} path={ancienne.slice(1)} element={<Navigate to={nouvelle} replace />} />
    ));
}

export function App() {
  // La session persistée est relue **une fois** au démarrage (D-088). Sans backend,
  // `rafraichir()` ne contacte rien et laisse `configure` à `false` : le jeu est inchangé.
  //
  // **Puis la Collection se relit** (#493, D-179 (3)) : elle vit sur le compte, le client
  // n'en garde qu'un cache. La lecture n'a lieu **que si une session existe** — sans compte
  // il n'y a rien à demander. Un échec ne vide rien : `synchroniserCollection` laisse le
  // cache local et rend sa raison, que la page Collection dit hors ligne (D-060 (3)).
  //
  // **Enfin le Deck rejoint le compte** (#492, #491) : au premier login, le Deck local monte
  // dans le compte — une seule fois, marquée côté serveur. Puis la file d'intentions se vide
  // (#491, D-153 (3)) : les gestes faits hors ligne partent au montage si une session existe,
  // et au retour du réseau (l'écouteur ci-dessous). Hors ligne ou sans session, aucun appel
  // n'est émis — rien n'est perdu, et le prochain montage réessaie.
  useEffect(() => {
    void (async () => {
      await useComptes.getState().rafraichir();
      if (useComptes.getState().session) {
        await useStore.getState().synchroniserCollection();
        await useStore.getState().synchroniserDeck();
      }
    })();
  }, []);

  // **Le retour du réseau relance l'import et draine la file du Deck** (#492, #491) :
  // `online` ne promet pas que le serveur répond, mais il est le signal qu'un envoi peut être
  // tenté. Un échec garde la file et rend sa raison ; le prochain `online`, ou le bouton de
  // l'écran Deck, réessaie.
  useEffect(() => {
    const drainer = (): void => {
      void useStore.getState().synchroniserDeck();
    };
    window.addEventListener('online', drainer);
    return () => window.removeEventListener('online', drainer);
  }, []);

  // « Mouvement réduit » (store **et** `prefers-reduced-motion`) relié au CSS par un
  // attribut de la racine : le réglage existait, aucun CSS ne le lisait (#192).
  useMouvementReduitGlobal();

  // **L'audio ne se débloque que sur un geste** (D-137, spec HTML) : on profite donc du **premier**
  // geste de la session, quel qu'il soit, pour créer le contexte et décoder les deux sons. Rien
  // n'est joué ici — sans ça, le premier Arrivage serait muet, le temps du décodage.
  useEffect(() => {
    const amorcer = (): void => deverrouiller();
    document.addEventListener('pointerup', amorcer, { once: true, capture: true });
    document.addEventListener('keydown', amorcer, { once: true, capture: true });
    return () => {
      document.removeEventListener('pointerup', amorcer, { capture: true });
      document.removeEventListener('keydown', amorcer, { capture: true });
    };
  }, []);

  return (
    // Le repli des écrans **hors du Layout** (connexion, confidentialité, feuille de route,
    // installation) : il n'y a rien d'autre à l'écran, il peut donc prendre la page nue. Sous le
    // `Layout`, c'est `src/components/Layout.tsx` qui porte le sien, pour que la barre reste.
    <Suspense fallback={<RepliChargement />}>
      <Routes>
        {/* La connexion est **hors** du `Layout` : ni barre de navigation ni bulle du mur
          tant qu'on n'est pas entré. Les autres pages passent par la garde, dans `Layout`. */}
        <Route path="connexion" element={<Connexion />} />
        {/* La confidentialité est **publique** : elle doit se lire sans compte, sinon un
          visiteur devrait s'inscrire pour savoir ce qu'on collecte. Elle est donc hors
          de la garde, comme la connexion. */}
        <Route path="confidentialite" element={<Confidentialite />} />
        {/* La feuille de route aussi : un testeur doit pouvoir lire ce qu'une version
          apporte, et ce qui arrive, **avant** de s'inscrire (D-097 (3)). Même raison,
          même place, hors de la garde. */}
        <Route path="feuille-de-route" element={<FeuilleDeRoute />} />
        {/* Le guide d'installation (#300) : la note de release y renvoie, et un testeur doit
          pouvoir le lire avant de créer un compte. Même raison que la feuille de route,
          même place — hors de la garde. Le contenu est le **banc** relu dans #504 ; ses
          faits (`ADRESSE`, `PROCEDURES`) sont toujours dans `src/pages/Installation.tsx`. */}
        <Route path="installation" element={<InstallationBanc />} />
        {/* Les anciennes adresses dont la destination est publique restent hors de la garde. */}
        {routesDeRedirection(true)}
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          {/* Deux adresses, un écran (#545) : chacune ouvre la page sur son onglet. */}
          <Route path="collection" element={<CollectionDeck onglet="collection" />} />
          <Route path="deck" element={<CollectionDeck onglet="deck" />} />
          <Route path="battle" element={<Battle />} />
          {/* La pause café (D-192) : l'espace social, annoncé, pas encore jouable. */}
          <Route path="pause-cafe" element={<PauseCafe />} />
          {/* Le comité a **deux pages** (D-097 (2)) : le mur (`/comite`) et le suivi
            (`/comite/suivi`), sous la même barre de sous-onglets. */}
          <Route path="comite" element={<Comite />} />
          <Route path="comite/suivi" element={<Suivi />} />
          <Route path="settings" element={<Settings />} />
          {/* Le compte : son état d'attente, puis l'administration (D-088). */}
          <Route path="attente" element={<Attente />} />
          <Route path="administration" element={<Administration />} />
          {/* Les anciennes adresses (D-075) : des redirections, pas des écrans. */}
          {routesDeRedirection(false)}
          {/* Une adresse inconnue le dit : elle ne se fait plus passer pour l'Accueil (#131). */}
          <Route path="*" element={<Introuvable />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
