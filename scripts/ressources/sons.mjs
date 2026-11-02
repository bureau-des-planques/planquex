#!/usr/bin/env node
/**
 * **Les sons de l'alpha** (#378, #379, D-137 ; trois sons de combat depuis D-161) — générés, pas
 * téléchargés.
 *
 * D-137 demande des sons libres, documentés, et **aucun asset repris** des versions
 * abandonnées. Plutôt que de chercher une banque sous licence (et de dépendre de ses conditions),
 * on **fabrique** les deux timbres ici : du bruit filtré et deux oscillateurs. Conséquences :
 *
 *  - **aucune licence tierce** : l'œuvre est celle du projet, il n'y a rien à attribuer ;
 *  - **reproductible** : le générateur est seedé, les fichiers se régénèrent à l'identique ;
 *  - **léger** : des WAV mono 22,05 kHz de une à deux secondes, sous 100 Ko chacun (le ticket #379
 *    fixe la barre). Le verdict a été rallongé et enrichi le 02/11/2026 (#606) : quatre couches, des
 *    partiels inharmoniques et une queue réverbérée sur une impulsion synthétisée ici.
 *
 * Usage :
 *   node scripts/ressources/sons.mjs            # écrit public/sons/*.wav (cinq sons)
 *   node scripts/ressources/sons.mjs --verifier # ne réécrit rien, vérifie poids et silences (CI)
 *
 * Le WAV est volontairement **non compressé** : la machine n'a pas d'encodeur audio, et un WAV
 * court reste plus petit que la barre des 100 Ko. Un jour, un `.opus` le remplacera sans changer
 * le module qui les joue.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const DOSSIER = join(RACINE, 'public/sons');
const FREQUENCE = 22050;
const PLAFOND_OCTETS = 100 * 1024;

/** Un générateur seedé : deux exécutions donnent le même fichier, octet pour octet. */
function graine(depart) {
  let s = depart >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Un filtre passe-bande à un pôle, suffisant pour donner du corps à du bruit. */
function passeBande(entree, frequence, largeur) {
  const sortie = new Float32Array(entree.length);
  const w0 = (2 * Math.PI * frequence) / FREQUENCE;
  const alpha = Math.sin(w0) * largeur;
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < entree.length; i += 1) {
    const x = entree[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    sortie[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return sortie;
}

/** Une enveloppe : montée douce, tenue, chute exponentielle. */
function enveloppe(n, { attaque = 0.01, chute = 0.12 } = {}) {
  const env = new Float32Array(n);
  const a = Math.max(1, Math.round(attaque * FREQUENCE));
  const d = Math.max(1, Math.round(chute * FREQUENCE));
  for (let i = 0; i < n; i += 1) {
    const montee = i < a ? i / a : 1;
    const reste = n - i;
    const fin = reste < d ? reste / d : 1;
    env[i] = montee * fin * fin;
  }
  return env;
}

/**
 * Une enveloppe de **décroissance naturelle** (#606) : attaque linéaire courte, puis une
 * exponentielle qui s'éteint sans jamais être coupée. `tau` est la constante de temps, en secondes.
 */
function declin(n, { attaque = 0.004, tau = 0.2 } = {}) {
  const env = new Float32Array(n);
  const a = Math.max(1, Math.round(attaque * FREQUENCE));
  const k = 1 / (Math.max(0.001, tau) * FREQUENCE);
  for (let i = 0; i < n; i += 1) {
    const montee = i < a ? i / a : 1;
    env[i] = montee * Math.exp(-i * k);
  }
  return env;
}

/**
 * Un sinus dont la fréquence **glisse** de `de` vers `a` (#606). La phase est intégrée : une
 * fréquence écrite à la main dans `Math.sin(2π f(t) t)` déphase et fait des sauts de hauteur.
 */
function glissando(n, { de, a, tau = 0.1 }) {
  const sortie = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / FREQUENCE;
    const f = a + (de - a) * Math.exp(-t / tau);
    phase += (2 * Math.PI * f) / FREQUENCE;
    sortie[i] = Math.sin(phase);
  }
  return sortie;
}

/**
 * **La réverbération** (#606) : une impulsion **synthétisée ici**, pas un fichier tiers — du bruit
 * filtré qui s'éteint en exponentielle, ramené à une énergie unitaire pour que le mélange se règle
 * sur un seul coefficient. Aucune licence, et deux exécutions donnent la même impulsion.
 */
function impulsion({ duree = 0.9, preDelai = 0.016, tau = 0.3, brillance = 0.45 } = {}) {
  const n = Math.round(duree * FREQUENCE);
  const ir = new Float32Array(n);
  const alea = graine(9001);
  const d = Math.round(preDelai * FREQUENCE);
  let bas = 0; // un pôle : les aigus s'éteignent avant les graves, comme dans une salle
  let energie = 0;
  for (let i = d; i < n; i += 1) {
    bas += (alea() * 2 - 1 - bas) * brillance;
    ir[i] = bas * Math.exp(-(i - d) / (tau * FREQUENCE));
    energie += ir[i] * ir[i];
  }
  const norme = Math.sqrt(energie) || 1;
  for (let i = 0; i < n; i += 1) ir[i] /= norme;
  return ir;
}

/** La convolution sèche/mouillée, en clair : le noyau est court, le coût reste sous la seconde. */
function convoluer(signal, noyau) {
  const sortie = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i += 1) {
    const limite = Math.min(i + 1, noyau.length);
    let somme = 0;
    for (let j = 0; j < limite; j += 1) somme += signal[i - j] * noyau[j];
    sortie[i] = somme;
  }
  return sortie;
}

/** Ajoute une queue réverbérée au signal sec : c'est ce qui donne de la **matière**. */
function reverberer(signal, { melange = 0.45, ...impulsionOptions } = {}) {
  const queue = convoluer(signal, impulsion(impulsionOptions));
  for (let i = 0; i < signal.length; i += 1) signal[i] += queue[i] * melange;
  return signal;
}

/**
 * Un grain de bruit filtré, posé dans `sortie` à `debut` : la brique du froissement, du frottement et
 * des impacts mats (#606). `aleatoire` est le générateur seedé **du son qui l'appelle**, pour que
 * l'ordre des tirages reste celui de ce son.
 */
function poser(sortie, debut, longueur, frequence, largeur, gain, tau, aleatoire) {
  const bruit = new Float32Array(longueur);
  for (let i = 0; i < longueur; i += 1) bruit[i] = aleatoire() * 2 - 1;
  const filtre = passeBande(bruit, frequence, largeur);
  const env = declin(longueur, { attaque: 0.0004, tau });
  for (let i = 0; i < longueur && debut + i < sortie.length; i += 1) sortie[debut + i] += filtre[i] * env[i] * gain;
}

/**
 * L'ambiance d'un objet posé sur le bureau (#606) : une réverbération **courte et discrète**, pour que
 * les cinq sons soient dans la même pièce sans sonner comme une salle de concert.
 */
function ambiance(signal, melange = 0.14) {
  return reverberer(signal, { melange, duree: 0.35, preDelai: 0.008, tau: 0.09 });
}

/**
 * **Arrivage** : le sachet de café qu'on ouvre (#606, repris le 02/11/2026). Le film craque sous les
 * doigts, la déchirure ouvre le sachet, puis l'air s'échappe — le **souffle** qui se dégonfle et le
 * **claquement** du film qui retombe. La version d'avant finissait sur un « pop » **sinusoïdal** :
 * une note grave, donc un son musical au milieu d'un bruit. Remplacé par deux bruits filtrés.
 */
function arrivage() {
  const duree = 0.95;
  const n = Math.round(duree * FREQUENCE);
  const sortie = new Float32Array(n);
  const alea = graine(283);

  // 1. les grains du film : neuf craquements courts, espacés irrégulièrement
  let curseur = 0;
  for (let g = 0; g < 11; g += 1) {
    const debut = Math.round((0.02 + curseur) * FREQUENCE);
    const longueur = Math.round((0.018 + alea() * 0.03) * FREQUENCE);
    const bruit = new Float32Array(longueur);
    for (let i = 0; i < longueur; i += 1) bruit[i] = (alea() * 2 - 1) * 0.6;
    const filtre = passeBande(bruit, 1500 + alea() * 2600, 0.9);
    const env = enveloppe(longueur, { attaque: 0.002, chute: 0.02 });
    for (let i = 0; i < longueur && debut + i < n; i += 1) sortie[debut + i] += filtre[i] * env[i] * 1.6;
    curseur += 0.045 + alea() * 0.035;
  }

  // 2. la déchirure : du bruit qui descend, sur le dernier tiers
  const debutDechirure = Math.round(0.42 * FREQUENCE);
  const reste = n - debutDechirure;
  const bruit = new Float32Array(reste);
  for (let i = 0; i < reste; i += 1) bruit[i] = (alea() * 2 - 1) * 0.5;
  const filtre = passeBande(bruit, 2600, 0.6);
  const envDechirure = enveloppe(reste, { attaque: 0.03, chute: 0.16 });
  for (let i = 0; i < reste; i += 1) sortie[debutDechirure + i] += filtre[i] * envDechirure[i] * 1.1;

  // 3. le claquement du film : le bord qui se détend d'un coup, 8 ms de bruit large — pas de note
  poser(sortie, Math.round(0.6 * FREQUENCE), Math.round(0.012 * FREQUENCE), 1400, 1.9, 1.8, 0.004, alea);

  // 4. le souffle : l'air du sachet qui se dégonfle. Du bruit **grave** (autour de 400 Hz), lent à
  //    s'ouvrir, avec la turbulence d'un écoulement : aucune hauteur, juste de l'air.
  const debutSouffle = Math.round(0.62 * FREQUENCE);
  const nSouffle = Math.min(Math.round(0.32 * FREQUENCE), n - debutSouffle);
  const bruitSouffle = new Float32Array(nSouffle);
  for (let i = 0; i < nSouffle; i += 1) bruitSouffle[i] = alea() * 2 - 1;
  const souffle = passeBande(bruitSouffle, 420, 1.4);
  const secours = passeBande(bruitSouffle, 1100, 0.9);
  let turbulence = 1;
  let prochaine = 0;
  for (let i = 0; i < nSouffle; i += 1) {
    const t = i / FREQUENCE;
    const ouverture = Math.min(1, t / 0.05) * Math.exp(-t / 0.12);
    if (i >= prochaine) {
      turbulence = 0.65 + alea() * 0.35;
      prochaine = i + Math.round((0.008 + alea() * 0.012) * FREQUENCE);
    }
    sortie[debutSouffle + i] += (souffle[i] + secours[i] * 0.35) * ouverture * turbulence * 1.4;
  }

  return ambiance(sortie, 0.18);
}

/**
 * **Verdict** : le geste qui classe un dossier — le tampon s'abat, puis le tiroir du classeur se
 * ferme. Deuxième passe du 02/11/2026 (#606), après l'écoute de la première : « ça fait toujours un
 * peu une cloche d'ascenseur ».
 *
 * ### Pourquoi un objet, et pas un carillon — la recherche en cinq lignes
 *
 * Deux hauteurs **définies** et un intervalle (la quinte puis la tonique) s'écoutent comme une
 * **mélodie** ; un timbre frappé qui joue une mélodie, c'est un carillon. Ce que dit la recherche :
 *
 *  - un impact est une somme de modes qui s'éteignent, mais c'est un spectre **non harmonique et
 *    clairsemé** qui fait reconnaître un objet, et ses modes hauts meurent vite (van den Doel & Pai,
 *    *The Sounds of Physical Shapes*, Presence 7(4) 1998, https://doi.org/10.1162/105474698565794) ;
 *  - on entend une **source et un événement**, pas des hauteurs — « écoute quotidienne » contre
 *    « écoute musicale » (Rocchesso & Fontana, *The Sounding Object*, 2003, http://www.soundobject.org) ;
 *  - le **papier froissé** est un squelette de micro-flambages très courts, enrichi d'événements
 *    aléatoires en loi de puissance : des clics, jamais une texture tonale (Zheng & James, *Crumpling
 *    sound synthesis*, ACM TOG 2016, https://doi.org/10.1145/2980179.2982400) ;
 *  - le **frottement** est fait de myriades de micro-contacts ; en grains de 2 à 20 ms recouverts, il
 *    tend vers du bruit coloré (DAFx-15, *Morphing of granular sounds*,
 *    https://www.dafx.de/paper-archive/2015/DAFx-15_submission_7.pdf) ;
 *  - donc un son d'objet se fabrique en **filtrant du bruit dans le temps**, pas en empilant des
 *    oscillateurs (NoiseBandNet, https://arxiv.org/abs/2307.08007 ; Farnell, *Designing Sound*, 2010).
 *
 * ### Ce que fait ce générateur
 *
 * 1. **le tampon** — un impact mat : bruit large bande de 50 ms et une masse très grave qui retombe
 *    de 78 à 46 Hz en 35 ms. Aucune hauteur tenue : un « toc », pas une note ;
 * 2. **le froissement du papier** — des grains de 4 à 18 ms, bande haute, qui se recouvrent et
 *    s'essoufflent, sans composante tonale ;
 * 3. **le tiroir** — un glissement de 330 ms (bruit frotté, trois bandes, modulation irrégulière) ;
 * 4. **la butée** — un claquement sec, un « clonk » grave, et deux résonances **inharmoniques**
 *    (1 180 et 2 790 Hz) qui meurent en 25 ms : du métal, pas un accord ;
 * 5. **l'ambiance** — une réverbération courte (0,35 s) et discrète : un objet dans une pièce, pas
 *    une salle de concert.
 */
function verdict() {
  const duree = 1.45;
  const n = Math.round(duree * FREQUENCE);
  const sec = new Float32Array(n);
  const alea = graine(379);

  // 1. le tampon : impact mat (bruit large) + la masse qui retombe dessous
  poser(sec, 0, Math.round(0.05 * FREQUENCE), 900, 1.8, 1.7, 0.008, alea);
  const nMasse = Math.round(0.12 * FREQUENCE);
  const masse = glissando(nMasse, { de: 78, a: 46, tau: 0.018 });
  const envMasse = declin(nMasse, { attaque: 0.0015, tau: 0.03 });
  for (let i = 0; i < nMasse; i += 1) sec[i] += masse[i] * envMasse[i] * 0.75;

  // 2. le froissement : des grains serrés qui se recouvrent et s'essoufflent
  let curseur = 0.035;
  while (curseur < 0.33) {
    const grain = 0.004 + alea() * 0.014;
    const essoufflement = 1 - (curseur - 0.035) / 0.3;
    poser(
      sec,
      Math.round(curseur * FREQUENCE),
      Math.round(grain * FREQUENCE),
      2400 + alea() * 4600,
      0.6 + alea() * 0.9,
      (0.25 + alea() * 0.9) * essoufflement * 1.5,
      grain * 0.3,
      alea
    );
    curseur += 0.005 + alea() * 0.011;
  }

  // 3. le tiroir : le glissement, trois bandes de frottement qui se resserrent en montant
  const debutGlisse = Math.round(0.55 * FREQUENCE);
  const nGlisse = Math.min(Math.round(0.33 * FREQUENCE), n - debutGlisse);
  const bruitGlisse = new Float32Array(nGlisse);
  for (let i = 0; i < nGlisse; i += 1) bruitGlisse[i] = alea() * 2 - 1;
  // les bandes sont filtrées **entières** : un filtre à mémoire ne se rappelle pas d'un échantillon
  const frottement = new Float32Array(nGlisse);
  for (const { f, largeur, gain } of [
    { f: 620, largeur: 1.0, gain: 1.0 },
    { f: 1650, largeur: 0.6, gain: 0.55 },
    { f: 3400, largeur: 0.45, gain: 0.25 }
  ]) {
    const bande = passeBande(bruitGlisse, f, largeur);
    for (let i = 0; i < nGlisse; i += 1) frottement[i] += bande[i] * gain;
  }
  let modulation = 0.8;
  let prochaine = 0;
  for (let i = 0; i < nGlisse; i += 1) {
    const t = i / FREQUENCE;
    // la poussée : le tiroir prend de la vitesse, puis s'arrête sur la butée
    const poussee = Math.min(1, t / 0.28) * (1 - Math.max(0, (t - 0.3) / 0.03));
    // un frottement irrégulier : la force de contact change tous les 6 à 12 ms (du stick-slip)
    if (i >= prochaine) {
      modulation = 0.55 + alea() * 0.45;
      prochaine = i + Math.round((0.006 + alea() * 0.006) * FREQUENCE);
    }
    sec[debutGlisse + i] += frottement[i] * poussee * modulation * 0.32;
  }

  // 4. la butée : le tiroir tombe en fin de course
  const debutButee = Math.round(0.88 * FREQUENCE);
  poser(sec, debutButee, Math.round(0.03 * FREQUENCE), 1500, 1.6, 2.2, 0.005, alea);
  const nClonk = Math.round(0.16 * FREQUENCE);
  const clonk = glissando(nClonk, { de: 132, a: 68, tau: 0.012 });
  const envClonk = declin(nClonk, { attaque: 0.001, tau: 0.045 });
  for (let i = 0; i < nClonk && debutButee + i < n; i += 1) sec[debutButee + i] += clonk[i] * envClonk[i] * 0.8;
  // deux résonances inharmoniques très courtes : le métal du classeur, pas une note
  for (const [f, gain] of [
    [1180, 0.1],
    [2790, 0.06]
  ]) {
    const m = Math.round(0.05 * FREQUENCE);
    const env = declin(m, { attaque: 0.0005, tau: 0.012 });
    for (let i = 0; i < m && debutButee + i < n; i += 1) {
      sec[debutButee + i] += Math.sin(Math.PI * 2 * f * (i / FREQUENCE)) * env[i] * gain;
    }
  }

  // 5. l'ambiance : courte et discrète, pour que les deux gestes soient dans la même pièce
  return ambiance(sec, 0.16);
}

/**
 * **Pression** (D-161, repris le 02/11/2026) : le coup porté. Un claquement filtré, sec, une masse
 * grave **très courte**, puis le **frottement de la manche** — la version d'avant laissait tomber
 * une sinusoïde de 150 à 55 Hz pendant 160 ms : un glissando, donc une note qui s'entend.
 *
 * Court à dessein : il se joue **à chaque attaque**, et la scène dure déjà 1,4 à 3,2 s.
 */
function pression() {
  const duree = 0.32;
  const n = Math.round(duree * FREQUENCE);
  const sortie = new Float32Array(n);
  const alea = graine(613);

  // 1. le claquement : du bruit aigu, très court, pour l'impact
  const longueur = Math.round(0.06 * FREQUENCE);
  const bruit = new Float32Array(longueur);
  for (let i = 0; i < longueur; i += 1) bruit[i] = (alea() * 2 - 1) * 0.8;
  const filtre = passeBande(bruit, 1800, 0.7);
  const env = enveloppe(longueur, { attaque: 0.001, chute: 0.03 });
  for (let i = 0; i < longueur; i += 1) sortie[i] += filtre[i] * env[i] * 1.5;

  // 2. la masse sous le coup : elle retombe de 110 à 75 Hz en 10 ms et s'éteint en 30 ms — un « toc »,
  //    trop court pour qu'on y entende une hauteur
  const nMasse = Math.round(0.09 * FREQUENCE);
  const masse = glissando(nMasse, { de: 110, a: 75, tau: 0.01 });
  const envMasse = declin(nMasse, { attaque: 0.0015, tau: 0.03 });
  for (let i = 0; i < nMasse; i += 1) sortie[i] += masse[i] * envMasse[i] * 0.6;

  // 3. le frottement de la manche : la toile qui ripe sur le bureau après le coup. Des grains de
  //    bruit moyen qui se recouvrent, de moins en moins forts — du tissu, pas un sifflement.
  let curseur = 0.035;
  while (curseur < 0.24) {
    const grain = 0.006 + alea() * 0.012;
    poser(
      sortie,
      Math.round(curseur * FREQUENCE),
      Math.round(grain * FREQUENCE),
      700 + alea() * 1800,
      0.7 + alea() * 0.6,
      (0.2 + alea() * 0.5) * (1 - (curseur - 0.035) / 0.22) * 2.4,
      grain * 0.35,
      alea
    );
    curseur += 0.008 + alea() * 0.014;
  }

  return ambiance(sortie, 0.1);
}

/**
 * **Craquage** (D-161, repris le 02/11/2026) : le Planqué cède. Trois grains de rupture, puis la
 * **rupture de fibres** (un crépitement serré dans les aigus) et le **carton qui se déchire** — le
 * son le plus fort du jeu, et le seul qui récompense. La version d'avant finissait sur une sinusoïde
 * de 120 à 42 Hz : la chute d'une note, remplacée par de la matière.
 */
function craquage() {
  const duree = 0.75;
  const n = Math.round(duree * FREQUENCE);
  const sortie = new Float32Array(n);
  const alea = graine(707);

  // 1. la rupture : trois grains courts, de plus en plus graves
  let curseur = 0.01;
  for (const [frequence, gain] of [
    [2400, 1.2],
    [1500, 1.0],
    [900, 0.8]
  ]) {
    const debut = Math.round(curseur * FREQUENCE);
    const longueur = Math.round(0.05 * FREQUENCE);
    const bruit = new Float32Array(longueur);
    for (let i = 0; i < longueur; i += 1) bruit[i] = (alea() * 2 - 1) * 0.9;
    const filtre = passeBande(bruit, frequence, 0.8);
    const env = enveloppe(longueur, { attaque: 0.001, chute: 0.03 });
    for (let i = 0; i < longueur && debut + i < n; i += 1) sortie[debut + i] += filtre[i] * env[i] * gain;
    curseur += 0.055 + alea() * 0.02;
  }

  // 2. la rupture de fibres : un crépitement serré, très aigu, qui s'épuise — les fils du carton qui
  //    lâchent un par un (Zheng & James : un squelette de micro-flambages, pas une texture tonale)
  let fibres = 0.14;
  while (fibres < 0.5) {
    const grain = 0.002 + alea() * 0.006;
    poser(
      sortie,
      Math.round(fibres * FREQUENCE),
      Math.round(grain * FREQUENCE),
      2600 + alea() * 4400,
      0.7 + alea() * 0.8,
      (0.3 + alea() * 0.7) * (1 - (fibres - 0.14) / 0.36) * 1.1,
      grain * 0.3,
      alea
    );
    fibres += 0.006 + alea() * 0.012;
  }

  // 3. le carton qui se déchire : une bande large (900–4 000 Hz) arrachée par à-coups irréguliers
  const debutDechire = Math.round(0.16 * FREQUENCE);
  const nDechire = Math.min(Math.round(0.5 * FREQUENCE), n - debutDechire);
  const bruitDechire = new Float32Array(nDechire);
  for (let i = 0; i < nDechire; i += 1) bruitDechire[i] = alea() * 2 - 1;
  const dechire = new Float32Array(nDechire);
  for (const { f, largeur, gain } of [
    { f: 1200, largeur: 1.2, gain: 1.0 },
    { f: 3200, largeur: 0.7, gain: 0.5 }
  ]) {
    const bande = passeBande(bruitDechire, f, largeur);
    for (let i = 0; i < nDechire; i += 1) dechire[i] += bande[i] * gain;
  }
  let arrachement = 1;
  let suivante = 0;
  for (let i = 0; i < nDechire; i += 1) {
    const t = i / FREQUENCE;
    // le déchirement ne va pas d'un trait : il avance par paquets de 10 à 30 ms
    if (i >= suivante) {
      arrachement = 0.4 + alea() * 0.6;
      suivante = i + Math.round((0.01 + alea() * 0.02) * FREQUENCE);
    }
    const ouverture = Math.min(1, t / 0.04) * Math.exp(-t / 0.22);
    sortie[debutDechire + i] += dechire[i] * arrachement * ouverture * 0.9;
  }

  return ambiance(sortie, 0.14);
}

/**
 * **Intervention** (D-161, refait le 02/11/2026) : le point marqué. La version d'avant jouait **deux
 * notes montantes** de vibraphone — c'était le son le plus exposé au carillon. Ici, deux gestes
 * d'objet : le **tampon de caoutchouc** qu'on pose sur le bureau (« validé »), puis le **frottement
 * du stylo** qui coche la case. Aucune hauteur, aucun intervalle : c'est une récompense, pas une
 * mélodie.
 */
function intervention() {
  const duree = 0.5;
  const n = Math.round(duree * FREQUENCE);
  const sortie = new Float32Array(n);
  const alea = graine(811);

  // 1. le tampon de caoutchouc : un impact mou — du bruit large et grave, très court, une masse
  //    amortie dessous. Le caoutchouc ne résonne pas : pas de partiels, pas de queue.
  poser(sortie, 0, Math.round(0.04 * FREQUENCE), 650, 1.7, 1.8, 0.007, alea);
  const nMasse = Math.round(0.08 * FREQUENCE);
  const masse = glissando(nMasse, { de: 95, a: 72, tau: 0.012 });
  const envMasse = declin(nMasse, { attaque: 0.002, tau: 0.025 });
  for (let i = 0; i < nMasse; i += 1) sortie[i] += masse[i] * envMasse[i] * 0.5;

  // 2. le stylo : le trait qui coche. Du bruit serré (2 à 5 kHz) en grains de 5 à 15 ms, plus dense
  //    au milieu du trait qu'à ses extrémités — un frottement, jamais une note.
  let plume = 0.09;
  while (plume < 0.42) {
    const grain = 0.005 + alea() * 0.01;
    const avancement = (plume - 0.09) / 0.33;
    const trait = Math.sin(Math.PI * avancement) ** 0.7; // le trait appuie au milieu
    poser(
      sortie,
      Math.round(plume * FREQUENCE),
      Math.round(grain * FREQUENCE),
      2000 + alea() * 3000,
      0.6 + alea() * 0.7,
      (0.2 + alea() * 0.5) * trait * 2.0,
      grain * 0.35,
      alea
    );
    plume += 0.007 + alea() * 0.012;
  }

  return ambiance(sortie, 0.12);
}

/**
 * Un fondu global : rien ne doit commencer ni finir sur un claquement.
 *
 * `courbe` > 1 adoucit la sortie (#606) : la queue d'une réverbération s'éteint lentement, et un
 * fondu linéaire sur 50 ms laisserait encore un échantillon audible au dernier tour.
 */
function finir(echantillons, { debut = 0.004, fin = 0.05, courbe = 1 } = {}) {
  const a = Math.round(debut * FREQUENCE);
  const f = Math.round(fin * FREQUENCE);
  const n = echantillons.length;
  for (let i = 0; i < a && i < n; i += 1) echantillons[i] *= i / a;
  for (let i = 0; i < f && i < n; i += 1) echantillons[n - 1 - i] *= (i / f) ** courbe;
  return echantillons;
}

/** Écrit un WAV mono 16 bits. */
function wav(echantillons) {
  const octets = Buffer.alloc(44 + echantillons.length * 2);
  octets.write('RIFF', 0);
  octets.writeUInt32LE(36 + echantillons.length * 2, 4);
  octets.write('WAVEfmt ', 8);
  octets.writeUInt32LE(16, 16);
  octets.writeUInt16LE(1, 20);
  octets.writeUInt16LE(1, 22);
  octets.writeUInt32LE(FREQUENCE, 24);
  octets.writeUInt32LE(FREQUENCE * 2, 28);
  octets.writeUInt16LE(2, 32);
  octets.writeUInt16LE(16, 34);
  octets.write('data', 36);
  octets.writeUInt32LE(echantillons.length * 2, 40);
  // crête normalisée à 0,85 : on ne frôle pas la saturation
  let crete = 0;
  for (const v of echantillons) crete = Math.max(crete, Math.abs(v));
  const gain = crete > 0 ? 0.85 / crete : 1;
  for (let i = 0; i < echantillons.length; i += 1) {
    octets.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(echantillons[i] * gain * 32767))), 44 + i * 2);
  }
  return octets;
}

