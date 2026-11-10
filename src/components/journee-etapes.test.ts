import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CARTES_MONTREES,
  ETAPES_JOURNEE,
  LOCUTEUR_JOURNEE,
  MOTS_PAR_MINUTE,
  SECONDES_MAX_JOURNEE,
  etapePourChemin,
  indexEtapeGeste,
  libelleSaut,
  motsDeLaReplique,
  nombreDePhrases,
  passeAuGeste,
  secondesDeLaJournee,
  secondesDeLecture,
  tapeAvance,
  tapeTermine
} from './journee-etapes';
import { CARD_BY_ID } from '@/data';
import { MOTS_MAX_REPLIQUE, MOTS_MIN_REPLIQUE, PHRASES_MAX_REPLIQUE } from '@/data/repliques-direction';

/**
 * La « Journée d'intégration » (#130, D-066 ; refonte du 30/10/2026, D-160) — le contenu,
 * mesuré.
 *
 * Ce qu'elle couvre a changé : elle ne redit plus ce que le pas-à-pas du combat explique
 * mieux. Ces tests le gardent — une étape qui reparierait du Poste, du café ou de la
 * Pression en ferait un doublon.
 */
const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');

/** Le texte que le testeur lit vraiment : le titre, la phrase, le geste et la Direction. */
function texteDe(index: number): string {
  const etape = ETAPES_JOURNEE[index];
  return `${etape.titre} ${etape.texte} ${etape.action} ${etape.direction}`;
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

  // **Réécrits le 04/11/2026 (#682, D-181 (3))** : le budget de 60 mots rendus retire la
  // composition de l'Arrivage et le « vingt de ces cartes » du paragraphe. L'intention du
  // test reste : l'étape dit le geste et où il mène, pas la courbe du set (que l'écran montre).
  it('dit d’ouvrir un Arrivage', () => {
    expect(texteDe(0)).toMatch(/Arrivage/);
    expect(texteDe(0)).toMatch(/Ouvre/);
  });

  it('réunit Collection et Deck, et fait charger un Deck proposé', () => {
    expect(texteDe(1)).toMatch(/Collection/);
    expect(texteDe(1)).toMatch(/Deck/);
    expect(texteDe(1)).toMatch(/Charge/);
    expect(texteDe(1)).toMatch(/Deck proposé/);
  });

  it('dit de créer la sauvegarde, seule copie des données', () => {
    expect(texteDe(3)).toMatch(/Crée/);
    expect(texteDe(3)).toMatch(/sauvegarde/);
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
    // **Réécrit le 04/11/2026 (#682)** : l'étape de l'Arrivage ne cite plus la Collection
    // (le budget de 60 mots rendus a coupé la phrase qui l'y menait) ; son écran reste
    // l'accueil, et c'est l'Arrivage qu'elle nomme.
    expect(texteDe(0)).toMatch(/Arrivage/);
    expect(texteDe(1)).toMatch(/Deck/);
    expect(texteDe(4)).toMatch(/comité/);
  });
});

