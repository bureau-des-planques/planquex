#!/usr/bin/env node
/**
 * La taille des paquets — **mesurée, pas espérée** (#480).
 *
 * ## Pourquoi
 *
 * Jusqu'ici, la seule chose qui disait qu'un paquet avait grossi était un **avertissement de
 * Vite** dans les journaux de déploiement — et il n'empêchait rien. Une importation ajoutée sans
 * y penser remet un mégaoctet dans le paquet principal, et personne ne le voit avant qu'un
 * testeur se plaigne d'un premier écran lent.
 *
 * Mesure de référence, **29/10/2026**, sur ce dépôt :
 *
 * | état                                            | principal          | plus gros paquet        |
 * |-------------------------------------------------|--------------------|-------------------------|
 * | avant (un seul morceau)                         | **1 032 kB** (313 kB gzip) | le principal   |
 * | après #478 (écrans à la demande, Accueil en dur) | **727 kB** (221 kB gzip)   | le principal   |
 * | après #479 (paquets par famille)                | **290 kB** (78 kB gzip)    | `react`, 219 kB |
 *
 * Le ticket #480 écrit « 1 026 kB avant » : c'est la même mesure sur une autre copie du dépôt
 * (celui-ci donne 1 032 kB sur `d9c5ba3`), et l'écart de 6 kB ne change aucune conclusion.
 *
 * Le ticket #479 annonce 202 kB : c'est la variante « Accueil paresseux », **écartée** par #478
 * (la porte d'entrée n'attend aucun morceau, et son repli ne s'affiche pas). Les 88 kB d'écart
 * sont le code de l'Accueil et de sa scène d'Arrivage, restés dans l'entrée.
 *
 * ## Les deux seuils, et leur raison
 *
 * - **500 000 octets par paquet** : c'est le chiffre de l'avertissement de Vite
 *   (`chunkSizeWarningLimit`, 500 kB). Vite compte en **kB décimaux** — `290 251` octets
 *   s'affichent « 290,25 kB » —, le seuil est donc écrit ici en octets, sans ambiguïté. Un
 *   avertissement qui n'empêche rien devient un échec.
 * - **le cliquet du paquet principal** : la valeur mesurée à la fusion de #480, écrite une fois
 *   ci-dessous avec sa date. Il ne monte pas sans une décision écrite ; il descend avec le code
 *   qui le permet. C'est le même geste que les cliquets de captures et de compteurs.
 *
 * ## Le geste de relevé, et pourquoi il est une commande (#581)
 *
 * Une vague de PR parallèles dépasse toujours le cliquet : le 02/11/2026 il a fallu le relever
 * **trois fois à la main** (#553 → #566 → #529), avec deux rebascules. Le geste est mécanique —
 * mesurer, réécrire le nombre, ajouter une ligne datée — et se fait mal à la main. La commande
 * le fait, et **exige sa raison** :
 *
 * ```bash
 * npm run taille:cliquet -- --raison "le diagnostic de configuration cassée (#529)"
 * ```
 *
 * Elle refuse sans `--raison`, refuse un delta de plus de **5 000 octets** sans `--assume` (au-delà,
 * ce n'est plus une négociation de cliquet, c'est une régression à regarder), et **n'écrit rien**
 * quand le paquet tient déjà. Les deux refus se décident dans `deciderReleve`, une fonction pure
 * que le test confronte à ses cas fautifs.
 *
 * ## Usage
 *
 * ```bash
 * npm run mesure:paquets                # construit si dist/ est périmé, mesure, échoue au-delà
 * npm run mesure:paquets -- --sans-build  # mesure dist/ tel quel (ce que fait la CI après son build)
 * npm run taille:cliquet -- --raison "…"   # relève le cliquet, avec sa date et sa raison
 * npm run taille:cliquet -- --raison "…" --assume   # delta de plus de 5 000 octets, assumé
 * node scripts/ci/taille-paquets.mjs --plan   # les seuils et l'état de dist/, sans rien construire
 * ```
 *
 * La CI l'appelle **juste après `npm run build`** : `dist/` a été produit dans le même job, donc
 * la garde ne refait pas un build pour rien (elle ne reconstruit que si une source est plus
 * récente que `dist/index.html`).
 *
 * Garde du contrôle : `scripts/ci/taille-paquets.test.ts` le confronte à des tailles fabriquées
 * — juste sous le seuil (passe), juste au-dessus (échoue) —, à un dossier de paquets fabriqués,
 * et aux deux refus du relevé (sans raison, delta de plus de 5 000 octets) sur la fonction pure
 * `deciderReleve`, sans lancer le shell.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** La racine du dépôt, quel que soit le dossier de travail. */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(RACINE, 'dist');
