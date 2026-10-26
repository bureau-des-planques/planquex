import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { Collection } from '@/pages/Collection';
import { Deck } from '@/pages/Deck';
import { Battle } from '@/pages/Battle';
import { Settings } from '@/pages/Settings';
import { Comite } from '@/pages/Comite';
import { Suivi } from '@/pages/Suivi';
import { Confidentialite } from '@/pages/Confidentialite';
import { Nouveautes } from '@/pages/Nouveautes';
import { Connexion } from '@/pages/Connexion';
import { Attente } from '@/pages/Attente';
import { Administration } from '@/pages/Administration';
import { Introuvable } from '@/pages/Introuvable';
import { REDIRECTIONS, REDIRECTIONS_PUBLIQUES } from '@/redirections';
import { useComptes } from '@/store/comptes';
import { useMouvementReduitGlobal } from '@/components/use-mouvement-reduit';

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

  return (
    <Routes>
      {/* La connexion est **hors** du `Layout` : ni barre de navigation ni bulle du mur
          tant qu'on n'est pas entré. Les autres pages passent par la garde, dans `Layout`. */}
      <Route path="connexion" element={<Connexion />} />
      {/* La confidentialité est **publique** : elle doit se lire sans compte, sinon un
          visiteur devrait s'inscrire pour savoir ce qu'on collecte. Elle est donc hors
          de la garde, comme la connexion. */}
      <Route path="confidentialite" element={<Confidentialite />} />
      {/* Les nouveautés aussi : un testeur doit pouvoir lire ce qu'une version apporte
          **avant** de s'inscrire. Même raison, même place, hors de la garde. Depuis
          D-097, l'écran s'appelle **la feuille de route** (`/feuille-de-route`) ; son
          contenu propre arrive avec #214. */}
      <Route path="feuille-de-route" element={<Nouveautes />} />
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