describe('l’étape d’un geste se lit dans les données, jamais dans un numéro (#677)', () => {
  it('retrouve le combat après un réordonnancement, sans index écrit en dur', () => {
    // Le combat passe **en dernier** : un `=== 2` ne le retrouverait plus, et la fin du
    // combat avancerait la visite au mauvais moment.
    const reordonnees = [...ETAPES_JOURNEE.slice(0, 2), ...ETAPES_JOURNEE.slice(3), ETAPES_JOURNEE[2]];
    const index = indexEtapeGeste('combat', reordonnees);
    expect(reordonnees[index].titre).toBe('Le combat');
    expect(index).not.toBe(2);
    // **Le contrôle mord** : un geste absent ne doit pas retomber sur une étape au hasard.
    expect(
      indexEtapeGeste(
        'combat',
        reordonnees.filter((etape) => etape.geste !== 'combat')
      )
    ).toBe(-1);
  });

  it('relie chaque écran à son étape par le chemin, sans la requête (D-162 (4))', () => {
    expect(etapePourChemin('/')).toBe(0);
    expect(etapePourChemin('/deck')).toBe(1);
    // La cible du combat porte une requête (`?tutoriel=1&scene=fin`) : le chemin la retrouve.
    expect(etapePourChemin('/battle')).toBe(2);
    expect(etapePourChemin('/inconnu')).toBe(-1);
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
    // **L'étape du combat compte aussi** (31/10/2026) : sur elle seule, « Terminer »
    // promettait de tout garder alors qu'on perdait l'écran que la Journée voulait montrer.
    expect(libelleSaut(2)).toMatch(/combat/i);
    expect(libelleSaut(2)).not.toMatch(/terminer/i);
    // Passé le combat, il n'y a plus que la fin du parcours à perdre.
    expect(libelleSaut(3)).toMatch(/terminer/i);
    expect(libelleSaut(3)).not.toMatch(/combat/i);
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

describe('la Direction accueille le nouveau (31/10/2026 ; D-195 (2) depuis le 10/11/2026)', () => {
  it('chaque étape a sa réplique, et aucune ne se répète', () => {
    const lignes = ETAPES_JOURNEE.map((etape) => etape.direction);
    for (const [index, ligne] of lignes.entries()) {
      // **Le contrôle mord** : une ligne vide laisserait le panneau sans voix.
      expect(ligne.trim().length, ETAPES_JOURNEE[index].titre).toBeGreaterThan(20);
    }
    expect(new Set(lignes).size).toBe(lignes.length);
  });

  it('chaque réplique fait 25 à 35 mots et 1 à 3 phrases, le nom du locuteur hors compte (D-195 (2), D-186)', () => {
    for (const etape of ETAPES_JOURNEE) {
      const detail = `${etape.titre} : « ${etape.direction} »`;
      expect(motsDeLaReplique(etape), detail).toBeGreaterThanOrEqual(MOTS_MIN_REPLIQUE);
      expect(motsDeLaReplique(etape), detail).toBeLessThanOrEqual(MOTS_MAX_REPLIQUE);
      expect(nombreDePhrases(etape.direction), detail).toBeGreaterThanOrEqual(1);
      expect(nombreDePhrases(etape.direction), detail).toBeLessThanOrEqual(PHRASES_MAX_REPLIQUE);
    }
  });

  it('`motsDeLaReplique` compte la réplique seule : le nom « Chef de cabinet » est hors budget', () => {
    // Trente mots de réplique : le compte dit 30, pas 33 (D-186, décision du 10/11/2026).
    const trente = { ...ETAPES_JOURNEE[0], direction: `${Array.from({ length: 30 }, () => 'mot').join(' ')}.` };
    expect(motsDeLaReplique(trente)).toBe(30);
    expect(`${LOCUTEUR_JOURNEE} ${trente.direction}`.split(/\s+/).filter(Boolean).length).toBe(33);
    // **Le contrôle mord** : l'ancienne réplique de 12 mots (D-181) et une de 60 sortent des bornes.
    const douze = { ...ETAPES_JOURNEE[0], direction: 'un deux trois quatre cinq six sept huit neuf dix onze douze.' };
    expect(motsDeLaReplique(douze)).toBeLessThan(MOTS_MIN_REPLIQUE);
    const soixante = { ...ETAPES_JOURNEE[0], direction: `${Array.from({ length: 60 }, () => 'mot').join(' ')}.` };
    expect(motsDeLaReplique(soixante)).toBeGreaterThan(MOTS_MAX_REPLIQUE);
  });
});

describe('la Journée se lit en 90 s au plus avant la première action (D-195 (2), #782)', () => {
  it('fixe le plafond à 90 s', () => {
    // **Le contrôle mord** : le plafond recopié ailleurs et qui dérive se voit ici.
    expect(SECONDES_MAX_JOURNEE).toBe(90);
  });

  it('tient sous 90 s à 180 mots par minute (la mesure du dépôt) et à 200 (la mesure du ticket)', () => {
    // La somme des titres, textes, libellés de geste et répliques des cinq étapes. Le ticket
    // #782 demande la mesure à 200 mots/min ; le dépôt lit à `MOTS_PAR_MINUTE` (180), plus
    // sévère : les deux doivent passer.
    expect(secondesDeLaJournee(ETAPES_JOURNEE, MOTS_PAR_MINUTE)).toBeLessThanOrEqual(SECONDES_MAX_JOURNEE);
    expect(secondesDeLaJournee(ETAPES_JOURNEE, 200)).toBeLessThanOrEqual(SECONDES_MAX_JOURNEE);
    expect(secondesDeLaJournee()).toBe(secondesDeLaJournee(ETAPES_JOURNEE, MOTS_PAR_MINUTE));
  });

  it('le contrôle mord : cinq répliques de 60 mots dépassent le plafond, aux deux vitesses', () => {
    const soixante = `${Array.from({ length: 60 }, () => 'mot').join(' ')}.`;
    const bavarde = ETAPES_JOURNEE.map((etape) => ({ ...etape, direction: soixante }));
    expect(secondesDeLaJournee(bavarde, MOTS_PAR_MINUTE)).toBeGreaterThan(SECONDES_MAX_JOURNEE);
    expect(secondesDeLaJournee(bavarde, 200)).toBeGreaterThan(SECONDES_MAX_JOURNEE);
  });
});

describe('le geste fait avancer, et le tap ne passe que les étapes sans geste (D-196)', () => {
  it('passeAuGeste : seulement une transition vers « fait », à la même étape', () => {
    expect(passeAuGeste({ etape: 0, fait: false }, 0, true)).toBe(true);
    // **Le contrôle mord** : un geste pas fait ne fait pas avancer.
    expect(passeAuGeste({ etape: 0, fait: false }, 0, false)).toBe(false);
    // **Le contrôle mord** : un geste déjà fait à l'arrivée n'enchaîne rien (« Revoir », #731).
    expect(passeAuGeste({ etape: 0, fait: true }, 0, true)).toBe(false);
    expect(passeAuGeste({ etape: 0, fait: false }, 1, true)).toBe(false);
    expect(passeAuGeste(null, 0, true)).toBe(false);
  });

  it('tapeAvance : une étape sans geste, et pas la dernière', () => {
    const sansGeste = { titre: 'x', texte: 'x', cible: '/', action: 'x', direction: 'x' };
    const avecGeste = { ...sansGeste, geste: 'arrivage' as const };
    expect(tapeAvance(sansGeste, 0, 4)).toBe(true);
    // **Le contrôle mord** : une étape avec geste n'avance jamais au tap.
    expect(tapeAvance(avecGeste, 0, 4)).toBe(false);
    // La dernière étape n'a pas d'étape après elle.
    expect(tapeAvance(sansGeste, 4, 4)).toBe(false);
  });

  it('tapeTermine : seulement la dernière étape sans geste termine la Journée', () => {
    const sansGeste = { titre: 'x', texte: 'x', cible: '/', action: 'x', direction: 'x' };
    const avecGeste = { ...sansGeste, geste: 'deck' as const };
    expect(tapeTermine(sansGeste, 4, 4)).toBe(true);
    // **Le contrôle mord** : une étape avec geste ne termine jamais au tap.
    expect(tapeTermine(avecGeste, 4, 4)).toBe(false);
    // **Le contrôle mord** : une étape sans geste qui n'est pas la dernière ne termine pas.
    expect(tapeTermine(sansGeste, 3, 4)).toBe(false);
  });

  it('chaque étape du parcours a un geste, sauf la dernière (le comité)', () => {
    const sansGeste = ETAPES_JOURNEE.filter((etape) => etape.geste === undefined);
    expect(sansGeste.map((etape) => etape.titre)).toEqual(['Le comité']);
  });
});
