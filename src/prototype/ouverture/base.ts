/* PROTOTYPE JETABLE (#283) — le sachet vient d'une **photo** (l'image A validée), pas d'un dessin.
 * Le shader ne peint plus le film : il le déforme. C'est ce qui manquait — un film métallisé
 * photographié a des facettes franches qu'un dégradé ne reproduit pas. */

export const LARGEUR = 315;
export const HAUTEUR = 560;

/** La photo de la pochette, telle que produite par gflow (image A). */
export const BASE_URL = new URL('./sachet-reel.jpg', import.meta.url).href;

/** La photo, posée sur un canevas 2× pour que la texture reste nette une fois déformée. */
export async function preparerTexture(): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = BASE_URL;
  await image.decode();
  const c = document.createElement('canvas');
  c.width = LARGEUR * 2;
  c.height = HAUTEUR * 2;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  g.drawImage(image, 0, 0, c.width, c.height);
  return c;
}
