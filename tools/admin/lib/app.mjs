/**
 * Le serveur HTTP du poste de pilotage (#184, D-088/D-089).
 *
 * Un serveur `node:http`, lié **à `127.0.0.1` seule**, qui sert une page statique (HTML + fetch,
 * aucun build) et une API JSON. Un **jeton aléatoire** tiré au démarrage est exigé sur chaque
 * requête ; la page parle au serveur, le serveur parle à la base — les chaînes de connexion ne
 * traversent jamais vers le navigateur.
 *
 * Le jeton peut venir de trois sources équivalentes : le paramètre `?jeton=`, un cookie
 * `poste-jeton` (`HttpOnly`, `SameSite=Strict`) posé à la première visite, ou l'en-tête
 * `x-poste-jeton` (historique). Un `?jeton=` valide pose le cookie ; un jeton invalide l'efface
 * et répond 401. Aucun en-tête CORS n'est émis : le jeton ne peut ni sortir en cross-site ni y
 * être accepté.
 *
 * La seule dépendance du serveur est l'**interface étroite** `{ lire, ecrire }` : en production
 * elle est réalisée par `creerAccesPg` (le pooler), en test par un adaptateur `pglite` injecté.
 * C'est la **couture unique** que les tests exercent par `fetch`.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classerSql, STATUTS } from './classification.mjs';
import { lireEtat, masquerCourriel } from './etat.mjs';
import { lireJournal } from './journal.mjs';
import { initialiserRegistre, listerMigrations, appliquerMigration } from './migrations.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(ICI, '..', 'page.html'), 'utf8');
// Le module **pur** de la page (`page.html` l'importe) : la logique du « quoi de neuf ? »,
// testée à part dans `tools/admin/suivi.test.ts`. Servi comme la page, derrière le jeton.
const SUIVI = readFileSync(join(ICI, 'suivi.mjs'), 'utf8');

/** Le dossier des migrations du dépôt, par défaut. Surchargeable pour les tests. */
export function dossierMigrationsParDefaut() {
  return fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));
}

function empreinte(texte) {
  return createHash('sha256').update(String(texte), 'utf8').digest('hex');
}

/** Un refus attendu, distingué d'une panne : il porte son statut HTTP et son message public. */
function refus(statut, publicMessage, code, extra = {}) {
  const erreur = new Error(publicMessage);
  erreur.statut = statut;
  erreur.publicMessage = publicMessage;
  erreur.code = code;
  Object.assign(erreur, extra);
  return erreur;
}

function json(res, statut, corps) {
  res.writeHead(statut, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corps));
}

async function corpsJson(req) {
  const morceaux = [];
  let taille = 0;
  for await (const morceau of req) {
    taille += morceau.length;
    if (taille > 1_000_000) throw refus(413, 'corps de requête trop grand', 'trop-grand');
    morceaux.push(morceau);
  }
  if (morceaux.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(morceaux).toString('utf8'));
  } catch {
    throw refus(400, 'corps JSON illisible', 'json-invalide');
  }
}

/**
 * Écouter sur `127.0.0.1`. `hote` vit en paramètre pour que le contrôle « n'écoute que sur
 * l'interface locale » soit testé, mais **aucun** appelant de production ne le change.
 */
