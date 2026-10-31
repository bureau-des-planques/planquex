import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Library, Layers, Settings, StickyNote, Swords } from 'lucide-react';
import { compterChosesAVoir, murEstConfigure } from '@/lib/murBase';
import { useStore } from '@/store/useStore';
/**
 * **La Journée d'intégration arrive à la demande** (31/10/2026) : elle ne sert qu'aux
 * testeurs qui ne l'ont pas vue, et son panneau pèse plus que le cliquet du paquet
 * principal ne l'autorisait. Sortie du tronc, elle ne coûte rien à qui l'a déjà vue —
 * et `tutorielVu` la démonte avant même de demander son morceau.
 */
const JourneeIntegration = lazy(() =>
  import('@/components/JourneeIntegration').then((module) => ({ default: module.JourneeIntegration }))
);
import { AlerteComite } from '@/components/AlerteComite';
import { BandeauHorsLigne } from '@/components/BandeauHorsLigne';
import { BandeauNouvelleVersion } from '@/components/BandeauNouvelleVersion';
import { ErreurDeRendu } from '@/components/ErreurDeRendu';
import { RepliChargement } from '@/components/RepliChargement';
import { GardeComptes } from '@/components/GardeComptes';
import { estApprouve } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';

/**
 * La barre du bas, **cinq onglets** (D-097 (4), #213) : le **comité** prend la place des
 * **Réglages**, qui passent à l'engrenage de l'en-tête. Le post-it est l'objet du comité —
 * une note qu'on laisse sur le mur —, pas un dessin maison.
 */
const tabs = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/collection', label: 'Collection', icon: Library },
  { to: '/deck', label: 'Deck', icon: Layers },
  { to: '/battle', label: 'Combat', icon: Swords },
  { to: '/comite', label: 'Comité', icon: StickyNote }
];

