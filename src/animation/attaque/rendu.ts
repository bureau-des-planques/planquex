import { arrondi, facilite } from '../moteur';
import type { Ctx } from './ctx';

export function pastille(x: Ctx, texte: string, couleur: string) {
  x.m.effet({
    couche: 'avant',
    duree: 1300,
    dessiner(ctx, p) {
      const s = facilite.ressort(Math.min(1, p * 6));
      ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
      ctx.translate(x.c.x, x.C.y + x.C.h + 16);
      ctx.scale(s, s);
      ctx.font = '800 14px system-ui, sans-serif';
      const w = ctx.measureText(texte).width + 22;
      ctx.fillStyle = couleur;
      arrondi(ctx, -w / 2, -13, w, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#140d05';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(texte, 0, 1);
    }
  });
}
