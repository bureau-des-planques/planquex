import { NavLink, Outlet } from 'react-router-dom';
import { Home, Library, Layers, Settings, Swords } from 'lucide-react';
import { useStore } from '@/store/useStore';

const tabs = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/collection', label: 'Parc', icon: Library },
  { to: '/deck', label: 'Chariot', icon: Layers },
  { to: '/battle', label: 'Combat', icon: Swords },
  { to: '/settings', label: 'Réglages', icon: Settings }
];

export function Layout() {
  const name = useStore((state) => state.name);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">BP</span>
          <div className="brand__text">
            <strong>Bureau des Planqués</strong>
            <span>Le TCG de l’atelier</span>
          </div>
        </div>
        <div className="topbar__user" title="Profil">
          {name}
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navigation principale">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
