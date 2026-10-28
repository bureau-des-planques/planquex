import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ETAPES_JOURNEE, MOTS_PAR_MINUTE, libelleSaut, nombreDePhrases, secondesDeLecture } from './journee-etapes';

/**
 * La « Journée d'intégration » (#130, D-066) — le contenu, mesuré.
 *
 * Le ticket demande quatre choses précises, **trente secondes de lecture par étape au
 * maximum**, et le vocabulaire d'`AGENTS.md` §3. Ces trois exigences se vérifient sur
 * les données elles-mêmes : les étapes vivent dans `./journee-etapes`, donc un test les
 * lit sans monter de navigateur. Ce qu'il ne prouve pas — qu'elles **s'affichent** et
 * qu'elles **ouvrent leur écran** — est gardé par `JourneeIntegration.test.ts` et par la
 * capture de l'écran.
 */
const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');

/** Le texte que le testeur lit vraiment : le titre, la phrase et le libellé du geste. */
function texteDe(index: number): string {
  const etape = ETAPES_JOURNEE[index];
  return `${etape.titre} ${etape.texte} ${etape.action}`;
}

/**
 * Une route de `src/App.tsx`. L'accueil s'y déclare par `index`, les autres par
 * `path`. On lit la source du routeur au lieu de recopier la liste : une étape qui
 * pointerait vers un écran supprimé échouerait ici.
 */
function routeDeclaree(cible: string): boolean {
  if (cible === '/') return /<Route index element=/.test(app);
  return new RegExp(`path="${cible.replace(/^\//, '')}"`).test(app);
}

describe('les cinq choses qu’un testeur ne devine pas (#130, D-136)', () => {
  it('tient en cinq étapes : les quatre de #130 et le tour de jeu (#334)', () => {
    expect(ETAPES_JOURNEE).toHaveLength(5);
    expect(ETAPES_JOURNEE[4].titre).toBe('Le tour de jeu');
    expect(ETAPES_JOURNEE[4].geste).toBe('tour');
  });

  it('explique le Seuil et le Stress, et que le Stress monte', () => {
    expect(texteDe(0)).toMatch(/Seuil/);
    expect(texteDe(0)).toMatch(/Stress/);
    expect(texteDe(0)).toMatch(/monte/);
  });

  it('explique l’Arrivage : cinq cartes, et comment on en obtient', () => {
    expect(texteDe(1)).toMatch(/Arrivage/);
    expect(texteDe(1)).toMatch(/cinq cartes/);
    expect(texteDe(1)).toMatch(/trois communes/);
    expect(texteDe(1)).toMatch(/rare/);
  });

  it('explique le Deck : vingt cartes, deux exemplaires, un Entrant, les types de café', () => {
    expect(texteDe(2)).toMatch(/Deck/);
    expect(texteDe(2)).toMatch(/vingt cartes/);
    expect(texteDe(2)).toMatch(/deux exemplaires/);
    expect(texteDe(2)).toMatch(/Planqué Entrant/);
    expect(texteDe(2)).toMatch(/types de café/);
  });

  it('explique la fin d’un combat : trois Interventions, le COMEX, la relève', () => {
    expect(texteDe(3)).toMatch(/trois Interventions/);
    expect(texteDe(3)).toMatch(/COMEX/);
    expect(texteDe(3)).toMatch(/relève/);
  });
});

describe('chaque étape ouvre l’écran qu’elle décrit (D-066)', () => {
  it('vise une route qui existe dans `src/App.tsx`', () => {
    for (const etape of ETAPES_JOURNEE) {
      expect(routeDeclaree(etape.cible), etape.cible).toBe(true);
    }
  });

  it('n’envoie nulle part ailleurs qu’à l’écran : ni URL externe, ni documentation', () => {
    for (const etape of ETAPES_JOURNEE) {
      expect(etape.cible).toMatch(/^\/[\w-]*$/);
      expect(`${etape.action} ${etape.cible}`).not.toMatch(/https?:|\.md\b|Wikipédia/i);
    }
  });

  it('ne renvoie pas deux fois au même écran, sauf le tour de jeu qui mène au combat (#334)', () => {
    const cibles = ETAPES_JOURNEE.map((etape) => etape.cible);
    // Le tour de jeu se **fait dans le dialogue** ; son bouton ne fait qu'ouvrir le combat
    // où le geste se rejoue — le même écran que « la fin d'un combat », et c'est voulu.
    const horsTour = ETAPES_JOURNEE.filter((etape) => !etape.geste).map((etape) => etape.cible);
    expect(new Set(horsTour).size).toBe(horsTour.length);
    expect(cibles).toHaveLength(5);
  });
});

