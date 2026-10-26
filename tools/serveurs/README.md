# Le tableau de bord des serveurs (`tools/serveurs/`)

`npm run serveurs` démarre un petit serveur Node sur `127.0.0.1:5180` et ouvre une page qui
montre **les serveurs en cours**, **les chantiers** (les worktrees du dépôt) et permet d'en
**lancer** ou d'en **tuer** un — pour voir ce qui tourne, sur quelle branche, et arrêter ce qui
traîne.

Il ne fait **pas** partie du jeu : aucun de ses fichiers n'entre dans le bundle Vite, il n'est
jamais déployé, et il ne peut pas être atteint depuis le réseau.

## Pourquoi il existe (#227, D-102)

Le 26/10/2026, trois serveurs Vite tournaient sur la machine sans que personne sache sur quoi :
`5178` (le checkout principal, changé de branche trois fois dans la nuit), et deux `vite preview`
orphelins sur `4181`/`4182`. Un serveur Vite **suit les fichiers** : un `git checkout` change ce
qu'on regarde, sans rien dire. Et à côté de ça, quatorze worktrees ouverts, chacun sur sa branche.

La leçon de la mort des serveurs est dans le code : un `npm run dev` est un **arbre**
(`npm` → `sh -c` → `node …/vite`), et tuer l'enveloppe laisse le `node` vivant qui garde le port.
L'outil tue donc l'arbre, feuilles d'abord.

## Ce qu'il fait

- **Serveurs en cours** : port, type (`dev` ou `preview`), **dossier de travail du processus**,
  **branche réellement servie** (lue dans `/proc/<pid>/cwd`, pas dans le dossier du jour), âge,
  PID. La branche affichée est celle que le serveur sert **vraiment**.
- **Chantiers** : chaque worktree du dépôt, sa branche, son HEAD court, son état git (propre,
  N modifications, en avance de N, en retard de N), et **quels ports le servent**.
- **Lancer** : sur un chantier choisi, en `dev` ou en `preview`, sur le premier port libre à
  partir de `5181` (ou un port imposé), toujours `--strictPort --host 127.0.0.1`. Le processus est
  détaché : fermer l'onglet ne l'arrête pas. Son journal s'écrit hors du dépôt
  (`~/.local/state/planquex-serveurs/<port>.log`).
- **Tuer** : l'arbre entier, feuilles d'abord — un pid qui n'écoute pas est refusé (404), et un
  pid qui écoute **sans être un serveur de chantier** aussi (403) : la route accepte exactement
  ce que la page montre, par la **même** fonction (`estServeurDeChantier`, #245). Un `vitest`
  n'est pas un `vite`.
- **Journal** : les 200 dernières lignes d'un serveur lancé par l'outil.
- **Rafraîchissement** : toutes les 5 s, tant que l'onglet est ouvert.

## Ce qu'il ne fait pas

- Changer de branche, cocher, commiter, pousser : il **regarde** git, il n'y touche pas.
- Lancer autre chose que `npm run dev` / `npm run preview` dans un worktree connu.
- Servir le jeu lui-même : ce n'est pas un serveur de production, c'est une **table de contrôle**.

## Le lancer

```bash
npm run serveurs            # ouvre le navigateur sur 127.0.0.1:5180/?jeton=…
npm run serveurs -- --port 5182 --no-open
```

Le jeton est exigé comme au poste de pilotage (`tools/admin/`) : une page quelconque du
navigateur peut émettre un `POST` vers `127.0.0.1`, et ces routes **lancent et tuent des
processus**. La première visite le pose en cookie (`HttpOnly`, `SameSite=Strict`).

Surcharge par l'environnement : `SERVEURS_ETAT` (le dossier des journaux).

## Structure

| Fichier | Rôle |
|---|---|
| `serveur.mjs` | point d'entrée : tirer le jeton, ouvrir le serveur, ouvrir le navigateur |
| `lib/app.mjs` | le serveur HTTP et ses routes (la couture que les tests exercent) |
| `lib/systeme.mjs` | les analyseurs purs (`ss`, `git worktree`, `git status`) et le système réel |
| `page.html` | la page statique (HTML + fetch, aucun build) |
| `serveurs.test.ts` | la garde : analyseurs purs + API HTTP sur un faux système, sans réseau |

## Les gardes

Vingt-quatre contrôles, et chacun **mord** (`AGENTS.md` §6) : le cas fautif est là pour échouer —
un socket sans PID, un port déjà pris (409), un pid qui n'écoute pas (404), un pid hors périmètre
(403), un jeton faux (401), un argument inconnu. Aucun test ne lance `ss`, `git`, `npm` ni `kill` :
le système est injecté.
