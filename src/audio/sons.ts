/*
 * **Les deux sons de l'alpha** (#378, D-137). Un seul module touche à l'audio : nulle part ailleurs
 * dans le code il n'y a d'`Audio` ni de `<audio>`.
 *
 * Trois règles, et elles viennent toutes de D-137 :
 *  1. **rien ne joue au chargement** : le contexte ne se crée qu'au premier geste du testeur, et il
 *     faut que ce geste soit un `pointerup`/`click` (la spec HTML refuse le son avant, et iOS plus
 *     strictement que les autres) ;
 *  2. **le réglage coupe tout** : `sons` dans le store, coché par défaut ; quand il est faux, ce
 *     module ne demande **aucune** lecture, même si un écran l'appelle ;
 *  3. **des timbres courts, pas une bande-son** : `arrivage` et `verdict` (D-137), plus les trois
 *     gestes du combat — `pression`, `craquage`, `intervention` (D-166) —, générés par
 *     `scripts/ressources/sons.mjs` (aucune licence tierce, aucun asset des versions abandonnées).
 *
 * Si le contexte n'est pas encore prêt au moment de jouer, on **saute** le son : le jouer en retard
 * serait pire que le silence (recherche `techniques.md` §6.2).
 */
import { useStore } from '@/store/useStore';

export type CleSon = 'arrivage' | 'verdict' | 'pression' | 'craquage' | 'intervention';

const CHEMINS: Record<CleSon, string> = {
  arrivage: '/sons/arrivage.wav',
  verdict: '/sons/verdict.wav',
  pression: '/sons/pression.wav',
  craquage: '/sons/craquage.wav',
  intervention: '/sons/intervention.wav'
};

type Contexte = AudioContext;

let contexte: Contexte | null = null;
const tampons = new Map<CleSon, AudioBuffer>();
let amorcage: Promise<void> | null = null;

/** Le réglage du testeur. Lu **au moment de jouer**, jamais mis en cache : la case doit couper
 * immédiatement, sans rechargement. */
export function sonsActives(): boolean {
  return useStore.getState().sons !== false;
}

/**
 * Crée (ou reprend) le contexte audio. À appeler **dans** un geste : c'est lui qui débloque iOS,
 * et lui qui décode les deux fichiers en tâche de fond.
 */
export function deverrouiller(): void {
  if (typeof globalThis.AudioContext === 'undefined') return;
  if (!contexte) {
    contexte = new AudioContext();
    amorcage = (async () => {
      const ctx = contexte as Contexte;
      await Promise.all(
        (Object.keys(CHEMINS) as CleSon[]).map(async (cle) => {
          try {
            const reponse = await fetch(CHEMINS[cle]);
            const octets = await reponse.arrayBuffer();
            tampons.set(cle, await ctx.decodeAudioData(octets));
          } catch {
            // Un son qui ne charge pas n'est pas une panne du jeu : on continue en silence.
          }
        })
      );
    })();
  }
  void contexte.resume();
}

/** Vrai quand tous les tampons sont décodés — l'écran n'a rien à en faire, les tests oui. */
export function pret(): boolean {
  return tampons.size === Object.keys(CHEMINS).length;
}

/**
 * Joue un son, si le testeur l'autorise et si tout est prêt. Ne lève jamais : un son absent ne doit
 * pas casser une ouverture d'Arrivage ni un verdict.
 */
export function jouer(cle: CleSon): void {
  if (!sonsActives()) return;
  const ctx = contexte;
  const tampon = tampons.get(cle);
  if (!ctx || !tampon) return;
  // Un contexte `suspended` (iOS après verrouillage) ne se force pas ici : le son serait en retard.
  if (ctx.state !== 'running') return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = tampon;
    source.connect(ctx.destination);
    source.start();
  } catch {
    // Idem : le silence vaut mieux qu'une exception au milieu d'une animation.
  }
}

/** Réservé aux tests : remet le module à zéro entre deux cas. */
export function oublier(): void {
  contexte = null;
  tampons.clear();
  amorcage = null;
}

/** Réservé aux tests : attend la fin du décodage en cours. */
export async function attendreAmorcage(): Promise<void> {
  await amorcage;
}
