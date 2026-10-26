/*
 * **Les chorégraphies de Pression** (D-098). Une attaque → une animation, dérivée de son nom,
 * de sa faction et de ses effets ; deux attaques d'une même carte n'ont jamais le même motif.
 * La grosse attaque d'un Planqué COU, 3 étoiles ou COMEX reçoit en plus une cinématique.
 */
import { FACTION_META } from "@/data";
import type { Attack, PlanqueCard, Status } from "@/data/types";
import {
  alea,
  arrondi,
  bezier,
  centre,
  chiffre,
  eclair,
  eclatCarte,
  facilite,
  hacher,
  lerp,
  onde,
} from "./moteur";
import type { Etape, Moteur, Pt, Rect } from "./moteur";

export interface Scene {
  m: Moteur;
  att: HTMLElement;
  cib: HTMLElement;
  /** Le Stress encaissé par la cible ; 0 pour un coup sans dégât. */
  stress: number;
  /** La Pression fait craquer la cible : la saynète de sortie joue après l'impact. */
  coupDeGrace: boolean;
}

export interface Choregraphie {
  nom: string;
  etapes: Etape[];
  duree: number;
  cinematique: boolean;
}

interface Ctx {
  m: Moteur;
  att: HTMLElement;
  cib: HTMLElement;
  A: Rect;
  C: Rect;
  a: Pt;
  c: Pt;
  couleur: string;
  rnd: () => number;
  attaque: Attack;
  carte: PlanqueCard;
  /**
   * Le Stress **encaissé** par la cible, tel que l'effet de combat le calcule (Vulnérabilité
   * comprise). Absent quand la cible n'a rien encaissé : la scène n'affiche alors aucun chiffre.
   */
  stress: number;
  /** La cible craque sur ce coup. */
  coupDeGrace: boolean;
  /** La pose de l'attaquant pendant une cinématique (centré, agrandi) ; vide sinon. */
  base: string;
}

/** Une transformation de l'attaquant, appliquée par-dessus sa pose. */
function pose(x: Ctx, s: string): string {
  if (!x.base) return s;
  return s === "none" ? x.base : `${x.base} ${s}`;
}

// ---------- Attribution : une animation distincte par attaque d'une carte ----------

type CleD =
  | "tampon"
  | "avion"
  | "enveloppes"
  | "graphe"
  | "dossiers"
  | "cafe"
  | "postits"
  | "eclair"
  | "megaphone"
  | "marteau"
  | "soudure"
  | "zen"
  | "soin"
  | "extincteur"
  | "laser"
  | "chrono"
  | "chaines"
  | "cv";

/** Les mots que le tampon imprime (le motif `tampon`). */
const MOTS_TAMPON = [
  "NON CONFORME",
  "VALIDÉ",
  "À REVOIR",
  "URGENT",
  "VU",
  "REFUSÉ",
];

const MOTIFS_D: Record<CleD, { libelle: string; mots: RegExp }> = {
  tampon: {
    libelle: "Coup de tampon",
    mots: /conformit|norme|certific|contr[ôo]le|audit|inspection|v[ée]rification|attestation|recette|z[ée]ro d[ée]faut|[ée]cart|checklist|validation/i,
  },
  avion: {
    libelle: "Avion en papier",
    mots: /note|newsletter|compte rendu|convocation|mot doux|tract|mutation|renvoi|export|transport|relais|affectation|mission/i,
  },
  enveloppes: {
    libelle: "Avalanche de mails",
    mots: /relance|ticket|faq|chatbot|connaissances|facture|devis|appel d|commande|prospection|transfert d.appel|assistance|mise à jour/i,
  },
  graphe: {
    libelle: "Courbe qui grimpe",
    mots: /tableau de bord|reporting|barom|objectif|prime|croissance|rendement|budg|tr[ée]sorerie|virement|index|performance|enqu[êe]te|analyse|revue/i,
  },
  dossiers: {
    libelle: "Pile de dossiers",
    mots: /dossier|proc[ée]dure|protocole|mode op|mode d.emploi|archiv|inventaire|catalogue|script|clause|contrat|contentieux|accord|convention|gamme|ordre de|saisie|sauvegarde|relev/i,
  },
  cafe: {
    libelle: "Café renversé",
    mots: /caf[ée]|afterwork|pot de|verre|pause|corbeille|panier|menu|babyfoot/i,
  },
  postits: {
    libelle: "Nuée de post-its",
    mots: /atelier|kaizen|plan d.action|feuille de route|planning|agenda|jalon|team|icebreaker|briefing|point de suivi|lean|r[ée]troplanning|semaine/i,
  },
  eclair: {
    libelle: "Arc électrique",
    mots: /[ée]lectri|c[âa]blage|raccordement|multim|bobinage|d[ée]nudage|deadline|acc[ée]l[ée]ration|chargement|remise en service|d[ée]blocage|radio/i,
  },
  megaphone: {
    libelle: "Mégaphone",
    mots: /gr[èe]ve|action collective|motion|n[ée]gociation|marque employeur|escalade|contre-ordre|r[ée]quisition|consigne/i,
  },
  marteau: {
    libelle: "Coup de massue",
    mots: /gros|frappe|cl[ée]|usinage|levage|chariot|coulage|restructuration|r[ée]organisation|plan social|fusion|d[ée]part|refonte|d[ée]merde|manipulation/i,
  },
  soudure: {
    libelle: "Chalumeau",
    mots: /soudure|graissage|r[ée]glage|gabarit|pliage|lissage|r[ée]vision|maintenance|r[ée]installation/i,
  },
  zen: {
    libelle: "Pétales zen",
    mots: /yoga|lotus|relaxation|shiatsu|[ée]tirement|oxyg|[ée]coute|bilan forme|bonheur|inclusion|mixit|amiti/i,
  },
  soin: {
    libelle: "Piqûre",
    mots: /pansement|bandage|piq[ûu]re|massage|sant[ée]|diagnostic|arr[êe]t|autopsie|pr[ée]l[èe]vement|r[ée]gime/i,
  },
  extincteur: {
    libelle: "Extincteur",
    mots: /extincteur|serpill|fluidif|filtr/i,
  },
  laser: {
    libelle: "Pointeur laser",
    mots: /pr[ée]sentation|direction|arbitrage|strat[ée]g|cibl|recherche|approche|discr[èe]te/i,
  },
  chrono: {
    libelle: "Chrono qui s’emballe",
    mots: /chrono|cadence|rattrapage|ronde|ligne|ordonnancement|goulot|plan de charge|continuit|reprise|express/i,
  },
  chaines: {
    libelle: "Chaînes",
    mots: /porte ferm|garde|r[ée]tention|bascule|contre-offre|offre|clause/i,
  },
  cv: {
    libelle: "Pluie de CV",
    mots: /entretien|comp[ée]tences|carri[èe]re|promesse|embauche|stage|initiation|int[ée]gration|accueil|livret|universit|module|formation|parcours|mont[ée]e|programme|remplacement|renfort|pr[ée]carit/i,
  },
};

const REPLI_FACTION: Record<PlanqueCard["faction"], CleD> = {
  SSE: "soin",
  MANAGEMENT: "postits",
  QVT: "zen",
  AMELIORATION: "tampon",
  RH: "cv",
  ATELIER: "marteau",
  DIRECTION: "graphe",
  SYNDICAT: "megaphone",
  INTERIM: "avion",
  SUPPORT: "enveloppes",
};

function ordreHache<T>(cles: readonly T[], graine: string): T[] {
  return [...cles].sort(
    (x, y) => hacher(graine + String(x)) - hacher(graine + String(y)),
  );
}

function candidats(carte: PlanqueCard, attaque: Attack): CleD[] {
  const graine = `${carte.id}:${attaque.name}`;
  const cles = Object.keys(MOTIFS_D) as CleD[];
  const parNom = cles.filter((k) => MOTIFS_D[k].mots.test(attaque.name));
  return [...parNom, REPLI_FACTION[carte.faction], ...ordreHache(cles, graine)];
}

/** Le motif de chaque attaque de la carte, distinct d'une attaque à l'autre. */
export function attribuer(carte: PlanqueCard): Map<number, CleD> {
  const pris = new Set<CleD>();
  const sortie = new Map<number, CleD>();
  // La clé est le **rang** de la Pression, jamais son nom : deux attaques homonymes d'une même
  // carte gardent chacune la leur, là où une `Map` par nom écrasait la première.
  carte.attacks.forEach((attaque, rang) => {
    const cle = candidats(carte, attaque).find((k) => !pris.has(k)) ?? "postits";
    pris.add(cle);
    sortie.set(rang, cle);
  });
  return sortie;
}

export function libelle(cle: string): string {
  return MOTIFS_D[cle as CleD]?.libelle ?? cle;
}

export function estLegendaire(carte: PlanqueCard): boolean {
  return carte.rarity === "COU" || carte.rarity === "3S" || carte.ex === true;
}

/**
 * **La cinématique est réservée** (D-098) : un Planqué COU, 3 étoiles ou COMEX, et seulement
 * sur sa Pression la plus chère. Une carte ordinaire n'en a jamais, et la petite attaque d'un
 * légendaire non plus — sinon la carte aurait deux fois la même fête.
 */
export function cinematiqueDe(carte: PlanqueCard, attaque: Attack): boolean {
  if (!estLegendaire(carte)) return false;
  const max = Math.max(...carte.attacks.map((a) => a.cost.length));
  if (attaque.cost.length !== max) return false;
  // À coût égal, la fête va à la **première** Pression de la carte, pas aux deux.
  const premiere = carte.attacks.findIndex((a) => a.cost.length === max);
  return premiere === carte.attacks.indexOf(attaque);
}

// ---------- Construction ----------

/** Le coup de grâce commence juste après l'impact (le temps que le gel d'impact passe)… */
const SORTIE_DEBUT = 100;
/** …et sa dernière image est la fin de la note de service : voir `sayneteDeSortie`. */
const SORTIE_DUREE = 2250;

