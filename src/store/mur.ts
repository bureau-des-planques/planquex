/**
 * Le mur de la Boîte à idées — le contrat de `docs/boite-a-idees.json` (#129).
 *
 * L'alpha est **en lecture seule** (D-058) : le jeu lit ce fichier, que Vite bundle
 * (`resolveJsonModule`), et il n'y écrit **jamais**. La seule écriture est l'**export**
 * du mode de placement (D-068), que la personne commite — un site statique ne peut pas
 * écrire dans son propre dépôt, et c'est le mécanisme assumé de l'alpha.
 *
 * La forme fait foi dans `docs/BOITE-A-IDEES.md` §3. Les listes ci-dessous la recopient
 * **pour la contrôler** : une valeur hors liste n'est pas affichée en silence, elle est
 * signalée. `mur.test.ts` confronte ce contrôle à un fichier fautif **fabriqué** — un
 * contrôle qui ne peut pas échouer ne garde rien (`AGENTS.md` §6, ticket #112).
 */
import murBrut from '../../docs/boite-a-idees.json';

/** Les deux familles (D-058, §1) : une troisième serait déjà trop pour un mur. */
export const FAMILLES = ['IP', 'OUF'] as const;
export type Famille = (typeof FAMILLES)[number];

/** Les cinq statuts (§2). Un post-it retiré **disparaît** du fichier, sans statut. */
export const STATUTS = ['en attente', 'retenu', 'en cours', 'fait', 'écarté'] as const;
export type Statut = (typeof STATUTS)[number];

/** Les écrans du formulaire (§4.1) — « Autre » existe parce qu'on ne devine pas. */
export const ECRANS = ['Accueil', 'Collection', 'Deck', 'Combat', 'Réglages', 'Autre'] as const;
export type Ecran = (typeof ECRANS)[number];

/** Une place sur le tableau : en **pourcentage**, jamais en pixels (D-068). */
export interface PositionPostit {
  x: number;
  y: number;
  angle: number;
}

/** Les compteurs du mur complet, à zéro dans l'alpha (ils attendent la base, #135). */
export interface VotesPostit {
  up: number;
  down: number;
}

/**
 * Un post-it tel que le fichier le porte, une fois normalisé.
 *
 * `kind` vaut `null` pour un **gueulage** : depuis D-085 il n'est **ni une IP ni un OUF**,
 * c'est une nature à part, et le fichier n'écrit pas de famille (`kind` absent). `lie`
 * porte l'`id` du post-it (IP ou OUF) que la même réponse a produit et qu'on lui **colle**
 * dessus ; `null` quand le gueulage est seul.
 */
export interface Postit {
  id: string;
  kind: Famille | null;
  titre: string;
  texte: string;
  ecran: Ecran | '';
  pseudo: string;
  version: string;
  statut: Statut;
  raison: string;
  ticket: number | null;
  gueulage: boolean;
  lie: string | null;
  position: PositionPostit;
  votes: VotesPostit;
}

/** Le document entier : l'adresse du formulaire, puis les post-its. */
export interface Mur {
  formulaire: string;
  postits: Postit[];
}

/**
 * Le document tel qu'il est dans le dépôt. **Une seule** lecture, partagée par l'écran
 * et par l'export : le fichier est petit, il est bundlé, et il s'affiche donc aussi
 * **hors ligne** (le service worker précache le paquet de l'application).
 */
export const DOCUMENT_MUR: unknown = murBrut;

type Brut = Record<string, unknown>;

const estObjet = (valeur: unknown): valeur is Brut =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

const estTexte = (valeur: unknown): valeur is string => typeof valeur === 'string';

const estNombre = (valeur: unknown): valeur is number =>
  typeof valeur === 'number' && Number.isFinite(valeur);

const estEntier = (valeur: unknown): valeur is number =>
  typeof valeur === 'number' && Number.isInteger(valeur);

function dansListe<T extends string>(liste: readonly T[], valeur: unknown): valeur is T {
  return estTexte(valeur) && (liste as readonly string[]).includes(valeur);
}

