#!/usr/bin/env node
/**
 * La copie serveur du tirage d'Arrivage — #651, D-179.
 *
 * **Pourquoi une copie.** L'Edge Function `ouvrir-arrivage` doit tirer l'Arrivage avec la
 * même règle que le client : `src/game/pack.ts` et `src/game/rng.ts`. Or **Supabase déploie
 * le dossier de la fonction, pas le dépôt** : un import `../src/game/pack.ts` marcherait en
 * local et casserait au déploiement. La CLI `supabase` n'étant pas installée sur la machine
 * de l'auteur, cette limite ne peut pas être éprouvée ici — on ne la suppose pas, on écrit
 * une copie **générée** : un fichier autonome, un script, une garde
 * (`scripts/gardes/arrivage-serveur.test.ts`), le motif du dépôt pour `plan-dev.ts` et
 * `versions.ts`.
 *
 * **Ce que la copie porte** : le catalogue **réduit à ce que le tirage lit** (`id`, `rarity`),
 * la composition (`PACK_COMPOSITION`), la taille (`PACK_SIZE`) et le générateur seedé. Pas un
 * nom, pas un texte, pas une flavour.
 *
 * **Le catalogue perd son nom** : la copie ne garde pas les noms de cartes. Elle reproduit
 * `ALL_CARDS` dans son ordre, car l'ordre décide du tirage : un catalogue trié autrement
 * changerait les cartes d'une même graine.
 *
 * Usage :
 *   npm run arrivage:serveur            réécrit le fichier généré
 *   npm run arrivage:serveur -- --verifie   n'écrit rien, sort 1 si la copie a divergé
 *
 * Le module exporte `rendreFichier` et `divergences` : la garde les confronte à un cas
 * fautif, parce qu'un contrôle qui ne peut pas échouer ne garde rien (`AGENTS.md` §6).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const CIBLE = join(RACINE, 'supabase', 'functions', 'ouvrir-arrivage', 'arrivage-genere.ts');

/** Une chaîne entre apostrophes, comme le reste du dépôt (identifiants sans apostrophe). */
const q = (texte) => `'${String(texte).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * Charge `src/data/index.ts` et `src/game/pack.ts` sous Node.
 *
 * Node sait retirer les types d'un `.ts` (22.23 le fait sans drapeau), mais refuse les
 * imports **sans extension** (`./types`) et ne connaît pas l'alias `@/` que Vite pose.
 * Deux crochets, montés seulement quand la commande en a besoin, suffisent : le script
 * réutilise la **vraie** source au lieu d'en recopier la lecture.
 */
async function chargerSource() {
  registerHooks({
    resolve(specifier, contexte, suivant) {
      let cible = specifier;
      if (cible.startsWith('@/')) {
        cible = pathToFileURL(join(RACINE, 'src', cible.slice(2))).href;
      }
      try {
        return suivant(cible, contexte);
      } catch (erreur) {
        for (const extension of ['.ts', '.tsx', '/index.ts']) {
          try {
            return suivant(cible + extension, contexte);
          } catch {
            // On essaie l'extension suivante ; la dernière erreur est celle qu'on rend.
          }
        }
        throw erreur;
      }
    }
  });

  const donnees = await import(pathToFileURL(join(RACINE, 'src', 'data', 'index.ts')).href);
  const pack = await import(pathToFileURL(join(RACINE, 'src', 'game', 'pack.ts')).href);

  return {
    taille: pack.PACK_SIZE,
    composition: pack.PACK_COMPOSITION,
    cartes: donnees.ALL_CARDS.map((carte) => ({ id: carte.id, rarity: carte.rarity }))
  };
}

/** La copie telle que le script l'écrirait — une chaîne prête à comparer et à écrire. */
export function rendreFichier(source) {
  const { taille, composition, cartes } = source;

  const catalogue = cartes.map((carte) => `  { id: ${q(carte.id)}, rarity: ${q(carte.rarity)} }`).join(',\n');

  const slots = composition
    .map((slot) => `  { count: ${slot.count}, rarities: [${slot.rarities.map(q).join(', ')}] }`)
    .join(',\n');

  return `/**
 * **Fichier généré : ne pas éditer à la main.**
 *
 * La copie serveur de l'Arrivage (#651, D-179) : le catalogue réduit à ce que le tirage lit
 * (\`id\`, \`rarity\`), la composition de \`src/game/pack.ts\` et le générateur seedé de
 * \`src/game/rng.ts\`. Elle est écrite par \`npm run arrivage:serveur\`
 * (\`scripts/generateurs/arrivage-serveur.mjs\`).
 *
 * **Pourquoi une copie et non un import** : Supabase déploie le dossier de la fonction, pas
 * le dépôt — un chemin relatif vers \`src/\` casserait au déploiement. La garde
 * \`scripts/gardes/arrivage-serveur.test.ts\` compare cette copie à sa source, graine par
 * graine et carte par carte : une composition changée d'un côté seulement la fait tomber.
 *
 * L'ordre de \`CARDS\` est celui de \`ALL_CARDS\` : il décide du tirage, ne pas le trier.
 */

