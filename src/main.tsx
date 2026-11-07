import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import { App } from './App';
import { ErreurDeRendu } from './components/ErreurDeRendu';
import { capterInviteInstallation } from './lib/invite-installation';
import { retenirLienDeRecuperation } from './lib/lien-recuperation';
import './styles.css';

// Le lien de récupération se lit **avant** le premier client Supabase (#654) : sa création
// consomme et efface le fragment de l'adresse, et le morceau `Connexion` arrive après.
retenirLienDeRecuperation();

// L'invite d'installation de Chromium part **une fois**, souvent avant le premier rendu : on
// l'écoute avant de monter React, pour que `/installation` puisse la rejouer au clic.
capterInviteInstallation(window);

const container = document.getElementById('root');

if (!container) {
  throw new Error('Point de montage #root introuvable dans index.html');
}

createRoot(container).render(
  <StrictMode>
    {/* Le garde-fou **extérieur** : si c'est le Layout ou le routeur qui tombe, la page n'est
        pas blanche. Celui du Layout garde, lui, la barre de navigation debout. */}
    <ErreurDeRendu>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErreurDeRendu>
  </StrictMode>
);
