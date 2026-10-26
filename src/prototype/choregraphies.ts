/*
 * PROTOTYPE JETABLE — chorégraphies d'attaque. Une attaque → une animation, dérivée de son nom,
 * de sa faction et de ses effets ; deux attaques d'une même carte n'ont jamais le même motif.
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
} from "./fx-moteur";
import type { Etape, Moteur, Pt, Rect } from "./fx-moteur";

export type Variante = "A" | "B" | "C" | "D" | "E";

export const VARIANTES: Record<Variante, { titre: string; regle: string }> = {
  A: {
    titre: "Référence (#207)",
    regle: "La séquence actuelle du jeu : la même pour toutes les attaques.",
  },
  B: {
    titre: "Hearthstone — la charge",
    regle:
      "La carte fonce sur sa cible. Cinq styles de charge, gel d’impact, secousse, gros chiffre.",
  },
  C: {
    titre: "Pocket — l’énergie",
    regle:
      "La carte reste à sa place ; une énergie aux couleurs de sa faction part vers la cible. Six formes.",
  },
  D: {
    titre: "Bureau — un motif par attaque",
    regle:
      "Dix-huit motifs de bureau tirés du nom de l’attaque : tampon, avion en papier, éclair, mégaphone…",
  },
  E: {
    titre: "Bureau + légendaire",
    regle:
      "D, plus une cinématique sur la grosse attaque des COU, 3 étoiles et COMEX : voile, rayons, bandeau, ralenti.",
  },
};

export interface Scene {
  m: Moteur;
  att: HTMLElement;
  cib: HTMLElement;
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
  /** La pose de l'attaquant pendant une cinématique (centré, agrandi) ; vide sinon. */
  base: string;
}

/** Une transformation de l'attaquant, appliquée par-dessus sa pose. */
function pose(x: Ctx, s: string): string {
  if (!x.base) return s;
  return s === "none" ? x.base : `${x.base} ${s}`;
}

// ---------- Attribution : une animation distincte par attaque d'une carte ----------

type CleB = "droit" | "saut" | "vrille" | "rafale" | "plaquage";
type CleC = "orbe" | "rayon" | "pluie" | "vague" | "spirale" | "eclats";
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

const LIBELLES_B: Record<CleB, string> = {
  droit: "Charge droite",
  saut: "Saut écrasant",
  vrille: "Charge en vrille",
  rafale: "Double frappe",
  plaquage: "Plaquage lourd",
};

const LIBELLES_C: Record<CleC, string> = {
  orbe: "Orbe d’énergie",
  rayon: "Rayon",
  pluie: "Pluie d’éclats",
  vague: "Vague",
  spirale: "Double spirale",
  eclats: "Éventail de lames",
};

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

function candidats(
  variante: Variante,
  carte: PlanqueCard,
  attaque: Attack,
): string[] {
  const graine = `${carte.id}:${attaque.name}`;
  const genres = attaque.effects?.map((e) => e.kind) ?? [];
  if (variante === "B") {
    const sens: CleB[] = [];
    if (genres.includes("selfDamage")) sens.push("plaquage");
    if (attaque.cost.length <= 1) sens.push("rafale");
    if (attaque.cost.length >= 3) sens.push("saut");
    return [...sens, ...ordreHache(Object.keys(LIBELLES_B) as CleB[], graine)];
  }
  if (variante === "C") {
    const sens: CleC[] = [];
    if (attaque.cost.length >= 3) sens.push("rayon");
    if (genres.includes("status")) sens.push("spirale");
    if (genres.includes("healSelf") || genres.includes("healAll"))
      sens.push("vague");
    return [...sens, ...ordreHache(Object.keys(LIBELLES_C) as CleC[], graine)];
  }
  const cles = Object.keys(MOTIFS_D) as CleD[];
  const parNom = cles.filter((k) => MOTIFS_D[k].mots.test(attaque.name));
  return [...parNom, REPLI_FACTION[carte.faction], ...ordreHache(cles, graine)];
}

