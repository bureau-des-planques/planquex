/*
 * **L'ouverture d'un Arrivage** (#283, `docs/SPEC-OUVERTURE-ARRIVAGE.md`).
 *
 * Plein écran, quatre temps :
 *  1. **le sachet** flotte dans un faisceau de lumière, s'incline sous le doigt, ses reflets
 *     holographiques suivent l'inclinaison ;
 *  2. **la déchirure** suit le doigt le long des pointillés, depuis le bord choisi : la bande se
 *     soulève, la lumière de l'intérieur filtre par la fente — **de la couleur de la meilleure carte** ;
 *  3. **l'envol** : la bande s'envole, éclair, gerbe d'étincelles ; les cartes montent lentement par
 *     la fente, puis s'étalent sur le bureau, **face cachée** ;
 *  4. **la révélation** : le testeur retourne les cartes **une à une, dans l'ordre qu'il veut**. Le
 *     dos d'une carte rare luit de sa couleur ; retournée, elle monte au centre, tremble, éclate, et
 *     une **annonce** la fête (`revelation.ts`). Une carte retournée se **touche** pour voir sa
 *     fiche : la carte en grand, et tout ce qu'elle porte en toutes lettres.
 *
 * Les règles vivent dans `etats.ts` et `revelation.ts` (purs, testés) ; ici il n'y a que le rendu,
 * les gestes et l'horloge de la mise en scène.
 *
 * Trois choses ne sont **pas** facultatives, et viennent des décisions :
 *  - **Mouvement réduit** (D-098) : sous la bascule du store ou `prefers-reduced-motion`, on arrive
 *    directement aux cartes retournées, sans sachet, sans particules ni cascade ;
 *  - **un chemin sans glissement** (les critères WCAG d'accès au pointeur, spec §5) : « Ouvrir » joue
 *    la déchirure seul, « Tout afficher » retourne tout ; chaque carte se prend au clavier ;
 *  - **aucune information ne vit dans l'animation** : les cinq cartes et leurs badges « Nouvelle »
 *    sont dans le DOM dès le premier rendu, retournées ou non.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@/data/types';
import { RARITY_META } from '@/data';
import { CardView } from '@/components/CardView';
import { useMouvementReduit } from '@/components/use-mouvement-reduit';
import { avancer, creer, demarrer, relacher, surLaLigne, type EtatOuverture, type Geometrie } from './etats';
import { FicheCarte } from './FicheCarte';
import { LIGNE, MASQUE_SILHOUETTE, Pochette } from './Pochette';
import { Particules } from './particules';
import {
  annonce,
  auMoins,
  CARTE,
  decoupes,
  echelleGrande,
  inclinaisonCachee,
  lueur,
  meilleurPalier,
  palier,
  poseFiche,
  poseRecap,
  SUSPENSE,
  TENUE,
  traceDechirure,
  type Palier,
  type Pose
} from './revelation';

interface Props {
  /** Le tirage réel : les cartes montrées sont celles-là, jamais d'autres. */
  cartes: readonly Card[];
  /** Les index des cartes que le testeur n'avait pas. */
  neuves?: ReadonlySet<number>;
  onRanger: () => void;
}

/** Ce qui suit la déchirure : l'envol, la révélation au choix, puis toutes les cartes retournées. */
type Apres = 'ouverture' | 'revelation' | 'ouvert';
export type Etape = 'ferme' | 'dechirure' | Apres;

/** Les instants de l'envol, depuis la déchirure complète. */
const ENVOL = {
  /** Les cartes commencent à monter par la fente. */
  montee: 300,
  /** Elles quittent le sachet pour s'étaler sur le bureau. */
  etalage: 1700,
  /** Elles sont posées : la révélation commence. */
  revelation: 2900
} as const;

/** Une carte en cours de révélation : montée au centre (`levee`), puis retournée et fêtée (`tenue`). */
interface EnCours {
  index: number;
  phase: 'levee' | 'tenue';
}

/** Une interpolation sur l'horloge d'affichage, annulable ; sans `requestAnimationFrame` (jsdom), un pas de 16 ms. */
function animer(duree: number, image: (k: number) => void, fin: () => void): () => void {
  const demander =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (f: FrameRequestCallback) => window.setTimeout(() => f(performance.now()), 16);
  const annuler = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : window.clearTimeout;
  const debut = performance.now();
  let id = 0;
  let fini = false;
  const pas = (t: number): void => {
    const k = Math.min(1, Math.max(0, (t - debut) / duree));
    image(k);
    if (k < 1) {
      id = demander(pas);
      return;
    }
    fini = true;
    fin();
  };
  id = demander(pas);
  return () => {
    if (!fini) annuler(id);
  };
}

