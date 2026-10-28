import { describe, expect, it } from 'vitest';
import {
  BANDE_DIRECTION,
  GRAINE_MESURE_DIRECTION,
  GRAINES_DE_LA_POLITIQUE,
  PARTIES_DIRECTION,
  dansLaBande,
  grainesDisjointes,
  intervalleWilson,
  mediane,
  mesurerDirection
} from '@/game/mesure-direction';

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

  it('la médiane des tours se lit sur les parties jouées', () => {
    expect(mediane([])).toBe(0);
    expect(mediane([3])).toBe(3);
    expect(mediane([1, 5])).toBe(3);
    expect(mediane([9, 1, 5])).toBe(5);
  });
});
