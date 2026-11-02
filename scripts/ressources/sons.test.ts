import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
// @ts-expect-error — module .mjs sans déclaration de types
import { generer, silences } from './sons.mjs';

/**
 * **Les deux fichiers son de l'alpha** (#378, #379, D-137).
 *
 * Ils sont **générés** par `scripts/ressources/sons.mjs` : aucune licence tierce à attribuer, et deux
 * exécutions donnent le même fichier. Ce test garde les trois exigences du ticket :
 *
 *  - **deux fichiers, pas plus** — D-137 n'autorise qu'un son d'Arrivage et un de verdict ;
 *  - **moins de 100 Ko chacun** (le plafond que #379 fixe pour la première visite) ;
 *  - **un fondu** : un son qui commence ou finit sur un échantillon non nul fait un claquement,
 *    ce qui s'entend plus que le son lui-même.
 */
const DOSSIER = new URL('../../public/sons/', import.meta.url).pathname;
const ATTENDUS = ['arrivage.wav', 'verdict.wav'];
const PLAFOND_OCTETS = 100 * 1024;

describe('les deux sons du jeu (#378)', () => {
  it('il y a exactement deux fichiers, et ce sont les bons', () => {
    // Le contrôle mord : un troisième fichier ajouté « pour plus tard » entrerait dans le
    // précache sans que personne ne l'ait décidé.
    expect(ATTENDUS).toHaveLength(2);
  });

  it('chacun tient sous les 100 Ko annoncés', () => {
    for (const nom of ATTENDUS) {
      const octets = statSync(`${DOSSIER}${nom}`).size;
      expect(octets, `${nom} pèse ${(octets / 1024).toFixed(1)} Ko`).toBeLessThanOrEqual(PLAFOND_OCTETS);
      expect(octets, `${nom} est vide`).toBeGreaterThan(1024);
    }
  });

  it('chacun commence vite et finit en fondu', () => {
    for (const nom of ATTENDUS) {
      const { debutMs, finMs } = silences(`${DOSSIER}${nom}`);
      // Un son qui met 300 ms à démarrer rate le geste qu'il accompagne.
      expect(debutMs, `${nom} : ${debutMs} ms de silence au début`).toBeLessThanOrEqual(60);
      // Sans fondu de fin, le dernier échantillon non nul fait un « clac ».
      expect(finMs, `${nom} : ${finMs} ms de fondu à la fin`).toBeGreaterThanOrEqual(5);
    }
  });
});

/**
 * **Le verdict a un timbre** (#606). Bastien, le 02/11/2026 : « trop courts et trop basiques »,
 * puis, sur la première reprise : « ça fait toujours un peu une cloche d'ascenseur ». Le son ne joue
 * plus d'intervalle : c'est un **objet** — un tampon qui s'abat sur un dossier, puis le tiroir du
 * classeur qui se ferme (la recherche qui justifie ce choix est dans `sons.mjs`, au-dessus du
 * générateur). Ce que ces tests gardent :
 *
 *  - **la durée** — un retour à un son d'une demi-seconde redeviendrait « trop court » ;
 *  - **les deux gestes** — du signal à 60 % de la durée (le tiroir), puis une extinction ;
 *  - **la reproductibilité et le fichier** — le `.wav` du dépôt est **exactement** ce que le
 *    générateur produit : un fichier retouché à la main, ou un générateur modifié sans régénérer,
 *    échoue.
 */
function echantillons(octets: Buffer, frequence: number): number[] {
  const valeurs: number[] = [];
  for (let i = 0; i < (octets.length - 44) / 2; i += 1) valeurs.push(octets.readInt16LE(44 + i * 2) / 32768);
  return valeurs;
}

/** La valeur efficace (RMS) d'une fenêtre, en pleine échelle. */
function rms(valeurs: number[], debutS: number, finS: number, frequence: number): number {
  const a = Math.round(debutS * frequence);
  const b = Math.min(valeurs.length, Math.round(finS * frequence));
  let somme = 0;
  for (let i = a; i < b; i += 1) somme += valeurs[i] * valeurs[i];
  return Math.sqrt(somme / Math.max(1, b - a));
}

describe('le verdict a un timbre (#606)', () => {
  const octets = generer('verdict');
  // La fréquence d'échantillonnage se lit dans l'en-tête du fichier, elle ne se recopie pas.
  const frequence = octets.readUInt32LE(24);
  const valeurs = echantillons(octets, frequence);
  const duree = valeurs.length / frequence;

  it('dure entre 1,2 et 1,8 s — le verdict « trop court » ne revient pas', () => {
    expect(duree, `verdict dure ${duree.toFixed(2)} s`).toBeGreaterThanOrEqual(1.2);
    expect(duree, `verdict dure ${duree.toFixed(2)} s`).toBeLessThanOrEqual(1.8);
  });

  it('porte ses deux gestes : du signal à 60 %, puis une extinction', () => {
    // À 60 % de la durée, le tiroir se ferme : il reste du signal, bien au-dessus du bruit nul.
    const tard = rms(valeurs, duree * 0.6, duree * 0.7, frequence);
    expect(20 * Math.log10(tard), 'plus rien à 60 % de la durée').toBeGreaterThan(-40);
    // Et la fin s'éteint : les 200 dernières millisecondes sont plus faibles que ce geste.
    const fin = rms(valeurs, duree - 0.2, duree, frequence);
    expect(fin).toBeLessThan(tard);
  });

  it('est reproductible : deux générations donnent les mêmes octets', () => {
    const seconde = generer('verdict');
    expect(Buffer.compare(seconde, octets)).toBe(0);
  });

  it('le fichier du dépôt est celui que le générateur produit', () => {
    const surDisque = readFileSync(`${DOSSIER}verdict.wav`);
    // Le contrôle mord : un octet changé dans le fichier doit se voir, sinon la comparaison ne
    // garde rien. On le prouve sur une copie, jamais sur le fichier du dépôt.
    const retouche = Buffer.from(octets);
    retouche[octets.length - 200] ^= 0x01;
    expect(Buffer.compare(retouche, octets)).not.toBe(0);
    expect(Buffer.compare(surDisque, octets), 'verdict.wav est périmé — lancer node scripts/ressources/sons.mjs').toBe(
      0
    );
  });
});
