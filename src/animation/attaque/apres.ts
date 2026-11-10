import type { Status } from '@/data/types';
import { alea, arrondi, chiffre, eclair, onde } from '../moteur';
import type { Etape } from '../moteur';
import { pose } from './ctx';
import type { Ctx } from './ctx';
import { bas } from './generique';
import { pastille } from './rendu';

// ---------- Après coup : Conditions et effets ----------

export const COULEURS_STATUT: Record<Status, string> = {
  SURCHARGE: '#9ef5fb',
  EPUISEMENT: '#f7a54a',
  SIESTE: '#b9a7f2',
  IMMOBILISATION: '#a3abbd',
  DERIVE: '#f4a6c0'
};

export const NOMS_STATUT: Record<Status, string> = {
  SURCHARGE: 'Surcharge',
  EPUISEMENT: 'Épuisement',
  SIESTE: 'Sieste',
  IMMOBILISATION: 'Immobilisation',
  DERIVE: 'Dérive'
};

export function apres(x: Ctx, e: Etape[], t: number): number {
  const m = x.m;
  const r = x.rnd;
  let fin = t;
  for (const eff of x.attaque.effects ?? []) {
    const sur = eff.target === 'opponent' ? x : { ...x, C: x.A, c: x.a };
    // Une cible qui craque ne porte ni Condition ni café : l'animation ne raconte pas un effet
    // posé sur une carte déjà partie au Rebut.
    if (x.coupDeGrace && eff.target === 'opponent' && (eff.kind === 'status' || eff.kind === 'discardEnergy')) continue;
    switch (eff.kind) {
      case 'status': {
        if (!eff.status) break;
        const st = eff.status;
        const coul = COULEURS_STATUT[st];
        e.push({
          a: t,
          faire: () => {
            pastille(x, NOMS_STATUT[st], coul);
            if (st === 'SIESTE')
              m.gerbe(4, { x: x.c.x + 30, y: x.C.y + 10 }, (i) => ({
                forme: 'zzz',
                texte: 'z',
                couleur: coul,
                vx: 30 + i * 6,
                vy: -70,
                vie: 900 + i * 120,
                taille: 4 + i * 1.5,
                tailleFin: 7
              }));
            if (st === 'EPUISEMENT')
              m.gerbe(26, bas(x), () => ({
                forme: 'flamme',
                couleur: r() > 0.5 ? '#f7a54a' : '#e0563f',
                x: x.c.x + (r() - 0.5) * x.C.w,
                vx: (r() - 0.5) * 30,
                vy: -120 - r() * 120,
                vie: 700,
                taille: 6,
                tailleFin: 2,
                additif: true
              }));
            if (st === 'SURCHARGE')
              m.effet({
                couche: 'avant',
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
                        y: x.c.y + Math.sin(a1) * x.C.h * 0.55
                      },
                      {
                        x: x.c.x + Math.cos(a2) * x.C.w * 0.55,
                        y: x.c.y + Math.sin(a2) * x.C.h * 0.55
                      },
                      local,
                      coul,
                      8
                    );
                  }
                  void p;
                }
              });
            if (st === 'DERIVE')
              m.effet({
                couche: 'avant',
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
                    ctx.lineTo(x.c.x + Math.cos(a) * rr, x.C.y + 10 + Math.sin(a) * rr * 0.4);
                  }
                  ctx.stroke();
                }
              });
            if (st === 'IMMOBILISATION')
              m.effet({
                couche: 'avant',
                duree: 900,
                dessiner(ctx, p) {
                  ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : Math.min(1, p * 5);
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
                }
              });
          }
        });
        fin = Math.max(fin, t + 1000);
        break;
      }
      case 'healSelf':
      case 'healAll':
        e.push({
          a: t,
          faire: () => {
            m.gerbe(18, bas({ ...x, C: x.A, c: x.a }), () => ({
              forme: 'croix',
              couleur: '#46c78c',
              x: x.a.x + (r() - 0.5) * x.A.w,
              vx: (r() - 0.5) * 20,
              vy: -90 - r() * 90,
              vie: 900,
              taille: 5,
              additif: true
            }));
            onde(m, x.a, 100, '#46c78c', 600, 4);
            if (eff.amount) chiffre(m, { x: x.a.x - 34, y: x.A.y + 30 }, `−${eff.amount}`, '#46c78c');
          }
        });
        fin = Math.max(fin, t + 950);
        break;
      case 'draw':
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
                forme: 'carte',
                couleur: '#2b3a55',
                vie: 700,
                taille: 12,
                tailleFin: 9,
                vrot: (i ? 1 : -1) * 3
              });
          }
        });
        fin = Math.max(fin, t + 750);
        break;
      case 'discardEnergy':
        e.push({
          a: t,
          faire: () =>
            m.gerbe(eff.amount ?? 1, sur.c, () => ({
              forme: 'tasse',
              couleur: '#6b3e1a',
              vx: (r() - 0.5) * 300,
              vy: -260,
              ay: 1100,
              vie: 900,
              taille: 9,
              vrot: (r() - 0.5) * 10
            }))
        });
        fin = Math.max(fin, t + 950);
        break;
      case 'selfDamage':
        e.push({
          a: t,
          faire: () => {
            // Un voile rouge, pas un aplat : sur la carte agrandie d'une cinématique, l'éclat plein
            // devenait un bloc saumon de la taille d'une carte.
            m.effet({
              couche: 'avant',
              duree: 260,
              dessiner(ctx, p) {
                ctx.globalAlpha = (1 - p) * 0.32;
                ctx.fillStyle = '#e0563f';
                arrondi(ctx, x.A.x, x.A.y, x.A.w, x.A.h, 10);
                ctx.fill();
              }
            });
            m.animer(
              x.att,
              [
                { transform: pose(x, 'none') },
                {
                  transform: pose(x, 'translateY(10px) rotate(-3deg)'),
                  offset: 0.3
                },
                { transform: pose(x, 'none') }
              ],
              360
            );
            if (eff.amount)
              chiffre(
                m,
                // Au centre de la cinématique, le chiffre se pose **à côté** de la carte : au-dessus
                // d'elle, il masquait le nom du Planqué.
                x.base ? { x: x.A.x + x.A.w + 34, y: x.a.y } : { x: x.a.x + 34, y: x.A.y + 30 },
                `+${eff.amount}`,
                '#e0563f'
              );
          }
        });
        fin = Math.max(fin, t + 950);
        break;
      case 'switchSelf':
        e.push({
          a: t + 200,
          faire: () =>
            m.animer(
              x.att,
              [
                { transform: pose(x, 'none') },
                {
                  transform: pose(x, 'translateX(140%) rotate(8deg)'),
                  offset: 0.45,
                  opacity: 0
                },
                {
                  transform: pose(x, 'translateX(-140%)'),
                  offset: 0.55,
                  opacity: 0
                },
                { transform: pose(x, 'none'), opacity: 1 }
              ],
              700,
              'ease-in-out'
            )
        });
        fin = Math.max(fin, t + 950);
        break;
      case 'reduceDamage':
        e.push({
          a: t,
          faire: () =>
            m.effet({
              couche: 'avant',
              duree: 800,
              additif: true,
              dessiner(ctx, p) {
                ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
                ctx.strokeStyle = '#61d5df';
                ctx.lineWidth = 3;
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
                  ctx.lineTo(x.a.x + Math.cos(a) * x.A.w * 0.75, x.a.y + Math.sin(a) * x.A.h * 0.62);
                }
                ctx.stroke();
                ctx.fillStyle = 'rgba(97,213,223,.12)';
                ctx.fill();
              }
            })
        });
        fin = Math.max(fin, t + 850);
        break;
      case 'discardHand':
        e.push({
          a: t,
          faire: () =>
            m.gerbe(5, { x: m.largeur / 2, y: -10 }, () => ({
              forme: 'carte',
              couleur: '#5b2a2a',
              vx: (r() - 0.5) * 300,
              vy: 120 + r() * 120,
              ay: 600,
              vie: 900,
              taille: 11,
              vrot: (r() - 0.5) * 8
            }))
        });
        fin = Math.max(fin, t + 950);
        break;
      default:
        break;
    }
  }
  return fin;
}
