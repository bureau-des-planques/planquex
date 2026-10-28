import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * **Rien de ce que le jeu charge ne manque hors ligne** (#413).
 *
 * Le service worker précache une liste d'extensions (`globPatterns`, `vite.config.ts`) : un fichier
 * qui n'y figure pas est servi par le réseau, et **le jeu devient muet** (ou aveugle) dès qu'il n'y
 * en a pas. C'est arrivé aux deux sons de l'alpha : dans `public/sons/`, aucun `import` ne les met
 * dans le graphe de modules, et `wav` manquait au précache.
 *
 * Ce test relie les deux : **tout fichier de `public/` que le code charge** doit avoir son extension
 * dans `globPatterns`. Ajouter un son, une police ou une image sans toucher au précache casse ici.
 */
const RACINE = new URL('..', import.meta.url);
const CONFIG = readFileSync(new URL('vite.config.ts', RACINE), 'utf8');

/** Les extensions du `globPatterns`, lues dans la configuration — jamais recopiées ici. */
function extensionsPrecachees(): string[] {
  const bloc = /globPatterns:\s*\[([^\]]*)\]/.exec(CONFIG);
  if (!bloc) throw new Error('globPatterns introuvable dans vite.config.ts');
  const dedans = /\{([^}]*)\}/.exec(bloc[1]);
  const liste = dedans ? dedans[1] : bloc[1];
  return liste
    .split(',')
    .map((ext) => ext.trim().replace(/['"]/g, '').replace(/^\*\./, ''))
    .filter(Boolean);
}

/** Les fichiers de `public/` que le code charge vraiment, par leur chemin littéral. */
function fichiersPublicCharges(): string[] {
  const sources = [
    'src/audio/sons.ts',
    'src/animation/ouverture/SceneOuverture.tsx',
    'src/animation/ouverture/creux.ts',
    'src/art.ts',
    'src/App.tsx'
  ];
  const trouves = new Set<string>();
  for (const chemin of sources) {
    let texte = '';
    try {
      texte = readFileSync(new URL(chemin, RACINE), 'utf8');
    } catch {
      continue;
    }
    for (const m of texte.matchAll(/['"`](\/[^'"`\s]+\.(wav|mp3|ogg|opus|png|jpg|jpeg|webp|woff2))['"`]/g)) {
      trouves.add(m[1]);
    }
  }
  return [...trouves];
}

describe('le précache couvre ce que le jeu charge (#413)', () => {
  it('les deux sons de l’alpha sont couverts par le précache', () => {
    const extensions = extensionsPrecachees();
    // Le cas fautif : quelqu'un retire `wav` de la liste, le jeu redevient muet hors ligne.
    expect(extensions, `extensions précachées : ${extensions.join(', ')}`).toContain('wav');
  });

  it('tout fichier de public/ chargé par le code a son extension précachée', () => {
    const extensions = extensionsPrecachees();
    const fichiers = fichiersPublicCharges();
    // Sans cette assertion, un `fichiersPublicCharges()` vide ferait passer le test pour rien.
    expect(fichiers.length).toBeGreaterThan(0);
    for (const fichier of fichiers) {
      const ext = fichier.split('.').pop() ?? '';
      expect(extensions, `${fichier} est chargé mais « ${ext} » n'est pas précaché`).toContain(ext);
    }
  });
});