const ASSETS = join(DIST, 'assets');

/**
 * **Le seuil de Vite, en octets** : 500 kB décimaux, exactement le chiffre de l'avertissement
 * `Some chunks are larger than 500 kB after minification`.
 */
export const SEUIL_PAQUET = 500_000;

/**
 * **Le cliquet du paquet principal**, mesuré le 29/10/2026 à la fusion de #480 : 290 251 octets,
 * soit « 290,25 kB » au rapport de Vite (`index-*.js`, 78,25 kB gzip). Il ne monte pas sans une
 * décision écrite dans le commit qui le relève ; il descend avec le code qui le permet.
 *
 * **Relevé de 69 octets le 30/10/2026 (#527, D-156)** : le drapeau d'anonymat porté par la
 * session et le refus d'un compte non approuvé. Le code a été resserré avant de relever
 * (prédicat en ligne, lecture du compteur conditionnée) ; il reste 290 320 octets.
 *
 * **Relevé encore de 462 octets le 30/10/2026** (290 782 octets) (décision de Bastien, #525) : le glyphe de faction
 * dans la pastille de café (`CafePips`, qui vit dans le paquet principal) et le choix de son encre.
 * Un café ne se lisait que par sa couleur (le critère WCAG sur la couleur seule) ; la variante en
 * CSS seul (couleur relative OKLCH) a été écartée pour ne pas dépendre d'une syntaxe récente.
 *
 * **Relevé de 1 octet le 30/10/2026 (#534)** : la Collection devient une vitrine et la fiche
 * reçoit l'état du Deck. Ce code vit dans des morceaux **paresseux** ; le principal gagne
 * **1 octet** parce que la carte d'exports du morceau partagé `ui` change d'ordre quand les
 * modules changent. Le code a été resserré avant de relever (classe du slot en `&&`, motif du
 * refus écrit dans la fiche) ; il reste 290 783 octets.
 *
 * **Relevé de 27 octets le 30/10/2026** (290 810 octets) (critique du 30/10/2026, P1 de la
 * page Collection) : le **nom lu** d'une carte (`label` de `CardView`, calculé par le slot —
 * possession, Deck) et les **jetons de filtres** de la Collection. Les deux vivent dans le
 * paquet principal, avec le reste de la coquille.
 *
 * **Relevé de 115 octets le 30/10/2026** (290 925 octets) (constat de Bastien : la bulle
 * native recouvrait le coût au survol) : `CafePips` apprend `sansTitre`, et `CardView` cesse
 * de poser `title` sur la carte compacte (emblème, rareté, faction, coût, Rotation). La bulle
 * du navigateur est partie ; la fiche garde ses libellés.
 *
 * **Relevé de 18 octets le 30/10/2026** (290 943 octets) (D-159, première connexion) : la page
 * de connexion affiche le lien du serveur des testeurs, donc son morceau **dépend** d'un
 * morceau de plus (`InvitationTesteurs`), et la carte de dépendances du principal gagne
 * `,18` — 18 octets, aucun code nouveau. Le reste a été sorti du principal avant de relever :
 * la récupération de mot de passe vit dans `src/lib/recuperation.ts` (morceau paresseux), et
 * la coquille nue des écrans publics est une **classe** (`.page--nue`), pas une route
 * d'enveloppe — 1,4 kB puis 200 octets rendus au paquet avant ce dernier écart.
 * **Baissé de 24 364 octets le 01/11/2026** (266 579 octets) (release 0.1.16, choix de Bastien
 * après la CI rouge) : `Home` est la **porte d'entrée**, jamais paresseuse, et elle importait
 * `src/data/versions.ts` pour n'afficher que le **titre** et la **date** de la dernière release.
 * Les ~19 kB de texte des notes — 159 points, 16 versions — entraient donc dans le paquet
 * principal, et chaque publication le poussait d'environ 1 kB. Le générateur
 * (`scripts/generateurs/notes-versions.mjs`) écrit maintenant **deux** fichiers :
 * `src/data/notes-resume.ts` (version, date, titre, drapeau) pour `Home`, et `versions.ts`
 * (l'historique complet) que seul le morceau **paresseux** de `/feuille-de-route` lit. Rien
 * n'a été retiré à l'écran : le principal perd 25,4 kB, gzip 78,3 → 69,5 kB.
 *
 * **Relevé de 66 octets le 01/11/2026** (266 645 octets) (revue de performance de l'ouverture,
 * #565) : l'inclinaison du sachet pose `--mx`/`--my` sur le **reflet**, son seul consommateur,
 * au lieu du sachet, et `@property` cesse de les faire hériter. Mesuré : 0,811 s → 0,276 s de
 * recalcul de style sur 2,5 s de scène (−66 %), 1,423 s → 0,836 s de tâche (−41 %). Le code a
 * été resserré avant de relever (une boucle sur les reflets, sans `querySelectorAll` ni tableau) ;
 * il reste 266 645 octets.
 *
 * **Relevé de 456 octets le 01/11/2026** (267 101 octets) (critique d'interface de l'ouverture,
 * #567, D-169) : le dos des cartes ne part plus en miroir, la carte étalée prend le gabarit
 * compact sous 420 px et son premier tap ouvre la fiche, la pastille « Nouvelle » se pose sur
 * l'illustration, et un dialogue modal rend `#root` inerte (l'attribut `inert` qui manquait).
 * Le code a été resserré avant de relever — un `useMemo` retiré, la largeur lue directement —
 * et il reste 267 101 octets.
 *
 * **Relevé de 431 octets le 01/11/2026** (267 532 octets) (seconde passe de la critique de
 * l'ouverture, #570, D-170) : le seuil de lecture se prend sur l'échelle **rendue** de la carte,
 * une carte n'est plus un bouton dans un bouton (`CardView calme`), la déchirure reste acquise
 * sous le seuil, la fiche gagne une bande de défilement et une carte plus petite en portrait, et
 * le tirage survit à la fermeture (« Revoir le dernier Arrivage »). Il reste 267 532 octets.
 *
 * **Relevé de 156 octets le 02/11/2026** (267 688 octets) (#553) : l'accueil dit qu'une partie
 * attend. Le tour ne se lit pas dans l'état persisté (`PartieSauvegardee` ne range que la
 * graine, les Decks, les cafés et le journal) : il faut **rejouer** la partie, donc importer
 * `@/store/partie` aussi dans `Home.tsx`, où il n'entrait pas. Le module était déjà servi au
 * combat ; c'est le seul ajout, et il n'y a rien à resserrer dans une ligne d'état. Il reste
 * 267 688 octets.
 *
 * **Relevé de 673 octets le 02/11/2026** (268 361 octets) (#566) : la déchirure de l'ouverture
 * ne re-rend plus la scène à chaque `pointermove` (0 rendu pour 40 mouvements, mesuré au
 * `Profiler`) et `--p`/`--sens` ne s'héritent plus dans tout le SVG du sachet. Le correctif
 * ajoute ce qu'il faut pour écrire le style directement — refs des trois consommateurs, boucle
 * d'affichage, `@property` — et retire le passage par l'état. Il reste 268 361 octets.
 *
 * **Relevé de 1 486 octets le 02/11/2026** (269 847 octets) — le diagnostic de configuration cassée et son panneau de refus (#529)
 *
 * **Relevé de 1 137 octets le 02/11/2026** (270 984 octets) — les 8 planches Intérim et Syndicat entrent dans le paquet (#499)
 *
 * **Relevé de 1 514 octets le 03/11/2026** (272 498 octets) — l'Arrivage passe par le serveur (D-179) : couche réseau, erreurs typées, état hors ligne et migration v14 vers v15 entrent dans le paquet principal (+1,5 kB mesuré)
 *
 * **Relevé de 2 103 octets le 03/11/2026** (274 601 octets) — la Collection devient un cache du serveur (D-179, #493) : lecture PostgREST, synchronisation du store et avis hors ligne daté entrent dans le paquet principal (+2,1 kB mesuré)
 *
 * **Relevé de 3 763 octets le 03/11/2026** (278 364 octets) — la synchro du Deck entre dans le paquet principal (D-179, #491) : outbox persistée, traducteur de gestes, envoi et état d'échec (+3,8 kB mesuré) — troisième tranche de synchro du jour
 *
 * **Relevé de 1 793 octets le 03/11/2026** (280 157 octets) — l'import unique du Deck local entre dans le principal (+1,8 kB, #492) — quatrième relève du jour ; #658 doit mesurer et décider du découpage de la synchro
 *
 * **Relevé de 204 octets le 03/11/2026** (280 361 octets) — le drapeau du lien de récupération est lu avant createRoot (#654) : un petit module partagé entre l'entrée et Connexion entre dans le paquet principal
 *
 * **Relevé de 4 octets le 04/11/2026** (280 365 octets) — le chemin REST des fonctions du Deck gagne « /rpc/ » : PostgREST lit sinon le nom comme une table et répond 404 (#698)
 */
