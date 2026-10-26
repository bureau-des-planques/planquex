/**
 * **La feuille de route** — publique, et **hors de la garde des comptes** (D-097 (3)).
 *
 * Elle **absorbe** les nouveautés de D-090 (`/nouveautes` y redirige, D-097 (7)) et dit,
 * dans l'ordre : la version sous les yeux et ce qu'elle contient, l'étape en cours, ce
 * qu'il faut pour en sortir (D-056), les jalons (D-048), les fonctionnalités prévues, ce
 * qui est décidé pour plus tard (D-061), ce qui n'est pas pour maintenant (D-056), puis
 * l'historique des versions.
 *
 * Trois règles d'écriture :
 *
 * 1. **la version courante se lit, elle ne se recopie pas** : c'est `APP_LABEL`
 *    (`src/version.ts`), donc `package.json` — un numéro écrit ici serait un mensonge dès
 *    la build suivante, et `src/version.test.ts` le refuserait ;
 * 2. **le décidé vient de `src/data/plan.ts`, l'en cours de `src/data/plan-dev.ts`** —
 *    celui-ci est généré par `npm run plan:dev` à partir des issues `alpha` ouvertes, pour
 *    qu'une liste de chantiers ne se désynchronise pas en silence ;
 * 3. **aucun lien vers le dépôt** : il est **privé**, donc `#214` se lit et une adresse
 *    `github.com` s'ouvrirait sur un `404` (D-097 (3)). Le numéro et le titre suffisent.
 *
 * Ce que la page **ne montre jamais** : les **modes parkés** de D-019, ni les règles
 * maison rangées hors du standard. Une page publique qui les annoncerait promettrait ce
 * que personne n'a acté.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { APP_LABEL, APP_VERSION } from '@/version';
import { notesAffichees, type NoteVersion } from '@/data/notes-affichees';
import {
  CRITERES_ALPHA,
  DECIDE_PLUS_TARD,
  ETAPE_EN_COURS,
  FIGE_PENDANT_ALPHA,
  JALONS,
  PAS_MAINTENANT,
  type ElementPlan
} from '@/data/plan';
import { FEATURES_PREVUES } from '@/data/plan-dev';

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

/** Une entrée décidée : son texte, sa note éventuelle, et la décision qui la fonde. */
function Entree({ element }: { element: ElementPlan }) {
  return (
    <li>
      {element.texte} <span className="muted text-[0.78rem]">({element.decision})</span>
      {element.note && <span className="muted"> — {element.note}</span>}
    </li>
  );
}

export function FeuilleDeRoute() {
  // La note de la version sous les yeux : **publiée ou écrite d'avance**, les deux
  // comptent (le tag part avant la release GitHub — `docs/VERSIONS.md` §4).
  const { courante, precedentes } = notesAffichees(APP_VERSION);

  return (
    <div className="page feuille-de-route">
      <section className="section panel">
        <h1 className="m-0 font-heading text-[1.5rem] font-bold">Feuille de route</h1>
        <p className="muted m-0 max-w-[62ch]">
          Ce qui existe, ce qui arrive, et ce qui n’arrive pas encore. Cette page se lit sans compte : elle dit où en
          est le jeu et ce qu’il reste à faire avant de le montrer plus large.
        </p>
      </section>

      <section className="section panel feuille-de-route__courante">
        <h2 className="m-0">L’étape en cours</h2>
        <p className="feuille-de-route__label">
          <strong className="settings__version">{APP_LABEL}</strong>
          <span className="muted"> · étape {ETAPE_EN_COURS.nom}</span>
        </p>
        <p className="m-0 max-w-[62ch]">{ETAPE_EN_COURS.texte}</p>

        <h3 className="feuille-de-route__titre">Ce que cette version contient</h3>
        {courante ? (
          <>
            <h4 className="feuille-de-route__titre m-0">{courante.titre}</h4>
            {courante.date && <p className="muted m-0 text-[0.82rem]">{dateLongue(courante.date)}</p>}
            <Points note={courante} />
          </>
        ) : (
          <p className="muted m-0 max-w-[62ch]">
            Cette build n’a pas encore sa note : elle arrive avec la publication. Les versions précédentes, elles, sont
            toutes là.
          </p>
        )}
      </section>

      <section className="section">
        <h2>Les critères de sortie d’alpha</h2>
        <p className="muted max-w-[62ch]">
          Ce qu’il faut avoir livré pour qu’on vise l’étape suivante. La liste est courte, et elle ne s’allonge pas en
          cours de route.
        </p>
        <ul className="liste-points panel flex flex-col gap-2 pl-8 pr-4 py-3 leading-relaxed">
          {CRITERES_ALPHA.map((critere) => (
            <Entree key={critere.texte} element={critere} />
          ))}
        </ul>

        <h2>Les jalons</h2>
        <p className="muted max-w-[62ch]">
          Trois étapes nommées, et rien d’autre : chaque étape se quitte quand ses critères sont remplis.
        </p>
        <div className="feuille-de-route__liste">
          {JALONS.map((jalon) => (
            <article key={jalon.etape} className="panel feuille-de-route__note">
              <h3 className="feuille-de-route__titre capitalize">{jalon.etape}</h3>
              <p className="muted m-0 max-w-[62ch]">{jalon.texte}</p>
              <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
                {jalon.criteres.map((critere) => (
                  <Entree key={critere.texte} element={critere} />
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section panel">
        <h2>Les fonctionnalités prévues</h2>
        <p className="muted max-w-[62ch]">
          Les chantiers ouverts de l’étape en cours. La liste vient du dépôt de travail : elle se met à jour quand une
          issue s’ouvre ou se ferme, et le numéro suffit à la retrouver.
        </p>
        {FEATURES_PREVUES.length > 0 ? (
          <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
            {FEATURES_PREVUES.map((feature) => (
              <li key={feature.numero}>
                <strong>#{feature.numero}</strong> · {feature.titre}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted m-0">
            Aucun chantier ouvert pour cette étape : la liste est vide, et c’est une bonne nouvelle.
          </p>
        )}
      </section>

      <section className="section panel">
        <h2>Décidé pour plus tard</h2>
        <p className="muted max-w-[62ch]">
          Ce qui est tranché, mais rangé après la beta : ce n’est pas oublié, c’est plus loin.
        </p>
        <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
          {DECIDE_PLUS_TARD.map((element) => (
            <Entree key={element.texte} element={element} />
          ))}
        </ul>
      </section>

      <section className="section panel">
        <h2>Pas maintenant</h2>
        <p className="muted max-w-[62ch]">
          Ce qui n’entre pas pendant l’alpha, pour que l’écoute des retours ne remplisse pas le programme à notre place.
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-[0.85rem]">
          {PAS_MAINTENANT.map((quoi) => (
            <li key={quoi} className="rounded-full border border-[var(--line)] px-3 py-1">
              {quoi}
            </li>
          ))}
        </ul>

        <h3 className="feuille-de-route__titre">Ce qui ne bouge pas pendant l’alpha</h3>
        <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
          {FIGE_PENDANT_ALPHA.map((element) => (
            <Entree key={element.texte} element={element} />
          ))}
        </ul>
      </section>

      {precedentes.length > 0 && (
        <section className="section">
          <h2>Les versions précédentes</h2>
          <div className="feuille-de-route__liste">
            {precedentes.map((note) => (
              <article key={note.version} className="panel feuille-de-route__note">
                <h3 className="feuille-de-route__titre">
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