export const SONS = [
  // L'arrivage finit sur l'air du sachet : sa sortie se fond plus longuement, comme le verdict.
  { cle: 'arrivage', fabrique: arrivage, fondu: { fin: 0.1, courbe: 2 } },
  // Le verdict s'éteint dans une réverbération : sa sortie se fond plus longuement (#606).
  { cle: 'verdict', fabrique: verdict, fondu: { debut: 0.0015, fin: 0.14, courbe: 2 } },
  // Les trois sons du **combat** (D-161) : le coup, la casse, le point marqué. Tous les trois
  // finissent sur une ambiance courte : leur sortie se fond sur 80 ms (#606).
  { cle: 'pression', fabrique: pression, fondu: { fin: 0.08, courbe: 2 } },
  { cle: 'craquage', fabrique: craquage, fondu: { fin: 0.08, courbe: 2 } },
  { cle: 'intervention', fabrique: intervention, fondu: { fin: 0.08, courbe: 2 } }
];

/** Le silence de début et de fin : un son qui « colle » au silence s'entend plus qu'il ne s'écoute. */
export function silences(chemin) {
  const octets = readFileSync(chemin);
  const n = (octets.length - 44) / 2;
  const echantillon = (i) => Math.abs(octets.readInt16LE(44 + i * 2));
  let debut = 0;
  while (debut < n && echantillon(debut) < 8) debut += 1;
  let fin = 0;
  while (fin < n && echantillon(n - 1 - fin) < 8) fin += 1;
  return { debutMs: Math.round((debut / FREQUENCE) * 1000), finMs: Math.round((fin / FREQUENCE) * 1000) };
}