export const PLAFOND_PRINCIPAL = 280_365;

/**
 * **Le delta qu'un relevé accepte sans `--assume`** : 5 000 octets (5 kB décimaux, l'unité de
 * Vite). Au-delà, ce n'est plus une négociation de cliquet, c'est une régression à regarder
 * avant de l'inscrire dans le nombre.
 */
export const DELTA_MAX_SANS_ASSUME = 5_000;

/** Un entier à la française : « 290 782 » (les espaces des commentaires du cliquet). */
function espaces(octets) {
  return String(octets).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Un entier à la façon d'un littéral TypeScript : « 290_782 ». */
function souligne(octets) {
  return String(octets).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

/** Une date au format `JJ/MM/AAAA`, celui des relevés déjà écrits dans le commentaire. */
export function dateCourte(date) {
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()}`;
}

/**
 * La ligne datée qu'un relevé ajoute au commentaire du cliquet, dans la forme déjà employée :
 * `**Relevé de <delta> octets le JJ/MM/AAAA** (<nouveau total> octets) — <raison>.`
 */
export function ligneReleve({ delta, octets, raison, date }) {
  return `**Relevé de ${espaces(delta)} octets le ${dateCourte(date)}** (${espaces(octets)} octets) — ${raison}`;
}

/**
 * **Ce que le relevé doit faire** — fonction pure, c'est elle que le test confronte aux refus.
 *
 * - sans raison, elle refuse et dit la commande à taper ;
 * - quand le paquet tient déjà sous le cliquet, elle ne fait rien (« rien à relever ») ;
 * - au-delà de `DELTA_MAX_SANS_ASSUME` sans `assume`, elle refuse le relevé ;
 * - sinon elle donne le delta et la raison nettoyée.
 */
export function deciderReleve({ octets, plafond = PLAFOND_PRINCIPAL, raison, assume = false }) {
  const motif = String(raison ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (motif === '') {
    return {
      releve: false,
      delta: 0,
      octets,
      raison: motif,
      refus:
        'il manque la raison : `npm run taille:cliquet -- --raison "<pourquoi ce relevé>"` — ' +
        'un cliquet ne monte pas sans dire pourquoi.'
    };
  }
  if (octets <= plafond) {
    return { releve: false, delta: 0, octets, raison: motif };
  }
  const delta = octets - plafond;
  if (delta > DELTA_MAX_SANS_ASSUME && !assume) {
    return {
      releve: false,
      delta,
      octets,
      raison: motif,
      refus:
        `le paquet principal grossit de ${espaces(delta)} octets, au-delà des ` +
        `${espaces(DELTA_MAX_SANS_ASSUME)} tolérés sans examen : regarder d'où vient la régression, ` +
        'puis relancer avec `--assume` si elle est voulue.'
    };
  }
  return { releve: true, delta, octets, raison: motif };
}

