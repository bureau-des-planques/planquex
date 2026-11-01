/**
 * Le refus d'une configuration **cassée** (#529).
 *
 * Deux états que le code confondait : « pas de base » (aucune variable) laisse jouer, comme
 * avant D-088 ; une configuration **cassée** (une seule variable, ou une clé de service) est
 * un **déploiement fautif**, et il doit se voir. Ce panneau le dit sans page blanche, et
 * sans laisser croire que le jeu est ouvert à tous : la raison est rendue par
 * `diagnostiquerMur` et affichée telle quelle.
 *
 * Il vit hors du `ErreurDeRendu` du `Layout` : un déploiement fautif n'est pas un plantage,
 * et « Recharger » ne le réparerait pas.
 */
export function RefusConfiguration({ raison }: { raison: string }) {
  return (
    <div className="page">
      <section className="section panel" aria-labelledby="configuration-titre">
        <h1 id="configuration-titre">Cette installation est mal configurée</h1>
        <p className="muted max-w-[64ch]">
          Le jeu ne s’ouvre pas : la configuration de la base est incomplète ou refusée. Ce n’est pas « pas de base » —
          c’est un déploiement fautif, et il doit se voir.
        </p>
        <p className="notice notice--warn m-0" role="alert">
          {raison}
        </p>
        <p className="muted max-w-[64ch]">
          Rien n’a été ouvert : l’alpha reste réservée. Poser les <strong>deux</strong> variables{' '}
          <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> (la clé <strong>publique</strong>,
          jamais la clé de service), puis redéployer.
        </p>
      </section>
    </div>
  );
}