/** Le motif de chaque attaque de la carte, distinct d'une attaque à l'autre. */
export function attribuer(
  variante: Variante,
  carte: PlanqueCard,
): Map<string, string> {
  const pris = new Set<string>();
  const sortie = new Map<string, string>();
  for (const attaque of carte.attacks) {
    const cle =
      variante === "A"
        ? "reference"
        : (candidats(variante, carte, attaque).find((k) => !pris.has(k)) ??
          "droit");
    pris.add(cle);
    sortie.set(attaque.name, cle);
  }
  return sortie;
}

export function libelle(variante: Variante, cle: string): string {
  if (variante === "A") return "Référence";
  if (variante === "B") return LIBELLES_B[cle as CleB] ?? cle;
  if (variante === "C") return LIBELLES_C[cle as CleC] ?? cle;
  return MOTIFS_D[cle as CleD]?.libelle ?? cle;
}

export function estLegendaire(carte: PlanqueCard): boolean {
  return carte.rarity === "COU" || carte.rarity === "3S" || carte.ex === true;
}

function aCinematique(
  variante: Variante,
  carte: PlanqueCard,
  attaque: Attack,
): boolean {
  if (variante !== "E" || !estLegendaire(carte)) return false;
  const max = Math.max(...carte.attacks.map((a) => a.cost.length));
  return attaque.cost.length === max;
}

// ---------- Construction ----------

export function choregraphie(
  variante: Variante,
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
    base: "",
  };
  const cle = attribuer(variante, carte).get(attaque.name) ?? "droit";
  const etapes: Etape[] = [];
  const cinematique = aCinematique(variante, carte, attaque);
  if (cinematique) preparerVoile();

  if (variante === "A") {
    const fin = reference(ctx, etapes);
    return { nom: "Référence", etapes, duree: fin, cinematique: false };
  }

  let t0 = 0;
  if (cinematique) t0 = prelude(ctx, etapes);

  let impact: number;
  if (variante === "B") impact = chargeB(ctx, etapes, t0, cle as CleB);
  else if (variante === "C") impact = energieC(ctx, etapes, t0, cle as CleC);
  else impact = motifD(ctx, etapes, t0, cle as CleD, cinematique);

  const touche = attaque.damage > 0;
  const fort = cinematique ? 1.6 : 1;
  etapes.push({
    a: impact,
    faire: () => {
      if (touche) impactGenerique(ctx, fort, variante === "B");
      if (cinematique) impactLegendaire(ctx);
    },
  });
  const finApres = apres(ctx, etapes, impact + 120);
  const duree = Math.max(impact + 950, finApres);
  if (cinematique)
    etapes.push({ a: duree - 350, faire: () => retourCinematique(ctx) });
  return { nom: libelle(variante, cle), etapes, duree, cinematique };
}

// ---------- A : la référence (#207) ----------

function reference(x: Ctx, e: Etape[]): number {
  e.push({
    a: 0,
    faire: () =>
      x.m.animer(
        x.att,
        [
          { transform: "none" },
          { transform: "translateY(-6px) scale(1.03)", offset: 0.4 },
          { transform: "none" },
        ],
        200,
      ),
  });
  e.push({
    a: 200,
    faire: () =>
      x.m.effet({
        couche: "avant",
        duree: 350,
        additif: true,
        dessiner(ctx, p) {
          ctx.globalAlpha = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
          const g = ctx.createLinearGradient(
            x.a.x,
            x.A.y,
            x.c.x,
            x.C.y + x.C.h,
          );
          g.addColorStop(0, "#61d5df");
          g.addColorStop(1, "#f7e264");
          ctx.strokeStyle = g;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(x.a.x, x.A.y);
          ctx.lineTo(x.c.x, x.C.y + x.C.h);
          ctx.stroke();
        },
      }),
  });
  e.push({
    a: 550,
    faire: () => {
      x.m.effet({
        couche: "avant",
        duree: 150,
        dessiner(ctx, p) {
          ctx.globalAlpha = p < 0.1 ? p / 0.1 : 1 - p;
          ctx.strokeStyle = "#9ef5fb";
          ctx.lineWidth = 3;
          arrondi(ctx, x.C.x - 2, x.C.y - 2, x.C.w + 4, x.C.h + 4, 10);
          ctx.stroke();
        },
      });
      if (x.attaque.damage > 0)
        chiffre(x.m, { x: x.c.x, y: x.c.y }, `+${x.attaque.damage}`, "#f7e264");
    },
  });
  return 900;
}

