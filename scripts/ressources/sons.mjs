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
 * **Arrivage** : le sachet qu'on ouvre. Un craquement de film (grains de bruit filtrés), une
 * déchirure qui monte en fréquence, puis un « pop » sourd quand la lèvre s'ouvre.
 */
function arrivage() {
  const duree = 0.92;
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

  // 3. le pop de l'ouverture : une sinusoïde qui tombe de 190 à 70 Hz
  const debutPop = Math.round(0.62 * FREQUENCE);
  const restePop = n - debutPop;
  const envPop = enveloppe(restePop, { attaque: 0.004, chute: 0.22 });
  for (let i = 0; i < restePop; i += 1) {
    const t = i / FREQUENCE;
    const f = 190 * Math.exp(-t * 9) + 70;
    sortie[debutPop + i] += Math.sin(2 * Math.PI * f * t) * envPop[i] * 0.55;
  }

  return sortie;
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

  /** Un grain de bruit filtré, posé à `debut` : la brique du froissement et du frottement. */
  const poser = (debut, longueur, frequence, largeur, gain, tau) => {
    const bruit = new Float32Array(longueur);
    for (let i = 0; i < longueur; i += 1) bruit[i] = alea() * 2 - 1;
    const filtre = passeBande(bruit, frequence, largeur);
    const env = declin(longueur, { attaque: 0.0004, tau });
    for (let i = 0; i < longueur && debut + i < n; i += 1) sec[debut + i] += filtre[i] * env[i] * gain;
  };

  // 1. le tampon : impact mat (bruit large) + la masse qui retombe dessous
  poser(0, Math.round(0.05 * FREQUENCE), 900, 1.8, 1.7, 0.008);
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
      Math.round(curseur * FREQUENCE),
      Math.round(grain * FREQUENCE),
      2400 + alea() * 4600,
      0.6 + alea() * 0.9,
      (0.25 + alea() * 0.9) * essoufflement * 1.5,
      grain * 0.3
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
  poser(debutButee, Math.round(0.03 * FREQUENCE), 1500, 1.6, 2.2, 0.005);
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
  return reverberer(sec, { melange: 0.16, duree: 0.35, preDelai: 0.008, tau: 0.09 });
}

/**
 * **Pression** (D-161) : le coup porté. Un claquement filtré, sec, et un corps grave qui tombe —
 * court, parce qu'il se joue **à chaque attaque** et que la scène dure déjà 1,4 à 3,2 s.
 */
function pression() {
  const duree = 0.34;
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

  // 2. le corps : une sinusoïde qui tombe de 150 à 55 Hz — le souffle du coup
  const debutCorps = Math.round(0.008 * FREQUENCE);
  const reste = n - debutCorps;
  const envCorps = enveloppe(reste, { attaque: 0.003, chute: 0.16 });
  for (let i = 0; i < reste; i += 1) {
    const t = i / FREQUENCE;
    const f = 150 * Math.exp(-t * 16) + 55;
    sortie[debutCorps + i] += Math.sin(2 * Math.PI * f * t) * envCorps[i] * 0.7;
  }

  return sortie;
}

/**
 * **Craquage** (D-161) : le Planqué cède. Trois grains de rupture, puis une chute grave — le
 * son le plus fort du jeu, et le seul qui récompense.
 */
function craquage() {
  const duree = 0.62;
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

  // 2. la chute : un corps grave qui descend, plus long que l'impact d'une Pression
  const debutChute = Math.round(0.14 * FREQUENCE);
  const reste = n - debutChute;
  const envChute = enveloppe(reste, { attaque: 0.01, chute: 0.3 });
  for (let i = 0; i < reste; i += 1) {
    const t = i / FREQUENCE;
    const f = 120 * Math.exp(-t * 5) + 42;
    sortie[debutChute + i] += Math.sin(2 * Math.PI * f * t) * envChute[i] * 0.6;
  }

  return sortie;
}

/**
 * **Intervention** (D-161) : le point marqué. Deux notes montantes, timbre de vibraphone — la
 * même famille que le verdict, mais **vers le haut** : c'est une récompense, pas une conclusion.
 */
function intervention() {
  const duree = 0.5;
  const n = Math.round(duree * FREQUENCE);
  const sortie = new Float32Array(n);

  const notes = [
    { debut: 0, duree: 0.26, f: 523.25 },
    { debut: 0.12, duree: 0.34, f: 783.99 }
  ];
  for (const note of notes) {
    const debut = Math.round(note.debut * FREQUENCE);
    const m = Math.round(note.duree * FREQUENCE);
    const envNote = enveloppe(m, { attaque: 0.008, chute: 0.2 });
    for (let i = 0; i < m && debut + i < n; i += 1) {
      const t = i / FREQUENCE;
      const onde = Math.sin(2 * Math.PI * note.f * t) * 0.6 + Math.sin(2 * Math.PI * note.f * 2.01 * t) * 0.14;
      sortie[debut + i] += onde * envNote[i] * 0.4;
    }
  }

  return sortie;
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
  { cle: 'arrivage', fabrique: arrivage },
  // Le verdict s'éteint dans une réverbération : sa sortie se fond plus longuement (#606).
  { cle: 'verdict', fabrique: verdict, fondu: { debut: 0.0015, fin: 0.14, courbe: 2 } },
  // Les trois sons du **combat** (D-161) : le coup, la casse, le point marqué.
  { cle: 'pression', fabrique: pression },
  { cle: 'craquage', fabrique: craquage },
  { cle: 'intervention', fabrique: intervention }
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
