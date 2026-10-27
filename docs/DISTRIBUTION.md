# Distribution et moteur — notes de recherche (25/10/2026)

> **Statut : recherche, elle n'acte rien.** Les décisions de distribution actées restent
> **D-053 / D-054 / D-055** (Vercel, push → production) et **D-071 / D-072** (domaine,
> redirection 308). Aucune décision d'APK, de store ou de moteur n'est prise ici ; le jour
> où l'une tombe, elle entre dans `docs/DECISIONS.md` et ce document la cite.
>
> **Origine** : session « Analyse vidéo et UI recherchée » (25/10/2026), à la suite de
> D-093 et de `docs/DIRECTION-SCENE-COMBAT.md` §8.6 (« pourquoi les refusés ? » → « une
> APK ? » → « F-Droid ? » → « comment fait Hearthstone ? » → « et en PWA ? » → « et
> Godot ? »).
>
> **Note de vérification** : les états de plateforme (WebGPU, Safari, F-Droid) datent du
> 25/10/2026 et bougent vite — **revérifier avant de trancher**. Les affirmations sur les
> moteurs des jeux cités sont des faits publics établis ; la conférence GDC 2015 citée
> reste inaccessible (`SPEC-COMBAT-UI.md` §7), seule sa phrase-titre est sourcée.

---

## 1. Pourquoi les jeux de cartes « AAA » sont fluides

Hearthstone est fait avec **Unity** : chaque carte est un objet 3D, et particules,
éclairs, shaders et secousses de caméra partent sur le **GPU**, donc y coûtent presque
rien. Même choix chez Marvel Snap, MTG Arena, Legends of Runeterra ; Balatro est en
LÖVE (2D, Lua), Slay the Spire en libGDX.

Leurs recettes, transposables ou non :

| Recette | Transposable sans moteur ? |
|---|---|
| **Physicalité** (la carte claque, a du poids) | oui : c'est du découpage temporel (§8.2 de `DIRECTION-SCENE-COMBAT.md`) |
| **Anticipation → action → réaction** (principes Disney) | oui, idem |
| **Le son fait la moitié de l'impact** | non, refusé pour l'instant (scope : réglage, migration du store, WCAG 1.4.2) |
| **Budget de frame, pooling** | oui : nos plafonds vivent dans `src/components/effets-combat.ts` (4 effets, 800 ms) |
| **Courbes d'animation** | oui (`ease-out` et `@keyframes` maison) |
| **Particules GPU, shaders, caméra** | non — il faut un moteur ou du WebGL écrit à la main |
| « Our game is UI » (itérer l'écran comme le jeu) | déjà le nôtre (SPEC-COMBAT-UI, tickets T) |

## 2. Ce que la plateforme web (PWA) sait faire

- **WebGL / WebGPU** : le vrai GPU (WebGPU : Chrome/Edge depuis 2023, Safari depuis
  2025, Firefox récent — à revérifier).
- **Canvas 2D** : suffisant pour un jeu de cartes entier.
- **Web Audio** (muet avant le premier geste), **WebAssembly + Workers**,
  **Vibration** (Android seulement), **Gamepad**, **plein écran**, **hors-ligne**
  (Workbox, déjà en place), **installation** (déjà en place, D-054).

Jeux avancés en techno web, preuves que le plafond est loin : **Krunker.io** (FPS
WebGL), **CrossCode** (RPG HTML5 vendu sur Steam), **Board Game Arena** — la preuve qui
compte pour nous : des milliers de jeux de cartes/plateau, des millions de parties —,
**Dominion en ligne**, ports WebAssembly (DOOM 3), cloud gaming dans l'onglet.

## 3. Les limites réelles d'une PWA (pour ce jeu)

| Limite | Conséquence pour nous |
|---|---|
| **iOS Safari** | pas de Vibration API, installation manuelle (pas d'invite), plein écran capricieux — **c'est lui qui fixe le niveau commun** |
| **Son** | muet jusqu'au premier geste (peu grave : un jeu attend toujours un tap) |
| **Arrière-plan** | pas de calcul fiable en fond — indifférent en tour par tour |
| **Mémoire** | un onglet gourmand peut être tué sur téléphone d'entrée de gamme |
| **Découvrabilité** | pas de vraie fiche store sans TWA/APK |
| **Le DOM** | lent hors `transform`/`opacity` — d'où §8, et ce n'est pas un choix de pauvre : c'est le chemin rapide du navigateur |

## 4. Les options de distribution, évaluées

| Option | Ce que c'est | Verdict au 25/10/2026 |
|---|---|---|
| **PWA** (actuel) | installable, hors-ligne, déploiement en 24 s (D-055) | **retenu**, c'est le présent |
| **TWA / Bubblewrap** | `dist/` emballé tel quel en AAB pour le Play Store | **retenu pour le lancement public** — la fiche store sans réécrire |
| **APK en sideload** | coquille WebView de `dist/`, téléchargement direct | possible en un après-midi, si un testeur veut « un vrai fichier » |
| **Dépôt F-Droid auto-hébergé** | on héberge APK + métadonnées ; maj via l'app F-Droid | possible ; aucune exigence de source publique (c'est *notre* dépôt) |
| **F-Droid officiel** | ils **compilent depuis une source publique** | **bloqué aujourd'hui** : le dépôt est privé. Le reste est déjà en règle : licence MIT, dépendances 100 % open source, alpha fonctionnel sans backend (le mur/PvP passeraient en mention `NonFreeNet`), tags propres. Décision **de distribution**, à trancher au lancement public |
| **Réécriture native** (Unity, Godot…) | particules GPU, shaders, haptique | **refusée aujourd'hui** — voir §5 |

## 5. Godot, si un jour

**Pour** : open source (MIT, la même licence que le projet), zéro royauté, 2D native
excellente (particules, tweens, shaders dans la boîte), exports Android/iOS/desktop/web,
éditeur sous Linux, GDScript simple, compatible F-Droid. **Contre** : réécriture — le
moteur est **portable** (`src/game/engine.ts` est pur, seedé, sans DOM), mais l'écran et
ses tests sont à refaire ; l'**accessibilité** (focus, ARIA, APG — toute la §3 de
`SPEC-COMBAT-UI.md`) est à reconstruire à la main, le navigateur la donnait ; le texte
riche est meilleur en DOM ; l'export **web** de Godot reste le maillon fragile (moteur
wasm ~10-15 Mo, en-têtes COOP/COEP, navigateurs mobiles capricieux) ; friction
d'installation pour les testeurs.

**Le test qui trancherait en une journée** : porter `createBattle` + `applyAction` en
GDScript et faire claquer une carte sur une table Godot. Si le feel ne bat pas §8 en
PWA, la réponse est définitive.

## 6. Ce qui ferait changer le verdict

- Besoin d'**haptique poussée**, d'animations physiques, d'une version **Steam/consoles**
  → le moteur (Godot) redevient d'actualité.
- Besoin du **Play Store** → TWA d'abord, jamais la réécriture d'abord.
- **Ouverture du code** → F-Droid officiel devient possible (§4).
- **iOS** reste le goulot côté web, quelle que soit l'option retenue.
