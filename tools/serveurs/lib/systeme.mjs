/**
 * La machine, vue par le tableau de bord des serveurs (#227, D-102).
 *
 * C'est la **seule couture** de l'outil qui touche à la machine — et elle est coupée en deux
 * natures, exprès :
 *
 * 1. les **analyseurs**, purs : ils transforment la sortie d'une commande en objet. C'est ce
 *    que les tests éprouvent, sans lancer `ss`, `ps` ni `git` ;
 * 2. le **système réel** (`creerSysteme()`), qui appelle les commandes, lit `/proc` et rend les
 *    mêmes objets. Les tests ne l'emploient **jamais** : ils injectent un faux système.
 *
 * La leçon de la nuit du 25 au 26/10/2026 est écrite dans les fonctions de mort : un `npm run
 * dev` est un **arbre** (`npm` → `sh -c` → `node …/vite`), et tuer l'enveloppe laisse le `node`
 * vivant, qui **garde le port**. On tue donc l'arbre, feuilles d'abord.
 */
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

/** Le plafond de ports proposés : au-delà, on ne cherche plus. */
export const PLAFOND_PORT = 5299;

/** Le premier port proposé par défaut (5178 est l'ancien port, 5179/5180 sont pris par la maison). */
export const PREMIER_PORT = 5181;

/**
 * Une ligne de `ss -ltnp` : `LISTEN 0 511 127.0.0.1:5179 0.0.0.0:* users:(("node",pid=1,fd=24))`.
 *
 * `ss` n'affiche le PID que pour les processus de l'utilisateur (ou en root) : une ligne sans
 * `users:` est donc **écartée** plutôt que devinée — un serveur qu'on ne peut pas nommer ne se
 * surveille pas et ne se tue pas.
 */
const SOCKET = /^LISTEN\s+\d+\s+\d+\s+(\S+)\s+\S+\s+users:\(\("([^"]+)",pid=(\d+),/;

/** Les sockets en écoute, réduits à ce qu'on en montre : port, pid, nom du programme. */
export function analyserSs(sortie) {
  const trouves = [];
  for (const brute of String(sortie).split('\n')) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const trouve = SOCKET.exec(ligne);
    if (!trouve) continue;
    const adresse = trouve[1];
    const port = Number(adresse.slice(adresse.lastIndexOf(':') + 1));
    if (!Number.isInteger(port) || port <= 0) continue;
    trouves.push({ port, pid: Number(trouve[3]), comm: trouve[2] });
  }
  // Un port ne s'écoute qu'une fois, mais on dédoublonne quand même : une double écoute en
  // SO_REUSEPORT produirait deux lignes et deux boutons « tuer » pour le même serveur.
  return trouves.filter((s, index) => trouves.findIndex((a) => a.port === s.port) === index);
}

/** La commande d'un processus, lisible (`/proc/<pid>/cmdline` est séparé par des zéros). */
export function analyserCmdline(brut) {
  return String(brut).split('\0').filter(Boolean).join(' ').trim();
}

/**
 * `git worktree list --porcelain` : des blocs séparés par une ligne vide.
 *
 * ```
 * worktree /chemin/du/worktree
 * HEAD 623ca71…
 * branch refs/heads/dev
 * ```
 *
 * ou, pour un HEAD détaché, `detached` à la place de `branch` : c'est justement l'état qu'un
 * commit perdu guette (`npm run isolation` en fait un contrôle), donc on l'affiche tel quel.
 */
