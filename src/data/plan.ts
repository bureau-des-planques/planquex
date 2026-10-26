/**
 * **La feuille de route, la part écrite à la main** (D-097 (3), #214).
 *
 * La page `/feuille-de-route` a deux sources, et la séparation est le point :
 *
 * - **ce fichier** porte ce qui est **décidé** — l'étape en cours, les critères de sortie
 *   d'alpha (**D-056**), les jalons (**D-048**), ce qui est rangé pour plus tard
 *   (**D-061**) et ce qui ne bouge pas pendant l'alpha (**D-056**). Cela ne se déduit
 *   d'aucune donnée : c'est une décision, datée, et elle **cite sa décision** ;
 * - **`src/data/plan-dev.ts`** porte ce qui est **en cours** — les issues `alpha`
 *   ouvertes, prises à GitHub par `npm run plan:dev`. Une liste tenue à la main se
 *   désynchronise en silence ; celle-ci est régénérée.
 *
 * Trois règles d'écriture :
 *
 * 1. **chaque entrée cite sa décision** (`D-056`, `D-048`, `D-061`) : un critère sans
 *    source est un avis, et `src/data/plan.test.ts` refuse les deux ;
 * 2. **aucun numéro de version** : l'étape se nomme « alpha », « beta », « release » ; le
 *    numéro vit dans `package.json` et nulle part ailleurs (`src/version.test.ts`) ;
 * 3. **les modes parkés de D-019 n'entrent pas** : la page est publique, et annoncer un
 *    mode que personne n'a acté serait promettre ce qui n'existe pas.
 *
 * Le texte suit `docs/DECISIONS.md` — quand une décision change, c'est ici qu'on la relit.
 */

/** Une entrée de la feuille de route, avec la décision qui la fonde. */
export interface ElementPlan {
  /** Le texte, en clair, tel qu'il se lit dans la page. */
  texte: string;
  /** La décision qui le fonde : `D-\d{3}` (voir `src/data/plan.test.ts`). */
  decision: string;
  /** Une réserve ou une précision que la décision porte, quand elle en porte une. */
  note?: string;
}

/** Une étape du projet (D-048) et ce qu'il faut pour la quitter. */
export interface Jalon {
  /** `alpha`, `beta`, `release` — l'étape, en un mot (D-048). */
  etape: string;
  /** Ce que l'étape veut dire, en une phrase : on ne la découvre pas par son nom. */
  texte: string;
  /** Ce qu'il faut avoir livré pour passer à la suivante. */
  criteres: ElementPlan[];
}

/**
 * **L'étape en cours** (D-048, D-056).
 *
 * Elle se nomme ici, et nulle part en numéro : le libellé affiché à côté vient d'`APP_LABEL`
 * (`src/version.ts`), donc de `package.json`.
 */
export const ETAPE_EN_COURS = {
  nom: 'alpha',
  texte:
    'Le solo se teste entre invités : le contenu est incomplet, la casse est assumée, et on cherche si la boucle tient.',
  decision: 'D-048'
};

/**
 * **Ce que l'alpha doit avoir livré pour qu'on vise la beta** (D-056) — les quatre points
 * (a) à (d), dans l'ordre de la décision.
 */
export const CRITERES_ALPHA: ElementPlan[] = [
  {
    texte: 'Les dix invités ont joué au moins une partie complète, chacun.',
    decision: 'D-056'
  },
  {
    texte: 'Plus aucun bug qui casse la boucle n’est ouvert.',
    decision: 'D-056'
  },
  {
    texte: 'La Journée d’intégration est finie.',
    decision: 'D-056'
  },
  {
    texte: 'La décision sur les illustrations est prise (D-057).',
    decision: 'D-056'
  }
];

/**
 * **Les jalons** (D-048) : trois étapes nommées, et rien d'autre.
 *
 * Les critères de **beta** sont ceux de D-048, **amendés** par D-064 (l'URL stable se
 * tranche pour la beta) et D-063 (les **bases** illustrées, sans compte imposé). Ceux de
 * **release** renvoient au reste de `PROPOSITION.md` §5.1, sans le recopier ici.
 */
export const JALONS: Jalon[] = [
  {
    etape: 'alpha',
    texte:
      'Le solo se teste entre invités : contenu incomplet et casse assumés, on cherche si la boucle tient.',
    criteres: [
      {
        texte: 'Les dix invités ont joué au moins une partie complète, chacun.',
        decision: 'D-056'
      },
      {
        texte: 'La Journée d’intégration est finie.',
        decision: 'D-056'
      }
    ]
  },
  {
    etape: 'beta',
    texte: 'Le solo est complet et le jeu à deux est jouable, sur une adresse stable.',
    criteres: [
      {
        texte:
          'Solo complet : la Journée d’intégration finie, les réglages, l’export et l’import de sauvegarde.',
        decision: 'D-048'
      },
      {
        texte: 'Le PvP est jouable.',
        decision: 'D-049'
      },
      {
        texte: 'L’URL est stable : le domaine est tranché.',
        decision: 'D-064'
      },
      {
        texte:
          'Les bases sont illustrées, ou la décision assumée de ne pas l’être — sans compte imposé.',
        decision: 'D-063'
      },
      {
        texte: 'Aucune perte de données n’est possible pour un invité.',
        decision: 'D-048'
      }
    ]
  },
  {
    etape: 'release',
    texte:
      'La beta, plus le reste de la proposition : le classé, l’économie, les missions, les échanges, les notifications, le polish et la localisation.',
    criteres: [
      {
        texte: 'Tout ce que `PROPOSITION.md` §5.1 range après la beta est livré.',
        decision: 'D-048'
      }
    ]
  }
];

/**
 * **Ce qui est décidé pour plus tard** (D-061) : quatre contenus que `PROPOSITION.md` §5.1
 * plaçait en phase 2 partent en **release**, et pas avant.
 */
export const DECIDE_PLUS_TARD: ElementPlan[] = [
  {
    texte: 'La Pause café (le Wonder Pick)',
    decision: 'D-061',
    note:
      'Le seul des quatre qui donne des cartes : premier candidat à remonter en beta si les invités réclament de quoi compléter leur Parc.'
  },
  {
    texte: 'La Boutique du CSE',
    decision: 'D-061'
  },
  {
    texte: 'Les Missions',
    decision: 'D-061'
  },
  {
    texte: 'Les Succès',
    decision: 'D-061'
  }
];

/**
 * **Les « pas maintenant »** (D-056) : la liste explicite de ce qui n'entre pas pendant
 * l'alpha. Sans elle, le backlog se remplit tout seul pendant qu'on écoute les retours.
 */
export const PAS_MAINTENANT: string[] = [
  'Économie',
  'Boutique du CSE',
  'Missions',
  'Succès',
  'Échanges',
  'Amis',
  'Casier',
  'Cotisation',
  'Comptes',
  'Classement',
  'Notifications',
  'Anglais',
  'Avis dans le jeu',
  'WebView'
];

/**
 * **Ce qui ne bouge pas pendant l'alpha** (D-056) — l'IA et le domaine, avec leur raison :
 * bouger l'un ou l'autre ferait perdre le fil du test en cours.
 */
export const FIGE_PENDANT_ALPHA: ElementPlan[] = [
  {
    texte: 'L’IA de la Direction',
    decision: 'D-056',
    note:
      'Le gain du niveau 2 s’est révélé un artefact de mesure : on ne le branche pas pendant l’alpha.'
  },
  {
    texte: 'Le domaine du jeu',
    decision: 'D-055',
    note: 'Une URL qui change ferait réinstaller l’application à tous les invités.'
  }
];
