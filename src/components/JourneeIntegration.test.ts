import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * La « Journée d'intégration » (#130, D-066) — la mécanique de l'écran.
 *
 * Même technique que `src/pages/Comite.test.ts` : le contrat porte sur la source,
 * donc c'est la source qu'on lit. Ce que le dépôt n'a pas — un rendu de composant en
 * test (`@testing-library/react`, jsdom) — ne s'ajoute pas pour un seul écran
 * (`AGENTS.md` §1, règle 7). L'affichage lui-même se prouve par capture, et le contenu
 * par `journee-etapes.test.ts`.
 *
 * Ce qui est en jeu : elle se montre **une fois** — un chemin de fermeture qui oublierait
 * le drapeau la remontrerait aussitôt, c'est-à-dire « deux fois de suite ».
 */
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

const composant = lire('./JourneeIntegration.tsx');
const etapes = lire('./journee-etapes.ts');
const styles = lire('../styles.css');
const settings = lire('../pages/Settings.tsx');

describe('elle se montre une fois, et se referme (ticket #130)', () => {
  it('tient son ouverture du drapeau `tutorielVu`, pas d’un état local', () => {
    expect(composant).toMatch(/state\.tutorielVu/);
    expect(composant).toMatch(/const ouvert = !tutorielVu && !surLeMur;/);
  });

  it('écrit le drapeau à la fermeture, et remet l’étape à zéro', () => {
    expect(composant).toMatch(/setTutorielVu\(true\)/);
    expect(composant).toMatch(/setEtape\(0\)/);
  });

  it('n’a qu’un seul écrivain du drapeau : toutes les sorties passent par `terminer`', () => {
    // Le panneau n'a plus de `DialogClose` ni d'`onOpenChange` (30/10/2026) : une sortie
    // ajoutée à la main écrirait le drapeau ailleurs, ou pas du tout — et la Journée se
    // remontrerait aussitôt.
    expect(composant).not.toMatch(/DialogClose|onOpenChange/);
    expect(composant.match(/setTutorielVu\(true\)/g)).toHaveLength(1);
    // « Suivant » et le geste avancent ; « Passer » et « Plus tard » sortent par `terminer`.
    expect(composant.match(/onClick=\{terminer\}/g)).toHaveLength(2);
  });

  it('se rouvre depuis Réglages', () => {
    expect(settings).toMatch(/Journée d’intégration/);
    expect(settings).toMatch(/setTutorielVu\(false\)/);
  });
});

describe('le panneau ne se quitte pas par accident (30/10/2026)', () => {
  it('laisse passer le panneau et les éléments désignés, et rien d’autre', () => {
    expect(composant).toMatch(/data-journee-panneau/);
    expect(composant).toMatch(/closest\('\[data-journee-panneau\], \[data-journee-cible\]'\)/);
    // En **capture** sur `document` : avant React, donc avant tout gestionnaire de bouton.
    expect(composant).toMatch(/document\.addEventListener\('click', bloquer, true\)/);
    expect(composant).toMatch(/document\.addEventListener\('pointerdown', bloquer, true\)/);
    expect(composant).toMatch(/evenement\.preventDefault\(\)/);
  });

  it('n’est pas un dialogue modal : pas de fond assombri, la page reste lisible', () => {
    expect(composant).not.toMatch(/aria-modal="true"/);
    expect(composant).not.toMatch(/<Dialog/);
    expect(composant).toMatch(/className="journee"/);
  });

  it('le halo ne déplace rien : un contour, jamais une bordure qui prendrait de la place', () => {
    // **Le contrôle mord** : une `border` sur la cible décalerait le bouton au moment où
    // l'étape le désigne — la mise en page bougerait sous le doigt.
    const regle = styles.match(/\n\[data-journee-cible\] \{([^}]*)\}/)?.[1] ?? '';
    expect(regle).toMatch(/outline:/);
    expect(regle).not.toMatch(/(^|\s)border:/);
  });
});

describe('chaque étape ouvre l’écran qu’elle décrit (D-066)', () => {
  it('lit ses étapes dans `journee-etapes` — une seule source', () => {
    expect(composant).toMatch(/from '@\/components\/journee-etapes'/);
    expect(composant).toMatch(/ETAPES_JOURNEE/);
    expect(etapes).toMatch(/cible: '\/'/);
    expect(etapes).toMatch(/cible: '\/deck'/);
    expect(etapes).toMatch(/cible: '\/battle'/);
    expect(etapes).toMatch(/cible: '\/settings'/);
    expect(etapes).toMatch(/cible: '\/comite'/);
  });

  it('navigue par le routeur, au clic du geste de l’étape', () => {
    expect(composant).toMatch(/useNavigate\(\)/);
    expect(composant).toMatch(/navigate\(courante\.cible\)/);
    expect(composant).toMatch(/\{courante\.action\}/);
  });

  it('ne renvoie pas à une documentation : aucun lien sortant', () => {
    expect(composant).not.toMatch(/href=/);
    expect(composant).not.toMatch(/target="_blank"/);
  });
});

describe('le mur du comité est exclu de la visite (#130)', () => {
  it('s’abstient sur `/comite`, et rien d’autre', () => {
    expect(composant).toMatch(/pathname\.startsWith\('\/comite'\)/);
    // Une seule exclusion : le mur. En combat la visite reste, elle ne fait que passer.
    expect(composant).toMatch(/const surLeMur = pathname\.startsWith\('\/comite'\);/);
    expect(composant.match(/startsWith\(/g)).toHaveLength(1);
  });

  it('ne perd pas la visite : le drapeau n’est pas écrit par l’exclusion', () => {
    // `surLeMur` ne fait que fermer le dialogue ; `terminer` est le seul écrivain du
    // drapeau, et il n’écrit que `true`. Un testeur qui lit le mur d’abord verra donc la
    // visite en le quittant — et l’exclusion ne peut pas la marquer « vue » par erreur.
    expect(composant.match(/setTutorielVu\((true|false)\)/g)).toEqual(['setTutorielVu(true)']);
  });
});