/** Une vibration courte, là où l'appareil la permet ; jamais une erreur. */
function vibrer(motif: number | number[]): void {
  try {
    navigator.vibrate?.(motif);
  } catch {
    /* Un navigateur qui refuse la vibration n'a rien à signaler. */
  }
}

function transformDe(p: Pose): string {
  return `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.rotation.toFixed(2)}deg) scale(${p.echelle.toFixed(3)})`;
}

const COULEURS_ETINCELLES = ['#fff6d8', '#f4d68a', '#e6b64c', '#ffffff'];

export function SceneOuverture({ cartes, neuves, onRanger }: Props) {
  const reduit = useMouvementReduit();
  const nombre = cartes.length;
  const raretes = useMemo(() => cartes.map((c) => c.rarity), [cartes]);
  const couleurLueur = useMemo(() => lueur(raretes), [raretes]);
  const palierTirage = useMemo(() => meilleurPalier(raretes), [raretes]);
  const graine = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const trace = useMemo(() => traceDechirure(graine, LIGNE * 100), [graine]);
  const clips = useMemo(() => decoupes(trace), [trace]);

  const [etat, setEtat] = useState<EtatOuverture>(() =>
    reduit ? { phase: 'ouvert', dechirure: 1, sens: 1 } : creer()
  );
  const [apres, setApres] = useState<Apres | null>(() => (reduit ? 'ouvert' : null));
  const [refermant, setRefermant] = useState(false);
  const [presse, setPresse] = useState(false);
  /** Rejoue l'éclat qui parcourt les pointillés : un appui tombé à côté le rappelle. */
  const [rappel, setRappel] = useState(0);
  /** L'envol en trois temps : 0 dans le sachet, 1 émergées par la fente, 2 étalées sur le bureau. */
  const [sortie, setSortie] = useState<0 | 1 | 2>(0);
  const [retournees, setRetournees] = useState<readonly boolean[]>(() => cartes.map(() => reduit));
  const [enCours, setEnCours] = useState<EnCours | null>(null);
  const [fiche, setFiche] = useState<number | null>(null);
  const [eclat, setEclat] = useState<Palier | null>(null);
  const [taille, setTaille] = useState({ largeur: 390, hauteur: 560 });

  const racine = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const sachet = useRef<HTMLDivElement>(null);
  const eclair = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cartesRef = useRef<Array<HTMLLIElement | null>>([]);
  const particules = useRef<Particules | null>(null);
  const minuteurs = useRef(new Set<number>());
  const annulations = useRef(new Set<() => void>());
  /** Le jeton de la révélation en cours : un minuteur d'une révélation passée ne touche à rien. */
  const jeton = useRef(0);
  const depart = useRef({ x: 0, y: 0 });
  const tire = useRef(false);
  const dernierCran = useRef(0);
  const inclinaison = useRef({ cx: 0, cy: 0, x: 0, y: 0, actif: false, repos: 0 });

  const plus = useCallback((ms: number, f: () => void) => {
    const id = window.setTimeout(() => {
      minuteurs.current.delete(id);
      f();
    }, ms);
    minuteurs.current.add(id);
  }, []);

  useEffect(
    () => () => {
      for (const id of minuteurs.current) window.clearTimeout(id);
      for (const annuler of annulations.current) annuler();
    },
    []
  );

  // La taille de la scène : elle règle la pochette, l'étalage et la fiche.
  useEffect(() => {
    const el = scene.current;
    if (!el) return undefined;
    const mesurer = (): void => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setTaille({ largeur: el.clientWidth, hauteur: el.clientHeight });
    };
    mesurer();
    let observateur: ResizeObserver | null = null;
    try {
      observateur = new ResizeObserver(mesurer);
      observateur.observe(el);
    } catch {
      // Sans `ResizeObserver` utilisable (vieux navigateur, double de test), la fenêtre suffit.
      observateur = null;
    }
    if (observateur) return () => observateur.disconnect();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, []);

  // Les particules : un canvas 2D sur toute la scène, jamais sous « Mouvement réduit ».
  useEffect(() => {
    if (reduit) return undefined;
    const el = canvas.current;
    const boite = racine.current;
    if (!el || !boite) return undefined;
    let moteur: Particules | null = null;
    try {
      moteur = new Particules(el);
    } catch {
      return undefined;
    }
    particules.current = moteur;
    const caler = (): void => moteur?.redimensionner(boite.clientWidth, boite.clientHeight);
    caler();
    window.addEventListener('resize', caler);
    return () => {
      window.removeEventListener('resize', caler);
      moteur?.detruire();
      particules.current = null;
    };
  }, [reduit]);

  /** Un point de l'écran, ramené au repère de la racine (celui du canvas). */
  const versRacine = useCallback((x: number, y: number) => {
    const r = racine.current?.getBoundingClientRect();
    return { x: x - (r?.left ?? 0), y: y - (r?.top ?? 0) };
  }, []);

  /** Le centre de la scène, dans le repère de la racine. */
  const centreScene = useCallback(() => {
    const r = scene.current?.getBoundingClientRect();
    if (!r) return { x: taille.largeur / 2, y: taille.hauteur / 2 };
    return versRacine(r.left + r.width / 2, r.top + r.height / 2);
  }, [taille, versRacine]);

  /** Le centre d'une carte à l'écran, dans le repère de la racine. */
  const centreCarte = useCallback(
    (index: number) => {
      const r = cartesRef.current[index]?.getBoundingClientRect();
      if (!r || r.width === 0) return centreScene();
      return versRacine(r.left + r.width / 2, r.top + r.height / 2);
    },
    [centreScene, versRacine]
  );

  const flash = useCallback((couleur: string, force: number) => {
    eclair.current?.animate?.(
      [
        { opacity: 0, background: `radial-gradient(circle at 50% 45%, #fff 0%, ${couleur} 35%, transparent 75%)` },
        { opacity: force, offset: 0.18 },
        { opacity: 0 }
      ],
      { duration: 700, easing: 'ease-out' }
    );
  }, []);

  const secouer = useCallback((amplitude: number) => {
    scene.current?.animate?.(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-amplitude}px, ${amplitude * 0.6}px)` },
        { transform: `translate(${amplitude * 0.8}px, ${-amplitude * 0.4}px)` },
        { transform: `translate(${-amplitude * 0.5}px, ${-amplitude * 0.3}px)` },
        { transform: `translate(${amplitude * 0.3}px, ${amplitude * 0.2}px)` },
        { transform: 'translate(0, 0)' }
      ],
      { duration: 420, easing: 'ease-out' }
    );
  }, []);

  // L'inclinaison du sachet : un ressort vers la cible du doigt, ou un balancement lent au repos.
  useEffect(() => {
    if (reduit || apres === 'revelation' || apres === 'ouvert') return undefined;
    if (typeof requestAnimationFrame !== 'function') return undefined;
    let raf = 0;
    const pas = (t: number): void => {
      const inc = inclinaison.current;
      // Au repos, le sachet se balance, et le balancement s'éteint en quatre secondes ; le doigt
      // le relance.
      if (!inc.repos) inc.repos = t;
      const ampleur = inc.actif ? 0 : Math.max(0, 1 - (t - inc.repos) / 4000);
      const cibleX = inc.actif ? inc.cx : Math.sin(t / 1700) * 0.35 * ampleur;
      const cibleY = inc.actif ? inc.cy : Math.cos(t / 2300) * 0.22 * ampleur;
      const amorti = tire.current ? 0.25 : 1;
      inc.x += (cibleX * amorti - inc.x) * 0.085;
      inc.y += (cibleY * amorti - inc.y) * 0.085;
      const el = sachet.current;
      if (el) {
        el.style.setProperty('--ry', `${(inc.x * 16).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-inc.y * 12).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(50 + inc.x * 45).toFixed(1)}%`);
        el.style.setProperty('--my', `${(40 + inc.y * 40).toFixed(1)}%`);
      }
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [reduit, apres]);

  /** Les étincelles du front de déchirure, au fil du geste. */
  const etincelles = useCallback(
    (p: number, sens: 1 | -1, nombreEtincelles: number) => {
      const r = zoneRef.current?.getBoundingClientRect();
      if (!r || !particules.current) return;
      const fx = r.left + (sens === 1 ? p : 1 - p) * r.width;
      const point = versRacine(fx, r.top + LIGNE * r.height);
      particules.current.emettre({
        ...point,
        nombre: nombreEtincelles,
        couleurs: [couleurLueur, ...COULEURS_ETINCELLES],
        vitesse: [120, 340],
        direction: -Math.PI / 2 - sens * 0.5,
        ouverture: 1.9,
        duree: [0.3, 0.75],
        taille: [0.8, 2]
      });
    },
    [couleurLueur, versRacine]
  );

  /** L'envol : la bande part, éclair, gerbe ; les cartes montent lentement, puis s'étalent. */
  const lancerOuverture = useCallback(() => {
    setApres('ouverture');
    vibrer([18, 30, 40]);
    const fort = auMoins(palierTirage, 'brillante');
    flash(couleurLueur, fort ? 0.95 : 0.75);
    secouer(fort ? 9 : 6);
    const r = zoneRef.current?.getBoundingClientRect();
    if (r && particules.current) {
      const point = versRacine(r.left + r.width / 2, r.top + LIGNE * r.height);
      particules.current.emettre({
        ...point,
        nombre: fort ? 140 : 90,
        couleurs: [couleurLueur, couleurLueur, ...COULEURS_ETINCELLES],
        vitesse: [220, 720],
        direction: -Math.PI / 2,
        ouverture: 3.4,
        duree: [0.5, 1.3],
        taille: [1, 2.8]
      });
      particules.current.emettre({
        ...point,
        nombre: 26,
        couleurs: [couleurLueur, '#ffffff'],
        vitesse: [60, 220],
        duree: [0.9, 1.6],
        taille: [1.4, 3],
        gravite: 60,
        forme: 'etoile'
      });
    }
    setSortie(0);
    plus(ENVOL.montee, () => setSortie(1));
    plus(ENVOL.etalage, () => setSortie(2));
    plus(ENVOL.revelation, () => setApres('revelation'));
  }, [couleurLueur, flash, palierTirage, plus, secouer, versRacine]);

  /** La fête d'une carte qui se retourne : rien pour une simple, tout pour une secrète. */
  const feter = useCallback(
    (index: number) => {
      const carte = cartes[index];
      if (!carte) return;
      const niveau = palier(carte.rarity);
      const couleur = RARITY_META[carte.rarity].color;
      const centre = centreCarte(index);
      const moteur = particules.current;
      if (niveau === 'simple') {
        vibrer(6);
        moteur?.emettre({
          ...centre,
          nombre: 14,
          couleurs: ['#cfe3ff', '#ffffff'],
          vitesse: [60, 180],
          duree: [0.3, 0.7],
          gravite: 200
        });
        return;
      }
      setEclat(niveau);
      plus(TENUE[niveau], () => setEclat(null));
      if (niveau === 'rare') {
        vibrer(14);
        flash(couleur, 0.35);
        moteur?.emettre({
          ...centre,
          nombre: 60,
          couleurs: [couleur, '#ffffff'],
          vitesse: [160, 460],
          duree: [0.5, 1]
        });
        return;
      }
      vibrer(niveau === 'secrete' ? [30, 50, 30, 50, 80] : [20, 40, 40]);
      flash(couleur, niveau === 'secrete' ? 0.95 : 0.65);
      secouer(niveau === 'secrete' ? 11 : 6);
      moteur?.emettre({
        ...centre,
        nombre: niveau === 'secrete' ? 180 : 110,
        couleurs: [couleur, couleur, '#ffffff', '#fff6d8'],
        vitesse: [240, 780],
        duree: [0.6, 1.4],
        taille: [1, 2.8]
      });
      if (niveau === 'secrete') {
        // La pluie d'étoiles tombe sur toute la largeur, pas en grappe au-dessus de la carte.
        for (let k = 0; k < 8; k += 1) {
          moteur?.emettre({
            x: centre.x + (k / 7 - 0.5) * taille.largeur * 0.95,
            y: centre.y - taille.hauteur * 0.5,
            nombre: 10,
            couleurs: [couleur, '#ffffff', '#c9a2ff', '#9fc4e8'],
            vitesse: [20, 120],
            direction: Math.PI / 2,
            ouverture: 1.6,
            duree: [2, 3],
            taille: [1.4, 3.2],
            gravite: 140,
            frein: 0.8,
            forme: 'etoile'
          });
        }
      }
    },
    [cartes, centreCarte, flash, plus, secouer, taille.hauteur, taille.largeur]
  );

  /** La carte retournée regagne sa place sur le bureau. */
  const poser = useCallback(() => {
    jeton.current += 1;
    setEnCours(null);
  }, []);

  /** Retourner la carte `index` : sur place si elle est simple, au centre et fêtée sinon. */
  const retourner = useCallback(
    (index: number) => {
      const carte = cartes[index];
      if (!carte || retournees[index] || enCours) return;
      const niveau = palier(carte.rarity);
      if (niveau === 'simple') {
        setRetournees((avant) => avant.map((r, i) => r || i === index));
        // La fête attend que la carte soit à moitié retournée : c'est là qu'on voit sa face.
        plus(260, () => feter(index));
        return;
      }
      const moi = (jeton.current += 1);
      setEnCours({ index, phase: 'levee' });
      vibrer(8);
      plus(SUSPENSE[niveau], () => {
        if (jeton.current !== moi) return;
        setRetournees((avant) => avant.map((r, i) => r || i === index));
        setEnCours({ index, phase: 'tenue' });
        plus(240, () => feter(index));
        plus(TENUE[niveau], () => {
          if (jeton.current === moi) poser();
        });
      });
    },
    [cartes, enCours, feter, plus, poser, retournees]
  );

  // Toutes retournées et reposées : la révélation est finie.
  useEffect(() => {
    if (apres !== 'revelation' || enCours || !retournees.every(Boolean)) return undefined;
    const id = window.setTimeout(() => setApres('ouvert'), 500);
    return () => window.clearTimeout(id);
  }, [apres, enCours, retournees]);

  /** Toucher une carte : la retourner, la reposer si elle est au centre, ou ouvrir sa fiche. */
  const activer = (index: number): void => {
    if (apres !== 'revelation' && apres !== 'ouvert') return;
    if (enCours) {
      if (enCours.index === index && enCours.phase === 'tenue') poser();
      return;
    }
    if (!retournees[index]) {
      retourner(index);
      return;
    }
    setFiche((f) => (f === index ? null : index));
  };

  const geometrie = useCallback((): Geometrie => {
    const el = zoneRef.current;
    const largeur = el?.clientWidth || 300;
    const hauteur = el?.clientHeight || 500;
    return { largeur, ligne: hauteur * LIGNE, tolerance: Math.max(26, hauteur * 0.075) };
  }, []);

  const surAppuiSachet = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (etat.phase !== 'ferme' || apres) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const geo = geometrie();
    inclinaison.current.actif = true;
    if (!surLaLigne(etat, y, geo)) {
      // Un appui sur le corps presse le sachet, et rappelle où l'on déchire.
      setPresse(true);
      setRappel((n) => n + 1);
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    depart.current = { x, y };
    tire.current = true;
    dernierCran.current = 0;
    vibrer(10);
    setEtat(demarrer(etat, x, geo));
  };

  const surMouvementSachet = (e: React.PointerEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (rect.width > 0) {
      inclinaison.current.actif = true;
      inclinaison.current.cx = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
      inclinaison.current.cy = Math.max(-1, Math.min(1, (y / rect.height) * 2 - 1));
    }
    if (!tire.current) return;
    const suivant = avancer(etat, x - depart.current.x, geometrie());
    if (suivant.dechirure > etat.dechirure) etincelles(suivant.dechirure, suivant.sens, 3);
    const cran = Math.floor(suivant.dechirure * 10);
    if (cran > dernierCran.current) vibrer(4);
    dernierCran.current = cran;
    setEtat(suivant);
  };

  const surRelacheSachet = (): void => {
    setPresse(false);
    if (!tire.current) return;
    tire.current = false;
    const suivant = relacher(etat);
    setEtat(suivant);
    if (suivant.phase === 'ouvert') {
      lancerOuverture();
      return;
    }
    // La bande retombe : on garde le découpage le temps que le ressort la ramène.
    setRefermant(true);
    plus(280, () => setRefermant(false));
  };

  const surSortieSachet = (): void => {
    inclinaison.current.actif = false;
    inclinaison.current.repos = performance.now();
    setPresse(false);
  };

  /** « Ouvrir » : la déchirure se joue seule, sans glissement (accès au pointeur), puis l'envol. */
  const ouvrirSansGeste = (): void => {
    if (etat.phase !== 'ferme' || apres) return;
    tire.current = false;
    setEtat({ phase: 'dechirure', dechirure: 0, sens: 1 });
    let derniere = 0;
    const annuler = animer(
      700,
      (k) => {
        const p = 1 - (1 - k) * (1 - k);
        if (p - derniere > 0.04) {
          etincelles(p, 1, 4);
          derniere = p;
        }
        setEtat({ phase: 'dechirure', dechirure: p, sens: 1 });
      },
      () => {
        annulations.current.delete(annuler);
        setEtat({ phase: 'ouvert', dechirure: 1, sens: 1 });
        lancerOuverture();
      }
    );
    annulations.current.add(annuler);
  };

  /** « Tout afficher » : toutes les cartes retournées, tout de suite. */
  const toutAfficher = (): void => {
    for (const annuler of annulations.current) annuler();
    annulations.current.clear();
    for (const id of minuteurs.current) window.clearTimeout(id);
    minuteurs.current.clear();
    jeton.current += 1;
    tire.current = false;
    setEtat({ phase: 'ouvert', dechirure: 1, sens: 1 });
    setRetournees(cartes.map(() => true));
    setEnCours(null);
    setEclat(null);
    setSortie(2);
    setApres('ouvert');
  };

  /** Sur la carte en fiche, le reflet suit le doigt : la carte se tient comme une vraie. */
  const surMouvementFiche = (e: React.PointerEvent<HTMLLIElement>, index: number): void => {
    if (fiche !== index || reduit) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0) return;
    const fx = (e.clientX - r.left) / r.width - 0.5;
    const fy = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--tx', `${(fx * 18).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--ty', `${(-fy * 14).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--gx', `${((fx + 0.5) * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty('--gy', `${((fy + 0.5) * 100).toFixed(1)}%`);
  };

  const surSortieFiche = (e: React.PointerEvent<HTMLLIElement>): void => {
    e.currentTarget.style.setProperty('--tx', '0deg');
    e.currentTarget.style.setProperty('--ty', '0deg');
  };

  const etape: Etape = apres ?? (etat.phase === 'ouvert' ? 'ouverture' : etat.phase);

  // La révélation donne le focus à la première carte : le clavier retourne sans chercher.
  useEffect(() => {
    if (apres === 'revelation') cartesRef.current[0]?.focus({ preventScroll: true });
  }, [apres]);

  // La poussière ne flotte que pendant l'ouverture : les cartes retournées, l'écran se calme.
  useEffect(() => {
    particules.current?.ambiance(etape !== 'ouvert');
  }, [etape]);

  const decoupe = etat.phase !== 'ferme' || refermant || apres === 'ouverture';
  const p = etat.dechirure;
  const sens = etat.sens;

  // La pochette : la plus grande qui tienne dans la scène, au format 3 × 5.
  const hauteurPochette = Math.min(taille.hauteur * 0.86, (taille.largeur * 0.8) / 0.6, 640);
  const largeurPochette = hauteurPochette * 0.6;

  const grande = echelleGrande(taille.largeur, taille.hauteur);
  const disposition = poseFiche(taille.largeur, taille.hauteur);

  function poseDe(i: number): { pose: Pose; opacite: number; transition: string; z: number } {
    const etalee = poseRecap(i, nombre, taille.largeur, taille.hauteur);
    if (apres === 'revelation' || apres === 'ouvert') {
      if (fiche === i) return { pose: disposition.carte, opacite: 1, transition: '760ms', z: 70 };
      if (enCours?.index === i) {
        return {
          pose: { x: 0, y: -taille.hauteur * 0.05, echelle: grande * 0.95, rotation: 0 },
          opacite: 1,
          transition: '900ms',
          z: 60
        };
      }
      const pose = retournees[i] ? etalee : { ...etalee, rotation: inclinaisonCachee(i) };
      return { pose, opacite: 1, transition: '800ms', z: 10 + i };
    }
    if (apres === 'ouverture' && sortie === 2) {
      return {
        pose: { ...etalee, rotation: inclinaisonCachee(i) },
        opacite: 1,
        transition: `1000ms ${i * 140}ms`,
        z: 30 - i
      };
    }
    // Avant l'étalage, les cartes sont **dans le sachet**, derrière son corps : elles émergent
    // par la fente (`sortie` 1), lentement, en léger éventail.
    const echelleSachet = (largeurPochette * 0.8) / CARTE.largeur;
    const hauteurCarte = CARTE.hauteur * echelleSachet;
    const fente = -hauteurPochette / 2 + hauteurPochette * LIGNE;
    const ecart = i - (nombre - 1) / 2;
    const monte = apres === 'ouverture' && sortie === 1;
    const haut = monte ? fente - hauteurCarte * (0.55 - Math.abs(ecart) * 0.05) : fente + 8;
    return {
      pose: {
        x: monte ? ecart * largeurPochette * 0.06 : 0,
        y: haut + hauteurCarte / 2,
        echelle: echelleSachet,
        rotation: monte ? ecart * 4 : 0
      },
      opacite: apres === 'ouverture' ? 1 : 0,
      transition: monte ? `1300ms ${i * 60}ms` : '300ms',
      z: 30 - i
    };
  }

  const nombreRetournees = retournees.filter(Boolean).length;
  const carteEnCours = enCours ? cartes[enCours.index] : undefined;
  const texteAnnonce =
    enCours?.phase === 'tenue' && carteEnCours ? annonce(palier(carteEnCours.rarity), graine + enCours.index) : null;

  const consigne = (() => {
    if (etape === 'ferme') return 'Glisse le doigt le long des pointillés';
    if (etape === 'dechirure') return 'Jusqu’au bout…';
    if (etape === 'ouverture') return '';
    if (fiche !== null) return 'Touche la carte pour la reposer';
    if (etape === 'revelation') {
      if (enCours?.phase === 'tenue') return 'Touche la carte pour la poser';
      if (enCours) return '…';
      return `Touche une carte pour la retourner · ${nombreRetournees} / ${nombre}`;
    }
    return 'Touche une carte pour la voir en entier';
  })();

  return (
    <div
      ref={racine}
      className="ouverture"
      data-etape={etape}
      data-palier={palierTirage}
      data-eclat={eclat ?? undefined}
      data-dechirure={p.toFixed(2)}
      data-testid="ouverture"
      style={{ ['--lueur' as string]: couleurLueur }}
    >
      <div className="ouverture__fond" aria-hidden="true">
        <div className="ouverture__rayons" />
        <div className="ouverture__faisceau" />
      </div>

      <p className="ouverture__titre">
        Arrivage : {nombre} carte{nombre > 1 ? 's' : ''}
        {neuves && neuves.size > 0 ? ` · ${neuves.size} nouvelle${neuves.size > 1 ? 's' : ''}` : ''}
      </p>

      <div
        ref={scene}
        className="ouverture__scene"
        aria-describedby="ouverture-consigne"
        onClick={() => {
          // Toucher à côté : la fiche se referme, la carte fêtée regagne sa place.
          if (fiche !== null) setFiche(null);
          else if (enCours?.phase === 'tenue') poser();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && fiche !== null) {
            // L'Échap referme la fiche, pas l'Arrivage.
            e.stopPropagation();
            setFiche(null);
          }
        }}
      >
        {!reduit && apres !== 'revelation' && apres !== 'ouvert' && (
          <div
            ref={zoneRef}
            className={`ouverture__zone${presse ? ' ouverture__zone--presse' : ''}`}
            data-zone
            role="group"
            aria-label="Le sachet"
            style={{ width: `${largeurPochette}px`, height: `${hauteurPochette}px` }}
            onPointerDown={surAppuiSachet}
            onPointerMove={surMouvementSachet}
            onPointerUp={surRelacheSachet}
            onPointerCancel={surRelacheSachet}
            onLostPointerCapture={surRelacheSachet}
            onPointerLeave={surSortieSachet}
          >
            <div className="ouverture__flotte">
              <div
                ref={sachet}
                className="ouverture__sachet"
                data-decoupe={decoupe ? 'oui' : 'non'}
                data-tire={tire.current ? 'oui' : 'non'}
                style={{
                  ['--p' as string]: p.toFixed(3),
                  ['--sens' as string]: String(sens),
                  ['--masque' as string]: MASQUE_SILHOUETTE
                }}
              >
                {/* L'intérieur : la lumière qui filtre par la fente, de la couleur du tirage. */}
                <div className="ouverture__interieur" />
                <div className="ouverture__corps" style={decoupe ? { clipPath: clips.corps } : undefined}>
                  <Pochette nombre={nombre} />
                  <span className="ouverture__reflet-sachet" />
                </div>
                {decoupe && (
                  <div
                    className={`ouverture__bande${apres === 'ouverture' ? ' ouverture__bande--envol' : ''}`}
                    style={{ clipPath: clips.bande }}
                  >
                    <Pochette nombre={nombre} />
                    <span className="ouverture__reflet-sachet" />
                  </div>
                )}
                {etat.phase === 'dechirure' && p > 0.01 && <span className="ouverture__fente" />}
                {etape === 'ferme' && (
                  <span
                    key={rappel}
                    className="ouverture__guide"
                    style={rappel > 0 ? { animationDelay: '0ms' } : undefined}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Les cartes sont **toujours** dans le DOM, même avant l'ouverture : le tirage et le badge
          « Nouvelle » ne dépendent d'aucune animation (D-098). */}
        <ol
          className={`ouverture__cartes${fiche !== null ? ' ouverture__cartes--fiche' : ''}${
            enCours ? ' ouverture__cartes--scene' : ''
          }${apres === 'ouverture' || !apres ? ' ouverture__cartes--dedans' : ''}`}
          data-cartes
          aria-label="Le tirage"
        >
          {cartes.map((carte, i) => {
            const { pose, opacite, transition, z } = poseDe(i);
            const niveau = palier(carte.rarity);
            const face = retournees[i] === true;
            const actif = apres === 'revelation' || apres === 'ouvert';
            const leve = enCours?.index === i;
            return (
              <li
                key={`${carte.id}-${i}`}
                ref={(el) => {
                  cartesRef.current[i] = el;
                }}
                className="ouverture__carte"
                data-palier={niveau}
                data-face={face ? 'recto' : 'verso'}
                data-tension={leve && enCours?.phase === 'levee' ? 'oui' : undefined}
                data-fetee={leve && enCours?.phase === 'tenue' ? 'oui' : undefined}
                data-fiche={fiche === i ? 'oui' : undefined}
                tabIndex={actif ? 0 : undefined}
                role={actif ? 'button' : undefined}
                aria-label={
                  actif
                    ? face
                      ? `${carte.name}${neuves?.has(i) ? ', nouvelle' : ''} — voir la fiche`
                      : `Carte ${i + 1}, face cachée — la retourner`
                    : undefined
                }
                style={{
                  transform: transformDe(pose),
                  opacity: opacite,
                  zIndex: z,
                  transition: `transform ${transition} cubic-bezier(0.2, 0.8, 0.2, 1), opacity 400ms ease, filter 500ms ease`,
                  ['--rarete' as string]: RARITY_META[carte.rarity].color,
                  ['--contre' as string]: (1 / pose.echelle).toFixed(3),
                  ['--suspense' as string]: `${SUSPENSE[niveau]}ms`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  activer(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activer(i);
                  }
                }}
                onPointerMove={(e) => surMouvementFiche(e, i)}
                onPointerLeave={surSortieFiche}
              >
                <div className="ouverture__retourne">
                  <div className="ouverture__face">
                    <CardView card={carte} />
                    {auMoins(niveau, 'rare') && <span className="ouverture__holo" aria-hidden="true" />}
                    <span className="ouverture__reflet-fiche" aria-hidden="true" />
                  </div>
                  <div className="ouverture__dos" aria-hidden="true">
                    <span className="ouverture__dos-sigle">BP</span>
                  </div>
                </div>
                {neuves?.has(i) && <span className="ouverture__neuve">Nouvelle</span>}
              </li>
            );
          })}
        </ol>

        {texteAnnonce && carteEnCours && enCours && (
          <div
            key={`annonce-${enCours.index}`}
            className="ouverture__annonce"
            data-palier={palier(carteEnCours.rarity)}
            role="status"
            style={{ ['--rarete' as string]: RARITY_META[carteEnCours.rarity].color }}
          >
            <strong className="ouverture__annonce-texte">{texteAnnonce}</strong>
            <span className="ouverture__annonce-sous">
              {RARITY_META[carteEnCours.rarity].label} · {carteEnCours.name}
            </span>
          </div>
        )}

        {fiche !== null && cartes[fiche] && (
          <FicheCarte
            key={fiche}
            carte={cartes[fiche]}
            neuve={neuves?.has(fiche) === true}
            disposition={disposition.disposition}
            style={{
              left: `${disposition.panneau.x}px`,
              top: `${disposition.panneau.y}px`,
              width: `${disposition.panneau.largeur}px`,
              height: `${disposition.panneau.hauteur}px`
            }}
            onFermer={() => setFiche(null)}
          />
        )}
      </div>

      <canvas ref={canvas} className="ouverture__particules" aria-hidden="true" />
      <div ref={eclair} className="ouverture__eclair" aria-hidden="true" />

      <div className="ouverture__pied">
        <p className="ouverture__consigne" id="ouverture-consigne" data-consigne aria-live="polite">
          {consigne}
        </p>
        <div className="ouverture__actions">
          {etape === 'ferme' && (
            <button type="button" className="button" data-ouvrir onClick={ouvrirSansGeste}>
              Ouvrir
            </button>
          )}
          {etape !== 'ouvert' && (
            <button type="button" className="button" data-tout-afficher onClick={toutAfficher}>
              Tout afficher
            </button>
          )}
          {etape === 'ouvert' && (
            <button type="button" className="button button--gold" onClick={onRanger}>
              Ranger dans la Collection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
