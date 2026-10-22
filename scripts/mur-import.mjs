#!/usr/bin/env node
/**
 * Importer les réponses du formulaire de la Boîte à idées dans le mur (#177).
 *
 * L'alpha n'a **aucun backend** : le formulaire Google écrit dans **sa** feuille, et le
 * jeu ne lit que `docs/boite-a-idees.json`, bundlé par Vite (D-058). Entre les deux, un
 * humain recopiait les réponses à la main (§5). Ce script fait la recopie mécanique :
 * il lit la feuille **publiée en CSV**, puis ajoute au fichier du mur les post-its
 * **absents**.
 *
 * Ce qu'il ne fait **jamais** :
 * - modifier un post-it existant — le tri (`statut`, `ticket`, `raison`, `position`) est
 *   un travail humain (D-059, D-068) ;
 * - écrire quoi que ce soit si le CSV est vide, illisible ou sans l'en-tête attendu : le
 *   fichier reste **intact**, et la commande sort en erreur ;
 * - toucher au réseau quand `--fichier` est donné (c'est ce que fait le test).
 *
 * **Idempotence** : la clé d'une réponse est `horodatage + titre`. Comme le post-it n'a
 * pas de champ pour l'horodatage (§3 : on n'invente aucun champ), la clé vit dans l'`id`
 * — `p-23-10-2026-14-05-32-le-bouton-fin-du-tour`. Deux imports du même CSV retrouvent
 * donc les mêmes ids et n'ajoutent rien. Corollaire : **renommer l'id à la main** ferait
 * réapparaître le post-it au prochain import ; §3 demande déjà un id **stable**.
 *
 * Usage :
 *   node scripts/mur-import.mjs [--dry-run] [--fichier <csv>] [--mur <json>]
 *
 * `--mur` n'existe que pour les tests : il évite d'écrire dans le vrai fichier du mur.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER_MUR = join(RACINE, 'docs', 'boite-a-idees.json');

/** Les écrans admis (`src/store/mur.ts`), écrits ici pour la traduction du formulaire. */
const ECRANS = {
  accueil: 'Accueil',
  collection: 'Collection',
  deck: 'Deck',
  combat: 'Combat',
  reglages: 'Réglages',
  autre: 'Autre'
};

const AIDE = `Usage : node scripts/mur-import.mjs [options]

Lit le CSV publié de la feuille de réponses du formulaire et ajoute au mur les
post-its absents (clé : horodatage + titre). Ne modifie jamais un post-it existant.

  --dry-run          affiche ce qui serait ajouté, n'écrit rien
  --fichier <csv>    lit un CSV local au lieu du réseau (tests, dépannage)
  --mur <json>       fichier du mur à mettre à jour (défaut : docs/boite-a-idees.json ;
                     réservé aux tests)
  --aide             affiche ce texte

L'adresse du CSV se lit dans le champ « reponses » de docs/boite-a-idees.json, ou dans
la variable d'environnement MUR_REPONSES_CSV (qui la surcharge).`;

/** Minuscules, sans accents ni ponctuation : c'est la forme de comparaison des en-têtes. */
export function normaliser(valeur) {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Un parseur CSV **correct**, sans dépendance : guillemets, virgules et retours à la
 * ligne à l'intérieur d'un champ, guillemets échappés (`""`), CRLF. Un `split(',')`
 * casserait au premier « Ce que tu faisais » contenant une virgule — le piège classique
 * du ticket.
 */
export function lireCsv(source) {
  const texte = String(source ?? '').replace(/^\uFEFF/, '');
  const lignes = [];
  let ligne = [];
  let champ = '';
  let dansGuillemets = false;

  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];

    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i += 1;
        } else {
          dansGuillemets = false;
        }
      } else {
        champ += c;
      }
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
    } else if (c === ',') {
      ligne.push(champ);
      champ = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && texte[i + 1] === '\n') i += 1;
      ligne.push(champ);
      champ = '';
      lignes.push(ligne);
      ligne = [];
    } else {
      champ += c;
    }
  }

  if (dansGuillemets) {
    throw new Error('CSV illisible : un guillemet n’est jamais refermé');
  }
  if (champ !== '' || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }

  // Une ligne entièrement vide (fin de fichier, ligne blanche) n'est pas une réponse.
  return lignes.filter((cellules) => cellules.some((cellule) => cellule.trim() !== ''));
}