export function Layout() {
  const name = useStore((state) => state.name);
  const tutorielVu = useStore((state) => state.tutorielVu);
  const { pathname } = useLocation();
  /**
   * L'état du compte (D-088). Un compte **en attente** joue et lit : le bandeau le lui
   * rappelle, avec un lien vers l'écran qui dit ce qui s'ouvrira. Sans configuration,
   * `configure` est faux et rien ne s'affiche.
   */
  const configure = useComptes((state) => state.configure);
  const session = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const enAttente = configure && session !== null && compte !== null && !estApprouve(compte);

  /**
   * **La barre du bas s'efface en combat** (#275, D-116) : le plateau est l'écran qui a le
   * plus besoin de hauteur, et une barre fixe lui en prend. Elle n'est pas *cachée* (pas de
   * `display: none`) : elle **n'est pas rendue**, donc elle ne prend ni place, ni focus, ni
   * rôle pour le lecteur d'écran. Elle revient dès qu'on quitte `/battle`.
   *
   * C'est aussi ce qui permet au mur d'être une **page** (D-068) sans risquer une partie en
   * cours — on ne la quitte pas pour aller lire des post-its (D-058, D-097).
   */
  const enCombat = pathname.startsWith('/battle');

  /**
   * Le compteur « choses à voir » du comité (#212, D-097 (5)) : **mes** post-its dont le
   * statut a bougé, et les commentaires des autres sur eux, depuis le repère `vu_le`.
   *
   * Il est **absent à zéro, sans base, et en combat** ; sur **Le suivi**, l'alerte s'efface
   * aussi — c'est la page qui vient de les voir, et c'est en la quittant que la lecture
   * suivante rend 0 (le repère a été posé par `marquerComiteVu`, #211). La lecture est donc
   * refaite à chaque changement d'adresse, jamais sur ces deux écrans.
   */
  const [aVoir, setAVoir] = useState(0);
  const base = murEstConfigure();
  const surLeSuivi = pathname.startsWith('/comite/suivi');

  useEffect(() => {
    // Sans **compte** connecté, il n'y a rien à compter — et depuis D-156 (#527) la lecture
    // ne signe plus personne : un visiteur sans compte n'obtient pas d'identité anonyme pour
    // une pastille (c'était la porte par laquelle on entrait dans le jeu).
    if (!base || enCombat || surLeSuivi || !session || session.anonyme) {
      setAVoir(0);
      return;
    }
    let vivant = true;
    compterChosesAVoir()
      .then((nombre) => {
        if (vivant) setAVoir(nombre ?? 0);
      })
      // Une base muette ne fait pas une pastille : le compteur est un signal, pas une panne
      // affichée (le mur, lui, dit quand il retombe sur le fichier).
      .catch(() => {
        if (vivant) setAVoir(0);
      });
    return () => {
      vivant = false;
    };
  }, [pathname, base, enCombat, surLeSuivi, session]);

  /**
   * Les **cinq** onglets (D-097) ne se réduisent pas en combat : la barre n'y est plus du
   * tout (#275). Ce qui existait avant — masquer l'onglet Comité et garder quatre entrées —
   * a disparu avec la barre.
   */
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
        {/* Les Réglages ont quitté la barre (D-097 (4)) : l'engrenage est **collé au pseudo**,
            et c'est un lien nommé — une icône seule ne dit rien au lecteur d'écran. */}
        <div className="topbar__actions">
          <div className="topbar__user" title={name}>
            {name}
          </div>
          <Link to="/settings" className="topbar__gear" aria-label="Réglages">
            <Settings size={20} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <BandeauHorsLigne />
      {/* Une nouvelle version est prête (#355) : le testeur décide de recharger, et le
          bandeau ne s'affiche pas en combat. */}
      <BandeauNouvelleVersion />

      {enAttente && (
        <div className="notice notice--warn" role="status">
          <p className="m-0 max-w-[70ch]">
            <Link to="/attente">Ton compte attend d’être validé</Link> — tu peux jouer et lire ; poster un post-it,
            voter et envoyer une trace de combat s’ouvriront à l’approbation.
          </p>
        </div>
      )}

      {/* **La place du panneau est réservée** (31/10/2026). Mesuré : à l'étape 1, le bouton
          « Ouvrir un Arrivage » (y 303) passait sous le panneau (y 10 → 347), et la page ne
          pouvait pas défiler assez pour le dégager — `scrollIntoView` n'a rien à faire d'un
          élément déjà en haut du document. Un espace de la hauteur du panneau pousse le
          contenu dessous, donc la cible reste visible et cliquable. */}
      {!tutorielVu && !enCombat && <div className="journee-espace" aria-hidden="true" />}
      <main className="main">
        {/* Un écran qui plante ne prend pas la barre de navigation avec lui, et changer
            d'écran referme l'erreur (`reinitialiseSur`). */}
        <ErreurDeRendu reinitialiseSur={pathname}>
          {/* D-088 : sans session, aucune page du jeu — la garde renvoie vers la connexion.
              Sans backend, elle laisse tout passer. */}
          <GardeComptes>
            {/* Le repli des écrans du jeu (#478) vit **ici**, et non au-dessus du routeur :
                pendant qu'un morceau se télécharge, l'en-tête, les bandeaux et la barre du bas
                restent en place — la barre ne bouge pas sous le pouce. En combat elle n'est de
                toute façon pas rendue (#275), donc le plateau reste plein écran. Le garde-fou
                d'erreur est **au-dessus** : un morceau manquant tombe dans « Recharger ». */}
            <Suspense fallback={<RepliChargement />}>
              <Outlet />
            </Suspense>
          </GardeComptes>
        </ErreurDeRendu>
      </main>

      {/* La « Journée d'intégration » : une fois, au premier lancement (forme v5). Montée
          seulement tant qu'elle est à faire — un testeur qui l'a vue ne télécharge rien. */}
      {!tutorielVu && (
        <Suspense fallback={null}>
          <JourneeIntegration />
        </Suspense>
      )}

      {/* L'alerte du comité (D-058, #212) : partout sauf en combat et sur Le suivi, et
          seulement quand il y a quelque chose à voir — à zéro elle n'a rien à dire. */}
      {!enCombat && !surLeSuivi && <AlerteComite nombre={aVoir} />}

      {/* La barre du bas : **cinq onglets**, et **rien du tout en combat** (#275). Le shell
          seul la rend — aucun écran ne la redessine. */}
      {!enCombat && (
        <nav className="bottom-nav" aria-label="Navigation principale">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            // La pastille ne vit que sur l'onglet **Comité** : elle dit « choses à voir »,
            // et le nom accessible du lien la porte pour le lecteur d'écran (#212).
            const pastille = tab.to === '/comite' ? aVoir : 0;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                aria-label={
                  pastille > 0 ? `${tab.label} — ${pastille} ${pastille > 1 ? 'choses' : 'chose'} à voir` : undefined
                }
                className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{tab.label}</span>
                {pastille > 0 && (
                  <span className="bottom-nav__pastille" aria-hidden="true">
                    {pastille}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