/** Une carte, réduite à ce que le tirage lit. Pas de nom, pas de texte. */
export interface Carte {
  id: string;
  rarity: string;
}

/** Une ligne de composition : \`count\` cartes tirées dans les raretés données. */
export interface PackSlot {
  count: number;
  rarities: readonly string[];
}

/** Le catalogue, dans l'ordre de \`ALL_CARDS\`. */
export const CARDS: readonly Carte[] = [
${catalogue}
];

/** Nombre de cartes d'un Arrivage. */
export const PACK_SIZE = ${taille};

/** Composition de l'Arrivage, du plus courant au plus rare. */
export const PACK_COMPOSITION: readonly PackSlot[] = [
${slots}
];

/** État du générateur : un entier 32 bits non signé. */
export type RngState = number;

/** Tout ce qui porte un état de générateur. */
export interface RngHolder {
  rng: RngState;
}

/** État initial pour une graine quelconque — copie de \`seedRng\` (\`src/game/rng.ts\`). */
export function seedRng(seed: number): RngState {
  const normalized = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  return (normalized ^ 0x9e3779b9) >>> 0;
}

/** Un pas de mulberry32 — copie de \`stepRng\` (\`src/game/rng.ts\`). */
function stepRng(state: RngState): { value: number; state: RngState } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** Consomme un tirage dans \`[0, 1)\` — copie de \`drawRandom\` (\`src/game/rng.ts\`). */
export function drawRandom(holder: RngHolder): number {
  const step = stepRng(holder.rng);
  holder.rng = step.state;
  return step.value;
}

/** Les cartes dont la rareté est dans \`rarities\`. */
function poolOf(rarities: readonly string[]): Carte[] {
  return CARDS.filter((card) => rarities.includes(card.rarity));
}

/** Tire une carte du vivier, en avançant le générateur. */
function pick(pool: Carte[], holder: RngHolder): Carte {
  return pool[Math.floor(drawRandom(holder) * pool.length)] ?? CARDS[0];
}

/** Ouvre un Arrivage — copie de \`openPackCards\` (\`src/game/pack.ts\`). */
export function openPackCards(holder: RngHolder): Carte[] {
  return PACK_COMPOSITION.flatMap((slot) => {
    const pool = poolOf(slot.rarities);
    return Array.from({ length: slot.count }, () => pick(pool, holder));
  });
}
`;
}

/**
 * Ce qui diverge entre la source et la copie — une liste vide quand tout est d'accord.
 * Comparaison **sémantique**, jamais textuelle : Prettier reformate la copie sans que la
 * règle change, et c'est la règle qu'on garde, pas l'indentation.
 */
export function divergences(source, copie) {
  const ecarts = [];
  if (copie.taille !== source.taille) {
    ecarts.push(`PACK_SIZE : source ${source.taille}, copie ${copie.taille}`);
  }
  if (JSON.stringify(copie.composition) !== JSON.stringify(source.composition)) {
    ecarts.push(
      `PACK_COMPOSITION : source ${JSON.stringify(source.composition)}, copie ${JSON.stringify(copie.composition)}`
    );
  }
  if (copie.cartes.length !== source.cartes.length) {
    ecarts.push(`CARDS : source ${source.cartes.length} cartes, copie ${copie.cartes.length}`);
  }
  const longueur = Math.min(copie.cartes.length, source.cartes.length);
  for (let i = 0; i < longueur; i += 1) {
    const a = source.cartes[i];
    const b = copie.cartes[i];
    if (a.id !== b.id || a.rarity !== b.rarity) {
      ecarts.push(`CARDS[${i}] : source ${a.id}/${a.rarity}, copie ${b.id}/${b.rarity}`);
      break;
    }
  }
  return ecarts;
}

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const estEntree = process.argv[1] ? join(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (estEntree) {
  const option = process.argv.slice(1).find((arg) => arg.startsWith('--'));
  if (option && option !== '--verifie') {
    stop(`option inconnue : ${option} (attendu : --verifie)`);
  }

  const source = await chargerSource();
  const contenu = rendreFichier(source);

  if (option === '--verifie') {
    let actuel;
    try {
      actuel = readFileSync(CIBLE, 'utf8');
    } catch {
      stop('arrivage-genere.ts est absent — lance `npm run arrivage:serveur`.');
    }
    const copie = await import(pathToFileURL(CIBLE).href);
    const ecarts = divergences(source, {
      taille: copie.PACK_SIZE,
      composition: copie.PACK_COMPOSITION,
      cartes: copie.CARDS
    });
    if (ecarts.length > 0) stop(`la copie serveur a divergé :\n  ${ecarts.join('\n  ')}`);
    console.log(`✔ la copie serveur est à jour (${source.cartes.length} cartes, ${source.composition.length} lignes)`);
  } else {
    writeFileSync(CIBLE, contenu);
    console.log(`✔ arrivage-genere.ts écrit — ${source.cartes.length} cartes, ${source.composition.length} lignes`);
  }
}
