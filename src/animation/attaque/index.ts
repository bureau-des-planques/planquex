import { FACTION_META } from '@/data';
import type { Attack, PlanqueCard } from '@/data/types';
import { alea, centre, hacher } from '../moteur';
import type { Etape } from '../moteur';
import type { Choregraphie, Ctx, Scene } from './ctx';
import { attribuer, cinematiqueDe, libelle } from './attribution';
import type { CleD } from './attribution';
import { impactGenerique } from './generique';
import { impactLegendaire, prelude, preparerVoile, retourCinematique } from './cinematique';
import { apres } from './apres';
import { SORTIE_DEBUT, SORTIE_DUREE, sayneteDeSortie } from './sortie';
import { motifD } from './motifs';
export type { Choregraphie, Scene } from './ctx';
export { attribuer, cinematiqueDe, estLegendaire, libelle } from './attribution';
export { preparerVoile } from './cinematique';

/** Construit la chorégraphie d'une attaque : motif, cinématique éventuelle, impact, après coup, sortie. */
export function choregraphie(carte: PlanqueCard, attaque: Attack, sc: Scene): Choregraphie {
  const A = sc.m.rect(sc.att);
  const C = sc.m.rect(sc.cib);
  const ctx: Ctx = {
    ...sc,
    A,
    C,
    a: centre(A),
    c: centre(C),
    couleur: FACTION_META[carte.faction].color,
    rnd: alea(hacher(`${carte.id}:${attaque.name}`)),
    attaque,
    carte,
    stress: sc.stress,
    coupDeGrace: sc.coupDeGrace,
    base: ''
  };
  const cle = attribuer(carte).get(carte.attacks.indexOf(attaque)) ?? 'postits';
  const etapes: Etape[] = [];
  const cinematique = cinematiqueDe(carte, attaque);
  if (cinematique) preparerVoile();

  const t0 = cinematique ? prelude(ctx, etapes, carte.ex === true) : 0;
  const impact = motifD(ctx, etapes, t0, cle as CleD, cinematique);

  const touche = sc.stress > 0;
  const fort = cinematique ? 1.6 : 1;
  etapes.push({
    a: impact,
    faire: () => {
      if (touche) impactGenerique(ctx, fort);
      if (cinematique) impactLegendaire(ctx);
    }
  });
  if (sc.coupDeGrace) sayneteDeSortie(ctx, etapes, impact + SORTIE_DEBUT);
  const finApres = apres(ctx, etapes, impact + 120);
  // La saynète de sortie court jusqu'à `impact + SORTIE_DEBUT + SORTIE_DUREE` : la séquence doit
  // lui laisser le temps d'aller au bout, sinon le carton et la note resteraient en l'air.
  const duree = Math.max(impact + 950, finApres, sc.coupDeGrace ? impact + SORTIE_DEBUT + SORTIE_DUREE + 50 : 0);
  // Un coup de grâce sous cinématique : la salle se retire dès que l'impact est passé, pour que la
  // saynète de sortie se joue sur un plateau clair et non sous le voile.
  // Le retour de la carte part **après** tout ce que l'après a programmé sur elle
  // (`switchSelf` va jusqu'à `impact + 1020`) : sinon le retour de la cinématique l'écrase.
  if (cinematique)
    etapes.push({
      a: duree - 340 > impact + 1020 ? duree - 340 : impact + 1020,
      faire: () => retourCinematique(ctx)
    });
  return { nom: libelle(cle), etapes, duree, cinematique };
}
