/**
 * **Le journal des versions** — ce que chaque version publiée contient.
 *
 * **Fichier généré : ne pas éditer à la main.** Il est écrit par
 * `npm run notes:versions` (`scripts/notes-versions.mjs`) à partir des **releases
 * GitHub** du dépôt, qui restent la source des notes. Une version publiée sans release
 * n'a donc pas d'entrée ici, et `src/data/versions.test.ts` refuse que la version de
 * `package.json` manque.
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : le dépôt est **privé**,
 * l'API répond `404` sans jeton, et un jeton dans le bundle se lit dans les DevTools.
 * L'application lit donc ce fichier, embarqué au build : elle marche **hors ligne**, et
 * il n'y a rien à configurer. Le pont avec GitHub est le script, lancé **avant de
 * taguer** (`docs/VERSIONS.md` §4).
 *
 * **Une seule entorse à la règle « aucun numéro en dur dans `src/` »**, et elle est
 * voulue : ce fichier **est** l'historique, donc il nomme les versions passées. La garde
 * de `src/version.test.ts` l'admet nommément ; la version **courante**, elle, ne se lit
 * que par `APP_LABEL` (`src/version.ts`), et `versions.test.ts` vérifie qu'elle a bien
 * sa note ici.
 *
 * **L'ordre des gestes, quand on publie** (`docs/VERSIONS.md` §4) : on écrit d'abord la
 * note de la version à venir ici — le tag part **avant** la release GitHub, donc exiger la
 * release rendrait la garde inapplicable au moment où elle sert. La release publiée
 * remplace ensuite cette entrée (`npm run notes:versions`), et le drapeau `brouillon`
 * tombe avec elle.
 */

export interface PointNote {
  /** Le groupe de la release, quand elle en avait un (« Jeu », « Interface et captures »). */
  groupe?: string;
  /** Le point lui-même, en clair : le markdown de la release est retiré à la génération. */
  texte: string;
}

export interface NoteVersion {
  /** Le numéro, sans le `v` du tag : `0.1.6`. C'est lui qu'on compare à `package.json`. */
  version: string;
  /** Le jour de la publication, au format `AAAA-MM-JJ` (celui de la release). */
  date: string;
  /** Le titre de la release, raccourci quand il portait le libellé complet. */
  titre: string;
  /** Ce que la version change, groupé par thème quand il y a beaucoup à dire. */
  points: PointNote[];
  /**
   * Une note **écrite d'avance**, que GitHub ne connaît pas encore : elle attend sa
   * release. Elle **compte** pour la garde (« on ne publie pas une version sans sa note »,
   * et le tag part avant la release) ; l'écran, lui, ne montre pas la note d'une version
   * qui n'est pas celle sous les yeux. La release publiée prendra sa place, et le drapeau
   * tombera avec elle.
   */
  brouillon?: boolean;
}

/**
 * L'historique, **de la plus récente à la plus ancienne**.
 *
 * La forme est gardée par `versions.test.ts` : une version publiée sans entrée, un ordre
 * cassé, une date mal écrite ou une entrée vide font échouer la suite.
 */
