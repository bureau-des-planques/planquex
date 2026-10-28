/*
 * BANC D'ÉCOUTE — DEV seulement (#378). Les deux sons de l'alpha, à écouter sur un téléphone.
 *
 * Cette page n'utilise **pas** le module de jeu : elle joue les fichiers tels quels, pour qu'on juge
 * le **timbre**, pas le câblage. Le câblage, lui, se vérifie dans le jeu (Réglages → Sons du jeu).
 */
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import '@/styles.css';
import './prototype-sons.css';

const SONS = [
  {
    cle: 'arrivage',
    titre: 'Arrivage',
    quand: "au clic qui ouvre un paquet — le sachet craque, la déchirure monte, la lèvre s'ouvre",
    source: '/sons/arrivage.wav'
  },
  {
    cle: 'verdict',
    titre: 'Verdict',
    quand: "à la fin d'un combat, victoire comme défaite — un tampon qui s'abat, deux notes qui descendent",
    source: '/sons/verdict.wav'
  }
];

function Banc() {
  const jouer = (source: string): void => {
    const audio = new Audio(source);
    audio.volume = 1;
    void audio.play();
  };
  const lesDeux = (): void => {
    jouer(SONS[0].source);
    window.setTimeout(() => jouer(SONS[1].source), 1200);
  };

  return (
    <main className="banc-sons">
      <h1>Les deux sons de l'alpha</h1>
      <p className="banc-sons__note">
        Deux sons, pas une bande-son (D-137). Ils sont <strong>générés</strong> par le projet : rien à attribuer, et ils
        se remplacent sans toucher au code.
      </p>

      {SONS.map((son) => (
        <section key={son.cle} className="banc-sons__carte">
          <h2>{son.titre}</h2>
          <p className="banc-sons__quand">{son.quand}</p>
          <button type="button" className="button button--gold button--big" onClick={() => jouer(son.source)}>
            Écouter
          </button>
          <audio src={son.source} controls preload="auto" className="banc-sons__lecteur" />
        </section>
      ))}

      <button type="button" className="button button--primary" onClick={lesDeux}>
        Les deux, à la suite
      </button>

      <section className="banc-sons__carte banc-sons__carte--avis">
        <h2>Ce que je veux savoir</h2>
        <ul>
          <li>
            <strong>Le timbre</strong> : ça sonne « bureau » ou « cartoon » ? Trop aigu, trop grave ?
          </li>
          <li>
            <strong>La longueur</strong> : l'Arrivage fait <strong>0,92 s</strong>, le verdict <strong>0,78 s</strong>.
            Trop long à chaque paquet ?
          </li>
          <li>
            <strong>Le verdict</strong> : deux notes qui descendent, ça dit « c'est fini » ou ça fait trop musical ?
          </li>
          <li>
            <strong>Le volume relatif</strong> : les deux sont normalisés à 0,85 de crête — l'un couvre-t-il l'autre ?
          </li>
        </ul>
      </section>
    </main>
  );
}

const racine = document.getElementById('root');
if (!racine) throw new Error('#root introuvable');
createRoot(racine).render(<Banc />);
