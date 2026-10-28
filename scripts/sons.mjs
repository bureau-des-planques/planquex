#!/usr/bin/env node
/**
 * **Les deux sons de l'alpha** (#378, #379, D-137) — générés, pas téléchargés.
 *
 * D-137 demande deux sons, libres, documentés, et **aucun asset repris** des versions
 * abandonnées. Plutôt que de chercher une banque sous licence (et de dépendre de ses conditions),
 * on **fabrique** les deux timbres ici : du bruit filtré et deux oscillateurs. Conséquences :
 *
 *  - **aucune licence tierce** : l'œuvre est celle du projet, il n'y a rien à attribuer ;
 *  - **reproductible** : le générateur est seedé, les fichiers se régénèrent à l'identique ;
 *  - **léger** : deux WAV mono 22,05 kHz d'une seconde, sous 100 Ko chacun (le ticket #379 fixe
 *    la barre).
 *
 * Usage :
 *   node scripts/sons.mjs            # écrit public/sons/arrivage.wav et verdict.wav
 *   node scripts/sons.mjs --verifier # ne réécrit rien, vérifie poids et silences (CI)
 *
 * Le WAV est volontairement **non compressé** : la machine n'a pas d'encodeur audio, et un WAV
 * court reste plus petit que la barre des 100 Ko. Un jour, un `.opus` le remplacera sans changer
 * le module qui les joue.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
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
 * **Verdict** : la fin d'un combat. Un tampon qui s'abat (bruit grave + corps), puis deux notes
 * descendantes — le bureau qui classe le dossier.
 */
function verdict() {
  const duree = 0.78;
  const n = Math.round(duree * FREQUENCE);
  const sortie = new Float32Array(n);
  const alea = graine(379);

  // le tampon : bruit très filtré + un corps sinusoïdal à 90 Hz
  const longueur = Math.round(0.16 * FREQUENCE);
  const bruit = new Float32Array(longueur);
  for (let i = 0; i < longueur; i += 1) bruit[i] = (alea() * 2 - 1) * 0.7;
  const filtre = passeBande(bruit, 220, 1.1);
  const env = enveloppe(longueur, { attaque: 0.002, chute: 0.09 });
  for (let i = 0; i < longueur; i += 1) {
    const t = i / FREQUENCE;
    sortie[i] += (filtre[i] * 1.4 + Math.sin(2 * Math.PI * 90 * t) * 0.5) * env[i];
  }

  // deux notes : la quinte descend, puis la tonique — courtes, mates
  const notes = [
    { debut: 0.2, duree: 0.22, f: 392 },
    { debut: 0.4, duree: 0.34, f: 294 }
  ];
  for (const note of notes) {
    const debut = Math.round(note.debut * FREQUENCE);
    const m = Math.round(note.duree * FREQUENCE);
    const envNote = enveloppe(m, { attaque: 0.012, chute: 0.14 });
    for (let i = 0; i < m && debut + i < n; i += 1) {
      const t = i / FREQUENCE;
      // une harmonique impaire légèrement détunée : un timbre de vibraphone, pas une sirène
      const onde = Math.sin(2 * Math.PI * note.f * t) * 0.6 + Math.sin(2 * Math.PI * note.f * 2.01 * t) * 0.12;
      sortie[debut + i] += onde * envNote[i] * 0.34;
    }
  }

  return sortie;
}

/** Un fondu global : rien ne doit commencer ni finir sur un claquement. */
function finir(echantillons, { debut = 0.004, fin = 0.05 } = {}) {
  const a = Math.round(debut * FREQUENCE);
  const f = Math.round(fin * FREQUENCE);
  const n = echantillons.length;
  for (let i = 0; i < a && i < n; i += 1) echantillons[i] *= i / a;
  for (let i = 0; i < f && i < n; i += 1) echantillons[n - 1 - i] *= i / f;
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
  { cle: 'verdict', fabrique: verdict }
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

function ecrire() {
  mkdirSync(DOSSIER, { recursive: true });
  for (const { cle, fabrique } of SONS) {
    const chemin = join(DOSSIER, `${cle}.wav`);
    writeFileSync(chemin, wav(finir(fabrique())));
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
      console.error(`✗ ${cle}.wav manque — lancer node scripts/sons.mjs`);
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
