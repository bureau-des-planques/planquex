/**
 * Le serveur HTTP du tableau de bord des serveurs (#227, D-102).
 *
 * Un `node:http` lié **à `127.0.0.1` seule**, qui sert une page statique (HTML + `fetch`, aucun
 * build) et une API JSON. Le **jeton** est exigé comme au poste de pilotage (`tools/admin/`) :
 * n'importe quelle page ouverte dans le navigateur peut émettre un `POST` vers `127.0.0.1`,
 * donc une route qui **lance un processus et en tue un** ne s'ouvre pas sans preuve d'origine.
 *
 * La couture est `systeme` : en production `creerSysteme()`, en test un faux. Les tests
 * n'exécutent **jamais** `ss`, `git`, `npm` ni `kill`.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerSysteme, PREMIER_PORT } from './systeme.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(ICI, '..', 'page.html'), 'utf8');
const NOM_COOKIE = 'serveurs-jeton';

/** Un refus attendu, distingué d'une panne : il porte son statut HTTP et son message public. */
function refus(statut, publicMessage) {
  const erreur = new Error(publicMessage);
  erreur.statut = statut;
  erreur.publicMessage = publicMessage;
  return erreur;
}

function json(res, statut, corps) {
  res.writeHead(statut, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corps));
}

async function corpsJson(req) {
  const morceaux = [];
  for await (const morceau of req) morceaux.push(morceau);
  const texte = Buffer.concat(morceaux).toString('utf8').trim();
  if (!texte) return {};
  try {
    return JSON.parse(texte);
  } catch {
    throw refus(400, 'corps JSON illisible');
  }
}

/**
 * Le **périmètre** : quels processus sont des serveurs de chantier, c'est-à-dire lesquels
 * **servent** l'application — Vite, en dev ou en preview. Tout ce qui écoute dans un worktree n'en
 * est pas un — un `vitest` éphémère, un `postgres`, un script de simulation, un MCP : les lister
 * remplirait la table de bruit et offrirait des boutons « tuer » sur des processus qui n'ont rien
 * à voir avec un serveur (#227).
 *
 * Cette définition est **la seule**, et c'est exprès (#245, #246) : elle sert trois fois — la page
 * pour **montrer**, `/api/tuer` pour **accepter**, `/api/journal` pour **servir**. Deux copies du
 * filtre avaient divergé, et la route de mort pouvait terminer n'importe quel processus de
 * l'utilisateur qui écoute, avec tout son arbre. Une règle qui décide de ce qu'on **tue** ne se
 * duplique pas : elle se lit ici ou pas.
 */
export function estServeurDeChantier(serveur) {
  // Un **mot** `vite` (le binaire `…/.bin/vite`, `…/vite/bin/vite.js`), pas un mot qui le
  // contient : `node …/.bin/vitest run` n'est pas un serveur de chantier, et un `/vite/` nu le
  // laissait passer — la table le montrait et la route de mort l'acceptait (#245, mesuré).
  return (serveur?.commande ?? '').split(/\s+/).some((argument) => /(^|[/\\])(vite|vite\.js)$/.test(argument));
}

/**
 * L'état affiché : les serveurs **du dépôt** (ceux dont la commande est un `vite`, selon
 * `estServeurDeChantier`), et les chantiers **avec le port qui les sert**.
 *
 * La liaison serveur ↔ chantier se fait par le **dossier de travail du processus** (`/proc`),
 * pas par le port : c'est la seule chose qui dise quelle **branche** est réellement servie —
 * le 26/10/2026, un serveur du checkout principal a servi `dev`, puis `focal-yak`, puis
 * `infra/209-migration-0008` sans que personne n'ait touché au serveur.
 */
export function construireEtat({ serveurs, chantiers }) {
  const parChemin = new Map(chantiers.map((chantier) => [chantier.chemin, chantier]));
  const retenus = serveurs.filter(estServeurDeChantier).map((serveur) => {
    const commande = serveur.commande ?? '';
    const type = /vite preview/.test(commande) ? 'preview' : 'dev';
    return {
      ...serveur,
      type,
      chantier: parChemin.get(serveur.dossier)?.nom ?? null,
      branche: parChemin.get(serveur.dossier)?.branche ?? null
    };
  });
  return {
    serveurs: retenus,
    chantiers: chantiers.map((chantier) => ({
      ...chantier,
      serveurs: retenus.filter((serveur) => serveur.dossier === chantier.chemin).map((serveur) => serveur.port)
    }))
  };
}

