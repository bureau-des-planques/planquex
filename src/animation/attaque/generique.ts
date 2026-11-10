import { arrondi, bezier, chiffre, eclatCarte, onde } from '../moteur';
import type { Etape, Pt } from '../moteur';
import { pose } from './ctx';
import type { Ctx } from './ctx';

// ---------- A : la référence (#207) ----------

export function anticipation(x: Ctx, e: Etape[], t: number, duree = 240) {
  e.push({
    a: t,
    faire: () =>
      x.m.animer(
        x.att,
        [
          { transform: pose(x, 'none') },
          { transform: pose(x, 'translateY(10px) scale(0.95)'), offset: 0.55 },
          { transform: pose(x, 'translateY(-4px) scale(1.04)') }
        ],
        duree,
        'ease-in-out'
      )
  });
}

export function recul(x: Ctx, force: number) {
  const r = (x.rnd() > 0.5 ? 1 : -1) * 4 * force;
  x.m.animer(
    x.cib,
    [
      { transform: 'none' },
      {
        transform: `translateY(${-18 * force}px) rotate(${r}deg) scale(0.96)`,
        offset: 0.25
      },
      {
        transform: `translateY(${5 * force}px) rotate(${-r / 2}deg)`,
        offset: 0.6
      },
      { transform: 'none' }
    ],
    420
  );
}

export function impactGenerique(x: Ctx, force: number) {
  const dmg = x.stress;
  const k = Math.min(1.6, 0.5 + dmg / 80) * force;
  x.m.geler(Math.min(100, 40 + dmg * 0.6) * (force > 1 ? 1 : 0.9));
  x.m.secouer(8 * k, 380);
  // Dans une cinématique, le flash plein de la carte s'ajoute à celui du plateau (`impactLegendaire`) :
  // deux aplats blancs au même instant. La carte garde le sien, moins dense.
  if (force > 1) {
    x.m.effet({
      couche: 'avant',
      duree: 220,
      additif: true,
      dessiner(ctx, p) {
        ctx.globalAlpha = (1 - p) * 0.5;
        ctx.fillStyle = '#ffffff';
        arrondi(ctx, x.C.x, x.C.y, x.C.w, x.C.h, 10);
        ctx.fill();
      }
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
      forme: 'trait',
      couleur: x.rnd() > 0.5 ? '#ffffff' : '#f7e264',
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      frein: 4,
      vie: 320 + x.rnd() * 200,
      taille: 4,
      tailleFin: 1,
      orienter: true,
      additif: true
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
          y: x.C.y + 20
        }
      : {
          x: Math.min(x.c.x + 30, x.m.largeur - marge),
          y: x.C.y + x.C.h * 0.3
        };
    chiffre(x.m, lieu, `+${dmg}`, '#f7e264', dmg >= 60);
  }
}

export function projectile(
  x: Ctx,
  opts: {
    de: Pt;
    vers: Pt;
    duree: number;
    courbe?: number;
    debut?: number;
    dessin: (ctx: CanvasRenderingContext2D, pos: Pt, angle: number, p: number) => void;
    trainee?: (pos: Pt, p: number) => void;
    facilite?: (p: number) => number;
  }
) {
  const mid = {
    x: (opts.de.x + opts.vers.x) / 2 + (opts.courbe ?? 0),
    y: (opts.de.y + opts.vers.y) / 2
  };
  const f = opts.facilite ?? ((p: number) => p);
  let dernier = opts.de;
  // Le début est **capturé ici** : `m.effet` le pose à `this.t` quand on ne le donne pas, et
  // `maj` lisait `0` — la traînée partait donc à mi-vol, ou jamais en cinématique.
  const debut = opts.debut ?? x.m.t;
  x.m.effet({
    couche: 'avant',
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
    }
  });
}

export function bas(x: Ctx): Pt {
  return { x: x.c.x, y: x.C.y + x.C.h * 0.8 };
}

export function haut(x: Ctx): Pt {
  return { x: x.a.x, y: x.A.y + x.A.h * 0.15 };
}
