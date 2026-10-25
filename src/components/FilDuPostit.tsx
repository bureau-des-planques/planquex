/**
 * Le fil d'un post-it, et sa relecture (#138, #139).
 *
 * Deux morceaux, tous deux rendus **dans** le post-it agrandi (D-068 : « une pression
 * agrandit un post-it » — c'est là que se rangent les choses qui ne tiennent pas sur un
 * post-it de téléphone) :
 *
 * - `FilDuPostit` : les commentaires, **du plus ancien au plus récent, sans imbrication**,
 *   chacun avec son pseudo et sa date, et un bouton de retrait **sur les miens seulement**.
 *   Le champ de saisie n'apparaît qu'à qui peut écrire (un compte approuvé) ; un compte en
 *   attente lit le fil et **lit pourquoi** il n'écrit pas encore (D-088) ;
 * - `CorrectionDuPostit` : le titre et le texte, corrigeables par l'auteur **tant que le
 *   post-it est `en attente`**, et le retrait, avec confirmation. Quand le statut a bougé,
 *   l'écran le dit **et dit pourquoi** — plutôt que de laisser un bouton qui échouerait
 *   (le refus est dans la base, `0006`).
 *
 * Aucune écriture ici : ces composants appellent les rappels de la page, qui passent par
 * `@/lib/murBase`. C'est ce qui les rend rendables sans réseau.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Postit } from '@/store/mur';
import { LIMITE_COMMENTAIRE, verifierCommentaire, type Commentaire } from '@/lib/murBase';

/** Une date courte, `jj/mm/aaaa`, dans le fuseau de la personne. `''` si elle est illisible. */
export function dateCourte(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()}`;
}

/** Ce que la page sait du fil d'un post-it. */
export interface FilPostit {
  /** Le fil est encore en train de se lire (D-060 : l'état « chargement » se voit). */
  chargement: boolean;
  /** Le dernier refus, dit discrètement sur le post-it ; `null` sinon. */
  erreur: string | null;
  commentaires: Commentaire[];
  /** Un commentaire de ce post-it est en vol : on n'en envoie pas un second. */
  occupe: boolean;
  /** `true` quand mon compte est approuvé (D-088) : la base le refuserait de toute façon. */
  peutCommenter: boolean;
  /** Ce qu'on dit à qui ne peut pas écrire : « connecte-toi », « attends la validation ». */
  motifSansEcriture: string;
  onCommenter: (postit: Postit, texte: string) => void;
  onSupprimer: (commentaire: Commentaire) => void;
}

export function FilDuPostit({ postit, fil }: { postit: Postit; fil: FilPostit }) {
  const [texte, setTexte] = useState('');
  const refus = texte.trim() ? verifierCommentaire(texte) : null;
  const peutEnvoyer = fil.peutCommenter && !fil.occupe && texte.trim() !== '' && refus === null;

  const envoyer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!peutEnvoyer) return;
    fil.onCommenter(postit, texte);
    setTexte('');
  };

  return (
    <section className="fil" data-fil={postit.id} aria-label={`Commentaires de « ${postit.titre} »`}>
      <p className="fil__titre">
        Commentaires{fil.commentaires.length > 0 ? ` (${fil.commentaires.length})` : ''}
      </p>

      {fil.chargement ? (
        <p className="fil__note">Les commentaires se chargent…</p>
      ) : fil.commentaires.length === 0 ? (
        <p className="fil__note">Aucun commentaire pour l’instant.</p>
      ) : (
        <ul className="fil__liste">
          {fil.commentaires.map((commentaire) => (
            <li className="fil__item" key={commentaire.id} data-commentaire={commentaire.id}>
              <p className="fil__entete">
                <span>{commentaire.pseudo || 'anonyme'}</span>
                {commentaire.creeLe && (
                  <time dateTime={commentaire.creeLe}>{dateCourte(commentaire.creeLe)}</time>
                )}
                {commentaire.mien && (
                  <button
                    type="button"
                    className="fil__retirer"
                    // Le glisser du mode de placement écoute le post-it entier : un bouton
                    // n'est pas une prise (même précaution que les pouces, #137).
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => fil.onSupprimer(commentaire)}
                    aria-label={`Retirer mon commentaire du ${commentaire.creeLe ? dateCourte(commentaire.creeLe) : 'post-it'}`}
                  >
                    retirer
                  </button>
                )}
              </p>
              <p className="fil__texte">{commentaire.texte}</p>
            </li>
          ))}
        </ul>
      )}

      {fil.erreur && (
        <p className="fil__note fil__note--erreur" role="status">
          {fil.erreur}
        </p>
      )}

      {fil.peutCommenter ? (
        <form className="fil__form" onSubmit={envoyer}>
          <label className="fil__label">
            <span className="fil__etiquette">Préciser, sans ouvrir un second post-it</span>
            <textarea
              className="fil__champ"
              rows={2}
              value={texte}
              onChange={(event) => setTexte(event.target.value)}
              placeholder="Le même cas chez moi, ou ce que j’ai compris autrement."
              aria-label={`Commenter « ${postit.titre} »`}
            />
          </label>
          {/* La limite se dit pendant la frappe, jamais après un refus muet (#138). */}
          <p className="fil__note" data-compteur>
            {texte.trim().length} / {LIMITE_COMMENTAIRE} caractères
            {refus && texte.trim() ? ` — ${refus}` : ''}
          </p>
          <button type="submit" className="fil__bouton" disabled={!peutEnvoyer}>
            {fil.occupe ? 'Envoi…' : 'Commenter'}
          </button>
        </form>
      ) : (
        <p className="fil__note">{fil.motifSansEcriture}</p>
      )}
    </section>
  );
}

/** Ce que la page sait de la relecture d'un post-it — `undefined` quand ce n'est pas le mien. */
export interface CorrectionPostit {
  /** `true` quand le statut a bougé : on ne corrige plus, et on dit pourquoi. */
  gele: boolean;
  /** La phrase du refus, quand `gele` — elle nomme le statut. */
  raisonGele: string;
  occupe: boolean;
  erreur: string | null;
  onCorriger: (postit: Postit, titre: string, texte: string) => void;
  onRetirer: (postit: Postit) => void;
}

export function CorrectionDuPostit({
  postit,
  correction,
}: {
  postit: Postit;
  correction: CorrectionPostit;
}) {
  const [titre, setTitre] = useState(postit.titre);
  const [texte, setTexte] = useState(postit.texte);
  const change = titre.trim() !== postit.titre || texte.trim() !== postit.texte;
  const peutEnvoyer = !correction.occupe && change && titre.trim() !== '' && texte.trim() !== '';

  const enregistrer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!peutEnvoyer) return;
    correction.onCorriger(postit, titre, texte);
  };

  if (correction.gele) {
    return (
      <section className="fil" data-correction="gele">
        <p className="fil__titre">Ton post-it</p>
        <p className="fil__note">{correction.raisonGele}</p>
        <p className="fil__note">
          Il reste lisible, et son fil reste ouvert : on commente sous lui.
        </p>
      </section>
    );
  }

  return (
    <section className="fil" data-correction="ouverte">
      <p className="fil__titre">Ton post-it — tu peux encore le corriger</p>
      <form className="fil__form" onSubmit={enregistrer}>
        <label className="fil__label">
          <span className="fil__etiquette">Titre</span>
          <input
            className="fil__champ"
            value={titre}
            onChange={(event) => setTitre(event.target.value)}
            maxLength={120}
            aria-label={`Corriger le titre de « ${postit.titre} »`}
          />
        </label>
        <label className="fil__label">
          <span className="fil__etiquette">Texte</span>
          <textarea
            className="fil__champ"
            rows={4}
            value={texte}
            onChange={(event) => setTexte(event.target.value)}
            aria-label={`Corriger le texte de « ${postit.titre} »`}
          />
        </label>

        {correction.erreur && (
          <p className="fil__note fil__note--erreur" role="status">
            {correction.erreur}
          </p>
        )}

        <div className="fil__actions">
          <button type="submit" className="fil__bouton" disabled={!peutEnvoyer}>
            {correction.occupe ? 'Enregistrement…' : 'Enregistrer la correction'}
          </button>
          <button
            type="button"
            className="fil__bouton fil__bouton--retirer"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => correction.onRetirer(postit)}
          >
            Retirer ce post-it
          </button>
        </div>
        <p className="fil__note">
          Le retrait <strong>efface</strong> le post-it, avec ses commentaires : il n’en reste
          pas de trace sur le mur. Il n’est possible que tant que le post-it est en attente.
        </p>
      </form>
    </section>
  );
}
