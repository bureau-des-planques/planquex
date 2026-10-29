#!/usr/bin/env node
/**
 * Garde-fous — **la suite de tests peut-elle échouer ?**
 *
 * ## Le problème (ticket #112)
 *
 * Trois fois dans la session du 20/10/2026, un test a été pris en flagrant délit de **faux
 * garde-fou** — une assertion qui **ne peut pas échouer**, donc qui ne garde rien :
 *
 * - #101 : le contrôle du coût typé imposait la **position** du café (`cost[0] === faction`)
 *   et sautait les coûts vides — plus strict que la règle sur un point, plus laxiste sur
 *   l'autre ;
 * - #107 : les variantes d'Action acceptaient `3S`/`COU` alors que leurs **ids** restaient
 *   bornés à `-star`/`-star2` — le test **autorisait** ce que la règle interdit ;
 * - #103 : la table des écarts connus était **ouverte** et sa garde d'expiration codée en
 *   dur sur `1D` — un agent futur pouvait y ajouter `'3D': -5` et **silencier une
 *   régression de contenu**.
 *
 * Chaque fois, la correction a été locale. Ce script répond au problème de **classe** : il
 * **mute** le code sur un invariant critique et **exige que la suite échoue**. Une mutation
 * qui passe inaperçue désigne une garde **morte**, pas un code correct.
 *
 * ## Pourquoi ce harnais plutôt qu'une bibliothèque de mutation testing
 *
 * `AGENTS.md` §1, règle 7 : pas de dépendance sans nécessité démontrée. Une table **courte et
 * choisie** de mutations, sur les invariants qui portent une **règle** (le café typé, la
 * rareté portée par le suffixe, la migration du store, la position du café, la table des
 * écarts, la payabilité d'une ligne d'évolution), suffit à répondre à la question posée,
 * se lit, et **site le ticket** de chaque garde. Une couverture exhaustive (Stryker)
 * reste une option documentée, à trancher par décision si le besoin grandit.
 *
 * ## Contrat
 *
 * - `node scripts/ci/garde-fous.mjs` — applique chaque mutation, lance les tests ciblés,
 *   **exige un échec**, restaure le fichier. Sort 1 si une mutation n'échoue pas, ou si un
 *   motif a disparu du code (entrée périmée : à réancrer, pas à ignorer).
 * - `node scripts/ci/garde-fous.mjs --verifie` — **contrôle statique** : chaque motif est
 *   présent, chaque fichier de test existe. Ne mute rien, ne lance aucun test. C'est ce que
 *   `scripts/ci/garde-fous.test.ts` appelle, pour que la table ne pourrisse pas en silence.
 *
 * Le dossier de travail n'est jamais laissé dans un état intermédiaire : chaque fichier est
 * restauré dans un `finally`, et l'égalité est **relue** après restauration.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vitest = join(racine, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest');

/**
 * La table. Chaque entrée doit **casser** au moins un des tests listés.
 *
 * `motif` est une chaîne **exacte** du code : si elle disparaît (renommage, refactor), le
 * harnais **échoue** au lieu de sauter l'entrée — une entrée périmée est un garde-fou qui
 * a cessé d'exister, et c'est exactement ce qu'on cherche à voir.
 */
