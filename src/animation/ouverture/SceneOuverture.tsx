/*
 * **L'ouverture d'un Arrivage** (#283, `docs/SPEC-OUVERTURE-ARRIVAGE.md`).
 *
 * Plein écran, quatre temps :
 *  1. **le sachet** flotte dans un faisceau de lumière, s'incline sous le doigt, ses reflets
 *     holographiques suivent l'inclinaison ;
 *  2. **la déchirure** suit le doigt le long des pointillés, depuis le bord choisi : la bande se
 *     soulève, la lumière de l'intérieur filtre par la fente — **de la couleur de la meilleure carte** ;
 *  3. **l'ouverture** : la bande s'envole, éclair, gerbe d'étincelles, les cartes montent du sachet ;
 *  4. **la révélation**, carte par carte : chacune se retourne avec une mise en scène qui croît avec
 *     sa rareté (`revelation.ts`), et part d'un glissement ; puis le **récapitulatif**, où une carte
 *     touchée se montre en grand.
 *
 * Les règles vivent dans `etats.ts` et `revelation.ts` (purs, testés) ; ici il n'y a que le rendu,
 * les gestes et l'horloge de la mise en scène.
 *
 * Trois choses ne sont **pas** facultatives, et viennent des décisions :
 *  - **Mouvement réduit** (D-098) : sous la bascule du store ou `prefers-reduced-motion`, on arrive
 *    directement au récapitulatif, sans sachet, sans particules ni cascade ;
 *  - **un chemin sans glissement** (les critères WCAG d'accès au pointeur, spec §5) : « Ouvrir » joue la déchirure
 *    seul, « Tout afficher » saute au récapitulatif ; le clavier fait passer les cartes ;
 *  - **aucune information ne vit dans l'animation** : les cinq cartes et leurs badges « Nouvelle »
 *    sont dans le DOM dès le premier rendu, retournées ou non.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@/data/types';
import { RARITY_META } from '@/data';
import { CardView } from '@/components/CardView';
import { useMouvementReduit } from '@/components/use-mouvement-reduit';
import { avancer, creer, demarrer, relacher, surLaLigne, type EtatOuverture, type Geometrie } from './etats';
import { LIGNE, MASQUE_SILHOUETTE, Pochette } from './Pochette';
import { Particules } from './particules';
import {
  auMoins,
  CARTE,
  decoupes,
  echelleGrande,
  lueur,
  meilleurPalier,
  palier,
  posePile,
  poseRecap,
  SUSPENSE,
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

/** Ce qui suit la déchirure : l'envol, la révélation carte par carte, puis le récapitulatif. */
type Apres = 'ouverture' | 'revelation' | 'ouvert';
export type Etape = 'ferme' | 'dechirure' | Apres;

