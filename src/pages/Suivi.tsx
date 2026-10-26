/**
 * **Le suivi** du comité (#211, D-097 (2) et (5)) — `/comite/suivi`.
 *
 * Deux pages, deux questions : **Le mur** montre ce qui **arrive** (`en attente`, `retenu`,
 * pose libre) ; **Le suivi** montre ce qu'on en a **fait** — `en cours`, `fait` affiché
 * « Fait », et `écarté` **avec sa raison**. Les deux autres statuts ne descendent pas ici :
 * un post-it qui n'a pas encore été trié n'a rien à faire dans un suivi, et le montrer deux
 * fois ferait deux murs.
 *
 * **Le repère (D-097 (5))** : ouvrir cette page pose `vu_le` au compte, par
 * `public.marquer_comite_vu()` (migration `0008`, voir `marquerComiteVu`) — c'est ce qui
 * remet le compteur du comité à zéro. Le marquage se fait **une fois**, à l'ouverture, et
 * **jamais** par un `update` : la RLS ne distingue pas les colonnes (0008). Sans base
 * configurée, rien n'est contacté — le repli est inerte.
 *
 * **La source** est la même que celle du mur : la base quand elle est configurée, le fichier
 * `docs/comite.json` sinon — ou quand la base ne répond pas, avec la notice qui le dit. Un
 * suivi ne se déclare jamais vide parce que le réseau a hoqueté.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SousOngletsComite } from '@/components/SousOngletsComite';
import { chargerPostitsDuMur, marquerComiteVu, murEstConfigure } from '@/lib/murBase';
import { DOCUMENT_MUR, lireMur } from '@/store/mur';
import type { Postit, Statut } from '@/store/mur';

/** Le fichier est lu une fois : il ne change pas sans un nouveau déploiement (comme le mur). */
const LECTURE = lireMur(DOCUMENT_MUR);

/**
 * Les trois groupes du suivi, dans l'ordre où on les lit (D-059, D-097 (2)). Le titre de
 * `fait` est **« Fait »** : un seul nom pour un état, et il ne se recopie pas dans l'écran.
 */
export const GROUPES_SUIVI = [
  {
    statut: 'en cours',
    titre: 'En cours',
    vide: 'Rien en cours pour l’instant : ce qui est retenu arrive ici dès qu’on s’y met.'
  },
  { statut: 'fait', titre: 'Fait', vide: 'Rien de fait pour l’instant.' },
  {
    statut: 'écarté',
    titre: 'Écarté',
    vide: 'Rien d’écarté pour l’instant — et un post-it écarté dit toujours pourquoi.'
  }
] as const satisfies ReadonlyArray<{ statut: Statut; titre: string; vide: string }>;

