#!/usr/bin/env node
/**
 * Joue une partie entière **au clic**, dans un vrai Chromium, sur le build (#424).
 *
 * Question posée : le testeur peut-il finir une partie en cliquant ? Le harnais clique : il
 * n'appelle jamais le moteur pour agir. À chaque tour il vérifie que chaque action légale a un
 * bouton cliquable à son centre, que chaque clic a un effet visible, et que la partie se termine.
 * Le moteur ne sert qu'à **lire** : `rejouer` reconstitue l'état depuis le journal rangé dans le
 * store (`bureau-des-planques-v1`), `legalActions` dit ce qui était légal. Le jugement est dans
 * `scripts/partie-jouee-jugement.mjs`.
 *
 * Une graine = un instant figé (`page.clock`) : `createBattle` prend `Date.now()` pour graine.
 *
 * Usage :
 *   npm run build && npm run jouer-partie
 *   node scripts/jouer-partie.mjs --graines 1,2 --gabarits telephone-petit,pc
 *   node scripts/jouer-partie.mjs --json
 *
 * Options : --graines <a,b,…> (instants, défaut : ceux de `capturer`) ; --gabarits <nom,…>
 * (défaut : telephone) ; --max-clics <N> (défaut 1200) ; --json ; -h.
 * Variables : CHROME_PATH (binaire Chromium), BASE_URL (serveur déjà lancé), PORT (défaut 4195).
 *
 * Sortie : 0 si chaque partie se termine sans anomalie ; 1 sinon (chaque anomalie est nommée et
 * une capture part dans `captures/jouer-partie/`) ; 2 si l'usage est faux.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer, preview } from 'vite';
import { GABARITS, INSTANTS_COMBAT, STORAGE_KEY, VIEWPORT, amorcageStore } from './capturer-socle.mjs';
import {
  affordancesDeBarre,
  choisirAction,
  classerBouton,
  cle,
  comparerAffordances,
  GESTES_DE_MAIN,
  jugerClic,
  jugerCible,
  jouePar,
  jugerFinPartie,
  rangDansLeType
} from './partie-jouee-jugement.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sortieDir = join(root, 'captures', 'jouer-partie');
const distIndex = join(root, 'dist/index.html');
const executablePath =
  process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const PORT = Number(process.env.PORT ?? 4195);
const ROUTE = '/battle';

/** Les gabarits joués : la référence de D-060 (420 × 900) d'abord, puis ceux de D-142. */
const GABARITS_JOUES = [{ nom: 'reference', viewport: VIEWPORT, mobile: true }, ...GABARITS];

/** Les boutons d'action : barre du tour, pose de la carte choisie, promotion, choix. Un seul sélecteur. */
const BOUTONS = '.combat-barre button, .pose button, .promotion button, .choix button';

const USAGE = `Usage : npm run jouer-partie -- [options]
  --graines <a,b,…>   instants figés = graines (défaut : ${INSTANTS_COMBAT.join(',')})
  --gabarits <nom,…>  ${GABARITS_JOUES.map((g) => g.nom).join(', ')} (défaut : telephone)
  --max-clics <N>     arrêt d'urgence d'une partie (défaut : 1200)
  --json              rapport JSON
`;

function lireOptions(argv) {
  const options = { graines: INSTANTS_COMBAT, gabarits: ['telephone'], maxClics: 1200, json: false, aide: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') options.aide = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--graines') options.graines = argv[++i].split(',').map(Number);
    else if (arg === '--gabarits') options.gabarits = argv[++i].split(',');
    else if (arg === '--max-clics') options.maxClics = Number(argv[++i]);
    else throw new Error(`option inconnue : ${arg}`);
  }
  if (options.graines.some((g) => !Number.isInteger(g))) throw new Error('--graines attend des entiers');
  if (!Number.isInteger(options.maxClics) || options.maxClics < 1) throw new Error('--max-clics attend un entier ≥ 1');
  const connus = GABARITS_JOUES.map((g) => g.nom);
  for (const nom of options.gabarits) {
    if (!connus.includes(nom)) throw new Error(`gabarit inconnu : ${nom} (connus : ${connus.join(', ')})`);
  }
  return options;
}

