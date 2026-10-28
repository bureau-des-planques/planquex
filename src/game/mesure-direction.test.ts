// Lenteur justifiée (D-143 (5)) — des parties entières et seedées pour mesurer la Direction (D-134)
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH_OPTIONS } from '@/game/ia';
import {
  BANDE_DIRECTION,
  GRAINE_MESURE_DIRECTION,
  GRAINES_DE_LA_POLITIQUE,
  PARTIES_DIRECTION,
  RECHERCHE_REJOUABLE,
  TRANCHES_DE_TOURS,
  dansLaBande,
  formatRapportDirection,
  grainesDisjointes,
  intervalleWilson,
  mediane,
  mesurerDirection,
  tauxDe,
  trancheDeTours
} from '@/game/mesure-direction';
import type { PartieDirection } from '@/game/mesure-direction';

/**
 * **La mesure de la Direction mord-elle ?** (#354, D-134)
 *
 * Trois contrôles, et chacun **peut échouer** :
 *
 * 1. **reproductibilité** — deux mesures à graine fixe rendent le **même** rapport (le
 *    chiffre publié n'est pas un tirage) ;
 * 2. **le contrôle mord** — la **même** donnée jugée contre une bande fausse (`50–51 %`)
 *    doit **échouer** le verdict : c'est ce qui prouve que le verdict lit le chiffre et la
 *    bande, et pas une constante ;
 * 3. **graines disjointes** — aucune graine de la mesure n'appartient à celles qui ont
 *    choisi la politique (#111), dans les deux sens.
 *
 * Les parties sont **peu nombreuses et fixes** ici : une mesure de 1 000 parties prend
 * plusieurs minutes, elle est donc une **commande** (`npm run mesure:direction`), jamais un
 * test. Le harnais, lui, se vérifie sur 4 parties.
 */
