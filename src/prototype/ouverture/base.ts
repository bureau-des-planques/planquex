/* PROTOTYPE JETABLE (#283) — l'image du sachet, peinte une fois et partagée par les trois rendus.
 * Le modèle est le sachet de la référence de Bastien : argent froissé très clair, reflets pastel,
 * bord dentelé estampé, ligne de pointillés, étiquette jaune à pictogramme. Aucun logo, aucun texte,
 * aucun personnage : ce sont de ses images qu'on ne reprend que des couleurs et des effets (§9). */

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

/** Une bande douce, inclinée : le pli du film, clair ou sombre. */
function bande(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  longueur: number,
  epaisseur: number,
  alpha: number,
  teinte: 'clair' | 'sombre' = 'clair'
): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const d = g.createLinearGradient(0, -epaisseur / 2, 0, epaisseur / 2);
  const c = teinte === 'clair' ? '255,255,255' : '96,110,132';
  d.addColorStop(0, `rgba(${c},0)`);
  d.addColorStop(0.5, `rgba(${c},${alpha})`);
  d.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = d;
  g.fillRect(-longueur / 2, -epaisseur / 2, longueur, epaisseur);
  g.restore();
}

/** Un point d'étincelle à quatre branches, comme sur le film. */
function etincelle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
  g.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
  g.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
  g.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
  g.fill();
  g.restore();
}

/** Un bord soudé dentelé : deux rangées de dents estampées, avec leur ombre. */
function bordDentelé(g: CanvasRenderingContext2D, y: number, hauteur: number): void {
  const d = g.createLinearGradient(0, y, 0, y + hauteur);
  d.addColorStop(0, '#f4f6fa');
  d.addColorStop(0.45, '#b9c3d2');
  d.addColorStop(0.55, '#8e9aad');
  d.addColorStop(1, '#d9e0ea');
  g.fillStyle = d;
  g.fillRect(0, y, LARGEUR, hauteur);
  for (let x = 2; x < LARGEUR; x += 6) {
    g.fillStyle = 'rgba(72,84,102,0.55)';
    g.fillRect(x, y + 2, 3, hauteur - 4);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(x + 3, y + 2, 2, hauteur - 4);
  }
}

