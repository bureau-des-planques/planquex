# Les deux sons du jeu

> **D-137** : l'alpha a **deux** sons — l'ouverture d'un **Arrivage** et la **fin d'un combat** — et
> une case dans Réglages qui les coupe. Rien d'autre : ni musique, ni ambiance, ni effets de Pression.
> Branchement : **#378**. Choix des timbres : **#379**.

## Ce que sont ces fichiers

`public/sons/arrivage.wav` et `public/sons/verdict.wav` sont **fabriqués par le projet**, par
`scripts/ressources/sons.mjs`. Ils ne viennent d'aucune banque de sons.

| Fichier | Ce qu'on entend | Poids |
|---|---|---|
| `arrivage.wav` | le film du sachet qui craque, une déchirure, puis un « pop » sourd quand la lèvre s'ouvre | **39,7 Ko** |
| `verdict.wav` | un tampon qui s'abat, puis deux notes descendantes — le dossier qu'on classe | **33,6 Ko** |

Le plafond du ticket #379 est de **100 Ko par fichier** : les deux y tiennent avec de la marge. Le
format est du **WAV mono 22,05 kHz** parce que la machine n'a pas d'encodeur audio et qu'un fichier
d'une seconde reste plus petit que le plafond. Un `.opus` le remplacera un jour sans toucher au
module qui les joue.

## Pourquoi générés, et pas téléchargés

D-137 demande des sons **libres**, **sourcés**, et **aucun asset des versions abandonnées**
(`AGENTS.md` §9). Une banque sous CC0 aurait demandé une attribution à tenir, une URL à vérifier et
une licence à relire à chaque doute. Un son **synthétisé ici** n'a **aucune licence tierce** : il
appartient au projet, il se régénère à l'identique (les générateurs sont seedés), et il ne pose
aucune question de droits.

C'est un **écart assumé** avec la lettre de #379 (« deux propositions écoutables avec leur
licence ») : il n'y a pas de licence à présenter, puisqu'il n'y a pas de tiers. À confirmer par
Bastien — s'il préfère un vrai son enregistré, la place est prête : `public/sons/<clé>.wav` et une
ligne dans ce fichier.

## Les régénérer

```bash
node scripts/ressources/sons.mjs             # réécrit les deux fichiers
node scripts/ressources/sons.mjs --verifier  # contrôle poids et fondus, sans rien écrire
```

Le contrôle est aussi un test (`scripts/ressources/sons.test.ts`) : deux fichiers, sous 100 Ko, qui commencent
vite et finissent en fondu. Un son qui « colle » au silence s'entend plus qu'il ne s'écoute.

## Comment ils sont joués

Un seul module touche à l'audio : **`src/audio/sons.ts`** (`jouer('arrivage')`, `jouer('verdict')`).
Nulle part ailleurs il n'y a d'`Audio` ni de `<audio>`.

- **Rien au chargement** : le contexte se crée sur le **premier geste** de la session (`App.tsx`),
  et les deux fichiers sont décodés à ce moment-là. Les sons ne se déclenchent jamais d'eux-mêmes.
- **Le réglage coupe tout** : `sons` dans le store, **coché par défaut**, persisté (`STORAGE_VERSION`
  **12**). Le module lit le store **à chaque lecture** : décocher coupe immédiatement.
- **Un contexte suspendu ne joue pas** : mieux vaut le silence qu'un son en retard.

## Ce qui n'est pas fait

- **Aucune mesure sur appareil.** Le déblocage iOS (interrupteur silencieux, `resume()` après
  verrouillage) n'a pas été éprouvé sur un vrai téléphone.
- **Le précache est fait** (depuis #414, phrase corrigée à la revue du 29/10) : les deux WAV sont
  dans le service worker — `globPatterns` de `vite.config.ts` porte `wav` — et
  `scripts/ressources/precache.test.ts` refuse un fichier de `public/` que le jeu charge sans le servir
  hors ligne. Ce qui reste vrai : un son qui ne se décode pas ne casse rien, et le module se
  tait alors, sans erreur.
