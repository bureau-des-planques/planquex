import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Chaque migration de `supabase/migrations/` a sa ligne dans `supabase/README.md`.
 *
 * Le tableau du README est le seul endroit qui dit **ce que fait** une migration et **pourquoi**
 * (ticket, décision) ; `supabase/README.md` sert de porte d'entrée à qui touche la base. Rien ne
 * l'obligeait à jour, et il ne l'était pas : le 02/11/2026, en livrant la `0023` (#552), deux
 * migrations appliquées n'y figuraient pas — `0019_profils.sql` (#325) et `0022_services.sql`
 * (D-159) — et le tableau sautait de `0018` à `0020`, puis de `0021` à `0023`. Un lecteur qui
 * cherche « ce que fait la 0022 » ne trouve rien, et croit qu'elle n'existe pas.
 *
 * Le contrôle est **par lecture de fichier** : aucun réseau, aucune base, aucun PGlite. Il ne dit
 * pas si la ligne est **juste** — ça reste une relecture — seulement si elle **existe**.
 */

const lire = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

/** Les fichiers `.sql` du dossier des migrations, triés pour un message stable. */
function migrations(): string[] {
  return readdirSync(new URL('../../supabase/migrations', import.meta.url))
    .filter((nom) => nom.endsWith('.sql'))
    .sort();
}

/**
 * Les migrations qu'aucune ligne du tableau ne nomme. Exportée pour que le contrôle puisse être
 * confronté à un cas fautif : une garde qui ne peut pas échouer ne garde rien (`AGENTS.md` §6).
 */
export function migrationsSansLigne(noms: readonly string[], texte: string): string[] {
  return noms.filter((nom) => !texte.includes(`supabase/migrations/${nom}`));
}

describe('les migrations sont documentées', () => {
  it('chaque fichier de `supabase/migrations/` a sa ligne dans `supabase/README.md`', () => {
    expect(migrationsSansLigne(migrations(), lire('supabase/README.md'))).toEqual([]);
  });

  it('le contrôle mord : une migration absente du tableau est dénoncée', () => {
    const fautif = [...migrations(), '0099_migration_fantome.sql'];
    expect(migrationsSansLigne(fautif, lire('supabase/README.md'))).toEqual([
      '0099_migration_fantome.sql'
    ]);
  });
});