export const MUTATIONS = [
  {
    ticket: 91,
    titre: 'un choix de café qui n’est pas une liste est toléré',
    fichier: 'src/game/deck.ts',
    motif: 'if (!Array.isArray(types)) return [];',
    remplacement: 'if (!Array.isArray(types) && false) return [];',
    tests: ['src/game/deck.test.ts'],
    garde: 'sans elle, un `localStorage` trafiqué lève une TypeError pendant la migration'
  },
  {
    ticket: 88,
    titre: 'un symbole typé est payé par n’importe quel café',
    fichier: 'src/game/rules.ts',
    motif: '|| available === required;',
    remplacement: ';',
    tests: ['src/game/rules.test.ts'],
    garde: 'c’est la règle même du café typé (D-037) : un symbole exige un café de son type'
  },
  {
    ticket: 87,
    titre: 'le suffixe d’id cesse de porter la rareté',
    fichier: 'src/data/planque.ts',
    motif: "star3: '3S',",
    remplacement: "star3: '2S',",
    tests: ['src/data/planque.test.ts', 'src/data/cards.test.ts'],
    garde: 'un id peut alors mentir sur sa rareté — le *Mysterious Name* que §5 proscrit'
  },
  {
    ticket: 49,
    titre: 'la migration du store ne remappe plus les ids',
    fichier: 'src/store/useStore.ts',
    motif: 'const migrated = version < STORAGE_VERSION ? withRenamedCardIds(state) : state;',
    remplacement: 'const migrated = state;',
    tests: ['src/store/useStore.test.ts'],
    garde: 'une carte renommée quitterait la Collection et le Deck du joueur, en silence'
  },
  {
    ticket: 101,
    titre: 'le café typé ne peut plus être à toute position',
    fichier: 'src/data/cards.test.ts',
    motif: 'cost.includes(faction) &&',
    remplacement: 'cost[0] === faction &&',
    tests: ['src/data/cards.test.ts'],
    garde: 'c’est le faux garde-fou que #101 a corrigé : la règle ne fixe aucune position'
  },
  {
    ticket: 103,
    titre: 'la table des écarts connus accepte une clé de plus',
    fichier: 'src/data/cards.test.ts',
    motif: "  '1D': { ecart: 5, ticket: 352 }",
    remplacement: "  '1D': { ecart: 5, ticket: 352 },\n  '3D': { ecart: -1, ticket: 999 }",
    tests: ['src/data/cards.test.ts'],
    garde: 'sans fermeture, une régression de contenu (3 cartes 3◆ disparues) passe inaperçue'
  },
  {
    ticket: 118,
    titre: 'le nettoyage d’une mutation de la table globale ne restaure plus rien',
    fichier: 'src/game/cafe-type.test.ts',
    motif: 'for (const { id, original } of PATCHES.splice(0).reverse()) CARD_BY_ID.set(id, original);',
    remplacement: 'PATCHES.splice(0);',
    tests: ['src/game/cafe-type.test.ts'],
    garde: 'sans restauration, la carte patchée survit au test : le détecteur de `beforeEach` la nomme'
  },
  {
    ticket: 116,
    titre: 'une ligne d’évolution de l’Intérim réclame un quatrième type',
    fichier: 'src/data/interim.ts',
    // Réancré par #412 : la ligne 1 ne coûte plus `MANAGEMENT` + `QVT` mais la paire de la
    // ligne 2, `RH` + `ATELIER`. La mutation introduit un type que la ligne n'emploie pas.
    motif: "cost: ['RH', 'ATELIER'],",
    remplacement: "cost: ['RH', 'AMELIORATION'],",
    tests: ['src/data/interim.test.ts'],
    garde: 'une ligne payable en 3 types au plus (D-034) redevient injouable en cours d’évolution'
  },
  {
    ticket: 113,
    titre: 'le simulateur repasse par la dérivation des types de café',
    fichier: 'src/game/simulation.ts',
    motif: 'playerCafeTypes: cafeTypes.get(player),',
    remplacement: 'playerCafeTypes: undefined,',
    tests: ['src/game/simulation.test.ts'],
    garde:
      'sans le choix explicite, le Deck SUPPORT ne produit aucun café et ne lance aucune Pression : la mesure du niveau 2 est biaisée'
  },
  {
    ticket: 114,
    titre: 'l’évaluation du niveau 2 repart du flux de hasard de la partie',
    fichier: 'src/game/ia.ts',
    motif: 'rng: evaluationRng(state, index)',
    remplacement: 'rng: state.rng',
    tests: ['src/game/ia-hasard.test.ts'],
    garde:
      'sans la sous-graine dérivée, le clone tire le lancer que l’action réelle tirera : la Direction sait d’avance que sa Pression sous Dérive échoue'
  },
  {
    ticket: 97,
    titre: 'l’image rangée ne porte plus le nom de la carte',
    fichier: 'scripts/ressources/illustration-vague.sh',
    // Réancré le 21/10/2026 (D-045) : le motif vivait sur la ligne du `local` groupé, que
    // la source unique a supprimée (`serv` a disparu). La mutation garde la même règle —
    // le fichier rangé doit porter l'id de la carte — sur la ligne qui la porte aujourd'hui.
    motif: '  local reg="$REGISTRE/$id.webp"',
    remplacement: '  local reg="$REGISTRE/.webp"',
    tests: ['scripts/ressources/illustration-vague.test.ts'],
    garde:
      'le nom venait d’un `local` groupé, dont bash évalue toutes les expansions avant la moindre affectation : l’image s’appelait `.webp` et le message de succès affichait le bon nom (observé à la première génération réelle)'
  },
  {
    ticket: 97,
    titre: 'le wizard n’arrête plus sur une vérification ratée',
    fichier: 'scripts/ressources/illustration-vague.sh',
    motif: 'if (( ECHEC )); then',
    remplacement: 'if (( 0 )); then',
    tests: ['scripts/ressources/illustration-vague.test.ts'],
    garde:
      'un échec de `npm run check` ou des tests n’était qu’un avertissement : le wizard continuait et invitait à commiter un état cassé'
  },
  {
    ticket: 97,
    titre: 'le registre prétend avoir corrigé un tableau qu’il n’a pas touché',
    fichier: 'scripts/ressources/illustration-vague.sh',
    // Réancré le 22/10/2026 (#121) : les planches sont renommées par rôle (Q9), et
    // « Planche 1 » est devenue la planche **Portrait**. La règle est la même — le message
    // des cartes hors tableaux ne doit pas annoncer une mise à jour qui n'a pas eu lieu.
    motif: `        note "Aucun tableau touché : cette carte n'est ni dans « Cartes produites » ni"
        note "dans « Non produites » (ces deux tableaux ne couvrent que la planche Portrait)."
        note "Seule la ligne de journal ci-dessus a été ajoutée." ;;`,
    remplacement:
      '        note "Et la graine des tableaux est à jour : « Cartes produites » corrigée, « Non produites » retirée." ;;',
    tests: ['scripts/ressources/illustration-vague.test.ts'],
    garde:
      'les deux tableaux ne couvrent que la planche Portrait : pour les autres cartes, le journal seul change — l’ancien message annonçait une mise à jour qui n’avait pas eu lieu'
  },
  {
    ticket: 123,
    titre: 'le forfait ne suit plus le camp qui a la main',
    fichier: 'src/game/engine.ts',
    motif: "  return { type: 'forfeit', who: state.current };",
    remplacement: "  return { type: 'forfeit', who: 'player' };",
    tests: ['src/game/forfait.test.ts'],
    garde:
      'un forfait émis en dur pour `player` fait abandonner au nom de son adversaire la personne qui tient la Direction (#122) : `state.current` est le seul camp qui a la main, relève comprise'
  },
  {
    ticket: 124,
    titre: 'le décodeur ne vérifie plus l’empreinte du code',
    fichier: 'src/game/codec.ts',
    motif: 'if (codeFingerprint(payload) !== checksum) {',
    remplacement: 'if (codeFingerprint(payload) !== checksum && false) {',
    tests: ['src/game/codec.test.ts'],
    garde:
      'sans l’empreinte, un base64 altéré peut redonner un JSON valide dont un champ a changé : on rejouerait une autre partie en silence, sans un mot — la classe de faux garde-fou de #112'
  },
  {
    ticket: 182,
    titre: 'la note de la version courante ne se trouve plus',
    fichier: 'src/data/versions.ts',
    motif: 'return notes.find((note) => note.version === version);',
    remplacement: 'return undefined;',
    tests: ['src/data/versions.test.ts'],
    garde:
      'sans cette recherche, la garde « on ne publie pas une version sans sa note » (D-090) ne trouve plus rien : elle refuserait toute version, ou — pire, si elle était écrite à l’envers — laisserait partir une build chez les invités sans que personne ne puisse lire ce qu’elle contient'
  },
  {
    ticket: 184,
    titre: 'une relecture qui baisse crie « nouvelle inscription »',
    fichier: 'tools/admin/lib/suivi.mjs',
    motif: 'return b > a ? b - a : 0;',
    remplacement: 'return Math.abs(b - a);',
    tests: ['tools/admin/suivi.test.ts'],
    garde:
      'sans la comparaison, une approbation (3 → 2) ferait clignoter le bandeau « 1 nouvelle inscription » : la règle « ne pas crier pour rien » du poste de pilotage (#184)'
  },
  {
    ticket: 287,
    titre: 'une infobulle de l’inspecteur porte un bouton',
    fichier: 'src/components/InspecteurCombat.tsx',
    // L'infobulle (`role="tooltip"`) ne reçoit jamais le focus : le patron ARIA l'interdit (SPEC-COMBAT-UI §3.1).
    // La mutation ajoute un bouton dans son corps ; la suite doit tomber sur « aucun bouton dans l'infobulle ».
    // L'invariant est né avec #188 ; #287 (T4) le réancre sur le test **autonome** du composant, qui ne
    // passe plus par l'écran : c'est le même bouton, mais la garde ne dépend plus de `Battle.tsx`.
    motif: '<span className="infobulle__corps">',
    remplacement: '<span className="infobulle__corps"><button type="button" />',
    tests: ['src/components/InspecteurCombat.test.tsx'],
    garde:
      'un bouton dans une infobulle est un élément focusable qui se dérobe au survol : le lecteur d’écran ne l’atteint plus, et l’APG le proscrit — une régression silencieuse, sans aucun test visuel pour la voir'
  },
  {
    ticket: 289,
    titre: 'le panneau du menu `⋯` rentre dans le flux et pousse le plateau',
    fichier: 'src/styles.css',
    // SPEC-COMBAT-UI T6, vrac du 27/10/2026 : le panneau s'accroche à la barre d'état et se
    // **superpose** au plateau. En `static`, il reprend sa place dans le flux, et l'ouverture
    // du menu déplace les cartes — le défaut que le ticket corrige. Le motif porte les trois
    // lignes du bloc (`position`, `right`, `top`) parce que `position: absolute;` seul n'est
    // pas unique dans la feuille.
    motif: '  position: absolute;\n  right: 0;\n  top: calc(100% + 0.25rem);',
    remplacement: '  position: static;\n  right: 0;\n  top: calc(100% + 0.25rem);',
    tests: ['src/pages/Battle.test.tsx'],
    garde:
      'un menu qui pousse le plateau est exactement ce que le vrac du 27/10 reprochait à l’écran : le contenu doit se recouvrir, pas faire sauter les cartes sous le doigt'
  },
  {
    ticket: 192,
    titre: 'une animation d’effet de combat dure plus de 800 ms',
    fichier: 'src/styles.css',
    // SPEC-COMBAT-UI §6.8.3 : le chiffre de Stress ne recouvre jamais une cible plus de 700 ms,
    // et aucun effet ne dépasse 800 ms. Le test lit **toutes** les durées d'`animation` de la feuille.
    motif: 'animation: stress-monte 500ms ease-out 1 both;',
    remplacement: 'animation: stress-monte 1600ms ease-out 1 both;',
    tests: ['src/components/effets-combat.test.ts'],
    garde:
      'au-delà de 800 ms, un chiffre flottant recouvre le nom de la carte et retarde la lecture du geste suivant — la borne est dans le CSS, pas seulement dans la constante du composant'
  },
  {
    ticket: 294,
    titre: 'l’arc de Condition est créé sous « Mouvement réduit »',
    fichier: 'src/pages/Battle.tsx',
    // SPEC-COMBAT-UI §6.8.3 : sous « Mouvement réduit », il n'y a **aucun arc** — le badge nommé
    // dit la Condition. La mutation retire le drapeau `anime` de l'effet : le liseré naît
    // alors même que le réglage coupe le mouvement.
    motif: "effet.nature === 'condition' && effet.anime",
    remplacement: "effet.nature === 'condition'",
    tests: ['src/pages/Battle.effets.test.tsx'],
    garde:
      'un liseré qui pulse chez quelqu’un qui a demandé « Mouvement réduit » est exactement ce que le réglage promet de ne pas faire (SC 2.3.3) ; rien d’autre que ce test ne rend la page dans les deux modes'
  },
  {
    ticket: 294,
    titre: 'la traînée de craquage est créée sous « Mouvement réduit »',
    fichier: 'src/pages/Battle.tsx',
    // Le repli de la traînée est de ne pas la créer : la carte désaturée et le bandeau « a craqué »
    // disent tout. La mutation rend la garde toujours vraie.
    motif: '{!sansMouvement &&',
    remplacement: '{true &&',
    tests: ['src/pages/Battle.effets.test.tsx'],
    garde:
      'sans ce repli, la bande traverse le plateau malgré le réglage ; l’information (carte désaturée, bandeau) n’en dépend pas, donc rien d’autre ne verrait la régression'
  },
  {
    ticket: 294,
    titre: 'l’arc de Condition boucle sans fin',
    fichier: 'src/styles.css',
    // §6.8.3 borne 2 : l'arc pulse **deux fois**, pas en boucle (SC 2.3.1, trois flashs par
    // seconde). `infinite` échappait au décompte des chiffres : le test lit désormais le mot.
    motif: 'animation: condition-arc 120ms ease-in-out 2 both;',
    remplacement: 'animation: condition-arc 120ms ease-in-out infinite both;',
    tests: ['src/components/effets-combat.test.ts'],
    garde:
      'une boucle sans fin sur un liseré rouge est un clignotement permanent : la borne vit dans la feuille, pas dans une constante du composant'
  },
  {
    ticket: 294,
    titre: 'la case de la main se déplace au survol',
    fichier: 'src/styles.css',
    // §6.8.3 / T11 : un effet ne déplace jamais une cible de clic. Le survol soulève le **visuel**,
    // pas l'`<li>` qui porte le bouton : sinon un pointeur posé sur le bas de la carte la quitte
    // dès qu'elle monte, et elle retombe.
    motif: '.hand > li:is(:hover, :focus-within, .is-selected) {\n  z-index: 1;\n}',
    remplacement:
      '.hand > li:is(:hover, :focus-within, .is-selected) {\n  transform: translateY(-0.5rem);\n  z-index: 1;\n}',
    tests: ['src/components/effets-combat.test.ts'],
    garde:
      'une carte qui fuit sous le curseur scintille et se clique mal, surtout au doigt ; aucun test de rendu ne voit une géométrie, seule la règle de la feuille la garde'
  },
  {
    ticket: 254,
    titre: 'un geste refusé laisse le mur tel que l’optimiste l’a bougé',
    fichier: 'src/lib/useMur.ts',
    // Le hook est le seul endroit où les trois pages défont un pouce refusé. La mutation retire
    // la retouche de retour : le compteur reste à « +1 » alors que la source a dit non.
    motif: 'if (regle.refus) retoucher(regle.refus);',
    remplacement: '/* pas de rollback */',
    tests: ['src/lib/useMur.test.tsx'],
    garde:
      'sans le retour en arrière, un vote refusé par la RLS laisserait un pouce affiché que la base ne porte pas : le mur mentirait à l’invité, jusqu’au prochain rechargement (#137, #254)'
  },
  {
    ticket: 317,
    titre: 'sans invitation, la porte du serveur des testeurs rend quand même un bloc',
    fichier: 'src/components/InvitationTesteurs.tsx',
    // D-118 : « une valeur vide veut dire rien ». La mutation laisse passer le rendu alors
    // que l'invitation est `null` : Réglages et le pied du comité portent un panneau avec un
    // lien **sans adresse**, sur le build par défaut, celui que la CI construit.
    motif: 'if (!invitation) return null;',
    remplacement: 'if (!invitation && false) return null;',
    tests: [
      'src/components/InvitationTesteurs.test.tsx',
      'src/pages/Settings.test.tsx',
      'src/pages/Comite.invitation.test.tsx'
    ],
    garde:
      'un build sans configuration afficherait un lien mort dans Réglages et au comité : c’est l’état par défaut de l’alpha, et rien d’autre ne le verrait passer'
  },
  {
    ticket: 317,
    titre: 'le lien du serveur des testeurs perd `noreferrer`',
    fichier: 'src/components/InvitationTesteurs.tsx',
    // Le même module rend les deux emplacements : l'attribut est écrit **une fois**, et c'est
    // ce qui empêche les deux liens de diverger.
    motif: 'rel="noreferrer noopener"',
    remplacement: 'rel="noopener"',
    tests: [
      'src/components/InvitationTesteurs.test.tsx',
      'src/pages/Settings.test.tsx',
      'src/pages/Comite.invitation.test.tsx'
    ],
    garde:
      'sans `noreferrer`, l’onglet ouvert transmet à Discord l’adresse d’où vient le testeur — le seul renseignement que le lien peut laisser à un tiers (D-118)'
  },
  {
    ticket: 299,
    titre: 'un problème « fait » reste dans les problèmes connus de la release',
    fichier: 'scripts/generateurs/problemes-connus.mjs',
    // La règle de D-119 : `fait` sort de la note (le correctif part dans la même release),
    // `en attente` aussi (personne ne l'a trié). La mutation ouvre la porte à tous les
    // statuts ; la suite doit tomber sur « un fait sort ».
    motif: `.filter((ligne) => STATUTS_PUBLIES.includes(String(ligne.statut ?? '').trim()))`,
    remplacement: '.filter(() => true)',
    tests: ['scripts/generateurs/problemes-connus.test.ts'],
    garde:
      'sans ce filtre, la note de version annoncerait « problème connu » pour un correctif déjà livré, et pour un post-it que personne n’a trié — une note qui ment sur son propre contenu'
  },
  {
    ticket: 411,
    titre: 'la mesure recopie les réglages de recherche au lieu de les lire',
    fichier: 'src/game/mesure-direction.ts',
    // La mutation **fige** `candidates` à l’ancienne valeur de #111 (6). Tant que les défauts
    // portent le réglage mesuré (2, #411), la mesure recopiée ne l’est plus : la suite doit
    // tomber sur « la mesure lit les réglages de l’écran ».
    motif: '{ ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity }',
    remplacement: '{ ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity, candidates: 6 }',
    tests: ['src/game/mesure-direction.test.ts'],
    garde:
      'une mesure qui recopie ses réglages prouve la force d’une politique que plus personne ne joue : le chiffre publié cesserait de décrire l’écran (D-134)'
  },
  {
    ticket: 411,
    titre: 'le budget de candidats revient à la valeur hors bande',
    fichier: 'src/game/ia.ts',
    motif: '  candidates: 2,',
    remplacement: '  candidates: 6,',
    tests: ['src/game/ia-recherche.test.ts'],
    garde:
      '6 candidats mesuraient 62,57 % des parties décidées contre la référence scriptée, hors de la bande 40–60 % de D-134 ; y revenir sans une nouvelle mesure est une régression de jeu, pas un réglage'
  },
  {
    ticket: 412,
    titre: 'une faction qui demande un quatrième type de café est rendue payable',
    fichier: 'src/data/interim.ts',
    // La ligne 1 coûtait `MANAGEMENT` + `QVT` et la ligne 2 `RH` + `ATELIER` : cinq types
    // pour une faction, donc **57 %** de ses Pressions impayables par le Deck d'archétype, et
    // 41,6 % à la table (#412). Le contrôle de #116 ne regardait qu'une **ligne** ; celui-ci
    // regarde la **faction**, et c'est la mutation qui le prouve : `QVT` sur le Vacataire et
    // la faction en réclame quatre.
    motif: "cost: ['ATELIER'],",
    remplacement: "cost: ['QVT'],",
    tests: ['src/data/interim.test.ts'],
    garde:
      'la faction entière doit tenir dans les trois types d’un Deck (D-034) : sinon le Deck d’archétype ne peut pas payer une partie de ses Pressions, et la table mesure un Deck qui n’attaque pas'
  }
];

