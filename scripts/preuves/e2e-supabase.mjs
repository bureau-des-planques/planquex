#!/usr/bin/env node
/**
 * **La preuve E2E du projet de test** (#668).
 *
 * Le projet Supabase de test (`planquex-test`) et son compte de jeu non administrateur vivent
 * dans l'**environnement protégé** de GitHub Actions (`environment: planquex-test`). Ce module
 * ne les cherche jamais dans le dépôt : les seules valeurs qu'il lit sont les variables
 * `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, et
 * il ne les écrit ni dans une trace, ni dans un fichier, ni dans une capture.
 *
 * **Trois issues, et trois seulement** :
 *
 * 1. **Sans identifiants** (poste local, fork) : la partie **réseau** est sautée avec sa
 *    raison, le contrat de l'état préparé est vérifié sans réseau, et la commande sort **0**.
 *    Les tests autonomes (`npm test`) ne dépendent pas de ce module et continuent.
 * 2. **Identifiants présents mais refusés** : `supabase.auth.signInWithPassword` rend une
 *    erreur, et elle **lève**. Il n'y a aucun repli qui transformerait un refus en succès
 *    simulé.
 * 3. **Identifiants valides** : la preuve s'authentifie sur le projet de test, lit la ligne
 *    `public.comptes` du compte (elle doit exister et `administrateur` doit valoir `false`),
 *    prépare un `storageState` reproductible, puis photographie deux écrans servis en local
 *    depuis `dist/`. **Aucune écriture** n'est faite dans la base : le module ne contient ni
 *    `insert`, ni `update`, ni `delete`, ni `rpc`. Une adresse de production connue est
 *    refusée d'avance, pour que la preuve ne puisse pas y toucher par mégarde.
 *
 * **Pourquoi l'état préparé est reproductible** : la session est rangée sous la clé que lit
 * `@supabase/supabase-js` (`sb-<ref>-auth-token`), et le store du jeu sous sa clé
 * (`bureau-des-planques-v1`) avec `tutorielVu: true`. Aucun numéro de version n'est recopié :
 * un blob qui ne porte qu'un booléen n'a aucune forme à migrer (même raison que
 * `amorcageStore`, `capturer-socle.mjs`).
 *
 * **Ce que le module ne fait pas** : il ne crée pas le compte, ne l'approuve pas, ne change
 * pas son mot de passe. « Préparer le compte » veut dire ici **vérifier** qu'il est celui
 * qu'on croit (non administrateur) et rendre sa session utilisable par le navigateur.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { STORAGE_KEY, VIEWPORT, etatPrepare } from './capturer-socle.mjs';

export { STORAGE_KEY, cleSession, etatPrepare } from './capturer-socle.mjs';

/** Les quatre variables lues par la preuve. Les deux premières sont des secrets. */
export const VARIABLES = Object.freeze({
  email: 'E2E_TEST_EMAIL',
  motDePasse: 'E2E_TEST_PASSWORD',
  url: 'VITE_SUPABASE_URL',
  cle: 'VITE_SUPABASE_ANON_KEY'
});

/**
 * Les adresses de **production** connues (D-053, D-071, D-072) : la preuve les refuse avant
 * toute connexion. La liste n'est pas une source de configuration — le projet de test est
 * nommé par l'environnement protégé —, c'est une **garde d'écriture** : si l'environnement
 * protégé était mal câblé, la commande s'arrête au lieu d'écrire chez les testeurs.
 */
export const HOTES_PRODUCTION = Object.freeze([
  'jzlcwnozlzhadatksvgh.supabase.co',
  'planquex.4k7.org',
  'planquex.vercel.app'
]);

/** Les hôtes locaux, qui peuvent rester en `http` (Supabase local, mise au point). */
const HOTES_LOCAUX = Object.freeze(['localhost', '127.0.0.1', '[::1]']);

