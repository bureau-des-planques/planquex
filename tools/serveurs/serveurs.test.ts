// @vitest-environment node
/**
 * Le tableau de bord des serveurs et des chantiers — `tools/serveurs/` (#227, D-102).
 *
 * Deux familles de contrôles, et une seule couture :
 *
 * 1. les **analyseurs** (`lib/systeme.mjs`) sont purs : on leur donne la sortie de `ss`, de
 *    `git worktree list --porcelain` et de `git status -b`, et on exige ce qu'ils en tirent ;
 * 2. l'**API HTTP** (`lib/app.mjs`) reçoit un **faux système** injecté : aucun test ne lance
 *    `ss`, `git`, `npm` ni `kill`, et aucun ne touche le réseau (port `0`, `127.0.0.1`).
 *
 * Chaque garde **mord** (`AGENTS.md` §6, #112) : les cas fautifs sont là pour échouer — un
 * port déjà pris, un pid qui n'écoute pas, un jeton faux, un argument inconnu. Le 26/10/2026,
 * c'est précisément un port resté dans la main d'un `node` orphelin qu'on n'avait pas su voir.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { construireEtat, demarrerServeur, estServeurDeChantier } from './lib/app.mjs';
import {
  analyserCmdline,
  analyserEnteteStatut,
  analyserSs,
  analyserWorktrees,
  dernieresLignes,
  prochainLibre,
  sansAnsi,
} from './lib/systeme.mjs';
import { lireArguments } from './serveur.mjs';

const JETON = 'jeton-de-test-227';

/** La sortie réelle de `ss -ltnp` sur la machine du 26/10/2026, avec ses trois formes d'adresse. */
const SS = [
  'State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process',
  'LISTEN 0      511          127.0.0.1:5179       0.0.0.0:*    users:(("node",pid=1387117,fd=24))',
  'LISTEN 0      511                *:4181             *:*    users:(("node",pid=594420,fd=22))',
  'LISTEN 0      511               [::]:631              [::]:*    users:(("cupsd",pid=900,fd=7))',
  // Un socket sans PID visible (processus d’un autre utilisateur) : il n’est pas nommable.
  'LISTEN 0      128             0.0.0.0:22          0.0.0.0:*   ',
].join('\n');

const WORKTREES = [
  'worktree /home/chapax/Documents/opencode/gamedev/planquex',
  'HEAD 7474077aaaaaabbbbbbccccccddddddeeeeeeee',
  'branch refs/heads/main',
  '',
  'worktree /home/chapax/.local/share/opencode/worktree/c35298821e23cdc626119cdc171a8eb423622141/dev-jolly-cactus',
  'HEAD 623ca71aaaaaabbbbbbccccccddddddeeeeeeee',
  'branch refs/heads/dev',
  '',
  'worktree /home/chapax/.local/share/opencode/worktree/c35298821e23cdc626119cdc171a8eb423622141/perdu',
  'HEAD 80ed399aaaaaabbbbbbccccccddddddeeeeeeee',
  'detached',
  '',
].join('\n');

function fauxSysteme({ serveurs = [], chantiers = [], journaux = {} }) {
  const appels = { lances: [], tues: [], libre: [] };
  return {
    appels,
    listerServeurs: () => serveurs,
    listerChantiers: () => chantiers,
    lancer: ({ chemin, port, mode }) => {
      appels.lances.push({ chemin, port, mode });
      return { pid: 9000, port, journal: `/faux/${port}.log` };
    },
    tuer: (pid) => {
      appels.tues.push(pid);
      return [pid, pid + 1];
    },
    lireJournal: (port) => journaux[port] ?? null,
    portLibre: (depart) => {
      appels.libre.push(depart);
      return 5185;
    },
  };
}

const CHANTIERS = [
  { chemin: '/depot/dev', nom: 'dev', branche: 'dev', tete: '623ca71', detache: false, nu: false, modifs: 0, enAvance: 0, enRetard: 0 },
  { chemin: '/depot/sale', nom: 'sale', branche: '220-vocabulaire', tete: 'c580d4d', detache: false, nu: false, modifs: 3, enAvance: 2, enRetard: 0 },
];

