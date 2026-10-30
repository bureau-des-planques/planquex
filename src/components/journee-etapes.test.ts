import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CARTES_MONTREES,
  ETAPES_JOURNEE,
  MOTS_PAR_MINUTE,
  libelleSaut,
  nombreDePhrases,
  secondesDeLecture
} from './journee-etapes';
import { CARD_BY_ID } from '@/data';

/**
 * La « Journée d'intégration » (#130, D-066 ; refonte du 30/10/2026, D-160) — le contenu,
 * mesuré.
 *
 * Ce qu'elle couvre a changé : elle ne redit plus ce que le pas-à-pas du combat explique
 * mieux. Ces tests le gardent — une étape qui reparierait du Poste, du café ou de la
 * Pression en ferait un doublon.
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
  // La route, sans la requête : `?scene=fin` est un état d'écran, pas une route.
  const chemin = cible.split('?')[0];
  if (chemin === '/') return /<Route index element=/.test(app);
  return new RegExp(`path="${chemin.replace(/^\//, '')}"`).test(app);
}

describe('cinq étapes, et plus de recouvrement avec le combat (30/10/2026)', () => {
  it('tient en cinq étapes, dans l’ordre du parcours', () => {
    expect(ETAPES_JOURNEE.map((etape) => etape.titre)).toEqual([
      'L’Arrivage',
      'La Collection et le Deck',
      'Le combat',
      'Tes données',
      'Le comité'
    ]);
  });

  it('ne réexplique pas le combat : elle le remet à son propre tutoriel', () => {
    // Les trois étapes retirées parlaient du Seuil, de la fin d'un combat et du tour de
    // jeu. Une ligne qui les ramènerait ailleurs ferait revivre le doublon : seule l'étape
    // du combat a le droit de nommer ses mots, et seulement pour renvoyer au tutoriel.
    const horsCombat = [0, 1, 3, 4].map((index) => texteDe(index)).join(' ');
    expect(horsCombat).not.toMatch(/Seuil/);
    expect(horsCombat).not.toMatch(/\bcafé\b/);
    expect(horsCombat).not.toMatch(/Conditions/);
    expect(horsCombat).not.toMatch(/Pression/);
    expect(texteDe(2)).toMatch(/combat guidé/);
    expect(texteDe(2)).toMatch(/trois interventions/i);
  });

  it('explique l’Arrivage : cinq cartes, et où elles vont', () => {
    expect(texteDe(0)).toMatch(/Arrivage/);
    expect(texteDe(0)).toMatch(/cinq cartes/);
    expect(texteDe(0)).toMatch(/trois communes/);
    expect(texteDe(0)).toMatch(/rare/);
    expect(texteDe(0)).toMatch(/Collection/);
  });

  it('réunit Collection et Deck, et fait charger un Deck proposé', () => {
    expect(texteDe(1)).toMatch(/Collection/);
    expect(texteDe(1)).toMatch(/Deck/);
    expect(texteDe(1)).toMatch(/vingt cartes/);
    expect(texteDe(1)).toMatch(/Deck proposé/);
  });

  it('dit où vivent les données, et comment les sauver', () => {
    expect(texteDe(3)).toMatch(/navigateur/);
    expect(texteDe(3)).toMatch(/sauvegarde/);
    expect(texteDe(3)).toMatch(/seule copie/);
  });

  it('nomme les deux post-its du comité', () => {
    expect(texteDe(4)).toMatch(/comité/);
    expect(texteDe(4)).toMatch(/IP/);
    expect(texteDe(4)).toMatch(/OUF/);
  });
});

describe('les cartes montrées à l’étape 2 (30/10/2026)', () => {
  it('montre des cartes qui existent au catalogue', () => {
    expect(CARTES_MONTREES.length).toBeGreaterThanOrEqual(5);
    for (const id of CARTES_MONTREES) {
      expect(CARD_BY_ID.has(id), id).toBe(true);
    }
  });

  it('montre une évolution, pas seulement des vannes : flûte → technicien système', () => {
    const technicien = CARD_BY_ID.get('atelier-technicien-systeme');
    expect(technicien && 'evolvesFrom' in technicien ? technicien.evolvesFrom : null).toBe('atelier-joueur-de-flute');
  });

  it('n’est demandée que par l’étape qui en parle', () => {
    const avecCartes = ETAPES_JOURNEE.filter((etape) => etape.montreCartes);
    expect(avecCartes).toHaveLength(1);
    expect(avecCartes[0].titre).toBe('La Collection et le Deck');
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
      expect(etape.cible).toMatch(/^\/[\w-]*(\?[\w=&-]*)?$/);
      expect(`${etape.action} ${etape.cible}`).not.toMatch(/https?:|\.md\b|Wikipédia/i);
    }
  });

  it('ne renvoie pas deux fois au même écran', () => {
    const cibles = ETAPES_JOURNEE.map((etape) => etape.cible.split('?')[0]);
    expect(new Set(cibles).size).toBe(cibles.length);
  });

  it('envoie le combat sur la **fin scriptée** (30/10/2026)', () => {
    // Le testeur la joue, il ne la regarde pas : la position de départ vient du scénario.
    // Le pas-à-pas (tutoriel) **et** la position gagnable (scene) : sans le premier, l'étape
    // promettait un guidage qu'elle n'ouvrait pas (critique du 30/10/2026, P1).
    expect(ETAPES_JOURNEE[2].cible).toBe('/battle?tutoriel=1&scene=fin');
  });

  it('nomme les écrans comme le jeu', () => {
    expect(texteDe(0)).toMatch(/Collection/);
    expect(texteDe(1)).toMatch(/Deck/);
    expect(texteDe(4)).toMatch(/comité/);
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
    for (const [index, etape] of ETAPES_JOURNEE.entries()) {
      expect(texteDe(index), etape.titre).toContain(etape.action);
    }
  });

  it('le libellé du saut nomme le combat tant qu’il reste à voir, puis la fin', () => {
    // **Le contrôle mord** : un saut qui dirait seulement « Passer » laisserait le testeur
    // sauter à l'aveugle. Ce test tombe dès que le libellé ne nomme plus le combat.
    expect(libelleSaut(0)).toMatch(/passer/i);
    expect(libelleSaut(0)).toMatch(/combat/i);
    expect(libelleSaut(1)).toMatch(/combat/i);
    // Passé le combat (index 2), il n'y a plus que la fin du parcours à perdre.
    expect(libelleSaut(2)).toMatch(/terminer/i);
    expect(libelleSaut(2)).not.toMatch(/combat/i);
    expect(libelleSaut(4)).toMatch(/terminer/i);
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

describe('le vocabulaire est celui du jeu, aucun mot interdit (docs/JEU.md §3)', () => {
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
    for (const [index, etape] of ETAPES_JOURNEE.entries()) {
      const texte = texteDe(index);
      for (const mot of MOTS_INTERDITS) {
        expect(texte.toLowerCase(), etape.titre).not.toContain(mot.toLowerCase());
      }
    }
  });

  it('n’emploie pas le vocabulaire d’avant le renommage (HP, onboarding, PV, K.O.) — « Deck » n’en fait plus partie (D-075)', () => {
    for (const [index, etape] of ETAPES_JOURNEE.entries()) {
      const texte = texteDe(index);
      expect(texte, etape.titre).not.toMatch(/\bHP\b|\bPV\b|onboarding|\bK\.O\./i);
    }
  });
});