export const NOTES_VERSIONS: NoteVersion[] = [
  {
    version: '0.1.7',
    date: '2026-10-25',
    titre: 'Les comptes, et le mur qui écrit',
    points: [
      {
        groupe: 'Comptes',
        texte: 'Connexion Google ou courriel, et validation manuelle : un compte en attente joue et lit, mais n’écrit rien tant qu’il n’est pas approuvé (#181, D-088).'
      },
      {
        groupe: 'Comptes',
        texte: 'Un écran d’administration approuve les comptes, et trie les post-its : statut, raison d’un écarté, ticket (#139, 0006).'
      },
      {
        groupe: 'Le mur',
        texte: 'Il lit la base : poster depuis le jeu, commenter, corriger ou retirer son post-it tant qu’il est en attente (#136, #138, #139).'
      },
      {
        groupe: 'Le mur',
        texte: 'Les pouces 👍/👎, un par appareil, jamais pour soi (#137).'
      },
      {
        groupe: 'Le mur',
        texte: 'Un gueulage s’écrit sans famille (D-085), et le mur se range par script (#140).'
      },
      {
        groupe: 'Le jeu',
        texte: 'Les sept mécaniques du moteur sont câblées sur leurs cartes : défausse, révélation, regard, recherche, « en jouant », dégâts de Talent, café au Banc (#175).'
      },
      {
        groupe: 'Le jeu',
        texte: 'Les choix nomment leur carte, et le dessus du Deck s’affiche (#171).'
      },
      {
        groupe: 'Le jeu',
        texte: 'La trace des combats solo est gardée sous le compte, sans bloquer le jeu (#173, D-086).'
      },
      {
        groupe: 'Le jeu',
        texte: 'La fin de partie à deux est testée des deux côtés (#127).'
      },
      {
        groupe: 'Interface',
        texte: 'Collection et Deck : tri, cartes possédées lisibles, gabarit à cadre (#179).'
      },
      {
        groupe: 'Interface',
        texte: 'Passe de finition de l’alpha : états, dialogues, confirmation, contraste, grille (#131).'
      },
      {
        groupe: 'Interface',
        texte: 'Une page de confidentialité publique, qui dit ce que le jeu garde de toi (D-088).'
      },
      {
        groupe: 'Interface',
        texte: 'La note de version se lit dans le jeu, sur /nouveautés (D-090, #182).'
      },
      {
        groupe: 'Outillage',
        texte: 'Les tests ne partagent plus de chemin et tolèrent la charge (#176).'
      },
      {
        groupe: 'Outillage',
        texte: 'Le budget de la recherche de l’IA est borné, avec repli glouton (#172).'
      }
    ]
  },
  {
    version: '0.1.6',
    date: '2026-10-23',
    titre: 'L’Atelier a ses illustrations',
    points: [
      {
        texte: 'Les 27 cartes de l’Atelier sont illustrées (26 nouvelles, plus le Chef d’atelier déjà au registre) : le pilote #132 est livré, et c’est la première faction complète.'
      },
      {
        texte: 'Chaque image est au registre avec sa graine, et la carte porte son art: — le gabarit l’affiche, avec repli sur l’aplat si l’image manque.'
      },
      {
        texte: 'Quatre variantes ont été écartées pour un défaut visible : un cadre blanc, et du texte anglais incrusté (« STUCK AGAIN », « MAINTENANCE PLAN », « SPARE PARTS AREA », « BAY 3 »).'
      },
      {
        groupe: 'Le gueulage est à part',
        texte: 'Un gueulage n’est plus étiqueté IP ni OUF : c’est sa propre nature (D-085). C’est le parcours du formulaire qui décide — on gueule, puis on choisit de remonter un bug ou de proposer une idée.'
      },
      {
        groupe: 'Le gueulage est à part',
        texte: 'Quand la même réponse a produit un signalement ou une idée, ce post-it est collé sur le gueulage et se trie séparément.'
      },
      {
        groupe: 'Le mur',
        texte: 'Le mur lit toujours docs/boite-a-idees.json, et l’import du formulaire (#177) alimente le fichier.'
      }
    ]
  },
  {
    version: '0.1.5',
    date: '2026-10-22',
    titre: 'Le mur des retours fonctionne de bout en bout',
    points: [
      {
        texte: 'Les réponses du formulaire de la Boîte à idées sont importées automatiquement vers le mur : npm run mur:import lit la feuille de réponses en CSV et ajoute les post-its manquants (#177).'
      },
      {
        texte: 'L’import est idempotent (deux exécutions n’ajoutent rien), ne touche jamais à un post-it déjà trié, et n’écrit rien si le CSV est illisible.'
      },
      {
        texte: 'Les deux premiers post-its réels sont sur le mur.'
      },
      {
        texte: 'Règle de rangement appliquée : « Remonter un bug » → OUF, « Proposer une feature » et « Donner ton avis » → IP ; un gueulage sans titre en fabrique un avec ses premiers mots, et le post-it le dit.'
      },
      {
        groupe: 'Le reste du lot',
        texte: 'Le vocabulaire : Chariot → Deck, Parc → Collection, Rack → Banc.'
      },
      {
        groupe: 'Le reste du lot',
        texte: 'Le combat qui se lit d’un coup, la main visible sur téléphone.'
      },
      {
        groupe: 'Le reste du lot',
        texte: 'Les 133 Pressions qui ont un texte.'
      },
      {
        groupe: 'Le reste du lot',
        texte: 'Les sept mécaniques du moteur (défausse, révélation, regard, recherche, « en jouant », dégâts de Talent, café au Banc) — testées, pas encore câblées sur les cartes (#175).'
      },
      {
        groupe: 'Le reste du lot',
        texte: 'Le niveau 2 de l’IA est la recherche à deux coups (D-084) ; l’écran passe dessus quand les pics de temps sont bornés (#172).'
      }
    ]
  },
  {
    version: '0.1.4',
    date: '2026-10-22',
    titre: 'Le combat se lit d’un coup',
    points: [
      {
        texte: 'Le pas-à-pas est en haut, collé, et « Suivant » amène la cible de l’étape à l’écran (#169).'
      },
      {
        texte: 'La main reste visible sans défiler sur téléphone (#170).'
      },
      {
        texte: 'Poser une carte se fait en deux temps, avec les gestes nommés (#169).'
      },
      {
        groupe: 'Le vocabulaire suit le réel',
        texte: 'Chariot devient Deck, Parc devient Collection (D-075) ; Rack devient Banc (D-083).'
      },
      {
        groupe: 'Le vocabulaire suit le réel',
        texte: 'Les anciennes adresses /chariot et /parc redirigent.'
      },
      {
        groupe: 'Le contenu dit ce qu’il fait',
        texte: 'Les 133 Pressions qui n’avaient pas de texte en ont un (D-074).'
      },
      {
        groupe: 'Le contenu dit ce qu’il fait',
        texte: 'Quatre Pressions reviennent à la version vendue par la spécification.'
      },
      {
        groupe: 'Le moteur sait faire sept choses de plus',
        texte: 'Défausser une carte de la main, révéler, regarder le dessus du Deck, chercher dans le Deck, les Talents « en jouant », un Talent qui inflige des dégâts, attacher un café au Banc (D-076 à D-082).'
      },
      {
        groupe: 'Le moteur sait faire sept choses de plus',
        texte: 'Aucune carte ne porte encore ces mécaniques : elles sont testées, pas câblées.'
      },
      {
        groupe: 'La partie tient et parle juste',
        texte: 'Une partie, à deux ou en solo, survit au rechargement (#126).'
      },
      {
        groupe: 'La partie tient et parle juste',
        texte: 'Le journal ne dit plus « l’IA » quand c’est un humain (#154).'
      },
      {
        groupe: 'L’IA de la Direction',
        texte: 'Le niveau 2 devient une recherche à deux coups : elle gagne 60 % contre le niveau 1 sur des graines neuves, là où l’ancien glouton faisait 44 %. Deux réserves écrites : la mesure ne porte que contre le niveau 1, et des pics de temps restent à borner (#172).'
      },
      {
        groupe: 'Les illustrations',
        texte: 'Le wizard réessaie les échecs de transport, gagne un mode direct et un prompt testable (#156).'
      },
      {
        groupe: 'Outillage',
        texte: 'Le garde-fou texte ⇔ mécanique respecte les frontières de mot (#166).'
      },
      {
        groupe: 'Outillage',
        texte: 'Les cinq documents de mesure de l’IA sont rangés dans docs/ia/, avec un index.'
      }
    ]
  },
  {
    version: '0.1.3',
    date: '2026-10-22',
    titre: 'La partie à deux, et le mur des retours',
    points: [
      {
        groupe: 'Jeu',
        texte: 'Partie à deux : un tour se joue de bout en bout, et la partie s’encode et se décode (#125, #124).'
      },
      {
        groupe: 'Jeu',
        texte: 'Journée d’intégration : quatre étapes, puis le pas-à-pas du premier combat (#130, #143).'
      },
      {
        groupe: 'Interface et captures',
        texte: 'Boîte à idées : la bulle et le mur, en lecture seule (#129).'
      },
      {
        groupe: 'Interface et captures',
        texte: 'Les cinq écrans sont rendus dans des tests (#145) ; captures à la taille téléphone (#150, #153).'
      },
      {
        groupe: 'Contenu et garde-fous',
        texte: 'Cible de contenu : plus de « 286 » dans les documents vivants (#148, #152, #155).'
      },
      {
        groupe: 'Contenu et garde-fous',
        texte: 'Garde des décomptes : une cible retirée ne passe plus pour atteinte (#151).'
      },
      {
        groupe: 'Contenu et garde-fous',
        texte: 'Dépendances signalées : détecteur d’UI épinglé (#146), outils de test d’écran (#145).'
      },
      {
        groupe: 'Illustrations',
        texte: 'Sujets et accents des 225 cartes de base, wizard recâblé (#121).'
      },
      {
        groupe: 'Illustrations',
        texte: 'Wizard : réessais sur timeout de transport, mode direct --direct, prompt testable --prompt (#156).'
      },
      {
        groupe: 'Documents',
        texte: 'D-070 à D-073 : nom de l’ancien projet retiré de la doc (#149), formulaire de l’alpha, domaine planquex.4k7.org et redirection de planquex.vercel.app.'
      }
    ]
  },
  {
    version: '0.1.2',
    date: '2026-10-21',
    titre: 'Illustrations servies par Vite',
    points: [
      {
        groupe: 'Ce qui change',
        texte: 'les illustrations sont précachées — le jeu marche hors ligne, images comprises ;'
      },
      {
        groupe: 'Ce qui change',
        texte: 'dix fichiers dupliqués supprimés : une image regénérée arrive à l’écran au build suivant ;'
      },
      {
        groupe: 'Ce qui change',
        texte: 'le wizard d’illustration n’écrit plus qu’au registre, et un test refuse qu’une copie servie revienne.'
      }
    ]
  },
  {
    version: '0.1.1',
    date: '2026-10-21',
    titre: 'L’alpha ouvre ses portes',
    points: [
      {
        groupe: 'Ce qui marche',
        texte: 'Journée d’intégration : quatre écrans pour les bases, au premier lancement. On peut la revoir depuis Réglages.'
      },
      {
        groupe: 'Ce qui marche',
        texte: 'Arrivages : 5 cartes à chaque ouverture — 3 communes, 1 peu commune, 1 rare au minimum.'
      },
      {
        groupe: 'Ce qui marche',
        texte: 'Parc : toutes tes cartes, avec recherche, filtres par faction et par stade, et la fiche de chaque carte.'
      },
      {
        groupe: 'Ce qui marche',
        texte: 'Chariot : 20 cartes, au moins un Planqué Entrant, 2 exemplaires maximum du même nom. Le bouton « Remplir » en compose un tout seul. Tu choisis aussi jusqu’à 3 types de café.'
      },
      {
        groupe: 'Ce qui marche',
        texte: 'Combat contre la Direction (l’adversaire est joué par l’ordinateur) : Poste, Rack, cafés, Pressions, statuts. Trois Interventions pour gagner.'
      }
    ]
  }
];

/** La note d'une version — publiée, ou écrite d'avance. */
export function noteDe(
  version: string,
  notes: NoteVersion[] = NOTES_VERSIONS
): NoteVersion | undefined {
  return notes.find((note) => note.version === version);
}

/**
 * **La garde** : `true` quand la version courante n'a **aucune** note.
 *
 * C'est la règle de `docs/VERSIONS.md` rendue exécutable : on ne publie pas une version
 * sans sa note. Une note écrite d'avance compte — le tag part **avant** la release GitHub,
 * donc exiger la release rendrait la règle inapplicable au moment où elle sert.
 *
 * La fonction prend ses notes en paramètre pour que le test puisse la confronter à un
 * **cas fautif** — sans quoi l'assertion ne garderait rien.
 */
export function noteManquante(
  version: string,
  notes: NoteVersion[] = NOTES_VERSIONS
): boolean {
  return noteDe(version, notes) === undefined;
}