const VERIFIE = process.argv.includes('--verifie');

function lire(chemin) {
  return readFileSync(join(racine, chemin), 'utf8');
}

/** Contrôle statique : les motifs sont présents, les tests existent. Ne mute rien. */
function verifierTable() {
  const problemes = [];
  for (const mutation of MUTATIONS) {
    if (!existsSync(join(racine, mutation.fichier))) {
      problemes.push(`${mutation.fichier} : fichier introuvable (entrée #${mutation.ticket})`);
      continue;
    }
    if (!lire(mutation.fichier).includes(mutation.motif)) {
      problemes.push(
        `${mutation.fichier} : motif introuvable pour « ${mutation.titre} » (#${mutation.ticket}) — réancrer l'entrée`
      );
    }
    if (mutation.motif === mutation.remplacement) {
      problemes.push(`#${mutation.ticket} : la mutation ne change rien`);
    }
    for (const test of mutation.tests) {
      if (!existsSync(join(racine, test))) {
        problemes.push(`#${mutation.ticket} : ${test} introuvable`);
      }
    }
  }
  return problemes;
}

const problemes = verifierTable();
if (problemes.length > 0) {
  console.error('✖ Table des garde-fous incohérente :');
  for (const probleme of problemes) console.error(`  - ${probleme}`);
  process.exit(1);
}