/** L'hôte d'un projet de test, ou une erreur qui dit pourquoi l'adresse est refusée. */
export function refuserProduction(url) {
  let adresse;
  try {
    adresse = new URL(url);
  } catch {
    throw new Error(`Refus E2E : ${VARIABLES.url} n’est pas une URL absolue.`);
  }
  const hote = adresse.hostname.toLowerCase();
  if (HOTES_PRODUCTION.some((production) => hote === production || hote.endsWith(`.${production}`))) {
    throw new Error(`Refus E2E : ${hote} est la production. La preuve ne parle qu’au projet de test.`);
  }
  if (adresse.protocol !== 'https:' && !HOTES_LOCAUX.includes(hote)) {
    throw new Error(`Refus E2E : ${hote} n’est pas en https, et n’est pas local.`);
  }
  return hote;
}

/** Une valeur d'environnement, sans espaces parasites ; `''` si absente. */
function lireVariable(env, nom) {
  return typeof env[nom] === 'string' ? env[nom].trim() : '';
}

/**
 * Ce que dit l'environnement : `saute` (aucun identifiant), `cassee` (configuration
 * incomplète ou adresse refusée) ou `pret`. Ne contacte rien.
 */
export function diagnosticE2E(env = {}) {
  const email = lireVariable(env, VARIABLES.email);
  const motDePasse = lireVariable(env, VARIABLES.motDePasse);
  const url = lireVariable(env, VARIABLES.url);
  const cle = lireVariable(env, VARIABLES.cle);

  if (!email && !motDePasse) {
    return {
      etat: 'saute',
      raison:
        `${VARIABLES.email} et ${VARIABLES.motDePasse} sont absents : la preuve réseau E2E est sautée ` +
        '(environnement protégé non fourni).'
    };
  }
  if (!email || !motDePasse) {
    return {
      etat: 'cassee',
      raison: `${VARIABLES.email} et ${VARIABLES.motDePasse} vont ensemble : une seule des deux est posée.`
    };
  }
  if (!url || !cle) {
    return {
      etat: 'cassee',
      raison: `${VARIABLES.url} et ${VARIABLES.cle} sont requis pour joindre le projet de test.`
    };
  }
  try {
    return { etat: 'pret', email, motDePasse, url, cle, hote: refuserProduction(url) };
  } catch (erreur) {
    return { etat: 'cassee', raison: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}

/** Retire les identifiants d'un message d'erreur avant qu'il n'atteigne la trace. */
function rediger(message, { email, motDePasse }) {
  let texte = String(message);
  for (const secret of [email, motDePasse]) {
    if (secret) texte = texte.split(secret).join('***');
  }
  return texte;
}

/**
 * S'authentifie sur le projet de test, ou **lève**. Une erreur de `signInWithPassword` ne
 * devient jamais une session : c'est le critère « identifiants invalides = échec explicite ».
 */
export async function authentifier(client, identifiants) {
  const { data, error } = await client.auth.signInWithPassword({
    email: identifiants.email,
    password: identifiants.motDePasse
  });
  if (error) {
    throw new Error(`Authentification E2E refusée par le projet de test : ${rediger(error.message, identifiants)}`);
  }
  const session = data?.session;
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error('Authentification E2E sans session : la réponse ne prouve rien.');
  }
  return session;
}

/**
 * Lit la ligne `public.comptes` du compte et **exige** qu'elle existe et que le drapeau
 * `administrateur` soit faux. Lecture seule ; la RLS de la 0005 laisse chacun lire la sienne.
 */
export async function lireCompteTest(client, uid) {
  const { data, error } = await client.from('comptes').select('id, etat, administrateur').eq('id', uid);
  if (error) throw new Error(`Lecture du compte de test impossible : ${error.message}`);
  const compte = Array.isArray(data) ? data[0] : null;
  if (!compte) {
    throw new Error(
      'Le compte de test n’a pas de ligne dans public.comptes : impossible de vérifier qu’il est non administrateur.'
    );
  }
  if (compte.administrateur === true) {
    throw new Error('Le compte de test est administrateur : la preuve exige un compte non administrateur.');
  }
  return compte;
}

/**
 * Le contrat de l'état préparé, **sans numéro de version** : les cookies sont vides, une
 * seule origine, une session `sb-*` avec ses deux jetons, et le store du jeu qui porte
 * `tutorielVu: true` sans recopier `version`. Rend les raisons d'échec (vide = conforme).
 */
export function verifierEtatPrepare(etat) {
  const raisons = [];
  if (!etat || typeof etat !== 'object') return ['l’état préparé n’est pas un objet'];
  if (!Array.isArray(etat.cookies) || etat.cookies.length !== 0) raisons.push('cookies : attendu vide');
  if (!Array.isArray(etat.origins) || etat.origins.length !== 1) {
    raisons.push('origins : une seule origine attendue');
    return raisons;
  }
  const [origine] = etat.origins;
  if (typeof origine.origin !== 'string' || origine.origin === '') raisons.push('origine absente');
  const entrees = Array.isArray(origine.localStorage) ? origine.localStorage : [];
  const session = entrees.find((entree) => /^sb-.+-auth-token$/.test(entree.name));
  if (!session) {
    raisons.push('session absente : la clé sb-<ref>-auth-token n’est pas dans le localStorage');
  } else {
    try {
      const valeur = JSON.parse(session.value);
      if (!valeur?.access_token || !valeur?.refresh_token) raisons.push('la session n’a pas ses deux jetons');
    } catch {
      raisons.push('la session n’est pas du JSON');
    }
  }
  const store = entrees.find((entree) => entree.name === STORAGE_KEY);
  if (!store) {
    raisons.push(`store absent : la clé ${STORAGE_KEY} n’est pas dans le localStorage`);
  } else {
    try {
      const blob = JSON.parse(store.value);
      if (blob?.state?.tutorielVu !== true) raisons.push('le store ne porte pas tutorielVu: true');
      if (Object.prototype.hasOwnProperty.call(blob, 'version')) {
        raisons.push('le store ne doit pas recopier la version : elle vit dans src/store/useStore.ts');
      }
    } catch {
      raisons.push('le store n’est pas du JSON');
    }
  }
  return raisons;
}

/** Les identifiants qu'un texte de page ne doit pas laisser passer. */
export function identifiantsVisibles(texte, { email, uid, jeton }) {
  const trouves = [];
  if (email && texte.includes(email)) trouves.push('courriel');
  if (uid && texte.includes(uid)) trouves.push('identifiant');
  if (jeton && texte.includes(jeton)) trouves.push('jeton');
  return trouves;
}

/**
 * Relit les fichiers d'un dossier et signale ceux qui contiennent une des valeurs données.
 * Le message ne cite **jamais** la valeur trouvée : il dit le fichier, pas l'identifiant.
 */
export function verifierCapturesSansIdentifiant(dossier, valeurs) {
  const trouvees = [];
  if (!existsSync(dossier)) return trouvees;
  for (const nom of readdirSync(dossier)) {
    const contenu = readFileSync(join(dossier, nom)).toString('latin1');
    if (valeurs.some((valeur) => typeof valeur === 'string' && valeur !== '' && contenu.includes(valeur))) {
      trouvees.push(`${nom} contient un identifiant`);
    }
  }
  return trouvees;
}

/** La session factice du contrat hors réseau : ce ne sont pas des jetons réels. */
const SESSION_FACTICE = Object.freeze({
  access_token: 'jeton-de-test',
  refresh_token: 'rafraichissement-de-test',
  user: { id: 'compte-de-test' }
});

/**
 * La preuve complète. Rend `{ saute: true }` quand l'environnement n'a pas d'identifiants,
 * et `{ saute: false, captures: n }` après avoir écrit `n` images dans `outDir/e2e/`.
 * Lève sur toute configuration cassée, authentification refusée ou page qui laisse fuiter
 * un identifiant — l'appelant (`capturer.mjs --e2e`) traduit en sortie 1.
 */
export async function lancerPreuveE2E({ env = process.env, root, outDir, executablePath, base, origine, port = 4180 }) {
  const diagnostic = diagnosticE2E(env);

  if (diagnostic.etat === 'saute') {
    const etat = etatPrepare({
      origine: 'http://localhost:4180',
      url: 'https://exemple.supabase.co',
      session: SESSION_FACTICE
    });
    const raisons = verifierEtatPrepare(etat);
    if (raisons.length) throw new Error(`Contrat de l’état préparé en échec : ${raisons.join(' ; ')}`);
    console.log(`⏭ Preuve E2E sautée : ${diagnostic.raison}`);
    console.log('✔ Contrat de l’état préparé vérifié sans réseau (session, store, tutorielVu).');
    return { saute: true };
  }
  if (diagnostic.etat === 'cassee') throw new Error(diagnostic.raison);

  if (!root || !outDir || !executablePath || !base || !origine) {
    throw new Error('lancerPreuveE2E : root, outDir, executablePath, base et origine sont requis.');
  }

  const client = createClient(diagnostic.url, diagnostic.cle, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const session = await authentifier(client, diagnostic);
  const uid = session.user?.id;
  if (typeof uid !== 'string' || uid === '') {
    throw new Error('La session de test ne porte pas d’identifiant de compte.');
  }
  const compte = await lireCompteTest(client, uid);

  const etat = etatPrepare({ origine, url: diagnostic.url, session });
  const raisons = verifierEtatPrepare(etat);
  if (raisons.length) throw new Error(`État préparé invalide : ${raisons.join(' ; ')}`);

  const distIndex = join(root, 'dist/index.html');
  if (!existsSync(distIndex)) throw new Error('dist/index.html absent : lance `npm run build` avant la preuve E2E.');
  if (!existsSync(executablePath)) {
    throw new Error(`Chromium introuvable : ${executablePath}\n  Renseigne CHROME_PATH.`);
  }

  // Le dossier est **refait** à chaque preuve : une capture périmée (d'un ancien écran, ou
  // d'un ancien compte) ne doit ni être scannée ni partir dans l'artefact.
  const dossier = join(outDir, 'e2e');
  rmSync(dossier, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });

  let server = null;
  if (!env.BASE_URL) {
    server = await preview({ root, preview: { port, strictPort: true }, logLevel: 'error' });
  }

  let browser = null;
  const captures = [];
  try {
    browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    const contexte = await browser.newContext({
      viewport: VIEWPORT,
      isMobile: true,
      hasTouch: true,
      storageState: etat
    });
    const page = await contexte.newPage();
    const erreurs = [];
    page.on('console', (message) => {
      if (message.type() === 'error') erreurs.push(message.text());
    });
    page.on('pageerror', (erreur) => erreurs.push(erreur.message));

    // Deux écrans **du jeu**, pas l'écran Compte (qui affiche le courriel) ni le mur du
    // comité (qui affiche les pseudos des testeurs) : la preuve porte sur la session, pas
    // sur des données d'autrui. `/` refuse de s'ouvrir sans compte (GardeComptes), donc
    // l'atteindre **est** la preuve que la session a été reconnue.
    for (const [nom, chemin] of [
      ['accueil', '/'],
      ['collection', '/collection']
    ]) {
      await page.goto(`${base}${chemin}`, { waitUntil: 'networkidle' });
      if (new URL(page.url()).pathname === '/connexion') {
        throw new Error(`La session n’a pas été reconnue : ${chemin} renvoie vers /connexion.`);
      }
      const texte = await page.evaluate(() => document.body.innerText);
      const fuites = identifiantsVisibles(texte, {
        email: diagnostic.email,
        uid,
        jeton: session.access_token
      });
      if (fuites.length) {
        throw new Error(`La page ${chemin} affiche un identifiant (${fuites.join(', ')}) : capture refusée.`);
      }
      const fichier = join(dossier, `${nom}.png`);
      await page.screenshot({ path: fichier, fullPage: false });
      captures.push(fichier);
    }

    if (erreurs.length) {
      throw new Error(`Erreurs de console pendant la preuve E2E : ${erreurs.slice(0, 3).join(' | ')}`);
    }

    const fuites = verifierCapturesSansIdentifiant(dossier, [
      diagnostic.email,
      diagnostic.motDePasse,
      uid,
      session.access_token,
      session.refresh_token
    ]);
    if (fuites.length) throw new Error(`Captures refusées : ${fuites.join(' ; ')}`);

    console.log(
      `✔ Preuve E2E sur ${diagnostic.hote} : ${captures.length} captures, compte ${compte.etat} ` +
        'non administrateur, aucun identifiant dans les captures.'
    );
    return { saute: false, captures: captures.length };
  } finally {
    await browser?.close();
    await server?.close();
  }
}
