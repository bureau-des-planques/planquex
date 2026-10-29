import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `docs/DECISIONS.md` — le journal des décisions actées ne doit pas **perdre une ligne**.
 *
 * La classe de bug, constatée le 21/10/2026 : une édition a **supprimé en silence la ligne
 * D-046** du tableau `| D-0NN | date | décision | raison |`. Rien ne l'a vu — ni `tsc`, ni
 * `vitest`, ni `build` : un document n'est lu par aucun test. Un trou dans le journal n'est
 * pourtant pas un détail de forme : c'est une **décision d'autorité** (`AGENTS.md` §2.1) qui
 * disparaît, et les références `D-046` éparpillées dans le dépôt pointent alors dans le vide.
 *
 * Trois contrôles sur la même fonction pure (`analyser`) :
 * 1. chaque ligne `| D-NNN |` a **4 colonnes** et se termine par `|` (une colonne avalée par
 *    une édition, et la cellule de raison se décale) ;
 * 2. les identifiants sont **uniques** (un copier-coller de ligne crée un doublon silencieux) ;
 * 3. **aucun trou** entre D-001 et le plus grand identifiant présent.
 *
 * Le test « le contrôle mord » confronte `analyser` à un texte fabriqué : sans lui, la garde
 * s'appuierait sur le seul fichier, qui est sain aujourd'hui — une assertion qui ne peut pas
 * échouer ne garde rien (`AGENTS.md` §6, #112).
 */

/** Un identifiant de décision, tel qu'il ouvre une ligne de tableau. */
const LIGNE = /^\|\s*(D-\d+)\s*\|/;

/**
 * Exceptions au contrôle de continuité : un identifiant **volontairement absent** du journal
 * (décision retirée puis renumérotée, par exemple). Vide tant qu'aucun cas ne l'exige —
 * vérifié sur le fichier du 21/10/2026, qui va de D-001 à D-049 sans manque.
 */
const SANS_TROU_EXCEPTIONS = new Set<string>([]);

/** Ce qu'une ligne du journal doit porter : `| ID | date | décision | raison |` = 4 colonnes. */
const COLONNES = 4;

/** Une ligne fautive, réduite à ce qui se lit dans le rapport d'échec. */
type Fautive = { ligne: number; detail: string };

/** Le diagnostic d'un texte de journal — fonction pure, donc éprouvable hors du disque. */
function analyser(texte: string) {
  const lignes: { numero: number; id: string; brute: string }[] = [];
  const colonnesFautives: Fautive[] = [];

  texte.split('\n').forEach((brute, index) => {
    const ligne = index + 1;
    const debut = brute.trimStart();
    const trouve = LIGNE.exec(debut);
    if (!trouve) return;

    lignes.push({ numero: ligne, id: trouve[1], brute: debut.trimEnd() });

    // `| a | b | c | d |` se découpe en 6 morceaux (deux bords vides compris).
    const morceaux = debut.trimEnd().split('|');
    const ferme = debut.trimEnd().endsWith('|');
    if (!ferme || morceaux.length - 2 !== COLONNES) {
      colonnesFautives.push({
        ligne,
        detail: `${trouve[1]} : ${morceaux.length - 2} colonne(s)${ferme ? '' : ', ligne non terminée par |'}`
      });
    }
  });

  const vues = new Map<string, number[]>();
  for (const { id, numero } of lignes) {
    vues.set(id, [...(vues.get(id) ?? []), numero]);
  }
  const doublons: Fautive[] = [...vues]
    .filter(([, numeros]) => numeros.length > 1)
    .map(([id, numeros]) => ({ ligne: numeros[1], detail: `${id} répété aux lignes ${numeros.join(', ')}` }));

  // La continuité se juge sur le **numéro**, pas sur le texte : `D-1` et `D-001` sont la même
  // décision, et un identifiant à quatre chiffres (D-1000) doit passer sans changer le code.
  const presents = new Set(lignes.map(({ id }) => Number(id.slice(2))));
  const plusGrand = Math.max(0, ...presents);
  const trous = Array.from({ length: plusGrand }, (_, index) => index + 1)
    .filter((numero) => !presents.has(numero))
    .map((numero) => `D-${String(numero).padStart(3, '0')}`)
    .filter((id) => !SANS_TROU_EXCEPTIONS.has(id));

  return {
    /** Nombre de lignes du journal — sert à refuser un texte vide. */
    total: lignes.length,
    premier: lignes[0]?.id ?? null,
    dernier: lignes.at(-1)?.id ?? null,
    colonnesFautives,
    doublons,
    trous
  };
}

const lire = () => readFileSync(new URL('../../docs/DECISIONS.md', import.meta.url), 'utf8');
const etat = () => analyser(lire());
const fichier = fileURLToPath(new URL('../../docs/DECISIONS.md', import.meta.url));

describe('docs/DECISIONS.md — journal des décisions (21/10/2026)', () => {
  it('le contrôle mord : un trou au milieu est signalé', () => {
    const texte = [
      '| ID | Date | Décision | Raison |',
      '|---|---|---|---|',
      '| D-001 | 18/10/2026 | A | a |',
      '| D-002 | 18/10/2026 | B | b |',
      // D-003 a été supprimée en silence : c'est exactement l'incident du 21/10/2026.
      '| D-004 | 18/10/2026 | D | d |'
    ].join('\n');
    expect(analyser(texte).trous).toEqual(['D-003']);
  });

  it('le contrôle mord : un identifiant en double est signalé', () => {
    const texte = [
      '| D-001 | 18/10/2026 | A | a |',
      '| D-002 | 18/10/2026 | B | b |',
      '| D-002 | 18/10/2026 | B bis | b |'
    ].join('\n');
    expect(analyser(texte).doublons).toEqual([
      { ligne: 3, detail: 'D-002 répété aux lignes 2, 3' }
    ]);
  });

  it('le contrôle mord : une ligne à 3 colonnes ou non fermée est signalée', () => {
    const texte = [
      '| D-001 | 18/10/2026 | A | a |',
      // La colonne « décision » a été avalée : l'ID et la date restent, la raison se décale.
      '| D-002 | 18/10/2026 | b |',
      '| D-003 | 18/10/2026 | C | c'
    ].join('\n');
    expect(analyser(texte).colonnesFautives.map(({ ligne }) => ligne)).toEqual([2, 3]);
  });

  it('le fichier est lu et son tableau n’est pas vide (sinon rien n’est gardé)', () => {
    const rapport = etat();
    expect(rapport.total, `aucune ligne | D-NNN | lue dans ${fichier}`).toBeGreaterThan(0);
    expect(rapport.premier).toBe('D-001');
  });

  it('chaque ligne a exactement 4 colonnes et se termine par |', () => {
    const { colonnesFautives } = etat();
    expect(
      colonnesFautives,
      `ligne(s) de décision mal formée(s) dans docs/DECISIONS.md : ${colonnesFautives
        .map(({ ligne, detail }) => `ligne ${ligne} (${detail})`)
        .join(' ; ')} — le tableau attend | ID | date | décision | raison |.`
    ).toEqual([]);
  });

  it('les identifiants sont uniques', () => {
    const { doublons } = etat();
    expect(
      doublons,
      `identifiant(s) de décision en double : ${doublons.map(({ detail }) => detail).join(' ; ')} — ` +
        'deux décisions ne peuvent pas porter le même D-NNN.'
    ).toEqual([]);
  });

  it('aucun trou : de D-001 au plus grand identifiant, tous existent', () => {
    const { trous, premier, dernier } = etat();
    expect(
      trous,
      `décision(s) manquante(s) dans docs/DECISIONS.md : ${trous.join(', ')} — ` +
        `le journal va de ${premier} à ${dernier} et doit être continu ` +
        '(une ligne supprimée par une édition est l’incident du 21/10/2026). ' +
        'Si l’absence est volontaire, l’ajouter à `SANS_TROU_EXCEPTIONS` avec sa raison.'
    ).toEqual([]);
  });
});