/**
 * Les colonnes de la feuille, par **rôle**, d'après les 19 colonnes **réelles** du
 * formulaire (mesurées le 23/10/2026) :
 *
 * `Horodateur, Pseudo, Quelle Version du Jeux, Tu veux quoi ?, Exprime toi,
 *  Envie d'aider ?, Titre, Ce que tu faisais ?, Ce qui c'est passé ?, Ce que tu attendais ?,
 *  Écran, Capture, Titre, L'idée, À quoi ça servirait ?, Écran, Capture,
 *  Ce que tu as aimé ?, Ce que tu n'as pas aimé ?`
 *
 * Les colonnes 7 à 12 sont celles du chemin **bug**, 13 à 17 celles du chemin **idée** :
 * « Titre », « Écran » et « Capture » se répètent, donc on les repère **par position**
 * (l'ordre des colonnes), pas par nom — un `Map` par nom garderait la seconde et
 * perdrait la première.
 */
const ROLES = {
  horodatage: (n) => /^(horodateur|horodatage|timestamp)\b/.test(n),
  pseudo: (n) => n.startsWith('pseudo'),
  version: (n) => n.includes('version'),
  entree: (n) => n.startsWith('tu veux quoi') || n.startsWith('que veux tu'),
  titre: (n) => n.startsWith('titre'),
  faisais: (n) => n.startsWith('ce que tu faisais'),
  passe: (n) => n.startsWith('ce qui s est passe') || n.startsWith('ce qui c est passe'),
  attendais: (n) => n.startsWith('ce que tu attendais'),
  ecran: (n) => n.startsWith('ecran'),
  capture: (n) => n.startsWith('capture') || n.startsWith('lien'),
  gueule: (n) => n.startsWith('pourquoi qu on gueule') || n.startsWith('exprime toi'),
  envie: (n) => n.startsWith('envie d aider'),
  idee: (n) => n.startsWith('l idee') || n.startsWith('idee'),
  servirait: (n) => n.startsWith('a quoi ca servirait'),
  aime: (n) => n.startsWith('ce que tu as aime'),
  aimePas: (n) => n.startsWith('ce que tu n as pas aime'),
  avis: (n) => n.startsWith('avis sur le jeux') || n.startsWith('avis sur le jeu')
};

const CONTENU = ['titre', 'faisais', 'passe', 'attendais', 'idee', 'servirait', 'gueule', 'aime', 'aimePas', 'avis'];

/** Les colonnes du CSV, groupées par rôle ; les trois doublons sont coupés par section. */
function colonnesParRole(entetes) {
  const normalisees = entetes.map(normaliser);
  const roles = {};
  for (const [role, test] of Object.entries(ROLES)) {
    roles[role] = normalisees.flatMap((nom, index) => (test(nom) ? [index] : []));
  }
  for (const champ of ['titre', 'ecran', 'capture']) {
    const indices = roles[champ] ?? [];
    roles[`${champ}Bug`] = indices.slice(0, 1);
    roles[`${champ}Idee`] = indices.slice(1, 2);
  }
  return roles;
}

function valeurDe(ligne, indices = []) {
  for (const index of indices) {
    const valeur = (ligne[index] ?? '').trim();
    if (valeur) return valeur;
  }
  return '';
}

/**
 * Les colonnes dupliquées se lisent **par section** : bug (7–12) pour un OUF, idée
 * (13–17) pour une IP. On retombe sur l'autre section quand celle du chemin est vide —
 * un CSV réduit à quelques colonnes n'a parfois qu'un seul « Titre ».
 */
function valeurSection(ligne, roles, champ, kind) {
  const principale = kind === 'OUF' ? `${champ}Bug` : `${champ}Idee`;
  const autre = kind === 'OUF' ? `${champ}Idee` : `${champ}Bug`;
  return valeurDe(ligne, roles[principale]) || valeurDe(ligne, roles[autre]);
}

/** « Remonter un bug » → OUF, « Proposer une feature » → IP, le reste → IP (§4.3 bis). */
export function famille(entree, envie) {
  const chemin = normaliser(entree);
  const renvoi = normaliser(envie);
  const gueulage = chemin.includes('gueul');
  const connu = /bug|feature|idee|avis|gueul/.test(chemin);

  let kind = 'IP';
  if (gueulage) {
    kind = renvoi.includes('bug') ? 'OUF' : 'IP';
  } else if (chemin.includes('bug')) {
    kind = 'OUF';
  }

  return { kind, gueulage, connu };
}