/**
 * Les octets WAV **exacts** qu'`ecrire()` pose sur le disque pour un son donné. Exporté pour que le
 * test puisse vérifier deux choses d'un coup (#606) : deux générations donnent le même fichier, et
 * le fichier du dépôt est bien celui-là — un `.wav` retouché à la main ne peut pas passer.
 */
export function generer(cle) {
  const son = SONS.find((candidat) => candidat.cle === cle);
  if (!son) throw new Error(`son inconnu : ${cle}`);
  return wav(finir(son.fabrique(), son.fondu));
}

function ecrire() {
  mkdirSync(DOSSIER, { recursive: true });
  for (const { cle } of SONS) {
    const chemin = join(DOSSIER, `${cle}.wav`);
    writeFileSync(chemin, generer(cle));
    const taille = statSync(chemin).size;
    console.log(`${chemin} — ${(taille / 1024).toFixed(1)} Ko`);
  }
}

function verifier() {
  let echec = 0;
  for (const { cle } of SONS) {
    const chemin = join(DOSSIER, `${cle}.wav`);
    let taille = 0;
    try {
      taille = statSync(chemin).size;
    } catch {
      console.error(`✗ ${cle}.wav manque — lancer node scripts/ressources/sons.mjs`);
      echec = 1;
      continue;
    }
    if (taille > PLAFOND_OCTETS) {
      console.error(`✗ ${cle}.wav pèse ${(taille / 1024).toFixed(1)} Ko, plafond ${PLAFOND_OCTETS / 1024} Ko`);
      echec = 1;
    }
    const { debutMs, finMs } = silences(chemin);
    if (debutMs > 60 || finMs < 5) {
      console.error(
        `✗ ${cle}.wav : début ${debutMs} ms, fin ${finMs} ms — il faut couper le silence au début et garder un fondu (≥ 5 ms)` +
          ' : un son qui finit sur un échantillon non nul fait un claquement' +
          ' (https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)'
      );
      echec = 1;
    }
    if (taille <= PLAFOND_OCTETS && debutMs <= 60 && finMs >= 5) {
      console.log(`✓ ${cle}.wav — ${(taille / 1024).toFixed(1)} Ko, silences ${debutMs}/${finMs} ms`);
    }
  }
  return echec;
}

const estLance = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (estLance) {
  const code = process.argv.includes('--verifier') ? verifier() : (ecrire(), 0);
  process.exitCode = code;
}
