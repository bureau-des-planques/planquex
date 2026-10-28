// @vitest-environment node
/**
 * **La commande de lecture des traces** (#358).
 *
 * Trois preuves, et chacune peut échouer :
 *
 * 1. **sans configuration, elle refuse** (exit 1) et ne retombe sur aucun fichier : c'est le
 *    patron de `npm run problemes` (D-119, #299) ;
 * 2. **un rôle autre que `lecteur` est refusé avant la connexion** — la commande ne peut pas
 *    se mettre à écrire par accident ;
 * 3. **la requête ne demande pas `auteur`** : aucune donnée de compte ne peut sortir par
 *    cette porte, et le compte rendu parle de parties, jamais de personnes.
 *
 * Les agrégats eux-mêmes sont éprouvés sur des traces fabriquées dans
 * `src/game/traces.test.ts` (« deux parties connues », et le contrôle qui mord). Ici, on
 * injecte l'agrégat : aucun réseau, aucune base.
 */
import { describe, expect, it } from 'vitest';
import {
  REQUETE_TRACES,
  argumentsTraces,
  compteRendu,
  principalTraces,
  roleDe,
  verifierLectureSeule
} from './traces-combat.mjs';
import type { TraceCombat } from './traces-combat.mjs';

/** Un `console` de test : il retient ce qu'on lui dit au lieu de l'écrire. */
function sortieDeTest() {
  const lignes: string[] = [];
  const erreurs: string[] = [];
  return {
    lignes,
    erreurs,
    log: (texte: string) => lignes.push(String(texte)),
    error: (texte: string) => erreurs.push(String(texte))
  };
}

const BILAN = {
  parties: 3,
  parMode: { solo: 2, pvp: 1 },
  terminees: 2,
  abandons: 1,
  illisibles: 0,
  issues: { joueur: 1, direction: 1, nulle: 0 },
  tauxVictoireSolo: 0.5,
  soloDecidees: 2,
  tours: { mediane: 14, min: 11, max: 17 },
  aLaLimite: 0,
  forfaits: 1,
  interventionsMoyennes: { joueur: 1.5, direction: 1.5 },
  craquagesParPartie: 3,
  cartesPlusJouees: [{ carte: 'atelier-chef-atelier', parties: 2 }],
  cartesJamaisJouees: ['rh-drh'],
  detail: []
};

/** Un faux client Postgres : il **note** la requête et ses paramètres, et rend les lignes. */
function fauxClient(rows: TraceCombat[], note: Array<{ sql: string; params?: unknown[] }>) {
  return {
    async query(sql: string, params?: unknown[]) {
      note.push({ sql, params });
      return { rows };
    },
    async end() {}
  };
}

const ENV_LECTEUR = { ADMIN_LECTEUR_URL: 'postgresql://lecteur.abc:secret@pooler:5432/postgres?sslmode=require' };

describe('commande des traces de combat (#358)', () => {
  it('sans configuration, elle refuse au lieu de retomber sur un fichier', async () => {
    const sortie = sortieDeTest();
    let ouverte = false;
    const code = await principalTraces(
      [],
      { TRACES_SECRETS_FICHIER: '/inexistant/supabase-admin.json' },
      {
        ouvrir: async () => {
          ouverte = true;
          return fauxClient([], []);
        },
        agreger: () => BILAN as never,
        sortie
      }
    );

    expect(code).toBe(1);
    expect(ouverte).toBe(false);
    expect(sortie.erreurs.join('\n')).toContain('pas de connexion de lecture');
    expect(sortie.erreurs.join('\n')).toContain('Aucun repli');
  });

  it('refuse un rôle qui n’est pas « lecteur » avant de se connecter', async () => {
    const sortie = sortieDeTest();
    let ouverte = false;
    const code = await principalTraces(
      [],
      { ADMIN_LECTEUR_URL: 'postgresql://postgres.abc@p/a' },
      {
        ouvrir: async () => {
          ouverte = true;
          return fauxClient([], []);
        },
        agreger: () => BILAN as never,
        sortie
      }
    );

    expect(code).toBe(1);
    expect(ouverte).toBe(false);
    expect(sortie.erreurs.join('\n')).toContain('n’est pas le rôle « lecteur »');
    expect(roleDe('postgresql://lecteur.abc@p/a')).toBe('lecteur');
    expect(verifierLectureSeule(null)).toContain('aucune connexion');
  });

  it('lit par la période demandée et imprime le compte rendu', async () => {
    const note: Array<{ sql: string; params?: unknown[] }> = [];
    const sortie = sortieDeTest();
    const code = await principalTraces(['--jours', '7'], ENV_LECTEUR, {
      ouvrir: async () => fauxClient([{ id: 1, graine: 7 }], note),
      agreger: (lignes) => {
        expect(lignes).toEqual([{ id: 1, graine: 7 }]);
        return BILAN as never;
      },
      sortie
    });

    expect(code).toBe(0);
    // La période est un **paramètre**, jamais une chaîne concaténée dans le SQL.
    expect(note).toHaveLength(1);
    expect(note[0].params).toEqual([7, 2000]);
    // La requête ne demande aucune donnée de compte.
    expect(note[0].sql).toBe(REQUETE_TRACES);
    expect(REQUETE_TRACES).not.toMatch(/\bauteur\b/);
    expect(REQUETE_TRACES).toContain('make_interval');

    const texte = sortie.lignes.join('\n');
    expect(texte).toContain('3 partie(s)');
    expect(texte).toContain('1 abandon(s)');
    expect(texte).toContain('médiane 14');
    expect(texte).toContain('50.0 %');
  });

  it('`--json` rend le bilan exploitable, et un argument inconnu est refusé', async () => {
    const sortie = sortieDeTest();
    const code = await principalTraces(['--json'], ENV_LECTEUR, {
      ouvrir: async () => fauxClient([], []),
      agreger: () => BILAN as never,
      sortie
    });
    expect(code).toBe(0);
    expect(JSON.parse(sortie.lignes[0]).bilan.terminees).toBe(2);

    const inconnu = sortieDeTest();
    expect(await principalTraces(['--bogus'], ENV_LECTEUR, { sortie: inconnu })).toBe(1);
    expect(inconnu.erreurs.join('\n')).toContain('argument inconnu');
  });

  it('lit les arguments, et refuse une période qui n’est pas un entier', () => {
    expect(argumentsTraces([]).jours).toBe(30);
    expect(argumentsTraces(['--jours', '1']).jours).toBe(1);
    expect(argumentsTraces(['--limite', '5']).limite).toBe(5);
    expect(argumentsTraces(['--jours', 'sept']).erreur).toContain('entier');
    expect(argumentsTraces(['--aide']).aide).toBe(true);
  });

  it('le compte rendu nomme les cartes qui ne sortent jamais', () => {
    const texte = compteRendu({ ...BILAN, cartesJamaisJouees: [] }, { jours: 1 });
    expect(texte).toContain('Cartes qui ne sortent jamais');
    expect(texte).toContain('aucune');
    expect(compteRendu(BILAN).length).toBeGreaterThan(0);
  });
});
