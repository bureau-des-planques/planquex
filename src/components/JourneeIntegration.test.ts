import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * La « Journée d'intégration » (#130, D-066) — la mécanique de l'écran.
 *
 * Même technique que `src/pages/BoiteAIdees.test.ts` : le contrat porte sur la source,
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
const settings = lire('../pages/Settings.tsx');

describe('elle se montre une fois, et se referme (ticket #130)', () => {
  it('tient son ouverture du drapeau `tutorielVu`, pas d’un état local', () => {
    expect(composant).toMatch(/state\.tutorielVu/);
    expect(composant).toMatch(/open=\{!tutorielVu && !surLeMur\}/);
  });

  it('écrit le drapeau à la fermeture, et remet l’étape à zéro', () => {
    expect(composant).toMatch(/setTutorielVu\(true\)/);
    expect(composant).toMatch(/setEtape\(0\)/);
  });

  it('n’a pas de bouton de fermeture à elle : toutes les sorties passent par `terminer`', () => {
    // La croix et Échap viennent du dialogue et passent par `onOpenChange` → `terminer`.
    // Un `DialogClose` ajouté à la main fermerait sans écrire le drapeau : elle se
    // remontrerait aussitôt, et à chaque fermeture.
    expect(composant).not.toMatch(/DialogClose/);
    expect(composant).toMatch(/onOpenChange=\{\(ouvert\) => \{\s*if \(!ouvert\) terminer\(\);/);
  });

  it('se rouvre depuis Réglages', () => {
    expect(settings).toMatch(/Journée d’intégration/);
    expect(settings).toMatch(/setTutorielVu\(false\)/);
  });
});

describe('chaque étape ouvre l’écran qu’elle décrit (D-066)', () => {
  it('lit ses étapes dans `journee-etapes` — une seule source', () => {
    expect(composant).toMatch(/from '@\/components\/journee-etapes'/);
    expect(composant).toMatch(/ETAPES_JOURNEE/);
    expect(etapes).toMatch(/cible: '\/collection'/);
    expect(etapes).toMatch(/cible: '\/'/);
    expect(etapes).toMatch(/cible: '\/deck'/);
    expect(etapes).toMatch(/cible: '\/battle'/);
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

describe('le mur de la Boîte à idées est exclu de la visite (#130)', () => {
  it('s’abstient sur `/idees`, et rien d’autre', () => {
    expect(composant).toMatch(/pathname\.startsWith\('\/idees'\)/);
    // Une seule exclusion : le mur. En combat la visite reste, elle ne fait que passer.
    expect(composant).toMatch(/const surLeMur = pathname\.startsWith\('\/idees'\);/);
    expect(composant.match(/startsWith\(/g)).toHaveLength(1);
  });

  it('ne perd pas la visite : le drapeau n’est pas écrit par l’exclusion', () => {
    // `surLeMur` ne fait que fermer le dialogue ; `terminer` est le seul écrivain du
    // drapeau, et il n’écrit que `true`. Un invité qui lit le mur d’abord verra donc la
    // visite en le quittant — et l’exclusion ne peut pas la marquer « vue » par erreur.
    expect(composant.match(/setTutorielVu\((true|false)\)/g)).toEqual(['setTutorielVu(true)']);
  });
});
