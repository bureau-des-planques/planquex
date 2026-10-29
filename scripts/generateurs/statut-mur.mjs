#!/usr/bin/env node
/**
 * Déplacer un post-it du mur du comité (#140).
 *
 * L'alpha est **en lecture seule** (D-058) : le jeu lit `docs/comite.json` et n'y
 * écrit jamais. Le tri, lui, se fait **hors du jeu** — et D-059 lui donne trois gestes :
 * changer le statut, lier un ticket, écarter avec une raison. Ce script les fait à la
 * place d'un tableau de bord d'administration, que le mur n'aura pas.
 *
 * **Depuis le tri en base (0006, D-088)**, ce script n'est plus la seule porte : quand la
 * base est configurée, le mur lit la base et le tri s'y fait depuis l'écran
 * d'administration, où un administrateur seul passe. Le fichier reste la **source de
 * secours**, et le script le dit à chaque écriture (`mondeDuTri`) plutôt que de laisser
 * croire qu'il a trié ce que les invités voient.
 *
 * Il **réutilise le contrat** : les statuts admis et le contrôle du fichier viennent de
 * `src/store/mur.ts` (`STATUTS`, `lireMur`), jamais d'une copie — une liste recopiée
 * prendrait du retard, et un fichier écrit dans une forme que l'écran refuse serait un
 * mur mort. Le script **relit ce qu'il a écrit** et, si le fichier n'est plus lisible,
 * **remet l'original** : il n'écrit rien d'illisible.
 *
 * Ce qu'il ne fait **jamais** :
 * - accepter un statut hors des cinq de §2, ou un ticket qui n'est pas un entier > 0 ;
 * - écarter un post-it **sans raison** (D-059 : un écarté sans raison est un mur mort) ;
 * - inventer un `id` : un post-it inconnu est refusé, et rien n'est écrit ;
 * - réécrire un champ qu'il ne connaît pas : on part du document **tel qu'il est**, on ne
 *   remplace que `statut`, `ticket` et `raison`, et le reste traverse intact.
 *
 * L'écriture est **atomique** (fichier temporaire puis renommage) : un arrêt au milieu ne
 * laisse pas un JSON tronqué derrière lui. Le format est celui du dépôt :
 * `JSON.stringify(document, null, 2)` plus un saut de ligne final.
 *
 * Usage :
 *   npm run statut <post-it> <statut>
 *   npm run statut <post-it> --ticket <numéro>
 *   npm run statut <post-it> écarté --raison "…"
 *   npm run statut -- --problemes
 *
 * `--problemes` **lit la base** et imprime les problèmes connus d'une release (#299,
 * D-119) : c'est le seul mode de cette commande qui parle à la base, et il est **en lecture
 * seule** (rôle `lecteur`). Il délègue à `scripts/problemes-connus.mjs`, que
 * `npm run problemes` expose aussi. Le tri, lui, continue de déplacer le **fichier** : quand
 * la base est configurée, le tri réel se fait dans l'écran d'administration (D-088).
 *
 * `--fichier <json>` n'existe que pour les tests : il évite d'écrire dans le vrai fichier
 * du mur. `STATUT_MUR_RELECTURE_CORROMPUE=1` (avec `--fichier` seulement) fait relire un
 * texte fautif : c'est la seule façon de prouver que la relecture **restaure** l'original,
 * et jamais un moyen d'abîmer le vrai fichier.
 */
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { principalProblemes } from './problemes-connus.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER_MUR = join(RACINE, 'docs', 'comite.json');

const AIDE = `Usage : npm run statut <post-it> <statut> [options]

Déplace un post-it du mur (docs/comite.json) sans passer par l'écran.

  <post-it> <statut>        en attente | retenu | en cours | fait | écarté
  --ticket <numéro>         lie le post-it à une issue GitHub (entier > 0)
  --raison "…"              la raison d'un écarté, obligatoire pour l'écarter
  --fichier <json>          fichier du mur à modifier (défaut : docs/comite.json ;
                            réservé aux tests)
  --problemes               lit la base et imprime les problèmes connus de la release
                            (lecture seule, D-119 ; équivaut à npm run problemes)
  --aide                    affiche ce texte

Écarter exige une raison (D-059) ; un statut inventé ou un post-it inconnu est refusé
sans rien écrire.`;