/**
 * **La source réécrite d'un relevé** — fonction pure, sur le texte du fichier, donc testable
 * sans toucher au dépôt : le nombre de `PLAFOND_PRINCIPAL` prend la valeur mesurée, et la ligne
 * datée s'ajoute à la fin du commentaire qui le précède, juste avant sa fermeture.
 */
export function releveDansSource(source, { octets, delta, raison, date }) {
  const marque = /export const PLAFOND_PRINCIPAL = \d[\d_]*;/g;
  const trouves = source.match(marque) ?? [];
  if (trouves.length !== 1) {
    throw new Error(
      `« export const PLAFOND_PRINCIPAL = …; » trouvé ${trouves.length} fois : le relevé ne sait pas où écrire`
    );
  }
  const index = source.indexOf(trouves[0]);
  const fermeture = source.lastIndexOf(' */', index);
  if (fermeture === -1) {
    throw new Error('le commentaire qui précède PLAFOND_PRINCIPAL est introuvable : le relevé ne sait pas où écrire');
  }
  const ligne = ligneReleve({ delta, octets, raison, date });
  const avecNombre =
    source.slice(0, index) +
    `export const PLAFOND_PRINCIPAL = ${souligne(octets)};` +
    source.slice(index + trouves[0].length);
  return avecNombre.slice(0, fermeture) + ` *\n * ${ligne}\n` + avecNombre.slice(fermeture);
}

