import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  analyserCorps,
  comparer,
  entreeDe,
  nettoyer,
  rendreFichier,
  titreDe
} from './notes-versions.mjs';
import { NOTES_VERSIONS } from '@/data/versions';
import { notesAffichees } from '@/data/notes-affichees';

/**
 * **Le générateur des notes de version** (`npm run notes:versions`, D-090).
 *
 * Les notes affichées par `/feuille-de-route` ne s'écrivent plus à la main : elles sont prises
 * aux **releases GitHub** par `scripts/notes-versions.mjs`. Ce test éprouve la mise en
 * forme, **sans réseau** : il donne au générateur des corps de release réels (recopiés
 * ici), et regarde ce qu'il en fait.
 *
 * Ce qui est gardé, et pourquoi chacun peut échouer :
 *
 * 1. le markdown est retiré — un `**` qui reste se lirait tel quel à l'écran ;
 * 2. une puce repliée sur deux lignes est **recollée** : la couper en pleine phrase
 *    (« … et la fiche » sans « de chaque carte ») serait un mensonge ;
 * 3. le message aux testeurs est **écarté** (« ta sauvegarde », « comment remonter un
 *    retour ») : ce n'est pas ce que la version contient ;
 * 4. le groupe qui porte déjà le titre **garde ses points** : les jeter ferait disparaître
 *    la moitié de la note ;
 * 5. le fichier commité est **exactement** ce que le générateur écrirait — c'est
 *    `--verifie`, mais hors ligne, donc dans la CI.
 */

/** Un corps de release, tel que `gh release view` le rend (replié à 80 colonnes). */
const CORPS_ALPHA = `## Ce qui marche

- **Journée d'intégration** : quatre écrans pour les bases, au premier lancement. On peut la
  revoir depuis Réglages.
- **Arrivages** : 5 cartes à chaque ouverture.

## Ce qui n'existe pas encore

- **Jouer contre quelqu'un** : c'est le prochain chantier (la beta).

## ⚠️ Ta sauvegarde

**Vider les données de ton navigateur efface tout** : ton Parc, ton Chariot, ton nom.

## Comment remonter un retour

1. **Le libellé de version** affiché tout en bas de Réglages ;
2. **Ce que tu faisais** : l'écran, l'action, la carte ;
`;

const CORPS_ATELIER = `**L'Atelier a ses illustrations.**

- Les 27 cartes de l'Atelier sont illustrées : le pilote #132 est livré.
- Chaque image est au registre avec sa graine, et la carte porte son \`art:\`.

**Le gueulage est à part**

- Un gueulage n'est plus étiqueté IP ni OUF (D-085).
`;

describe('notes-versions — la mise en forme d’un corps de release', () => {
  it('garde les puces, écarte le message aux testeurs', () => {
    const groupes = analyserCorps(CORPS_ALPHA);
    expect(groupes.map((groupe) => groupe.titre)).toEqual(['Ce qui marche']);
    expect(groupes[0].points).toHaveLength(2);
    // Les trois sections de testeurs ont disparu, contenu compris.
    const texte = JSON.stringify(groupes);
    expect(texte).not.toContain('prochain chantier');
    expect(texte).not.toContain('efface tout');
    expect(texte).not.toContain('Ce que tu faisais');
  });

  it('recollé une puce repliée sur deux lignes', () => {
    const [groupe] = analyserCorps(CORPS_ALPHA);
    expect(groupe.points[0]).toBe(
      'Journée d’intégration : quatre écrans pour les bases, au premier lancement. On peut la revoir depuis Réglages.'
    );
  });

  it('retire le markdown, et met l’apostrophe typographique', () => {
    expect(nettoyer('un **gras**, un `code`, et [un lien](http://x)')).toBe(
      'un gras, un code, et un lien'
    );
    expect(nettoyer("l'IA et l'Atelier")).toBe('l’IA et l’Atelier');
    // Une citation entre guillemets n'est pas touchée : seul l'apostrophe entre lettres l'est.
    expect(nettoyer('« STUCK AGAIN »')).toBe('« STUCK AGAIN »');
  });

  it('le contrôle mord : une section écartée est bien jetée, et pas une autre', () => {
    // Sans cette confrontation, on ne saurait pas si la liste écarte quoi que ce soit.
    expect(analyserCorps('## Ta sauvegarde\n\n- rien à dire.\n')).toEqual([]);
    expect(analyserCorps('## Ce qui marche\n\n- une chose.\n')).toEqual([
      { titre: 'Ce qui marche', points: ['une chose.'] }
    ]);
  });
});