/** Le contrat du mur, chargé une fois : `STATUTS` et `lireMur` vivent dans `src/store/mur.ts`. */
let contrat = null;

/**
 * Charge `src/store/mur.ts` — la seule source des statuts et du contrôle.
 *
 * Node refuse un `import … from '….json'` **sans attribut de type**, que Vite accepte :
 * `mur.ts` importe le fichier du mur pour son export. Ce crochet minimal, monté seulement
 * quand la commande en a besoin, rend ce JSON importable — c'est ce qui permet de
 * **réutiliser** `lireMur` au lieu d'en recopier les règles.
 */
async function chargerContrat() {
  if (contrat) return contrat;
  registerHooks({
    load(url, contexte, suivant) {
      if (url.endsWith('.json')) {
        const donnees = readFileSync(fileURLToPath(url), 'utf8');
        return { format: 'module', source: `export default ${donnees};`, shortCircuit: true };
      }
      return suivant(url, contexte);
    }
  });
  const module = await import(pathToFileURL(join(RACINE, 'src', 'store', 'mur.ts')).href);
  contrat = { STATUTS: module.STATUTS, lireMur: module.lireMur };
  return contrat;
}

export function argumentsDe(ligne) {
  const options = {
    id: null,
    statut: null,
    ticket: null,
    raison: null,
    fichier: null,
    problemes: false,
    aide: false
  };
  const positionnels = [];

  for (let i = 0; i < ligne.length; i += 1) {
    const arg = ligne[i];
    if (arg === '--ticket' || arg === '--raison' || arg === '--fichier') {
      const valeur = ligne[i + 1];
      if (valeur === undefined || valeur.startsWith('--')) throw new Error(`${arg} attend une valeur`);
      options[arg.slice(2)] = valeur;
      i += 1;
    } else if (arg === '--problemes') {
      options.problemes = true;
    } else if (arg === '--aide' || arg === '--help' || arg === '-h') {
      options.aide = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`argument inconnu : ${arg}`);
    } else {
      positionnels.push(arg);
    }
  }

  if (options.aide) return options;

  options.id = positionnels[0] !== undefined ? positionnels[0].trim() : null;
  options.statut = positionnels[1] !== undefined ? positionnels[1].trim() : null;

  // `--problemes` est un **autre** mode : il ne demande pas de post-it, mais il refuse de se
  // combiner avec un déplacement (vérifié par `principal`, qui a les deux sous la main).
  if (options.problemes) return options;

  if (positionnels.length === 0) throw new Error('un post-it est requis');
  if (positionnels.length > 2) throw new Error('un post-it et un statut au plus');
  if (!options.id) throw new Error('le post-it a un identifiant vide');
  return options;
}

