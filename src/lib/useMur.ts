/**
 * Le mur vu d'une page : **un seul** état optimiste (#254, 2e partie).
 *
 * Trois pages lisent et touchent le mur — le mur lui-même, le suivi, l'administration — et
 * chacune refaisait la mécanique à la main : un `useState` pour l'envol, un autre pour
 * l'erreur, un `try`/`catch` par geste et un retour en arrière écrit au cas par cas. Ce hook
 * la tient **une fois** :
 *
 * - **`en vol`** : un geste par post-it à la fois (`voter:p-001`), jamais deux qui se
 *   marchent dessus ; la page lit `enVol('voter', id)` pour griser son bouton ;
 * - **`erreurs`** : le refus d'un geste se range **sur le post-it** qu'il visait, en
 *   français, tel que le port l'a rendu ;
 * - **rollback** : un geste optimiste (le pouce) bouge l'affichage **tout de suite** ; s'il
 *   est refusé, le post-it revient exactement à l'état d'avant.
 *
 * **Aucun `try`/`catch` par geste** : le port (`src/lib/mur.ts`) ne lève jamais, il rend
 * `{ ok: true, … }` ou `{ ok: false, message }`. Le hook ne fait que regarder `ok`.
 *
 * Le choix de la source (base, fichier de secours) et sa notice sont ceux de `charger()` :
 * la page reçoit `source` et `notice`, elle ne recompose plus le repli à la main.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { murDuJeu } from '@/lib/murBase';
import {
  compterApres,
  type BrouillonPostit,
  type Correction,
  type GesteEcriture,
  type OptionsPostit,
  type PortMur,
  type RefusMur,
  type ResultatMur,
  type TriPostit
} from '@/lib/mur';
import type { Mur, Postit, PositionPostit, SensVote } from '@/store/mur';

/** Les gestes du port, sans sa `source` : un port « du jeu » ne sait qu'au premier geste. */
export type GestesMur = Omit<PortMur, 'source'>;

/** Ce que le fichier du dépôt a donné à la page : le mur lu, et les erreurs de sa forme. */
export interface LectureFichier {
  mur: Mur | null;
  erreurs: string[];
}

export interface OptionsUseMur {
  /** La base est-elle configurée ? Sinon rien n'est contacté : la page garde son fichier. */
  branche: boolean;
  /** Le fichier du dépôt, lu une fois par la page (il ne change pas sans déploiement). */
  lecture: LectureFichier;
  /**
   * Ce que la page nomme dans la notice du repli : « le mur », « le suivi ». La notice dit
   * `La base n’a pas répondu : <quoi> affiche le fichier du dépôt. (<panne>)`.
   */
  quoi?: string;
  /**
   * `false` : une base qui ne répond pas **n'est pas** remplacée par le fichier, la panne est
   * rendue telle quelle (`erreurChargement`). C'est le cas de l'administration : trier le
   * fichier n'aurait aucun sens, et lui faire croire qu'il a le mur serait pire.
   */
  repli?: boolean;
  /** Le port, injectable. Par défaut : `murDuJeu()`, qui parle à la base ou au fichier. */
  mur?: GestesMur;
  /**
   * Une lecture vient de finir (réussie ou repliée) : la page y accroche ce qui en dépend —
   * les places du tableau, le fil, des brouillons à remettre à zéro. Appelé **à la sortie**
   * de la lecture, pas dans un effet : un rendu de retard suffirait à montrer un mur sans
   * son fil.
   */
  surLecture?: (lu: { source: 'base' | 'fichier'; postits: Postit[] }) => void;
}

/** Une retouche de la liste des post-its — pure, appliquée à l'optimiste comme au rollback. */
type Retouche = (postits: Postit[]) => Postit[];

interface Etat {
  mur: Mur | null;
  erreurs: string[];
  source: 'base' | 'fichier';
  chargement: boolean;
  notice: string | null;
  erreurChargement: string | null;
  enVol: ReadonlySet<string>;
  erreursGestes: Readonly<Record<string, string>>;
}

const cle = (geste: GesteEcriture, id: string) => `${geste}:${id}`;

/** Une retouche appliquée à un seul post-it. */
const surPostit =
  (id: string, retouche: (postit: Postit) => Postit): Retouche =>
  (postits) =>
    postits.map((postit) => (postit.id === id ? retouche(postit) : postit));