/** Les boutons d'action affichés, dans l'ordre du document, avec leur zone et leur état. */
async function lireBoutons(page) {
  return page.evaluate(
    (selecteur) =>
      [...document.querySelectorAll(selecteur)]
        .filter((b) => !b.classList.contains('link-button'))
        .map((b) => {
          const rect = b.getBoundingClientRect();
          return {
            texte: (b.textContent ?? '').trim().replace(/\s+/g, ' '),
            visible: rect.width > 0 && rect.height > 0,
            actif: !b.disabled,
            zone: b.closest('.pose') ? 'pose' : 'barre'
          };
        }),
    BOUTONS
  );
}

async function lireMain(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.hand__card')].map((b) => (b.querySelector('.hand__name')?.textContent ?? '').trim())
  );
}

/** Le journal rangé par l'écran (la partie en cours), ou `null` une fois la partie finie. */
async function lirePartieRangee(page) {
  const brut = await page.evaluate((cle) => localStorage.getItem(cle), STORAGE_KEY);
  if (!brut) return null;
  try {
    return JSON.parse(brut).state?.partie ?? null;
  } catch (erreur) {
    // **On ne se tait pas** (revue du 29/10/2026) : une partie rangée illisible n'est pas
    // « aucune partie ». La confondre avec l'absence ferait jouer une partie neuve en croyant
    // reprendre, et le rapport dirait « fini » sans avoir rien rejoué.
    console.warn(`Partie rangée illisible (${erreur.message}) : le harnais repart d'une partie neuve.`);
    return null;
  }
}

/**
 * Les cibles du café (#454, D-145) : chaque Planqué à moi qui reçoit le café en Machine se touche
 * sur le plateau. Le nom accessible porte l'action ; `aria-hidden` écarte le clone de la scène.
 */
const CIBLES_CAFE = '[role="button"][aria-label^="Attacher le café à"]';

async function lireCiblesCafe(page) {
  return page.evaluate(
    (selecteur) =>
      [...document.querySelectorAll(selecteur)]
        .filter((b) => !b.closest('[aria-hidden="true"]'))
        .map((b) => {
          const rect = b.getBoundingClientRect();
          return {
            uid: b.getAttribute('data-uid'),
            texte: b.getAttribute('aria-label'),
            visible: rect.width > 0 && rect.height > 0,
            actif: true
          };
        }),
    CIBLES_CAFE
  );
}

/**
 * Mesure une cible **sans la faire défiler** (#455) : la Rotation se joue par la barre, puis par le
 * panneau du Poste, et chaque mesure vaut pour l'écran tel qu'un joueur le voit, sans glissement.
 */
async function viserSansDefilement(page, selecteur, index) {
  return page.evaluate(
    ({ selecteur, index }) => {
      const liste = [...document.querySelectorAll(selecteur)].filter(
        (b) => !b.classList.contains('link-button') && !b.closest('[aria-hidden="true"]')
      );
      const cible = liste[index];
      document.querySelectorAll('[data-jouer-cible]').forEach((el) => el.removeAttribute('data-jouer-cible'));
      if (!cible) return null;
      cible.setAttribute('data-jouer-cible', '1');
      const rect = cible.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const dessus = document.elementFromPoint(x, y);
      return {
        x,
        y,
        visible: rect.width > 0 && rect.height > 0,
        actif: !cible.disabled,
        dansLaFenetre: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
        dessusEstCible: !!dessus && (dessus === cible || cible.contains(dessus))
      };
    },
    { selecteur, index }
  );
}

/** Les boutons du panneau du Poste (`.inspecteur__gestes`), classés comme ceux de la barre. */
async function lireBoutonsDuPanneau(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.inspecteur__gestes button')].map((b) => {
      const rect = b.getBoundingClientRect();
      return {
        texte: (b.textContent ?? '').trim().replace(/\s+/g, ' '),
        visible: rect.width > 0 && rect.height > 0,
        actif: !b.disabled
      };
    })
  );
}

