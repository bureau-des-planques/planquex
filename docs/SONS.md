# Les sons du jeu

> **D-137** : l'alpha a **deux** sons — l'ouverture d'un **Arrivage** et la **fin d'un combat** — et
> une case dans Réglages qui les coupe. **D-166** y ajoute les **trois gestes du combat** (Pression,
> craquage, Intervention). Toujours rien d'autre : ni musique, ni ambiance.
> Branchement : **#378**. Choix des timbres : **#379**.

## Ce que sont ces fichiers

Les cinq fichiers de `public/sons/` sont **fabriqués par le projet**, par
`scripts/ressources/sons.mjs`. Ils ne viennent d'aucune banque de sons.

| Fichier | Ce qu'on entend | Poids |
|---|---|---|
| `arrivage.wav` | le film du sachet qui craque, une déchirure, puis un « pop » sourd quand la lèvre s'ouvre | **39,7 Ko** |
| `verdict.wav` | un tampon qui s'abat, deux notes descendantes — le dossier qu'on classe — et la salle qui les éteint (#606) | **68,9 Ko** |
| `pression.wav` | le coup porté : un claquement filtré et un corps grave qui tombe (D-166) | **14,7 Ko** |
| `craquage.wav` | le Planqué qui cède : trois grains de rupture, puis une chute grave (D-166) | **26,7 Ko** |
| `intervention.wav` | le point marqué : deux notes montantes, timbre de vibraphone (D-166) | **21,6 Ko** |

Le plafond du ticket #379 est de **100 Ko par fichier** : les cinq y tiennent. Le plus lourd est le
verdict depuis #606 (68,9 Ko pour 1,6 s), et c'est le plafond qui l'a borné : une queue plus longue
demanderait du `.opus` avant de demander du disque. Le format reste du **WAV mono 22,05 kHz** parce
que la machine n'a pas d'encodeur audio. Un `.opus` le remplacera un jour sans toucher au module qui
les joue.

## Le timbre du verdict (#606)

Bastien, le 02/11/2026, en écoutant `verdict.wav` : « **trop courts et trop basiques** ». La route A
a été retenue (améliorer la synthèse plutôt que sourcer des fichiers CC0), et sur **un seul son**
d'abord — le verdict, celui qu'il avait entendu.

Ce qui a changé, dans `sons.mjs` :

| | avant | après |
|---|---|---|
| durée | 0,78 s, queue coupée | **1,6 s**, décroissance jusqu'à −55 dB |
| poids | 33,6 Ko | **68,9 Ko** (plafond 100 Ko) |
| couches | un grain de bruit filtré, un corps à 90 Hz, deux notes à deux partials | **quatre** : transitoire large bande (70 ms), corps grave 96 → 70 Hz avec sa 2ᵉ harmonique, deux notes, réverbération |
| notes | sinus + une harmonique à 2,01 f | fondamental + **partiels inharmoniques d'une barre frappée** (3,93 f, 10 f) — c'est ce qui fait un vibraphone |
| queue | aucune | **réverbération convolutive** sur une impulsion synthétisée ici : bruit filtré qui s'éteint en exponentielle, 0,9 s, énergie unitaire, mélange sec/mouillé à 0,4 |

Rien de tiers : l'impulsion est fabriquée par le générateur (graine fixe), il n'y a **ni fichier
d'IR ni plugin**, et le générateur reste **seedé** — deux exécutions donnent le fichier au bit près.
La phase des glissandos est **intégrée** (une fréquence écrite dans `Math.sin(2π f(t) t)` déphase),
et la sortie se fond sur 140 ms en carré : la queue s'éteint au lieu d'être coupée net.
Le script tourne en moins d'une demi-seconde, réverbération comprise.

Les quatre autres sons n'ont **pas bougé d'un octet** (mêmes empreintes qu'avant #606) : c'est à
l'écoute A/B du verdict que Bastien tranchera s'il faut les reprendre de la même façon.

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
node scripts/ressources/sons.mjs             # réécrit les cinq fichiers
node scripts/ressources/sons.mjs --verifier  # contrôle poids et fondus, sans rien écrire
```

Le contrôle est aussi un test (`scripts/ressources/sons.test.ts`) : sous 100 Ko, des sons qui
commencent vite et finissent en fondu — un son qui « colle » au silence s'entend plus qu'il ne
s'écoute. Depuis #606, le verdict y a ses propres gardes : durée entre 1,2 et 1,8 s, du signal encore
présent à 60 % de la durée, **deux générations identiques**, et le `.wav` du dépôt **égal aux octets
que le générateur produit** — un fichier retouché à la main, ou un générateur modifié sans
régénérer, fait échouer le test.

## Comment ils sont joués

Un seul module touche à l'audio : **`src/audio/sons.ts`** (`jouer('arrivage')`, `jouer('verdict')`,
`jouer('pression')`, `jouer('craquage')`, `jouer('intervention')`).
Nulle part ailleurs il n'y a d'`Audio` ni de `<audio>`.

- **Rien au chargement** : le contexte se crée sur le **premier geste** de la session (`App.tsx`),
  et les fichiers sont décodés à ce moment-là. Les sons ne se déclenchent jamais d'eux-mêmes.
- **Le réglage coupe tout** : `sons` dans le store, **coché par défaut**, persisté (`STORAGE_VERSION`
  **12**). Le module lit le store **à chaque lecture** : décocher coupe immédiatement.
- **Un contexte suspendu ne joue pas** : mieux vaut le silence qu'un son en retard.

## Ce qui n'est pas fait

- **Aucune mesure sur appareil.** Le déblocage iOS (interrupteur silencieux, `resume()` après
  verrouillage) n'a pas été éprouvé sur un vrai téléphone.
- **Le précache est fait** (depuis #414, phrase corrigée à la revue du 29/10) : les deux WAV sont
  dans le service worker — `globPatterns` de `vite.config.ts` porte `wav` — et
  `scripts/gardes/precache.test.ts` refuse un fichier de `public/` que le jeu charge sans le servir
  hors ligne. Ce qui reste vrai : un son qui ne se décode pas ne casse rien, et le module se
  tait alors, sans erreur.
