import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import { App } from './App';
import { ErreurDeRendu } from './components/ErreurDeRendu';
import { capterInviteInstallation } from './lib/invite-installation';
import './styles.css';

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