const SERVEURS = [
  { port: 5179, pid: 101, comm: 'node', dossier: '/depot/dev', commande: 'node /depot/dev/node_modules/.bin/vite --port 5179', age: 90 },
  { port: 4181, pid: 202, comm: 'node', dossier: '/depot/dev', commande: 'node /depot/dev/node_modules/.bin/vite preview --port 4181', age: 7200 },
  // Postgres : il écoute, il n'est pas du dépôt, il ne doit pas apparaître.
  { port: 5432, pid: 303, comm: 'postgres', dossier: '/var/lib/pg', commande: 'postgres -D /var/lib/pg', age: 99999 },
  // processeur d'images sans serveur http ? écoute quand même : hors dépôt, mais vite ? non.
];

/** Le seul lancement d'API utilisé par les tests : port `0`, donc une adresse éphémère. */
async function avecServeur(options = {}) {
  return demarrerServeur({ port: 0, hote: '127.0.0.1', jeton: JETON, systeme: fauxSysteme(options) });
}

function demander(baseUrl, chemin, { methode = 'GET', corps, jeton = JETON } = {}) {
  const enTetes = {};
  if (jeton !== null) enTetes['x-serveurs-jeton'] = jeton;
  if (corps !== undefined) enTetes['content-type'] = 'application/json';
  return fetch(`${baseUrl}${chemin}`, {
    method: methode,
    headers: enTetes,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
}

describe('lib/systeme.mjs — les analyseurs, sans toucher à la machine', () => {
  it('lit les sockets en écoute, et écarte ceux qui n’ont pas de PID', () => {
    const sockets = analyserSs(SS);
    expect(sockets.map((s) => s.port)).toEqual([5179, 4181, 631]);
    expect(sockets[0]).toEqual({ port: 5179, pid: 1387117, comm: 'node' });
    // Le socket SSH sans `users:` n'est pas devinable : il ne doit pas apparaître.
    expect(sockets.some((s) => s.port === 22)).toBe(false);
  });

  it('le contrôle mord : une double écoute ne donne qu’un bouton « tuer »', () => {
    const double = [
      'LISTEN 0 511 127.0.0.1:5181 0.0.0.0:* users:(("node",pid=11,fd=20))',
      'LISTEN 0 511 127.0.0.1:5181 0.0.0.0:* users:(("node",pid=12,fd=21))',
    ].join('\n');
    expect(analyserSs(double)).toHaveLength(1);
  });

  it('rend la commande d’un processus, séparée par des zéros dans /proc', () => {
    expect(analyserCmdline('node\0/tmp/vite\0--port\0' + '5179\0')).toBe('node /tmp/vite --port 5179');
    expect(analyserCmdline('')).toBe('');
  });

  it('lit `git worktree list --porcelain`, détachement compris', () => {
    const chantiers = analyserWorktrees(WORKTREES);
    expect(chantiers).toHaveLength(3);
    expect(chantiers[0]).toMatchObject({ nom: 'planquex', branche: 'main', tete: '7474077', detache: false });
    expect(chantiers[1]).toMatchObject({ nom: 'dev-jolly-cactus', branche: 'dev', tete: '623ca71' });
    // Un HEAD détaché n'a pas de branche — et c'est justement ce qu'il faut voir.
    expect(chantiers[2]).toMatchObject({ nom: 'perdu', branche: null, detache: true });
  });

  it('lit l’en-tête de `git status -b` : avance, retard, branche sans commits', () => {
    expect(analyserEnteteStatut('## dev...origin/dev [ahead 2, behind 1]')).toEqual({
      branche: 'dev',
      suivi: 'origin/dev',
      enAvance: 2,
      enRetard: 1,
    });
    expect(analyserEnteteStatut('## dev')).toEqual({ branche: 'dev', suivi: null, enAvance: 0, enRetard: 0 });
    expect(analyserEnteteStatut('## No commits yet on main').branche).toBe('main');
    expect(analyserEnteteStatut('## HEAD (no branch)').suivi).toBe(null);
  });

  it('le contrôle mord : le port proposé saute ceux qui sont pris', () => {
    expect(prochainLibre([5178, 5179, 5180])).toBe(5181);
    expect(prochainLibre([5181, 5182, 5185])).toBe(5183);
    expect(prochainLibre([5181], { depart: 5200 })).toBe(5200);
    // Plafond atteint : on ne propose pas un port au hasard, on rend `null`.
    expect(prochainLibre([5199], { depart: 5199, plafond: 5199 })).toBe(null);
  });

  it('ne rend que les dernières lignes d’un journal', () => {
    const texte = ['a', 'b', 'c', 'd', ''].join('\n');
    expect(dernieresLignes(texte, 2)).toEqual(['c', 'd']);
    expect(dernieresLignes('', 5)).toEqual([]);
  });

  it('le contrôle mord : les couleurs ANSI de Vite ne salissent pas le journal', () => {
    const brut = '\x1b[32m\x1b[1mVITE\x1b[22m v8.3.4\x1b[39m  ready\n\x1b[36m➜\x1b[39m Local: \x1b[1mhttp://127.0.0.1:5181/\x1b[22m';
    expect(sansAnsi(brut)).toBe('VITE v8.3.4  ready\n➜ Local: http://127.0.0.1:5181/');
  });
});

describe('serveur.mjs — les arguments', () => {
  it('lit --port et --no-open', () => {
    expect(lireArguments(['--port', '5190', '--no-open'])).toEqual({ port: 5190, ouvrir: false });
    expect(lireArguments([])).toEqual({ port: 5180, ouvrir: true });
  });

  it('le contrôle mord : un argument inconnu ou un port invalide est refusé', () => {
    expect(() => lireArguments(['--turbo'])).toThrow(/argument inconnu/);
    expect(() => lireArguments(['--port', 'zéro'])).toThrow(/port invalide/);
    expect(() => lireArguments(['--port', '70000'])).toThrow(/port invalide/);
  });
});

describe('lib/app.mjs — l’état affiché', () => {
  it('garde les serveurs du dépôt, écarte le reste, et noue le port à son chantier', () => {
    const etat = construireEtat({ serveurs: SERVEURS, chantiers: CHANTIERS });
    expect(etat.serveurs.map((s) => s.port)).toEqual([5179, 4181]);
    expect(etat.serveurs[0]).toMatchObject({ type: 'dev', chantier: 'dev', branche: 'dev' });
    expect(etat.serveurs[1]).toMatchObject({ type: 'preview', chantier: 'dev' });
    // La liaison se fait par le dossier du processus, pas par le port.
    expect(etat.chantiers.find((c) => c.nom === 'dev').serveurs).toEqual([5179, 4181]);
    expect(etat.chantiers.find((c) => c.nom === 'sale').serveurs).toEqual([]);
  });

  it('le contrôle mord : un serveur hors dépôt qui n’est pas Vite ne s’affiche pas', () => {
    const etat = construireEtat({ serveurs: SERVEURS, chantiers: [] });
    expect(etat.serveurs.map((s) => s.port)).toEqual([5179, 4181]);
    expect(etat.serveurs.some((s) => s.port === 5432)).toBe(false);
  });

  it('le contrôle mord : `vitest` n’est pas `vite` — ni affiché, ni tuable', () => {
    // Un `/vite/` nu laissait passer `node …/.bin/vitest run` : il s'affichait dans la table, et
    // la route `/api/tuer` acceptait son pid (son arbre entier, workers compris). Les deux
    // lectures du périmètre doivent dire non, et elles disent non au **même** endroit.
    const vitest = { port: 51234, pid: 404, comm: 'node', dossier: '/depot/dev', commande: 'node /depot/dev/node_modules/.bin/vitest run --pool forks', age: 12 };
    const etat = construireEtat({ serveurs: [vitest, ...SERVEURS], chantiers: CHANTIERS });
    expect(etat.serveurs.map((s) => s.port)).toEqual([5179, 4181]);

    // Le binaire, lui, reste reconnu — y compris par son vrai chemin (`vite/bin/vite.js`).
    expect(estServeurDeChantier({ commande: 'node /depot/dev/node_modules/.bin/vite --port 5179' })).toBe(true);
    expect(estServeurDeChantier({ commande: 'node /depot/dev/node_modules/vite/bin/vite.js preview --port 4181' })).toBe(true);
    expect(estServeurDeChantier({ commande: 'node /depot/dev/node_modules/.bin/vitest run' })).toBe(false);
    expect(estServeurDeChantier({})).toBe(false);
  });
});

describe('lib/app.mjs — l’API HTTP', () => {
  const ouvertes = [];
  afterEach(async () => {
    while (ouvertes.length) await ouvertes.pop().arreter();
  });

  async function ouvrir(options) {
    const serveur = await avecServeur(options);
    ouvertes.push(serveur);
    return serveur;
  }

  it('n’écoute que sur 127.0.0.1', async () => {
    const serveur = await ouvrir({});
    expect(serveur.adresse.address).toBe('127.0.0.1');
  });

  it('le contrôle mord : sans jeton ou avec un faux jeton, 401', async () => {
    const serveur = await ouvrir({ serveurs: SERVEURS, chantiers: CHANTIERS });
    expect((await demander(serveur.baseUrl, '/api/etat', { jeton: null })).status).toBe(401);
    expect((await demander(serveur.baseUrl, '/api/etat', { jeton: 'faux' })).status).toBe(401);
    // et l’écriture est refusée de la même façon : on ne tue pas un processus anonymement
    const tuer = await demander(serveur.baseUrl, '/api/tuer', { methode: 'POST', corps: { pid: 101 }, jeton: 'faux' });
    expect(tuer.status).toBe(401);
  });

  it('sert la page avec le jeton, et pose le cookie', async () => {
    const serveur = await ouvrir({});
    const reponse = await demander(serveur.baseUrl, `/?jeton=${JETON}`, { jeton: null });
    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toContain('Serveurs et chantiers');
    expect(reponse.headers.get('set-cookie')).toContain('serveurs-jeton');
  });

  it('rend l’état, le port libre proposé et son point de départ', async () => {
    const serveur = await ouvrir({ serveurs: SERVEURS, chantiers: CHANTIERS });
    const reponse = await demander(serveur.baseUrl, '/api/etat');
    const corps = await reponse.json();
    expect(reponse.status).toBe(200);
    expect(corps.serveurs).toHaveLength(2);
    expect(corps.chantiers).toHaveLength(2);
    expect(corps.portLibre).toBe(5185);
    expect(corps.premierPort).toBe(5181);
  });

  it('le contrôle mord : le tableau de bord ne se montre pas dans sa propre table', async () => {
    // Le processus qui répond est celui du test ; un faux système qui le déclare en écoute ne
    // doit pas produire une ligne avec un bouton « tuer » qui fermerait la page en cours de clic.
    const intrus = { port: 5180, pid: process.pid, comm: 'node', dossier: '/depot/dev', commande: 'node /depot/dev/node_modules/.bin/vite --port 5180', age: 1 };
    const serveur = await ouvrir({ serveurs: [intrus, ...SERVEURS], chantiers: CHANTIERS });
    const corps = await (await demander(serveur.baseUrl, '/api/etat')).json();
    expect(corps.serveurs.some((s) => s.pid === process.pid)).toBe(false);
    expect(corps.serveurs.map((s) => s.port)).toEqual([5179, 4181]);

    const refus = await demander(serveur.baseUrl, '/api/tuer', { methode: 'POST', corps: { pid: process.pid } });
    expect(refus.status).toBe(400);
    expect((await refus.json()).erreur).toMatch(/ne se tue pas lui-même/);
  });

  it('lance un serveur sur un chantier connu, port proposé', async () => {
    const systeme = fauxSysteme({ serveurs: SERVEURS, chantiers: CHANTIERS });
    const serveur = await demarrerServeur({ port: 0, jeton: JETON, systeme });
    ouvertes.push(serveur);
    const reponse = await demander(serveur.baseUrl, '/api/lancer', {
      methode: 'POST',
      corps: { chemin: '/depot/sale', mode: 'dev' },
    });
    const corps = await reponse.json();
    expect(reponse.status).toBe(201);
    expect(corps).toMatchObject({ pid: 9000, port: 5185, mode: 'dev', chemin: '/depot/sale' });
    expect(systeme.appels.lances).toEqual([{ chemin: '/depot/sale', port: 5185, mode: 'dev' }]);
  });

  it('le contrôle mord : chantier inconnu (400), port pris (409), mode inconnu (400)', async () => {
    const systeme = fauxSysteme({ serveurs: SERVEURS, chantiers: CHANTIERS });
    const serveur = await demarrerServeur({ port: 0, jeton: JETON, systeme });
    ouvertes.push(serveur);

    const inconnu = await demander(serveur.baseUrl, '/api/lancer', { methode: 'POST', corps: { chemin: '/depot/ailleurs' } });
    expect(inconnu.status).toBe(400);

    const pris = await demander(serveur.baseUrl, '/api/lancer', {
      methode: 'POST',
      corps: { chemin: '/depot/dev', port: 5179 },
    });
    expect(pris.status).toBe(409);
    expect((await pris.json()).erreur).toMatch(/déjà pris/);

    const mode = await demander(serveur.baseUrl, '/api/lancer', {
      methode: 'POST',
      corps: { chemin: '/depot/dev', mode: 'production' },
    });
    expect(mode.status).toBe(400);

    // Aucun de ces refus n'a lancé de processus : c'est le point du contrôle.
    expect(systeme.appels.lances).toEqual([]);
  });

  it('tue un serveur qui écoute, et rien d’autre', async () => {
    const systeme = fauxSysteme({ serveurs: SERVEURS, chantiers: CHANTIERS });
    const serveur = await demarrerServeur({ port: 0, jeton: JETON, systeme });
    ouvertes.push(serveur);

    const ok = await demander(serveur.baseUrl, '/api/tuer', { methode: 'POST', corps: { pid: 101 } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).tues).toEqual([101, 102]);
    expect(systeme.appels.tues).toEqual([101]);

    // Le contrôle mord : un pid qui n'écoute pas ne se tue pas par cette route.
    const inconnu = await demander(serveur.baseUrl, '/api/tuer', { methode: 'POST', corps: { pid: 4242 } });
    expect(inconnu.status).toBe(404);
    expect(systeme.appels.tues).toEqual([101]);
  });

  it('le contrôle mord : un processus qui écoute sans être un serveur de chantier ne se tue pas', async () => {
    // Le cas du ticket #245 : la route cherchait dans la liste **non filtrée**, donc un `POST`
    // muni du jeton pouvait terminer n'importe quel processus de l'utilisateur qui écoute — ici
    // un `vitest` éphémère dans un worktree, mais aussi un `postgres` ou un MCP — avec tout son
    // arbre. La page, elle, ne montrait déjà que les serveurs de chantier.
    const horsPerimetre = {
      port: 51234,
      pid: 404,
      comm: 'node',
      dossier: '/depot/dev',
      commande: 'node /depot/dev/node_modules/.bin/vitest run --pool forks',
      age: 12,
    };
    const systeme = fauxSysteme({ serveurs: [horsPerimetre, ...SERVEURS], chantiers: CHANTIERS });
    const serveur = await demarrerServeur({ port: 0, jeton: JETON, systeme });
    ouvertes.push(serveur);

    const refus = await demander(serveur.baseUrl, '/api/tuer', { methode: 'POST', corps: { pid: 404 } });
    expect(refus.status).toBeGreaterThanOrEqual(400);
    expect(refus.status).toBeLessThan(500);
    expect((await refus.json()).erreur).toMatch(/serveur de chantier/);
    // Rien n'a été tué : `tuer` n'est jamais appelé, et l'arbre du processus reste entier.
    expect(systeme.appels.tues).toEqual([]);
  });

  it('sert le journal d’un port, et dit franchement quand il n’y en a pas', async () => {
    const avecJournal = fauxSysteme({ serveurs: SERVEURS, chantiers: CHANTIERS, journaux: { 5179: ['VITE v8.3.4', 'Local: http://127.0.0.1:5179/'] } });
    const serveur = await demarrerServeur({ port: 0, jeton: JETON, systeme: avecJournal });
    ouvertes.push(serveur);
    const ok = await demander(serveur.baseUrl, '/api/journal?port=5179');
    expect(ok.status).toBe(200);
    expect((await ok.json()).lignes).toEqual(['VITE v8.3.4', 'Local: http://127.0.0.1:5179/']);

    const sans = await demander(serveur.baseUrl, '/api/journal?port=4181');
    expect(sans.status).toBe(404);
    expect((await sans.json()).erreur).toMatch(/pas de journal/);

    const invalide = await demander(serveur.baseUrl, '/api/journal?port=zéro');
    expect(invalide.status).toBe(400);
  });

  it('rend 404 sur une route inconnue', async () => {
    const serveur = await ouvrir({});
    expect((await demander(serveur.baseUrl, '/api/inconnue')).status).toBe(404);
  });
});