// ---------- Commun ----------

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

function impactGenerique(x: Ctx, force: number, lourd: boolean) {
  const dmg = x.attaque.damage;
  const k = Math.min(1.6, 0.5 + dmg / 80) * force;
  x.m.geler(Math.min(100, 40 + dmg * 0.6) * (force > 1 ? 1 : 0.9));
  x.m.secouer((lourd ? 10 : 6) * k, 380);
  eclatCarte(x.m, x.C);
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
  chiffre(
    x.m,
    { x: x.c.x + 30, y: x.C.y + x.C.h * 0.3 },
    `+${dmg}`,
    "#f7e264",
    dmg >= 60,
  );
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
      const debut = opts.debut ?? 0;
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

function chargeB(x: Ctx, e: Etape[], t0: number, cle: CleB): number {
  const dx = x.c.x - x.a.x;
  const dy = x.C.y + x.C.h * 0.72 - x.A.y;
  const lancer = t0 + (cle === "plaquage" ? 420 : 240);
  anticipation(x, e, t0, cle === "plaquage" ? 420 : 240);
  const aller = cle === "plaquage" ? 170 : cle === "saut" ? 380 : 230;
  const total = aller + 420;
  const o = aller / total;
  const kf: Record<CleB, Keyframe[]> = {
    droit: [
      { transform: "none", easing: "cubic-bezier(.6,0,.9,.4)" },
      { transform: `translate(${dx}px, ${dy}px) rotate(-4deg)`, offset: o },
      {
        transform: `translate(${dx * 0.9}px, ${dy * 0.85}px) rotate(-2deg)`,
        offset: o + 0.12,
      },
      { transform: "none" },
    ],
    saut: [
      { transform: "none", easing: "ease-out" },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.55}px) scale(1.25) rotate(-8deg)`,
        offset: o * 0.65,
        easing: "cubic-bezier(.7,0,1,.5)",
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(1) rotate(0deg)`,
        offset: o,
      },
      { transform: `translate(${dx}px, ${dy * 0.9}px)`, offset: o + 0.12 },
      { transform: "none" },
    ],
    vrille: [
      { transform: "none", easing: "cubic-bezier(.5,0,.9,.5)" },
      { transform: `translate(${dx}px, ${dy}px) rotate(360deg)`, offset: o },
      {
        transform: `translate(${dx * 0.9}px, ${dy * 0.85}px) rotate(360deg)`,
        offset: o + 0.12,
      },
      { transform: "rotate(360deg)" },
    ],
    rafale: [
      { transform: "none", easing: "cubic-bezier(.6,0,.9,.4)" },
      {
        transform: `translate(${dx}px, ${dy}px) rotate(-3deg)`,
        offset: o * 0.7,
      },
      {
        transform: `translate(${dx * 0.85}px, ${dy * 0.75}px)`,
        offset: o * 0.85,
      },
      { transform: `translate(${dx}px, ${dy}px) rotate(3deg)`, offset: o },
      { transform: "none" },
    ],
    plaquage: [
      { transform: "none", easing: "cubic-bezier(.8,0,1,.6)" },
      {
        transform: `translate(${dx}px, ${dy}px) scale(1.12) rotate(-6deg)`,
        offset: o,
      },
      {
        transform: `translate(${dx * 0.8}px, ${dy * 0.8}px) scale(1.05)`,
        offset: o + 0.15,
      },
      { transform: "none" },
    ],
  };
  e.push({ a: lancer, faire: () => x.m.animer(x.att, kf[cle], total) });
  const impact = lancer + aller;
  if (cle === "rafale") {
    e.push({
      a: lancer + aller * 0.7,
      faire: () => {
        eclatCarte(x.m, x.C, "#ffffff", 140);
        x.m.secouer(4, 200);
        onde(x.m, x.c, 60, x.couleur, 300, 6);
      },
    });
  }
  if (cle === "saut") {
    e.push({
      a: lancer,
      faire: () =>
        x.m.effet({
          couche: "fond",
          duree: aller,
          dessiner(ctx, p) {
            ctx.globalAlpha = 0.4 * p;
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.ellipse(
              x.c.x,
              x.C.y + x.C.h,
              x.C.w * 0.6 * (1.3 - p * 0.3),
              14,
              0,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          },
        }),
    });
  }
  e.push({
    a: impact,
    faire: () => {
      const n = cle === "plaquage" || cle === "saut" ? 26 : 14;
      x.m.gerbe(n, bas(x), () => ({
        forme: "carre",
        couleur: x.rnd() > 0.4 ? x.couleur : "#d8d2c4",
        vx: (x.rnd() - 0.5) * 520,
        vy: -120 - x.rnd() * 380,
        ay: 1400,
        vie: 700 + x.rnd() * 300,
        taille: 4 + x.rnd() * 5,
        vrot: (x.rnd() - 0.5) * 20,
      }));
      if (cle === "saut" || cle === "plaquage")
        onde(x.m, bas(x), 170, "#f4e6cc", 520, 6);
      if (cle === "vrille") {
        x.m.gerbe(18, x.c, (i) => {
          const ang = (i / 18) * Math.PI * 2;
          return {
            forme: "trait",
            couleur: x.couleur,
            vx: Math.cos(ang) * 420,
            vy: Math.sin(ang) * 420,
            frein: 5,
            vie: 380,
            taille: 6,
            tailleFin: 1,
            orienter: true,
            additif: true,
          };
        });
      }
    },
  });
  return impact;
}

