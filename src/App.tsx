import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { Collection } from '@/pages/Collection';
import { Deck } from '@/pages/Deck';
import { Battle } from '@/pages/Battle';
import { Settings } from '@/pages/Settings';
import { BoiteAIdees } from '@/pages/BoiteAIdees';
import { Introuvable } from '@/pages/Introuvable';
import { REDIRECTIONS } from '@/redirections';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="collection" element={<Collection />} />
        <Route path="deck" element={<Deck />} />
        <Route path="battle" element={<Battle />} />
        <Route path="idees" element={<BoiteAIdees />} />
        <Route path="settings" element={<Settings />} />
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