/** Les fichiers du dépôt qui entrent dans le build : une source plus récente périme `dist/`. */
const SOURCES = ['src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json'];

/** Une taille lisible, dans l'unité de Vite (kB décimaux) : « 290,3 kB ». */
export function enKb(octets) {
  return `${(octets / 1000).toFixed(1).replace('.', ',')} kB`;
}

/** Les paquets d'un dossier : leur nom, leur taille minifiée, leur taille gzip. */
export function paquetsDe(dossier = ASSETS) {
  return readdirSync(dossier)
    .filter((nom) => nom.endsWith('.js'))
    .map((nom) => {
      const octets = statSync(join(dossier, nom)).size;
      return { nom, octets, gzip: gzipSync(readFileSync(join(dossier, nom))).length };
    })
    .sort((a, b) => b.octets - a.octets);
}

/**
 * Ce qu'il faut savoir d'une liste de paquets : le **plus gros**, le **principal** (le morceau
 * d'entrée, `index-<hash>.js`) et la liste triée. `principal` vaut `null` quand il n'y en a pas
 * exactement un : la mesure ne sait alors pas lequel est l'entrée, et le dit.
 */
export function mesurer(paquets) {
  const tries = [...paquets].sort((a, b) => b.octets - a.octets);
  const principaux = tries.filter((paquet) => /^index-.+\.js$/.test(paquet.nom));
  return {
    paquets: tries,
    total: tries.length,
    plusGros: tries[0] ?? null,
    principaux,
    principal: principaux.length === 1 ? principaux[0] : null
  };
}

/**
 * Les échecs d'une mesure, vide si tout passe. Fonction **pure** : c'est elle que le test
 * confronte à des tailles fabriquées, sans construire quoi que ce soit.
 */
