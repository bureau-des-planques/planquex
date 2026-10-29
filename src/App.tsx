import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RepliChargement } from '@/components/RepliChargement';
import { Home } from '@/pages/Home';
import { Introuvable } from '@/pages/Introuvable';
import { REDIRECTIONS, REDIRECTIONS_PUBLIQUES } from '@/redirections';
import { useComptes } from '@/store/comptes';
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
const Collection = lazy(() => import('@/pages/Collection').then((m) => ({ default: m.Collection })));
const Deck = lazy(() => import('@/pages/Deck').then((m) => ({ default: m.Deck })));
const Battle = lazy(() => import('@/pages/Battle').then((m) => ({ default: m.Battle })));
const Rejeu = lazy(() => import('@/pages/Rejeu').then((m) => ({ default: m.Rejeu })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const Comite = lazy(() => import('@/pages/Comite').then((m) => ({ default: m.Comite })));
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
  useEffect(() => {
    void useComptes.getState().rafraichir();
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
          <Route path="collection" element={<Collection />} />
          <Route path="deck" element={<Deck />} />
          <Route path="battle" element={<Battle />} />
          {/* Le comité a **deux pages** (D-097 (2)) : le mur (`/comite`) et le suivi
            (`/comite/suivi`), sous la même barre de sous-onglets. */}
          <Route path="comite" element={<Comite />} />
          <Route path="comite/suivi" element={<Suivi />} />
          <Route path="settings" element={<Settings />} />
          <Route path="rejeu" element={<Rejeu />} />
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
