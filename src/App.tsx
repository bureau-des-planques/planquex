import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { Collection } from '@/pages/Collection';
import { Deck } from '@/pages/Deck';
import { Battle } from '@/pages/Battle';
import { Rejeu } from '@/pages/Rejeu';
import { Settings } from '@/pages/Settings';
import { Comite } from '@/pages/Comite';
import { Suivi } from '@/pages/Suivi';
import { Confidentialite } from '@/pages/Confidentialite';
import { FeuilleDeRoute } from '@/pages/FeuilleDeRoute';
import { Installation } from '@/pages/Installation';
import { Connexion } from '@/pages/Connexion';
import { Attente } from '@/pages/Attente';
import { Administration } from '@/pages/Administration';
import { Introuvable } from '@/pages/Introuvable';
import { REDIRECTIONS, REDIRECTIONS_PUBLIQUES } from '@/redirections';
import { useComptes } from '@/store/comptes';
import { useMouvementReduitGlobal } from '@/components/use-mouvement-reduit';
import { deverrouiller } from '@/audio/sons';

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
          même place — hors de la garde. */}
      <Route path="installation" element={<Installation />} />
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
  );
}
