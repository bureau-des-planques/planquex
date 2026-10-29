import { describe, expect, it } from 'vitest';
import {
  EXCEPTIONS,
  PARCOURS_DEFAUT,
  SEUIL,
  analyserArguments,
  cheminInterne,
  distancesDepuis,
  evaluerParcours,
  routesDeclarees
} from './parcours.mjs';
// @ts-expect-error — `htmlPlanche` vit dans un module .mjs sans déclaration (cf. filmer-animation.test.ts)
import { htmlPlanche } from './filmer-animation.mjs';

/**
 * Le parcours (#429) — sans navigateur, sans rendu : le seuil se confronte à des graphes fabriqués.
 * Le graphe **réel** (l'application rendue) est dans `src/parcours.test.tsx`.
 *
 * **Le contrôle mord** : chaque règle de `evaluerParcours` est confrontée à un cas fautif — un
 * écran à N+1 gestes, un retour manquant, un retour trop long, un écran inatteignable, une
 * exception qui redevient atteignable, un seuil plus haut que la mesure. Une assertion qui ne peut
 * pas échouer ne garde rien (AGENTS.md §6).
 */

/** Une application fabriquée : l'accueil, puis une chaîne `/a` → `/b` → `/c` (trois gestes). */
const chaine = {
  '/': ['/a'],
  '/a': ['/', '/b'],
  '/b': ['/a', '/c'],
  '/c': ['/b', '/']
};

describe('distancesDepuis — les gestes minimaux', () => {
  it('compte les liens suivis depuis la racine', () => {
    const d = distancesDepuis(chaine, '/');
    expect([...d.entries()].sort()).toEqual([
      ['/', 0],
      ['/a', 1],
      ['/b', 2],
      ['/c', 3]
    ]);
  });

  it('prend le plus court chemin, pas le premier', () => {
    const graphe = { '/': ['/a', '/c'], '/a': ['/b'], '/b': ['/c'], '/c': [] };
    expect(distancesDepuis(graphe, '/').get('/c')).toBe(1);
  });
});

describe('evaluerParcours — le contrôle mord', () => {
  const seuil = { aller: 2, retour: 3 };

  it('un écran à N gestes passe au seuil N', () => {
    const { echecs, aller } = evaluerParcours(chaine, { ecrans: ['/a', '/b'], seuil: { aller: 2, retour: 2 } });
    expect(echecs).toEqual([]);
    expect(aller).toBe(2);
  });

  it('un écran à N+1 gestes échoue, avec son nom', () => {
    const { echecs } = evaluerParcours(chaine, { ecrans: ['/a', '/b', '/c'], seuil });
    expect(echecs).toContain('/c : 3 gestes depuis /, au-delà du seuil de 2');
  });

  it('le même graphe passe quand le seuil d’aller est relevé de un : le plafond est la seule cause', () => {
    const { echecs } = evaluerParcours(chaine, { ecrans: ['/a', '/b', '/c'], seuil: { aller: 3, retour: 2 } });
    expect(echecs).toEqual([]);
  });

  it('un écran sans lien de retour échoue, avec son nom', () => {
    const sansRetour = { '/': ['/x'], '/x': ['/y'], '/y': [] };
    const { echecs } = evaluerParcours(sansRetour, { ecrans: ['/x'], seuil: { aller: 1, retour: 1 } });
    expect(echecs).toContain('/x : aucun retour vers /');
  });

  it('un retour qui dépasse le seuil de retour échoue, avec son nom', () => {
    const { echecs } = evaluerParcours(chaine, { ecrans: ['/b'], seuil: { aller: 3, retour: 1 } });
    expect(echecs).toContain('/b : 2 gestes pour revenir à /, au-delà du seuil de 1');
  });

  it('un écran inatteignable, non nommé comme exception, échoue', () => {
    const orphelin = { '/': ['/a'], '/a': ['/'], '/orpheline': ['/'] };
    const { echecs } = evaluerParcours(orphelin, { ecrans: ['/a', '/orpheline'], seuil: { aller: 1, retour: 1 } });
    expect(echecs).toContain('/orpheline : inatteignable depuis /');
  });

  it('une exception nommée reste hors du seuil d’aller, mais son retour est mesuré', () => {
    const orphelin = { '/': ['/a'], '/a': ['/'], '/connexion': ['/'] };
    const { echecs } = evaluerParcours(orphelin, {
      ecrans: ['/a', '/connexion'],
      exceptions: { '/connexion': 'test' },
      seuil: { aller: 1, retour: 1 }
    });
    expect(echecs).toEqual([]);
  });

  it('une exception qui devient atteignable est signalée comme périmée', () => {
    const { echecs } = evaluerParcours(chaine, {
      ecrans: ['/a', '/b'],
      exceptions: { '/b': 'test' },
      seuil: { aller: 2, retour: 2 }
    });
    expect(echecs.some((e) => e.startsWith('/b : exception périmée'))).toBe(true);
  });

  it('le cliquet : un seuil plus haut que la mesure échoue (il se baisse dans le même commit)', () => {
    const { echecs } = evaluerParcours(chaine, { ecrans: ['/a'], seuil: { aller: 5, retour: 3 } });
    expect(echecs.some((e) => e.includes("seuil d'aller 5 trop haut : mesuré 1"))).toBe(true);
  });

  it('une ligne par écran fautif : deux écrans trop loin donnent deux échecs', () => {
    const { echecs } = evaluerParcours(chaine, { ecrans: ['/b', '/c'], seuil: { aller: 1, retour: 3 } });
    expect(echecs.filter((e) => e.includes('au-delà du seuil de 1'))).toHaveLength(2);
  });
});