/** Un numéro d'issue : des chiffres, rien d'autre, et strictement positif. */
export function numeroDeTicket(valeur) {
  if (!/^\d+$/.test(String(valeur ?? '').trim())) return null;
  const numero = Number(String(valeur).trim());
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

function lireTexte(chemin) {
  if (!existsSync(chemin)) throw new Error(`fichier du mur introuvable : ${chemin}`);
  return readFileSync(chemin, 'utf8');
}

function ecrireAtomique(chemin, texte) {
  const temporaire = `${chemin}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaire, texte, 'utf8');
    renameSync(temporaire, chemin);
  } catch (erreur) {
    if (existsSync(temporaire)) unlinkSync(temporaire);
    throw erreur;
  }
}

/** Le contrôle d'un texte de fichier : `lireMur` après `JSON.parse`, sans lever. */
function controlerAvec(lireMur) {
  return (texte) => {
    let document;
    try {
      document = JSON.parse(texte);
    } catch (erreur) {
      return { mur: null, erreurs: [`JSON illisible : ${erreur.message}`] };
    }
    return lireMur(document);
  };
}

/**
 * Écrit, **relit**, et remet l'original si la relecture est invalide.
 *
 * `relire` est injectable pour la seule preuve qui compte : un fichier relu fautif ne doit
 * **pas** rester en place (le test le fait par la variable d'environnement, jamais sur le
 * vrai mur).
 */
export function ecrireEtControler(
  chemin,
  texte,
  original,
  { controler, relire = (fichier) => readFileSync(fichier, 'utf8'), ecrire = ecrireAtomique }
) {
  ecrire(chemin, texte);
  const relu = controler(relire(chemin));
  if (relu.mur) return;
  ecrire(chemin, original);
  throw new Error(
    `le fichier relu n’est pas valide (${relu.erreurs.join(' ; ')}) — l’original a été restauré, rien n’a été changé`
  );
}

/**
 * Le monde du tri, dit à voix haute (#0006).
 *
 * Depuis que la base peut être la source du mur, ce script n'est plus **la** porte du tri :
 * quand `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont posés, le mur lit
 * `postits_avec_votes` et le tri se fait dans l'écran d'administration
 * (`/administration`), où la base vérifie que le compte est administrateur. Le fichier,
 * lui, reste la source de secours — ce script continue donc de le déplacer, et **le dit**.
 *
 * L'environnement est un paramètre : la phrase se vérifie sans toucher au poste.
 */
export function mondeDuTri(env = process.env) {
  const url = String(env.VITE_SUPABASE_URL ?? '').trim();
  const cle = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!url && !cle) {
    return 'La base n’est pas configurée : ce fichier est ce que le mur lit, le tri est à jour.';
  }
  return 'La base est configurée : le mur lit la base, et ce tri ne vaut que pour le fichier de secours. Le tri des post-its de la base se fait dans l’écran d’administration (/administration).';
}

function trouverPostit(document, id) {
  return (document.postits ?? []).find(
    (postit) => postit && typeof postit === 'object' && String(postit.id ?? '').trim() === id
  );
}

async function principal(ligne = process.argv.slice(2)) {
  let options;
  try {
    options = argumentsDe(ligne);
  } catch (erreur) {
    console.error(`statut-mur — ${erreur.message}`);
    console.error(AIDE);
    return 1;
  }

  if (options.aide) {
    console.log(AIDE);
    return 0;
  }

  // `--problemes` ne trie rien : il **lit** la base (D-119). Le combiner avec un déplacement
  // ferait deux gestes d'un seul appel, dont un seul serait vrai.
  if (options.problemes) {
    if (
      options.id !== null ||
      options.statut !== null ||
      options.ticket !== null ||
      options.raison !== null ||
      options.fichier !== null
    ) {
      console.error('statut-mur — --problemes ne se combine pas avec un déplacement de post-it');
      console.error('Rien n’a été écrit.');
      return 1;
    }
    return principalProblemes(
      ligne.filter((argument) => argument !== '--problemes'),
      process.env
    );
  }

  let STATUTS;
  let lireMur;
  try {
    ({ STATUTS, lireMur } = await chargerContrat());
  } catch (erreur) {
    console.error(`statut-mur — impossible de charger le contrat du mur : ${erreur.message}`);
    return 1;
  }

  if (options.statut !== null && !STATUTS.includes(options.statut)) {
    console.error(`statut-mur — « ${options.statut} » n’est pas un statut admis (${STATUTS.join(', ')})`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  let ticket = null;
  if (options.ticket !== null) {
    ticket = numeroDeTicket(options.ticket);
    if (ticket === null) {
      console.error(`statut-mur — « ${options.ticket} » n’est pas un numéro de ticket (entier > 0)`);
      console.error('Rien n’a été écrit.');
      return 1;
    }
  }

  const raison = options.raison === null ? null : options.raison.trim();
  if (options.raison !== null && !raison) {
    console.error('statut-mur — la raison ne peut pas être vide');
    console.error('Rien n’a été écrit.');
    return 1;
  }

  if (options.statut === null && ticket === null && raison === null) {
    console.error('statut-mur — rien à changer : donner un statut, --ticket ou --raison');
    console.error(AIDE);
    return 1;
  }

  const chemin = options.fichier ? resolve(options.fichier) : FICHIER_MUR;

  let original;
  let document;
  try {
    original = lireTexte(chemin);
    document = JSON.parse(original);
  } catch (erreur) {
    console.error(`statut-mur — ${erreur.message}`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  // Le mur d'entrée doit déjà être lisible : le script ne « répare » personne en silence.
  const avant = lireMur(document);
  if (!avant.mur) {
    console.error(`statut-mur — le mur est déjà invalide (${chemin}) :`);
    for (const erreur of avant.erreurs) console.error(`  - ${erreur}`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  const cible = trouverPostit(document, options.id);
  if (!cible) {
    const connus = (document.postits ?? [])
      .map((postit) => (postit && typeof postit === 'object' ? String(postit.id ?? '').trim() : ''))
      .filter(Boolean);
    console.error(`statut-mur — aucun post-it « ${options.id} » dans ${chemin}`);
    if (connus.length > 0) console.error(`  post-its connus : ${connus.join(', ')}`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  const statutAvant = String(cible.statut ?? '').trim();
  const statutFinal = options.statut ?? statutAvant;
  const raisonAvant = String(cible.raison ?? '').trim();

  // D-059 : un écarté porte une raison. La commander avec `--raison` la remplace ; sans
  // elle, on accepte celle qui est déjà là — jamais un écarté muet.
  if (statutFinal === 'écarté' && raison === null && !raisonAvant) {
    console.error(`statut-mur — écarter « ${options.id} » exige une raison non vide (--raison "…")`);
    console.error('Rien n’a été écrit.');
    return 1;
  }
  if (raison !== null && statutFinal !== 'écarté') {
    console.error('statut-mur — --raison ne s’emploie qu’avec le statut « écarté »');
    console.error('Rien n’a été écrit.');
    return 1;
  }

  const changements = [];
  if (options.statut !== null) {
    cible.statut = options.statut;
    changements.push(`statut « ${options.statut} »`);
  }
  if (ticket !== null) {
    cible.ticket = ticket;
    changements.push(`ticket #${ticket}`);
  }
  if (raison !== null) {
    cible.raison = raison;
    changements.push('raison');
  }

  const texte = `${JSON.stringify(document, null, 2)}\n`;
  const controler = controlerAvec(lireMur);

  // Contrôle **avant** écriture : on refuse de poser un texte que `lireMur` rejetterait.
  const prevu = controler(texte);
  if (!prevu.mur) {
    console.error(`statut-mur — le contenu produit serait invalide (${prevu.erreurs.join(' ; ')})`);
    console.error('Rien n’a été écrit.');
    return 1;
  }

  // Le crochet de corruption ne s'arme **que** sur une copie (`--fichier`) : le vrai mur
  // ne peut pas être la cible d'un test.
  const relire =
    options.fichier && process.env.STATUT_MUR_RELECTURE_CORROMPUE === '1' ? () => '{"postits": "cassé"}' : undefined;

  try {
    ecrireEtControler(chemin, texte, original, { controler, ...(relire ? { relire } : {}) });
  } catch (erreur) {
    console.error(`statut-mur — ${erreur.message}`);
    return 1;
  }

  console.log(`${options.id} — ${changements.join(', ')}`);
  console.log(`Écrit : ${chemin}`);
  console.log(mondeDuTri());
  return 0;
}

export { principal };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await principal();
}