/** Durée de l'envol, de l'éclair à la pile posée au centre. */
const DUREE_OUVERTURE = 1150;
/** Au-delà de ce glissement (px), la carte du dessus part ; en deçà, elle revient. */
const SEUIL_JET = 70;
/** Un appui qui bouge moins que ça est un toucher, pas un glissement. */
const TOUCHER = 8;

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
  const trace = useMemo(() => traceDechirure(Math.floor(Math.random() * 1e9), LIGNE * 100), []);
  const clips = useMemo(() => decoupes(trace), [trace]);

  const [etat, setEtat] = useState<EtatOuverture>(() =>
    reduit ? { phase: 'ouvert', dechirure: 1, sens: 1 } : creer()
  );
  const [apres, setApres] = useState<Apres | null>(() => (reduit ? 'ouvert' : null));
  const [refermant, setRefermant] = useState(false);
  const [presse, setPresse] = useState(false);
  const [courante, setCourante] = useState(0);
  const [retournee, setRetournee] = useState(false);
  const [tension, setTension] = useState(false);
  const [parties, setParties] = useState<Record<number, 1 | -1>>({});
  const [glisse, setGlisse] = useState<{ dx: number; dy: number } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [eclat, setEclat] = useState<Palier | null>(null);
  /** L'envol en trois temps : 0 dans le sachet, 1 émergées par la fente, 2 posées au centre. */
  const [sortie, setSortie] = useState<0 | 1 | 2>(0);
  const [taille, setTaille] = useState({ largeur: 390, hauteur: 560 });

  const racine = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const sachet = useRef<HTMLDivElement>(null);
  const eclair = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const particules = useRef<Particules | null>(null);
  const minuteurs = useRef(new Set<number>());
  const annulations = useRef(new Set<() => void>());
  const depart = useRef({ x: 0, y: 0 });
  const tire = useRef(false);
  const dernierCran = useRef(0);
  const inclinaison = useRef({ cx: 0, cy: 0, x: 0, y: 0, actif: false, repos: 0 });
  /** Rejoue l'éclat qui parcourt les pointillés : un appui tombé à côté le rappelle. */
  const [rappel, setRappel] = useState(0);
  const geste = useRef<{ x: number; y: number; t: number; bouge: boolean } | null>(null);

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

  // La taille de la scène : elle règle la pochette, la pile et le récapitulatif.
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

  const flash = useCallback((couleur: string, force: number) => {
    eclair.current?.animate?.(
      [
        { opacity: 0, background: `radial-gradient(circle at 50% 45%, #fff 0%, ${couleur} 35%, transparent 75%)` },
        { opacity: force, offset: 0.18 },
        { opacity: 0 }
      ],
      { duration: 620, easing: 'ease-out' }
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
      { duration: 380, easing: 'ease-out' }
    );
  }, []);

  // L'inclinaison du sachet : un ressort vers la cible du doigt, ou un balancement lent au repos.
  useEffect(() => {
    if (reduit || apres === 'revelation' || apres === 'ouvert') return undefined;
    if (typeof requestAnimationFrame !== 'function') return undefined;
    let raf = 0;
    const pas = (t: number): void => {
      const inc = inclinaison.current;
      // Au repos, le sachet se balance, et le balancement **s'éteint** en quatre secondes : rien ne
      // bouge sans fin à l'écran (SPEC-COMBAT-UI §6.8), le doigt le relance.
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

  /** L'envol : la bande part, éclair, gerbe, les cartes montent ; puis la révélation. */
  const lancerOuverture = useCallback(() => {
    setApres('ouverture');
    setCourante(0);
    setRetournee(false);
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
    plus(140, () => setSortie(1));
    plus(640, () => setSortie(2));
    plus(DUREE_OUVERTURE, () => setApres('revelation'));
  }, [couleurLueur, flash, palierTirage, plus, secouer, versRacine]);

  // La carte du dessus se retourne, après une attente qui croît avec sa rareté.
  useEffect(() => {
    if (apres !== 'revelation' || courante >= nombre) return undefined;
    const carte = cartes[courante];
    if (!carte) return undefined;
    const niveau = palier(carte.rarity);
    setRetournee(false);
    setTension(auMoins(niveau, 'brillante'));
    const id = window.setTimeout(() => setRetournee(true), SUSPENSE[niveau]);
    return () => window.clearTimeout(id);
  }, [apres, courante, cartes, nombre]);

  // La mise en scène du retournement : rien pour une carte simple, tout pour une secrète.
  useEffect(() => {
    if (!retournee || apres !== 'revelation') return;
    setTension(false);
    const carte = cartes[courante];
    if (!carte) return;
    const niveau = palier(carte.rarity);
    if (niveau === 'simple') return;
    const couleur = RARITY_META[carte.rarity].color;
    const centre = centreScene();
    const moteur = particules.current;
    setEclat(niveau);
    plus(niveau === 'secrete' ? 2200 : 1300, () => setEclat(null));
    if (niveau === 'rare') {
      vibrer(12);
      moteur?.emettre({
        ...centre,
        nombre: 46,
        couleurs: [couleur, '#ffffff'],
        vitesse: [160, 420],
        duree: [0.4, 0.9]
      });
      return;
    }
    vibrer(niveau === 'secrete' ? [30, 50, 30, 50, 80] : [20, 40, 40]);
    flash(couleur, niveau === 'secrete' ? 0.9 : 0.6);
    secouer(niveau === 'secrete' ? 10 : 5);
    moteur?.emettre({
      ...centre,
      nombre: niveau === 'secrete' ? 160 : 90,
      couleurs: [couleur, couleur, '#ffffff', '#fff6d8'],
      vitesse: [240, 760],
      duree: [0.6, 1.3],
      taille: [1, 2.8]
    });
    if (niveau === 'secrete') {
      // La pluie d'étoiles tombe sur toute la largeur, pas en grappe au-dessus de la carte.
      for (let k = 0; k < 8; k += 1) {
        moteur?.emettre({
          x: centre.x + (k / 7 - 0.5) * taille.largeur * 0.95,
          y: centre.y - taille.hauteur * 0.5,
          nombre: 9,
          couleurs: [couleur, '#ffffff', '#c9a2ff', '#9fc4e8'],
          vitesse: [20, 120],
          direction: Math.PI / 2,
          ouverture: 1.6,
          duree: [1.8, 2.8],
          taille: [1.4, 3.2],
          gravite: 160,
          frein: 0.8,
          forme: 'etoile'
        });
      }
    }
  }, [retournee, apres, courante, cartes, centreScene, flash, plus, secouer, taille.hauteur, taille.largeur]);

  /** La carte du dessus part, dans le sens du geste ; la dernière ouvre le récapitulatif. */
  const jeter = useCallback(
    (sens: 1 | -1) => {
      if (apres !== 'revelation' || courante >= nombre) return;
      setParties((avant) => ({ ...avant, [courante]: sens }));
      setGlisse(null);
      vibrer(8);
      const suivante = courante + 1;
      setCourante(suivante);
      if (suivante >= nombre) plus(380, () => setApres('ouvert'));
    },
    [apres, courante, nombre, plus]
  );

  /** Toucher la carte du dessus : la retourner tout de suite, ou la faire passer. */
  const toucherCourante = useCallback(
    (sens: 1 | -1 = -1) => {
      if (apres !== 'revelation') return;
      if (!retournee) {
        setRetournee(true);
        return;
      }
      jeter(sens);
    },
    [apres, retournee, jeter]
  );

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
      620,
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

  /** « Tout afficher » : le récapitulatif, tout de suite. */
  const toutAfficher = (): void => {
    for (const annuler of annulations.current) annuler();
    annulations.current.clear();
    for (const id of minuteurs.current) window.clearTimeout(id);
    minuteurs.current.clear();
    tire.current = false;
    setEtat({ phase: 'ouvert', dechirure: 1, sens: 1 });
    setCourante(nombre);
    setRetournee(true);
    setTension(false);
    setGlisse(null);
    setApres('ouvert');
  };

  // Les gestes sur la carte du dessus : un toucher la fait passer, un glissement la jette.
  const surAppuiCarte = (e: React.PointerEvent<HTMLLIElement>, index: number): void => {
    if (apres === 'ouvert') return;
    if (apres !== 'revelation' || index !== courante) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    geste.current = { x: e.clientX, y: e.clientY, t: performance.now(), bouge: false };
  };

  const surMouvementCarte = (e: React.PointerEvent<HTMLLIElement>): void => {
    const g = geste.current;
    if (!g || !retournee) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.bouge && Math.hypot(dx, dy) < TOUCHER) return;
    g.bouge = true;
    setGlisse({ dx, dy: dy * 0.35 });
  };

  const surRelacheCarte = (e: React.PointerEvent<HTMLLIElement>, index: number): void => {
    if (apres === 'ouvert') {
      setZoom((z) => (z === index ? null : index));
      return;
    }
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    if (!g.bouge) {
      toucherCourante(-1);
      return;
    }
    const dx = e.clientX - g.x;
    const vitesse = dx / Math.max(1, performance.now() - g.t);
    if (Math.abs(dx) > SEUIL_JET || Math.abs(vitesse) > 0.6) {
      jeter(dx >= 0 ? 1 : -1);
      return;
    }
    setGlisse(null);
  };

  const surAnnuleCarte = (): void => {
    geste.current = null;
    setGlisse(null);
  };

  const surClavier = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (apres === 'revelation' && ['Enter', ' ', 'ArrowRight', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      toucherCourante(e.key === 'ArrowRight' ? 1 : -1);
    }
    if (apres === 'ouvert' && e.key === 'Escape' && zoom !== null) {
      e.stopPropagation();
      setZoom(null);
    }
  };

  const etape: Etape = apres ?? (etat.phase === 'ouvert' ? 'ouverture' : etat.phase);

  // La révélation prend le focus : le clavier fait passer les cartes sans chercher où appuyer.
  useEffect(() => {
    if (apres === 'revelation') scene.current?.focus({ preventScroll: true });
  }, [apres]);

  // La poussière ne flotte que pendant l'ouverture : le récapitulatif est un écran calme.
  useEffect(() => {
    particules.current?.ambiance(etape !== 'ouvert');
  }, [etape]);
  const decoupe = etat.phase !== 'ferme' || refermant || apres === 'ouverture';
  const p = etat.dechirure;
  const sens = etat.sens;

  // La pochette : la plus grande qui tienne dans la scène, au format 3 × 5.
  const hauteurPochette = Math.min(taille.hauteur * 0.86, (taille.largeur * 0.8) / 0.6, 640);
  const largeurPochette = hauteurPochette * 0.6;

  const echelle = echelleGrande(taille.largeur, taille.hauteur);

  function poseDe(i: number): { pose: Pose; opacite: number; face: boolean; z: number } {
    if (apres === 'ouvert') {
      if (zoom === i) return { pose: { x: 0, y: 0, echelle, rotation: 0 }, opacite: 1, face: true, z: 60 };
      return { pose: poseRecap(i, nombre, taille.largeur, taille.hauteur), opacite: 1, face: true, z: 10 + i };
    }
    const rang = Math.max(0, i - courante);
    if (apres === 'revelation') {
      const parti = parties[i];
      if (parti) {
        return {
          pose: { x: parti * (taille.largeur / 2 + CARTE.largeur * echelle), y: -50, echelle, rotation: parti * 28 },
          opacite: 0,
          face: true,
          z: 40
        };
      }
      const pose = posePile(rang, taille.largeur, taille.hauteur);
      if (rang === 0 && glisse) {
        pose.x += glisse.dx;
        pose.y += glisse.dy;
        pose.rotation += glisse.dx / 14;
      }
      return { pose, opacite: rang > 3 ? 0 : 1, face: rang === 0 && retournee, z: 30 - rang };
    }
    // Avant la révélation, les cartes sont **dans le sachet**, derrière son corps : elles émergent
    // par la fente (`sortie` 1), puis gagnent le centre pendant que le sachet tombe (`sortie` 2).
    const pile = posePile(rang, taille.largeur, taille.hauteur);
    if (apres === 'ouverture' && sortie === 2) return { pose: pile, opacite: 1, face: false, z: 30 - rang };
    const echelleSachet = (largeurPochette * 0.8) / CARTE.largeur;
    const hauteurCarte = CARTE.hauteur * echelleSachet;
    const fente = -hauteurPochette / 2 + hauteurPochette * LIGNE;
    const haut = apres === 'ouverture' && sortie === 1 ? fente - hauteurCarte * (0.5 - rang * 0.06) : fente + 8;
    return {
      pose: { x: pile.x * 0.5, y: haut + hauteurCarte / 2, echelle: echelleSachet, rotation: pile.rotation * 0.4 },
      opacite: apres === 'ouverture' ? 1 : 0,
      face: false,
      z: 30 - rang
    };
  }

  const consigne = (() => {
    if (etape === 'ferme') return 'Glisse le doigt le long des pointillés';
    if (etape === 'dechirure') return 'Jusqu’au bout…';
    if (etape === 'ouverture') return '';
    if (etape === 'revelation') {
      const rang = Math.min(courante + 1, nombre);
      return retournee ? `${rang} / ${nombre} · touche ou glisse pour la suivante` : `${rang} / ${nombre}`;
    }
    return zoom === null ? 'Touche une carte pour la voir en grand' : 'Touche-la encore pour la reposer';
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
        tabIndex={apres === 'revelation' ? 0 : -1}
        onKeyDown={surClavier}
        onClick={(e) => {
          // Pendant la révélation, toucher **à côté** de la carte la fait passer aussi.
          if (apres === 'revelation' && !(e.target as HTMLElement).closest('.ouverture__carte')) toucherCourante(-1);
        }}
        aria-describedby="ouverture-consigne"
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
          className={`ouverture__cartes${zoom !== null ? ' ouverture__cartes--zoom' : ''}${
            apres === 'ouverture' || !apres ? ' ouverture__cartes--dedans' : ''
          }`}
          data-cartes
          aria-label="Le tirage"
        >
          {cartes.map((carte, i) => {
            const { pose, opacite, face, z } = poseDe(i);
            const niveau = palier(carte.rarity);
            const enMain = apres === 'revelation' && i === courante;
            return (
              <li
                key={`${carte.id}-${i}`}
                className="ouverture__carte"
                data-palier={niveau}
                data-face={face ? 'recto' : 'verso'}
                data-tension={enMain && tension && !retournee ? 'oui' : undefined}
                data-glisse={enMain && glisse ? 'oui' : undefined}
                data-zoom={zoom === i ? 'oui' : undefined}
                data-courante={enMain ? 'oui' : undefined}
                tabIndex={apres === 'ouvert' ? 0 : undefined}
                aria-label={apres === 'ouvert' ? `${carte.name}${neuves?.has(i) ? ', nouvelle' : ''}` : undefined}
                style={{
                  transform: transformDe(pose),
                  opacity: opacite,
                  zIndex: z,
                  transitionDelay: apres === 'ouvert' && zoom === null ? `${i * 70}ms` : '0ms',
                  ['--rarete' as string]: RARITY_META[carte.rarity].color,
                  ['--contre' as string]: (1 / pose.echelle).toFixed(3)
                }}
                onPointerDown={(e) => surAppuiCarte(e, i)}
                onPointerMove={surMouvementCarte}
                onPointerUp={(e) => surRelacheCarte(e, i)}
                onPointerCancel={surAnnuleCarte}
                onKeyDown={(e) => {
                  if (apres === 'ouvert' && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setZoom((zz) => (zz === i ? null : i));
                  }
                }}
              >
                <div className="ouverture__retourne">
                  <div className="ouverture__face">
                    <CardView card={carte} />
                    {auMoins(niveau, 'rare') && <span className="ouverture__holo" aria-hidden="true" />}
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