/**
 * Ouvre le serveur et rend son adresse. `port: 0` laisse le système choisir (c'est ce que font
 * les tests) ; `jeton` est tirable au sort pour la production, imposé par les tests.
 */
export async function demarrerServeur({
  port = 5180,
  hote = '127.0.0.1',
  jeton = randomBytes(16).toString('hex'),
  systeme = creerSysteme()
} = {}) {
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

  function jetonEgale(candidat) {
    if (typeof candidat !== 'string' || !jeton) return false;
    const attendu = Buffer.from(jeton, 'utf8');
    const donne = Buffer.from(candidat, 'utf8');
    return attendu.length === donne.length && timingSafeEqual(attendu, donne);
  }

  const etatCourant = () =>
    construireEtat({
      // Le tableau de bord s'écoute lui-même : se lister, c'est offrir un bouton « tuer » qui
      // ferme la page en cours de clic. Il se montre donc partout sauf dans sa propre table.
      serveurs: systeme.listerServeurs().filter((serveur) => serveur.pid !== process.pid),
      chantiers: systeme.listerChantiers()
    });

  /**
   * Le refus d'un processus hors périmètre, dit une seule fois : `/api/tuer` et `/api/journal`
   * lèvent le **même** refus, parce qu'ils lisent le **même** `estServeurDeChantier`. Le message
   * nomme le geste refusé, jamais un processus qu'on aurait touché (#245, #246).
   */
  function refusHorsPerimetre(cible, geste) {
    return refus(403, `${cible} écoute mais n'est pas un serveur de chantier — hors périmètre, ${geste}`);
  }

  /** Lancer : le chantier doit exister, le mode être connu, et le port libre (ou absent → proposé). */
  function lancer(corps) {
    // La route **lance** un processus : elle n'en adopte aucun, et elle n'en tue aucun. Un `pid`
    // dans le corps est donc hors périmètre — le refuser vaut mieux que l'ignorer en silence, sinon
    // l'appelant croit avoir attaché un serveur existant (#246).
    if (corps?.pid !== undefined && corps?.pid !== null) {
      throw refus(400, 'pid hors périmètre : cette route lance un processus, elle n’en adopte pas');
    }
    const chemin = String(corps?.chemin ?? '');
    const mode = String(corps?.mode ?? 'dev');
    if (mode !== 'dev' && mode !== 'preview') throw refus(400, `mode inconnu : ${mode}`);
    const chantiers = systeme.listerChantiers();
    if (!chantiers.some((chantier) => chantier.chemin === chemin)) {
      throw refus(400, `chantier inconnu : ${chemin || '(vide)'}`);
    }
    const pris = systeme.listerServeurs().map((serveur) => serveur.port);
    let portDemande = corps?.port;
    if (portDemande === undefined || portDemande === null || portDemande === '') {
      portDemande = systeme.portLibre(PREMIER_PORT);
      if (portDemande === null || portDemande === undefined) {
        throw refus(409, 'aucun port libre dans la plage proposée');
      }
    } else {
      portDemande = Number(portDemande);
      if (!Number.isInteger(portDemande) || portDemande < 1024 || portDemande > 65535) {
        throw refus(400, `port invalide : ${corps?.port}`);
      }
      if (pris.includes(portDemande)) throw refus(409, `port déjà pris : ${portDemande}`);
    }
    const lancement = systeme.lancer({ chemin, port: portDemande, mode });
    return { statut: 201, corps: { ...lancement, chemin, mode } };
  }

  /**
   * Tuer : seulement un processus qui **écoute** et que l'état courant montre — donc dans le
   * périmètre de `estServeurDeChantier`, le même que la page (#245). Un processus hors périmètre
   * est refusé **avant** que `systeme.tuer` soit appelé : c'est la route qui protège l'arbre entier
   * du processus visé, pas l'appelant.
   */
  function tuer(corps) {
    const pid = Number(corps?.pid);
    if (!Number.isInteger(pid) || pid <= 1) throw refus(400, `pid invalide : ${corps?.pid}`);
    if (pid === process.pid) throw refus(400, 'le tableau de bord ne se tue pas lui-même');
    const enEcoute = systeme.listerServeurs().find((candidat) => candidat.pid === pid);
    if (!enEcoute) throw refus(404, `aucun serveur en écoute pour le pid ${pid}`);
    if (!estServeurDeChantier(enEcoute)) {
      throw refusHorsPerimetre(`le pid ${pid}`, 'il ne se tue pas ici');
    }
    const tues = systeme.tuer(pid);
    return { statut: 200, corps: { pid, port: enEcoute.port, tues } };
  }

  /**
   * Le journal : celui d'un serveur **de chantier**, pour la même raison que la mort (#246). Un
   * port qui écoute hors périmètre est refusé (403) **avant** `systeme.lireJournal` — sinon la
   * route ouvrait `<état>/<port>.log` pour n'importe quel nombre et servait un journal que la page
   * ne montre pas. Un port dans le périmètre mais sans journal garde son 404 franc (serveur lancé
   * ailleurs, ou journal effacé).
   */
  function journal(brut) {
    const port = Number(brut);
    if (!Number.isInteger(port) || port <= 0) throw refus(400, 'port invalide');
    const enEcoute = systeme.listerServeurs().find((candidat) => candidat.port === port);
    if (enEcoute && !estServeurDeChantier(enEcoute)) {
      throw refusHorsPerimetre(`le port ${port}`, 'son journal ne se lit pas ici');
    }
    const lignes = systeme.lireJournal(port);
    if (lignes === null || lignes === undefined) {
      throw refus(404, `pas de journal pour le port ${port} — ce serveur n'a pas été lancé ici`);
    }
    return { statut: 200, corps: { port, lignes } };
  }

  const serveur = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    try {
      const parametre = url.searchParams.get('jeton');
      const cookie = jetonDuCookie(req);
      const enTete = req.headers['x-serveurs-jeton'];
      const fourni = parametre ?? cookie ?? enTete;
      if (!jetonEgale(fourni)) {
        if (cookie !== undefined || parametre !== null) {
          res.setHeader('set-cookie', `${NOM_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict`);
        }
        return json(res, 401, { erreur: 'jeton manquant ou invalide' });
      }
      if (parametre !== null && !cookie) {
        res.setHeader('set-cookie', `${NOM_COOKIE}=${jeton}; Path=/; HttpOnly; SameSite=Strict`);
      }

      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(PAGE);
      }
      if (req.method === 'GET' && url.pathname === '/api/etat') {
        const etat = etatCourant();
        const portLibre = systeme.portLibre(PREMIER_PORT);
        return json(res, 200, { ...etat, portLibre, premierPort: PREMIER_PORT });
      }
      if (req.method === 'POST' && url.pathname === '/api/lancer') {
        const resultat = lancer(await corpsJson(req));
        return json(res, resultat.statut, resultat.corps);
      }
      if (req.method === 'POST' && url.pathname === '/api/tuer') {
        const resultat = tuer(await corpsJson(req));
        return json(res, resultat.statut, resultat.corps);
      }
      if (req.method === 'GET' && url.pathname === '/api/journal') {
        const resultat = journal(url.searchParams.get('port'));
        return json(res, resultat.statut, resultat.corps);
      }
      return json(res, 404, { erreur: `route inconnue : ${req.method} ${url.pathname}` });
    } catch (erreur) {
      if (erreur && erreur.statut) return json(res, erreur.statut, { erreur: erreur.publicMessage });
      return json(res, 500, { erreur: erreur instanceof Error ? erreur.message : String(erreur) });
    }
  });

  return new Promise((resolve, reject) => {
    serveur.once('error', reject);
    serveur.listen(port, hote, () => {
      const adresse = serveur.address();
      resolve({
        baseUrl: `http://127.0.0.1:${adresse.port}`,
        jeton,
        adresse: { ...adresse },
        arreter: () => new Promise((fin) => serveur.close(() => fin()))
      });
    });
  });
}