describe('deux phrases au plus et un seul geste par étape (D-136)', () => {
  it('aucune étape ne dépasse deux phrases', () => {
    for (const etape of ETAPES_JOURNEE) {
      expect(nombreDePhrases(etape.texte), etape.titre).toBeLessThanOrEqual(2);
    }
  });

  it('chaque étape a son geste, et son libellé est unique', () => {
    const actions = ETAPES_JOURNEE.map((etape) => etape.action);
    expect(new Set(actions).size).toBe(actions.length);
    // Une seule étape se joue dans le dialogue : le tour de jeu.
    expect(ETAPES_JOURNEE.filter((etape) => etape.geste === 'tour')).toHaveLength(1);
  });

  it('le libellé du saut nomme ce qui est perdu (#334)', () => {
    // **Le contrôle mord** : un saut qui dirait seulement « Passer » laisserait le testeur
    // sauter à l'aveugle — ce test tombe dès que le libellé ne nomme plus le tour de jeu.
    expect(libelleSaut(0)).toMatch(/passer/i);
    expect(libelleSaut(0)).toMatch(/tour de jeu/i);
    // Sur l'étape du tour, il est encore à venir : le saut le nomme toujours.
    expect(libelleSaut(4)).toMatch(/tour de jeu/i);
    // Une fois le tour joué, il n'y a plus rien à perdre : le bouton ne promet plus de perte.
    expect(libelleSaut(4, true)).toMatch(/terminer/i);
    expect(libelleSaut(4, true)).not.toMatch(/tour de jeu/i);
  });
});

describe('trente secondes de lecture par étape au maximum (ticket #130)', () => {
  it('mesure la lecture à 180 mots par minute, et le dit', () => {
    expect(MOTS_PAR_MINUTE).toBe(180);
  });

  it('tient dans les trente secondes, titre et geste compris', () => {
    for (const etape of ETAPES_JOURNEE) {
      expect(secondesDeLecture(etape), etape.titre).toBeLessThanOrEqual(30);
    }
  });
});

describe('le vocabulaire est celui du jeu, aucun mot interdit (AGENTS.md §3)', () => {
  /**
   * La liste qui fait foi est `FORBIDDEN_ANY_CASE` (`src/data/cards.test.ts`), et c'est
   * la copie du tutoriel ci-dessous. Deux raisons de ne pas l'importer : c'est un
   * fichier de test (l'importer rejouerait ses `describe`), et `AGENTS.md` §8.4 exige
   * **zéro** occurrence du mot dans `src/`, tests compris — d'où les fragments.
   */
  const MOTS_INTERDITS = [
    'Gal' + 'ère',
    'Gal' + 'èreMon',
    'Grèvomon',
    'Pokémon',
    'Galérodex',
    'Open-space',
    'Bac à courrier',
    'Reprise de poste'
  ];

  it('n’emploie aucun mot interdit', () => {
    for (const etape of ETAPES_JOURNEE) {
      const texte = texteDe(ETAPES_JOURNEE.indexOf(etape));
      for (const mot of MOTS_INTERDITS) {
        expect(texte.toLowerCase()).not.toContain(mot.toLowerCase());
      }
    }
  });

  it('n’emploie pas le vocabulaire d’avant le renommage (HP, onboarding, PV, K.O.) — « Deck » n’en fait plus partie (D-075)', () => {
    for (const etape of ETAPES_JOURNEE) {
      const texte = texteDe(ETAPES_JOURNEE.indexOf(etape));
      expect(texte).not.toMatch(/\bHP\b|\bPV\b|onboarding|\bK\.O\./i);
    }
  });

  it('nomme les écrans comme le jeu : Collection, Arrivage, Deck, Combat', () => {
    expect(texteDe(0)).toMatch(/Collection/);
    expect(texteDe(2)).toMatch(/Deck/);
    expect(texteDe(3)).toMatch(/combat/);
  });
});
