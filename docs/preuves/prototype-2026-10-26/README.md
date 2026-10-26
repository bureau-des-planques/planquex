# Le banc d'essai des saynètes — il se rend (#219, D-101)

Lot du **26/10/2026**. Trois captures de **notre** banc d'essai DEV
(`src/prototype/scene.html`), pas de l'application : le banc n'est **pas** un écran, il ne
part **pas** dans le bundle, et ces images prouvent seulement qu'il **se rend** et que la
scène y joue. Elles ne prouvent aucune règle de jeu.

## Comment elles ont été prises

```bash
npm run dev -- --port 5311        # un port libre ; 5178 est celui du `vite.config.ts`
# puis, Playwright (Chromium du cache `ms-playwright`), fenêtre 420 × 900, `isMobile: true`,
# sur http://127.0.0.1:5311/src/prototype/scene.html :
#   - capture au repos, sans rien cliquer ;
#   - clic sur « Cinématique COMEX », 700 ms d'attente, capture (la scène est en cours) ;
#   - clic sur « Coup de grâce », 1200 ms d'attente, capture (le tampon est posé).
```

Le script de capture **échoue** si la page lève une erreur de console ou une `pageerror` —
il n'en a levé aucune. Il vit hors du dépôt : c'est un geste, pas un outil du projet.

Taille : **420 × 900** (la fenêtre, jamais la page entière — critère (4) de D-060).

| Fichier | Ce qu'on y voit |
|---|---|
| `banc-420-au-repos.png` | Le banc **rendu** : deux camps (La Direction au-dessus, Toi en dessous), un Poste et **trois places de Banc** par camp, puis la régie — les trois scénarios, les sélecteurs d'attaquant, de Pression et de cible, les cases, la vitesse. C'est ce qui levait « Carte introuvable : atelier-chef-atelier » avant #219. |
| `banc-420-cinematique.png` | La **cinématique COMEX** en cours : bandeau « COMEX · séance extraordinaire », nom de la Pression, carte centrée agrandie, voile et barres — la vraie scène (`SceneAttaque` → `choregraphie` → `Moteur`), sur le gabarit réel du plateau. La régie dit « Médecin-chef COMEX — Protocole → Pile de dossiers + cinématique ». |
| `banc-420-coup-de-grace.png` | Le **coup de grâce** : le tampon « OPTIMISATION DES EFFECTIFS », la carte qui s'éteint, les chiffres de Stress (`+10` / `-10`) et « la cible craque » cochée, sur une petite Pression d'Entrant (Infirmier de site, `Pansement`, 1 café). |

## Ce qu'elles ne prouvent pas

- **Rien sur les règles** : c'est un banc d'essai, ses Stress sont des nombres de scène.
- **Rien sur le bundle** : la preuve de l'absence du banc dans `dist/` est la commande
  `find dist -iname '*scene*'`, qui ne rend rien après `npm run build` (D-101 (3)).
- **Rien sur `jsdom`** : le moteur de la scène s'y tait faute de `canvas` 2D ; c'est la
  capture, et elle seule, qui montre les particules. Le test de rendu
  (`src/prototype/PrototypeScene.test.tsx`) garde le reste.