// ---------- C : Pocket, l'énergie ----------

function aura(x: Ctx, e: Etape[], t: number, duree: number) {
  e.push({
    a: t,
    faire: () => {
      x.m.effet({
        couche: "fond",
        duree,
        additif: true,
        dessiner(ctx, p, temps) {
          const pulse = 0.5 + 0.5 * Math.sin(temps / 70);
          ctx.globalAlpha = Math.sin(p * Math.PI) * (0.55 + 0.25 * pulse);
          const g = ctx.createRadialGradient(
            x.a.x,
            x.a.y,
            x.A.w * 0.3,
            x.a.x,
            x.a.y,
            x.A.w * 1.1,
          );
          g.addColorStop(0, x.couleur);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.fillRect(
            x.a.x - x.A.w * 1.2,
            x.a.y - x.A.h,
            x.A.w * 2.4,
            x.A.h * 2,
          );
        },
      });
      for (let i = 0; i < 26; i++) {
        const ang = x.rnd() * Math.PI * 2;
        const r = x.A.w * (0.8 + x.rnd() * 0.4);
        x.m.emettre({
          x: x.a.x + Math.cos(ang) * r,
          y: x.a.y + Math.sin(ang) * r,
          vx: -Math.cos(ang) * r * 2.4,
          vy: -Math.sin(ang) * r * 2.4,
          forme: "point",
          couleur: x.couleur,
          vie: duree * 0.45,
          taille: 2.5,
          tailleFin: 1,
          additif: true,
        });
      }
    },
  });
}