describe('le seuil publié et les exceptions', () => {
  it('le seuil est un couple d’entiers positifs', () => {
    expect(Number.isInteger(SEUIL.aller) && SEUIL.aller >= 1).toBe(true);
    expect(Number.isInteger(SEUIL.retour) && SEUIL.retour >= 1).toBe(true);
  });

  it('chaque exception dit sa raison', () => {
    for (const [chemin, raison] of Object.entries(EXCEPTIONS)) {
      expect(raison.length, chemin).toBeGreaterThan(10);
    }
  });

  it('les routes se lisent dans App.tsx, sans l’index ni la capture *', () => {
    const source = '<Route path="collection" element={x} /><Route path="*" element={y} /><Route index element={z} />';
    expect(routesDeclarees(source)).toEqual(['/collection']);
  });

  it('un lien interne se réduit à son chemin ; un lien externe n’en est pas un', () => {
    expect(cheminInterne('/battle?x=1#h')).toBe('/battle');
    expect(cheminInterne('https://example.org/')).toBeNull();
    expect(cheminInterne('//example.org')).toBeNull();
    expect(cheminInterne(null)).toBeNull();
  });
});

describe('le parcours filmé', () => {
  it('part de l’accueil et y revient, par la sortie du combat', () => {
    const noms = PARCOURS_DEFAUT.map((e) => e.libelle);
    expect(noms[0]).toBe('Accueil');
    expect(noms.at(-1)).toBe('Accueil revenu');
    expect(noms).toEqual(expect.arrayContaining(['Arrivage ouvert', 'Combat', 'Sortie du combat']));
  });

  it('la planche écrit le libellé de chaque frame à la place de l’instant', () => {
    const html = htmlPlanche([{ src: 'f00.png', libelle: '2. Combat', t: null }], { colonnes: 1, intervalle: 0 });
    expect(html).toContain('2. Combat');
    expect(html).not.toContain('geste 1');
  });

  it('les options inconnues sont refusées, et --graphe prend un fichier', () => {
    expect(() => analyserArguments(['--inconnue'])).toThrow('Option inconnue');
    expect(analyserArguments(['--graphe', 'g.json']).graphe).toBe('g.json');
  });
});