if (VERIFIE) {
  // `--json` sert à `scripts/ci/garde-fous.test.ts` : il compare la table à une **liste
  // attendue**, donc retirer une entrée fait échouer `npm test`. Un harnais qu'on peut
  // vider discrètement serait le faux garde-fou de plus.
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify({
        count: MUTATIONS.length,
        tickets: MUTATIONS.map((mutation) => mutation.ticket).sort((a, b) => a - b),
        fichiers: MUTATIONS.map((mutation) => mutation.fichier)
      })
    );
  } else {
    console.log(`✔ ${MUTATIONS.length} garde-fous ancrés, et leurs tests ciblés existent.`);
  }
  process.exit(0);
}

console.log(`Garde-fous — ${MUTATIONS.length} mutations critiques, chacune DOIT faire échouer la suite.\n`);

const resultats = [];
for (const mutation of MUTATIONS) {
  const chemin = join(racine, mutation.fichier);
  const original = readFileSync(chemin, 'utf8');
  let echoue = false;
  let sortie = '';
  try {
    writeFileSync(chemin, original.replace(mutation.motif, mutation.remplacement));
    try {
      execFileSync(vitest, ['run', ...mutation.tests], { cwd: racine, stdio: 'pipe', timeout: 300_000 });
    } catch (erreur) {
      echoue = true;
      sortie =
        String(erreur.stdout ?? '')
          .split('\n')
          .find((l) => l.includes('FAIL')) ?? '';
    }
  } finally {
    writeFileSync(chemin, original);
  }
  // La restauration est **relue** : une entrée qui laissrait un fichier muté serait pire
  // que le défaut qu'elle surveille.
  const restaure = readFileSync(chemin, 'utf8') === original;
  resultats.push({ mutation, echoue, restaure, sortie });
  const marque = echoue ? '✔ échoue' : '✖ MORTE  ';
  console.log(`${marque}  #${mutation.ticket}  ${mutation.titre}`);
  if (!echoue) console.log(`         └ garde vivante ? ${mutation.garde}`);
  else if (sortie) console.log(`         └ ${sortie.trim()}`);
  if (!restaure) console.log(`         └ ✖ FICHIER NON RESTAURÉ : ${mutation.fichier}`);
}

const mortes = resultats.filter((r) => !r.echoue);
const nonRestaures = resultats.filter((r) => !r.restaure);
console.log(`\n${resultats.length - mortes.length}/${resultats.length} mutations font échouer la suite.`);

if (nonRestaures.length > 0) {
  console.error(`✖ ${nonRestaures.length} fichier(s) laissé(s) muté(s) — état du dépôt compromis.`);
  process.exit(2);
}
if (mortes.length > 0) {
  console.error(
    `\n✖ ${mortes.length} garde-fou(s) mort(s) : la suite passe alors que le code est cassé.\n` +
      '  Ce n’est pas la mutation qu’il faut retirer, c’est le test qu’il faut renforcer.'
  );
  process.exit(1);
}
console.log('✔ Toutes les gardes sont vivantes : le code muté casse bien la suite.');
