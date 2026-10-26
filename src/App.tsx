import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { Collection } from '@/pages/Collection';
import { Deck } from '@/pages/Deck';
import { Battle } from '@/pages/Battle';
import { Settings } from '@/pages/Settings';
import { BoiteAIdees } from '@/pages/BoiteAIdees';
import { Confidentialite } from '@/pages/Confidentialite';
import { Nouveautes } from '@/pages/Nouveautes';
import { Connexion } from '@/pages/Connexion';
import { Attente } from '@/pages/Attente';
import { Administration } from '@/pages/Administration';
import { Introuvable } from '@/pages/Introuvable';
import { REDIRECTIONS } from '@/redirections';
import { useComptes } from '@/store/comptes';
import { useMouvementReduitGlobal } from '@/components/use-mouvement-reduit';

/**
 * **Le prototype d'animations** (jetable, skill `prototype`) : une route de développement,
 * `/prototype/animations`, qui **n'existe pas** hors de `DEV` et **ne part pas dans le build**
 * — chargement paresseux, et la condition est constante au build, donc Vite écarte le module.
 * Ce n'est pas une page de l'application : `scripts/capturer.mjs` n'a pas à la photographier,
 * et la route est déclarée hors du littéral que lit `scripts/capturer.test.ts`.
 */
const ROUTE_PROTOTYPE = { chemin: 'prototype/animations' } as const;
const PrototypeAnimations = import.meta.env.DEV
  ? lazy(() =>
      import('@/prototype/PrototypeAnimations').then((m) => ({ default: m.PrototypeAnimations }))
    )
  : null;

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
          **avant** de s'inscrire. Même raison, même place, hors de la garde. */}
      <Route path="nouveautes" element={<Nouveautes />} />
      {PrototypeAnimations && (
        <Route
          path={ROUTE_PROTOTYPE.chemin}
          element={
            <Suspense fallback={null}>
              <PrototypeAnimations />
            </Suspense>
          }
        />
      )}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="collection" element={<Collection />} />
        <Route path="deck" element={<Deck />} />
        <Route path="battle" element={<Battle />} />
        <Route path="idees" element={<BoiteAIdees />} />
        <Route path="settings" element={<Settings />} />
        {/* Le compte : son état d'attente, puis l'administration (D-088). */}
        <Route path="attente" element={<Attente />} />
        <Route path="administration" element={<Administration />} />
        {/* Les anciennes adresses (D-075) : des redirections, pas des écrans. */}
        {Object.entries(REDIRECTIONS).map(([ancienne, nouvelle]) => (
          <Route key={ancienne} path={ancienne.slice(1)} element={<Navigate to={nouvelle} replace />} />
        ))}
        {/* Une adresse inconnue le dit : elle ne se fait plus passer pour l'Accueil (#131). */}
        <Route path="*" element={<Introuvable />} />
      </Route>
    </Routes>
  );
}