/**
 * Mesure une cible du café **sans la faire défiler** (#454) : `scrollIntoView` masquait le défaut
 * qu'on cherche — une cible qui n'existe qu'après un glissement. Hors de la fenêtre, le jugement
 * le dit (`hors-fenetre`).
 */
async function viserCafe(page, uid) {
  return page.evaluate(
    ({ selecteur, uid }) => {
      const cible = [...document.querySelectorAll(selecteur)].find(
        (b) => b.getAttribute('data-uid') === uid && !b.closest('[aria-hidden="true"]')
      );
      document.querySelectorAll('[data-jouer-cible]').forEach((el) => el.removeAttribute('data-jouer-cible'));
      if (!cible) return null;
      cible.setAttribute('data-jouer-cible', '1');
      const rect = cible.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const dessus = document.elementFromPoint(x, y);
      return {
        x,
        y,
        visible: rect.width > 0 && rect.height > 0,
        actif: true,
        dansLaFenetre: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
        dessusEstCible: !!dessus && (dessus === cible || cible.contains(dessus))
      };
    },
    { selecteur: CIBLES_CAFE, uid }
  );
}

/** Fait voir l'élément n° `index` (dans la liste du sélecteur) et mesure son centre. */
async function viser(page, selecteur, index) {
  return page.evaluate(
    ({ selecteur, index }) => {
      const liste = [...document.querySelectorAll(selecteur)].filter((b) => !b.classList.contains('link-button'));
      const cible = liste[index];
      document.querySelectorAll('[data-jouer-cible]').forEach((el) => el.removeAttribute('data-jouer-cible'));
      if (!cible) return null;
      cible.setAttribute('data-jouer-cible', '1');
      cible.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = cible.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const dessus = document.elementFromPoint(x, y);
      return {
        x,
        y,
        visible: rect.width > 0 && rect.height > 0,
        actif: !cible.disabled,
        dansLaFenetre: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
        dessusEstCible: !!dessus && (dessus === cible || cible.contains(dessus))
      };
    },
    { selecteur, index }
  );
}

/**
 * Joue une partie sur un gabarit, à une graine, jusqu'à la fin ou jusqu'à un échec nommé.
 * `moteur` lit le moteur (`rejouer`, `legalActions`, `nomDeCarte`, `rangEnMain`) : il ne joue pas.
 */