/** Les premiers mots d'un texte, quand le formulaire n'a pas donné de titre (§4.3 bis). */
export function titreDepuisTexte(texte) {
  const premier = String(texte ?? '').split('\n').map((ligne) => ligne.trim()).find(Boolean) ?? '';
  const mots = premier.split(/\s+/).filter(Boolean).slice(0, 10).join(' ');
  return mots.length > 72 ? `${mots.slice(0, 69).trimEnd()}…` : mots;
}

function ecranDe(valeur) {
  const cle = normaliser(valeur);
  // `hasOwn` : une valeur du CSV ne doit pas pouvoir atteindre le prototype d'`Object`.
  return Object.hasOwn(ECRANS, cle) ? ECRANS[cle] : '';
}

/** La clé d'une réponse vit dans l'id : `p-<horodatage>-<titre>` (voir l'en-tête). */
export function idDeReponse(horodatage, titre) {
  const morceau = (valeur) => normaliser(valeur).replace(/\s+/g, '-').slice(0, 40).replace(/-+$/, '');
  const debut = morceau(horodatage) || 'sans-date';
  const fin = morceau(titre) || 'sans-titre';
  return `p-${debut}-${fin}`.slice(0, 90).replace(/-+$/, '');
}

/** Un petit FNV-1a : la disposition d'un post-it ne doit pas changer d'un import à l'autre. */
function hachage(texte) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function positionDe(id, numero) {
  const h = hachage(id);
  const colonne = numero % 4;
  const rangee = Math.floor(numero / 4) % 4;
  return {
    x: 6 + colonne * 22 + (h % 3),
    y: 6 + rangee * 19 + ((h >> 5) % 3),
    angle: (h % 9) - 4
  };
}

/** Une ligne du CSV, traduite en réponse du mur — ou `null` si elle n'a ni titre ni texte. */
function reponseDe(ligne, roles) {
  const horodatage = valeurDe(ligne, roles.horodatage);
  const entree = valeurDe(ligne, roles.entree);
  const envie = valeurDe(ligne, roles.envie);
  const { kind, gueulage, connu } = famille(entree, envie);

  const gueule = valeurDe(ligne, roles.gueule);
  const faisais = valeurDe(ligne, roles.faisais);
  const passe = valeurDe(ligne, roles.passe);
  const attendais = valeurDe(ligne, roles.attendais);
  const idee = valeurDe(ligne, roles.idee);
  const servirait = valeurDe(ligne, roles.servirait);
  const avis = valeurDe(ligne, roles.avis);
  const aime = valeurDe(ligne, roles.aime);
  const aimePas = valeurDe(ligne, roles.aimePas);
  const capture = valeurSection(ligne, roles, 'capture', kind);

  const blocs = [];
  if (gueulage && gueule) blocs.push(gueule);
  if (kind === 'OUF') {
    if (faisais) blocs.push(`Ce que tu faisais : ${faisais}`);
    if (passe) blocs.push(`Ce qui s’est passé : ${passe}`);
    if (attendais) blocs.push(`Ce que tu attendais : ${attendais}`);
  } else {
    if (idee) blocs.push(`L’idée : ${idee}`);
    if (servirait) blocs.push(`À quoi ça servirait : ${servirait}`);
    if (avis) blocs.push(`Avis : ${avis}`);
  }
  if (aime) blocs.push(`Ce que tu as aimé : ${aime}`);
  if (aimePas) blocs.push(`Ce que tu n’as pas aimé : ${aimePas}`);

  // Le post-it n'a **pas** de champ capture (§3) : le lien rejoint le texte, il n'est
  // pas perdu, et le mur n'affiche aucun champ qu'il ne connaît pas.
  if (capture) blocs.push(`Capture : ${capture}`);

  // Un gueulage sans suite, ou un avis, n'a pas de titre : les premiers mots du retour
  // en tiennent lieu (§4.3 bis) — jamais un titre inventé qui trahirait le propos. Et
  // le post-it **dit** que le titre est fabriqué, pour que le tri ne le prenne pas pour
  // un titre de l'invité.
  const sourceDuTitre = gueule || idee || aime || aimePas || faisais || passe || attendais || servirait || avis;
  const titreExplicite = valeurSection(ligne, roles, 'titre', kind);
  const titre = titreExplicite || titreDepuisTexte(sourceDuTitre) || titreDepuisTexte(blocs.join(' '));
  if (!titre || blocs.length === 0) return null;
  if (!titreExplicite) {
    blocs.unshift('Titre fabriqué avec les premiers mots du message : le formulaire n’en demandait pas.');
  }
  const texte = blocs.join('\n\n').trim();

  const ecranBrut = valeurSection(ligne, roles, 'ecran', kind);
  const ecran = ecranDe(ecranBrut);
  const pseudo = valeurDe(ligne, roles.pseudo) || 'anonyme';
  const version = valeurDe(ligne, roles.version);

  return {
    avertissements: [
      ...(connu ? [] : [`chemin « ${entree || '(vide)'} » inconnu : classé IP`]),
      ...(ecranBrut && !ecran ? [`écran « ${ecranBrut} » inconnu : laissé vide`] : [])
    ],
    postit: {
      id: idDeReponse(horodatage, titre),
      kind,
      titre,
      texte,
      ecran,
      pseudo,
      version,
      statut: 'en attente',
      raison: '',
      ticket: null,
      gueulage,
      position: { x: 0, y: 0, angle: 0 },
      votes: { up: 0, down: 0 }
    }
  };
}

