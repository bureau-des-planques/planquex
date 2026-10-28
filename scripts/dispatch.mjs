#!/usr/bin/env node
// dispatch — le prompt d'un sous-agent, rendu au lieu d'être recopié.
//
// Pourquoi il existe (rétro du 28/10/2026) : 74 dispatchs de sous-agents sur la période,
// 226 000 caractères de prompts écrits à la main, médiane 2 915 caractères. Les mêmes
// paragraphes (worktree absolu, définition de fini, format de commit) étaient réécrits à
// chaque fois, et les oublis se payaient en messages de rattrapage (« ton worktree est en
// retard », « Arrêt de numérotation »). Le gabarit dit tout, une fois.
//
// Usage :
//   npm run dispatch -- --ticket 427
//   npm run dispatch -- --ticket 427 --agent auditeur --branche revue/427 --decision
//   npm run dispatch -- --ticket 427 --json
//
// Le prompt sort sur la sortie standard : l'orchestrateur le passe à `subagent`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const AGENTS = ['codeur', 'auditeur', 'chercheur', 'orienteur', 'redacteur', 'explore'];

/** Le prochain numéro de décision libre, lu dans le journal. `D-145` si le max est 144. */
export function prochainNumero(...textes) {
  const numeros = textes
    .flatMap((texte) => [...String(texte ?? '').matchAll(/^\|\s*D-(\d{3})\s*\|/gm)])
    .map((m) => Number(m[1]));
  if (numeros.length === 0) throw new Error('aucune décision lue dans le journal');
  return `D-${String(Math.max(...numeros) + 1).padStart(3, '0')}`;
}

/**
 * Le numéro se lit sur **`origin/main` autant que sur le disque** : deux agents dispatchés en
 * parallèle partent du même maximum local, et se réservent le même numéro (constaté le
 * 28/10/2026 : « Arrêt de numérotation » dans cinq messages). La lecture fraîche ne rend pas la
 * réservation atomique — elle retire la cause la plus fréquente, la branche en retard.
 */
export function journalLePlusRecent({ lancer = lancerGit } = {}) {
  let origin = '';
  try {
    lancer(['fetch', 'origin', 'main', '--quiet'], true);
    origin = lancer(['show', 'origin/main:docs/DECISIONS.md']);
  } catch {
    // Hors ligne, ou pas de remote : le journal local reste la seule source.
  }
  return origin;
}

function lancerGit(args, silencieux = false) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: silencieux ? 'ignore' : 'pipe' });
}

/** Lit les arguments ; rend `{ ticket, agent, branche, worktree, decision, json, erreurs }`. */
export function analyserArguments(argv, { racine = process.cwd() } = {}) {
  const erreurs = [];
  const options = {
    ticket: null,
    agent: 'codeur',
    branche: null,
    worktree: null,
    decision: false,
    reprise: false,
    json: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const valeur = () => argv[++i] ?? '';
    if (a === '--ticket') options.ticket = valeur();
    else if (a.startsWith('--ticket=')) options.ticket = a.slice('--ticket='.length);
    else if (a === '--agent') options.agent = valeur();
    else if (a.startsWith('--agent=')) options.agent = a.slice('--agent='.length);
    else if (a === '--branche') options.branche = valeur();
    else if (a.startsWith('--branche=')) options.branche = a.slice('--branche='.length);
    else if (a === '--worktree') options.worktree = valeur();
    else if (a.startsWith('--worktree=')) options.worktree = a.slice('--worktree='.length);
    else if (a === '--decision') options.decision = true;
    else if (a === '--reprise') options.reprise = true;
    else if (a === '--json') options.json = true;
    else erreurs.push(`option inconnue : ${a}`);
  }
  if (!options.ticket) erreurs.push('ticket manquant — `npm run dispatch -- --ticket 427`');
  else if (!/^\d+$/.test(String(options.ticket))) erreurs.push(`ticket invalide : ${options.ticket}`);
  if (!AGENTS.includes(options.agent)) erreurs.push(`agent inconnu : ${options.agent} (${AGENTS.join(', ')})`);
  const nom = options.ticket ? `${options.ticket}` : 'ticket';
  options.branche ??= `agent/${nom}`;
  options.worktree ??= join(homedir(), '.local/share/opencode/worktree', basename(racine), nom);
  if (options.worktree && !options.worktree.startsWith('/')) options.worktree = resolve(racine, options.worktree);
  return { ...options, erreurs };
}

