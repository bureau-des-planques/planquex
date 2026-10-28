/* PROTOTYPE JETABLE (#283) — l'image du sachet, peinte une fois et partagée par les trois rendus. */

export const LARGEUR = 300;
export const HAUTEUR = 440;
const ECHELLE = 2;

function graine(depart: number): () => number {
  let s = depart;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function rectArrondi(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Un sachet ESD à plat : film argent translucide, cinq cartes qui luisent, bande or, étiquette. */
export function creerBase(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LARGEUR * ECHELLE;
  c.height = HAUTEUR * ECHELLE;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  g.scale(ECHELLE, ECHELLE);
  const alea = graine(7);

  g.fillStyle = '#0e1626';
  g.fillRect(0, 0, LARGEUR, HAUTEUR);

  const film = g.createLinearGradient(0, 0, LARGEUR, HAUTEUR * 0.55);
  film.addColorStop(0, '#7d8aa0');
  film.addColorStop(0.22, '#dbe3ee');
  film.addColorStop(0.42, '#8f9cb2');
  film.addColorStop(0.62, '#eef2f8');
  film.addColorStop(0.82, '#8593aa');
  film.addColorStop(1, '#c5cfdd');
  g.globalAlpha = 0.9;
  g.fillStyle = film;
  g.fillRect(0, 0, LARGEUR, HAUTEUR);
  g.globalAlpha = 1;

  // la pile de cinq cartes, vue à travers le film, avec sa lueur chaude
  const lueur = g.createRadialGradient(150, 250, 10, 150, 250, 190);
  lueur.addColorStop(0, 'rgba(255,196,120,0.55)');
  lueur.addColorStop(1, 'rgba(255,196,120,0)');
  g.fillStyle = lueur;
  g.fillRect(0, 60, LARGEUR, 380);
  for (let i = 0; i < 5; i += 1) {
    const x = 70 + i * 2.5;
    const y = 150 - i * 2;
    const carte = g.createLinearGradient(x, y, x + 150, y + 215);
    carte.addColorStop(0, 'rgba(250,224,170,0.34)');
    carte.addColorStop(1, 'rgba(120,86,44,0.26)');
    g.fillStyle = carte;
    rectArrondi(g, x, y, 150, 215, 8);
    g.fill();
    g.strokeStyle = 'rgba(255,236,196,0.4)';
    g.lineWidth = 1;
    g.stroke();
  }

  // le froissé statique : traits obliques, clairs puis sombres
  for (let i = 0; i < 90; i += 1) {
    const x = alea() * LARGEUR;
    const y = alea() * HAUTEUR;
    const l = 12 + alea() * 46;
    const a = -0.9 + alea() * 1.8;
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(20,32,56,0.16)';
    g.lineWidth = 0.8 + alea() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }

  // la bande or
  const or = g.createLinearGradient(0, 0, LARGEUR, 0);
  or.addColorStop(0, '#9c7424');
  or.addColorStop(0.5, '#f2d27a');
  or.addColorStop(1, '#9c7424');
  g.fillStyle = or;
  g.fillRect(0, 262, LARGEUR, 24);

  // soudures latérales
  for (let y = 0; y < HAUTEUR; y += 3) {
    g.fillStyle = y % 6 ? 'rgba(220,228,240,0.9)' : 'rgba(120,134,158,0.9)';
    g.fillRect(0, y, 14, 3);
    g.fillRect(LARGEUR - 14, y, 14, 3);
  }

  // bord supérieur dentelé
  g.fillStyle = '#c9d2e0';
  g.fillRect(0, 0, LARGEUR, 20);
  g.fillStyle = '#8a97ad';
  for (let x = 0; x < LARGEUR; x += 6) g.fillRect(x, 2, 3, 16);
  // la rangée de pointillés sous la bande scellée
  g.fillStyle = 'rgba(30,44,70,0.7)';
  for (let x = 26; x < LARGEUR - 26; x += 9) {
    g.beginPath();
    g.arc(x, 31, 1.6, 0, Math.PI * 2);
    g.fill();
  }

  // l'étiquette sombre à liseré or, pictogramme sans lettre
  g.fillStyle = '#0d1424';
  rectArrondi(g, 96, 46, 108, 56, 6);
  g.fill();
  g.strokeStyle = '#d9b457';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#e8c55e';
  g.beginPath();
  g.moveTo(150, 54);
  g.lineTo(178, 94);
  g.lineTo(122, 94);
  g.closePath();
  g.fill();
  g.fillStyle = '#0d1424';
  g.beginPath();
  g.arc(150, 80, 7, 0, Math.PI * 2);
  g.fill();
  g.fillRect(148, 68, 4, 6);

  return c;
}
