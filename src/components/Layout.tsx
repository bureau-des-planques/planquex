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
          <span className="brand__mark" aria-hidden="true">
            {/* La tasse de Café, motif maison : même dessin que l'icône PWA. */}
            <svg viewBox="0 0 32 32" role="img">
              <defs>
                <linearGradient id="bp-brand-mug" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f4d68a" />
                  <stop offset="1" stopColor="#a67c22" />
                </linearGradient>
              </defs>
              <path
                d="M11 5c-1.6 2 .8 3.2-.6 5"
                fill="none"
                stroke="#f4d68a"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path
                d="M16 4c-1.6 2 .8 3.2-.6 5"
                fill="none"
                stroke="#f4d68a"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.55"
              />
              <path
                d="M21 15h2.4a3.2 3.2 0 0 1 0 6.4H21"
                fill="none"
                stroke="url(#bp-brand-mug)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path d="M7 13h14v6.5A4.5 4.5 0 0 1 16.5 24h-5A4.5 4.5 0 0 1 7 19.5Z" fill="url(#bp-brand-mug)" />
              <rect x="7" y="13" width="14" height="2.4" rx="1.2" fill="#0b1220" opacity="0.35" />
            </svg>
          </span>
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