/** Les post-its d'un groupe, dans l'ordre de la source. Un autre statut n'entre pas. */
export function postitsDuGroupe(postits: readonly Postit[], statut: Statut): Postit[] {
  return postits.filter((postit) => postit.statut === statut);
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

export function Suivi() {
  const branche = murEstConfigure();

  const [postits, setPostits] = useState<Postit[] | null>(() => (branche ? null : (LECTURE.mur?.postits ?? [])));
  const [notice, setNotice] = useState<string | null>(() =>
    branche || LECTURE.erreurs.length === 0
      ? null
      : `Le fichier du mur n’a pas pu être lu : ${LECTURE.erreurs.join(' ; ')}`
  );
  const [chargement, setChargement] = useState(branche);
  /** Le refus du repère, s'il y en a un : le suivi reste lisible sans lui. */
  const [refusRepere, setRefusRepere] = useState<string | null>(null);

  /**
   * **À l'ouverture, et une seule fois** (D-097 (5)) : le repère se pose quand la page
   * s'ouvre. Il ne dépend pas des post-its — une base qui répond lentement ne retarde pas
   * le marquage — et un refus ne casse rien : on le dit, discrètement.
   */
  useEffect(() => {
    if (!branche) return;
    marquerComiteVu().catch((erreur: unknown) => setRefusRepere(messageDe(erreur)));
  }, [branche]);

  /** La source du suivi : la base, ou le fichier en secours (même couture que le mur). */
  useEffect(() => {
    if (!branche) return;
    let vivant = true;

    chargerPostitsDuMur()
      .then((liste) => {
        if (!vivant) return;
        if (liste === null) throw new Error('La base n’est pas configurée.');
        setPostits(liste);
        setNotice(null);
      })
      .catch((erreur: unknown) => {
        if (!vivant) return;
        setPostits(LECTURE.mur?.postits ?? []);
        setNotice(`La base n’a pas répondu : le suivi affiche le fichier du dépôt. (${messageDe(erreur)})`);
      })
      .finally(() => {
        if (vivant) setChargement(false);
      });

    return () => {
      vivant = false;
    };
  }, [branche]);

  return (
    <div className="page">
      <section className="section">
        <div className="section__head">
          <div>
            <h1>Le comité de pilotage</h1>
            <p className="muted max-w-[62ch]">
              Le suivi : ce qui est <strong>en cours</strong>, ce qui est <strong>fait</strong>, et ce qui a été{' '}
              <strong>écarté</strong> — avec sa raison. Ce qui arrive et ce qui est retenu reste sur le mur.
            </p>
          </div>
          <div className="actions">
            <Link className="button" to="/">
              <ArrowLeft size={16} /> Retour au bureau
            </Link>
          </div>
        </div>

        <SousOngletsComite />
      </section>

      {notice && (
        <section className="notice notice--warn">
          <p className="m-0 max-w-[70ch]">{notice}</p>
        </section>
      )}

      {refusRepere && (
        <section className="notice notice--warn">
          <p className="m-0 max-w-[70ch]">
            {refusRepere} Le suivi reste lisible : le compteur repartira à la prochaine ouverture.
          </p>
        </section>
      )}

      {chargement && (
        <section className="section panel">
          <p className="m-0 text-[0.9rem] text-ink-muted">Le suivi se charge…</p>
        </section>
      )}

      {!chargement &&
        postits &&
        GROUPES_SUIVI.map((groupe) => {
          const liste = postitsDuGroupe(postits, groupe.statut);
          const titreId = `suivi-${groupe.statut.replace(' ', '-')}`;
          return (
            <section className="section panel" key={groupe.statut} aria-labelledby={titreId}>
              <h2 id={titreId}>{groupe.titre}</h2>

              {liste.length === 0 ? (
                <p className="m-0 text-[0.9rem] text-ink-muted">{groupe.vide}</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {liste.map((postit) => (
                    <li key={postit.id} className="rounded-[var(--radius-sm)] border border-line bg-bg-sunken p-3">
                      <h3 className="m-0 font-heading text-[1rem] font-bold text-ink">{postit.titre}</h3>
                      <p className="mt-1 mb-0 max-w-[70ch] text-[0.88rem] text-ink-muted">{postit.texte}</p>
                      <p className="mt-2 mb-0 text-[0.78rem] text-ink-dim">
                        Écrit par {postit.pseudo || 'anonyme'}
                        {postit.ecran ? ` · ${postit.ecran}` : ''}
                        {postit.ticket ? (
                          <>
                            {' · '}
                            <a
                              className="text-gold-soft"
                              href={`https://github.com/Chapax/planquex/issues/${postit.ticket}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ticket #{postit.ticket}
                            </a>
                          </>
                        ) : null}
                      </p>

                      {/* La raison d'un écarté (D-059) : c'est elle qui apprend ce qui vaut
                          la peine d'être remonté — un écarté sans raison serait un mur mort. */}
                      {postit.statut === 'écarté' && postit.raison && (
                        <p className="mt-2 mb-0 max-w-[70ch] border-l-2 border-gold-deep pl-3 text-[0.86rem] text-ink">
                          <strong>Pourquoi c’est écarté :</strong> {postit.raison}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}
