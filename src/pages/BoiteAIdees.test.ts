import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fous de la **Boîte à idées** (#129) — même technique que `Deck.test.ts` et
 * `Battle.test.ts` : le contrat porte sur la source, donc c'est la source qu'on lit.
 *
 * Ce qui est en jeu ici n'est pas un détail d'affichage : D-058 dit que le jeu **lit**
 * le fichier et rien d'autre (aucun appel réseau, aucune écriture locale), et D-068 dit
 * que le mur est **une page** dont la bulle est **absente en combat** — les deux se
 * perdraient en silence au premier remaniement.
 */
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

const page = lire('./BoiteAIdees.tsx');
const postit = lire('../components/PostitDuMur.tsx');
const layout = lire('../components/Layout.tsx');
const app = lire('../App.tsx');

describe('le mur lit le fichier, et rien d’autre (D-058)', () => {
  it('lit `docs/boite-a-idees.json` par le contrat, une seule fois', () => {
    expect(page).toMatch(/lireMur\(DOCUMENT_MUR\)/);
    expect(page).not.toMatch(/from '\.\.\/\.\.\/docs/);
  });

  it('ne va chercher aucune donnée ailleurs : pas de réseau, pas de stockage local', () => {
    expect(page).not.toMatch(/fetch\(/);
    expect(page).not.toMatch(/localStorage|sessionStorage/);
  });

  it('ouvre l’adresse du formulaire lue dans le fichier', () => {
    expect(page).toMatch(/href=\{mur\.formulaire\}/);
    expect(page).toMatch(/target="_blank"/);
  });
});

describe('ce que chaque post-it porte (D-068)', () => {
  it('montre la famille, le titre, le texte et le pseudo', () => {
    expect(postit).toMatch(/postit\.kind/);
    expect(postit).toMatch(/postit\.titre/);
    expect(postit).toMatch(/postit\.texte/);
    expect(postit).toMatch(/postit\.pseudo/);
  });

  it('montre le statut, la raison d’un écarté, et le ticket quand il y en a un', () => {
    expect(postit).toMatch(/postit\.statut/);
    expect(postit).toMatch(/postit\.statut === 'écarté' && postit\.raison/);
    expect(postit).toMatch(/issues\/\$\{postit\.ticket\}/);
  });

  it('ne montre aucun compteur de pouces : ils attendent la base (#135)', () => {
    expect(postit).not.toMatch(/ThumbsUp|ThumbsDown/);
    expect(page).not.toMatch(/ThumbsUp|ThumbsDown/);
  });
});

describe('le placement exporte le fichier (D-068)', () => {
  it('exporte depuis l’écran, en téléchargement ou en copie', () => {
    expect(page).toMatch(/exporterMur\(positions\)/);
    expect(page).toMatch(/lien\.download = 'boite-a-idees\.json'/);
    expect(page).toMatch(/navigator\.clipboard\?\.writeText\(fichier\)/);
  });

  it('reste un travail d’écran large', () => {
    expect(page).toMatch(/max-\[899px\]:hidden/);
    expect(page).toMatch(/min-\[421px\]:max-\[899px\]:grid-cols-2/);
  });
});

describe('la bulle (D-058)', () => {
  it('mène au mur, et le mur a sa page', () => {
    expect(app).toMatch(/path="idees"/);
    expect(app).toMatch(/<BoiteAIdees \/>/);
  });

  it('s’efface pendant un combat', () => {
    expect(layout).toMatch(/pathname\.startsWith\('\/battle'\)/);
    expect(layout).toMatch(/\{!enCombat && !surLeMur && <BulleBoiteAIdees \/>\}/);
  });
});