async function jouerUnePartie({ browser, moteur, graine, gabarit, maxClics, base, origine }) {
  const debut = Date.now();
  const context = await browser.newContext({
    viewport: gabarit.viewport,
    isMobile: gabarit.mobile,
    hasTouch: gabarit.mobile,
    storageState: amorcageStore(origine, { pasAPasCombatVu: true })
  });
  const page = await context.newPage();
  const anomalies = [];
  const captures = [];
  page.on('pageerror', (error) => anomalies.push({ type: 'erreur-page', detail: `pageerror : ${error.message}` }));
  page.on('console', (message) => {
    if (message.type() === 'error') anomalies.push({ type: 'erreur-page', detail: `console : ${message.text()}` });
  });
  await page.clock.setFixedTime(graine);
  await page.goto(`${base}${ROUTE}`, { waitUntil: 'networkidle' });

  const muettes = new Set();
  const compte = { clics: 0, actions: 0, silencieux: 0, sansEffet: 0 };
  let etat = 'en-cours';
  let verdict = null;
  let attenteDirection = 0;
  let sansEffetDAffile = 0;
  let indicateurSignale = false;
  let tour = 0;

  const echec = async (type, detail) => {
    anomalies.push({ type, detail });
    const fichier = join(sortieDir, `echec-${type}-${graine}-${gabarit.nom}-${compte.clics}.png`);
    await page.screenshot({ path: fichier });
    captures.push(fichier);
  };

  try {
    while (etat === 'en-cours') {
      if (compte.clics >= maxClics) {
        await echec('non-finie', `${maxClics} clics sans fin de partie`);
        etat = 'anomalie';
        break;
      }
      const tete =
        (await page
          .locator('.battle__head')
          .textContent()
          .catch(() => '')) ?? '';
      const notices = await page.locator('.notice').allTextContents();
      tour = Number(/Tour (\d+)/.exec(tete)?.[1] ?? tour);
      const partie = await lirePartieRangee(page);
      const reprise = partie ? moteur.rejouer(partie) : null;
      const phaseMoteur = partie ? (reprise?.ok ? reprise.state.phase : 'inconnue') : 'ended';

      const fin = jugerFinPartie({ tete, notices, phaseMoteur });
      if (fin.terminee) {
        verdict = fin.verdict;
        etat = 'finie';
        break;
      }
      if (fin.anomalies.length) {
        await echec(fin.anomalies[0], `écran « ${tete.trim()} », moteur ${phaseMoteur}`);
        etat = 'anomalie';
        break;
      }
      if (!reprise?.ok) {
        await echec('journal-non-rejouable', reprise ? `rejeu refusé : ${reprise.raison}` : 'partie absente du store');
        etat = 'anomalie';
        break;
      }
      // C'est au joueur quand il doit trancher : une relève ou un choix en attente lui revient
      // même si le tour du moteur est à la Direction (`pendingPromotion` / `pendingChoice`).
      const auJoueur = jouePar(reprise.state) === 'player';
      if (!auJoueur) {
        // La Direction joue seule : on attend, sans limite au-delà de 60 s.
        attenteDirection += 1;
        if (attenteDirection > 150) {
          await echec('direction-muette', `plus de tour du joueur pendant 60 s, écran « ${tete.trim()} »`);
          etat = 'anomalie';
          break;
        }
        await page.waitForTimeout(400);
        continue;
      }
      attenteDirection = 0;
      // L'indicateur de tour (« à toi » / « à la Direction ») ne suit que `state.current` : une relève
      // du joueur, le moteur étant à la Direction, s'affiche « à la Direction ». Anomalie nommée une
      // fois par partie, le jeu continue pour aller au bout.
      if (!tete.includes('à toi') && !indicateurSignale) {
        indicateurSignale = true;
        await echec('indicateur-tour', `le joueur doit jouer, l'écran affiche « ${tete.trim()} »`);
      }

      const { state } = reprise;
      const legales = moteur.legalActions(state);
      const jouables = legales.filter((a) => a.type !== 'forfeit');
      const boutons = await lireBoutons(page);

      // L'oracle, côté barre : chaque geste de la barre légal a son bouton, et inversement.
      const barre = boutons
        .filter((b) => b.zone === 'barre')
        .map((b) => ({ type: classerBouton(b.texte), actif: b.actif && b.visible }));
      const sansType = boutons.filter((b) => b.zone === 'barre' && classerBouton(b.texte) === null);
      for (const b of sansType) await echec('bouton-sans-type', `« ${b.texte} » ne correspond à aucune action`);
      // La Rotation n'a qu'une entrée dans la barre (#455, D-147) : ses cibles sont jugées au panneau.
      const boutonsDeBarre = affordancesDeBarre(
        jouables.filter((a) => !GESTES_DE_MAIN.includes(a.type) && a.type !== 'attachEnergy')
      );
      for (const a of comparerAffordances({ legales: boutonsDeBarre, visibles: barre })) {
        await echec(a.type, `${a.geste} : attendu ${a.attendu}, offert ${a.offert}`);
      }
      // L'oracle, côté café : chaque attachement légal a sa cible sur un Planqué, et inversement.
      const ciblesCafe = await lireCiblesCafe(page);
      const attachLegaux = jouables.filter((a) => a.type === 'attachEnergy');
      for (const a of comparerAffordances({
        legales: attachLegaux,
        visibles: ciblesCafe.map((c) => ({ type: 'attachEnergy', actif: c.visible && c.actif }))
      })) {
        await echec(a.type, `café : attendu ${a.attendu} cible(s), offert ${a.offert}`);
      }

      const choix = choisirAction(legales, muettes);
      if (!choix) {
        await echec('impasse', `aucune action légale hors forfait, écran « ${tete.trim()} »`);
        etat = 'anomalie';
        break;
      }

      // Le geste. Une action de main passe par la carte (aria-pressed) puis le bouton de la pose.
      // Le panneau du Poste (#455) reste ouvert après une Rotation montrée : il recouvre la barre.
      // Une autre action passe donc d'abord par sa fermeture, comme le joueur (Échap).
      if (choix.type !== 'retreat' && (await page.locator('.inspecteur').count()) > 0) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
      let index;
      let libelle;
      let mesure = null;
      if (choix.type === 'attachEnergy') {
        // Le café se touche sur le Planqué qui le reçoit (#454) : la cible est celle de son `uid`.
        const voulue = ciblesCafe.find((c) => c.uid === choix.targetUid);
        if (!voulue) {
          await echec('sans-bouton', `attachement vers ${choix.targetUid} : aucune cible affichée`);
          muettes.add(cle(choix));
          continue;
        }
        libelle = voulue.texte;
        mesure = await viserCafe(page, choix.targetUid);
      } else if (GESTES_DE_MAIN.includes(choix.type)) {
        const nomCarte = moteur.nomDeCarte(state, choix.uid);
        const cartes = await lireMain(page);
        const occurrences = cartes.map((nom, i) => (nom === nomCarte ? i : -1)).filter((i) => i >= 0);
        const rangCarte = moteur.rangEnMain(state, choix.uid);
        const indexCarte = occurrences[rangCarte];
        if (indexCarte === undefined) {
          await echec('carte-sans-bouton', `« ${nomCarte} » absente de la main affichée`);
          muettes.add(cle(choix));
          continue;
        }
        const carte = await viser(page, '.hand__card', indexCarte);
        const anomaliesCarte = carte ? jugerCible(carte) : ['introuvable'];
        if (anomaliesCarte.length) {
          await echec(anomaliesCarte[0], `carte « ${nomCarte} »`);
          muettes.add(cle(choix));
          continue;
        }
        await page.mouse.click(carte.x, carte.y);
        await page.waitForSelector('.pose', { timeout: 3000 }).catch(() => null);
        await page.waitForTimeout(150);

        // La pose est ouverte : on relit tous les boutons, avec leur index dans la liste complète.
        const complets = (await lireBoutons(page)).map((b, i) => ({ ...b, i }));
        const poseBoutons = complets.filter((b) => b.zone === 'pose');
        // L'oracle, côté pose : seulement si la carte est unique dans la main (sinon deux copies se confondent).
        if (occurrences.length === 1) {
          const attendusCarte = legales.filter((a) => a.uid === choix.uid);
          const visiblesCarte = poseBoutons.map((b) => ({ type: classerBouton(b.texte), actif: b.actif && b.visible }));
          for (const a of comparerAffordances({ legales: attendusCarte, visibles: visiblesCarte })) {
            await echec(a.type, `pose de « ${nomCarte} » : ${a.geste} attendu ${a.attendu}, offert ${a.offert}`);
          }
        }
        // Le bouton exigé : un Entrant se reconnaît à son emplacement, les autres gestes à leur rang sur la carte.
        const rangDansCarte = legales
          .filter((a) => a.uid === choix.uid && a.type === choix.type)
          .findIndex((a) => cle(a) === cle(choix));
        const candidats = poseBoutons.filter((b) => classerBouton(b.texte) === choix.type);
        const voulu =
          choix.type === 'playBasic'
            ? candidats.find((b) =>
                b.texte.startsWith(choix.slot === 'active' ? 'Poser au Poste' : `Mettre au Banc ${choix.slot + 1}`)
              )
            : candidats[rangDansCarte];
        if (!voulu) {
          await echec('sans-bouton', `« ${nomCarte} » : aucun bouton pour ${choix.type} dans la pose`);
          muettes.add(cle(choix));
          continue;
        }
        index = voulu.i;
        libelle = voulu.texte;
      } else if (choix.type === 'retreat') {
        // La Rotation (#455, D-147) : l'entrée de la barre ouvre le panneau du Poste ; la cible du
        // Planqué du Banc se joue **dans ce panneau**. Rien n'est défilé avant la mesure.
        const entree = boutons.findIndex((b) => b.zone === 'barre' && classerBouton(b.texte) === 'retreat');
        const mesureEntree = entree < 0 ? null : await viserSansDefilement(page, BOUTONS, entree);
        if (!mesureEntree || jugerCible(mesureEntree).length) {
          await echec('sans-bouton', `Rotation légale, entrée de barre ${mesureEntree ? 'non cliquable' : 'absente'}`);
          muettes.add(cle(choix));
          continue;
        }
        await page.mouse.click(mesureEntree.x, mesureEntree.y);
        compte.clics += 1;
        await page.waitForSelector('.inspecteur__gestes', { timeout: 3000 }).catch(() => null);
        await page.waitForTimeout(150);
        const panneau = await lireBoutonsDuPanneau(page);
        // L'oracle, côté panneau : une cible par Rotation légale, pas une de plus ni de moins.
        const rotations = jouables.filter((a) => a.type === 'retreat');
        for (const a of comparerAffordances({
          legales: rotations,
          visibles: panneau.map((b) => ({ type: classerBouton(b.texte), actif: b.actif && b.visible }))
        })) {
          await echec(a.type, `panneau du Poste : ${a.geste} attendu ${a.attendu}, offert ${a.offert}`);
        }
        const cibles = panneau.map((b, i) => ({ b, i })).filter(({ b }) => classerBouton(b.texte) === 'retreat');
        const voulue = cibles[rangDansLeType(legales, choix)];
        if (!voulue) {
          await echec(
            'sans-bouton',
            `Rotation légale, aucune cible dans le panneau (rang ${rangDansLeType(legales, choix)})`
          );
          muettes.add(cle(choix));
          continue;
        }
        index = voulue.i;
        libelle = voulue.b.texte;
        mesure = await viserSansDefilement(page, '.inspecteur__gestes button', index);
      } else {
        // Un geste de barre : le rang de l'action parmi les légaux de son type.
        const rang = rangDansLeType(legales, choix);
        const candidats = boutons
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => b.zone === 'barre' && classerBouton(b.texte) === choix.type);
        const voulu = candidats[rang];
        if (!voulu) {
          await echec('sans-bouton', `${choix.type} légal, aucun bouton (rang ${rang})`);
          muettes.add(cle(choix));
          continue;
        }
        index = voulu.i;
        libelle = voulu.b.texte;
      }

      const avant = await page.locator('.battle').textContent();
      const actionsAvant = partie.actions.length;
      const cible = mesure ?? (await viser(page, BOUTONS, index));
      const anomaliesCible = cible ? jugerCible(cible) : ['introuvable'];
      if (anomaliesCible.length) {
        await echec(anomaliesCible[0], `« ${libelle} »`);
        muettes.add(cle(choix));
        continue;
      }
      await page.mouse.click(cible.x, cible.y);
      compte.clics += 1;

      // Accepté = le store a une action de plus. Partie rangée à `null` = le coup a fini la partie.
      let accepte = false;
      for (let t = 0; t < 10 && !accepte; t += 1) {
        await page.waitForTimeout(300);
        const p = await lirePartieRangee(page);
        accepte = !p || p.actions.length > actionsAvant;
      }
      await page.waitForTimeout(500);
      const apres = await page.locator('.battle').textContent();
      const effet = jugerClic({ accepte, texteAvant: avant, texteApres: apres });
      if (effet === 'ok') {
        sansEffetDAffile = 0;
        compte.actions += 1;
      } else if (effet === 'silencieux') {
        sansEffetDAffile = 0;
        compte.actions += 1;
        compte.silencieux += 1;
        await echec('silencieux', `« ${libelle} » appliqué, rien ne change à l’écran`);
        muettes.add(cle(choix));
      } else {
        compte.sansEffet += 1;
        sansEffetDAffile += 1;
        muettes.add(cle(choix));
        if (sansEffetDAffile >= 3) {
          await echec('sans-effet', `« ${libelle} » : trois clics sans effet de suite`);
          etat = 'anomalie';
          break;
        }
      }
    }
    if (etat === 'finie') {
      const fichier = join(sortieDir, `fin-${graine}-${gabarit.nom}.png`);
      await page.screenshot({ path: fichier });
      captures.push(fichier);
    }
  } finally {
    await context.close();
  }

  return {
    graine,
    gabarit: gabarit.nom,
    viewport: `${gabarit.viewport.width}×${gabarit.viewport.height}`,
    etat,
    verdict,
    tour,
    ...compte,
    dureeS: Math.round((Date.now() - debut) / 100) / 10,
    anomalies,
    captures
  };
}