export function choregraphie(
  carte: PlanqueCard,
  attaque: Attack,
  sc: Scene,
): Choregraphie {
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
    base: "",
  };
  const cle =
    attribuer(carte).get(carte.attacks.indexOf(attaque)) ?? "postits";
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
    },
  });
  if (sc.coupDeGrace) sayneteDeSortie(ctx, etapes, impact + SORTIE_DEBUT);
  const finApres = apres(ctx, etapes, impact + 120);
  // La saynète de sortie court jusqu'à `impact + SORTIE_DEBUT + SORTIE_DUREE` : la séquence doit
  // lui laisser le temps d'aller au bout, sinon le carton et la note resteraient en l'air.
  const duree = Math.max(
    impact + 950,
    finApres,
    sc.coupDeGrace ? impact + SORTIE_DEBUT + SORTIE_DUREE + 50 : 0,
  );
  // Un coup de grâce sous cinématique : la salle se retire dès que l'impact est passé, pour que la
  // saynète de sortie se joue sur un plateau clair et non sous le voile.
  // Le retour de la carte part **après** tout ce que l'après a programmé sur elle
  // (`switchSelf` va jusqu'à `impact + 1020`) : sinon le retour de la cinématique l'écrase.
  if (cinematique)
    etapes.push({
      a: duree - 340 > impact + 1020 ? duree - 340 : impact + 1020,
      faire: () => retourCinematique(ctx),
    });
  return { nom: libelle(cle), etapes, duree, cinematique };
}

// ---------- A : la référence (#207) ----------

function anticipation(x: Ctx, e: Etape[], t: number, duree = 240) {
  e.push({
    a: t,
    faire: () =>
      x.m.animer(
        x.att,
        [
          { transform: pose(x, "none") },
          { transform: pose(x, "translateY(10px) scale(0.95)"), offset: 0.55 },
          { transform: pose(x, "translateY(-4px) scale(1.04)") },
        ],
        duree,
        "ease-in-out",
      ),
  });
}

function recul(x: Ctx, force: number) {
  const r = (x.rnd() > 0.5 ? 1 : -1) * 4 * force;
  x.m.animer(
    x.cib,
    [
      { transform: "none" },
      {
        transform: `translateY(${-18 * force}px) rotate(${r}deg) scale(0.96)`,
        offset: 0.25,
      },
      {
        transform: `translateY(${5 * force}px) rotate(${-r / 2}deg)`,
        offset: 0.6,
      },
      { transform: "none" },
    ],
    420,
  );
}

function impactGenerique(x: Ctx, force: number) {
  const dmg = x.stress;
  const k = Math.min(1.6, 0.5 + dmg / 80) * force;
  x.m.geler(Math.min(100, 40 + dmg * 0.6) * (force > 1 ? 1 : 0.9));
  x.m.secouer(8 * k, 380);
  // Dans une cinématique, le flash plein de la carte s'ajoute à celui du plateau (`impactLegendaire`) :
  // deux aplats blancs au même instant. La carte garde le sien, moins dense.
  if (force > 1) {
    x.m.effet({
      couche: "avant",
      duree: 220,
      additif: true,
      dessiner(ctx, p) {
        ctx.globalAlpha = (1 - p) * 0.5;
        ctx.fillStyle = "#ffffff";
        arrondi(ctx, x.C.x, x.C.y, x.C.w, x.C.h, 10);
        ctx.fill();
      },
    });
  } else {
    eclatCarte(x.m, x.C);
  }
  onde(x.m, x.c, 90 * k, x.couleur, 420, 10);
  recul(x, Math.min(1.4, k));
  x.m.gerbe(Math.round(14 * k), x.c, () => {
    const ang = x.rnd() * Math.PI * 2;
    const v = 240 + x.rnd() * 380;
    return {
      forme: "trait",
      couleur: x.rnd() > 0.5 ? "#ffffff" : "#f7e264",
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      frein: 4,
      vie: 320 + x.rnd() * 200,
      taille: 4,
      tailleFin: 1,
      orienter: true,
      additif: true,
    };
  });
  // Aucun chiffre quand rien n'est encaissé : l'animation ne raconte pas un coup qui n'a pas eu lieu.
  if (dmg > 0) {
    // Au coup de grâce, le tampon tombe au milieu de la carte : le chiffre se pose **à côté**,
    // dans l'angle haut de la carte, là où rien d'autre ne passe.
    const marge = 44;
    const lieu = x.coupDeGrace
      ? {
          x: Math.min(x.C.x + x.C.w + 46, x.m.largeur - marge),
          y: x.C.y + 20,
        }
      : {
          x: Math.min(x.c.x + 30, x.m.largeur - marge),
          y: x.C.y + x.C.h * 0.3,
        };
    chiffre(x.m, lieu, `+${dmg}`, "#f7e264", dmg >= 60);
  }
}

function projectile(
  x: Ctx,
  opts: {
    de: Pt;
    vers: Pt;
    duree: number;
    courbe?: number;
    debut?: number;
    dessin: (
      ctx: CanvasRenderingContext2D,
      pos: Pt,
      angle: number,
      p: number,
    ) => void;
    trainee?: (pos: Pt, p: number) => void;
    facilite?: (p: number) => number;
  },
) {
  const mid = {
    x: (opts.de.x + opts.vers.x) / 2 + (opts.courbe ?? 0),
    y: (opts.de.y + opts.vers.y) / 2,
  };
  const f = opts.facilite ?? ((p: number) => p);
  let dernier = opts.de;
  // Le début est **capturé ici** : `m.effet` le pose à `this.t` quand on ne le donne pas, et
  // `maj` lisait `0` — la traînée partait donc à mi-vol, ou jamais en cinématique.
  const debut = opts.debut ?? x.m.t;
  x.m.effet({
    couche: "avant",
    debut: opts.debut,
    duree: opts.duree,
    dessiner(ctx, p) {
      const pos = bezier(opts.de, mid, opts.vers, f(p));
      const ang = Math.atan2(pos.y - dernier.y, pos.x - dernier.x);
      opts.dessin(ctx, pos, ang, p);
    },
    maj(t) {
      const p = Math.min(1, Math.max(0, (t - debut) / opts.duree));
      const pos = bezier(opts.de, mid, opts.vers, f(p));
      if (opts.trainee && p > 0 && p < 1) opts.trainee(pos, p);
      dernier = pos;
    },
  });
}

function bas(x: Ctx): Pt {
  return { x: x.c.x, y: x.C.y + x.C.h * 0.8 };
}

function haut(x: Ctx): Pt {
  return { x: x.a.x, y: x.A.y + x.A.h * 0.15 };
}

// ---------- B : Hearthstone, la charge ----------

