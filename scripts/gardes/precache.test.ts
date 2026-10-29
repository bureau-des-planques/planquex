import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **Rien de ce que le jeu charge ne manque hors ligne** (#413).
 *
 * Le service worker précache une liste d'extensions (`globPatterns`, `vite.config.ts`) : un fichier
 * qui n'y figure pas est servi par le réseau, et **le jeu devient muet** (ou aveugle) dès qu'il n'y
 * en a pas. C'est arrivé aux deux sons de l'alpha : dans `public/sons/`, aucun `import` ne les met
 * dans le graphe de modules, et `wav` manquait au précache.
 *
 * Deux gardes :
 *  - **tout fichier de `public/` que le code charge** doit avoir son extension dans `globPatterns`
 *    (ou être listé dans `includeAssets`, qui le précache aussi) ;
 *  - **tout fichier de `public/`, point** : la garde lit le dossier entier, pas seulement les chemins
 *    écrits en dur dans le code. Un son ajouté « pour plus tard » ne peut plus entrer muet.
 *
 * Les deux gardes sont confrontées à un cas fautif (un fichier fabriqué, une configuration sans
 * `wav`) : elles doivent échouer, sinon elles ne gardent rien.
 */
const RACINE = new URL('../..', import.meta.url);
const CONFIG = readFileSync(new URL('vite.config.ts', RACINE), 'utf8');
const PUBLIC = fileURLToPath(new URL('public/', RACINE));

/**
 * Fichiers de `public/` **volontairement** hors précache : clé = chemin relatif à `public/`, valeur =
 * la raison. Vide à dessein : tout ce qui est dans `public/` aujourd'hui est servi hors ligne.
 * Une entrée ici doit correspondre à un fichier réel (voir le test « liste blanche »).
 */
const HORS_PRECACHE_VOLONTAIRE: Record<string, string> = {};

/** Les extensions du `globPatterns`, lues dans la configuration — jamais recopiées ici. */
function extensionsPrecachees(config: string): string[] {
  const bloc = /globPatterns:\s*\[([^\]]*)\]/.exec(config);
  if (!bloc) throw new Error('globPatterns introuvable dans vite.config.ts');
  const dedans = /\{([^}]*)\}/.exec(bloc[1]);
  const liste = dedans ? dedans[1] : bloc[1];
  return liste
    .split(',')
    .map((ext) => ext.trim().replace(/['"]/g, '').replace(/^\*\./, ''))
    .filter(Boolean);
}

/** Les fichiers précachés par `includeAssets` (chemins relatifs à `public/`), lus dans la configuration. */
function fichiersIncluS(config: string): string[] {
  const bloc = /includeAssets:\s*\[([^\]]*)\]/.exec(config);
  if (!bloc) return [];
  return [...bloc[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** Tous les fichiers de `dossier`, récursivement, en chemins relatifs à `dossier` (séparateur `/`). */
function fichiersDe(dossier: string, sous = ''): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(join(dossier, sous), { withFileTypes: true })) {
    const rel = sous ? `${sous}/${entree.name}` : entree.name;
    if (entree.isDirectory()) sortie.push(...fichiersDe(dossier, rel));
    else sortie.push(rel);
  }
  return sortie.sort();
}

/**
 * Les fichiers de `dossier` que le précache de `config` ne couvre pas, et qui ne sont pas dans la
 * liste blanche. Une fonction pure de ses deux entrées : le test la confronte à des cas fabriqués.
 */
function fichiersNonCouverts(dossier: string, config: string): string[] {
  const extensions = extensionsPrecachees(config);
  const inclus = fichiersIncluS(config);
  return fichiersDe(dossier).filter((fichier) => {
    if (fichier in HORS_PRECACHE_VOLONTAIRE) return false;
    if (inclus.includes(fichier)) return false;
    const ext = fichier.split('.').pop() ?? '';
    return !extensions.includes(ext);
  });
}

/** Les fichiers de `public/` que le code charge vraiment, par leur chemin littéral. */
function fichiersPublicCharges(): string[] {
  const sources = ['src/audio/sons.ts', 'src/animation/ouverture/SceneOuverture.tsx', 'src/art.ts', 'src/App.tsx'];
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
    const extensions = extensionsPrecachees(CONFIG);
    // Le cas fautif : quelqu'un retire `wav` de la liste, le jeu redevient muet hors ligne.
    expect(extensions, `extensions précachées : ${extensions.join(', ')}`).toContain('wav');
  });

  it('tout fichier de public/ chargé par le code a son extension précachée', () => {
    const extensions = extensionsPrecachees(CONFIG);
    const fichiers = fichiersPublicCharges();
    // Sans cette assertion, un `fichiersPublicCharges()` vide ferait passer le test pour rien.
    expect(fichiers.length).toBeGreaterThan(0);
    for (const fichier of fichiers) {
      const ext = fichier.split('.').pop() ?? '';
      expect(extensions, `${fichier} est chargé mais « ${ext} » n'est pas précaché`).toContain(ext);
    }
  });

  it('tout fichier de public/ est précaché, ou listé comme volontairement hors précache', () => {
    const manquants = fichiersNonCouverts(PUBLIC, CONFIG);
    expect(
      manquants,
      `non précachés (ajouter l'extension à globPatterns, ou à includeAssets, ou à HORS_PRECACHE_VOLONTAIRE avec une raison) : ${manquants.join(', ')}`
    ).toEqual([]);
  });

  it('la liste blanche ne retient que des fichiers qui existent', () => {
    // Une entrée périmée masquerait silencieusement un fichier qui n'existe plus.
    const existants = new Set(fichiersDe(PUBLIC));
    for (const chemin of Object.keys(HORS_PRECACHE_VOLONTAIRE)) {
      expect(existants.has(chemin), `${chemin} est dans la liste blanche mais n'existe pas dans public/`).toBe(true);
    }
  });

  it('le contrôle mord : un fichier fabriqué hors des extensions précachées est refusé', () => {
    const racine = mkdtempSync(join(tmpdir(), 'precache-413-'));
    try {
      mkdirSync(join(racine, 'sons'), { recursive: true });
      writeFileSync(join(racine, 'sons', 'fabrique.mp4'), 'x');
      writeFileSync(join(racine, 'sons', 'arrivage.wav'), 'x');
      const manquants = fichiersNonCouverts(racine, CONFIG);
      expect(manquants).toEqual(['sons/fabrique.mp4']);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('le contrôle mord : la configuration sans `wav` fait échouer les deux sons', () => {
    // Le cas exact de #413 : on retire `wav` du précache, la garde doit nommer les deux fichiers.
    const sansWav = CONFIG.replace('woff2,wav', 'woff2');
    expect(sansWav).not.toBe(CONFIG);
    const manquants = fichiersNonCouverts(PUBLIC, sansWav);
    expect(manquants).toContain('sons/arrivage.wav');
    expect(manquants).toContain('sons/verdict.wav');
  });
});