export async function demarrerServeur(options) {
  const {
    adapter,
    journal,
    dossierMigrations = dossierMigrationsParDefaut(),
    jeton = randomBytes(24).toString('hex'),
    port = 5199,
    hote = '127.0.0.1'
  } = options;

  // Le registre des migrations (`admin.migrations`) existe avant toute chose, idempotent.
  await initialiserRegistre(adapter);

  // Le mot de confirmation des requêtes destructrices, tié au serveur, jamais persisté.
  let mot = null;
  let motLe = 0;
  const nouveauMot = () => {
    mot = randomBytes(4).toString('hex');
    motLe = Date.now();
    return mot;
  };
  const motValide = (candidat) => mot !== null && candidat === mot && Date.now() - motLe < 10 * 60_000;

  /** Un geste journalisé : date, geste, rôle, durée, résultat — jamais de valeur personnelle. */
  async function geste(nom, role, action) {
    const debut = Date.now();
    try {
      const resultat = await action();
      journal.ecrire({
        date: new Date().toISOString(),
        geste: nom,
        role,
        duree_ms: Date.now() - debut,
        resultat: 'ok',
        ...(resultat && resultat.meta ? resultat.meta : {})
      });
      return resultat;
    } catch (erreur) {
      journal.ecrire({
        date: new Date().toISOString(),
        geste: nom,
        role,
        duree_ms: Date.now() - debut,
        resultat: erreur && erreur.statut ? 'refuse' : 'erreur',
        motif:
          erreur && erreur.publicMessage
            ? erreur.publicMessage
            : erreur instanceof Error
              ? erreur.message
              : String(erreur)
      });
      throw erreur;
    }
  }

  // --------------------------------------------------------------------------- les gestes nommés

  const etat = () => geste('etat-alpha', 'lecteur', async () => ({ status: 200, body: await lireEtat(adapter) }));

  const listerComptes = () =>
    geste('lister-comptes', 'lecteur', async () => {
      const lu = await adapter.lire(
        'select id, courriel, etat, administrateur, created_at, decide_par, decide_le from public.comptes order by created_at'
      );
      const comptes = lu.rows.map((ligne) => ({
        id: String(ligne.id),
        courriel: masquerCourriel(ligne.courriel),
        courrielMasque: true,
        etat: String(ligne.etat),
        administrateur: ligne.administrateur === true,
        created_at: ligne.created_at,
        decide_par: ligne.decide_par,
        decide_le: ligne.decide_le
      }));
      return { status: 200, body: { comptes } };
    });

  const approuver = (id) =>
    geste('approuver-compte', 'admin', async () => {
      const lu = await adapter.ecrire(
        `update public.comptes set etat = 'approuve', raison = '' where id = $1 returning id, etat`,
        [id]
      );
      if (lu.rows.length === 0) throw refus(404, `compte introuvable : ${id}`, 'inconnu');
      return {
        status: 200,
        body: { ok: true, id: String(lu.rows[0].id), etat: String(lu.rows[0].etat) },
        meta: { cible: id }
      };
    });

  const refuser = (id, raison) =>
    geste('refuser-compte', 'admin', async () => {
      const motif = String(raison ?? '').trim();
      if (!motif) throw refus(400, 'un refus exige une raison (obligatoire)', 'raison-obligatoire');
      const lu = await adapter.ecrire(
        `update public.comptes set etat = 'refuse', raison = $2 where id = $1 returning id, etat`,
        [id, motif]
      );
      if (lu.rows.length === 0) throw refus(404, `compte introuvable : ${id}`, 'inconnu');
      return {
        status: 200,
        body: { ok: true, id: String(lu.rows[0].id), etat: String(lu.rows[0].etat) },
        meta: { cible: id }
      };
    });

  const marquerAdministrateur = (id, administrateur) =>
    geste('marquer-administrateur', 'admin', async () => {
      const drapeau = administrateur === true;
      const lu = await adapter.ecrire(
        'update public.comptes set administrateur = $2 where id = $1 returning id, administrateur',
        [id, drapeau]
      );
      if (lu.rows.length === 0) throw refus(404, `compte introuvable : ${id}`, 'inconnu');
      return {
        status: 200,
        body: { ok: true, id: String(lu.rows[0].id), administrateur: lu.rows[0].administrateur === true },
        meta: { cible: id }
      };
    });

  const revelerCourriel = (id) =>
    geste('reveler-courriel', 'lecteur', async () => {
      const lu = await adapter.lire('select courriel from public.comptes where id = $1', [id]);
      if (lu.rows.length === 0) throw refus(404, `compte introuvable : ${id}`, 'inconnu');
      // Le courriel sort vers l'administrateur, mais n'entre **pas** au journal.
      return { status: 200, body: { id, courriel: String(lu.rows[0].courriel ?? '') }, meta: { cible: id } };
    });

  const listerPostits = () =>
    geste('lister-postits', 'lecteur', async () => {
      const lu = await adapter.lire(
        'select id, titre, statut, raison, ticket, auteur, gueulage, kind, created_at from public.postits order by created_at'
      );
      return {
        status: 200,
        body: {
          postits: lu.rows.map((ligne) => ({
            id: String(ligne.id),
            titre: String(ligne.titre),
            statut: String(ligne.statut),
            raison: String(ligne.raison ?? ''),
            ticket: ligne.ticket === null ? null : Number(ligne.ticket),
            auteur: ligne.auteur === null ? null : String(ligne.auteur),
            gueulage: ligne.gueulage === true,
            kind: ligne.kind === null ? null : String(ligne.kind),
            created_at: ligne.created_at
          }))
        }
      };
    });

  const trierPostit = (id, corps) =>
    geste('trier-postit', 'admin', async () => {
      const present = await adapter.lire('select statut, raison from public.postits where id = $1', [id]);
      if (present.rows.length === 0) throw refus(404, `post-it inconnu : ${id}`, 'inconnu');

      const { statut, raison, ticket } = corps ?? {};
      if (statut !== undefined && !STATUTS.includes(statut)) {
        throw refus(400, `statut non admis : « ${statut} » (${STATUTS.join(', ')})`, 'statut-invalide');
      }
      let numero = null;
      if (ticket !== undefined) {
        numero = Number(ticket);
        if (!Number.isSafeInteger(numero) || numero <= 0) {
          throw refus(400, `ticket non valide : ${ticket}`, 'ticket-invalide');
        }
      }
      let raisonNettoyee;
      if (raison !== undefined) {
        raisonNettoyee = String(raison).trim();
        if (!raisonNettoyee) throw refus(400, 'la raison ne peut pas être vide', 'raison-vide');
      }

      const statutFinal = statut !== undefined ? statut : String(present.rows[0].statut);
      if (statutFinal === 'écarté') {
        const raisonFinale =
          raisonNettoyee !== undefined ? raisonNettoyee : String(present.rows[0].raison ?? '').trim();
        if (!raisonFinale) throw refus(400, 'écarter exige une raison non vide', 'ecarte-sans-raison');
      }

      const champs = [];
      const params = [];
      if (statut !== undefined) {
        champs.push(`statut = $${params.length + 1}`);
        params.push(statut);
      }
      if (raison !== undefined) {
        champs.push(`raison = $${params.length + 1}`);
        params.push(raisonNettoyee);
      }
      if (ticket !== undefined) {
        champs.push(`ticket = $${params.length + 1}`);
        params.push(numero);
      }
      if (champs.length === 0) throw refus(400, 'rien à changer : donner statut, raison ou ticket', 'rien-a-changer');

      params.push(id);
      const lu = await adapter.ecrire(
        `update public.postits set ${champs.join(', ')} where id = $${params.length} returning id, statut, raison, ticket`,
        params
      );
      return { status: 200, body: { ...lu.rows[0] }, meta: { cible: id } };
    });

  const reattribuerPostits = (corps) =>
    geste('reattribuer-postits', 'admin', async () => {
      const cible = String((corps ?? {}).compte ?? '').trim();
      if (!cible) throw refus(400, 'un compte d’attribution est requis (compte)', 'compte-requis');
      const existe = await adapter.lire('select 1 from public.comptes where id = $1', [cible]);
      if (existe.rows.length === 0) throw refus(404, `compte inconnu : ${cible}`, 'inconnu');
      const lu = await adapter.ecrire(
        `update public.postits set auteur = $1 where auteur not in (select id from public.comptes) returning id`,
        [cible]
      );
      return { status: 200, body: { reattribues: lu.rows.length }, meta: { cible, nombre: lu.rows.length } };
    });

  const migrations = () =>
    geste('lister-migrations', 'lecteur', async () => ({
      status: 200,
      body: { migrations: await listerMigrations(adapter, dossierMigrations) }
    }));

  const appliquer = (fichier) =>
    geste('appliquer-migration', 'admin', async () => {
      const sortie = await appliquerMigration(adapter, dossierMigrations, fichier);
      return { status: 200, body: sortie, meta: { cible: sortie.fichier } };
    });

  const sqlLibre = async (corps) => {
    const { sql, accuse, mot: motFourni } = corps ?? {};
    const debut = Date.now();
    const segment = { date: new Date().toISOString(), geste: 'sql', duree_ms: Date.now() - debut };

    let classement;
    try {
      classement = classerSql(sql);
    } catch (erreur) {
      journal.ecrire({
        ...segment,
        duree_ms: Date.now() - debut,
        role: 'lecteur',
        resultat: 'refuse',
        motif: erreur.publicMessage
      });
      throw erreur;
    }
    const { nature, destructif } = classement;
    const role = nature === 'lecture' ? 'lecteur' : 'admin';
    const fin = (resultat, extra = {}) =>
      journal.ecrire({
        ...segment,
        duree_ms: Date.now() - debut,
        role,
        nature,
        requete: empreinte(sql),
        resultat,
        ...extra
      });

    if (nature === 'ecriture') {
      if (accuse !== true) {
        fin('refuse', { motif: 'écriture : accusé de réception requis' });
        throw refus(400, 'écriture : accusé de réception requis (accuse: true)', 'accuse-requis');
      }
      if (destructif && !motValide(motFourni)) {
        const annonce = nouveauMot();
        fin('refuse', { motif: 'destructif : mot de confirmation requis', destructif: true });
        throw refus(428, 'requête destructrice : tapez le mot annoncé pour confirmer', 'mot-requis', { mot: annonce });
      }
      const lu = await adapter.ecrire(sql);
      fin('ok', { destructif, instructions: lu.instructions });
      return {
        status: 200,
        body: { nature, role, destructif, rows: lu.rows, command: lu.command, instructions: lu.instructions }
      };
    }

    // Lecture : le rôle `lecteur`. Si la requête tentait d'écrire, la **base** la refuserait.
    try {
      const lu = await adapter.lire(sql);
      fin('ok', { instructions: lu.instructions });
      return { status: 200, body: { nature, role, rows: lu.rows, command: lu.command } };
    } catch (erreur) {
      fin('erreur', { motif: erreur.message ?? String(erreur) });
      throw erreur;
    }
  };

  const journalLignes = () => ({ status: 200, body: { lignes: lireJournal(journal.chemin).slice(-100) } });

  // ----------------------------------------------------------------------------- le routage

  const ROUTES = [
    [/^\/api\/etat$/, 'GET', () => etat()],
    [/^\/api\/comptes$/, 'GET', () => listerComptes()],
    [/^\/api\/comptes\/([^/]+)\/approuver$/, 'POST', ([id]) => approuver(id)],
    [/^\/api\/comptes\/([^/]+)\/refuser$/, 'POST', ([id], corps) => refuser(id, corps?.raison)],
    [
      /^\/api\/comptes\/([^/]+)\/administrateur$/,
      'POST',
      ([id], corps) => marquerAdministrateur(id, corps?.administrateur)
    ],
    [/^\/api\/comptes\/([^/]+)\/courriel$/, 'POST', ([id]) => revelerCourriel(id)],
    [/^\/api\/postits$/, 'GET', () => listerPostits()],
    [/^\/api\/postits\/reattribuer$/, 'POST', (_, corps) => reattribuerPostits(corps)],
    [/^\/api\/postits\/([^/]+)\/trier$/, 'POST', ([id], corps) => trierPostit(id, corps)],
    [/^\/api\/migrations$/, 'GET', () => migrations()],
    [/^\/api\/migrations\/([^/]+)\/appliquer$/, 'POST', ([fichier]) => appliquer(fichier)],
    [/^\/api\/sql$/, 'POST', (_, corps) => sqlLibre(corps)],
    [/^\/api\/journal$/, 'GET', () => journalLignes()]
  ];

  // Le nom du cookie qui retient le jeton entre deux visites. `HttpOnly` (le script de la page
  // ne peut pas le lire), `SameSite=Strict` (jamais envoyé en cross-site). Le serveur n'émet
  // **aucun** en-tête CORS : une page d'un autre site ne peut donc ni lire ni recevoir le jeton.
  const NOM_COOKIE = 'poste-jeton';
  const COOKIE_CORPS = `${NOM_COOKIE}=${jeton}; HttpOnly; SameSite=Strict; Path=/`;
  const COOKIE_EFFACE = `${NOM_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;

  /** Le jeton depuis le cookie `poste-jeton`, s'il est posé. */
  function jetonDuCookie(req) {
    const enTete = req.headers.cookie;
    if (typeof enTete !== 'string') return undefined;
    for (const morceau of enTete.split(';')) {
      const egal = morceau.indexOf('=');
      if (egal === -1) continue;
      if (morceau.slice(0, egal).trim() === NOM_COOKIE) return morceau.slice(egal + 1).trim();
    }
    return undefined;
  }

  /** Comparaison en temps constant ; toute valeur non `string` est refusée. */
  function jetonEgale(candidat) {
    if (typeof candidat !== 'string' || !jeton) return false;
    const attendu = Buffer.from(jeton, 'utf8');
    const donne = Buffer.from(candidat, 'utf8');
    return attendu.length === donne.length && timingSafeEqual(attendu, donne);
  }

  const serveur = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    try {
      const paramJeton = url.searchParams.get('jeton');
      const cookieJeton = jetonDuCookie(req);
      const enTeteJeton = req.headers['x-poste-jeton'] ?? req.headers['poste-jeton'];

      // Le jeton vient d'abord du paramètre `?jeton=` (qui pose le cookie), puis du cookie qui le
      // retient, puis de l'en-tête que la page envoyait à l'origine. Les trois sont équivalents.
      let fourni;
      let source;
      if (paramJeton !== null) {
        fourni = paramJeton;
        source = 'parametre';
      } else if (cookieJeton !== undefined) {
        fourni = cookieJeton;
        source = 'cookie';
      } else {
        fourni = enTeteJeton;
        source = 'en-tete';
      }

      if (!jetonEgale(fourni)) {
        // Un jeton invalide **efface** le cookie posé, puis répond 401.
        if (cookieJeton !== undefined || paramJeton !== null) res.setHeader('set-cookie', COOKIE_EFFACE);
        return json(res, 401, { erreur: 'jeton manquant ou invalide' });
      }

      // Un `?jeton=` valide pose le cookie pour les visites suivantes (rétrocompatible : le
      // paramètre reste accepté, simplement il n'est plus requis à chaque fois).
      if (source === 'parametre') res.setHeader('set-cookie', COOKIE_CORPS);
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(PAGE);
      }
      if (req.method === 'GET' && url.pathname === '/suivi.mjs') {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
        return res.end(SUIVI);
      }
      for (const [motif, methode, action] of ROUTES) {
        const correspond = motif.exec(url.pathname);
        if (!correspond) continue;
        if (req.method !== methode) continue;
        const corps = req.method === 'POST' ? await corpsJson(req) : undefined;
        const resultat = await action(correspond.slice(1), corps);
        return json(res, resultat.status, resultat.body);
      }
      return json(res, 404, { erreur: `route inconnue : ${req.method} ${url.pathname}` });
    } catch (erreur) {
      if (erreur && erreur.statut) {
        const corps = { erreur: erreur.publicMessage ?? erreur.message };
        if (erreur.mot) corps.mot = erreur.mot;
        return json(res, erreur.statut, corps);
      }
      return json(res, 500, { erreur: erreur instanceof Error ? erreur.message : String(erreur) });
    }
  });

  return new Promise((resolvePromise, reject) => {
    serveur.once('error', reject);
    serveur.listen(port, hote, () => {
      const adresse = serveur.address();
      const baseUrl = `http://127.0.0.1:${adresse.port}`;
      resolvePromise({
        baseUrl,
        jeton,
        adresse: { ...adresse },
        arreter: () => new Promise((fin) => serveur.close(() => fin()))
      });
    });
  });
}