const options = (() => {
  try {
    return lireOptions(process.argv.slice(2));
  } catch (erreur) {
    process.stderr.write(`${erreur.message}\n\n${USAGE}`);
    process.exit(2);
  }
})();
if (options.aide) {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (!existsSync(executablePath)) {
  console.error(`✖ Chromium introuvable : ${executablePath}\n  Renseigne CHROME_PATH.`);
  process.exit(1);
}
if (!process.env.BASE_URL && !existsSync(distIndex)) {
  console.error('✖ dist/index.html absent : lance `npm run build` avant `npm run jouer-partie`.');
  process.exit(1);
}

mkdirSync(sortieDir, { recursive: true });
const base = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const origine = new URL(base).origin;
let server = null;
let vite = null;
let browser = null;
try {
  if (!process.env.BASE_URL)
    server = await preview({ root, preview: { port: PORT, strictPort: true }, logLevel: 'error' });
  // Le moteur se lit depuis ses sources TypeScript, chargées par Vite comme `npm run simulate`.
  vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const rejeu = await vite.ssrLoadModule('/src/game/rejeu.ts');
  const engine = await vite.ssrLoadModule('/src/game/engine.ts');
  const donnees = await vite.ssrLoadModule('/src/data/index.ts');
  const nomDe = (cardId) => donnees.getCard(cardId)?.name ?? '';
  const moteur = {
    rejouer: (partie) => rejeu.rejouer(partie),
    legalActions: (state) => engine.legalActions(state),
    nomDeCarte: (state, uid) => {
      const carte = state.players[state.current].hand.find((h) => h.uid === uid);
      return nomDe(carte?.cardId);
    },
    rangEnMain: (state, uid) => {
      const main = state.players[state.current].hand;
      const nom = nomDe(main.find((h) => h.uid === uid)?.cardId);
      return main.filter((h) => nomDe(h.cardId) === nom).findIndex((h) => h.uid === uid);
    }
  };

  browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const parties = [];
  for (const nom of options.gabarits) {
    const gabarit = GABARITS_JOUES.find((g) => g.nom === nom);
    for (const graine of options.graines) {
      const partie = await jouerUnePartie({
        browser,
        moteur,
        graine,
        gabarit,
        maxClics: options.maxClics,
        base,
        origine
      });
      parties.push(partie);
      if (!options.json) {
        const bilan = partie.anomalies.length ? `${partie.anomalies.length} anomalie(s)` : 'sans anomalie';
        const verdict = partie.verdict ? ` (${partie.verdict})` : '';
        console.log(
          `graine ${graine} · ${gabarit.nom} ${partie.viewport} · ${partie.etat}${verdict} · tour ${partie.tour} · ${partie.actions} actions · ${partie.clics} clics · ${partie.dureeS} s · ${bilan}`
        );
        for (const a of partie.anomalies) console.log(`    ✖ ${a.type} : ${a.detail}`);
      }
    }
  }
  const echecs = parties.filter((p) => p.etat !== 'finie' || p.anomalies.length > 0).length;
  if (options.json) process.stdout.write(`${JSON.stringify({ parties, echecs }, null, 2)}\n`);
  else console.log(`${parties.length - echecs}/${parties.length} partie(s) finie(s) sans anomalie`);
  process.exitCode = echecs ? 1 : 0;
} catch (erreur) {
  console.error(`✖ ${erreur.stack ?? erreur.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
}
