import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { Collection } from '@/pages/Collection';
import { Deck } from '@/pages/Deck';
import { Battle } from '@/pages/Battle';
import { Settings } from '@/pages/Settings';
import { BoiteAIdees } from '@/pages/BoiteAIdees';

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
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