export function analyserWorktrees(porcelain) {
  const blocs = [];
  let courant = null;
  for (const brute of String(porcelain).split('\n')) {
    const ligne = brute.trim();
    if (!ligne) {
      if (courant) blocs.push(courant);
      courant = null;
      continue;
    }
    const espace = ligne.indexOf(' ');
    const cle = espace === -1 ? ligne : ligne.slice(0, espace);
    const valeur = espace === -1 ? '' : ligne.slice(espace + 1);
    if (cle === 'worktree') {
      if (courant) blocs.push(courant);
      courant = { chemin: valeur, tete: null, branche: null, detache: false, nu: false };
      continue;
    }
    if (!courant) continue;
    if (cle === 'HEAD') courant.tete = valeur;
    else if (cle === 'branch') courant.branche = valeur.replace(/^refs\/heads\//, '');
    else if (cle === 'detached') courant.detache = true;
    else if (cle === 'bare') courant.nu = true;
  }
  if (courant) blocs.push(courant);

  return blocs.map((bloc) => ({
    chemin: bloc.chemin,
    nom: basename(bloc.chemin),
    tete: bloc.tete ? bloc.tete.slice(0, 7) : null,
    branche: bloc.detache ? null : bloc.branche,
    detache: bloc.detache,
    nu: bloc.nu
  }));
}

/**
 * L'en-tête de `git status --porcelain=v1 -b` :
 * `## dev...origin/dev [ahead 2, behind 1]`, `## No commits yet on main`, ou `## HEAD (no branch)`.
 */
export function analyserEnteteStatut(ligne) {
  const texte = String(ligne)
    .trim()
    .replace(/^##\s*/, '');
  const crochet = /\[(.+)\]$/.exec(texte);
  const reste = crochet ? texte.slice(0, crochet.index).trim() : texte;
  const morceaux = reste.split('...');
  const compte = (mot) => {
    const trouve = crochet ? new RegExp(`${mot} (\\d+)`).exec(crochet[1]) : null;
    return trouve ? Number(trouve[1]) : 0;
  };
  return {
    branche: morceaux[0].replace(/^No commits yet on /, ''),
    suivi: morceaux[1] ?? null,
    enAvance: compte('ahead'),
    enRetard: compte('behind')
  };
}

/** Le premier port libre à partir de `depart`, en sautant `pris`. `null` si le plafond est atteint. */
export function prochainLibre(pris, { depart = PREMIER_PORT, plafond = PLAFOND_PORT } = {}) {
  const occupes = new Set(pris);
  for (let port = depart; port <= plafond; port += 1) {
    if (!occupes.has(port)) return port;
  }
  return null;
}

/** Les `nombre` dernières lignes d'un journal — jamais le fichier entier : il grossit sans fin. */
export function dernieresLignes(texte, nombre = 200) {
  const lignes = String(texte).split('\n');
  if (lignes.length && lignes[lignes.length - 1] === '') lignes.pop();
  return lignes.slice(-nombre);
}

/**
 * Vite écrit ses couleurs ANSI dans son journal même sous `FORCE_COLOR=0` : on les retire, sinon
 * la page affiche `[32m` au lieu du texte. Un journal se lit, il ne s'analyse pas.
 */
export function sansAnsi(texte) {
  return String(texte).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

/** Où vivent les journaux des serveurs lancés par l'outil — hors du dépôt, comme le poste de pilotage. */
export function dossierEtatParDefaut(env = process.env) {
  if (env.SERVEURS_ETAT) return env.SERVEURS_ETAT;
  return join(homedir(), '.local', 'state', 'planquex-serveurs');
}

/** Le journal d'un port : un fichier par port, donc une reprise sur le même port réécrit le sien. */
export function cheminJournal(dossierEtat, port) {
  return join(dossierEtat, `${port}.log`);
}

/** L'exécution réelle, synchrone : trois commandes, jamais de shell (aucune injection possible). */
function executerReel(commande, args, options = {}) {
  return execFileSync(commande, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...options });
}

/** Les enfants directs de chaque processus, lus une fois dans `/proc` — pour tuer un arbre entier. */
function arbreDesProcessus(pid) {
  const enfants = new Map();
  for (const entree of readdirSync('/proc')) {
    if (!/^\d+$/.test(entree)) continue;
    let stat;
    try {
      stat = readFileSync(`/proc/${entree}/stat`, 'utf8');
    } catch {
      continue;
    }
    // Le champ 4 est le PPID ; le nom du programme (champ 2) peut contenir des espaces et des
    // parenthèses, donc on repart de la **dernière** parenthèse fermante.
    const fin = stat.lastIndexOf(')');
    const champs = stat.slice(fin + 2).split(' ');
    const parent = Number(champs[1]);
    if (!Number.isInteger(parent)) continue;
    enfants.set(parent, [...(enfants.get(parent) ?? []), Number(entree)]);
  }
  const tous = [];
  const pile = [pid];
  while (pile.length) {
    const courant = pile.pop();
    tous.push(courant);
    pile.push(...(enfants.get(courant) ?? []));
  }
  return tous;
}

/** L'âge de chaque processus, en secondes, en un seul appel — `etimes` est le temps écoulé. */
function ages(pidListe) {
  if (!pidListe.length) return new Map();
  const sortie = executerReel('ps', ['-o', 'pid=,etimes=', '-p', pidListe.join(',')]);
  const table = new Map();
  for (const brute of sortie.split('\n')) {
    const [pid, secondes] = brute.trim().split(/\s+/);
    if (pid && secondes) table.set(Number(pid), Number(secondes));
  }
  return table;
}

/**
 * Le système réel. `racine` est le dépôt dont on lit les worktrees (n'importe lequel des
 * worktrees convient : `git worktree list` les rend tous), `etat` le dossier des journaux.
 */
export function creerSysteme({ racine = process.cwd(), etat = dossierEtatParDefaut(), executer = executerReel } = {}) {
  const lire = (commande, args, options) => {
    try {
      return executer(commande, args, options);
    } catch {
      return '';
    }
  };

  const listerServeurs = () => {
    const sockets = analyserSs(lire('ss', ['-ltnp']));
    const tableAges = ages(sockets.map((s) => s.pid));
    return sockets.map((socket) => {
      let dossier = null;
      try {
        dossier = readlinkSync(`/proc/${socket.pid}/cwd`);
      } catch {
        dossier = null;
      }
      let commande = '';
      try {
        commande = analyserCmdline(readFileSync(`/proc/${socket.pid}/cmdline`, 'utf8'));
      } catch {
        commande = socket.comm;
      }
      return {
        ...socket,
        dossier,
        commande,
        age: tableAges.get(socket.pid) ?? null
      };
    });
  };

  const listerChantiers = () => {
    const bruts = analyserWorktrees(lire('git', ['-C', racine, 'worktree', 'list', '--porcelain']));
    return bruts.map((bloc) => {
      const statut = lire('git', ['-C', bloc.chemin, 'status', '--porcelain=v1', '-b']);
      const lignes = statut.split('\n').filter((l) => l !== '');
      const entete = analyserEnteteStatut(lignes[0] ?? '');
      return {
        ...bloc,
        branche: bloc.branche || entete.branche || null,
        modifs: Math.max(0, lignes.length - (lignes.length ? 1 : 0)),
        enAvance: entete.enAvance,
        enRetard: entete.enRetard
      };
    });
  };

  const lancer = ({ chemin, port, mode = 'dev' }) => {
    mkdirSync(etat, { recursive: true });
    const fichier = cheminJournal(etat, port);
    const descripteur = openSync(fichier, 'a');
    const script = mode === 'preview' ? 'preview' : 'dev';
    const enfant = spawn('npm', ['run', script, '--', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
      cwd: chemin,
      detached: true,
      stdio: ['ignore', descripteur, descripteur],
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    enfant.unref();
    closeSync(descripteur);
    return { pid: enfant.pid ?? null, port, journal: fichier };
  };

  /**
   * Le geste de mort : l'arbre entier, **feuilles d'abord**, puis un `SIGKILL` sur les
   * survivants. Mesuré le 26/10/2026 : un `kill` sur `npm` laisse `node …/vite` en vie avec le
   * port dans la main.
   */
  const tuer = (pid) => {
    const arbre = arbreDesProcessus(pid).reverse();
    for (const cible of arbre) {
      try {
        process.kill(cible, 'SIGTERM');
      } catch {
        // déjà mort
      }
    }
    // Attente courte : laisse le temps à Vite d'écrire son arrêt avant le coup de grâce.
    // `Atomics.wait` dort sans tourner la CPU — une boucle d'horloge brûlerait un cœur.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
    for (const cible of arbre) {
      try {
        process.kill(cible, 'SIGKILL');
      } catch {
        // déjà mort
      }
    }
    return arbre;
  };

  const lireJournal = (port, nombre = 200) => {
    try {
      return dernieresLignes(sansAnsi(readFileSync(cheminJournal(etat, port), 'utf8')), nombre);
    } catch {
      return null;
    }
  };

  return {
    racine,
    etat,
    listerServeurs,
    listerChantiers,
    lancer,
    tuer,
    lireJournal,
    portLibre: (depart = PREMIER_PORT) =>
      prochainLibre(
        listerServeurs().map((s) => s.port),
        { depart }
      )
  };
}