describe('notes-versions — le titre et l’entrée', () => {
  it('lit le titre dans le nom de la release, après un tiret', () => {
    expect(titreDe({ tagName: 'v0.1.2', name: 'Alpha · 0.1.2 — illustrations servies par Vite' })).toBe(
      'Illustrations servies par Vite'
    );
  });

  it('retombe sur le titre écrit dans le script quand le nom est nu', () => {
    // `Alpha · 0.1.6` ne dit pas ce que la version contient : le libellé est dans `TITRES`.
    expect(titreDe({ tagName: 'v0.1.6', name: 'Alpha · 0.1.6' })).toBe('L’Atelier a ses illustrations');
    // Une version inconnue ne se voit pas inventer de titre.
    expect(titreDe({ tagName: 'v0.9.9', name: '' })).toBe('Version 0.9.9');
  });

  it('ne perd pas les points du groupe qui porte le titre', () => {
    const note = entreeDe({
      tagName: 'v0.1.6',
      name: 'Alpha · 0.1.6',
      publishedAt: '2026-10-23T00:13:43Z',
      body: CORPS_ATELIER
    });
    expect(note.titre).toBe('L’Atelier a ses illustrations');
    // Les deux puces du groupe-titre sont là, sans étiquette ; celles du second groupe
    // gardent la leur.
    expect(note.points).toEqual([
      { texte: 'Les 27 cartes de l’Atelier sont illustrées : le pilote #132 est livré.' },
      {
        texte: 'Chaque image est au registre avec sa graine, et la carte porte son art:.'
      },
      { groupe: 'Le gueulage est à part', texte: 'Un gueulage n’est plus étiqueté IP ni OUF (D-085).' }
    ]);
    expect(note.date).toBe('2026-10-23');
    expect(note.brouillon).toBeUndefined();
  });

  it('marque une release brouillon de GitHub, et une version écrite d’avance', () => {
    const note = entreeDe({
      tagName: 'v0.2.0',
      name: 'Bêta · 0.2.0',
      publishedAt: '2026-11-01T00:00:00Z',
      body: '- Une nouveauté.',
      isDraft: true
    });
    // Une release **brouillon** sur GitHub est une note écrite d'avance : elle est gardée
    // dans le fichier, mais l'écran ne la montre pas tant qu'elle n'est pas publiée.
    expect(note.brouillon).toBe(true);
  });

  it('ordonne par numéro, pas par texte : 0.1.10 vient après 0.1.9', () => {
    expect(comparer('0.1.10', '0.1.9')).toBeGreaterThan(0);
    expect(comparer('0.2.0', '0.1.7')).toBeGreaterThan(0);
    expect(comparer('0.1.6', '0.1.6')).toBe(0);
  });
});

describe('notes-versions — le fichier commité', () => {
  it('est exactement ce que le générateur écrirait (le `--verifie` hors ligne)', () => {
    // `rendreFichier` est la seule mise en forme : si le fichier sur le disque n'est pas
    // ce qu'elle produit, c'est qu'il a été édité à la main — et la prochaine exécution
    // de `npm run notes:versions` effacerait cette édition en silence. On le dit ici.
    const fichier = readFileSync(new URL('../src/data/versions.ts', import.meta.url), 'utf8');
    expect(fichier).toBe(rendreFichier(NOTES_VERSIONS));
  });

  it('tient une note écrite d’avance hors de l’historique, et montre celle de la version courante', () => {
    // **Fixtures, pas le fichier** : le 25/10/2026, ce test affirmait que la 0.1.7 restait
    // un brouillon ; le jour de sa publication il est devenu faux. Un contrôle de règle ne
    // doit pas dépendre de l'état du fichier un jour donné.
    const note = (version: string, brouillon?: boolean) => ({
      version,
      date: '2026-10-25',
      titre: `Version ${version}`,
      brouillon,
      points: [{ texte: 'un point' }]
    });
    const fixtures = [note('0.1.8', true), note('0.1.7'), note('0.1.6')];

    // Le brouillon de la version **courante** s'affiche en tête (le tag part avant la release).
    expect(notesAffichees('0.1.8', fixtures).courante?.version).toBe('0.1.8');
    // Il ne se glisse **pas** dans l'historique.
    expect(notesAffichees('0.1.8', fixtures).precedentes.map((n) => n.version)).toEqual(['0.1.7', '0.1.6']);
    // Un brouillon d'une version **à venir** ne s'affiche nulle part.
    const avecFutur = [note('0.1.9', true), ...fixtures];
    const vu = notesAffichees('0.1.7', avecFutur);
    expect(vu.courante?.version).toBe('0.1.7');
    expect(vu.precedentes.map((n) => n.version)).toEqual(['0.1.6']);
  });
});

/** Le chemin du script, pour le message d'erreur des contrôles ci-dessus. */
const CHEMIN = fileURLToPath(new URL('./notes-versions.mjs', import.meta.url));

describe('notes-versions — la commande', () => {
  it('est déclarée dans package.json, et n’ajoute aucune dépendance', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as { scripts: Record<string, string>; dependencies: Record<string, string> };
    expect(pkg.scripts['notes:versions']).toBe('node scripts/notes-versions.mjs');
    // Le pont avec GitHub est `gh` (la CLI, déjà là) : aucun paquet de plus dans le bundle.
    expect(Object.keys(pkg.dependencies)).not.toContain('@octokit/rest');
    expect(readFileSync(CHEMIN, 'utf8')).toContain("execFileSync('gh'");
  });
});
