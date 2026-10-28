/**
 * Les illustrations, servies par **Vite** — décision **D-045**, exécutée le 21/10/2026.
 *
 * **Une seule source** : `design/illustrations/*.webp`, à la racine du dépôt. Vite les
 * embarque dans le graphe de modules (`?url`), les hache, et les émet dans `dist/assets/`
 * — donc elles partent aussi dans le **précache** du service worker (`vite.config.ts`).
 *
 * Ce qui disparaît avec cette page : la **copie servie** dans `public/design/illustrations/`.
 * C'était 1,2 Mo par image, deux fois, et une classe entière de dérive — une image corrigée
 * dans le registre ne changeait rien à l'écran tant qu'on n'avait pas recopié l'autre
 * (l'incident qui a donné le test #120, dont `src/data/art.test.ts` reprend le rôle).
 *
 * Le champ `art` d'une carte reste **un nom de fichier** (`sse-medecin-travail.webp`) : c'est
 * une donnée, pas une URL. La résolution en URL est ici, et nulle part ailleurs.
 */
import { CARD_BY_ID } from '@/data';

const IMAGES = import.meta.glob('../design/illustrations/*.webp', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

/** Nom de fichier (`…​.webp`) → URL servie par Vite. */
export const ART_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGES).map(([chemin, url]) => [chemin.slice(chemin.lastIndexOf('/') + 1), url])
);

/**
 * L'URL d'une illustration, ou `undefined` quand la carte n'en a pas — auquel cas la carte
 * affiche son aplat de faction et son glyphe (`CardView`).
 */
export function artUrl(art: string | undefined): string | undefined {
  return art ? ART_URLS[art] : undefined;
}

/**
 * Le nom de fichier d'illustration d'une carte, **repli de variante compris** (D-139).
 *
 * Une variante secrète ne recopie plus `art` de sa base : tant qu'elle n'a pas sa
 * propre planche, elle n'a rien à afficher. Le repli se fait donc **à la lecture**,
 * pas dans la donnée : `art` déclaré → le sien ; sinon celui de `variantOf` ; et
 * `undefined` quand la base elle-même n'a pas d'image (la carte garde son aplat).
 *
 * Le paramètre est la **forme** d'une carte, pas `Card` : la résolution n'a besoin que
 * de ces deux champs, et un écran peut la demander sur une carte partielle. Le second
 * paramètre est la **base**, résolue dans le catalogue par défaut : c'est le seam qui
 * permet de prouver le cas « la base non plus n'a pas d'image », qu'aucune carte du set
 * n'illustre aujourd'hui.
 */
export function artFileOf(
  card: { art?: string; variantOf?: string },
  base: { art?: string } | undefined = card.variantOf ? CARD_BY_ID.get(card.variantOf) : undefined
): string | undefined {
  if (card.art) return card.art;
  return base?.art;
}