/**
 * Le CSV entier → les réponses du mur.
 *
 * Refuse (en levant une erreur, donc **sans rien écrire**) : un CSV vide, un CSV réduit à
 * son en-tête, un en-tête qui n'a pas les colonnes attendues, un guillemet non refermé.
 */
export function lireReponses(source) {
  const lignes = lireCsv(source);
  if (lignes.length === 0) {
    throw new Error('le CSV est vide : rien à importer');
  }

  const roles = colonnesParRole(lignes[0]);
  const manquantes = [];
  if (roles.horodatage.length === 0) manquantes.push('Horodatage');
  if (roles.version.length === 0) manquantes.push('Version du jeu');
  if (roles.entree.length === 0) manquantes.push('Tu veux quoi ?');
  if (!CONTENU.some((role) => roles[role].length > 0)) {
    manquantes.push('une colonne de contenu (Titre, L’idée, Exprime toi…)');
  }
  if (manquantes.length > 0) {
    throw new Error(
      `en-tête inattendu : il manque ${manquantes.join(', ')}. ` +
        `En-têtes lus : ${lignes[0].map((entete) => `« ${entete.trim()} »`).join(', ')}`
    );
  }

  const donnees = lignes.slice(1);
  if (donnees.length === 0) {
    throw new Error('le CSV ne contient aucune réponse (seulement la ligne d’en-tête)');
  }

  const reponses = [];
  donnees.forEach((ligne, index) => {
    const reponse = reponseDe(ligne, roles);
    if (!reponse) {
      console.warn(`ligne ${index + 2} ignorée : ni titre ni texte`);
      return;
    }
    reponses.push(reponse);
  });
  return reponses;
}

/**
 * Rapproche les réponses des post-its existants. **Ne modifie aucune entrée existante** :
 * les nouveautés sont ajoutées à la fin, avec une position calculée à partir de l'id.
 */
export function rapprocher(existants, reponses) {
  const vus = new Set(existants.map((postit) => String(postit.id ?? '')));
  const ajouts = [];
  let deja = 0;

  for (const reponse of reponses) {
    const id = reponse.postit.id;
    if (vus.has(id)) {
      deja += 1;
      continue;
    }
    vus.add(id);

    const postit = { ...reponse.postit };
    postit.position = positionDe(id, existants.length + ajouts.length);
    ajouts.push({ postit, avertissements: reponse.avertissements });
  }

  return { ajouts, deja, lus: reponses.length };
}

export function argumentsDe(ligne) {
  const options = { dryRun: false, fichier: null, mur: null, aide: false };
  for (let i = 0; i < ligne.length; i += 1) {
    const arg = ligne[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--fichier' || arg === '--mur') {
      const valeur = ligne[i + 1];
      if (!valeur || valeur.startsWith('--')) throw new Error(`${arg} attend un chemin`);
      if (arg === '--fichier') options.fichier = valeur;
      else options.mur = valeur;
      i += 1;
    } else if (arg === '--aide' || arg === '--help' || arg === '-h') {
      options.aide = true;
    } else {
      throw new Error(`argument inconnu : ${arg}`);
    }
  }
  return options;
}

