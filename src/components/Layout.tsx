import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Library, Layers, Settings, Swords } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { JourneeIntegration } from '@/components/JourneeIntegration';
import { BulleBoiteAIdees } from '@/components/BulleBoiteAIdees';

const tabs = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/collection', label: 'Collection', icon: Library },
  { to: '/deck', label: 'Deck', icon: Layers },
  { to: '/battle', label: 'Combat', icon: Swords },
  { to: '/settings', label: 'Réglages', icon: Settings }
];

export function Layout() {
  const name = useStore((state) => state.name);
  const { pathname } = useLocation();

  /**
   * La bulle de la Boîte à idées (D-058) est **absente pendant un combat** : c'est ce
   * qui permet au mur d'être une **page** (D-068) sans risquer une partie en cours — on
   * ne la quitte pas pour aller lire des post-its. Elle revient dès qu'on quitte l'écran
   * de combat, fin de partie ou retour au bureau. Sur le mur lui-même, elle n'a rien à
   * ouvrir : elle s'efface.
   */
  const enCombat = pathname.startsWith('/battle');
  const surLeMur = pathname.startsWith('/idees');

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

      {/* La « Journée d'intégration » : une fois, au premier lancement (forme v5). */}
      <JourneeIntegration />

      {/* L'entrée du mur (D-058) : partout, sauf en combat et sur le mur. */}
      {!enCombat && !surLeMur && <BulleBoiteAIdees />}

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
