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
| `arrivage.wav` | le film du sachet qui craque, la déchirure, le claquement du film, puis l'air qui se dégonfle (#606) | **41,0 Ko** |
| `verdict.wav` | un tampon qui s'abat sur un dossier, puis le tiroir du classeur qui se ferme (#606) | **62,5 Ko** |
| `pression.wav` | le coup porté : un claquement sec, une masse grave très courte, le frottement de la manche (#606) | **13,8 Ko** |
| `craquage.wav` | le Planqué qui cède : trois grains, la rupture de fibres, le carton qui se déchire (#606) | **32,3 Ko** |
| `intervention.wav` | le point marqué : le tampon de caoutchouc sur le bureau, puis le trait de stylo (#606) | **21,6 Ko** |

Le plafond du ticket #379 est de **100 Ko par fichier** : les cinq y tiennent. Le plus lourd est le
verdict (62,5 Ko pour 1,45 s), et c'est le plafond qui a borné sa première version : une queue plus
longue demanderait du `.opus` avant de demander du disque. Le format reste du **WAV mono 22,05 kHz**
parce que la machine n'a pas d'encodeur audio. Un `.opus` le remplacera un jour sans toucher au module
qui les joue.

## Le principe : un objet du Bureau, jamais une note (#606)

Bastien, le 02/11/2026, en écoutant les sons : « **trop courts et trop basiques** ». La route A a été
retenue (améliorer la synthèse plutôt que sourcer des fichiers CC0), et sur **un seul son** d'abord —
le verdict, celui qu'il avait entendu.

Sa première reprise rallongeait et enrichissait le son, mais gardait **deux notes** : « c'est mieux
mais ça fait toujours un peu une cloche d'ascenseur ». Le diagnostic est juste — deux hauteurs définies
et un intervalle s'écoutent comme une mélodie, et un timbre frappé qui joue une mélodie, c'est un
carillon. Le verdict refait en **objet** a ensuite été validé (« oui c'est mieux le son »), et le
principe a été appliqué aux quatre autres : **chaque son est un objet du Bureau, jamais une note**.

Concrètement, et c'est écrit en commentaire au-dessus du générateur du verdict, avec ses sources :

- on **filtre du bruit dans le temps** (van den Doel & Pai 1998 ; NoiseBandNet ; Farnell 2010) au lieu
  d'empiler des oscillateurs ;
- on entend un **événement et une source**, pas des hauteurs (Rocchesso & Fontana, *The Sounding
  Object*, 2003) ;
- le papier est un squelette de **micro-flambages** (Zheng & James 2016), le frottement une myriade de
  **micro-contacts** qui tend vers du bruit coloré (DAFx-15) ;
- aucune hauteur **tenue** nulle part : les seules sinusoïdes qui restent sont des masses graves qui
  meurent en 30 ms — un « toc », pas une note.

Le test le vérifie maintenant pour les cinq : une **autocorrélation** (signal pré-accentué) mesure la
périodicité, et un son qui se répète est refusé. Les anciens fichiers donnaient 0,97 à 1,00 sur la
Pression, le Craquage et l'Intervention ; les nouveaux restent sous 0,2.

| Son | avant | aujourd'hui |
|---|---|---|
| `arrivage` | 0,92 s, finissait sur un **pop sinusoïdal** (190 → 70 Hz) | 0,95 s : grains du film, déchirure, **claquement du film** (8 ms de bruit large), **souffle** de l'air qui se dégonfle (bruit grave, turbulence) |
| `pression` | 0,34 s, **glissando** de 150 à 55 Hz sur 160 ms | 0,32 s : claquement, **masse** 110 → 75 Hz qui meurt en 30 ms, puis le **frottement de la manche** (grains de bruit 0,7–2,5 kHz) |
| `craquage` | 0,62 s, **chute sinusoïdale** de 120 à 42 Hz | 0,75 s : trois grains, **rupture de fibres** (crépitement 2,6–7 kHz), **carton qui se déchire** (bande large arrachée par paquets) |
| `intervention` | 0,50 s, **deux notes montantes** de vibraphone (523 et 784 Hz) | 0,50 s : **tampon de caoutchouc** (impact mou, masse amortie) puis **trait de stylo** (grains serrés 2–5 kHz, plus appuyé au milieu) |
| `verdict` | 0,78 s, deux notes descendantes | 1,45 s : tampon + froissement, puis tiroir : glissement et butée |

Rien de tiers : l'impulsion de réverbération est fabriquée par le générateur (graine fixe), il n'y a
**ni fichier d'IR ni plugin**, et le générateur reste **seedé** — deux exécutions donnent le fichier au
bit près. La phase des glissandos est **intégrée** (une fréquence écrite dans `Math.sin(2π f(t) t)`
déphase). Chaque son reçoit une **ambiance courte** (0,35 s, mélange 0,1 à 0,18) : un objet dans une
pièce, pas une salle de concert ; sa sortie se fond sur 50 à 140 ms selon qu'il finit sur un impact ou
sur une queue. Les cinq se régénèrent en moins d'une seconde.

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
s'écoute. Depuis #606, **les cinq** y ont leurs gardes, une par son : durée dans sa fourchette, du
signal encore présent à 60 % de la durée et une fin qui s'éteint, **deux générations identiques**, le
`.wav` du dépôt **égal aux octets que le générateur produit** (un fichier retouché à la main, ou un
générateur modifié sans régénérer, fait échouer le test), et **aucune périodicité** : un son qui se
répète est un carillon et se refuse.

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
- **Le précache est fait** (depuis #414, phrase corrigée à la revue du 29/10) : les cinq WAV sont
  dans le service worker — `globPatterns` de `vite.config.ts` porte `wav` — et
  `scripts/gardes/precache.test.ts` refuse un fichier de `public/` que le jeu charge sans le servir
  hors ligne. Ce qui reste vrai : un son qui ne se décode pas ne casse rien, et le module se
  tait alors, sans erreur.