function lireDocument(chemin) {
  if (!existsSync(chemin)) {
    throw new Error(`fichier du mur introuvable : ${chemin}`);
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (erreur) {
    throw new Error(`le fichier du mur n’est pas du JSON valide (${chemin}) : ${erreur.message}`);
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.postits)) {
    throw new Error(`le fichier du mur n’a pas de liste « postits » (${chemin})`);
  }
  return doc;
}

function adresseCsv(doc) {
  const env = String(process.env.MUR_REPONSES_CSV ?? '').trim();
  if (env) return { url: env, source: 'MUR_REPONSES_CSV' };
  if (doc.reponses !== undefined && typeof doc.reponses !== 'string') {
    throw new Error('le champ « reponses » de docs/boite-a-idees.json doit être une chaîne');
  }
  return {
    url: String(doc.reponses ?? '').trim(),
    source: 'docs/boite-a-idees.json (champ « reponses »)'
  };
}

async function lireCsvDistant(url) {
  let reponse;
  try {
    reponse = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (erreur) {
    throw new Error(`le CSV n’a pas pu être lu (${erreur.message}) : le réseau a échoué`);
  }
  if (!reponse.ok) {
    throw new Error(`le CSV a répondu ${reponse.status} ${reponse.statusText}`);
  }
  return await reponse.text();
}

const CONSIGNE_RESEAU =
  'Vérifie que la feuille est publiée en CSV (Fichier → Partager → Publier sur le Web → CSV) ' +
  'et que son adresse est dans le champ « reponses » de docs/boite-a-idees.json.';

async function principal(ligne = process.argv.slice(2)) {
  let options;
  try {
    options = argumentsDe(ligne);
  } catch (erreur) {
    console.error(`mur:import — ${erreur.message}`);
    console.error(AIDE);
    return 1;
  }

  if (options.aide) {
    console.log(AIDE);
    return 0;
  }

  const cheminMur = options.mur ? resolve(options.mur) : FICHIER_MUR;
  let doc;
  try {
    doc = lireDocument(cheminMur);
  } catch (erreur) {
    console.error(`mur:import — ${erreur.message}`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  let texteCsv;
  try {
    if (options.fichier) {
      const chemin = resolve(options.fichier);
      if (!existsSync(chemin)) throw new Error(`fichier CSV introuvable : ${chemin}`);
      texteCsv = readFileSync(chemin, 'utf8');
      console.log(`Lecture du CSV local : ${chemin}`);
    } else {
      const { url, source } = adresseCsv(doc);
      if (!url) {
        throw new Error(
          `aucune adresse de CSV publiée (${source}). ${CONSIGNE_RESEAU} ` +
            'En attendant, `--fichier <csv>` lit un CSV local.'
        );
      }
      console.log(`Lecture du CSV publié : ${url}`);
      texteCsv = await lireCsvDistant(url);
    }
  } catch (erreur) {
    console.error(`mur:import — ${erreur.message}`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  let reponses;
  try {
    reponses = lireReponses(texteCsv);
  } catch (erreur) {
    console.error(`mur:import — ${erreur.message}`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  const { ajouts, deja, lus } = rapprocher(doc.postits, reponses);
  for (const { postit, avertissements } of ajouts) {
    for (const avertissement of avertissements) {
      console.warn(`  ! ${postit.id} — ${avertissement}`);
    }
    console.log(
      `  + ${postit.id} — ${postit.kind}${postit.gueulage ? ' (gueulage)' : ''} — ${postit.titre}`
    );
  }

  const resume = `lus : ${lus} — ajoutés : ${ajouts.length} — déjà là : ${deja}`;
  if (options.dryRun) {
    console.log(resume);
    console.log('Rien n’a été écrit (--dry-run).');
    return 0;
  }

  if (ajouts.length === 0) {
    console.log(resume);
    console.log(`Rien à écrire : ${cheminMur} n’a pas été touché.`);
    return 0;
  }

  doc.postits = [...doc.postits, ...ajouts.map(({ postit }) => postit)];
  writeFileSync(cheminMur, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(resume);
  console.log(`${cheminMur} : ${ajouts.length} post-it(s) ajouté(s).`);
  return 0;
}

export { principal };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await principal();
}
