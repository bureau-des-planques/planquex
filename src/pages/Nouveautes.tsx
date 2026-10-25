/**
 * La page « Nouveautés » — **publique, et hors de la garde des comptes**.
 *
 * Elle répond à une gêne simple : les notes de version vivaient dans le corps des
 * releases GitHub (`docs/VERSIONS.md`), donc un invité devait sortir du jeu, et avoir un
 * compte GitHub, pour savoir ce qu'une version contenait. Ici, il lit la version qu'il a
 * sous les yeux et ce qu'elle apporte — avant même de s'inscrire, d'où la route déclarée
 * hors de `Layout`, comme `/confidentialite`.
 *
 * Trois règles d'écriture :
 *
 * 1. **la version courante se lit, elle ne se recopie pas** : c'est `APP_LABEL`
 *    (`src/version.ts`), donc `package.json` — un numéro écrit ici serait un mensonge
 *    dès la build suivante, et `src/version.test.ts` le refuserait ;
 * 2. **le journal vit dans `src/data/versions.ts`**, une entrée par version publiée, de
 *    la plus récente à la plus ancienne, et ce fichier est **pris aux releases GitHub**
 *    par `npm run notes:versions` (`scripts/notes-versions.mjs`) : personne ne recopie
 *    une release à la main, et il n'y a donc rien à désynchroniser ;
 * 3. **une note écrite d'avance ne s'affiche pas dans l'historique** : seule la version
 *    sous les yeux montre la sienne — une version à venir n'est pas sortie.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { APP_LABEL, APP_VERSION } from '@/version';
import { notesAffichees, type NoteVersion } from '@/data/notes-affichees';

/** La date se lit en français (« 21 octobre 2026 ») : `date` est un jour, pas un instant. */
function dateLongue(jour: string): string {
  return new Date(`${jour}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function Points({ note }: { note: NoteVersion }) {
  return (
    <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
      {note.points.map((point, index) => {
        // Le groupe (« Jeu », « Le mur ») est le signet que le corps de la release donnait.
        // Il ne s'écrit **qu'une fois** : deux points de suite du même groupe le répétaient,
        // et la capture du 24/10/2026 a montré « Le gueulage est à part » deux fois.
        const precedent = note.points[index - 1]?.groupe;
        const montreGroupe = Boolean(point.groupe) && point.groupe !== precedent;
        return (
          <li key={`${point.groupe ?? ''}·${point.texte}`}>
            {montreGroupe && <strong>{point.groupe} · </strong>}
            {point.texte}
          </li>
        );
      })}
    </ul>
  );
}

export function Nouveautes() {
  // La note de la version sous les yeux : **publiée ou écrite d'avance**, les deux
  // comptent (le tag part avant la release GitHub — `docs/VERSIONS.md` §4).
  const { courante, precedentes } = notesAffichees(APP_VERSION);
  // L'historique : les notes **publiées** des autres versions. Celle d'une version à
  // venir ne se montre pas — elle n'est pas sortie, et personne n'a à la lire ici.

  return (
    <div className="page nouveautes">
      <section className="section panel">
        <h1 className="m-0 font-heading text-[1.5rem] font-bold">Nouveautés</h1>
        <p className="muted m-0 max-w-[62ch]">
          Ce que chaque version a changé, de la plus récente à la première alpha. Le
          libellé ci-dessous est exactement celui de Réglages : c’est lui qu’on te demande
          de recopier si quelque chose ne va pas.
        </p>
      </section>

      <section className="section panel nouveautes__courante">
        <h2 className="m-0">Tu as sous les yeux</h2>
        <p className="nouveautes__label">
          <strong className="settings__version">{APP_LABEL}</strong>
          {courante && <span className="muted"> · {dateLongue(courante.date)}</span>}
        </p>
        {courante ? (
          <>
            <h3 className="nouveautes__titre">{courante.titre}</h3>
            <Points note={courante} />
          </>
        ) : (
          <p className="muted m-0 max-w-[62ch]">
            Cette build n’a pas encore sa note : elle arrive avec la publication. Les
            versions précédentes, elles, sont toutes là.
          </p>
        )}
      </section>

      {precedentes.length > 0 && (
        <section className="section">
          <h2>Les versions précédentes</h2>
          <div className="nouveautes__liste">
            {precedentes.map((note) => (
              <article key={note.version} className="panel nouveautes__note">
                <h3 className="nouveautes__titre">
                  {note.version} · {note.titre}
                </h3>
                <p className="muted m-0 text-[0.82rem]">{dateLongue(note.date)}</p>
                <Points note={note} />
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="m-0">
        <Link className="button" to="/">
          <ArrowLeft size={16} /> Retour au bureau
        </Link>
      </p>
    </div>
  );
}