function energieC(x: Ctx, e: Etape[], t0: number, cle: CleC): number {
  aura(x, e, t0, 520);
  e.push({
    a: t0,
    faire: () =>
      x.m.animer(
        x.att,
        [
          { transform: "none" },
          { transform: "translateY(-10px) scale(1.05)", offset: 0.5 },
          { transform: "none" },
        ],
        760,
        "ease-in-out",
      ),
  });
  const lancer = t0 + 360;
  const de = haut(x);
  const vers = bas(x);
  const voyages: Record<CleC, number> = {
    orbe: 380,
    rayon: 360,
    pluie: 420,
    vague: 420,
    spirale: 440,
    eclats: 300,
  };
  const voyage = voyages[cle];
  const lueur = (pos: Pt, taille: number) =>
    x.m.emettre({
      x: pos.x + (x.rnd() - 0.5) * 6,
      y: pos.y + (x.rnd() - 0.5) * 6,
      forme: "point",
      couleur: x.couleur,
      vie: 260,
      taille,
      tailleFin: 0.5,
      additif: true,
    });

  e.push({
    a: lancer,
    faire: () => {
      const t = x.m.t;
      if (cle === "orbe") {
        projectile(x, {
          de,
          vers,
          duree: voyage,
          courbe: 40,
          facilite: facilite.entree,
          dessin(ctx, pos) {
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createRadialGradient(
              pos.x,
              pos.y,
              0,
              pos.x,
              pos.y,
              26,
            );
            g.addColorStop(0, "#ffffff");
            g.addColorStop(0.35, x.couleur);
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.fillRect(pos.x - 26, pos.y - 26, 52, 52);
          },
          trainee: (pos) => {
            lueur(pos, 5);
            lueur(pos, 3);
          },
        });
      } else if (cle === "rayon") {
        x.m.effet({
          couche: "avant",
          duree: voyage + 260,
          additif: true,
          dessiner(ctx, p, temps) {
            const ouverture =
              p < 0.3 ? p / 0.3 : p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
            const front = Math.min(1, p / 0.3);
            const bout = {
              x: lerp(de.x, vers.x, front),
              y: lerp(de.y, vers.y, front),
            };
            for (const [l, a, c] of [
              [30, 0.3, x.couleur],
              [14, 0.7, x.couleur],
              [5, 1, "#ffffff"],
            ] as const) {
              ctx.globalAlpha = a * ouverture;
              ctx.strokeStyle = c;
              ctx.lineWidth = l * (0.85 + 0.15 * Math.sin(temps / 30));
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(de.x, de.y);
              ctx.lineTo(bout.x, bout.y);
              ctx.stroke();
            }
          },
          maj() {
            lueur(
              {
                x: lerp(de.x, vers.x, x.rnd()),
                y: lerp(de.y, vers.y, x.rnd()),
              },
              3,
            );
          },
        });
      } else if (cle === "pluie") {
        for (let i = 0; i < 16; i++) {
          const cible = {
            x: vers.x + (x.rnd() - 0.5) * x.C.w,
            y: x.C.y + x.rnd() * x.C.h,
          };
          const depart = { x: cible.x + 40, y: -20 };
          projectile(x, {
            de: depart,
            vers: cible,
            debut: t + i * 18,
            duree: voyage - 120,
            facilite: facilite.entree,
            dessin(ctx, pos, ang) {
              ctx.globalCompositeOperation = "lighter";
              ctx.translate(pos.x, pos.y);
              ctx.rotate(ang);
              ctx.fillStyle = x.couleur;
              ctx.beginPath();
              ctx.moveTo(14, 0);
              ctx.lineTo(-10, -3);
              ctx.lineTo(-10, 3);
              ctx.fill();
            },
          });
        }
      } else if (cle === "vague") {
        x.m.effet({
          couche: "avant",
          duree: voyage,
          additif: true,
          dessiner(ctx, p) {
            const y = lerp(de.y, vers.y, facilite.entreeSortie(p));
            const larg = lerp(x.A.w * 0.8, x.C.w * 1.4, p);
            ctx.globalAlpha = 0.9;
            for (const [w, c] of [
              [16, x.couleur],
              [5, "#ffffff"],
            ] as const) {
              ctx.strokeStyle = c;
              ctx.lineWidth = w;
              ctx.beginPath();
              ctx.ellipse(
                lerp(de.x, vers.x, p),
                y,
                larg,
                22,
                0,
                Math.PI * 1.05,
                Math.PI * 1.95,
              );
              ctx.stroke();
            }
          },
          maj() {
            lueur(
              {
                x: lerp(de.x, vers.x, 0.5) + (x.rnd() - 0.5) * x.C.w,
                y: lerp(de.y, vers.y, x.rnd()),
              },
              3,
            );
          },
        });
      } else if (cle === "spirale") {
        for (const signe of [1, -1]) {
          x.m.effet({
            couche: "avant",
            duree: voyage,
            maj(temps) {
              const p = Math.min(1, (temps - t) / voyage);
              const base = {
                x: lerp(de.x, vers.x, p),
                y: lerp(de.y, vers.y, p),
              };
              const off =
                Math.sin(p * Math.PI * 4) * 26 * signe * (1 - p * 0.5);
              lueur({ x: base.x + off, y: base.y }, 5);
            },
            dessiner() {},
          });
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const ang = (i - 2) * 0.32;
          const v = { x: vers.x + Math.sin(ang) * 60, y: vers.y };
          projectile(x, {
            de,
            vers: v,
            debut: t + Math.abs(i - 2) * 30,
            duree: voyage,
            facilite: facilite.entree,
            dessin(ctx, pos, a) {
              ctx.globalCompositeOperation = "lighter";
              ctx.translate(pos.x, pos.y);
              ctx.rotate(a);
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.moveTo(20, 0);
              ctx.lineTo(-8, -5);
              ctx.lineTo(-8, 5);
              ctx.fill();
            },
            trainee: (pos) => lueur(pos, 3),
          });
        }
      }
    },
  });
  const impact = lancer + voyage;
  e.push({
    a: impact,
    faire: () => {
      x.m.gerbe(24, x.c, () => {
        const ang = x.rnd() * Math.PI * 2;
        const v = 120 + x.rnd() * 260;
        return {
          forme: "etoile",
          couleur: x.rnd() > 0.3 ? x.couleur : "#ffffff",
          vx: Math.cos(ang) * v,
          vy: Math.sin(ang) * v,
          frein: 3,
          vie: 600,
          taille: 6,
          tailleFin: 1,
          vrot: 6,
          additif: true,
        };
      });
      onde(x.m, x.c, 120, "#ffffff", 380, 4);
    },
  });
  return impact;
}