export function verdict(mesures, { seuil = SEUIL_PAQUET, plafond = PLAFOND_PRINCIPAL } = {}) {
  if (mesures.total === 0) {
    return ['aucun paquet mesuré : `dist/assets/` ne porte aucun `.js` (le build n’a rien produit)'];
  }
  const echecs = [];
  if (mesures.principaux.length !== 1) {
    echecs.push(`${mesures.principaux.length} paquet(s) « index-*.js » : la mesure ne sait pas lequel est l’entrée`);
  }
  for (const paquet of mesures.paquets) {
    if (paquet.octets > seuil) {
      echecs.push(`${paquet.nom} : ${enKb(paquet.octets)} — au-dessus du seuil de ${enKb(seuil)}`);
    }
  }
  if (mesures.principal && mesures.principal.octets > plafond) {
    echecs.push(
      `le paquet principal ${mesures.principal.nom} : ${enKb(mesures.principal.octets)} — ` +
        `au-dessus du cliquet de ${enKb(plafond)} (ses relevés datés vivent dans le commentaire de ` +
        '`PLAFOND_PRINCIPAL`) : descendre le code, ou le relever par ' +
        '`npm run taille:cliquet -- --raison "…"`'
    );
  }
  return echecs;
}

/** Le plus grand `mtime` (en ms) d'une liste de chemins, dossier ou fichier, récursivement. */
export function plusRecent(chemins) {
  let recent = 0;
  for (const chemin of chemins) {
    if (!existsSync(chemin)) continue;
    const stats = statSync(chemin);
    if (stats.isDirectory()) {
      recent = Math.max(
        recent,
        plusRecent(
          readdirSync(chemin)
            .filter((nom) => nom !== 'node_modules')
            .map((nom) => join(chemin, nom))
        )
      );
    } else {
      recent = Math.max(recent, stats.mtimeMs);
    }
  }
  return recent;
}

/** Vrai quand `dist/` n'existe pas, ou qu'une source est plus récente que le build. */
export function estPerime({ dist = DIST, racine = RACINE, sources = SOURCES } = {}) {
  const index = join(dist, 'index.html');
  if (!existsSync(index)) return true;
  return plusRecent(sources.map((source) => join(racine, source))) > statSync(index).mtimeMs;
}

/** Construit la production, en héritant de la sortie : un build muet ne dirait pas pourquoi il casse. */
function construire(racine) {
  console.log('dist/ est périmé (ou absent) : npm run build');
  execFileSync('npm', ['run', 'build'], { cwd: racine, stdio: 'inherit' });
}

/** Les seuils, leur raison et l'état de `dist/` — sans construire ni mesurer. */
export function plan() {
  const etat = existsSync(join(DIST, 'index.html')) ? (estPerime() ? 'périmé' : 'à jour') : 'absent';
  return [
    'seuil par paquet     : ' + `${enKb(SEUIL_PAQUET)} (l’avertissement de Vite, en échec)`,
    'cliquet du principal : ' +
      `${enKb(PLAFOND_PRINCIPAL)} (ses relevés datés vivent dans le commentaire de PLAFOND_PRINCIPAL)`,
    'référence 29/10/2026 : ' + 'principal 1 032 kB avant, 290,3 kB après #479 ; plus gros paquet 219 kB',
    'dist/                : ' + etat
  ].join('\n');
}

/** La valeur d'une option `--nom valeur` ou `--nom=valeur` ; `undefined` si elle manque. */
function option(argv, nom) {
  const avecEgal = argv.find((arg) => arg.startsWith(`--${nom}=`));
  if (avecEgal !== undefined) return avecEgal.slice(nom.length + 3);
  const index = argv.indexOf(`--${nom}`);
  const valeur = index === -1 ? undefined : argv[index + 1];
  return valeur === undefined || valeur.startsWith('--') ? undefined : valeur;
}

/**
 * Construit `dist/` s'il est absent ou périmé, comme la mesure le fait déjà. Rend `false` quand
 * `--sans-build` interdit une construction qui serait nécessaire (l'appelant sort en 2).
 */