function motifD(
  x: Ctx,
  e: Etape[],
  t0: number,
  cle: CleD,
  cinematique: boolean,
): number {
  const lourd = cle === "marteau";
  anticipation(x, e, t0, lourd ? 360 : 240);
  const lancer = t0 + (lourd ? 360 : 240);
  const de = haut(x);
  const vers = bas(x);
  const lent = cinematique ? 1.35 : 1;
  if (cinematique) e.push({ a: lancer, faire: () => x.m.ralentir(0.5, 380) });

  const voyages: Record<CleD, number> = {
    tampon: 420,
    avion: 520,
    enveloppes: 520,
    graphe: 520,
    dossiers: 480,
    cafe: 460,
    postits: 620,
    eclair: 320,
    megaphone: 480,
    marteau: 230,
    soudure: 520,
    zen: 640,
    soin: 260,
    extincteur: 480,
    laser: 520,
    chrono: 560,
    chaines: 440,
    cv: 480,
  };
  const voyage = Math.round(voyages[cle] * lent);
  const impact = lancer + voyage;
  const r = x.rnd;
  const m = x.m;

  e.push({
    a: lancer,
    faire: () => {
      const t = m.t;
      switch (cle) {
        case "tampon": {
          m.effet({
            couche: "avant",
            duree: voyage,
            dessiner(ctx, p) {
              const q = facilite.entree(p);
              const y = lerp(x.C.y - 160, x.c.y - 10, q);
              const s = lerp(1.6, 1, q);
              ctx.translate(x.c.x, y);
              ctx.scale(s, s);
              ctx.fillStyle = "#5a2a1a";
              arrondi(ctx, -14, -70, 28, 50, 8);
              ctx.fill();
              ctx.fillStyle = "#3a1d12";
              arrondi(ctx, -46, -24, 92, 26, 5);
              ctx.fill();
              ctx.fillStyle = "#b3261e";
              ctx.fillRect(-42, 0, 84, 6);
            },
          });
          break;
        }
        case "avion":
          projectile(x, {
            de,
            vers,
            duree: voyage,
            courbe: 140 * (r() > 0.5 ? 1 : -1),
            facilite: facilite.entreeSortie,
            dessin(ctx, pos, ang) {
              ctx.translate(pos.x, pos.y);
              ctx.rotate(ang);
              ctx.fillStyle = "#f4f1e8";
              ctx.beginPath();
              ctx.moveTo(22, 0);
              ctx.lineTo(-16, -14);
              ctx.lineTo(-8, 0);
              ctx.lineTo(-16, 14);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = "rgba(0,0,0,.35)";
              ctx.beginPath();
              ctx.moveTo(22, 0);
              ctx.lineTo(-8, 0);
              ctx.stroke();
            },
            trainee: (pos) =>
              m.emettre({
                x: pos.x,
                y: pos.y,
                forme: "point",
                couleur: "rgba(255,255,255,.7)",
                vie: 300,
                taille: 2,
                tailleFin: 0.5,
              }),
          });
          break;
        case "enveloppes":
          for (let i = 0; i < 8; i++) {
            projectile(x, {
              de: { x: de.x + (r() - 0.5) * 40, y: de.y },
              vers: { x: vers.x + (r() - 0.5) * 60, y: vers.y - r() * 40 },
              debut: t + i * 45,
              duree: voyage - 180,
              courbe: (r() - 0.5) * 220,
              dessin(ctx, pos, ang) {
                ctx.translate(pos.x, pos.y);
                ctx.rotate(ang * 0.3);
                ctx.fillStyle = "#eef3fb";
                ctx.fillRect(-12, -8, 24, 16);
                ctx.strokeStyle = "#6f7fd1";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-12, -8);
                ctx.lineTo(0, 2);
                ctx.lineTo(12, -8);
                ctx.stroke();
              },
            });
          }
          break;
        case "graphe": {
          const pts: Pt[] = [];
          const n = 7;
          for (let i = 0; i <= n; i++) {
            const p = i / n;
            pts.push({
              x: lerp(de.x - 50, vers.x, p) + (i % 2 ? 22 : -22) * (1 - p),
              y: lerp(de.y, vers.y, p) + (i % 2 ? 18 : 0),
            });
          }
          pts[n] = vers;
          m.effet({
            couche: "avant",
            duree: voyage + 300,
            dessiner(ctx, p) {
              const q = Math.min(1, p * ((voyage + 300) / voyage));
              const k = q * n;
              ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
              ctx.lineJoin = "round";
              // Dans une cinématique la flèche se voit de la salle : plus épaisse, plus grande.
              const gros = cinematique ? 1.7 : 1;
              for (const [w, c] of [
                [12 * gros, "rgba(70,199,140,.35)"],
                [5 * gros, "#46c78c"],
              ] as const) {
                ctx.strokeStyle = c;
                ctx.lineWidth = w;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i <= Math.floor(k); i++)
                  ctx.lineTo(pts[i].x, pts[i].y);
                const i = Math.floor(k);
                if (i < n)
                  ctx.lineTo(
                    lerp(pts[i].x, pts[i + 1].x, k - i),
                    lerp(pts[i].y, pts[i + 1].y, k - i),
                  );
                ctx.stroke();
              }
              const i = Math.min(n - 1, Math.floor(k));
              const bout = {
                x: lerp(pts[i].x, pts[i + 1].x, Math.min(1, k - i)),
                y: lerp(pts[i].y, pts[i + 1].y, Math.min(1, k - i)),
              };
              const ang = Math.atan2(
                pts[i + 1].y - pts[i].y,
                pts[i + 1].x - pts[i].x,
              );
              ctx.translate(bout.x, bout.y);
              ctx.rotate(ang);
              ctx.fillStyle = "#46c78c";
              ctx.beginPath();
              ctx.moveTo(16 * gros, 0);
              ctx.lineTo(-6 * gros, -11 * gros);
              ctx.lineTo(-6 * gros, 11 * gros);
              ctx.fill();
            },
          });
          for (let b = 0; b < 4; b++) {
            m.effet({
              couche: "fond",
              debut: t + b * 60,
              duree: voyage + 200,
              dessiner(ctx, p) {
                const h =
                  facilite.ressort(Math.min(1, p * 2.5)) * (20 + b * 14);
                ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 0.85;
                ctx.fillStyle = b === 3 ? "#46c78c" : "#5b6472";
                ctx.fillRect(
                  x.A.x + x.A.w + 8 + b * 12,
                  x.A.y + x.A.h * 0.6 - h,
                  9,
                  h,
                );
              },
            });
          }
          break;
        }
        case "dossiers":
          for (let i = 0; i < 5; i++) {
            const cible = {
              x: x.c.x + (r() - 0.5) * 50,
              y: x.c.y + 30 - i * 14,
            };
            const rot = (r() - 0.5) * 0.6;
            m.effet({
              couche: "avant",
              debut: t + i * 70,
              duree: voyage - 140,
              dessiner(ctx, p) {
                const q = facilite.entree(p);
                ctx.translate(cible.x, lerp(-60, cible.y, q));
                ctx.rotate(rot * (1 - q) * 3 + rot);
                ctx.fillStyle = [
                  "#e6b64c",
                  "#c9a227",
                  "#d4622a",
                  "#a67c22",
                  "#e6b64c",
                ][i];
                ctx.fillRect(-34, -22, 68, 44);
                ctx.fillRect(-34, -28, 24, 8);
                ctx.fillStyle = "rgba(255,255,255,.75)";
                ctx.fillRect(-24, -10, 48, 4);
                ctx.fillRect(-24, 0, 36, 4);
              },
            });
          }
          break;
        case "cafe":
          projectile(x, {
            de,
            vers,
            duree: voyage,
            courbe: -120,
            dessin(ctx, pos) {
              ctx.fillStyle = "#5a3415";
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, 13, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(255,255,255,.35)";
              ctx.beginPath();
              ctx.arc(pos.x - 4, pos.y - 4, 4, 0, Math.PI * 2);
              ctx.fill();
            },
            trainee: (pos) =>
              m.emettre({
                x: pos.x,
                y: pos.y,
                vx: (r() - 0.5) * 60,
                vy: 40,
                ay: 900,
                forme: "goutte",
                couleur: "#6b3e1a",
                vie: 420,
                taille: 3,
                tailleFin: 2,
              }),
          });
          m.gerbe(6, haut(x), () => ({
            forme: "point",
            couleur: "rgba(255,255,255,.5)",
            vx: (r() - 0.5) * 30,
            vy: -60,
            vie: 700,
            taille: 6,
            tailleFin: 14,
          }));
          break;
        case "postits":
          for (let i = 0; i < 12; i++) {
            const ang0 = (i / 12) * Math.PI * 2;
            const coul = ["#f7e264", "#f4a6c0", "#9ef5fb", "#b6e388"][i % 4];
            const cible = {
              x: x.c.x + (r() - 0.5) * x.C.w * 0.8,
              y: x.c.y + (r() - 0.5) * x.C.h * 0.6,
            };
            m.effet({
              couche: "avant",
              debut: t,
              duree: voyage,
              dessiner(ctx, p) {
                const orbite = Math.min(1, p / 0.45);
                const vol = Math.max(0, (p - 0.45) / 0.55);
                const ang = ang0 + orbite * Math.PI * 1.5;
                const o = {
                  x: x.a.x + Math.cos(ang) * 70,
                  y: x.a.y + Math.sin(ang) * 50,
                };
                const pos = {
                  x: lerp(o.x, cible.x, facilite.entree(vol)),
                  y: lerp(o.y, cible.y, facilite.entree(vol)),
                };
                ctx.translate(pos.x, pos.y);
                ctx.rotate(ang);
                ctx.fillStyle = coul;
                ctx.fillRect(-9, -9, 18, 18);
                ctx.fillStyle = "rgba(0,0,0,.15)";
                ctx.fillRect(-9, -9, 18, 4);
              },
            });
          }
          break;
        case "eclair": {
          const graine = hacher(`${x.attaque.name}:eclair`);
          m.effet({
            couche: "avant",
            duree: voyage + 120,
            additif: true,
            dessiner(ctx, p, temps) {
              const coup = Math.floor(temps / 90);
              const visible = p < 0.25 || (p > 0.4 && p < 0.6) || p > 0.75;
              if (!visible) return;
              const local = alea(graine + coup * 7);
              eclair(ctx, de, vers, local, "#9ef5fb", 26);
              // Le second arc est décidé **par tranche**, pas par image.
              if (alea(graine + coup)() > 0.4)
                eclair(
                  ctx,
                  de,
                  { x: vers.x + (local() - 0.5) * 80, y: vers.y + 20 },
                  local,
                  "#61d5df",
                  14,
                );
            },
          });
          eclatCarte(m, x.A, "#9ef5fb", 160);
          break;
        }
        case "megaphone":
          for (let i = 0; i < 4; i++) {
            m.effet({
              couche: "avant",
              debut: t + i * 80,
              duree: voyage - 160,
              additif: true,
              dessiner(ctx, p) {
                const pos = {
                  x: lerp(de.x, vers.x, p),
                  y: lerp(de.y, vers.y, p),
                };
                const ray = lerp(20, 70, p);
                ctx.globalAlpha = 1 - p * 0.5;
                ctx.strokeStyle = "#e0563f";
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(
                  pos.x,
                  pos.y + ray * 0.6,
                  ray,
                  -Math.PI * 0.8,
                  -Math.PI * 0.2,
                );
                ctx.stroke();
              },
            });
          }
          m.gerbe(5, haut(x), (i) => ({
            forme: "texte",
            texte: "!",
            couleur: "#f7e264",
            vx: (i - 2) * 50,
            vy: -160,
            frein: 1.5,
            vie: 650,
            taille: 8,
            tailleFin: 6,
          }));
          break;
        case "marteau": {
          const dx = x.c.x - x.a.x;
          const dy = x.C.y + x.C.h * 0.7 - x.A.y;
          const b = x.base;
          m.animer(
            x.att,
            [
              { transform: pose(x, "none"), easing: "cubic-bezier(.8,0,1,.6)" },
              {
                transform: `translate(${dx}px, ${dy}px) ${b} scale(1.1) rotate(-5deg)`,
                offset: 0.36,
              },
              {
                transform: `translate(${dx * 0.85}px, ${dy * 0.8}px) ${b}`,
                offset: 0.5,
              },
              { transform: pose(x, "none") },
            ],
            voyage / 0.36,
          );
          break;
        }
        case "soudure":
          let derniereTrancheSoudure = -1;
          m.effet({
            couche: "avant",
            duree: voyage,
            additif: true,
            dessiner(ctx, p, temps) {
              const local = alea(Math.floor(temps / 40));
              eclair(ctx, de, vers, local, "#f7a54a", 8);
              ctx.globalAlpha = 0.8;
              const g = ctx.createRadialGradient(
                vers.x,
                vers.y,
                0,
                vers.x,
                vers.y,
                30,
              );
              g.addColorStop(0, "#ffffff");
              g.addColorStop(1, "transparent");
              ctx.fillStyle = g;
              ctx.fillRect(vers.x - 30, vers.y - 30, 60, 60);
              void p;
            },
            maj(temps) {
              // **Une gerbe par tranche de 40 ms**, jamais par image : le tirage était déjà
              // dérivé du temps, mais le nombre de particules suivait la fréquence d'affichage
              // (D-098, budget de 300 hors cinématique).
              const tranche = Math.floor(temps / 40);
              if (tranche === derniereTrancheSoudure) return;
              derniereTrancheSoudure = tranche;
              const rt = alea(hacher(`${x.attaque.name}:soudure:${tranche}`));
              for (let i = 0; i < 3; i++)
                m.emettre({
                  x: vers.x,
                  y: vers.y,
                  vx: (rt() - 0.5) * 300,
                  vy: -100 - rt() * 240,
                  ay: 1200,
                  forme: "trait",
                  couleur: rt() > 0.5 ? "#f7a54a" : "#ffe9a8",
                  vie: 450,
                  taille: 3,
                  tailleFin: 1,
                  orienter: true,
                  additif: true,
                });
            },
          });
          break;
        case "zen":
          for (let i = 0; i < 22; i++) {
            projectile(x, {
              de: { x: de.x + (r() - 0.5) * 50, y: de.y },
              vers: {
                x: vers.x + (r() - 0.5) * 80,
                y: x.c.y + (r() - 0.5) * 60,
              },
              debut: t + i * 18,
              duree: voyage - 220,
              courbe: Math.sin(i) * 120,
              facilite: facilite.entreeSortie,
              dessin(ctx, pos, ang) {
                ctx.translate(pos.x, pos.y);
                ctx.rotate(ang + i);
                ctx.fillStyle = i % 3 ? "#f4a6c0" : "#ffffff";
                ctx.beginPath();
                ctx.ellipse(0, 0, 8, 3.5, 0, 0, Math.PI * 2);
                ctx.fill();
              },
            });
          }
          break;
        case "soin":
          projectile(x, {
            de,
            vers,
            duree: voyage,
            facilite: facilite.entree,
            dessin(ctx, pos, ang) {
              ctx.translate(pos.x, pos.y);
              ctx.rotate(ang);
              ctx.fillStyle = "#e8eef8";
              ctx.fillRect(-26, -5, 30, 10);
              ctx.fillStyle = "#46c78c";
              ctx.fillRect(-20, -3, 18, 6);
              ctx.fillStyle = "#c0c8d4";
              ctx.fillRect(-34, -8, 8, 16);
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(4, 0);
              ctx.lineTo(20, 0);
              ctx.stroke();
            },
          });
          break;
        case "extincteur":
          // Une seule gerbe par tranche de 40 ms : à 144 Hz, émettre par image remplissait le
          // budget de particules et refusait l'impact lui-même.
          let derniereTranche = -1;
          m.effet({
            couche: "avant",
            duree: voyage,
            dessiner() {},
            maj(temps) {
              const tranche = Math.floor(temps / 40);
              if (tranche === derniereTranche) return;
              derniereTranche = tranche;
              const rt = alea(hacher(`${x.attaque.name}:extincteur:${tranche}`));
              for (let i = 0; i < 5; i++) {
                const ang =
                  Math.atan2(vers.y - de.y, vers.x - de.x) + (rt() - 0.5) * 0.35;
                const v = 700 + rt() * 200;
                m.emettre({
                  x: de.x,
                  y: de.y,
                  vx: Math.cos(ang) * v,
                  vy: Math.sin(ang) * v,
                  frein: 2.2,
                  forme: "point",
                  couleur: "rgba(240,244,250,.85)",
                  vie: 520,
                  taille: 3,
                  tailleFin: 11,
                });
              }
            },
          });
          break;
        case "laser": {
          m.effet({
            couche: "avant",
            duree: voyage + 100,
            additif: true,
            dessiner(ctx, p, temps) {
              const cal = Math.max(0, 1 - p * 1.4);
              const point = {
                x: vers.x + Math.sin(temps / 60) * 60 * cal,
                y: x.c.y + Math.cos(temps / 47) * 50 * cal,
              };
              ctx.strokeStyle = "#ff3b30";
              ctx.lineWidth = 2;
              ctx.globalAlpha = 0.9;
              ctx.beginPath();
              ctx.moveTo(de.x, de.y);
              ctx.lineTo(point.x, point.y);
              ctx.stroke();
              const g = ctx.createRadialGradient(
                point.x,
                point.y,
                0,
                point.x,
                point.y,
                14,
              );
              g.addColorStop(0, "#ffffff");
              g.addColorStop(0.4, "#ff3b30");
              g.addColorStop(1, "transparent");
              ctx.fillStyle = g;
              ctx.fillRect(point.x - 14, point.y - 14, 28, 28);
            },
          });
          break;
        }
        case "chrono":
          m.effet({
            couche: "avant",
            duree: voyage,
            dessiner(ctx, p) {
              const s = facilite.ressort(Math.min(1, p * 3));
              ctx.translate(x.c.x, x.c.y);
              ctx.scale(s, s);
              ctx.globalAlpha = 0.92;
              ctx.fillStyle = "#f4e6cc";
              ctx.strokeStyle = "#241a0c";
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.arc(0, 0, 46, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              for (let i = 0; i < 12; i++) {
                ctx.save();
                ctx.rotate((i * Math.PI) / 6);
                ctx.fillStyle = "#241a0c";
                ctx.fillRect(-1.5, -42, 3, 8);
                ctx.restore();
              }
              const tours = facilite.entree(p) * 14;
              ctx.save();
              ctx.rotate(tours * Math.PI * 2);
              ctx.fillStyle = "#e0563f";
              ctx.fillRect(-2, -38, 4, 38);
              ctx.restore();
              ctx.rotate((tours / 12) * Math.PI * 2);
              ctx.fillStyle = "#241a0c";
              ctx.fillRect(-3, -26, 6, 26);
            },
          });
          break;
        case "chaines":
          for (const signe of [-1, 1]) {
            m.effet({
              couche: "avant",
              duree: voyage,
              dessiner(ctx, p) {
                const n = 10;
                for (let i = 0; i < n; i++) {
                  const q = Math.min(
                    1,
                    facilite.sortie(p) * (n / (i + 1)) * 0.6,
                  );
                  if (q <= 0) continue;
                  const pos = bezier(
                    de,
                    {
                      x: (de.x + vers.x) / 2 + signe * 150,
                      y: (de.y + vers.y) / 2,
                    },
                    { x: x.c.x + signe * 50, y: x.c.y },
                    (i / n) * q + (1 - q) * 0,
                  );
                  ctx.save();
                  ctx.translate(pos.x, pos.y);
                  ctx.rotate(i % 2 ? 0 : Math.PI / 2);
                  ctx.strokeStyle = "#a3abbd";
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
                  ctx.stroke();
                  ctx.restore();
                }
              },
            });
          }
          break;
        case "cv":
          for (let i = 0; i < 6; i++) {
            projectile(x, {
              de,
              vers: { x: vers.x + (i - 2.5) * 22, y: x.c.y + (r() - 0.5) * 40 },
              debut: t + i * 50,
              duree: voyage - 200,
              courbe: (i - 2.5) * 50,
              dessin(ctx, pos, ang) {
                ctx.translate(pos.x, pos.y);
                ctx.rotate(ang + (1 - i / 6) * 4);
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(-11, -14, 22, 28);
                ctx.fillStyle = "#8b5fb0";
                ctx.fillRect(-7, -10, 7, 7);
                ctx.fillStyle = "#9aa3b2";
                ctx.fillRect(-7, 0, 14, 2);
                ctx.fillRect(-7, 5, 10, 2);
              },
            });
          }
          break;
      }
    },
  });

  e.push({
    a: impact,
    faire: () => {
      switch (cle) {
        case "tampon": {
          const mot = MOTS_TAMPON[hacher(x.attaque.name) % MOTS_TAMPON.length];
          m.secouer(9, 260);
          // Au coup de grâce, le tampon du motif cède la place à celui de la sortie : deux tampons
          // rouges au même endroit, penchés pareil, ne se liraient ni l'un ni l'autre.
          if (!x.coupDeGrace) {
            m.effet({
              couche: "avant",
              duree: 1100,
              dessiner(ctx, p) {
                ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 0.92;
                ctx.translate(x.c.x, x.c.y);
                ctx.rotate(-0.22);
                ctx.strokeStyle = "#d0352b";
                ctx.lineWidth = 4;
                ctx.strokeRect(-x.C.w * 0.46, -20, x.C.w * 0.92, 40);
                ctx.fillStyle = "#d0352b";
                ctx.font = `900 ${mot.length > 8 ? 15 : 22}px system-ui, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(mot, 0, 1);
              },
            });
          }
          m.gerbe(14, x.c, () => ({
            forme: "goutte",
            couleur: "#b3261e",
            vx: (r() - 0.5) * 360,
            vy: (r() - 0.5) * 360,
            frein: 6,
            vie: 500,
            taille: 3,
            tailleFin: 2,
          }));
          break;
        }
        case "avion":
        case "dossiers":
          m.gerbe(cle === "dossiers" ? 30 : 18, x.c, () => ({
            forme: "carre",
            couleur: "#f4f1e8",
            vx: (r() - 0.5) * 420,
            vy: -100 - r() * 300,
            ay: 700,
            frein: 1.5,
            vie: 900,
            taille: 6 + r() * 6,
            vrot: (r() - 0.5) * 14,
          }));
          break;
        case "enveloppes":
          m.gerbe(10, x.c, () => ({
            forme: "enveloppe",
            couleur: "#eef3fb",
            vx: (r() - 0.5) * 420,
            vy: -150 - r() * 200,
            ay: 900,
            vie: 800,
            taille: 9,
            vrot: (r() - 0.5) * 10,
          }));
          break;
        case "graphe":
          m.gerbe(cinematique ? 5 : 12, x.c, () => ({
            forme: "texte",
            texte: r() > 0.5 ? "%" : "€",
            couleur: "#46c78c",
            vx: (r() - 0.5) * 300,
            vy: -120 - r() * 200,
            ay: 400,
            vie: 800,
            taille: 6,
          }));
          break;
        case "cafe":
          m.gerbe(36, bas(x), () => {
            const ang = -Math.PI * r();
            const v = 150 + r() * 330;
            return {
              forme: "goutte",
              couleur: r() > 0.3 ? "#5a3415" : "#8a5a2b",
              vx: Math.cos(ang) * v,
              vy: Math.sin(ang) * v,
              ay: 1300,
              vie: 800,
              taille: 3 + r() * 3,
              tailleFin: 2,
              orienter: true,
            };
          });
          break;
        case "postits":
          m.gerbe(10, x.c, (i) => ({
            forme: "postit",
            couleur: ["#f7e264", "#f4a6c0", "#9ef5fb", "#b6e388"][i % 4],
            vx: (r() - 0.5) * 200,
            vy: -50 - r() * 100,
            ay: 500,
            vie: 1000,
            taille: 8,
            vrot: (r() - 0.5) * 6,
          }));
          break;
        case "eclair":
          m.gerbe(20, x.c, () => {
            const ang = r() * Math.PI * 2;
            return {
              forme: "trait",
              couleur: "#9ef5fb",
              vx: Math.cos(ang) * 400,
              vy: Math.sin(ang) * 400,
              frein: 5,
              vie: 360,
              taille: 5,
              tailleFin: 1,
              orienter: true,
              additif: true,
            };
          });
          break;
        case "megaphone":
          m.gerbe(6, x.c, (i) => ({
            forme: "texte",
            texte: i % 2 ? "!!" : "!",
            couleur: "#e0563f",
            vx: (r() - 0.5) * 240,
            vy: -200,
            frein: 2,
            vie: 700,
            taille: 7,
          }));
          m.secouer(12, 420);
          break;
        case "marteau":
          m.effet({
            couche: "avant",
            duree: 900,
            dessiner(ctx, p) {
              ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 0.9;
              ctx.strokeStyle = "#1b222c";
              ctx.lineWidth = 3;
              const rr = alea(9);
              for (let i = 0; i < 7; i++) {
                const ang = rr() * Math.PI * 2;
                const len = 30 + rr() * 40;
                ctx.beginPath();
                ctx.moveTo(x.c.x, x.c.y);
                ctx.lineTo(
                  x.c.x + Math.cos(ang) * len * 0.5 + 6,
                  x.c.y + Math.sin(ang) * len * 0.5,
                );
                ctx.lineTo(
                  x.c.x + Math.cos(ang) * len,
                  x.c.y + Math.sin(ang) * len,
                );
                ctx.stroke();
              }
            },
          });
          m.gerbe(28, bas(x), () => ({
            forme: "carre",
            couleur: r() > 0.5 ? "#a56a3a" : "#8a93a8",
            vx: (r() - 0.5) * 520,
            vy: -150 - r() * 380,
            ay: 1500,
            vie: 800,
            taille: 4 + r() * 6,
            vrot: (r() - 0.5) * 18,
          }));
          onde(m, bas(x), 180, "#f4e6cc", 520, 7);
          m.secouer(16, 480);
          break;
        case "soudure":
          m.gerbe(24, vers, () => ({
            forme: "point",
            couleur: r() > 0.5 ? "#f7a54a" : "#ffe9a8",
            vx: (r() - 0.5) * 360,
            vy: -80 - r() * 260,
            ay: 1100,
            vie: 700,
            taille: 2.5,
            additif: true,
          }));
          break;
        case "zen":
          for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            m.emettre({
              x: x.c.x + Math.cos(ang) * 60,
              y: x.c.y + Math.sin(ang) * 60,
              vx: -Math.sin(ang) * 120,
              vy: Math.cos(ang) * 120,
              frein: 1,
              forme: "petale",
              couleur: "#f4a6c0",
              vie: 900,
              taille: 7,
              vrot: 3,
            });
          }
          onde(m, x.c, 110, "#f4a6c0", 700, 4);
          break;
        case "soin":
          m.gerbe(10, x.c, () => ({
            forme: "croix",
            couleur: "#46c78c",
            vx: (r() - 0.5) * 200,
            vy: -80 - r() * 120,
            frein: 1.5,
            vie: 700,
            taille: 6,
          }));
          break;
        case "extincteur":
          m.gerbe(26, x.c, () => ({
            forme: "point",
            couleur: "rgba(240,244,250,.9)",
            vx: (r() - 0.5) * 220,
            vy: (r() - 0.5) * 220,
            frein: 2.5,
            vie: 900,
            taille: 6,
            tailleFin: 18,
          }));
          break;
        case "laser":
          m.gerbe(16, bas(x), () => ({
            forme: "point",
            couleur: r() > 0.5 ? "#ff3b30" : "#ffd1cc",
            vx: (r() - 0.5) * 300,
            vy: -60 - r() * 200,
            ay: 600,
            vie: 500,
            taille: 2.5,
            additif: true,
          }));
          onde(m, bas(x), 50, "#ff3b30", 300, 5);
          break;
        case "chrono":
          m.gerbe(22, x.c, () => {
            const ang = r() * Math.PI * 2;
            const v = 160 + r() * 280;
            return {
              forme: "carre",
              couleur: r() > 0.5 ? "#f4e6cc" : "#241a0c",
              vx: Math.cos(ang) * v,
              vy: Math.sin(ang) * v,
              ay: 500,
              vie: 800,
              taille: 5 + r() * 5,
              vrot: (r() - 0.5) * 16,
            };
          });
          break;
        case "chaines":
          m.effet({
            couche: "avant",
            duree: 800,
            dessiner(ctx, p) {
              ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
              ctx.strokeStyle = "#a3abbd";
              ctx.lineWidth = 3;
              for (const s of [-1, 1]) {
                for (let i = 0; i <= 8; i++) {
                  const q = i / 8;
                  ctx.save();
                  ctx.translate(
                    lerp(x.C.x, x.C.x + x.C.w, q),
                    lerp(
                      s < 0 ? x.C.y : x.C.y + x.C.h,
                      s < 0 ? x.C.y + x.C.h : x.C.y,
                      q,
                    ),
                  );
                  ctx.rotate(s * 0.9 + (i % 2 ? Math.PI / 2 : 0));
                  ctx.beginPath();
                  ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            },
          });
          break;
        case "cv":
          m.gerbe(8, x.c, () => ({
            forme: "carte",
            couleur: "#ffffff",
            vx: (r() - 0.5) * 380,
            vy: -120 - r() * 200,
            ay: 800,
            vie: 800,
            taille: 8,
            vrot: (r() - 0.5) * 12,
          }));
          break;
      }
    },
  });
  return impact;
}

// ---------- E : la cinématique légendaire ----------

/**
 * Le voile, le fond et le bandeau d'une cinématique. Elle dure `PRELUDE_COMEX` ms avant que la
 * Pression ne parte (`PRELUDE_AUTRE` pour une Couronne ou un 3 étoiles, sans conseil à jouer).
 *
 * **Le COMEX moque le cérémonial** : l'ordre du jour s'affiche, sept silhouettes sans visage lèvent
 * la main l'une après l'autre sur une courbe qui monte, puis le tampon « adopté à l'unanimité »
 * tombe — et seulement alors, la Pression part. Une salle de conseil sans personne en particulier :
 * la satire vise le système, jamais quelqu'un.
 *
 * Un geste principal par temps : le bandeau (0–1,2 s), la salle (0,5–1,1 s), le tampon (1,1–1,7 s),
 * la cible éclairée (dès 1,15 s). La carte de l'attaquant est toujours **au centre**, du côté
 * opposé à sa cible, pour que celle-ci reste visible.
 */
const PRELUDE_COMEX = 1250;
const PRELUDE_AUTRE = 1000;
/** Les sept sièges du conseil : l'unanimité est un chiffre, pas une personne. */
const SIEGES = 7;

/** Le plateau privé de la carte de l'attaquant : le décor passe derrière elle, jamais dessus. */
function sauf(ctx: CanvasRenderingContext2D, W: number, H: number, r: Rect) {
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.roundRect(r.x, r.y, r.w, r.h, 12);
  ctx.clip("evenodd");
}

/**
 * Une silhouette du conseil : un buste sans visage au-dessus de la table, un bras qui se lève
 * (`levee` de 0 à 1). Toujours à l'endroit, que la salle soit en haut ou en bas du plateau.
 */
function silhouette(ctx: CanvasRenderingContext2D, cx: number, yTable: number, levee: number) {
  const tete = yTable - 30;
  ctx.fillStyle = "#cfd6e4";
  ctx.strokeStyle = "#cfd6e4";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, tete, 9, 0, Math.PI * 2);
  ctx.fill();
  arrondi(ctx, cx - 17, tete + 11, 34, 24, 8);
  ctx.fill();
  if (levee > 0) {
    const epaule = tete + 15;
    const long = 38 * levee;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx + 15, epaule);
    ctx.lineTo(cx + 20, epaule - long);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 20, epaule - (long + 3), 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** La taille de police qui fait tenir `texte` dans `largeur`, sans dépasser `max`. */
function ajuster(
  ctx: CanvasRenderingContext2D,
  texte: string,
  max: number,
  largeur: number,
  poids = 900,
): number {
  ctx.font = `${poids} ${max}px system-ui, sans-serif`;
  const w = ctx.measureText(texte).width;
  return w > largeur ? Math.floor((max * largeur) / w) : max;
}

function prelude(x0: Ctx, e: Etape[], comex: boolean): number {
  const x = { ...x0 };
  const m = x.m;
  const T0 = comex ? PRELUDE_COMEX : PRELUDE_AUTRE;
  // -1 : la cible est au-dessus de l'attaquant (c'est le cas de mon Poste). On place l'attaquant
  // au centre, du côté opposé : sa cible reste entièrement visible, et le bandeau tombe de son côté.
  const dir = x.c.y < x.a.y ? -1 : 1;
  const centreY = m.hauteur * (dir < 0 ? 0.65 : 0.35);
  const dx = m.largeur / 2 - x.a.x;
  const dy = centreY - x.a.y;
  const s = 1.3;
  x0.base = `translate(${dx}px, ${dy - 6}px) scale(${s})`;
  x0.a = { x: x.a.x + dx, y: x.a.y + dy - 6 };
  x0.A = {
    x: x0.a.x - (x.A.w * s) / 2,
    y: x0.a.y - (x.A.h * s) / 2,
    w: x.A.w * s,
    h: x.A.h * s,
  };
  const o = x0.a;
  const carte = x0.A;
  const cible = x.C;
  const yBandeau = m.hauteur * (dir < 0 ? 0.13 : 0.87);
  // La salle est du côté de l'attaquant : la table est au bord du plateau, derrière sa carte.
  const yTable = dir < 0 ? m.hauteur - 36 : 86;

  e.push({
    a: 0,
    faire: () => {
      // Le voile : le plateau s'assombrit, l'attaquant reste éclairé. Dès que la Pression va partir,
      // un second trou de lumière s'ouvre sur la cible — c'est elle qu'il faut regarder.
      m.effet({
        couche: "avant",
        duree: 99999,
        dessiner(ctx, _p, temps) {
          const montee = Math.min(1, temps / 300);
          const g = ctx.createRadialGradient(
            o.x,
            o.y,
            x.A.w * 0.7,
            o.x,
            o.y,
            Math.max(m.largeur, m.hauteur),
          );
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(0.25, `rgba(5,8,14,${0.72 * montee})`);
          g.addColorStop(1, `rgba(5,8,14,${0.82 * montee})`);
          ctx.globalAlpha = alphaVoile(temps);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, m.largeur, m.hauteur);
          const feu = Math.max(0, Math.min(1, (temps - (T0 - 120)) / 260));
          if (feu > 0) {
            const t = ctx.createRadialGradient(x.c.x, x.c.y, cible.w * 0.3, x.c.x, x.c.y, cible.w * 1.5);
            t.addColorStop(0, "rgba(0,0,0,1)");
            t.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalCompositeOperation = "destination-out";
            ctx.globalAlpha = feu * alphaVoile(temps);
            ctx.fillStyle = t;
            ctx.fillRect(x.c.x - cible.w * 1.6, x.c.y - cible.h * 1.1, cible.w * 3.2, cible.h * 2.2);
          }
        },
      });

      if (comex) {
        // La salle de conseil : courbe qui monte, barres, sept sièges, table. Derrière la carte.
        m.effet({
          couche: "avant",
          duree: 99999,
          dessiner(ctx, _p, temps) {
            const voileA = alphaVoile(temps);
            if (voileA <= 0) return;
            const W = m.largeur;
            const H = m.hauteur;
            ctx.save();
            sauf(ctx, W, H, carte);
            const xs = Array.from({ length: SIEGES }, (_, i) => 38 + (i * (W - 76)) / (SIEGES - 1));
            const base = H * (dir < 0 ? 0.74 : 0.4);
            const pousse = Math.min(1, Math.max(0, (temps - 250) / 800));
            // Après le tampon, le décor se retire : la Pression est seule à l'écran.
            const calme = temps > T0 ? 0.5 : 1;
            // Les barres, qui montent avec l'ordre du jour…
            ctx.globalAlpha = 0.34 * voileA * calme;
            ctx.fillStyle = "#46c78c";
            xs.forEach((px, i) => {
              const h = (14 + i * 13) * pousse;
              ctx.fillRect(px - 11, base - h, 22, h);
            });
            // …et la courbe, qui monte plus vite qu'elles.
            ctx.globalAlpha = 0.85 * voileA * calme;
            ctx.strokeStyle = "#f7e264";
            ctx.lineWidth = 4;
            ctx.lineJoin = "round";
            ctx.beginPath();
            const n = Math.floor(pousse * (SIEGES - 1));
            const pts = xs.map((px, i) => ({
              x: px,
              y: base - (22 + i * 17) * (i % 2 ? 1 : 0.85),
            }));
            pts.slice(0, n + 2).forEach((q, i) => {
              const f = i === n + 1 ? pousse * (SIEGES - 1) - n : 1;
              const prev = pts[Math.max(0, i - 1)];
              const px = i === n + 1 ? lerp(prev.x, q.x, f) : q.x;
              const py = i === n + 1 ? lerp(prev.y, q.y, f) : q.y;
              if (i) ctx.lineTo(px, py);
              else ctx.moveTo(px, py);
            });
            ctx.stroke();
            ctx.fillStyle = "#f7e264";
            pts.slice(0, n + 1).forEach((q) => {
              ctx.beginPath();
              ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.restore();

            // Le conseil, sur un fond uni : sans lui, le Banc passait entre les silhouettes.
            // Les mains se lèvent à la queue leu leu, puis sautent ensemble au tampon.
            ctx.save();
            sauf(ctx, W, H, carte);
            ctx.globalAlpha = voileA * calme;
            ctx.fillStyle = "#0a1018";
            ctx.fillRect(0, yTable - 78, W, 96);
            ctx.globalAlpha = 0.95 * voileA * calme;
            const claque = Math.max(0, 1 - Math.abs(temps - (T0 - 130)) / 160);
            xs.forEach((px, i) => {
              const depart = 520 + i * 70;
              const levee = facilite.sortie(Math.min(1, Math.max(0, (temps - depart) / 160)));
              silhouette(ctx, px, yTable - claque * 6, levee);
            });
            // La table, devant eux.
            ctx.fillStyle = "#5a3d24";
            arrondi(ctx, 12, yTable, W - 24, 14, 5);
            ctx.fill();
            ctx.fillStyle = "#8a6038";
            ctx.fillRect(16, yTable, W - 32, 3);
            ctx.restore();
          },
        });
      } else {
        m.effet({
          couche: "fond",
          duree: 99999,
          additif: true,
          dessiner(ctx, _p, temps) {
            ctx.globalAlpha = Math.min(1, temps / 400) * 0.55 * alphaVoile(temps);
            ctx.translate(o.x, o.y);
            ctx.rotate(temps / 1400);
            for (let i = 0; i < 12; i++) {
              ctx.rotate(Math.PI / 6);
              const g = ctx.createLinearGradient(0, 0, 0, -m.hauteur * 0.7);
              g.addColorStop(0, "#f7e264");
              g.addColorStop(1, "transparent");
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(-22, -m.hauteur * 0.7);
              ctx.lineTo(22, -m.hauteur * 0.7);
              ctx.fill();
            }
          },
        });
      }
      m.animer(
        x.att,
        [
          { transform: "none", zIndex: "6" },
          {
            transform: `translate(${dx}px, ${dy}px) scale(1.28) rotateY(0deg)`,
            zIndex: "6",
            offset: 0.55,
          },
          { transform: `translate(${dx}px, ${dy - 6}px) scale(1.3)`, zIndex: "6" },
        ],
        620,
        "cubic-bezier(.2,.8,.2,1)",
      );
    },
  });

  e.push({
    a: 380,
    faire: () => {
      for (let i = 0; i < 70; i++) {
        const ang = x.rnd() * Math.PI * 2;
        const r = 120 + x.rnd() * 120;
        m.emettre({
          x: o.x + Math.cos(ang) * r,
          y: o.y + Math.sin(ang) * r,
          vx: -Math.cos(ang) * r * 1.9,
          vy: -Math.sin(ang) * r * 1.9,
          forme: "point",
          couleur: x.rnd() > 0.4 ? "#f7e264" : "#ffffff",
          vie: 520,
          taille: 2.6,
          tailleFin: 0.6,
          additif: true,
        });
      }
    },
  });

  // Le bandeau : l'ordre du jour, au nom de la Pression.
  e.push({
    a: comex ? 180 : 380,
    faire: () => {
      const titre = comex
        ? "COMEX · SÉANCE EXTRAORDINAIRE"
        : x.carte.rarity === "COU"
          ? "COURONNE"
          : "★ ★ ★";
      const nom = x.attaque.name.toUpperCase();
      // Le bandeau cède la place au tampon (T0 − 140) : il s'efface juste avant lui.
      const duree = comex ? PRELUDE_COMEX - 180 - 60 : 1000;
      m.effet({
        couche: "avant",
        duree,
        dessiner(ctx, p) {
          const entree = facilite.sortie(Math.min(1, (p * duree) / 260));
          const sortie = p > 0.78 ? (p - 0.78) / 0.22 : 0;
          const W = m.largeur;
          const y = yBandeau;
          ctx.globalAlpha = 1 - sortie;
          ctx.fillStyle = "rgba(10,8,4,.86)";
          ctx.fillRect(0, y - 38, W * entree, 76);
          ctx.fillStyle = "#f7e264";
          ctx.fillRect(0, y - 38, W * entree, 3);
          ctx.fillRect(W * (1 - entree), y + 35, W, 3);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const xx = lerp(-W * 0.3, W / 2, entree) + p * 12;
          ctx.font = "800 13px system-ui, sans-serif";
          ctx.fillStyle = "#f7e264";
          ctx.fillText(titre, xx, y - 20);
          const px = ajuster(ctx, nom, 30, W - 28);
          ctx.font = `900 ${px}px system-ui, sans-serif`;
          ctx.lineJoin = "round";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#140d05";
          ctx.strokeText(nom, xx, y + 8);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(nom, xx, y + 8);
        },
      });
    },
  });

  if (comex) {
    // Le tampon de l'unanimité, sur l'ordre du jour : le seul « geste » de la séance.
    e.push({
      a: T0 - 140,
      faire: () => {
        m.geler(60);
        m.secouer(6, 240);
        const duree = 600;
        m.effet({
          couche: "avant",
          duree,
          dessiner(ctx, p) {
            const pose = p < 0.22 ? facilite.sortie(p / 0.22) : 1;
            ctx.globalAlpha = (p > 0.7 ? (1 - p) / 0.3 : 1) * Math.min(1, p * 12);
            const W = m.largeur;
            const texte = "ADOPTÉ À L’UNANIMITÉ";
            const px = ajuster(ctx, texte, 24, W - 70);
            ctx.font = `900 ${px}px system-ui, sans-serif`;
            const w = ctx.measureText(texte).width + 30;
            const h = px + 22;
            ctx.translate(W / 2, yBandeau + dir * 2);
            ctx.rotate(-0.07);
            ctx.scale(lerp(2.2, 1, pose), lerp(2.2, 1, pose));
            ctx.fillStyle = "rgba(250,244,230,.94)";
            arrondi(ctx, -w / 2, -h / 2, w, h, 6);
            ctx.fill();
            ctx.strokeStyle = "#1f8f5c";
            ctx.lineWidth = 4;
            arrondi(ctx, -w / 2, -h / 2, w, h, 6);
            ctx.stroke();
            ctx.lineWidth = 1.5;
            arrondi(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 3);
            ctx.stroke();
            ctx.fillStyle = "#1f8f5c";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(texte, 0, 1);
          },
        });
      },
    });
  }
  return T0;
}

/**
 * Le voile d'une cinématique : il monte en 300 ms, reste, puis retombe en 340 ms au retour.
 * Il se calcule **du temps de la chorégraphie** — un compteur décrémenté par image donnerait un
 * voile différent à 30 et à 144 Hz, et le laisserait à mi-course si la scène s'arrêtait.
 */
const voile = { monteeMs: 300, retourMs: 340, debutRetour: Number.POSITIVE_INFINITY };

function alphaVoile(temps: number): number {
  if (temps < voile.monteeMs) return temps / voile.monteeMs;
  const depuis = temps - voile.debutRetour;
  if (depuis <= 0) return 1;
  return Math.max(0, 1 - depuis / voile.retourMs);
}

function impactLegendaire(x: Ctx) {
  const m = x.m;
  m.geler(100);
  m.secouer(18, 600);
  m.effet({
    couche: "avant",
    duree: 260,
    additif: true,
    dessiner(ctx, p) {
      ctx.globalAlpha = (1 - p) * 0.42;
      ctx.fillStyle = "#fff6c8";
      ctx.fillRect(0, 0, m.largeur, m.hauteur);
    },
  });
  onde(m, x.c, 240, "#f7e264", 600, 14);
  onde(m, x.c, 160, "#ffffff", 420, 6);
  m.gerbe(80, x.c, () => {
    const ang = x.rnd() * Math.PI * 2;
    const v = 200 + x.rnd() * 520;
    return {
      forme: "etoile",
      couleur: x.rnd() > 0.35 ? "#f7e264" : "#ffffff",
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      ay: 300,
      frein: 2,
      vie: 900 + x.rnd() * 400,
      taille: 4 + x.rnd() * 5,
      tailleFin: 1,
      vrot: 8,
      additif: true,
    };
  });
}

function retourCinematique(x: Ctx) {
  const m = x.m;
  m.animer(
    x.att,
    [
      { transform: x.base, zIndex: "6" },
      { transform: "none", zIndex: "6" },
    ],
    340,
    "cubic-bezier(.4,0,.2,1)",
  );
  voile.debutRetour = m.t;
}

export function preparerVoile() {
  voile.debutRetour = Number.POSITIVE_INFINITY;
}

// ---------- Après coup : Conditions et effets ----------

const COULEURS_STATUT: Record<Status, string> = {
  SURCHARGE: "#9ef5fb",
  EPUISEMENT: "#f7a54a",
  SIESTE: "#b9a7f2",
  IMMOBILISATION: "#a3abbd",
  DERIVE: "#f4a6c0",
};

const NOMS_STATUT: Record<Status, string> = {
  SURCHARGE: "Surcharge",
  EPUISEMENT: "Épuisement",
  SIESTE: "Sieste",
  IMMOBILISATION: "Immobilisation",
  DERIVE: "Dérive",
};

function apres(x: Ctx, e: Etape[], t: number): number {
  const m = x.m;
  const r = x.rnd;
  let fin = t;
  for (const eff of x.attaque.effects ?? []) {
    const sur = eff.target === "opponent" ? x : { ...x, C: x.A, c: x.a };
    // Une cible qui craque ne porte ni Condition ni café : l'animation ne raconte pas un effet
    // posé sur une carte déjà partie au Rebut.
    if (
      x.coupDeGrace &&
      eff.target === "opponent" &&
      (eff.kind === "status" || eff.kind === "discardEnergy")
    )
      continue;
    switch (eff.kind) {
      case "status": {
        if (!eff.status) break;
        const st = eff.status;
        const coul = COULEURS_STATUT[st];
        e.push({
          a: t,
          faire: () => {
            pastille(x, NOMS_STATUT[st], coul);
            if (st === "SIESTE")
              m.gerbe(4, { x: x.c.x + 30, y: x.C.y + 10 }, (i) => ({
                forme: "zzz",
                texte: "z",
                couleur: coul,
                vx: 30 + i * 6,
                vy: -70,
                vie: 900 + i * 120,
                taille: 4 + i * 1.5,
                tailleFin: 7,
              }));
            if (st === "EPUISEMENT")
              m.gerbe(26, bas(x), () => ({
                forme: "flamme",
                couleur: r() > 0.5 ? "#f7a54a" : "#e0563f",
                x: x.c.x + (r() - 0.5) * x.C.w,
                vx: (r() - 0.5) * 30,
                vy: -120 - r() * 120,
                vie: 700,
                taille: 6,
                tailleFin: 2,
                additif: true,
              }));
            if (st === "SURCHARGE")
              m.effet({
                couche: "avant",
                duree: 600,
                additif: true,
                dessiner(ctx, p, temps) {
                  if (Math.floor(temps / 120) % 2) return;
                  const local = alea(Math.floor(temps / 120));
                  for (let i = 0; i < 3; i++) {
                    const a1 = local() * Math.PI * 2;
                    const a2 = a1 + 0.8;
                    eclair(
                      ctx,
                      {
                        x: x.c.x + Math.cos(a1) * x.C.w * 0.55,
                        y: x.c.y + Math.sin(a1) * x.C.h * 0.55,
                      },
                      {
                        x: x.c.x + Math.cos(a2) * x.C.w * 0.55,
                        y: x.c.y + Math.sin(a2) * x.C.h * 0.55,
                      },
                      local,
                      coul,
                      8,
                    );
                  }
                  void p;
                },
              });
            if (st === "DERIVE")
              m.effet({
                couche: "avant",
                duree: 900,
                additif: true,
                dessiner(ctx, p, temps) {
                  ctx.globalAlpha = Math.sin(p * Math.PI);
                  ctx.strokeStyle = coul;
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  for (let i = 0; i < 60; i++) {
                    const a = i * 0.32 + temps / 120;
                    const rr = i * 1.1;
                    ctx.lineTo(
                      x.c.x + Math.cos(a) * rr,
                      x.C.y + 10 + Math.sin(a) * rr * 0.4,
                    );
                  }
                  ctx.stroke();
                },
              });
            if (st === "IMMOBILISATION")
              m.effet({
                couche: "avant",
                duree: 900,
                dessiner(ctx, p) {
                  ctx.globalAlpha =
                    p > 0.7 ? (1 - p) / 0.3 : Math.min(1, p * 5);
                  ctx.strokeStyle = coul;
                  ctx.lineWidth = 3;
                  for (let i = 0; i < 5; i++) {
                    ctx.save();
                    ctx.translate(x.C.x + (i / 4) * x.C.w, x.c.y);
                    ctx.rotate(i % 2 ? 0 : Math.PI / 2);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                  }
                  ctx.fillStyle = coul;
                  arrondi(ctx, x.c.x - 12, x.c.y - 4, 24, 20, 3);
                  ctx.fill();
                  ctx.lineWidth = 4;
                  ctx.beginPath();
                  ctx.arc(x.c.x, x.c.y - 4, 8, Math.PI, 0);
                  ctx.stroke();
                },
              });
          },
        });
        fin = Math.max(fin, t + 1000);
        break;
      }
      case "healSelf":
      case "healAll":
        e.push({
          a: t,
          faire: () => {
            m.gerbe(18, bas({ ...x, C: x.A, c: x.a }), () => ({
              forme: "croix",
              couleur: "#46c78c",
              x: x.a.x + (r() - 0.5) * x.A.w,
              vx: (r() - 0.5) * 20,
              vy: -90 - r() * 90,
              vie: 900,
              taille: 5,
              additif: true,
            }));
            onde(m, x.a, 100, "#46c78c", 600, 4);
            if (eff.amount)
              chiffre(
                m,
                { x: x.a.x - 34, y: x.A.y + 30 },
                `−${eff.amount}`,
                "#46c78c",
              );
          },
        });
        fin = Math.max(fin, t + 950);
        break;
      case "draw":
        e.push({
          a: t,
          faire: () => {
            for (let i = 0; i < (eff.amount ?? 1); i++)
              m.emettre({
                x: x.a.x,
                y: x.a.y,
                vx: (i - 0.5) * 160,
                vy: 520,
                frein: 0.4,
                forme: "carte",
                couleur: "#2b3a55",
                vie: 700,
                taille: 12,
                tailleFin: 9,
                vrot: (i ? 1 : -1) * 3,
              });
          },
        });
        fin = Math.max(fin, t + 750);
        break;
      case "discardEnergy":
        e.push({
          a: t,
          faire: () =>
            m.gerbe(eff.amount ?? 1, sur.c, () => ({
              forme: "tasse",
              couleur: "#6b3e1a",
              vx: (r() - 0.5) * 300,
              vy: -260,
              ay: 1100,
              vie: 900,
              taille: 9,
              vrot: (r() - 0.5) * 10,
            })),
        });
        fin = Math.max(fin, t + 950);
        break;
      case "selfDamage":
        e.push({
          a: t,
          faire: () => {
            // Un voile rouge, pas un aplat : sur la carte agrandie d'une cinématique, l'éclat plein
            // devenait un bloc saumon de la taille d'une carte.
            m.effet({
              couche: "avant",
              duree: 260,
              dessiner(ctx, p) {
                ctx.globalAlpha = (1 - p) * 0.32;
                ctx.fillStyle = "#e0563f";
                arrondi(ctx, x.A.x, x.A.y, x.A.w, x.A.h, 10);
                ctx.fill();
              },
            });
            m.animer(
              x.att,
              [
                { transform: pose(x, "none") },
                {
                  transform: pose(x, "translateY(10px) rotate(-3deg)"),
                  offset: 0.3,
                },
                { transform: pose(x, "none") },
              ],
              360,
            );
            if (eff.amount)
              chiffre(
                m,
                // Au centre de la cinématique, le chiffre se pose **à côté** de la carte : au-dessus
                // d'elle, il masquait le nom du Planqué.
                x.base
                  ? { x: x.A.x + x.A.w + 34, y: x.a.y }
                  : { x: x.a.x + 34, y: x.A.y + 30 },
                `+${eff.amount}`,
                "#e0563f",
              );
          },
        });
        fin = Math.max(fin, t + 950);
        break;
      case "switchSelf":
        e.push({
          a: t + 200,
          faire: () =>
            m.animer(
              x.att,
              [
                { transform: pose(x, "none") },
                {
                  transform: pose(x, "translateX(140%) rotate(8deg)"),
                  offset: 0.45,
                  opacity: 0,
                },
                {
                  transform: pose(x, "translateX(-140%)"),
                  offset: 0.55,
                  opacity: 0,
                },
                { transform: pose(x, "none"), opacity: 1 },
              ],
              700,
              "ease-in-out",
            ),
        });
        fin = Math.max(fin, t + 950);
        break;
      case "reduceDamage":
        e.push({
          a: t,
          faire: () =>
            m.effet({
              couche: "avant",
              duree: 800,
              additif: true,
              dessiner(ctx, p) {
                ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
                ctx.strokeStyle = "#61d5df";
                ctx.lineWidth = 3;
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
                  ctx.lineTo(
                    x.a.x + Math.cos(a) * x.A.w * 0.75,
                    x.a.y + Math.sin(a) * x.A.h * 0.62,
                  );
                }
                ctx.stroke();
                ctx.fillStyle = "rgba(97,213,223,.12)";
                ctx.fill();
              },
            }),
        });
        fin = Math.max(fin, t + 850);
        break;
      case "discardHand":
        e.push({
          a: t,
          faire: () =>
            m.gerbe(5, { x: m.largeur / 2, y: -10 }, () => ({
              forme: "carte",
              couleur: "#5b2a2a",
              vx: (r() - 0.5) * 300,
              vy: 120 + r() * 120,
              ay: 600,
              vie: 900,
              taille: 11,
              vrot: (r() - 0.5) * 8,
            })),
        });
        fin = Math.max(fin, t + 950);
        break;
      default:
        break;
    }
  }
  return fin;
}

function pastille(x: Ctx, texte: string, couleur: string) {
  x.m.effet({
    couche: "avant",
    duree: 1300,
    dessiner(ctx, p) {
      const s = facilite.ressort(Math.min(1, p * 6));
      ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
      ctx.translate(x.c.x, x.C.y + x.C.h + 16);
      ctx.scale(s, s);
      ctx.font = "800 14px system-ui, sans-serif";
      const w = ctx.measureText(texte).width + 22;
      ctx.fillStyle = couleur;
      arrondi(ctx, -w / 2, -13, w, 26, 13);
      ctx.fill();
      ctx.fillStyle = "#140d05";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(texte, 0, 1);
    },
  });
}

// ---------- Le coup de grâce : la sortie, en satire de bureau ----------

/**
 * Les formules creuses du départ, en deux lignes de tampon. On se moque du formulaire, jamais de
 * celle ou celui qui le reçoit : « plan de sauvegarde », c'est le nom officiel du plan social.
 */
const SORTIES: readonly (readonly [string, string])[] = [
  ["POSTE", "SUPPRIMÉ"],
  ["RUPTURE", "CONVENTIONNELLE"],
  ["OPTIMISATION", "DES EFFECTIFS"],
  ["MUTATION", "À DISTANCE"],
  ["FIN DE", "MISSION"],
  ["PLAN DE", "SAUVEGARDE"],
];

/** La note qui accompagne le carton : la politesse de la formule, vide de tout le reste. */
const MOTS_DU_DEPART = [
  "Merci pour votre engagement.",
  "Vos tâches sont réparties.",
  "Un pot de départ sera organisé.",
  "Le poste n’est pas reconduit.",
];

/** Coupe un texte en lignes qui tiennent dans `largeur` (la police du contexte est déjà posée). */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const sortie: string[] = [];
  let ligne = "";
  for (const mot of texte.split(" ")) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ligne && ctx.measureText(essai).width > largeur) {
      sortie.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) sortie.push(ligne);
  return sortie;
}

/**
 * **Le coup de grâce** : la cible craque, elle part au Rebut. Sa saynète tient en quatre gestes de
 * bureau, **un par temps** — le tampon, la carte qui part dans son carton, la note de service. Le
 * ton est celui du jeu : on ridiculise le cérémonial et le formulaire.
 *
 * La carte visée est la doublure de la scène (`SceneAttaque`) : elle est encore là à l'impact,
 * c'est elle qu'on voit encaisser, se griser et disparaître.
 *
 * Rien de ce que ça dit n'est perdu sous « Mouvement réduit » : le bandeau « a craqué », la
 * ligne du journal et l'Intervention marquée le disent déjà.
 */
function sayneteDeSortie(x: Ctx, e: Etape[], t: number) {
  const m = x.m;
  const r = x.rnd;
  const [l1, l2] = SORTIES[hacher(`${x.attaque.name}:sortie`) % SORTIES.length];
  const mot = MOTS_DU_DEPART[hacher(`${x.attaque.name}:mot`) % MOTS_DU_DEPART.length];
  const C = x.C;
  const largeurPlateau = () => m.largeur;

  // 1. Le tampon s'abat sur la carte, qui se grise — le geste administratif, sec et rouge.
  e.push({
    a: t,
    faire: () => {
      m.geler(70);
      m.secouer(6, 240);
      m.animer(
        x.cib,
        [{ filter: "grayscale(0)" }, { filter: "grayscale(1) brightness(0.8)" }],
        260,
        "ease-out",
      );
      m.gerbe(8, x.c, () => ({
        forme: "carre",
        couleur: "#f4f1e8",
        vx: (r() - 0.5) * 340,
        vy: -80 - r() * 200,
        ay: 700,
        frein: 1.5,
        vie: 800,
        taille: 5 + r() * 4,
        vrot: (r() - 0.5) * 12,
      }));
      m.effet({
        couche: "avant",
        duree: 1000,
        dessiner(ctx, p) {
          const pose = p < 0.14 ? facilite.sortie(p / 0.14) : 1;
          const s = lerp(2.4, 1, pose);
          ctx.globalAlpha = (p > 0.8 ? (1 - p) / 0.2 : 1) * Math.min(1, p * 14);
          // La taille du texte s'adapte : « CONVENTIONNELLE » doit tenir sur le plateau, penchée.
          ctx.font = "900 19px system-ui, sans-serif";
          const mesure = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width);
          const plein = Math.min(largeurPlateau() - 44, 240);
          const px = Math.min(19, (19 * (plein - 26)) / mesure);
          ctx.font = `900 ${px.toFixed(1)}px system-ui, sans-serif`;
          const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 26;
          const h = px * 2.3 + 16;
          const cx = Math.min(Math.max(x.c.x, w / 2 + 14), largeurPlateau() - w / 2 - 14);
          ctx.translate(cx, x.c.y);
          ctx.rotate(-0.2);
          ctx.scale(s, s);
          // Une plaque claire sous l'encre : le rouge doit se lire sur une carte grise comme sur le feutre.
          ctx.fillStyle = "rgba(250,244,230,.92)";
          arrondi(ctx, -w / 2, -h / 2, w, h, 6);
          ctx.fill();
          ctx.strokeStyle = "#d0352b";
          ctx.lineWidth = 4;
          arrondi(ctx, -w / 2, -h / 2, w, h, 6);
          ctx.stroke();
          ctx.lineWidth = 1.5;
          arrondi(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 3);
          ctx.stroke();
          ctx.fillStyle = "#d0352b";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(l1, 0, -px * 0.58);
          ctx.fillText(l2, 0, px * 0.62);
        },
      });
    },
  });

  // 2. Le carton se glisse sous la carte ; la carte s'y range, rapetissée, comme on referme un dossier.
  const bw = Math.min(124, C.w * 1.28);
  const bordCarton = C.y + C.h * 0.7;
  e.push({
    a: t + 640,
    faire: () => {
      const duree = SORTIE_DUREE - 640;
      m.effet({
        couche: "avant",
        duree,
        dessiner(ctx, p, temps) {
          void temps;
          const ms = p * duree;
          const monte = facilite.ressort(Math.min(1, ms / 260));
          ctx.globalAlpha = p > 0.88 ? (1 - p) / 0.12 : Math.min(1, ms / 90);
          ctx.translate(0, (1 - monte) * 44);
          const bx = x.c.x - bw / 2;
          const y = bordCarton;
          // L'ouverture du carton, sombre : c'est là que la carte disparaît.
          ctx.fillStyle = "#2a1a0a";
          ctx.beginPath();
          ctx.ellipse(x.c.x, y, Math.max(0.5, bw / 2 - 3), 10, 0, 0, Math.PI * 2);
          ctx.fill();
          // La plante du bureau (à gauche) et la tasse (à droite) dépassent du carton.
          const oscille = Math.sin(ms / 260) * 2;
          ctx.strokeStyle = "#3f7d3f";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x.c.x - 34, y + 2);
          ctx.quadraticCurveTo(x.c.x - 36 + oscille, y - 14, x.c.x - 33 + oscille, y - 26);
          ctx.stroke();
          ctx.fillStyle = "#58b058";
          for (const [dx, dy, a] of [
            [-33 + oscille, -27, -0.6],
            [-33 + oscille, -24, 0.6],
            [-33 + oscille, -31, 0],
          ] as const) {
            ctx.beginPath();
            ctx.ellipse(x.c.x + dx, y + dy, 8, 4, a - Math.PI / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#f4f1e8";
          arrondi(ctx, x.c.x + 24, y - 14, 17, 17, 3);
          ctx.fill();
          ctx.strokeStyle = "#f4f1e8";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x.c.x + 43, y - 6, 5, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
          // La face avant : carton, scotch, étiquette au feutre.
          ctx.fillStyle = "#c49a58";
          arrondi(ctx, bx, y, bw, 46, 3);
          ctx.fill();
          ctx.fillStyle = "#a67c22";
          ctx.fillRect(bx, y, bw, 6);
          ctx.fillStyle = "rgba(255,255,255,.35)";
          ctx.fillRect(x.c.x - 12, y, 24, 46);
          ctx.strokeStyle = "#664d38";
          ctx.lineWidth = 2;
          arrondi(ctx, bx, y, bw, 46, 3);
          ctx.stroke();
          ctx.fillStyle = "#2a1a0a";
          ctx.font = "800 italic 13px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("MES AFFAIRES", x.c.x, y + 29);
        },
      });
    },
  });
  e.push({
    a: t + 800,
    faire: () =>
      // La carte se range : elle se rapetisse en tombant dans le carton, **opaque** jusqu'au bout, et
      // ne s'efface que derrière la face avant. Ainsi on voit un Planqué entrer dans une boîte.
      m.animer(
        x.cib,
        [
          { transform: "none", opacity: 1 },
          { transform: "translateY(-12px) rotate(-4deg) scale(1.02)", opacity: 1, offset: 0.22 },
          {
            transform: `translateY(${(bordCarton - x.c.y + 18).toFixed(1)}px) rotate(-9deg) scale(0.5)`,
            opacity: 1,
            offset: 0.88,
          },
          {
            transform: `translateY(${(bordCarton - x.c.y + 30).toFixed(1)}px) rotate(-9deg) scale(0.46)`,
            opacity: 0,
          },
        ],
        560,
        "cubic-bezier(.45,0,.55,1)",
      ),
  });

  // 3. La note de service : la formule creuse, signée de rien.
  e.push({
    a: t + 1150,
    faire: () => {
      const duree = SORTIE_DUREE - 1150;
      m.effet({
        couche: "avant",
        duree,
        dessiner(ctx, p) {
          const entree = facilite.ressort(Math.min(1, (p * duree) / 280));
          ctx.globalAlpha = p > 0.84 ? (1 - p) / 0.16 : Math.min(1, (p * duree) / 100);
          ctx.font = "700 15px system-ui, sans-serif";
          const corps = lignes(ctx, mot, 168);
          const larg = 190;
          const h = 34 + corps.length * 19 + 20;
          const bord = largeurPlateau() - larg - 10;
          const gauche = Math.min(C.x + C.w + 12, bord);
          const hautNote = C.y + 6;
          ctx.translate(gauche + larg / 2 + (1 - entree) * 120, hautNote + h / 2);
          ctx.rotate(0.05 - (1 - entree) * 0.2);
          ctx.fillStyle = "rgba(0,0,0,.35)";
          ctx.fillRect(-larg / 2 + 4, -h / 2 + 5, larg, h);
          ctx.fillStyle = "#f6efd8";
          ctx.fillRect(-larg / 2, -h / 2, larg, h);
          ctx.fillStyle = "#c0442e";
          ctx.fillRect(-larg / 2, -h / 2, larg, 22);
          ctx.fillStyle = "#fff6e6";
          ctx.font = "800 12px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText("NOTE INTERNE", -larg / 2 + 9, -h / 2 + 11.5);
          ctx.fillStyle = "#2a1d0e";
          ctx.font = "700 15px system-ui, sans-serif";
          corps.forEach((ligne, i) => ctx.fillText(ligne, -larg / 2 + 9, -h / 2 + 38 + i * 19));
          ctx.font = "italic 600 13px system-ui, sans-serif";
          ctx.fillStyle = "#6a5a40";
          ctx.textAlign = "right";
          ctx.fillText("Cordialement.", larg / 2 - 9, h / 2 - 11);
        },
      });
    },
  });
}
