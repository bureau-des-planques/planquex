/**
 * La ligne d'une migration dans la page du poste (#224).
 *
 * La page est statique (aucun build) et importe ce module comme `suivi.mjs` : la décision qui
 * doit **pouvoir être fausse** — « propose-t-on de rejouer cette migration ? » — vit donc ici,
 * et `tools/admin/ligne-migration.test.ts` l'exerce.
 *
 * Le bouton n'est offert que sur une migration **manquante**. Une migration appliquée **avant**
 * le registre l'est déjà, et le poste ne connaît pas son empreinte : la proposer serait un pari
 * (0001 et 0002 ne sont pas idempotentes). On ne montre pas non plus l'empreinte du fichier
 * d'aujourd'hui comme si c'était celle d'alors.
 */

const BADGES = {
  appliquee: '<span class="etat-pill">appliquée</span>',
  'empreinte-changee':
    '<span class="etat-pill" style="color:var(--danger)">empreinte changée</span>',
  anterieure: '<span class="etat-pill">appliquée avant le registre</span>',
};

/** Une ligne `<tr>` de la table des migrations, prête à être insérée dans la page. */
export function ligneMigration(migration) {
  const { fichier = '', etat = '', empreinte = '' } = migration ?? {};
  const badge = BADGES[etat] ?? '<span class="etat-pill">manquante</span>';
  const geste =
    etat === 'manquante'
      ? `<button class="vert" onclick="appliquer('${fichier}')">appliquer</button>`
      : '';
  const empreinteAffichee =
    etat === 'anterieure'
      ? '<span class="muet" title="aucune empreinte enregistrée avant le registre">non enregistrée</span>'
      : `<code>${String(empreinte).slice(0, 16)}…</code>`;
  return `<tr><td><code>${fichier}</code></td><td>${badge}</td><td>${empreinteAffichee}</td><td>${geste}</td></tr>`;
}