function distPret(sansBuild) {
  if (!existsSync(ASSETS)) {
    if (sansBuild) {
      console.error('dist/assets/ est absent et --sans-build interdit de construire : rien à mesurer.');
      return false;
    }
    construire(RACINE);
  } else if (!sansBuild && estPerime()) {
    construire(RACINE);
  }
  return true;
}

/**
 * **Le relevé du cliquet (#581)** : mesure le principal, et quand il dépasse le cliquet réécrit
 * `PLAFOND_PRINCIPAL` avec sa valeur, en laissant la ligne datée de la raison dans le
 * commentaire. Ne touche à rien quand le paquet tient déjà. Les refus viennent de
 * `deciderReleve`, donc de la même fonction pure que le test.
 */
function relever(argv) {
  const raison = option(argv, 'raison');
  const assume = argv.includes('--assume');
  // La raison se vérifie **avant** de construire : un refus ne coûte pas un build.
  const prealable = deciderReleve({ octets: PLAFOND_PRINCIPAL, raison });
  if (prealable.refus) {
    console.error(prealable.refus);
    return 2;
  }
  if (!distPret(argv.includes('--sans-build'))) return 2;

  const mesures = mesurer(paquetsDe());
  if (!mesures.principal) {
    const echecs = verdict(mesures);
    console.error('relevé impossible : ' + (echecs.join(' ; ') || 'le paquet principal n’est pas identifiable'));
    return 2;
  }
  const octets = mesures.principal.octets;
  const decision = deciderReleve({ octets, raison, assume });
  if (!decision.releve) {
    if (decision.refus) {
      console.error(decision.refus);
      return 2;
    }
    console.log(
      `Rien à relever : ${mesures.principal.nom} fait ${enKb(octets)}, ` +
        `sous le cliquet de ${enKb(PLAFOND_PRINCIPAL)}.`
    );
    return 0;
  }

  const date = new Date();
  const fichier = fileURLToPath(import.meta.url);
  writeFileSync(
    fichier,
    releveDansSource(readFileSync(fichier, 'utf8'), { octets, delta: decision.delta, raison: decision.raison, date })
  );
  console.log(`Cliquet relevé : ${enKb(PLAFOND_PRINCIPAL)} → ${enKb(octets)} (+${decision.delta} octets).`);
  console.log(`  ${ligneReleve({ delta: decision.delta, octets, raison: decision.raison, date })}`);
  return 0;
}

function principal(argv) {
  const sansBuild = argv.includes('--sans-build');
  if (argv.includes('--plan')) {
    console.log(plan());
    return 0;
  }
  if (!distPret(sansBuild)) return 2;

  const mesures = mesurer(paquetsDe());
  const echecs = verdict(mesures);
  const principal = mesures.principal;

  console.log(`\nPaquets mesurés — dist/assets, ${mesures.total} morceaux :`);
  console.log(
    `  principal   ${principal ? principal.nom.padEnd(28) : '(introuvable)'.padEnd(28)} ` +
      `${principal ? enKb(principal.octets) : '—'.padStart(10)}   gzip ${principal ? enKb(principal.gzip) : '—'}   ` +
      `cliquet ${enKb(PLAFOND_PRINCIPAL)}`
  );
  console.log(
    `  plus gros   ${mesures.plusGros.nom.padEnd(28)} ${enKb(mesures.plusGros.octets)}   ` +
      `gzip ${enKb(mesures.plusGros.gzip)}   seuil   ${enKb(SEUIL_PAQUET)}`
  );

  if (echecs.length > 0) {
    console.error('\nCe n’est pas une taille acceptable :');
    for (const echec of echecs) console.error(`  - ${echec}`);
    return 1;
  }

  console.log(`\n✔ Aucun paquet au-dessus de ${enKb(SEUIL_PAQUET)}, et le principal tient son cliquet.`);
  return 0;
}

// Le module est importé par son test : le CLI ne part que lancé directement.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  process.exitCode = argv.includes('--cliquet') ? relever(argv) : principal(argv);
}
