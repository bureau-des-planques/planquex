import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  analyserCorps,
  brouillonAttendu,
  comparer,
  entreeDe,
  nettoyer,
  rendreFichier,
  titreDe,
  verifierNotes
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
    expect(nettoyer('un **gras**, un `code`, et [un lien](http://x)')).toBe('un gras, un code, et un lien');
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

  it('retombe sur « Version X » quand le nom ne porte pas de titre', () => {
    // **Aucun titre nulle part** (Bastien, 29/10/2026) : le nom d'une release est son tag
    // (`v0.1.6-alpha`), donc il n'y a rien après un tiret. Plus de table de titres à la
    // main : le titre est neutre, et les points de la note portent le contenu.
    expect(titreDe({ tagName: 'v0.1.6', name: 'v0.1.6-alpha' })).toBe('Version 0.1.6');
    expect(titreDe({ tagName: 'v0.9.9', name: '' })).toBe('Version 0.9.9');
    // L'ancienne écriture (« Alpha · 0.1.6 ») se lit de la même façon : rien après un
    // tiret, donc rien à inventer.
    expect(titreDe({ tagName: 'v0.1.6', name: 'Alpha · 0.1.6' })).toBe('Version 0.1.6');
  });

  it('ne perd pas les points du groupe qui porte le titre', () => {
    const note = entreeDe({
      tagName: 'v0.1.6',
      name: 'Alpha · 0.1.6',
      publishedAt: '2026-10-23T00:13:43Z',
      body: CORPS_ATELIER
    });
    expect(note.titre).toBe('Version 0.1.6');
    // **Le titre de la release est neutre depuis le 29/10/2026** (D-152 (5)) : la ligne en
    // gras du corps n'est donc plus absorbée par le titre, et elle devient l'**étiquette**
    // du groupe — le contenu reste, et il se lit même mieux. Les deux puces sont là ;
    // celles du second groupe gardent leur propre étiquette.
    expect(note.points).toEqual([
      {
        groupe: 'L’Atelier a ses illustrations',
        texte: 'Les 27 cartes de l’Atelier sont illustrées : le pilote #132 est livré.'
      },
      {
        groupe: 'L’Atelier a ses illustrations',
        texte: 'Chaque image est au registre avec sa graine, et la carte porte son art:.'
      },
      { groupe: 'Le gueulage est à part', texte: 'Un gueulage n’est plus étiqueté IP ni OUF (D-085).' }
    ]);
    expect(note.date).toBe('2026-10-23');
    expect(note.brouillon).toBeUndefined();
  });

  it('retire le suffixe d’étape du tag pour retrouver la version de package.json (D-152)', () => {
    // Depuis D-152, le tag s'appelle `v0.1.15-alpha` ; la version, elle, reste `0.1.15`,
    // et `versions.test.ts` la compare telle quelle à `package.json`.
    const note = entreeDe({
      tagName: 'v0.1.15-alpha',
      name: 'v0.1.15-alpha',
      publishedAt: '2026-10-29T00:00:00Z',
      body: '- Une nouveauté.'
    });
    expect(note.version).toBe('0.1.15');
    // Le nom de la release étant le tag, il n'y a pas de suffixe descriptif : le titre
    // retombe sur « Version 0.1.15 », comme la note écrite d'avance.
    expect(note.titre).toBe('Version 0.1.15');

    // Une étape `release` n'a pas de suffixe du tout.
    expect(
      entreeDe({ tagName: 'v1.0.0', name: 'v1.0.0', publishedAt: '2026-12-01T00:00:00Z', body: '- Fin.' }).version
    ).toBe('1.0.0');
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

/**
 * **Le brouillon attendu sur un tag** (D-122).
 *
 * Le tag part **avant** la release (`docs/VERSIONS.md` §4 étapes 5 et 6) : sur `v0.1.14`,
 * `src/data/versions.ts` portait encore la note écrite d'avance, `brouillon: true`, alors que
 * GitHub avait déjà la release publiée. `construire` remplace cette note par celle de la
 * release, le fichier divergeait, et le contrôle du workflow `fichiers-generes.yml` sortait 1
 * sur une procédure respectée. La tolérance est **étroite** : une note, celle de la version de
 * `package.json`, et seulement si le fichier la marque brouillon et que la release est publiée.
 */
describe('notes-versions — le brouillon attendu sur le tag (D-122)', () => {
  const note = (version: string, date: string, brouillon: boolean, points: string[]) => ({
    version,
    date,
    titre: `Version ${version}`,
    points: points.map((texte) => ({ texte })),
    ...(brouillon ? { brouillon: true } : {})
  });

  const VERSION = '0.1.14';
  // Le fichier écrit d'avance : la 0.1.14 en brouillon, la 0.1.13 publiée.
  const brouillonCourant = note(VERSION, '2026-10-27', true, ['ce qui va sortir']);
  const publiee1313 = note('0.1.13', '2026-10-25', false, ['la 0.1.13']);
  const actuel = rendreFichier([brouillonCourant, publiee1313]);
  // Ce que GitHub rend le jour du tag : la release 0.1.14 est publiée, son corps diffère.
  const release1314 = note(VERSION, '2026-10-27', false, ['le corps de la release']);
  const surGithub = [release1314, publiee1313];
  // Ce que `construire` produit : la release remplace le brouillon du même numéro.
  const notes = [release1314, publiee1313];

  it('accepte le seul écart qui est le brouillon de la version courante, déjà publiée', () => {
    // Sans la tolérance, `rendreFichier(notes)` ne dit pas la même chose que le fichier :
    // c'est exactement ce qui faisait sortir 1 sur v0.1.14.
    expect(rendreFichier(notes)).not.toBe(actuel);
    expect(
      verifierNotes({ actuel, notes, surGithub, actuelles: [brouillonCourant, publiee1313], version: VERSION })
    ).toEqual({
      ok: true,
      tolere: true
    });
  });

  it('refuse une version en trop, et le texte modifié d’une version publiée', () => {
    const enTrop = note('0.1.12', '2026-10-20', false, ['la 0.1.12']);
    expect(
      verifierNotes({
        actuel: rendreFichier([brouillonCourant, publiee1313, enTrop]),
        notes,
        surGithub,
        actuelles: [brouillonCourant, publiee1313, enTrop],
        version: VERSION
      })
    ).toEqual({ ok: false, tolere: false });

    const retouchee = note('0.1.13', '2026-10-25', false, ['un texte réécrit à la main']);
    expect(
      verifierNotes({
        actuel: rendreFichier([brouillonCourant, retouchee]),
        notes,
        surGithub,
        actuelles: [brouillonCourant, retouchee],
        version: VERSION
      })
    ).toEqual({ ok: false, tolere: false });
  });

  it('ne tolère rien quand la release de la version courante n’est pas publiée', () => {
    // Sans publication, `construire` garde déjà le brouillon : aucune tolérance ne s'invente.
    expect(
      brouillonAttendu({
        notes: [brouillonCourant, publiee1313],
        surGithub: [publiee1313],
        actuelles: [brouillonCourant, publiee1313],
        version: VERSION
      })
    ).toBeNull();
  });

  it('ne tolère pas le brouillon d’une autre version que celle de package.json', () => {
    const brouillonAutre = note('0.1.13', '2026-10-25', true, ['ce qui va sortir']);
    expect(
      brouillonAttendu({
        notes,
        surGithub,
        actuelles: [release1314, brouillonAutre],
        version: VERSION
      })
    ).toBeNull();
    expect(
      verifierNotes({
        actuel: rendreFichier([release1314, brouillonAutre]),
        notes,
        surGithub,
        actuelles: [release1314, brouillonAutre],
        version: VERSION
      })
    ).toEqual({ ok: false, tolere: false });
  });
});

/** Le chemin du script, pour le message d'erreur des contrôles ci-dessus. */
const CHEMIN = fileURLToPath(new URL('./notes-versions.mjs', import.meta.url));

describe('notes-versions — la commande', () => {
  it('est déclarée dans package.json, et n’ajoute aucune dépendance', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts['notes:versions']).toBe('node scripts/notes-versions.mjs');
    // Le pont avec GitHub est `gh` (la CLI, déjà là) : aucun paquet de plus dans le bundle.
    expect(Object.keys(pkg.dependencies)).not.toContain('@octokit/rest');
    expect(readFileSync(CHEMIN, 'utf8')).toContain("execFileSync('gh'");
  });
});
