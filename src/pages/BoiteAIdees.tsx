/**
 * Le mur de la Boîte à idées (#129, D-058 et D-068).
 *
 * **C'est une page**, pas un panneau : la bulle y mène, et elle est absente pendant un
 * combat — donc on ne quitte jamais une partie en cours pour venir lire le mur (D-068).
 *
 * Sans base, l'alpha est en **lecture seule** : le mur affiche ce que porte
 * `docs/boite-a-idees.json`, et rien d'autre. **Branché sur la base** (#136, #137), il ouvre
 * l'écriture : poster un post-it, et voter 👍 / 👎 par post-it, un vote par compte, jamais
 * pour le sien. **Depuis D-088 (#181)**, cette écriture exige un compte **approuvé** : un
 * compte en attente lit et joue, l'écran ne lui propose ni le formulaire ni les pouces — et la
 * base les refuserait de toute façon (migration 0005). Sans configuration — ou quand la base
 * ne répond pas et que la page retombe sur le fichier — il n'y a ni bouton ni compteur, et
 * rien n'est contacté. Le mode de placement, lui, n'écrit toujours que le fichier du dépôt.
 *
 * États (D-060) : **vide**, **erreur** et **chargement** sont rendus. Le chargement n'existe
 * que branché sur la base (sans elle, le fichier est bundlé par Vite : aucune requête) ; et
 * **hors ligne**, une base qui ne répond pas fait retomber le mur sur le fichier, avec la
 * notice « la base n'a pas répondu » — l'écran ne reste jamais sans mur. Le bandeau
 * hors ligne du Layout le dit en plus, pour toute l'application.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Download, ExternalLink, Move, RotateCcw, Send } from 'lucide-react';
import { Confirmation } from '@/components/Confirmation';
import { PAPIERS, PostitDuMur } from '@/components/PostitDuMur';
import type { GlisserPostit } from '@/components/PostitDuMur';
import {
  chargerCommentaires,
  chargerPostitsDuMur,
  commenterPostit,
  compterApres,
  corrigerPostit,
  deplacerPostit,
  grouperCommentaires,
  murEstConfigure,
  posterPostit,
  retirerPostit,
  supprimerCommentaire,
  verifierCommentaire,
  voterPourPostit
} from '@/lib/murBase';
import type { Commentaire } from '@/lib/murBase';
import { estAdministrateur, estApprouve } from '@/lib/comptes';
import { useComptes } from '@/store/comptes';
import { DOCUMENT_MUR, ECRANS, exporterMur, lireMur } from '@/store/mur';
import type { Ecran, Mur, Postit, PositionPostit, SensVote } from '@/store/mur';
import { useStore } from '@/store/useStore';
import { APP_LABEL } from '@/version';

/** Le fichier est lu une fois : il ne change pas sans un nouveau déploiement. */
const LECTURE = lireMur(DOCUMENT_MUR);

/** Les trois natures du formulaire : deux familles, et le gueulage à part (D-085). */
const NATURES = [
  ['IP', 'Une idée, une amélioration, un avis'],
  ['OUF', 'Un signalement : ça casse, ça ment'],
  ['GUEULAGE', 'Gueuler, sans classer']
] as const;
type Nature = (typeof NATURES)[number][0];

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

/** La légende des trois papiers, dans l'ordre où ils se lisent (D-068). */
const LEGENDE: Array<[keyof typeof PAPIERS, string]> = [
  ['ip', 'jaune · une IP, une idée'],
  ['ouf', 'rouge · un OUF, un signalement'],
  ['gueulage', 'blanc et plus grand · un gueulage']
];

/** Les positions du fichier, indexées par post-it. */
function positionsDuMur(mur: Mur | null): Record<string, PositionPostit> {
  return Object.fromEntries((mur?.postits ?? []).map((postit) => [postit.id, postit.position]));
}

const borner = (valeur: number) => Math.min(100, Math.max(0, Math.round(valeur * 10) / 10));

