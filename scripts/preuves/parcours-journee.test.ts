// Le parcours de la Journée (#686), sans navigateur : le plan, la version lue à la source,
// et les cas d'erreur qui doivent faire échouer le parcours **en nommant l'étape**.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ETAPES_JOURNEE, cheminDeCible } from '../../src/components/journee-etapes';
import { CIBLE_DE_GESTE } from '../../src/components/journee-cible';
import {
  dossierDeCaptures,
  erreurEtape,
  etatInitialJournee,
  lireVersionStore,
  nomDeCapture,
  parcourir as parcourirFactice,
  planDeLaJournee,
  serveurConfigure,
  verifierCible,
  verifierPlan,
  verifierRoute,
  verifierTitre
} from './parcours-journee.mjs';

const racine = fileURLToPath(new URL('../..', import.meta.url));
const source = readFileSync(resolve(racine, 'src/store/useStore.ts'), 'utf8');
const plan = planDeLaJournee(ETAPES_JOURNEE, CIBLE_DE_GESTE, cheminDeCible);

describe('le plan du parcours — lu dans le code, pas recopié', () => {
  it('suit les quatre étapes de ETAPES_JOURNEE, dans leur ordre, avec leurs routes', () => {
    expect(plan).toHaveLength(ETAPES_JOURNEE.length);
    expect(plan.map((etape) => etape.chemin)).toEqual(ETAPES_JOURNEE.map((etape) => cheminDeCible(etape.cible)));
    expect(plan.map((etape) => etape.geste)).toEqual(ETAPES_JOURNEE.map((etape) => etape.geste ?? null));
  });

  it('produit un nom de capture unique par étape', () => {
    const noms = plan.map((etape) => etape.capture);
    expect(new Set(noms).size).toBe(noms.length);
    expect(nomDeCapture(1, 'L’Arrivage')).toBe('journee-1-l-arrivage.png');
  });

  it('**le contrôle mord** : un geste sans parcours fait échouer le plan, en nommant l’étape', () => {
    const fautif = [{ ...plan[0], geste: 'inconnu' as never }];
    expect(() => verifierPlan(fautif)).toThrow(/Étape « L’Arrivage » \(1\/4\) : geste « inconnu »/);
  });
});

describe('la version du store — lue à la source', () => {
  it('lit le numéro de STORAGE_VERSION dans src/store/useStore.ts', () => {
    const attendu = Number(/export const STORAGE_VERSION = (\d+);/.exec(source)?.[1]);
    expect(lireVersionStore(source)).toBe(attendu);
    expect(Number.isInteger(attendu) && attendu > 0).toBe(true);
  });

  it('**le contrôle mord** : sans la constante, on ne devine pas de numéro', () => {
    expect(() => lireVersionStore('export const AUTRE = 3;')).toThrow(/STORAGE_VERSION introuvable/);
  });

  it('l’état initial rend la Journée visible et porte la version lue, sans migration', () => {
    const version = lireVersionStore(source);
    const etat = etatInitialJournee({ origine: 'http://localhost:4196', version });
    const blob = JSON.parse(etat.origins[0].localStorage[0].value);
    expect(blob.state.tutorielVu).toBe(false);
    expect(blob.version).toBe(version);
    expect(JSON.stringify(etat)).not.toMatch(/E2E_|SUPABASE|KEY|PASSWORD/i);
  });
});

describe('les vérifications d’écran — une étape non conforme échoue par son nom', () => {
  const etape = plan[1];

  it('accepte la route, le titre et la cible de l’étape', () => {
    expect(() => verifierRoute(etape, '/collection')).not.toThrow();
    expect(() =>
      verifierTitre(etape, '2/4 Journée d’intégration — étape 2 sur 4 : La Collection et le Deck')
    ).not.toThrow();
    expect(() => verifierCible(etape, true)).not.toThrow();
  });

  it('**le contrôle mord** : une route inattendue échoue en nommant l’étape et les deux chemins', () => {
    expect(() => verifierRoute(etape, '/settings')).toThrow(
      /Étape « La Collection et le Deck » \(2\/4\) : route inattendue : attendu « \/collection », reçu « \/settings »/
    );
  });

  it('**le contrôle mord** : un écran qui affiche une autre étape échoue, sans la laisser passer', () => {
    expect(() => verifierTitre(etape, '1/4 Journée d’intégration — étape 1 sur 4 : L’Arrivage')).toThrow(
      /Étape « La Collection et le Deck » \(2\/4\) : le panneau affiche/
    );
  });

  it('**le contrôle mord** : une cible absente échoue, avec son sélecteur', () => {
    expect(() => verifierCible(etape, false)).toThrow(/cible absente : \[data-journee-cible="onglet-deck"\]/);
  });

  it('une étape sans cible ne demande rien au DOM', () => {
    expect(() => verifierCible(plan[2], false)).not.toThrow();
  });

  it('erreurEtape nomme toujours l’étape, en tête du message', () => {
    expect(erreurEtape(plan[3], 'x').message.startsWith('Étape « Le comité » (4/4) : ')).toBe(true);
  });
});

/** Une page factice : le parcours la lit sans navigateur, et un cas fautif la fait échouer. */
function pageFactice(surcharges: Record<string, unknown>) {
  return {
    on: () => undefined,
    goto: async () => undefined,
    waitForFunction: async () => {
      throw new Error('délai dépassé');
    },
    url: () => 'http://localhost:4196/',
    ...surcharges
  };
}

describe('le parcours, sans navigateur — les cas d’erreur nomment l’étape', () => {
  const options = (page: unknown) => ({
    page,
    plan,
    base: 'http://localhost:4196',
    dossier: tmpdir(),
    serveur: { configure: false }
  });

  it('**le contrôle mord** : une navigation qui échoue sort avec le nom de l’étape 1', async () => {
    const page = pageFactice({
      goto: async () => {
        throw new Error('net::ERR_CONNECTION_REFUSED at http://localhost:4196/\nstack');
      }
    });
    await expect(parcourirFactice(options(page))).rejects.toThrow(
      /Étape « L’Arrivage » \(1\/4\) : net::ERR_CONNECTION_REFUSED/
    );
  });

  it('**le contrôle mord** : une route réelle inattendue sort avec le nom de l’étape', async () => {
    const page = pageFactice({ url: () => 'http://localhost:4196/settings' });
    await expect(parcourirFactice(options(page))).rejects.toThrow(
      /Étape « L’Arrivage » \(1\/4\) : route inattendue : attendu « \/ », reçu « \/settings »/
    );
  });
});

describe('les sorties — hors du dépôt, sans secret', () => {
  it('**le contrôle mord** : un dossier de captures dans le dépôt est refusé', () => {
    expect(() => dossierDeCaptures({ PARCOURS_JOURNEE_DIR: join(racine, 'captures') }, racine)).toThrow(
      /dans le dépôt/
    );
  });

  it('accepte un dossier hors du dépôt, configurable', () => {
    const dehors = join(tmpdir(), 'parcours-test-686');
    expect(dossierDeCaptures({ PARCOURS_JOURNEE_DIR: dehors }, racine)).toBe(dehors);
  });

  it('le serveur n’est « configuré » que si les deux variables sont posées', () => {
    expect(serveurConfigure({})).toBe(false);
    expect(serveurConfigure({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBe(false);
    expect(serveurConfigure({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toBe(true);
  });
});