/** Le bloc « fini / livraison » selon le métier de l'agent. */
export function blocDeFini(agent) {
  if (['auditeur', 'chercheur', 'explore'].includes(agent)) {
    return `## Fini
- Un **rapport** : ce que tu as lu (fichier, ligne), ce que tu as mesuré (commande, code de sortie), ce qui reste incertain.
- Aucune écriture hors de ton bac à sable. Une affirmation sans source citée est une hypothèse, dis-le.
- Ta réponse finale : le constat, les preuves, les suites proposées.`;
  }
  if (agent === 'redacteur') {
    return `## Fini, au sens du dépôt (\`AGENTS.md\` §8.4)
- \`npm run format:check\` : exit 0 ; \`npm test\` si un test lit le document que tu touches.
- Une affirmation sans fichier, commande ou test cité est une hypothèse, pas un fait.
- Docs cohérentes avec \`docs/DECISIONS-INDEX.md\` : une règle nouvelle demande une décision datée, pas une phrase dans un coin.

## Livraison
- Commits en français, sujet \`type(zone): …\`, un commit par intention.
- Pas de \`git push\`, pas de PR : l'orchestrateur s'en charge.
- Ta réponse finale : ce qui est écrit, où, et ce qui reste à trancher.`;
  }
  return `## Fini, au sens du dépôt (\`AGENTS.md\` §8.4)
- \`npm run check\`, \`npm run format:check\`, \`npm test\`, \`npm run garde-fous\`, \`npm run build\` : exit 0 chacun.
- Un test couvre le changement, et **le contrôle mord** : il est confronté à un cas fautif.
- \`npm test\` et \`npm run garde-fous\` **jamais en parallèle** : les gardes mutent les sources.
- Docs mises à jour si une commande, une règle ou un contenu change.

## Livraison
- Commits en français, sujet \`type(zone): …\`, un commit par intention.
- Pas de \`git push\`, pas de PR : l'orchestrateur s'en charge.
- Ta réponse finale : ce qui est fait, les commandes et leurs codes de sortie, ce qui reste ouvert.`;
}

/** Le prompt, à partir du ticket lu et des options. Pur : il ne lit ni le réseau ni le disque. */
export function composer({
  ticket,
  agent,
  branche,
  worktree,
  decision,
  reprise = false,
  worktreeExiste = true,
  depot = 'bureau-des-planques/planquex'
}) {
  if (reprise) {
    return `Le travail précédent a été **coupé** (« Free usage limit reached » ou une session interrompue), pas par un défaut de ta part. **Reprends exactement où tu en étais** ; ne repars pas de zéro.

## Où
- **Worktree (chemin ABSOLU)** : \`${worktree}\`
- **Branche** : \`${branche}\`
- Ticket : **#${ticket.number} « ${ticket.title} »**

## Avant de continuer, trois commandes
1. \`git status --short\` — ce qui est là mais non commité : c'est ton travail, ne l'écrase pas.
2. \`git log --oneline -5\` — ce qui est déjà commité.
3. \`gh issue view ${ticket.number} --json number,title,body,labels\` — le ticket, si tu ne l'as plus en tête.

## Ce que tu rends d'abord
Trois lignes : **fait**, **en cours**, **reste**. Puis tu continues.
Ne refais pas ce qui est commité, et ne réécris pas un fichier entier pour « repartir propre » : c'est ainsi qu'on perd le travail d'un autre agent.

${blocDeFini(agent)}`;
  }
  const corps = (ticket.body ?? '').trim();
  const etiquettes = (ticket.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)).join(', ');
  const où = worktreeExiste
    ? `- Il existe déjà, dépendances installées.`
    : `- Il **n'existe pas encore** : \`npm run worktree:nouveau -- ${ticket.number} --branche ${branche}\` le crée, dépendances comprises.`;
  return `Tu es l'agent \`${agent}\` : tu traites le ticket **#${ticket.number} « ${ticket.title} »** du dépôt \`${depot}\`${etiquettes ? ` (${etiquettes})` : ''}.

## Où
- **Worktree (chemin ABSOLU)** : \`${worktree}\`
- **Branche** : \`${branche}\`
${où}
- Tu ne travailles **que** là. Jamais dans le dépôt principal, jamais dans un autre worktree.

## Quoi
${corps || '(corps du ticket vide — lis-le par `gh issue view ' + ticket.number + ' --json number,title,body,labels,comments`)'}

## Ce que tu ne touches pas
- Les zones d'un autre agent en cours : \`git status\` et \`docs/agents/parallelisme.md\` §1. Si le ticket en couvre plusieurs, dis-le et arrête-toi.
- \`docs/JEU.md\` §4, le vocabulaire, une règle de jeu : ils ne changent que par une décision datée.

${blocDeFini(agent)}
${decision ? `\n## Décision\nSi le ticket demande une décision datée, prends **${decision}** (réservé par ce dispatch) et mets à jour \`docs/DECISIONS-INDEX.md\` (\`npm run index:decisions\`).\n` : ''}`;
}

/** Lit le ticket par le CLI `gh`. Sans `--json`, `gh` échoue sur ce dépôt (Projects classic). */
export function lireTicket(numero, { lancer = lancerGh } = {}) {
  const json = lancer(['issue', 'view', String(numero), '--json', 'number,title,body,labels']);
  return JSON.parse(json);
}

function lancerGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

const estLance = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (estLance) {
  const options = analyserArguments(process.argv.slice(2));
  if (options.erreurs.length) {
    console.error(`dispatch : refus\n  - ${options.erreurs.join('\n  - ')}`);
    process.exit(1);
  }
  try {
    const ticket = lireTicket(options.ticket);
    const journal = join(dirname(process.argv[1]), '..', 'docs/DECISIONS.md');
    const decision =
      options.decision && existsSync(journal)
        ? prochainNumero(readFileSync(journal, 'utf8'), journalLePlusRecent())
        : null;
    const prompt = composer({ ...options, ticket, decision, worktreeExiste: existsSync(options.worktree) });
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            ticket: ticket.number,
            titre: ticket.title,
            worktree: options.worktree,
            branche: options.branche,
            decision,
            prompt
          },
          null,
          2
        )
      );
    } else {
      console.log(prompt);
    }
  } catch (erreur) {
    console.error(`dispatch : ${erreur.message}`);
    process.exit(1);
  }
}