export function BoiteAIdees() {
  const branche = murEstConfigure();
  const pseudo = useStore((state) => state.name);
  /**
   * L'écriture exige un **compte approuvé** (D-088). Sans configuration de comptes, on ne
   * change rien (c'est l'alpha d'avant, et les tests du mur) ; avec elle, l'écran n'offre
   * que ce que la base accepterait.
   */
  const configureComptes = useComptes((state) => state.configure);
  const sessionCompte = useComptes((state) => state.session);
  const compte = useComptes((state) => state.compte);
  const peutEcrire = !configureComptes || estApprouve(compte);
  /**
   * L'administration du mur (#186) : elle range et retire **n'importe quel** post-it. Sans
   * configuration de comptes, il n'y a pas d'administration — l'alpha sans base n'a que le
   * fichier, et son rangement est celui du bureau qui commite.
   */
  const administrateur = configureComptes && estAdministrateur(compte);

  /**
   * La source du mur (#136) : la **base** quand elle est configurée, le **fichier** sinon.
   * La page ne connaît que `Mur` : c'est `src/lib/murBase.ts` qui parle au réseau.
   *
   * Sur une base configurée, on n'affiche pas le fichier d'abord : un post-it qui
   * disparaîtrait à l'arrivée de la réponse serait pire qu'un court « le mur se charge ».
   * Si la base ne répond pas, on retombe sur le fichier **entier**, avec un message.
   */
  const [mur, setMur] = useState<Mur | null>(() => (branche ? null : LECTURE.mur));
  const [erreurs, setErreurs] = useState<string[]>(() => (branche ? [] : LECTURE.erreurs));
  const [source, setSource] = useState<'base' | 'fichier'>('fichier');
  const [chargement, setChargement] = useState(branche);
  const [notice, setNotice] = useState<string | null>(null);
  /** Les votes en vol et les votes perdus, par post-it (#137). */
  const [votesEnVol, setVotesEnVol] = useState<ReadonlySet<string>>(() => new Set());
  const [erreursVote, setErreursVote] = useState<Record<string, string>>({});

  /** Le fil de chaque post-it, et l'état de sa lecture (#138). */
  const [commentaires, setCommentaires] = useState<Record<string, Commentaire[]>>({});
  const [chargementCommentaires, setChargementCommentaires] = useState(false);
  const [erreurCommentaires, setErreurCommentaires] = useState<string | null>(null);
  const [commentaireEnVol, setCommentaireEnVol] = useState<string | null>(null);
  const [erreursFil, setErreursFil] = useState<Record<string, string>>({});

  /** La relecture de **mon** post-it (#139). */
  const [correctionEnVol, setCorrectionEnVol] = useState<string | null>(null);
  const [erreursCorrection, setErreursCorrection] = useState<Record<string, string>>({});
  /** Le post-it dont on demande le retrait : la confirmation est rendue par la page. */
  const [aRetirer, setARetirer] = useState<Postit | null>(null);
  const [retraitEnVol, setRetraitEnVol] = useState(false);

  const [positions, setPositions] = useState(() => positionsDuMur(LECTURE.mur));
  const [placement, setPlacement] = useState(false);
  /**
   * Le mode de placement a-t-il un sens ici (D-068, #185) ? Sur le fichier, c'est le bureau
   * qui range tout le monde et commite ; sur la base, la politique de `0001`/`0005` ne laisse
   * déplacer que **ses** post-its, et un compte en attente ne déplace rien du tout — l'écran
   * ne propose donc pas ce que la base refuserait.
   */
  const peutRanger = source === 'fichier' || peutEcrire;
  const [agrandi, setAgrandi] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; alerte?: boolean } | null>(null);
  /**
   * Le contrôle de recouvrement (D-068), tenu à part de `message` : l'effet qui le pose
   * tourne après chaque lâcher, et il effacerait le refus d'une écriture en base arrivé
   * entre-temps (#185).
   */
  const [recouvrement, setRecouvrement] = useState<string | null>(null);
  /** Compte les lâchers : l'effet qui contrôle le recouvrement tourne après le rendu. */
  const [lachers, setLachers] = useState(0);
  /** Le post-it dont la place s'écrit en base, et le dernier refus essuyé (#185). */
  const [placeEnVol, setPlaceEnVol] = useState<string | null>(null);
  /** Les places que la base **a acceptées** : c'est là qu'on revient si un glisser est refusé. */
  const placesEnBase = useRef<Record<string, PositionPostit>>({});
  const tableau = useRef<HTMLDivElement>(null);
  const saisie = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Le formulaire de dépôt : ouvert à la demande, fermé au succès.
  const [depot, setDepot] = useState(false);
  const [nature, setNature] = useState<Nature>('IP');
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [ecran, setEcran] = useState<Ecran | ''>('');
  const [capture, setCapture] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [depotMessage, setDepotMessage] = useState<{ texte: string; alerte?: boolean } | null>(null);

  /**
   * Le fil du mur (#138) se lit **après** les post-its, et à part : un fil qu'on ne peut pas
   * lire ne doit pas faire retomber tout le mur sur le fichier. C'est un état d'erreur à
   * lui (D-060), affiché dans le fil et non sur la page.
   */
  const lireLesFils = () => {
    setChargementCommentaires(true);
    chargerCommentaires()
      .then((liste) => {
        setCommentaires(grouperCommentaires(liste));
        setErreurCommentaires(null);
      })
      .catch((erreur: unknown) => {
        setErreurCommentaires(
          `Les commentaires n’ont pas pu être lus (${messageDe(erreur)}). Le mur reste lisible.`
        );
      })
      .finally(() => setChargementCommentaires(false));
  };

  useEffect(() => {
    if (!branche) return;
    let vivant = true;

    chargerPostitsDuMur()
      .then((postits) => {
        if (!vivant) return;
        if (postits === null) throw new Error('La base n’est pas configurée.');
        setMur({ formulaire: LECTURE.mur?.formulaire ?? '', postits });
        setPositions(positionsDuMur({ formulaire: '', postits }));
        placesEnBase.current = positionsDuMur({ formulaire: '', postits });
        setErreurs([]);
        setSource('base');
        setNotice(null);
        lireLesFils();
      })
      .catch((erreur: unknown) => {
        if (!vivant) return;
        // Pas d'écran cassé : le fichier est la source de secours, et on le dit.
        setMur(LECTURE.mur);
        setErreurs(LECTURE.erreurs);
        setSource('fichier');
        setNotice(
          `La base n’a pas répondu : le mur affiche le fichier du dépôt. (${messageDe(erreur)})`
        );
      })
      .finally(() => {
        if (vivant) setChargement(false);
      });

    return () => {
      vivant = false;
    };
    // `branche` et `LECTURE` sont fixes pour la vie de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Le placement laisse faire un vrai tableau : on peut se tromper. Ce contrôle dit
   * quand une place recouvre le **texte** d'un autre post-it — la règle de D-068 se
   * vérifie sur le rendu, pas sur la foi d'un commentaire.
   */
  const recouvrements = (): string[] => {
    const cadre = tableau.current;
    if (!cadre) return [];
    const textes = [...cadre.querySelectorAll<HTMLElement>('[data-postit-texte]')].map((texte) => ({
      id: texte.closest<HTMLElement>('[data-postit]')?.dataset.postit ?? '?',
      boite: texte.getBoundingClientRect()
    }));
    const paires: string[] = [];
    for (let i = 0; i < textes.length; i += 1) {
      for (let j = i + 1; j < textes.length; j += 1) {
        const a = textes[i].boite;
        const b = textes[j].boite;
        const largeur = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const hauteur = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (largeur > 2 && hauteur > 2) paires.push(`${textes[i].id} / ${textes[j].id}`);
      }
    }
    return paires;
  };

  /**
   * Le glisser du mode de placement. La position s'exprime en pourcentage du tableau,
   * jamais en pixels : c'est ce qui la fait survivre au changement d'écran (D-068).
   *
   * Quand le mur vient de la **base**, le lâcher **écrit** la place (#185) : c'est le même
   * geste que le fichier, sauf que tout le monde la voit tout de suite au lieu d'attendre un
   * commit. Seuls **ses** post-its se déplacent — la base le refuse aux autres, et le post-it
   * ne s'offre donc pas à la prise (voir `deplacable` sur `PostitDuMur`).
   */
  const ranger = async (id: string, place: PositionPostit) => {
    const avant = placesEnBase.current[id];
    setPlaceEnVol(id);
    setMessage(null);
    try {
      const acceptee = await deplacerPostit(id, place);
      placesEnBase.current = { ...placesEnBase.current, [id]: acceptee };
      setPositions((courantes) => ({ ...courantes, [id]: acceptee }));
      setMur((courant) =>
        courant
          ? {
              ...courant,
              postits: courant.postits.map((autre) =>
                autre.id === id ? { ...autre, position: acceptee } : autre
              )
            }
          : courant
      );
    } catch (erreur) {
      // La place refusée ne doit pas rester à l'écran : on revient à la dernière acceptée.
      if (avant) setPositions((courantes) => ({ ...courantes, [id]: avant }));
      setMessage({ alerte: true, texte: messageDe(erreur) });
    } finally {
      setPlaceEnVol(null);
    }
  };

  const glisser: GlisserPostit = {
    debut: (event, postit) => {
      const cadre = tableau.current;
      if (!cadre || !event.isPrimary || placeEnVol !== null) return;
      const boite = cadre.getBoundingClientRect();
      const feuille = event.currentTarget.getBoundingClientRect();
      saisie.current = {
        id: postit.id,
        dx: ((event.clientX - feuille.left) / boite.width) * 100,
        dy: ((event.clientY - feuille.top) / boite.height) * 100
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    deplace: (event) => {
      const prise = saisie.current;
      const cadre = tableau.current;
      if (!prise || !cadre) return;
      const boite = cadre.getBoundingClientRect();
      const x = borner(((event.clientX - boite.left) / boite.width) * 100 - prise.dx);
      const y = borner(((event.clientY - boite.top) / boite.height) * 100 - prise.dy);
      setPositions((courantes) => {
        const courante = courantes[prise.id];
        return courante ? { ...courantes, [prise.id]: { ...courante, x, y } } : courantes;
      });
    },
    fin: (event) => {
      const prise = saisie.current;
      saisie.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setLachers((compte) => compte + 1);

      // La place finale se recalcule du même pointeur que le dernier déplacement : aucune
      // lecture d'un état qui n'a pas encore été rendu.
      const cadre = tableau.current;
      if (source !== 'base' || !prise || !cadre) return;
      const boite = cadre.getBoundingClientRect();
      void ranger(prise.id, {
        x: borner(((event.clientX - boite.left) / boite.width) * 100 - prise.dx),
        y: borner(((event.clientY - boite.top) / boite.height) * 100 - prise.dy),
        angle: positions[prise.id]?.angle ?? 0
      });
    }
  };

  // Après un lâcher seulement : mesurer à chaque déplacement ferait clignoter l'alerte.
  useEffect(() => {
    if (!lachers) return;
    const paires = recouvrements();
    setRecouvrement(
      paires.length
        ? source === 'base'
          ? `Ce placement recouvre le texte de ${paires.join(', ')}. Reprends le post-it et déplace-le : un texte ne doit jamais en cacher un autre.`
          : `Ce placement recouvre le texte de ${paires.join(', ')}. Déplace le post-it avant d’exporter — un texte ne doit jamais en cacher un autre.`
        : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `recouvrements` lit le DOM.
  }, [lachers]);

  const fichier = useMemo(() => exporterMur(positions), [positions]);

  /**
   * Un clic sur un pouce (#137). Le compte bouge **tout de suite** ; si la base ou le réseau
   * refuse, l'affichage revient exactement à l'état d'avant, avec un message discret sur le
   * post-it — jamais une page cassée. Un post-it ne porte qu'un vote en vol à la fois.
   */
  const voter = async (postit: Postit, demande: SensVote) => {
    if (votesEnVol.has(postit.id) || postit.mien) return;
    const avant = postit.votes;
    const monVote = avant.mon ?? null;
    const apres = monVote === demande ? null : demande;

    const poser = (votes: Postit['votes']) =>
      setMur((courant) =>
        courant
          ? {
              ...courant,
              postits: courant.postits.map((p) => (p.id === postit.id ? { ...p, votes } : p))
            }
          : courant
      );

    setErreursVote(({ [postit.id]: _, ...reste }) => reste);
    setVotesEnVol((courants) => new Set(courants).add(postit.id));
    poser(compterApres(avant, monVote, apres));

    try {
      await voterPourPostit(postit.id, demande, monVote);
    } catch (erreur) {
      poser(avant);
      setErreursVote((courantes) => ({ ...courantes, [postit.id]: messageDe(erreur) }));
    } finally {
      setVotesEnVol((courants) => {
        const reste = new Set(courants);
        reste.delete(postit.id);
        return reste;
      });
    }
  };

  /**
   * Commenter (#138). Le commentaire s'ajoute au fil **après** la réponse de la base — à la
   * différence du pouce, rien ne s'affiche avant d'exister : un commentaire n'a pas de
   * compteur à faire bouger, et un texte qu'on retire aussitôt serait pire qu'une attente.
   * Le refus (compte en attente, post-it disparu) se dit **sur le post-it**.
   */
  const commenter = async (postit: Postit, texte: string) => {
    const refus = verifierCommentaire(texte);
    setErreursFil(({ [postit.id]: _ancien, ...reste }) => reste);
    if (refus) {
      setErreursFil((courants) => ({ ...courants, [postit.id]: refus }));
      return;
    }

    setCommentaireEnVol(postit.id);
    try {
      const commentaire = await commenterPostit(postit.id, texte, { pseudo });
      setCommentaires((courants) => ({
        ...courants,
        [postit.id]: [...(courants[postit.id] ?? []), commentaire],
      }));
    } catch (erreur) {
      setErreursFil((courants) => ({ ...courants, [postit.id]: messageDe(erreur) }));
    } finally {
      setCommentaireEnVol(null);
    }
  };

  /** Retirer **mon** commentaire (#138) : la base refuse celui d'un autre. */
  const retirerCommentaire = async (commentaire: Commentaire) => {
    setCommentaireEnVol(commentaire.postitId);
    setErreursFil(({ [commentaire.postitId]: _ancien, ...reste }) => reste);
    try {
      await supprimerCommentaire(commentaire.id);
      setCommentaires((courants) => ({
        ...courants,
        [commentaire.postitId]: (courants[commentaire.postitId] ?? []).filter(
          (autre) => autre.id !== commentaire.id
        ),
      }));
    } catch (erreur) {
      setErreursFil((courants) => ({ ...courants, [commentaire.postitId]: messageDe(erreur) }));
    } finally {
      setCommentaireEnVol(null);
    }
  };

  /** Corriger le titre et le texte de **mon** post-it, tant qu'il est en attente (#139). */
  const corriger = async (postit: Postit, titre: string, texte: string) => {
    setCorrectionEnVol(postit.id);
    setErreursCorrection(({ [postit.id]: _ancien, ...reste }) => reste);
    try {
      const corrige = await corrigerPostit(postit.id, { titre, texte });
      setMur((courant) =>
        courant
          ? {
              ...courant,
              postits: courant.postits.map((autre) =>
                autre.id === postit.id ? { ...autre, ...corrige } : autre
              )
            }
          : courant
      );
    } catch (erreur) {
      setErreursCorrection((courants) => ({ ...courants, [postit.id]: messageDe(erreur) }));
    } finally {
      setCorrectionEnVol(null);
    }
  };

  /**
   * Retirer **mon** post-it (#139) : il est **supprimé**, avec ses votes et ses
   * commentaires (voir `retirerPostit`). La confirmation est passée avant : ce n'est pas
   * un geste qu'on défait.
   */
  const retirer = async () => {
    const cible = aRetirer;
    if (!cible || retraitEnVol) return;
    setRetraitEnVol(true);
    try {
      await retirerPostit(cible.id);
      setMur((courant) =>
        courant ? { ...courant, postits: courant.postits.filter((autre) => autre.id !== cible.id) } : courant
      );
      setCommentaires(({ [cible.id]: _fil, ...reste }) => reste);
      setPositions(({ [cible.id]: _place, ...reste }) => reste);
      setARetirer(null);
      setDepotMessage(
        cible.mien
          ? {
              texte:
                'Ton post-it est retiré du mur : il est supprimé, avec ses commentaires. Merci de l’avoir écrit.'
            }
          : {
              texte: `Le post-it de ${cible.pseudo || 'anonyme'} est retiré du mur, avec ses votes et ses commentaires.`
            }
      );
    } catch (erreur) {
      setARetirer(null);
      setDepotMessage({ alerte: true, texte: messageDe(erreur) });
    } finally {
      setRetraitEnVol(false);
    }
  };

  /**
   * Le post-it collé sur un gueulage (D-085). Il **existe** dans le fichier — c'est lui
   * qui se trie, avec sa famille — mais l'écran ne le montre **que** collé : s'il
   * s'affichait aussi à côté, le mur compterait deux fois la même réponse.
   *
   * Un `lie` qui ne résout pas (id absent) rend `undefined` : la page l'ignore et le
   * gueulage s'affiche seul. Le contrat du fichier, lui, l'a déjà signalé.
   */
  const parId = new Map((mur?.postits ?? []).map((postit) => [postit.id, postit]));
  const colles = new Set(
    (mur?.postits ?? [])
      .filter((postit) => {
        if (!postit.gueulage || !postit.lie) return false;
        const cible = parId.get(postit.lie);
        return cible !== undefined && !cible.gueulage;
      })
      .map((postit) => postit.lie as string)
  );

  const telecharger = () => {
    const url = URL.createObjectURL(new Blob([fichier], { type: 'application/json' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'boite-a-idees.json';
    lien.click();
    URL.revokeObjectURL(url);
    setMessage({
      texte:
        'Fichier téléchargé. Remplace docs/boite-a-idees.json par lui, puis commite — c’est tout le mécanisme de l’alpha.'
    });
  };

  const copier = () => {
    const refus = () =>
      setMessage({
        texte: 'Le navigateur a refusé le presse-papier : le texte est dans la zone, recopie-le à la main.'
      });
    const envoi = navigator.clipboard?.writeText(fichier);
    if (!envoi) {
      refus();
      return;
    }
    envoi.then(
      () => setMessage({ texte: 'Fichier copié. Colle-le dans docs/boite-a-idees.json, puis commite.' }),
      refus
    );
  };

  /** Un gueulage n'a pas de titre : la base en fabrique un avec ses premiers mots (D-085). */
  const gueulage = nature === 'GUEULAGE';

  const coller = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnvoi(true);
    setDepotMessage(null);

    try {
      const postit = await posterPostit(
        {
          famille: gueulage ? null : nature,
          gueulage,
          titre,
          texte,
          ecran,
          capture
        },
        // Les places déjà prises : le post-it neuf ne se colle pas sur le texte d'un autre.
        { pseudo, positionsPrises: Object.values(positions) }
      );

      setMur((courant) => ({
        formulaire: courant?.formulaire ?? LECTURE.mur?.formulaire ?? '',
        postits: [...(courant?.postits ?? []), postit]
      }));
      setPositions((courantes) => ({ ...courantes, [postit.id]: postit.position }));
      setTitre('');
      setTexte('');
      setEcran('');
      setCapture('');
      setNature('IP');
      setDepot(false);
      setDepotMessage({
        texte: 'Ton post-it est collé au mur. Merci — il est signé de ton pseudo et de ton compte.'
      });
    } catch (erreur) {
      setDepotMessage({ alerte: true, texte: messageDe(erreur) });
    } finally {
      setEnvoi(false);
    }
  };

  const formulaireExterne = mur?.formulaire ?? LECTURE.mur?.formulaire ?? '';

  return (
    <div className="page">
      <section className="section">
        <div className="section__head">
          <div>
            <h1>La Boîte à idées</h1>
            <p className="muted max-w-[62ch]">
              Le mur des retours d’alpha : ce que les invités proposent (<strong>IP</strong>) et
              signalent (<strong>OUF</strong>).{' '}
              {branche
                ? peutEcrire
                  ? 'Tu peux y coller un post-it et commenter sous ceux des autres, avec ton compte.'
                  : 'Tu peux lire le mur et ses commentaires ; écrire s’ouvrira quand ton compte sera validé.'
                : 'Le jeu le lit et n’y écrit pas — pour laisser un post-it, passe par le formulaire.'}
            </p>
          </div>
          <div className="actions">
            {branche && peutEcrire ? (
              <button
                type="button"
                className="button button--gold"
                aria-expanded={depot}
                aria-controls="depot-form"
                disabled={chargement}
                onClick={() => {
                  setDepot((ouvert) => !ouvert);
                  setDepotMessage(null);
                }}
              >
                <Send size={16} /> {depot ? 'Fermer le formulaire' : 'Poster une idée'}
              </button>
            ) : branche ? (
              <p className="notice notice--warn m-0 max-w-[46ch]" role="status">
                {sessionCompte ? (
                  <>
                    Ton compte attend d’être validé : tu peux lire et voter dès qu’il sera
                    approuvé.{' '}
                    <Link to="/attente">Voir mon compte</Link>
                  </>
                ) : (
                  <>
                    Il faut un compte pour poster ou voter.{' '}
                    <Link to="/connexion">Se connecter</Link>
                  </>
                )}
              </p>
            ) : formulaireExterne ? (
              <a
                className="button button--gold"
                href={formulaireExterne}
                target="_blank"
                rel="noopener noreferrer"
              >
                Proposer une idée / signaler <ExternalLink size={16} />
              </a>
            ) : (
              <p className="notice notice--warn m-0 max-w-[38ch]">
                Le formulaire n’est pas encore branché : le retour se donne pour l’instant de
                vive voix, à Bastien.
              </p>
            )}
            <Link className="button" to="/">
              <ArrowLeft size={16} /> Retour au bureau
            </Link>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[0.76rem] text-ink-muted">
          {LEGENDE.map(([apparence, texte]) => (
            <li className="flex items-center gap-2" key={apparence}>
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-[2px] ring-1 ring-black/30"
                style={{ background: PAPIERS[apparence].teinte }}
              />
              {texte}
            </li>
          ))}
          <li>
            Un gueulage est à part : s’il a donné lieu à un signalement ou à une idée, ce post-it est
            collé dessus (D-085).
          </li>
        </ul>
      </section>

      {depotMessage && (
        <section className={depotMessage.alerte ? 'notice notice--warn' : 'notice notice--ok'}>
          <p className="m-0 max-w-[70ch]">{depotMessage.texte}</p>
        </section>
      )}

      {branche && peutEcrire && depot && (
        <section className="section panel" id="depot-form" aria-labelledby="depot-titre">
          <h2 id="depot-titre">Poster une idée</h2>
          <p className="muted max-w-[64ch]">
            Deux familles, et le gueulage à part (D-085). Ton pseudo local est recopié sur le
            post-it (tu peux le laisser vide), et la base sait quel compte l’a écrit : c’est
            ce qui permet de te répondre.
          </p>

          <form className="flex flex-col gap-4" onSubmit={coller}>
            <fieldset className="field m-0 border-0 p-0">
              <legend className="field__label">Tu veux quoi ?</legend>
              <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:gap-4">
                {NATURES.map(([valeur, aide]) => (
                  <label className="flex items-start gap-2 text-[0.86rem]" key={valeur}>
                    <input
                      type="radio"
                      name="nature"
                      value={valeur}
                      checked={nature === valeur}
                      onChange={() => setNature(valeur)}
                      className="mt-1"
                    />
                    <span>
                      <strong>{valeur === 'GUEULAGE' ? 'Gueulage' : valeur}</strong>
                      <span className="block text-[0.78rem] text-ink-muted">{aide}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {!gueulage && (
              <label className="field">
                <span className="field__label">Titre</span>
                <input
                  value={titre}
                  onChange={(event) => setTitre(event.target.value)}
                  maxLength={120}
                  required
                  placeholder="Une ligne. Exemple : le bouton Fin du tour reste grisé."
                />
              </label>
            )}

            <label className="field">
              <span className="field__label">
                {gueulage ? 'Exprime-toi' : nature === 'OUF' ? 'Ce qui s’est passé' : 'L’idée'}
              </span>
              <textarea
                rows={5}
                value={texte}
                onChange={(event) => setTexte(event.target.value)}
                required
                placeholder={
                  gueulage
                    ? 'Le texte brut, tel qu’il vient. Personne ne te demande de le classer.'
                    : nature === 'OUF'
                      ? 'L’écran, l’action, la carte. Le fait, sans jugement — recopie le message d’erreur.'
                      : 'Ce que tu voudrais, et dans quelle situation ça te servirait.'
                }
              />
            </label>

            <div className="flex flex-col gap-4 min-[480px]:flex-row">
              <label className="field flex-1">
                <span className="field__label">Écran</span>
                <select value={ecran} onChange={(event) => setEcran(event.target.value as Ecran | '')}>
                  <option value="">—</option>
                  {ECRANS.map((valeur) => (
                    <option value={valeur} key={valeur}>
                      {valeur}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field flex-[2]">
                <span className="field__label">Capture — un lien, pas un fichier</span>
                <input
                  type="url"
                  value={capture}
                  onChange={(event) => setCapture(event.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>

            <p className="m-0 max-w-[64ch] text-[0.8rem] text-ink-muted">
              Tu seras signé <strong>{pseudo || 'anonyme'}</strong> · {APP_LABEL}. Le post-it
              arrive <strong>en attente</strong> : c’est le tri qui le fait avancer, pas le posteur.
            </p>

            <div className="actions actions--tight">
              <button
                type="submit"
                className="button button--primary"
                disabled={envoi || !texte.trim() || (!gueulage && !titre.trim())}
              >
                <Send size={16} /> {envoi ? 'Envoi…' : 'Coller le post-it'}
              </button>
              <button type="button" className="button" onClick={() => setDepot(false)}>
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}

      {erreurs.length > 0 && (
        <section className="notice notice--warn">
          <h2>Le fichier du mur n’a pas pu être lu</h2>
          <p className="m-0 max-w-[70ch]">
            Le mur reste fermé tant que le fichier n’est pas réparé :{' '}
            <code>docs/boite-a-idees.json</code>, dont la forme est écrite dans{' '}
            <code>docs/BOITE-A-IDEES.md</code> §3.
          </p>
          <ul className="mt-2 mb-0 flex flex-col gap-1 text-[0.84rem]">
            {erreurs.map((erreur) => (
              <li key={erreur}>{erreur}</li>
            ))}
          </ul>
        </section>
      )}

      {notice && (
        <section className="notice notice--warn">
          <p className="m-0 max-w-[70ch]">{notice}</p>
        </section>
      )}

      {chargement && (
        <section className="section panel">
          <p className="m-0 text-[0.9rem] text-ink-muted">Le mur se charge…</p>
        </section>
      )}

      {!chargement && mur && mur.postits.length === 0 && (
        <section className="section">
          <div className="empty">
            <p className="m-0 font-heading text-[1.15rem] font-bold text-ink">
              Le mur est encore vide.
            </p>
            <p className="mx-auto mt-1 mb-0 max-w-[52ch]">
              {branche && peutEcrire
                ? 'Sois le premier à coller un post-it : il apparaîtra ici, avec son papier et sa place.'
                : branche
                  ? 'Aucun post-it pour l’instant : le mur s’ouvrira à l’écriture quand ton compte sera validé.'
                  : 'Les post-its arrivent par le formulaire : ils apparaîtront ici avec leur papier et leur place sur le tableau.'}
            </p>
            {branche && peutEcrire ? (
              <button type="button" className="button button--gold mt-4" onClick={() => setDepot(true)}>
                <Send size={16} /> Laisser le premier post-it
              </button>
            ) : branche ? (
              <p className="m-0">
                <Link to={sessionCompte ? '/attente' : '/connexion'}>
                  {sessionCompte ? 'Ton compte attend d’être validé' : 'Se connecter pour écrire'}
                </Link>{' '}
                — la lecture, elle, est ouverte.
              </p>
            ) : (
              mur.formulaire && (
                <a
                  className="button button--gold mt-4"
                  href={mur.formulaire}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Laisser le premier post-it <ExternalLink size={16} />
                </a>
              )
            )}
          </div>
        </section>
      )}

      {!chargement && mur && mur.postits.length > 0 && (
        <section className="mur-plan">
          <div
            ref={tableau}
            className="relative max-[899px]:grid max-[899px]:grid-cols-1 max-[899px]:gap-4 min-[421px]:max-[899px]:grid-cols-2 min-[900px]:min-h-[600px]"
          >
            {mur.postits
              .filter((postit) => !colles.has(postit.id))
              .map((postit, ordre) => (
                <PostitDuMur
                  key={postit.id}
                  postit={postit}
                  position={positions[postit.id] ?? postit.position}
                  ordre={ordre}
                  placement={placement}
                  deplacable={source === 'fichier' || postit.mien === true || administrateur}
                  agrandi={agrandi === postit.id}
                  onAgrandir={(id) => setAgrandi((courant) => (courant === id ? null : id))}
                  glisser={glisser}
                  pouces={
                    source === 'base' && peutEcrire
                      ? {
                          occupe: votesEnVol.has(postit.id),
                          erreur: erreursVote[postit.id] ?? null,
                          onVoter: voter
                        }
                      : undefined
                  }
                  associe={postit.gueulage && postit.lie ? parId.get(postit.lie) ?? null : null}
                  fil={
                    source === 'base'
                      ? {
                          chargement: chargementCommentaires,
                          // Le refus de ce post-it d'abord ; sinon la panne de lecture,
                          // qui vaut pour tout le mur.
                          erreur: erreursFil[postit.id] ?? erreurCommentaires,
                          commentaires: commentaires[postit.id] ?? [],
                          occupe: commentaireEnVol === postit.id,
                          peutCommenter: peutEcrire,
                          motifSansEcriture: sessionCompte
                            ? 'Ton compte attend d’être validé : tu lis le fil dès maintenant, et tu pourras le commenter une fois approuvé.'
                            : 'Il faut un compte pour commenter : la lecture du fil, elle, est ouverte.',
                          onCommenter: commenter,
                          onSupprimer: retirerCommentaire
                        }
                      : undefined
                  }
                  correction={
                    source === 'base' && peutEcrire && postit.mien
                      ? {
                          gele: postit.statut !== 'en attente',
                          raisonGele: `Ce post-it a bougé de statut (« ${postit.statut} ») : on ne le corrige plus, sinon le mur ne dirait plus la même chose à tout le monde.`,
                          occupe: correctionEnVol === postit.id,
                          erreur: erreursCorrection[postit.id] ?? null,
                          onCorriger: corriger,
                          onRetirer: (cible) => setARetirer(cible)
                        }
                      : undefined
                  }
                  retrait={
                    source === 'base' && administrateur && !postit.mien
                      ? {
                          occupe: retraitEnVol,
                          onRetirer: (cible) => setARetirer(cible)
                        }
                      : undefined
                  }
                />
              ))}
          </div>
        </section>
      )}

      <section className="section panel">
        <h2>Le rangement</h2>
        <p className="muted max-w-[64ch] min-[900px]:hidden">
          Sur téléphone, les post-its s’empilent et la page défile. Le rangement se fait sur un
          écran large, au glisser — pas au doigt.
        </p>

        {source === 'base' ? (
          <p className="m-0 max-w-[66ch] text-[0.9rem] max-[899px]:hidden">
            La base porte la place de chaque post-it : en mode placement, un post-it se{' '}
            <strong>glisse</strong> à la souris et sa place s’écrit <strong>tout de suite</strong>{' '}
            en base — tout le monde la voit, sans commit. Chacun ne range que <strong>ses</strong>{' '}
            post-its : ceux des autres restent là où leur auteur les a mis.
          </p>
        ) : (
          <p className="m-0 max-w-[66ch] text-[0.9rem] max-[899px]:hidden">
            En mode placement, un post-it se <strong>glisse</strong> à la souris et sa position
            s’écrit en pourcentage du tableau : tout le monde verra la même disposition, quel que
            soit l’écran. L’application est un <strong>site statique</strong> — elle ne peut pas
            écrire dans le dépôt : le fichier exporté ci-dessous se <strong>commite</strong> à la
            place de <code>docs/boite-a-idees.json</code>. C’est le mécanisme de l’alpha, en
            attendant la base.
          </p>
        )}

        <div className="flex max-[899px]:hidden flex-col gap-3">
          {mur && mur.postits.length > 0 ? (
            <>
              <div className="actions">
                {peutRanger && (
                  <button
                    type="button"
                    className={placement ? 'button button--gold' : 'button'}
                    aria-pressed={placement}
                    onClick={() => {
                      setPlacement((actif) => !actif);
                      setMessage(null);
                      setRecouvrement(null);
                    }}
                  >
                    <Move size={16} /> {placement ? 'Terminer le placement' : 'Mode de placement'}
                  </button>
                )}
                {source === 'fichier' && (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setPositions(positionsDuMur(mur));
                      setMessage({ texte: 'Positions revenues à celles du fichier.' });
                    }}
                  >
                    <RotateCcw size={16} /> Revenir aux positions du fichier
                  </button>
                )}
              </div>

              {!peutRanger && (
                <p className="m-0 max-w-[66ch] text-[0.86rem] text-ink-muted">
                  Le rangement s’ouvrira en même temps que l’écriture : il faut d’abord un compte
                  validé.
                </p>
              )}

              {placement && source === 'fichier' && (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="settings__save"
                    readOnly
                    rows={10}
                    value={fichier}
                    aria-label="Le fichier du mur, avec les positions choisies"
                  />
                  <div className="actions actions--tight">
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={telecharger}
                    >
                      <Download size={16} /> Télécharger le fichier
                    </button>
                    <button type="button" className="button" onClick={copier}>
                      <Copy size={16} /> Copier
                    </button>
                  </div>
                </div>
              )}

              {placement && source === 'base' && (
                <p className="m-0 max-w-[66ch] text-[0.86rem] text-ink-muted">
                  {placeEnVol
                    ? 'La place s’écrit…'
                    : 'Prends un post-it qui est à toi et dépose-le : la place part en base au lâcher. Ceux des autres ne se prennent pas.'}
                </p>
              )}

              {message && (
                <p
                  className={
                    message.alerte ? 'notice notice--warn m-0' : 'm-0 text-[0.86rem] text-ink-muted'
                  }
                >
                  {message.texte}
                </p>
              )}

              {recouvrement && (
                <p className="notice notice--warn m-0">{recouvrement}</p>
              )}
            </>
          ) : (
            <p className="m-0 text-[0.86rem] text-ink-dim">
              Rien à ranger pour l’instant : le mode s’ouvre dès le premier post-it.
            </p>
          )}
        </div>
      </section>

      <p className="m-0 max-w-[66ch] text-[0.78rem] text-ink-dim">
        {source === 'base'
          ? 'Le mur est lu dans la base partagée : un post-it apparaît chez les autres sans nouvelle version du jeu. Les pouces comptent un vote par compte et par post-it, et l’on ne vote pas pour le sien ; chaque post-it porte son fil de commentaires.'
          : 'Le mur est dans le paquet de l’application : il n’a rien à charger, et il s’affiche aussi hors ligne. Ni pouces ni commentaires ici : ils ne s’ouvrent qu’avec la base partagée.'}
      </p>

      {/* Le retrait d'un post-it ne se défait pas (#139) : il passe par la confirmation du
          jeu, jamais par `window.confirm` (D-035). */}
      <Confirmation
        open={aRetirer !== null}
        titre={aRetirer && !aRetirer.mien ? 'Retirer le post-it d’un autre ?' : 'Retirer ce post-it ?'}
        texte={
          aRetirer && !aRetirer.mien
            ? 'Il sera supprimé du mur, avec ses votes et ses commentaires — pas seulement barré, et il n’en restera aucune trace. C’est définitif, et c’est un geste d’administration : le post-it n’est pas le tien, et son auteur le verra disparaître sans explication sur le mur.'
            : 'Il sera supprimé du mur, avec ses commentaires — pas seulement barré, et il n’en restera aucune trace. C’est définitif. Le retrait n’est possible que tant que le post-it est en attente : dès qu’il a bougé de statut, il ne s’efface plus.'
        }
        confirmer={retraitEnVol ? 'Retrait…' : 'Retirer le post-it'}
        onConfirm={() => void retirer()}
        onCancel={() => setARetirer(null)}
      />
    </div>
  );
}
