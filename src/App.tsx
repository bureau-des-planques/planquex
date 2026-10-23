import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { Collection } from '@/pages/Collection';
import { Deck } from '@/pages/Deck';
import { Battle } from '@/pages/Battle';
import { Settings } from '@/pages/Settings';
import { BoiteAIdees } from '@/pages/BoiteAIdees';
import { Confidentialite } from '@/pages/Confidentialite';
import { Connexion } from '@/pages/Connexion';
import { Attente } from '@/pages/Attente';
import { Administration } from '@/pages/Administration';
import { Introuvable } from '@/pages/Introuvable';
import { REDIRECTIONS } from '@/redirections';
import { useComptes } from '@/store/comptes';

export function App() {
  // La session persistée est relue **une fois** au démarrage (D-088). Sans backend,
  // `rafraichir()` ne contacte rien et laisse `configure` à `false` : le jeu est inchangé.
  useEffect(() => {
    void useComptes.getState().rafraichir();
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
