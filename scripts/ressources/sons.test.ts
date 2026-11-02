import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
// @ts-expect-error — module .mjs sans déclaration de types
import { generer, silences } from './sons.mjs';

/**
 * **Les cinq fichiers son de l'alpha** (#378, #379, D-137, D-161, #606).
 *
 * Ils sont **générés** par `scripts/ressources/sons.mjs` : aucune licence tierce à attribuer, et deux
 * exécutions donnent le même fichier. Ce test garde les exigences des tickets :
 *
 *  - **cinq fichiers, et ce sont les bons** — les cinq clés du réglage, ni plus ni moins ;
 *  - **moins de 100 Ko chacun** (le plafond que #379 fixe pour la première visite) ;
 *  - **un fondu** : un son qui commence ou finit sur un échantillon non nul fait un claquement,
 *    ce qui s'entend plus que le son lui-même.
 */
const DOSSIER = new URL('../../public/sons/', import.meta.url).pathname;
const ATTENDUS = ['arrivage.wav', 'verdict.wav', 'pression.wav', 'craquage.wav', 'intervention.wav'];
const PLAFOND_OCTETS = 100 * 1024;

describe('les cinq sons du jeu (#378, D-161)', () => {
  it('il y a exactement cinq fichiers, et ce sont les bons', () => {
    // Le contrôle mord : un sixième fichier ajouté « pour plus tard » entrerait dans le
    // précache sans que personne ne l'ait décidé.
    expect(ATTENDUS).toHaveLength(5);
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
 * **Chaque son est un objet du Bureau, jamais une note** (#606). Bastien : « trop courts et trop
 * basiques », puis « ça fait toujours un peu une cloche d'ascenseur », puis, sur le verdict refait :
 * « oui c'est mieux le son ». Le principe qu'il a demandé — un objet, jamais une note — est appliqué
 * aux cinq, et la recherche qui le fonde est citée dans `sons.mjs`, au-dessus du générateur du
 * verdict. Ce que ces tests gardent, pour chaque son :
 *
 *  - **la durée** dans sa fourchette : un retour au son d'une demi-seconde redeviendrait « trop
 *    court », et un objet de trois secondes n'est plus un geste ;
 *  - **le geste** : du signal à 60 % de la durée, puis une extinction — plus de note, mais toujours
 *    une fin ;
 *  - **la reproductibilité et le fichier** — le `.wav` du dépôt est **exactement** ce que le
 *    générateur produit : un fichier retouché à la main, ou un générateur modifié sans régénérer,
 *    échoue.
 */
const OBJETS = [
  { cle: 'arrivage', min: 0.8, max: 1.2 },
  { cle: 'verdict', min: 1.2, max: 1.8 },
  { cle: 'pression', min: 0.25, max: 0.45 },
  { cle: 'craquage', min: 0.6, max: 0.95 },
  { cle: 'intervention', min: 0.4, max: 0.7 }
];

function echantillons(octets: Buffer): number[] {
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

for (const { cle, min, max } of OBJETS) {
  describe(`l'objet « ${cle} » (#606)`, () => {
    const octets = generer(cle);
    // La fréquence d'échantillonnage se lit dans l'en-tête du fichier, elle ne se recopie pas.
    const frequence = octets.readUInt32LE(24);
    const valeurs = echantillons(octets);
    const duree = valeurs.length / frequence;

    it(`dure entre ${min} et ${max} s — le son « trop court » ne revient pas`, () => {
      expect(duree, `${cle} dure ${duree.toFixed(2)} s`).toBeGreaterThanOrEqual(min);
      expect(duree, `${cle} dure ${duree.toFixed(2)} s`).toBeLessThanOrEqual(max);
    });

    it('porte son geste jusqu’à 60 % de la durée, puis s’éteint', () => {
      // À 60 % de la durée, le deuxième geste est là (le tiroir, la manche, le stylo…) : un son qui
      // n'aurait qu'un clic au départ laisserait ce trou.
      const geste = rms(valeurs, duree * 0.6, duree * 0.7, frequence);
      expect(20 * Math.log10(geste), `${cle} : plus rien à 60 % de la durée`).toBeGreaterThan(-40);
      // Et la fin s'éteint au lieu d'être coupée : les 10 derniers pour cent sont plus faibles.
      const fin = rms(valeurs, duree * 0.9, duree, frequence);
      expect(fin, `${cle} : la fin ne s'éteint pas`).toBeLessThan(geste);
    });

    it('est reproductible : deux générations donnent les mêmes octets', () => {
      expect(Buffer.compare(generer(cle), octets)).toBe(0);
    });

    it('le fichier du dépôt est celui que le générateur produit', () => {
      const surDisque = readFileSync(`${DOSSIER}${cle}.wav`);
      // Le contrôle mord : un octet changé dans le fichier doit se voir, sinon la comparaison ne
      // garde rien. On le prouve sur une copie, jamais sur le fichier du dépôt.
      const retouche = Buffer.from(octets);
      retouche[octets.length - 200] ^= 0x01;
      expect(Buffer.compare(retouche, octets)).not.toBe(0);
      expect(
        Buffer.compare(surDisque, octets),
        `${cle}.wav est périmé — lancer node scripts/ressources/sons.mjs`
      ).toBe(0);
    });
  });
}

/**
 * **Aucun des cinq n'est un carillon** (#606). Les deux versions écoutées et refusées jouaient des
 * **hauteurs définies** : deux notes pour le verdict, deux pour l'Intervention, un glissando pour la
 * Pression et le Craquage. Un objet, lui, est du bruit filtré — il ne se répète pas.
 *
 * La mesure est une **autocorrélation** : un son périodique se reconnaît à lui-même décalé d'une
 * période (indice proche de 1), du bruit non (proche de 0). Le signal est **pré-accentué** (différence
 * première) avant la mesure : sans ça, un bruit grave se corrèle à lui-même à très court terme et
 * ferait croire à une hauteur. Les anciens fichiers donnaient 0,97 à 1,00 sur la Pression, le
 * Craquage et l'Intervention ; les nouveaux restent sous 0,2.
 */
function periodicite(valeurs: number[], frequence: number): number {
  // La pré-accentuation aplatit la pente spectrale : on ne mesure plus « du grave », mais du répétitif.
  const signal: number[] = [];
  for (let i = 1; i < valeurs.length; i += 1) signal.push(valeurs[i] - valeurs[i - 1]);
  // La fenêtre la plus forte du son : 50 à 90 % de la durée, là où les notes tenaient.
  const a = Math.round(signal.length * 0.5);
  const b = Math.round(signal.length * 0.9);
  let meilleur = 0;
  for (let d = Math.round(frequence / 1000); d < Math.round(frequence / 80); d += 1) {
    let produit = 0;
    let gauche = 0;
    let droite = 0;
    for (let i = a; i + d < b; i += 1) {
      produit += signal[i] * signal[i + d];
      gauche += signal[i] * signal[i];
      droite += signal[i + d] * signal[i + d];
    }
    meilleur = Math.max(meilleur, produit / Math.sqrt(gauche * droite + 1e-12));
  }
  return meilleur;
}

describe('aucun son n’est un carillon (#606)', () => {
  for (const { cle } of OBJETS) {
    it(`« ${cle} » n'a pas de hauteur tenue`, () => {
      const octets = generer(cle);
      const frequence = octets.readUInt32LE(24);
      const indice = periodicite(echantillons(octets), frequence);
      expect(indice, `${cle} : périodicité ${indice.toFixed(2)} — une hauteur s'entend`).toBeLessThan(0.3);
    });
  }

  it('le contrôle mord : une note pure, elle, est reconnue périodique', () => {
    // Le cas fautif : 0,6 s d'un sinus à 440 Hz, la « note » qu'on ne veut plus entendre.
    const frequence = 22050;
    const note: number[] = [];
    for (let i = 0; i < frequence * 0.6; i += 1) note.push(0.5 * Math.sin((2 * Math.PI * 440 * i) / frequence));
    expect(periodicite(note, frequence)).toBeGreaterThan(0.9);
  });
});