function borne(valeur: number, min: number, max: number, ou: string, erreurs: string[]): number {
  if (valeur < min || valeur > max) {
    erreurs.push(`${ou} : ${valeur} n’est pas entre ${min} et ${max}`);
  }
  return valeur;
}

/**
 * Lit et contrôle le fichier du mur. Rend `mur: null` dès qu'une seule entrée est
 * fautive : mieux vaut un écran d'erreur explicite qu'un mur à moitié faux.
 */
export function lireMur(source: unknown): { mur: Mur | null; erreurs: string[] } {
  const erreurs: string[] = [];

  if (!estObjet(source)) {
    return { mur: null, erreurs: ['la racine du fichier n’est pas un objet'] };
  }

  if (!estTexte(source.formulaire)) {
    erreurs.push('formulaire : doit être une chaîne (elle peut être vide)');
  }
  const formulaire = estTexte(source.formulaire) ? source.formulaire.trim() : '';

  if (!Array.isArray(source.postits)) {
    return { mur: null, erreurs: [...erreurs, 'postits : doit être une liste'] };
  }

  const vus = new Set<string>();
  const postits: Postit[] = [];
  /** Les `lie` à résoudre **après** la boucle : l'ordre du fichier ne compte pas. */
  const liens: Array<{ ou: string; lie: string }> = [];

  source.postits.forEach((entree, index) => {
    const ou = `postits[${index}]`;
    if (!estObjet(entree)) {
      erreurs.push(`${ou} : n’est pas un objet`);
      return;
    }

    const id = estTexte(entree.id) ? entree.id.trim() : '';
    if (!id) {
      erreurs.push(`${ou}.id : identifiant manquant`);
    } else if (vus.has(id)) {
      erreurs.push(`${ou}.id : identifiant en double (« ${id} »)`);
    } else {
      vus.add(id);
    }

    // La nature d'abord : depuis D-085, `kind` dépend de `gueulage`.
    const gueulage = entree.gueulage === true;
    if (typeof entree.gueulage !== 'boolean') {
      erreurs.push(`${ou}.gueulage : doit être un booléen`);
    }

    let kind: Famille | null = null;
    if (gueulage) {
      // Un gueulage **ne porte pas de famille** : ni « IP » ni « OUF » (D-085).
      if (Object.hasOwn(entree, 'kind') && entree.kind !== undefined) {
        erreurs.push(`${ou}.kind : un gueulage ne porte pas de famille (D-085 : retire « kind »)`);
      }
    } else if (dansListe(FAMILLES, entree.kind)) {
      kind = entree.kind;
    } else {
      erreurs.push(`${ou}.kind : « ${String(entree.kind)} » n’est pas une famille admise (${FAMILLES.join(', ')})`);
    }

    const lieBrut = estTexte(entree.lie) ? entree.lie.trim() : '';
    if (entree.lie !== undefined && entree.lie !== null && !lieBrut) {
      erreurs.push(`${ou}.lie : doit valoir null ou l’identifiant du post-it collé (une chaîne non vide)`);
    }

    const titre = estTexte(entree.titre) ? entree.titre.trim() : '';
    if (!titre) erreurs.push(`${ou}.titre : titre manquant`);

    const texte = estTexte(entree.texte) ? entree.texte : '';
    if (!texte.trim()) erreurs.push(`${ou}.texte : texte manquant`);

    const statut = dansListe(STATUTS, entree.statut) ? entree.statut : null;
    if (!statut) {
      erreurs.push(`${ou}.statut : « ${String(entree.statut)} » n’est pas un statut admis (${STATUTS.join(', ')})`);
    }

    const raison = estTexte(entree.raison) ? entree.raison.trim() : '';
    if (statut === 'écarté' && !raison) {
      erreurs.push(`${ou}.raison : obligatoire quand le statut vaut « écarté »`);
    }

    if (entree.ecran !== undefined && entree.ecran !== '' && !dansListe(ECRANS, entree.ecran)) {
      erreurs.push(`${ou}.ecran : « ${String(entree.ecran)} » n’est pas un écran admis (${ECRANS.join(', ')})`);
    }

    if (entree.ticket !== undefined && entree.ticket !== null && !(estEntier(entree.ticket) && entree.ticket > 0)) {
      erreurs.push(`${ou}.ticket : doit valoir null ou un numéro d’issue`);
    }

    if (lieBrut) {
      liens.push({ ou, lie: lieBrut });
    }

    const position = estObjet(entree.position) ? entree.position : null;
    if (!position) {
      erreurs.push(`${ou}.position : la place sur le tableau manque`);
    }
    const x = estNombre(position?.x) ? borne(position.x, 0, 100, `${ou}.position.x`, erreurs) : 0;
    const y = estNombre(position?.y) ? borne(position.y, 0, 100, `${ou}.position.y`, erreurs) : 0;
    const angle = estNombre(position?.angle) ? borne(position.angle, -5, 5, `${ou}.position.angle`, erreurs) : 0;
    if (position && (!estNombre(position.x) || !estNombre(position.y) || !estNombre(position.angle))) {
      erreurs.push(`${ou}.position : x, y et angle doivent être des nombres`);
    }

    const votes = estObjet(entree.votes) ? entree.votes : null;
    if (votes && (!estEntier(votes.up) || votes.up < 0 || !estEntier(votes.down) || votes.down < 0)) {
      erreurs.push(`${ou}.votes : up et down doivent être des entiers positifs ou nuls`);
    }

    postits.push({
      id,
      kind,
      titre,
      texte,
      ecran: dansListe(ECRANS, entree.ecran) ? entree.ecran : '',
      pseudo: estTexte(entree.pseudo) ? entree.pseudo.trim() : '',
      version: estTexte(entree.version) ? entree.version.trim() : '',
      statut: statut ?? 'en attente',
      raison,
      ticket: estEntier(entree.ticket) ? entree.ticket : null,
      gueulage,
      lie: lieBrut || null,
      position: { x, y, angle },
      votes: {
        up: votes && estEntier(votes.up) ? votes.up : 0,
        down: votes && estEntier(votes.down) ? votes.down : 0
      }
    });
  });

  // `lie` se résout **après** la boucle : l'ordre du fichier ne compte pas, et un
  // gueulage peut désigner un post-it qui le suit.
  const parId = new Map(postits.map((postit) => [postit.id, postit]));
  for (const { ou, lie } of liens) {
    const cible = parId.get(lie);
    if (!cible) {
      erreurs.push(`${ou}.lie : « ${lie} » ne désigne aucun post-it du fichier`);
    } else if (cible.gueulage) {
      erreurs.push(`${ou}.lie : « ${lie} » est un gueulage — un gueulage ne se colle pas sur un gueulage`);
    }
  }

  return erreurs.length ? { mur: null, erreurs } : { mur: { formulaire, postits }, erreurs };
}

const arrondi = (valeur: number) => Math.round(valeur * 10) / 10;

/**
 * Le fichier du mur, avec les positions du mode de placement (D-068).
 *
 * On part du document **tel qu'il est** (`structuredClone`) et on ne remplace que
 * `position` : le `_lisez_moi`, l'adresse du formulaire et les champs qu'on ne connaît
 * pas encore traversent l'export sans être réécrits. C'est ce texte-là qui se commite.
 */
export function exporterMur(
  positions: Readonly<Record<string, PositionPostit>>,
  document: unknown = DOCUMENT_MUR
): string {
  const copie = structuredClone(document) as { postits?: Array<Brut> } | null;

  if (copie && Array.isArray(copie.postits)) {
    for (const postit of copie.postits) {
      if (!estObjet(postit)) continue;
      const position = positions[String(postit.id ?? '')];
      if (!position) continue;
      postit.position = {
        x: arrondi(position.x),
        y: arrondi(position.y),
        angle: arrondi(position.angle)
      };
    }
  }

  return `${JSON.stringify(copie, null, 2)}\n`;
}