/** Un sachet ESD à plat, d'après la référence : argent clair froissé, reflets pastel, étiquette jaune. */
export function creerBase(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LARGEUR * ECHELLE;
  c.height = HAUTEUR * ECHELLE;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  g.scale(ECHELLE, ECHELLE);
  const alea = graine(11);

  // le film : argent, du gris moyen aux blancs francs — c'est le contraste qui fait le métal
  const film = g.createLinearGradient(0, 0, LARGEUR * 0.8, HAUTEUR);
  film.addColorStop(0, '#aab6c6');
  film.addColorStop(0.16, '#e7edf6');
  film.addColorStop(0.34, '#93a1b4');
  film.addColorStop(0.5, '#f2f5fa');
  film.addColorStop(0.68, '#a2aebe');
  film.addColorStop(0.84, '#e2e9f3');
  film.addColorStop(1, '#8e9bad');
  g.fillStyle = film;
  g.fillRect(0, 0, LARGEUR, HAUTEUR);

  // les reflets pastel de l'hologramme : rose, cyan, jaune, lilas, très diffus
  const pastels = ['#ff9ecb', '#7ee6ec', '#ffe873', '#b3a4ff', '#8fd8ff'];
  for (let i = 0; i < 12; i += 1) {
    const x = alea() * LARGEUR;
    const y = 40 + alea() * (HAUTEUR - 80);
    const r = 60 + alea() * 110;
    const halo = g.createRadialGradient(x, y, 0, x, y, r);
    halo.addColorStop(0, pastels[i % pastels.length] + '99');
    halo.addColorStop(1, pastels[i % pastels.length] + '00');
    g.globalAlpha = 0.3;
    g.fillStyle = halo;
    g.fillRect(0, 0, LARGEUR, HAUTEUR);
  }
  g.globalAlpha = 1;

  // le froissé : de grandes bandes claires ET sombres, puis des plis fins
  for (let i = 0; i < 34; i += 1) {
    bande(
      g,
      alea() * LARGEUR,
      alea() * HAUTEUR,
      -1.4 + alea() * 2.8,
      110 + alea() * 240,
      14 + alea() * 52,
      0.5 + alea() * 0.45
    );
  }
  for (let i = 0; i < 26; i += 1) {
    bande(
      g,
      alea() * LARGEUR,
      alea() * HAUTEUR,
      -1.4 + alea() * 2.8,
      70 + alea() * 180,
      8 + alea() * 28,
      0.28 + alea() * 0.3,
      'sombre'
    );
  }
  for (let i = 0; i < 34; i += 1) {
    const x = alea() * LARGEUR;
    const y = alea() * HAUTEUR;
    const l = 26 + alea() * 120;
    const a = -1.3 + alea() * 2.6;
    g.strokeStyle = i % 4 ? 'rgba(84,98,120,0.26)' : 'rgba(255,255,255,0.9)';
    g.lineWidth = 0.6 + alea() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }

  // la pile de cinq cartes, devinée à travers le film : un rectangle à peine plus chaud
  for (let i = 0; i < 5; i += 1) {
    const x = 80 + i * 1.6;
    const y = 152 - i * 1.6;
    const carte = g.createLinearGradient(x, y, x + 142, y + 206);
    carte.addColorStop(0, 'rgba(255,240,196,0.12)');
    carte.addColorStop(1, 'rgba(196,170,120,0.07)');
    g.fillStyle = carte;
    rectArrondi(g, x, y, 142, 206, 7);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1;
    g.stroke();
  }

  // les bords soudés, dentelés
  bordDentelé(g, 0, 20);
  bordDentelé(g, HAUTEUR - 20, 20);

  // les soudures latérales, avec un filet or discret (le repère de la maison)
  for (let y = 20; y < HAUTEUR - 20; y += 3) {
    g.fillStyle = y % 6 ? 'rgba(250,252,255,0.95)' : 'rgba(132,146,168,0.85)';
    g.fillRect(0, y, 13, 3);
    g.fillRect(LARGEUR - 13, y, 13, 3);
  }
  g.fillStyle = 'rgba(198,160,74,0.55)';
  g.fillRect(13, 20, 1.4, HAUTEUR - 40);
  g.fillRect(LARGEUR - 15, 20, 1.4, HAUTEUR - 40);

  // la ligne de pointillés, sous la bande scellée
  g.fillStyle = 'rgba(46,58,78,0.55)';
  for (let x = 26; x < LARGEUR - 26; x += 8) {
    g.beginPath();
    g.arc(x, 30, 1.5, 0, Math.PI * 2);
    g.fill();
  }

  // l'étiquette jaune, pictogramme seul : le texte sera écrit par l'application par-dessus
  g.fillStyle = '#f2c218';
  rectArrondi(g, 92, 44, 116, 46, 4);
  g.fill();
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = 2.4;
  g.stroke();
  // le triangle ESD, tracé au trait, avec la main barrée
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(112, 80);
  g.lineTo(122, 56);
  g.lineTo(132, 80);
  g.closePath();
  g.stroke();
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(114, 61);
  g.lineTo(131, 77);
  g.stroke();
  // les trois lignes du texte, à la place du texte : c'est l'application qui écrira
  g.fillStyle = 'rgba(27,27,27,0.55)';
  g.fillRect(140, 58, 56, 3);
  g.fillRect(140, 66, 48, 3);
  g.fillRect(140, 74, 52, 3);

  // les étincelles du film
  for (let i = 0; i < 14; i += 1) {
    etincelle(g, alea() * LARGEUR, 24 + alea() * (HAUTEUR - 48), 3 + alea() * 7);
  }

  return c;
}
