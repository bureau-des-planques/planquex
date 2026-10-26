/**
 * Le serveur HTTP du tableau de bord des serveurs (#227, D-101).
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
 * L'état affiché : les serveurs **du dépôt** (ceux dont le dossier est un chantier connu, ou
 * dont la commande est un `vite`), et les chantiers **avec le port qui les sert**.
 *
 * La liaison serveur ↔ chantier se fait par le **dossier de travail du processus** (`/proc`),
 * pas par le port : c'est la seule chose qui dise quelle **branche** est réellement servie —
 * le 26/10/2026, un serveur du checkout principal a servi `dev`, puis `focal-yak`, puis
 * `infra/209-migration-0008` sans que personne n'ait touché au serveur.
 */
export function construireEtat({ serveurs, chantiers }) {
  const parChemin = new Map(chantiers.map((chantier) => [chantier.chemin, chantier]));
  const retenus = serveurs
    // Un « serveur de chantier » est un processus qui **sert** l'application : Vite, en dev ou en
    // preview. Tout ce qui écoute dans un worktree n'en est pas un — un `vitest` éphémère, un
    // script de simulation, un MCP : les lister remplirait la table de bruit et offrirait des
    // boutons « tuer » sur des processus qui n'ont rien à voir avec un serveur (#227).
    .filter((serveur) => /vite/.test(serveur.commande ?? ''))
    .map((serveur) => {
      const commande = serveur.commande ?? '';
      const type = /vite preview/.test(commande) ? 'preview' : 'dev';
      return {
        ...serveur,
        type,
        chantier: parChemin.get(serveur.dossier)?.nom ?? null,
        branche: parChemin.get(serveur.dossier)?.branche ?? null,
      };
    });
  return {
    serveurs: retenus,
    chantiers: chantiers.map((chantier) => ({
      ...chantier,
      serveurs: retenus.filter((serveur) => serveur.dossier === chantier.chemin).map((serveur) => serveur.port),
    })),
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
  systeme = creerSysteme(),
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
      chantiers: systeme.listerChantiers(),
    });

  /** Lancer : le chantier doit exister, le mode être connu, et le port libre (ou absent → proposé). */
  function lancer(corps) {
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

  /** Tuer : seulement un processus qui **écoute** et que l'état courant montre. */
  function tuer(corps) {
    const pid = Number(corps?.pid);
    if (!Number.isInteger(pid) || pid <= 1) throw refus(400, `pid invalide : ${corps?.pid}`);
    if (pid === process.pid) throw refus(400, 'le tableau de bord ne se tue pas lui-même');
    const serveur = systeme.listerServeurs().find((candidat) => candidat.pid === pid);
    if (!serveur) throw refus(404, `aucun serveur en écoute pour le pid ${pid}`);
    const tues = systeme.tuer(pid);
    return { statut: 200, corps: { pid, port: serveur.port, tues } };
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
        const port = Number(url.searchParams.get('port'));
        if (!Number.isInteger(port) || port <= 0) throw refus(400, 'port invalide');
        const lignes = systeme.lireJournal(port);
        if (lignes === null || lignes === undefined) {
          throw refus(404, `pas de journal pour le port ${port} — ce serveur n'a pas été lancé ici`);
        }
        return json(res, 200, { port, lignes });
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
        arreter: () => new Promise((fin) => serveur.close(() => fin())),
      });
    });
  });
}
