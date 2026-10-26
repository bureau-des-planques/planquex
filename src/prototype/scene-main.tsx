/* PROTOTYPE JETABLE — point d'entrée DEV du banc d'essai des saynètes (voir scene.html). */
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import '@/styles.css';
import './prototype-scene.css';
import { PrototypeScene } from './PrototypeScene';

const racine = document.getElementById('root');
if (!racine) throw new Error('#root introuvable');
createRoot(racine).render(<PrototypeScene />);