describe('mesure de la Direction (#354)', () => {
  // 2 parties = 1 paire : le miroir joue les deux sièges, et c'est le minimum qui éprouve
  // le protocole. Une mesure réelle se lance par `npm run mesure:direction`, jamais ici.
  const OPTIONS = { parties: 2, factions: ['ATELIER', 'RH'] as const };

  it('rejoue le même chiffre à graine fixe', () => {
    const sansTemps = (r: ReturnType<typeof mesurerDirection>) => ({
      ...r,
      ia: { ...r.ia, msMoyenne: 0, msP50: 0, msP95: 0, msMax: 0 }
    });
    const une = mesurerDirection(OPTIONS);
    const deux = mesurerDirection(OPTIONS);

    // Le **chiffre** se rejoue à l'identique : taux, issue de chaque partie, verdict.
    // Les durées, elles, sont une **mesure du poste** — elles varient d'un lancement à
    // l'autre et ne font donc pas partie du contrat de reproductibilité.
    expect(sansTemps(deux)).toEqual(sansTemps(une));
    expect(une.parties).toBe(2);
    // Le miroir : chaque paire joue les deux sièges, donc deux parties par paire.
    expect(une.paires).toBe(1);
    expect(une.gagnees + une.perdues + une.nulles).toBe(2);
  });

  it('le contrôle mord : la même donnée échoue contre une bande de 50 à 51 %', () => {
    const rapport = mesurerDirection(OPTIONS);

    // La bande de D-134 juge le chiffre…
    expect(rapport.dansLaBande).toBe(dansLaBande(rapport.taux, BANDE_DIRECTION));
    // …et la **même** donnée, contre une bande fausse, doit sortir de la bande dès que le
    // taux n'y tombe pas. Un contrôle qui répondrait « oui » aux deux ne garderait rien.
    if (rapport.taux < 0.5 || rapport.taux > 0.51) {
      expect(dansLaBande(rapport.taux, { bas: 0.5, haut: 0.51 })).toBe(false);
    }
    // Et le cas fautif est bien un cas fautif : un taux de 60 % n'est pas dans 50–51 %.
    expect(dansLaBande(0.6, { bas: 0.5, haut: 0.51 })).toBe(false);
    expect(dansLaBande(0.5, { bas: 0.5, haut: 0.51 })).toBe(true);
  });

  it('les graines de la mesure sont disjointes de celles de la politique', () => {
    // Aucune graine de la mesure complète n'a servi à choisir la politique…
    expect(grainesDisjointes()).toEqual([]);
    // …et le contrôle mord : la graine 42 du pesage est bien vue comme recouvrante.
    expect(grainesDisjointes(42, 1)).toEqual([42]);
    expect(GRAINES_DE_LA_POLITIQUE).not.toContain(GRAINE_MESURE_DIRECTION);
    expect(PARTIES_DIRECTION / 2).toBe(500);
  });

  it('la bande est celle de D-134, et ses bornes sont des bornes', () => {
    // La bande est un **fait de décision**, pas un réglage : elle s'écrit ici, et une
    // mutation qui l'élargirait (0–100 %) doit tomber sur cette ligne.
    expect(BANDE_DIRECTION).toEqual({ bas: 0.4, haut: 0.6 });
    expect(dansLaBande(0.39, BANDE_DIRECTION)).toBe(false);
    expect(dansLaBande(0.4, BANDE_DIRECTION)).toBe(true);
    expect(dansLaBande(0.6, BANDE_DIRECTION)).toBe(true);
    expect(dansLaBande(0.61, BANDE_DIRECTION)).toBe(false);
    // Une donnée absente n'est jamais « dans la bande » par accident.
    expect(dansLaBande(Number.NaN, BANDE_DIRECTION)).toBe(false);
  });

  it('l’intervalle de Wilson reste borné et se resserre avec le nombre de parties', () => {
    const [basPetit, hautPetit] = intervalleWilson(6, 10);
    const [basGrand, hautGrand] = intervalleWilson(600, 1000);
    expect(hautPetit - basPetit).toBeGreaterThan(hautGrand - basGrand);
    expect(basGrand).toBeGreaterThanOrEqual(0);
    expect(hautGrand).toBeLessThanOrEqual(1);
    // Cas dégénérés : aucune décidée ne rend pas un intervalle fantôme.
    expect(intervalleWilson(0, 0)).toEqual([0, 0]);
    expect(intervalleWilson(100, 100)[1]).toBeLessThanOrEqual(1);
  });

  it('la mesure lit les réglages de l’écran, elle ne les recopie pas (#411)', () => {
    // Un réglage de recherche recopié ici aurait mesuré une politique que plus personne
    // ne joue : la constante **dérive** des défauts, et c'est cette ligne qui le garde.
    expect(RECHERCHE_REJOUABLE).toEqual({ ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity });
    expect(RECHERCHE_REJOUABLE.maxMs).toBe(Infinity);
    const rapport = mesurerDirection(OPTIONS);
    // Le rapport dit **quelle** politique il a mesurée, et avec quels réglages.
    expect(rapport.politique).toBe('recherche');
    expect(rapport.recherche).toEqual(RECHERCHE_REJOUABLE);
    expect(formatRapportDirection(rapport)).toContain('Direction : recherche');
  });

  it('la politique de la Direction est un paramètre, la référence non (#411)', () => {
    const glouton = mesurerDirection({ ...OPTIONS, politique: 'glouton' });
    expect(glouton.politique).toBe('glouton');
    // La référence reste la politique scriptée : ses parties sont les mêmes graines,
    // donc le miroir existe toujours (2 parties, 1 paire).
    expect(glouton.parties).toBe(2);
    expect(glouton.paires).toBe(1);
    expect(formatRapportDirection(glouton)).toContain('Direction : glouton');
  });

  it('le travail se compte en nœuds, pas seulement en millisecondes (#411)', () => {
    const cherche = mesurerDirection(OPTIONS);
    // La recherche travaille : le compte est positif et par décision.
    expect(cherche.ia.coups).toBeGreaterThan(0);
    expect(cherche.ia.noeuds).toBeGreaterThan(0);
    expect(cherche.ia.noeudsParDecision).toBeGreaterThan(0);
    // La politique scriptée ne cherche rien : zéro nœud, et le chiffre reste lisible.
    const scripte = mesurerDirection({ ...OPTIONS, politique: 'scripte' });
    expect(scripte.ia.noeuds).toBe(0);
    expect(scripte.ia.noeudsParDecision).toBe(0);
    // La mesure reste complète sans nœuds : les parties sont jouées, le chiffre se lit.
    expect(scripte.decidees + scripte.nulles).toBe(2);
  });

  it('les nulles ne comptent ni pour ni contre, et un agrégat vide ne vaut jamais 0 %', () => {
    const partie = (issue: PartieDirection['issue']): PartieDirection => ({
      paire: 0,
      seed: 1,
      siege: 'ai',
      direction: 'DIRECTION',
      reference: 'RH',
      issue,
      tours: 12,
      raison: 'interventions'
    });
    const taux = tauxDe([partie('gagnee'), partie('perdue'), partie('nulle')]);
    expect(taux).toMatchObject({ parties: 3, decidees: 2, gagnees: 1, perdues: 1, nulles: 1 });
    expect(taux.taux).toBe(0.5);
    // La borne qui compte : aucune décidée n'est « 0 % », c'est « on ne sait pas ».
    expect(tauxDe([]).taux).toBe(Number.NaN);
    expect(tauxDe([partie('nulle')]).taux).toBe(Number.NaN);
    expect(tauxDe([partie('nulle')]).decidees).toBe(0);
  });

  it('les agrégats se recoupent avec le chiffre global, et la limite lue est celle du moteur', () => {
    const rapport = mesurerDirection(OPTIONS);
    const somme = (lignes: readonly { parties: number }[]) => lignes.reduce((n, l) => n + l.parties, 0);
    expect(somme(rapport.parFaction)).toBe(rapport.parties);
    expect(somme(rapport.parFin)).toBe(rapport.parties);
    expect(somme(rapport.parTour)).toBe(rapport.parties);
    expect(rapport.parFaction.reduce((n, l) => n + l.decidees, 0)).toBe(rapport.decidees);
    expect(rapport.parFaction.reduce((n, l) => n + l.gagnees, 0)).toBe(rapport.gagnees);
    // Chaque ligne porte son propre taux : une ligne décidée ne rend pas `NaN`.
    for (const ligne of rapport.parFaction.filter((l) => l.decidees > 0)) {
      expect(ligne.taux).toBeCloseTo(ligne.gagnees / ligne.decidees, 10);
    }
    // Les tranches couvrent la partie entière, sans trou ni recouvrement.
    expect(rapport.parTour.map((l) => l.tranche)).toEqual(TRANCHES_DE_TOURS.map((t) => `${t.debut}–${t.fin}`));
    // Les égalités sont celles du **moteur** (`TURN_LIMIT`, 30 tours), pas du harnais :
    // `maxTurns` ne peut pas mordre une partie que le moteur arrête avant lui.
    expect(rapport.limiteMoteur).toBeLessThan(rapport.maxTurns);
    expect(rapport.nullesAuHarnais).toBe(0);
    expect(rapport.nullesALaLimite).toBeLessThanOrEqual(rapport.nulles);
    // Le contrôle mord : la borne haute du moteur est bien comptée, la suivante non.
    expect(trancheDeTours(rapport.limiteMoteur)).toBe(`${21}–${rapport.limiteMoteur}`);
    expect(trancheDeTours(0)).toBeNull();
  });

  it('la médiane des tours se lit sur les parties jouées', () => {
    expect(mediane([])).toBe(0);
    expect(mediane([3])).toBe(3);
    expect(mediane([1, 5])).toBe(3);
    expect(mediane([9, 1, 5])).toBe(5);
  });
});
