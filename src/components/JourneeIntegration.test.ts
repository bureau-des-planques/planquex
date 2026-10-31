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
const battle = lire('../pages/Battle.tsx');

describe('elle se montre une fois, et se referme (ticket #130)', () => {
  it('tient son ouverture du drapeau `tutorielVu`, pas d’un état local', () => {
    expect(composant).toMatch(/state\.tutorielVu/);
    // 31/10/2026 : `visible` (le panneau ou sa barre de pause) et `ouvert` (le panneau
    // complet, avec sa garde) sont deux choses — la pause ne bloque rien.
    expect(composant).toMatch(/const visible = !tutorielVu && !surLeCombat;/);
    expect(composant).toMatch(/const ouvert = visible && !enPause;/);
  });

  it('écrit le drapeau à la fermeture, et remet l’étape à zéro', () => {
    expect(composant).toMatch(/setTutorielVu\(true\)/);
    // L'étape vit hors du panneau depuis le 31/10/2026 (le combat la fait avancer).
    expect(composant).toMatch(/remettreJourneeAuDebut\(\)/);
    expect(composant).toMatch(/from '@\/components\/journee-etape'/);
  });

  it('n’a qu’un seul écrivain du drapeau : toutes les sorties passent par `terminer`', () => {
    // Le panneau n'a plus de `DialogClose` ni d'`onOpenChange` (30/10/2026) : une sortie
    // ajoutée à la main écrirait le drapeau ailleurs, ou pas du tout — et la Journée se
    // remontrerait aussitôt.
    expect(composant).not.toMatch(/DialogClose|onOpenChange/);
    expect(composant.match(/setTutorielVu\(true\)/g)).toHaveLength(1);
    // « Suivant » avance ; **deux** sorties passent par `terminer` : le lien de sortie, et
    // « Terminer » de la barre de pause (31/10/2026 — `Échap` ne termine plus).
    expect(composant.match(/onClick=\{terminer\}/g)).toHaveLength(2);
  });

  it('se rouvre depuis Réglages, gestes de session remis à zéro', () => {
    expect(settings).toMatch(/Journée d’intégration/);
    expect(settings).toMatch(/setTutorielVu\(false\)/);
    // **Le contrôle mord** : sans `oublierGestes`, la réouverture affichait « C'est fait »
    // partout et les gestes de session (sauvegarde, combat) ne se redemandaient jamais.
    expect(settings).toMatch(/oublierGestes\(\)/);
  });
});

describe('le panneau ne se quitte pas par accident (30/10/2026)', () => {
  it('laisse passer le panneau et les éléments désignés, et rien d’autre', () => {
    expect(composant).toMatch(/data-journee-panneau/);
    expect(composant).toMatch(/closest\(\s*'\[data-journee-panneau\], \[data-journee-cible\]/);
    // Le pas-à-pas, la main et le plateau passent aussi : ce sont les écrans que la visite
    // traverse, et le panneau s'efface sur `/battle` (31/10/2026).
    expect(composant).toMatch(/\[data-pas-a-pas\], \.hand, \.board/);
    // La scène d'ouverture d'un Arrivage passe au-dessus : sans elle, le testeur ne peut
    // plus fermer son sachet pendant la visite.
    expect(composant).toMatch(/\.ouverture/);
    // En **capture** sur `document` : avant React, donc avant tout gestionnaire de bouton.
    expect(composant).toMatch(/document\.addEventListener\('click', bloquer, true\)/);
    expect(composant).toMatch(/document\.addEventListener\('pointerdown', bloquer, true\)/);
    expect(composant).toMatch(/evenement\.preventDefault\(\)/);
  });

  it('n’est pas un dialogue : une région nommée, qui annonce son étape', () => {
    // **31/10/2026** : `role="dialog" aria-modal="true"` promettait un focus piégé et une
    // page inerte, alors que la garde ne bloque que le pointeur et que `Tab` sortait du
    // panneau. Le marquage mentait ; une région le dit sans mentir, et `aria-live` annonce
    // le changement d'étape — que rien n'annonçait.
    expect(composant).toMatch(/role="region"/);
    expect(composant).not.toMatch(/aria-modal=/);
    expect(composant).toMatch(/aria-live="polite"/);
    expect(composant).not.toMatch(/<Dialog/);
    expect(composant).toMatch(/className="journee"/);
    // Échap **met en pause** : il ne termine plus la visite (abandon définitif au premier
    // réflexe de fermeture). Le panneau prend le focus, pour que le clavier entre dedans.
    expect(composant).toMatch(/evenement\.key === 'Escape'/);
    expect(composant).toMatch(/setEnPause\(true\)/);
    expect(composant).toMatch(/panneauRef\.current\?\.focus\(\)/);
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
    expect(etapes).toMatch(/cible: '\/battle\?tutoriel=1&scene=fin'/);
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

describe('le mur du comité n’est plus exclu (D-161)', () => {
  it('se montre sur toutes les pages, sauf le plateau où son tutoriel parle (D-160)', () => {
    // **Le contrôle mord** : une exclusion réintroduite pour le mur (`surLeMur`) ferait
    // échouer ici. Seul `/battle` l'efface — et c'est le combat qui le dit (31/10/2026) :
    // le recouvrement du pas-à-pas était mesuré à 100 %.
    expect(composant).not.toMatch(/surLeMur/);
    expect(composant).not.toMatch(/startsWith\('\/comite'\)/);
    expect(composant).toMatch(/const surLeCombat = pathname === '\/battle';/);
  });

  it('ne perd pas la visite : le drapeau n’a qu’un écrivain', () => {
    // `terminer` est le seul écrivain, et il n'écrit que `true` : rien ne peut marquer la
    // Journée « vue » par accident.
    expect(composant.match(/setTutorielVu\((true|false)\)/g)).toEqual(['setTutorielVu(true)']);
  });
});

describe('la critique du 30/10/2026, corrigée (31/10/2026)', () => {
  it('l’étape du combat a un geste, et le panneau s’efface sur le plateau', () => {
    // Sans geste, l'étape qui compte se traversait en lecture ; avec le panneau affiché,
    // il recouvrait le pas-à-pas et la garde le gelait.
    expect(etapes).toMatch(/geste: 'combat'/);
    expect(composant).toMatch(/surLeCombat = pathname === '\/battle'/);
    // Le geste est marqué par la fin du combat, jamais par le panneau.
    expect(battle).toMatch(/marquerGeste\('combat'\)/);
    // Et « Continuer » enchaîne sur l'étape suivante, sinon le testeur reste au plateau
    // sans savoir qu'il en reste deux.
    expect(battle).toMatch(/onContinuer=/);
  });

  it('« Montrer le bouton » n’existe que si un geste est attendu, et la cible se compare sans requête', () => {
    // `pathname` n'a pas de requête : l'étape 3 (`/battle?…`) ne pouvait jamais être
    // « sur la page », donc son bouton re-naviguait sans effet.
    expect(composant).toMatch(/pathname === courante\.cible\.split\('\?'\)\[0\]/);
    // Le bouton disparaît aussi **une fois le geste fait** (31/10/2026) : laisser un bouton
    // principal qui ne sert plus à côté d'un « Suivant » en contour inversait la hiérarchie.
    expect(composant).toMatch(/courante\.geste !== undefined && !gesteFait/);
    // Un clic qui ne fait rien se lit comme un bouton cassé : la cible pulse.
    expect(composant).toMatch(/est-montre/);
  });

  it('le saut nomme le combat le jour où on le saute', () => {
    expect(etapes).toMatch(/etape <= ETAPES_JOURNEE\.findIndex/);
  });
});
