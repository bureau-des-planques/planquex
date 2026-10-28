/* PROTOTYPE JETABLE (#283) — point d'entrée DEV du banc d'essai du creux (voir ouverture.html). */
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import '@/styles.css';
import './prototype-ouverture.css';
import { PrototypeOuverture } from './PrototypeOuverture';

const racine = document.getElementById('root');
if (!racine) throw new Error('#root introuvable');
createRoot(racine).render(<PrototypeOuverture />);