export function useMur({ branche, lecture, quoi = 'le mur', repli = true, mur, surLecture }: OptionsUseMur) {
  const port = useMemo<GestesMur>(() => mur ?? murDuJeu({ secours: repli }), [mur, repli]);

  const [etat, setEtat] = useState<Etat>(() => ({
    // Sur une base configurée, on n'affiche pas le fichier d'abord : un post-it qui
    // disparaîtrait à l'arrivée de la réponse serait pire qu'un court « le mur se charge ».
    mur: branche ? null : lecture.mur,
    erreurs: branche ? [] : lecture.erreurs,
    source: 'fichier',
    chargement: branche,
    notice: null,
    erreurChargement: null,
    enVol: new Set(),
    erreursGestes: {}
  }));

  /** La page peut changer de closure à chaque rendu : la lecture appelle la dernière. */
  const derniereLecture = useRef(surLecture);
  derniereLecture.current = surLecture;

  /** Le garde synchrone : l'état d'un rendu à l'autre est trop lent pour refuser un double clic. */
  const gardes = useRef(new Set<string>());

  // -------------------------------------------------------------------------------------------
  // La lecture
  // -------------------------------------------------------------------------------------------

  const lire = useCallback(
    async (vivant: () => boolean) => {
      setEtat((courant) => ({ ...courant, chargement: true, erreurChargement: null }));
      const resultat = await port.charger();
      if (!vivant()) return;

      // « Lu » : une source **vivante** a répondu (la base, ou la mémoire d'un test), pas le fichier.
      const lu = resultat.ok && resultat.source !== 'fichier';

      // Un port qui a lu le fichier sans notice : la base n'était pas armée (pas de client).
      const panne = resultat.ok ? (resultat.notice ?? 'La base n’est pas configurée.') : resultat.message;

      if (lu) {
        const postits = resultat.postits;
        setEtat((courant) => ({
          ...courant,
          chargement: false,
          mur: { formulaire: lecture.mur?.formulaire ?? '', postits },
          erreurs: [],
          source: 'base',
          notice: null
        }));
        derniereLecture.current?.({ source: 'base', postits });
        return;
      }

      // Pas de repli : la panne est rendue, et ce qui était lu reste affiché.
      if (!repli) {
        setEtat((courant) => ({ ...courant, chargement: false, erreurChargement: panne }));
        return;
      }

      // La base ne répond pas : le mur retombe sur le fichier **entier**, et le dit.
      setEtat((courant) => ({
        ...courant,
        chargement: false,
        mur: lecture.mur,
        erreurs: lecture.erreurs,
        source: 'fichier',
        notice: `La base n’a pas répondu : ${quoi} affiche le fichier du dépôt. (${panne})`
      }));
      derniereLecture.current?.({ source: 'fichier', postits: lecture.mur?.postits ?? [] });
    },
    [port, lecture, quoi, repli]
  );

  useEffect(() => {
    if (!branche) return;
    let vivant = true;
    void lire(() => vivant);
    return () => {
      vivant = false;
    };
  }, [branche, lire]);

  /** Relire le mur — « Rafraîchir », « Réessayer ». */
  const recharger = useCallback(() => lire(() => true), [lire]);

  // -------------------------------------------------------------------------------------------
  // La mécanique optimiste, une fois
  // -------------------------------------------------------------------------------------------

  const retoucher = useCallback(
    (retouche: Retouche, creer = false) => {
      setEtat((courant) => {
        if (!courant.mur && !creer) return courant;
        return {
          ...courant,
          mur: {
            formulaire: courant.mur?.formulaire ?? lecture.mur?.formulaire ?? '',
            postits: retouche(courant.mur?.postits ?? [])
          }
        };
      });
    },
    [lecture]
  );

  /**
   * Un geste, de bout en bout : il part en vol, l'affichage bouge s'il est optimiste, le
   * port répond, et selon `ok` la réussite s'applique ou le post-it revient en arrière avec
   * son message. Rend le résultat du port, pour que la page dise ce qu'elle veut en plus.
   */
  const lancer = useCallback(
    async <R extends object>(
      geste: GesteEcriture,
      id: string,
      appel: () => Promise<ResultatMur<R>>,
      regle: {
        optimiste?: Retouche;
        refus?: Retouche;
        succes?: (reussite: R) => Retouche;
        creer?: boolean;
      } = {}
    ): Promise<ResultatMur<R>> => {
      const verrou = cle(geste, id);
      if (gardes.current.has(verrou)) {
        return { ok: false, message: 'Un geste est déjà en cours sur ce post-it.' } satisfies RefusMur;
      }
      gardes.current.add(verrou);

      setEtat(({ erreursGestes: { [verrou]: _ancienne, ...reste }, ...courant }) => ({
        ...courant,
        erreursGestes: reste,
        enVol: new Set(courant.enVol).add(verrou)
      }));
      if (regle.optimiste) retoucher(regle.optimiste);

      try {
        const resultat = await appel();
        if (resultat.ok) {
          if (regle.succes) retoucher(regle.succes(resultat), regle.creer);
        } else {
          if (regle.refus) retoucher(regle.refus);
          setEtat((courant) => ({
            ...courant,
            erreursGestes: { ...courant.erreursGestes, [verrou]: resultat.message }
          }));
        }
        return resultat;
      } finally {
        gardes.current.delete(verrou);
        setEtat((courant) => {
          const reste = new Set(courant.enVol);
          reste.delete(verrou);
          return { ...courant, enVol: reste };
        });
      }
    },
    [retoucher]
  );

  // -------------------------------------------------------------------------------------------
  // Les gestes — ceux du port, avec leur effet sur l'écran
  // -------------------------------------------------------------------------------------------

  /**
   * Un clic sur un pouce (#137). Le compte bouge **tout de suite** ; si la base refuse,
   * le post-it revient exactement à l'état d'avant. On ne vote pas pour le sien.
   */
  const voter = useCallback(
    async (postit: Postit, demande: SensVote) => {
      if (postit.mien) return null;
      const avant = postit.votes;
      const monVote = avant.mon ?? null;
      const apres = monVote === demande ? null : demande;
      return lancer('voter', postit.id, () => port.voter(postit.id, demande, monVote), {
        optimiste: surPostit(postit.id, (p) => ({ ...p, votes: compterApres(avant, monVote, apres) })),
        refus: surPostit(postit.id, (p) => ({ ...p, votes: avant }))
      });
    },
    [lancer, port]
  );

  /** Poste un post-it : il rejoint le mur **après** la réponse, jamais avant d'exister. */
  const poster = useCallback(
    (brouillon: BrouillonPostit, options?: OptionsPostit) =>
      lancer('poster', '', () => port.poster(brouillon, options), {
        succes:
          ({ postit }: { postit: Postit }) =>
          (postits) => [...postits, postit],
        creer: true
      }),
    [lancer, port]
  );

  /** Déplace le tri d'un post-it (l'administration, 0006). */
  const trier = useCallback(
    (id: string, tri: TriPostit) =>
      lancer('trier', id, () => port.trier(id, tri), {
        succes: ({ tri: ecrit }: { tri: TriPostit }) => surPostit(id, (p) => ({ ...p, ...ecrit }))
      }),
    [lancer, port]
  );

  /** Écrit la place d'un post-it ; la place **gardée** par la source est celle qui s'affiche. */
  const deplacer = useCallback(
    (id: string, place: PositionPostit) =>
      lancer('deplacer', id, () => port.deplacer(id, place), {
        succes: ({ position }: { position: PositionPostit }) => surPostit(id, (p) => ({ ...p, position }))
      }),
    [lancer, port]
  );

  /** Corrige le titre et le texte de **mon** post-it, tant qu'il est en attente (#139). */
  const corriger = useCallback(
    (id: string, correction: Correction) =>
      lancer('corriger', id, () => port.corriger(id, correction), {
        succes: ({ titre, texte }: Correction) => surPostit(id, (p) => ({ ...p, titre, texte }))
      }),
    [lancer, port]
  );

  /** Retire un post-it : il sort du mur dès que la source l'a supprimé. */
  const retirer = useCallback(
    (id: string) =>
      lancer('retirer', id, () => port.retirer(id), {
        succes: () => (postits) => postits.filter((postit) => postit.id !== id)
      }),
    [lancer, port]
  );

  return {
    /** Le mur tel que la page l'affiche : `null` tant que la base n'a pas répondu. */
    mur: etat.mur,
    /** Les erreurs de **forme** du fichier du dépôt, quand c'est lui qui est lu. */
    erreurs: etat.erreurs,
    source: etat.source,
    chargement: etat.chargement,
    /** La panne de la base, dite en français, quand la page est retombée sur le fichier. */
    notice: etat.notice,
    /** La panne de lecture quand le repli est désactivé (`repli: false`). */
    erreurChargement: etat.erreurChargement,
    /** Un geste est-il en vol ? Sans `id` : **n'importe lequel** de ce geste. */
    enVol: (geste: GesteEcriture, id?: string): boolean =>
      id === undefined
        ? [...etat.enVol].some((verrou) => verrou.startsWith(`${geste}:`))
        : etat.enVol.has(cle(geste, id)),
    /** Le refus du dernier geste essuyé par ce post-it, ou `null`. */
    erreur: (geste: GesteEcriture, id: string): string | null => etat.erreursGestes[cle(geste, id)] ?? null,
    recharger,
    voter,
    poster,
    trier,
    deplacer,
    corriger,
    retirer
  };
}