// ---------- D : Bureau, un motif par attaque ----------

const MOTS_TAMPON = [
  "NON CONFORME",
  "VALIDÉ",
  "À REVOIR",
  "URGENT",
  "VU",
  "REFUSÉ",
];

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
              for (const [w, c] of [
                [12, "rgba(70,199,140,.35)"],
                [5, "#46c78c"],
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
              ctx.moveTo(16, 0);
              ctx.lineTo(-6, -11);
              ctx.lineTo(-6, 11);
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
          const rr = alea(hacher(x.attaque.name));
          let graine = 0;
          m.effet({
            couche: "avant",
            duree: voyage + 120,
            additif: true,
            dessiner(ctx, p, temps) {
              const coup = Math.floor(temps / 90);
              if (coup !== graine) graine = coup;
              const visible = p < 0.25 || (p > 0.4 && p < 0.6) || p > 0.75;
              if (!visible) return;
              const local = alea(graine + 7);
              eclair(ctx, de, vers, local, "#9ef5fb", 26);
              if (rr() > 0.4)
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
            maj() {
              for (let i = 0; i < 3; i++)
                m.emettre({
                  x: vers.x,
                  y: vers.y,
                  vx: (r() - 0.5) * 300,
                  vy: -100 - r() * 240,
                  ay: 1200,
                  forme: "trait",
                  couleur: r() > 0.5 ? "#f7a54a" : "#ffe9a8",
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
          m.effet({
            couche: "avant",
            duree: voyage,
            dessiner() {},
            maj() {
              for (let i = 0; i < 5; i++) {
                const ang =
                  Math.atan2(vers.y - de.y, vers.x - de.x) + (r() - 0.5) * 0.35;
                const v = 700 + r() * 200;
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
          const rr = alea(hacher(x.carte.id));
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
              void rr;
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
          m.gerbe(12, x.c, () => ({
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

function prelude(x0: Ctx, e: Etape[]): number {
  const x = { ...x0 };
  const m = x.m;
  const dx = m.largeur / 2 - x.a.x;
  const dy = m.hauteur * 0.55 - x.a.y;
  const s = 1.3;
  x0.base = `translate(${dx}px, ${dy - 6}px) scale(${s})`;
  x0.a = { x: x.a.x + dx, y: x.a.y + dy - 6 };
  x0.A = {
    x: x0.a.x - (x.A.w * s) / 2,
    y: x0.a.y - (x.A.h * s) / 2,
    w: x.A.w * s,
    h: x.A.h * s,
  };
  e.push({
    a: 0,
    faire: () => {
      m.effet({
        couche: "avant",
        duree: 99999,
        dessiner(ctx, _p, temps) {
          const montee = Math.min(1, temps / 300);
          const g = ctx.createRadialGradient(
            x.a.x + dx,
            x.a.y + dy,
            x.A.w * 0.7,
            x.a.x + dx,
            x.a.y + dy,
            Math.max(m.largeur, m.hauteur),
          );
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(0.25, `rgba(5,8,14,${0.72 * montee})`);
          g.addColorStop(1, `rgba(5,8,14,${0.82 * montee})`);
          ctx.globalAlpha = voile;
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, m.largeur, m.hauteur);
        },
      });
      m.effet({
        couche: "fond",
        duree: 99999,
        additif: true,
        dessiner(ctx, _p, temps) {
          const o = { x: x.a.x + dx, y: x.a.y + dy };
          ctx.globalAlpha = Math.min(1, temps / 400) * 0.55 * voile;
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
      m.animer(
        x.att,
        [
          { transform: "none" },
          {
            transform: `translate(${dx}px, ${dy}px) scale(1.28) rotateY(0deg)`,
            offset: 0.55,
          },
          { transform: `translate(${dx}px, ${dy - 6}px) scale(1.3)` },
        ],
        620,
        "cubic-bezier(.2,.8,.2,1)",
      );
    },
  });
  e.push({
    a: 380,
    faire: () => {
      const o = { x: x.a.x + dx, y: x.a.y + dy };
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
      const titre =
        x.carte.rarity === "COU"
          ? "COURONNE"
          : x.carte.rarity === "3S"
            ? "★ ★ ★"
            : "COMEX";
      m.effet({
        couche: "avant",
        duree: 1000,
        dessiner(ctx, p) {
          const entree = facilite.sortie(Math.min(1, p / 0.25));
          const sortie = p > 0.8 ? (p - 0.8) / 0.2 : 0;
          const y = m.hauteur * 0.2;
          ctx.globalAlpha = 1 - sortie;
          ctx.fillStyle = "rgba(10,8,4,.75)";
          ctx.fillRect(0, y - 34, m.largeur * entree, 68);
          ctx.fillStyle = "#f7e264";
          ctx.fillRect(0, y - 34, m.largeur * entree, 3);
          ctx.fillRect(m.largeur * (1 - entree), y + 31, m.largeur, 3);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const xx = lerp(-m.largeur * 0.3, m.largeur / 2, entree) + p * 18;
          ctx.font = "800 12px system-ui, sans-serif";
          ctx.fillStyle = "#f7e264";
          ctx.fillText(titre, xx, y - 16);
          ctx.font = "900 26px system-ui, sans-serif";
          ctx.lineWidth = 5;
          ctx.strokeStyle = "#140d05";
          ctx.strokeText(x.attaque.name.toUpperCase(), xx, y + 8);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(x.attaque.name.toUpperCase(), xx, y + 8);
        },
      });
    },
  });
  return 1000;
}

let voile = 1;

function impactLegendaire(x: Ctx) {
  const m = x.m;
  m.geler(100);
  m.secouer(18, 600);
  m.effet({
    couche: "avant",
    duree: 260,
    additif: true,
    dessiner(ctx, p) {
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.fillStyle = "#fff6c8";
      ctx.fillRect(0, 0, m.largeur, m.hauteur);
    },
  });
  onde(m, x.c, 240, "#f7e264", 600, 14);
  onde(m, x.c, 160, "#ffffff", 420, 6);
  m.gerbe(110, x.c, () => {
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
    [{ transform: x.base }, { transform: "none" }],
    340,
    "cubic-bezier(.4,0,.2,1)",
  );
  m.effet({
    couche: "avant",
    duree: 340,
    dessiner() {},
    maj(t) {
      voile = Math.max(0, voile - 0.06);
      void t;
    },
  });
}

export function preparerVoile() {
  voile = 1;
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
            eclatCarte(m, x.A, "#e0563f", 260);
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
                { x: x.a.x + 34, y: x.A.y + 30 },
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
