# Illustrations — la planche **Portrait** (les cartes de base)

> **Première passe, sans curation fine** (Q16, D-007 : IA + curation). Les dix images
> ci-dessous valident la chaîne à l'échelle avant le reste du set. Graine notée par carte
> pour être reproductible (`DESIGN.md` §6.5).
>
> Les trois planches s'appellent désormais **Portrait / Objet / Lieu** (#121) : ce dossier
> tient le **registre** des images produites, `SUJETS-flow.md` les **sujets** (une ligne par
> carte de base) et `ACCENTS-flow.md` l'**accent par faction** (D-046).

- **Modèle** : Space Hugging Face `mcp-tools/FLUX.1-Krea-dev`, 1024×1024,
  `num_inference_steps` 24, `guidance_scale` 4.5.
- **Socle commun** (collé avant chaque sujet) :
  > Editorial corporate dark-premium trading-card illustration, semi-realistic painterly
  > rendering, late-day office lighting, satirical but never mean mood. Subject waist-up,
  > centered, isolated on a darker background, deep midnight-blue palette, single warm gold
  > rim light, one muted saturated faction accent, subtle film grain, matte surfaces,
  > square 1:1. No text, no logo, no watermark, no real person.
  >
  > ⚠️ **Défaut constaté** : ce socle ne demande qu'un **contre-jour**, d'où des **visages trop
  > sombres**. La version corrigée (`DESIGN.md` §6.1) impose une **lumière principale sur le
  > visage**. Les 8 images ci-dessous sont donc à **regénérer** avec elle.

## Cartes produites

| Carte (`id`) | Faction | Sujet | Graine | Fichier |
|---|---|---|---|---|
| `sse-medecin-travail` | SSE | médecin du travail, blouse, porte-bloc | `37109154` | `sse-medecin-travail.webp` |
| `management-responsable-unite` | Management | responsable d'unité, porte-bloc, sourire en coin | `1323131255` | `management-responsable-unite.webp` |
| `qvt-chief-happiness-officer` | QVT | chief happiness officer, ballons et autocollants | `753916529` | `qvt-chief-happiness-officer.webp` |
| `amelioration-directeur-qualite` | Amélioration continue | directeur qualité, classeur de procédures | `1325355317` | `amelioration-directeur-qualite.webp` |
| `rh-drh` | RH | DRH devant un organigramme | `245800676` | `rh-drh.webp` |
| `atelier-chef-atelier` | Atelier | chef d'atelier, combinaison tachée, clé | `1491963894` | `atelier-chef-atelier.webp` |
| `syndicat-secretaire-general` | Syndicat | secrétaire général, fanion et insigne | `0` | `syndicat-secretaire-general.webp` |
| `interim-interimaire-legendaire-ex` | Intérim | intérimaire légendaire, badges empilés, tasse | `625426660` | `interim-interimaire-legendaire-ex.webp` |

## Reste à produire — les cartes de base sans illustration

Les **dix cartes signature sont produites** (voir le journal, en bas). Les autres cartes de
base restent à faire : `npm run status` en donne le compte (`cards`), et la liste des lignes
de sujets est celle de **`SUJETS-flow.md`**.

## Les variantes — une planche chacune, à leur tour (D-139)

Une variante **ne recopie plus** l'illustration de sa base. `secretVariant`
(`src/data/planque.ts`) écarte `art`, une variante qui a sa planche la **déclare**
(`art: '<son id>.webp'`, cinquième argument de `secretVariant`), et l'écran résout le
repli quand elle n'en a pas encore : `artFileOf` (`src/art.ts`) rend l'image de
`variantOf`, ou rien si la base non plus n'en a pas. `src/data/art.test.ts` garde les
trois règles — l'image porte l'**id de la carte qui la déclare**, aucune orpheline, et le
gabarit (carré, ≥ 1024 px, < 1 Mo).

**L'ordre de D-126 ne change pas** : les bases, puis les **sept variantes hautes**
(4 × `3S`, 3 × `COU`), puis les `1S`/`2S`. Une variante **n'a pas de ligne de sujet à
elle** : elle emprunte celui de sa base (`base_de_variante` dans
`scripts/illustration-vague.sh`), et le wizard accepte donc son id.

| Variante (`id`) | Rareté | Base | État |
|---|---|---|---|
| `sse-medecin-travail-star3` | `3S` | `sse-medecin-travail` | **produite** — graine `0` |
| `amelioration-directeur-qualite-star3` | `3S` | `amelioration-directeur-qualite` | **produite** — graine `125557385` |
| `qvt-chief-happiness-officer-star3` | `3S` | `qvt-chief-happiness-officer` | **produite** — graine `1626243013` |
| `atelier-responsable-process-star3` | `3S` | `atelier-responsable-process` | **produite** — graine `0` |
| `rh-drh-crown` | `COU` | `rh-drh` | à produire |
| `direction-pdg-crown` | `COU` | `direction-pdg` | à produire |
| `syndicat-secretaire-general-crown` | `COU` | `syndicat-secretaire-general` | à produire |

Les **68 autres variantes** n'ont pas encore de planche : elles affichent celle de leur
base, par résolution (D-139), et `npm run status` ne les compte pas comme manquantes.

Pour ces cartes, **le sujet et l'accent sont désormais écrits**, et l'obstacle ouvert de #97
est levé par #121 :

- **le sujet**, une ligne par carte de base, dans **`SUJETS-flow.md`** (Q10, planche
  Portrait ; les cartes Action en objet unique, planche Objet) ;
- **l'accent**, une ligne par faction, dans **`ACCENTS-flow.md`** : `FACTION_META.color`
  reste la seule source, l'accent en est **ré-dérivé** et la dérivation est **testée**, donc
  une couleur qui bouge sans son mot fait échouer la garde (D-046) ;
- **la garde** qui vérifie les deux tables, dans `scripts/illustration-vague.test.ts`. Elle
  remplace le second rôle de #120 (comparer deux copies) : la source unique a supprimé la
  seconde copie, il restait à vérifier que **chaque** carte de base a un sujet utilisable.

## À curer

Ce qui reste **assumé** après le passage du 21/10/2026, où le set des 10 signature a été refait
avec le socle corrigé (`DESIGN.md` §6.1) :

- **Texte parasite** : les 8 rendus du 20/10 en portaient du **lisible** (« HAPPINESS », « HR »,
  « PROCÉDURE »). Les 10 rendus du 21/10 n'en montrent **aucun lisible** — mais c'est un jugement
  **sur vignettes**, pas un audit au plein format : à revérifier à la taille réelle avant de le
  déclarer réglé.
- **Le négatif du socle n'est pas transmis** : `gflow image t2i` n'a **aucune** option de prompt
  négatif (vérifié, `--help` n'en liste pas). Le « no text, no logo » ne tient donc que par le
  socle **positif** — et il devra tenir sur **toutes** les cartes restantes.
- **Style** : le rendu reste **illustré-peint**, pas « semi-réaliste » au sens strict ; à
  resserrer avec des prompts plus contraints.
- Les **10** images sont **branchées** : les cartes portent `art: '<id>.webp'` (`src/data/*.ts`)
  et `CardView` les sert **depuis ce registre**, par `src/art.ts` (Vite, D-045).

## Une seule source — ce dossier, et Vite s'occupe du reste (D-045, exécutée le 21/10/2026)

**Ce dossier est la seule copie.** `src/art.ts` les embarque dans le graphe de modules
(`import.meta.glob('../design/illustrations/*.webp', { eager: true, query: '?url' })`) : Vite
calcule une empreinte, l'écrit dans `dist/assets/` et le service worker les **précache**
(`vite.config.ts`). Une regénération faite ici **change l'écran au build suivant**, sans étape
de copie.

Ce qui a disparu avec cette exécution : la copie `public/design/illustrations/`, et
`scripts/illustrations-servies.test.ts` (#120) qui comparait les deux. Son rôle est repris par
`src/data/art.test.ts` : fichier présent, nom = id de la carte de base, aucune orpheline, et
**résolution par le glob de `src/art.ts`** — une image que Vite ne voit pas fait échouer le test
au lieu d'afficher un aplat en silence. Le champ `art` reste le **nom de fichier**
(`art: 'x.webp'`) : c'est une donnée, la résolution en URL vit dans `src/art.ts`.

## Journal des productions

> Tenu par `scripts/illustration-vague.sh` : une ligne par image produite ou
> regénérée, la plus récente en bas. Les deux tableaux ci-dessus sont
> l'instantané du 20/10/2026 ; **ce journal est le registre vivant**.

- 2026-10-21 · `direction-pdg` · modèle `NARWHAL` · graine `147016633` · `direction-pdg.webp`
- 2026-10-21 · `direction-pdg` · modèle `NARWHAL` · graine `1180968490` · `direction-pdg.webp`
- 2026-10-21 · `sse-medecin-travail` · modèle `NARWHAL` · graine `37109154` · `sse-medecin-travail.webp`
- 2026-10-21 · `management-responsable-unite` · modèle `NARWHAL` · graine `1323131255` · `management-responsable-unite.webp`
- 2026-10-21 · `qvt-chief-happiness-officer` · modèle `NARWHAL` · graine `1867736723` · `qvt-chief-happiness-officer.webp`
- 2026-10-21 · `amelioration-directeur-qualite` · modèle `NARWHAL` · graine `1325355317` · `amelioration-directeur-qualite.webp`
- 2026-10-21 · `rh-drh` · modèle `NARWHAL` · graine `245800676` · `rh-drh.webp`
- 2026-10-21 · `atelier-chef-atelier` · modèle `NARWHAL` · graine `1491963894` · `atelier-chef-atelier.webp`
- 2026-10-21 · `syndicat-secretaire-general` · modèle `NARWHAL` · graine `1286126774` · `syndicat-secretaire-general.webp`
- 2026-10-21 · `interim-interimaire-legendaire-ex` · modèle `NARWHAL` · graine `64234642` · `interim-interimaire-legendaire-ex.webp`
- 2026-10-21 · `support-responsable-support` · modèle `NARWHAL` · graine `1602293889` · `support-responsable-support.webp`
- 2026-10-23 · `atelier-cariste` · modèle `NARWHAL` · graine `855092096` · `atelier-cariste.webp`
- 2026-10-23 · `atelier-agent-maintenance` · modèle `NARWHAL` · graine `817102270` · `atelier-agent-maintenance.webp`
- 2026-10-23 · `atelier-apprenti` · modèle `NARWHAL` · graine `1269307281` · `atelier-apprenti.webp`
- 2026-10-23 · `atelier-ascensoriste` · modèle `NARWHAL` · graine `108373685` · `atelier-ascensoriste.webp`
- 2026-10-23 · `atelier-chaudronnier` · modèle `NARWHAL` · graine `1680784274` · `atelier-chaudronnier.webp`
- 2026-10-23 · `atelier-chef-chantier` · modèle `NARWHAL` · graine `904545382` · `atelier-chef-chantier.webp`
- 2026-10-23 · `atelier-chef-quai` · modèle `NARWHAL` · graine `1182393630` · `atelier-chef-quai.webp`
- 2026-10-23 · `atelier-chef-usine` · modèle `NARWHAL` · graine `53907753` · `atelier-chef-usine.webp`
- 2026-10-23 · `atelier-colle-cyanoacrylate` · modèle `NARWHAL` · graine `1771054972` · `atelier-colle-cyanoacrylate.webp`
- 2026-10-23 · `atelier-depanneur-ascenseur` · modèle `NARWHAL` · graine `1777370118` · `atelier-depanneur-ascenseur.webp`
- 2026-10-23 · `atelier-electromecanicien` · modèle `NARWHAL` · graine `1305519589` · `atelier-electromecanicien.webp`
- 2026-10-23 · `atelier-gardien-usine` · modèle `NARWHAL` · graine `577424390` · `atelier-gardien-usine.webp`
- 2026-10-23 · `atelier-mecanicien` · modèle `NARWHAL` · graine `634535575` · `atelier-mecanicien.webp`
- 2026-10-23 · `atelier-mecanicien-outilleur` · modèle `NARWHAL` · graine `946444457` · `atelier-mecanicien-outilleur.webp`
- 2026-10-23 · `atelier-responsable-maintenance` · modèle `NARWHAL` · graine `285033754` · `atelier-responsable-maintenance.webp`
- 2026-10-23 · `atelier-responsable-maintenance-ex` · modèle `NARWHAL` · graine `1342008719` · `atelier-responsable-maintenance-ex.webp`
- 2026-10-23 · `atelier-soudeur` · modèle `NARWHAL` · graine `808198557` · `atelier-soudeur.webp`
- 2026-10-23 · `atelier-soudeur-tig` · modèle `NARWHAL` · graine `1458940824` · `atelier-soudeur-tig.webp`
- 2026-10-23 · `atelier-stagiaire-atelier` · modèle `NARWHAL` · graine `2131532165` · `atelier-stagiaire-atelier.webp`
- 2026-10-23 · `atelier-technicien-maintenance` · modèle `NARWHAL` · graine `520484527` · `atelier-technicien-maintenance.webp`
- 2026-10-23 · `atelier-tuyauteur` · modèle `NARWHAL` · graine `670271306` · `atelier-tuyauteur.webp`
- 2026-10-23 · `atelier-chef-atelier-ex` · modèle `NARWHAL` · graine `696438935` · `atelier-chef-atelier-ex.webp`
- 2026-10-23 · `atelier-chef-fabrication` · modèle `NARWHAL` · graine `1740965193` · `atelier-chef-fabrication.webp`
- 2026-10-23 · `atelier-electricien` · modèle `NARWHAL` · graine `20706407` · `atelier-electricien.webp`
- 2026-10-23 · `atelier-magasinier` · modèle `NARWHAL` · graine `920619018` · `atelier-magasinier.webp`
- 2026-10-23 · `atelier-plombier` · modèle `NARWHAL` · graine `1968322662` · `atelier-plombier.webp`
- 2026-10-25 · `atelier-joueur-de-flute` · modèle `NARWHAL` · graine `1774845045` · `atelier-joueur-de-flute.webp`
- 2026-10-25 · `atelier-technicien-systeme` · modèle `NARWHAL` · graine `1173674108` · `atelier-technicien-systeme.webp`
- 2026-10-25 · `atelier-responsable-process` · modèle `NARWHAL` · graine `0` · `atelier-responsable-process.webp`
- 2026-10-25 · `atelier-opticien` · modèle `NARWHAL` · graine `193387012` · `atelier-opticien.webp`
- 2026-10-25 · `atelier-rpo` · modèle `NARWHAL` · graine `1985142519` · `atelier-rpo.webp`
- 2026-10-25 · `atelier-rui` · modèle `NARWHAL` · graine `184406824` · `atelier-rui.webp`
- 2026-10-25 · `atelier-regleur` · modèle `NARWHAL` · graine `1540639500` · `atelier-regleur.webp`
- 2026-10-25 · `atelier-rpi` · modèle `NARWHAL` · graine `294548429` · `atelier-rpi.webp`
- 2026-10-25 · `atelier-responsable-flux` · modèle `NARWHAL` · graine `256808332` · `atelier-responsable-flux.webp`
- 2026-10-25 · `atelier-controleur-vibration` · modèle `NARWHAL` · graine `525769957` · `atelier-controleur-vibration.webp`
- 2026-10-25 · `atelier-responsable-qualite` · modèle `NARWHAL` · graine `1877553856` · `atelier-responsable-qualite.webp`
- 2026-10-25 · `atelier-gestionnaire-fod` · modèle `NARWHAL` · graine `1545102572` · `atelier-gestionnaire-fod.webp`
- 2026-10-25 · `atelier-monteur-optique` · modèle `NARWHAL` · graine `772722532` · `atelier-monteur-optique.webp`
- 2026-10-25 · `atelier-technicien-banc-essai` · modèle `NARWHAL` · graine `1559366559` · `atelier-technicien-banc-essai.webp`
- 2026-10-25 · `atelier-pointeur` · modèle `NARWHAL` · graine `648577339` · `atelier-pointeur.webp`
- 2026-10-25 · `atelier-ordonnanceur` · modèle `NARWHAL` · graine `178140847` · `atelier-ordonnanceur.webp`
- 2026-10-25 · `atelier-responsable-pole` · modèle `NARWHAL` · graine `1780180417` · `atelier-responsable-pole.webp`
- 2026-10-25 · `atelier-cariste-salle-blanche` · modèle `NARWHAL` · graine `535644421` · `atelier-cariste-salle-blanche.webp`
- 2026-10-25 · `atelier-planificateur-moyens-essai` · modèle `NARWHAL` · graine `0` · `atelier-planificateur-moyens-essai.webp`
- 2026-10-25 · `atelier-assistant-rpo` · modèle `NARWHAL` · graine `1938995381` · `atelier-assistant-rpo.webp`
- 2026-10-25 · `atelier-rpo-sans-rui-ex` · modèle `NARWHAL` · graine `906846156` · `atelier-rpo-sans-rui-ex.webp`
- 2026-10-25 · `atelier-rui-non-toxique-ex` · modèle `NARWHAL` · graine `281151880` · `atelier-rui-non-toxique-ex.webp`
- 2026-10-25 · `amelioration-auditeur-interne` · modèle `NARWHAL` · graine `1618354785` · `amelioration-auditeur-interne.webp`
- 2026-10-25 · `amelioration-auditeur-qualite` · modèle `NARWHAL` · graine `1443224453` · `amelioration-auditeur-qualite.webp`
- 2026-10-25 · `amelioration-baie-test` · modèle `NARWHAL` · graine `957181945` · `amelioration-baie-test.webp`
- 2026-10-25 · `amelioration-charge-amelioration` · modèle `NARWHAL` · graine `731788735` · `amelioration-charge-amelioration.webp`
- 2026-10-25 · `amelioration-charge-process` · modèle `NARWHAL` · graine `0` · `amelioration-charge-process.webp`
- 2026-10-25 · `amelioration-charge-qualite` · modèle `NARWHAL` · graine `1680830631` · `amelioration-charge-qualite.webp`
- 2026-10-25 · `amelioration-chef-projet-qualite` · modèle `NARWHAL` · graine `435525909` · `amelioration-chef-projet-qualite.webp`
- 2026-10-25 · `amelioration-consultant-lean` · modèle `NARWHAL` · graine `1887850950` · `amelioration-consultant-lean.webp`
- 2026-10-25 · `amelioration-controleur-qualite` · modèle `NARWHAL` · graine `1356296834` · `amelioration-controleur-qualite.webp`
- 2026-10-25 · `amelioration-directeur-audit-interne` · modèle `NARWHAL` · graine `531076374` · `amelioration-directeur-audit-interne.webp`
- 2026-10-25 · `amelioration-directeur-flux` · modèle `NARWHAL` · graine `1999713236` · `amelioration-directeur-flux.webp`
- 2026-10-25 · `amelioration-directeur-qualite-ex` · modèle `NARWHAL` · graine `2083091780` · `amelioration-directeur-qualite-ex.webp`
- 2026-10-25 · `amelioration-gestionnaire-flux` · modèle `NARWHAL` · graine `0` · `amelioration-gestionnaire-flux.webp`
- 2026-10-25 · `amelioration-responsable-amelioration-continue` · modèle `NARWHAL` · graine `1077695530` · `amelioration-responsable-amelioration-continue.webp`
- 2026-10-25 · `amelioration-responsable-audit` · modèle `NARWHAL` · graine `223714700` · `amelioration-responsable-audit.webp`
- 2026-10-25 · `amelioration-responsable-flux` · modèle `NARWHAL` · graine `220166973` · `amelioration-responsable-flux.webp`
- 2026-10-25 · `amelioration-responsable-process` · modèle `NARWHAL` · graine `1720132821` · `amelioration-responsable-process.webp`
- 2026-10-25 · `amelioration-reunion-de-suivi` · modèle `NARWHAL` · graine `1227568162` · `amelioration-reunion-de-suivi.webp`
- 2026-10-25 · `amelioration-stagiaire-qualite` · modèle `NARWHAL` · graine `1367065958` · `amelioration-stagiaire-qualite.webp`
- 2026-10-25 · `direction-assistant-direction` · modèle `NARWHAL` · graine `1662386644` · `direction-assistant-direction.webp`
- 2026-10-25 · `direction-auditeur-interne` · modèle `NARWHAL` · graine `1811249482` · `direction-auditeur-interne.webp`
- 2026-10-25 · `direction-chef-cabinet` · modèle `NARWHAL` · graine `1629217055` · `direction-chef-cabinet.webp`
- 2026-10-25 · `direction-chef-projet-fantome` · modèle `NARWHAL` · graine `1609260917` · `direction-chef-projet-fantome.webp`
- 2026-10-25 · `direction-commissaire-comptes` · modèle `NARWHAL` · graine `1508353272` · `direction-commissaire-comptes.webp`
- 2026-10-25 · `direction-directeur-adjoint` · modèle `NARWHAL` · graine `538155204` · `direction-directeur-adjoint.webp`
- 2026-10-25 · `direction-directeur-cabinet` · modèle `NARWHAL` · graine `1874062206` · `direction-directeur-cabinet.webp`
- 2026-10-25 · `direction-directeur-fantome` · modèle `NARWHAL` · graine `1469060728` · `direction-directeur-fantome.webp`
- 2026-10-26 · `atelier-rpo` · modèle `NARWHAL` · graine `2145855204` · `atelier-rpo.webp`
- 2026-10-26 · `interim-interimaire-legendaire-ex` · modèle `NARWHAL` · graine `625426660` · `interim-interimaire-legendaire-ex.webp`
- 2026-10-26 · `qvt-chief-happiness-officer` · modèle `NARWHAL` · graine `753916529` · `qvt-chief-happiness-officer.webp`
- 2026-10-26 · `atelier-monteur-optique` · modèle `NARWHAL` · graine `372913666` · `atelier-monteur-optique.webp`
- 2026-10-26 · `direction-chef-projet-fantome` · modèle `NARWHAL` · graine `970851615` · `direction-chef-projet-fantome.webp`
- 2026-10-26 · `direction-directeur-programme` · modèle `NARWHAL` · graine `1171561158` · `direction-directeur-programme.webp`
- 2026-10-26 · `amelioration-consultant-lean` · modèle `NARWHAL` · graine `0` · `amelioration-consultant-lean.webp`
- 2026-10-26 · `atelier-assistant-rpo` · modèle `NARWHAL` · graine `0` · `atelier-assistant-rpo.webp`
- 2026-10-26 · `direction-commissaire-comptes` · modèle `NARWHAL` · graine `287771641` · `direction-commissaire-comptes.webp`
- 2026-10-26 · `amelioration-responsable-audit` · modèle `NARWHAL` · graine `1345033703` · `amelioration-responsable-audit.webp`
- 2026-10-26 · `atelier-cariste-salle-blanche` · modèle `NARWHAL` · graine `1941297743` · `atelier-cariste-salle-blanche.webp`
- 2026-10-26 · `syndicat-secretaire-general` · modèle `NARWHAL` · graine `0` · `syndicat-secretaire-general.webp`
- 2026-10-26 · `direction-directeur-general` · modèle `NARWHAL` · graine `1341221641` · `direction-directeur-general.webp`
- 2026-10-26 · `direction-directeur-regional` · modèle `NARWHAL` · graine `1205583550` · `direction-directeur-regional.webp`
- 2026-10-26 · `direction-directeur-strategie` · modèle `NARWHAL` · graine `1116640585` · `direction-directeur-strategie.webp`
- 2026-10-26 · `direction-pdg-ex` · modèle `NARWHAL` · graine `2060482869` · `direction-pdg-ex.webp`
- 2026-10-26 · `direction-reunion-qui-aurait-pu-etre-un-mail` · modèle `NARWHAL` · graine `517501058` · `direction-reunion-qui-aurait-pu-etre-un-mail.webp`
- 2026-10-26 · `direction-secretaire-direction` · modèle `NARWHAL` · graine `515102296` · `direction-secretaire-direction.webp`
- 2026-10-26 · `direction-stagiaire-direction` · modèle `NARWHAL` · graine `124366703` · `direction-stagiaire-direction.webp`
- 2026-10-26 · `interim-chef-equipe-interimaire` · modèle `NARWHAL` · graine `841156955` · `interim-chef-equipe-interimaire.webp`
- 2026-10-26 · `interim-consultant-interimaire` · modèle `NARWHAL` · graine `1903070890` · `interim-consultant-interimaire.webp`
- 2026-10-26 · `interim-interimaire` · modèle `NARWHAL` · graine `1226904695` · `interim-interimaire.webp`
- 2026-10-26 · `interim-interimaire-confirme` · modèle `NARWHAL` · graine `2109671951` · `interim-interimaire-confirme.webp`
- 2026-10-26 · `interim-responsable-interim` · modèle `NARWHAL` · graine `1333634933` · `interim-responsable-interim.webp`
- 2026-10-26 · `management-animateur-equipe` · modèle `NARWHAL` · graine `8802758` · `management-animateur-equipe.webp`
- 2026-10-26 · `management-assistant-manager` · modèle `NARWHAL` · graine `1940873143` · `management-assistant-manager.webp`
- 2026-10-26 · `management-charge-affaires` · modèle `NARWHAL` · graine `2037215949` · `management-charge-affaires.webp`
- 2026-10-26 · `management-chargee-clientele` · modèle `NARWHAL` · graine `942910467` · `management-chargee-clientele.webp`
- 2026-10-26 · `management-chef-de-projet` · modèle `NARWHAL` · graine `0` · `management-chef-de-projet.webp`
- 2026-10-26 · `management-chef-equipe` · modèle `NARWHAL` · graine `2144482526` · `management-chef-equipe.webp`
- 2026-10-26 · `management-chef-service` · modèle `NARWHAL` · graine `914289414` · `management-chef-service.webp`
- 2026-10-26 · `management-controleur-gestion` · modèle `NARWHAL` · graine `394507087` · `management-controleur-gestion.webp`
- 2026-10-26 · `management-directeur-production` · modèle `NARWHAL` · graine `1616246975` · `management-directeur-production.webp`
- 2026-10-26 · `management-directeur-projet` · modèle `NARWHAL` · graine `110149105` · `management-directeur-projet.webp`
- 2026-10-26 · `management-directeur-service` · modèle `NARWHAL` · graine `1363119885` · `management-directeur-service.webp`
- 2026-10-26 · `management-entretien-annuel` · modèle `NARWHAL` · graine `419644616` · `management-entretien-annuel.webp`
- 2026-10-26 · `management-jeune-manager` · modèle `NARWHAL` · graine `1089462067` · `management-jeune-manager.webp`
- 2026-10-26 · `management-manager-proximite` · modèle `NARWHAL` · graine `1044749969` · `management-manager-proximite.webp`
- 2026-10-26 · `atelier-responsable-pole` · modèle `NARWHAL` · graine `1800782826` · `atelier-responsable-pole.webp`
- 2026-10-26 · `atelier-opticien` · modèle `NARWHAL` · graine `1117579981` · `atelier-opticien.webp`
- 2026-10-26 · `management-manager-proximite` · modèle `NARWHAL` · graine `765017061` · `management-manager-proximite.webp`
- 2026-10-26 · `management-planificateur` · modèle `NARWHAL` · graine `1066042138` · `management-planificateur.webp`
- 2026-10-26 · `management-responsable-commercial` · modèle `NARWHAL` · graine `1140188548` · `management-responsable-commercial.webp`
- 2026-10-26 · `management-responsable-production` · modèle `NARWHAL` · graine `1791316937` · `management-responsable-production.webp`
- 2026-10-26 · `management-responsable-projet` · modèle `NARWHAL` · graine `1392703815` · `management-responsable-projet.webp`
- 2026-10-26 · `management-responsable-unite-ex` · modèle `NARWHAL` · graine `731097540` · `management-responsable-unite-ex.webp`
- 2026-10-26 · `management-superviseur` · modèle `NARWHAL` · graine `1382980626` · `management-superviseur.webp`
- 2026-10-26 · `management-technico-commercial` · modèle `NARWHAL` · graine `23997326` · `management-technico-commercial.webp`
- 2026-10-26 · `qvt-charge-mission` · modèle `NARWHAL` · graine `1103279242` · `qvt-charge-mission.webp`
- 2026-10-26 · `qvt-animateur-bien-etre` · modèle `NARWHAL` · graine `951272960` · `qvt-animateur-bien-etre.webp`
- 2026-10-26 · `qvt-gestionnaire-moyens-generaux` · modèle `NARWHAL` · graine `980123084` · `qvt-gestionnaire-moyens-generaux.webp`
- 2026-10-26 · `qvt-assistant-qvt` · modèle `NARWHAL` · graine `1777590231` · `qvt-assistant-qvt.webp`
- 2026-10-26 · `qvt-charge-communication-interne` · modèle `NARWHAL` · graine `2135054538` · `qvt-charge-communication-interne.webp`
- 2026-10-26 · `qvt-charge-engagement` · modèle `NARWHAL` · graine `586325096` · `qvt-charge-engagement.webp`
- 2026-10-26 · `qvt-charge-evenements-internes` · modèle `NARWHAL` · graine `1004930846` · `qvt-charge-evenements-internes.webp`
- 2026-10-26 · `qvt-charge-formation` · modèle `NARWHAL` · graine `0` · `qvt-charge-formation.webp`
- 2026-10-26 · `qvt-charge-integration` · modèle `NARWHAL` · graine `1346776538` · `qvt-charge-integration.webp`
- 2026-10-26 · `qvt-charge-mobilite-interne` · modèle `NARWHAL` · graine `1398387937` · `qvt-charge-mobilite-interne.webp`
- 2026-10-26 · `support-formateur-informatique` · modèle `(non rapporté)` · graine `1249415241` · `support-formateur-informatique.webp`
- 2026-10-26 · `support-charge-formation-informatique` · modèle `(non rapporté)` · graine `1775066881` · `support-charge-formation-informatique.webp`
- 2026-10-26 · `support-gestionnaire-tickets` · modèle `(non rapporté)` · graine `1914757264` · `support-gestionnaire-tickets.webp`
- 2026-10-26 · `support-superviseur-support` · modèle `(non rapporté)` · graine `590216100` · `support-superviseur-support.webp`
- 2026-10-26 · `support-assistant-administratif` · modèle `(non rapporté)` · graine `575486869` · `support-assistant-administratif.webp`
- 2026-10-26 · `support-archiviste` · modèle `(non rapporté)` · graine `1722612233` · `support-archiviste.webp`
- 2026-10-26 · `support-receptionniste` · modèle `(non rapporté)` · graine `336538230` · `support-receptionniste.webp`
- 2026-10-26 · `support-teleconseiller` · modèle `(non rapporté)` · graine `1933636218` · `support-teleconseiller.webp`
- 2026-10-26 · `support-operateur-saisie` · modèle `(non rapporté)` · graine `2027174582` · `support-operateur-saisie.webp`
- 2026-10-26 · `support-testeur-logiciel` · modèle `(non rapporté)` · graine `525168385` · `support-testeur-logiciel.webp`
- 2026-10-26 · `support-coordinateur-support` · modèle `(non rapporté)` · graine `1070653672` · `support-coordinateur-support.webp`
- 2026-10-26 · `support-ingenieur-systemes-ex` · modèle `(non rapporté)` · graine `633800804` · `support-ingenieur-systemes-ex.webp`
- 2026-10-26 · `sse-trousse-secours` · modèle `(non rapporté)` · graine `2105434474` · `sse-trousse-secours.webp`
- 2026-10-26 · `sse-visite-medicale` · modèle `(non rapporté)` · graine `1609210040` · `sse-visite-medicale.webp`
- 2026-10-26 · `qvt-yoga-du-rire` · modèle `(non rapporté)` · graine `311265964` · `qvt-yoga-du-rire.webp`
- 2026-10-26 · `rh-reunion-individuelle` · modèle `(non rapporté)` · graine `646484866` · `rh-reunion-individuelle.webp`
- 2026-10-26 · `syndicat-assemblee-generale` · modèle `(non rapporté)` · graine `554930545` · `syndicat-assemblee-generale.webp`
- 2026-10-26 · `support-escalade` · modèle `(non rapporté)` · graine `1351603520` · `support-escalade.webp`
- 2026-10-26 · `sse-infirmier-site` · modèle `NARWHAL` · graine `1996000181` · `sse-infirmier-site.webp`
- 2026-10-26 · `sse-agent-entretien` · modèle `NARWHAL` · graine `504429746` · `sse-agent-entretien.webp`
- 2026-10-26 · `sse-responsable-hygiene` · modèle `NARWHAL` · graine `1414149807` · `sse-responsable-hygiene.webp`
- 2026-10-26 · `sse-psychologue` · modèle `NARWHAL` · graine `1996477746` · `sse-psychologue.webp`
- 2026-10-26 · `sse-psychiatre` · modèle `NARWHAL` · graine `230934166` · `sse-psychiatre.webp`
- 2026-10-26 · `sse-dieteticien` · modèle `NARWHAL` · graine `2072182062` · `sse-dieteticien.webp`
- 2026-10-26 · `sse-nutritionniste` · modèle `NARWHAL` · graine `111759318` · `sse-nutritionniste.webp`
- 2026-10-26 · `sse-interne` · modèle `NARWHAL` · graine `440775021` · `sse-interne.webp`
- 2026-10-26 · `sse-infirmier-volant` · modèle `NARWHAL` · graine `425075945` · `sse-infirmier-volant.webp`
- 2026-10-26 · `sse-pompier-volontaire` · modèle `NARWHAL` · graine `1300389456` · `sse-pompier-volontaire.webp`
- 2026-10-26 · `sse-medecin-sport` · modèle `NARWHAL` · graine `477016252` · `sse-medecin-sport.webp`
- 2026-10-26 · `sse-infirmiere-travail` · modèle `NARWHAL` · graine `inconnue` · `sse-infirmiere-travail.webp`
- 2026-10-26 · `sse-assistante-sociale` · modèle `NARWHAL` · graine `2011047310` · `sse-assistante-sociale.webp`
- 2026-10-26 · `sse-controleur-securite` · modèle `NARWHAL` · graine `1648653566` · `sse-controleur-securite.webp`
- 2026-10-26 · `sse-responsable-securite` · modèle `NARWHAL` · graine `1731238556` · `sse-responsable-securite.webp`
- 2026-10-26 · `sse-brancardier` · modèle `NARWHAL` · graine `2031291868` · `sse-brancardier.webp`
- 2026-10-26 · `sse-medecin-legiste` · modèle `NARWHAL` · graine `271366305` · `sse-medecin-legiste.webp`
- 2026-10-26 · `sse-medecin-chef-ex` · modèle `NARWHAL` · graine `1915987888` · `sse-medecin-chef-ex.webp`
- 2026-10-26 · `sse-responsable-sse-ex` · modèle `NARWHAL` · graine `2091460910` · `sse-responsable-sse-ex.webp`
- 2026-10-26 · `qvt-charge-qvt` · modèle `NARWHAL` · graine `636784913` · `qvt-charge-qvt.webp`
- 2026-10-26 · `qvt-happiness-manager` · modèle `NARWHAL` · graine `1869071018` · `qvt-happiness-manager.webp`
- 2026-10-26 · `qvt-responsable-qvt` · modèle `NARWHAL` · graine `1211799687` · `qvt-responsable-qvt.webp`
- 2026-10-26 · `sse-preventeur` · modèle `NARWHAL` · graine `1442381354` · `sse-preventeur.webp`
- 2026-10-26 · `qvt-directeur-qvt` · modèle `NARWHAL` · graine `73386662` · `qvt-directeur-qvt.webp`
- 2026-10-26 · `qvt-coach-sante` · modèle `NARWHAL` · graine `1457166030` · `qvt-coach-sante.webp`
- 2026-10-26 · `qvt-expert-bien-etre` · modèle `NARWHAL` · graine `1646181022` · `qvt-expert-bien-etre.webp`
- 2026-10-26 · `qvt-coordinateur-flux` · modèle `NARWHAL` · graine `930726807` · `qvt-coordinateur-flux.webp`
- 2026-10-26 · `qvt-optimiseur-process` · modèle `NARWHAL` · graine `1194212591` · `qvt-optimiseur-process.webp`
- 2026-10-26 · `qvt-referent-qvt` · modèle `NARWHAL` · graine `327947488` · `qvt-referent-qvt.webp`
- 2026-10-26 · `qvt-chef-projet-qvt` · modèle `NARWHAL` · graine `249367815` · `qvt-chef-projet-qvt.webp`
- 2026-10-26 · `qvt-facilitateur` · modèle `NARWHAL` · graine `1920660963` · `qvt-facilitateur.webp`
- 2026-10-26 · `qvt-charge-logistique` · modèle `NARWHAL` · graine `801915324` · `qvt-charge-logistique.webp`
- 2026-10-26 · `qvt-responsable-evenementiel` · modèle `NARWHAL` · graine `1619305344` · `qvt-responsable-evenementiel.webp`
- 2026-10-26 · `sse-ergonome` · modèle `NARWHAL` · graine `872998757` · `sse-ergonome.webp`
- 2026-10-26 · `qvt-charge-ergonomie` · modèle `NARWHAL` · graine `1042904757` · `qvt-charge-ergonomie.webp`
- 2026-10-26 · `qvt-charge-environnement-travail` · modèle `NARWHAL` · graine `1221958833` · `qvt-charge-environnement-travail.webp`
- 2026-10-26 · `qvt-masseur-kinesitherapeute` · modèle `NARWHAL` · graine `1378777933` · `qvt-masseur-kinesitherapeute.webp`
- 2026-10-26 · `qvt-responsable-integration` · modèle `NARWHAL` · graine `702428773` · `qvt-responsable-integration.webp`
- 2026-10-26 · `qvt-conseiller-evolution-professionnelle` · modèle `NARWHAL` · graine `1643723513` · `qvt-conseiller-evolution-professionnelle.webp`
- 2026-10-26 · `qvt-responsable-developpement-competences` · modèle `NARWHAL` · graine `762116932` · `qvt-responsable-developpement-competences.webp`
- 2026-10-26 · `qvt-consultant-qvt` · modèle `NARWHAL` · graine `692064143` · `qvt-consultant-qvt.webp`
- 2026-10-26 · `qvt-responsable-experience-collaborateur` · modèle `NARWHAL` · graine `1952402895` · `qvt-responsable-experience-collaborateur.webp`
- 2026-10-26 · `qvt-chef-projet-formation` · modèle `NARWHAL` · graine `1944062629` · `qvt-chef-projet-formation.webp`
- 2026-10-26 · `qvt-responsable-engagement` · modèle `NARWHAL` · graine `789062906` · `qvt-responsable-engagement.webp`
- 2026-10-26 · `sse-responsable-sse` · modèle `NARWHAL` · graine `inconnue` · `sse-responsable-sse.webp`
- 2026-10-26 · `sse-kine-travail` · modèle `NARWHAL` · graine `102598353` · `sse-kine-travail.webp`
- 2026-10-26 · `sse-sophrologue` · modèle `NARWHAL` · graine `inconnue` · `sse-sophrologue.webp`
- 2026-10-26 · `sse-medecin-chef` · modèle `NARWHAL` · graine `656526350` · `sse-medecin-chef.webp`
- 2026-10-26 · `sse-secouriste` · modèle `NARWHAL` · graine `708983124` · `sse-secouriste.webp`
- 2026-10-26 · `sse-chef-secours` · modèle `NARWHAL` · graine `944707797` · `sse-chef-secours.webp`
- 2026-10-26 · `qvt-chief-happiness-officer-ex` · modèle `NARWHAL` · graine `1313675490` · `qvt-chief-happiness-officer-ex.webp`
- 2026-10-26 · `rh-drh-formation` · modèle `NARWHAL` · graine `1766137504` · `rh-drh-formation.webp`
- 2026-10-26 · `rh-responsable-comp-ben` · modèle `NARWHAL` · graine `1151690933` · `rh-responsable-comp-ben.webp`
- 2026-10-26 · `rh-juriste-social` · modèle `NARWHAL` · graine `2100630764` · `rh-juriste-social.webp`
- 2026-10-26 · `rh-responsable-relations-sociales` · modèle `NARWHAL` · graine `1533868932` · `rh-responsable-relations-sociales.webp`
- 2026-10-26 · `rh-drh-juridique` · modèle `NARWHAL` · graine `1438963963` · `rh-drh-juridique.webp`
- 2026-10-26 · `rh-charge-diversite` · modèle `NARWHAL` · graine `324926702` · `rh-charge-diversite.webp`
- 2026-10-26 · `rh-responsable-inclusion` · modèle `NARWHAL` · graine `60320682` · `rh-responsable-inclusion.webp`
- 2026-10-26 · `rh-drh-diversite` · modèle `NARWHAL` · graine `1900706724` · `rh-drh-diversite.webp`
- 2026-10-26 · `rh-charge-mobilite` · modèle `NARWHAL` · graine `1974377056` · `rh-charge-mobilite.webp`
- 2026-10-26 · `rh-gestionnaire-rh` · modèle `NARWHAL` · graine `2045062528` · `rh-gestionnaire-rh.webp`
- 2026-10-26 · `qvt-charge-vie-associative` · modèle `NARWHAL` · graine `1418946954` · `qvt-charge-vie-associative.webp`
- 2026-10-26 · `rh-assistant-paie` · modèle `NARWHAL` · graine `1287176566` · `rh-assistant-paie.webp`
- 2026-10-26 · `rh-referent-handicap` · modèle `NARWHAL` · graine `1297022805` · `rh-referent-handicap.webp`
- 2026-10-26 · `rh-charge-prevention` · modèle `NARWHAL` · graine `inconnue` · `rh-charge-prevention.webp`
- 2026-10-26 · `rh-charge-offboarding` · modèle `NARWHAL` · graine `123743413` · `rh-charge-offboarding.webp`
- 2026-10-26 · `rh-charge-sirh` · modèle `NARWHAL` · graine `1689009905` · `rh-charge-sirh.webp`
- 2026-10-26 · `rh-drh-ex` · modèle `NARWHAL` · graine `1363638729` · `rh-drh-ex.webp`
- 2026-10-26 · `rh-directeur-talents-ex` · modèle `NARWHAL` · graine `1281496761` · `rh-directeur-talents-ex.webp`
- 2026-10-26 · `syndicat-delegue-personnel` · modèle `NARWHAL` · graine `1932516342` · `syndicat-delegue-personnel.webp`
- 2026-10-26 · `syndicat-representant-cse` · modèle `NARWHAL` · graine `2124298569` · `syndicat-representant-cse.webp`
- 2026-10-26 · `syndicat-secretaire-general-ex` · modèle `NARWHAL` · graine `1626378919` · `syndicat-secretaire-general-ex.webp`
- 2026-10-26 · `qvt-directeur-qvt-ex` · modèle `NARWHAL` · graine `1561382694` · `qvt-directeur-qvt-ex.webp`
- 2026-10-26 · `syndicat-tresorier-cse` · modèle `NARWHAL` · graine `549305371` · `syndicat-tresorier-cse.webp`
- 2026-10-26 · `syndicat-president-cse` · modèle `NARWHAL` · graine `1982256611` · `syndicat-president-cse.webp`
- 2026-10-26 · `support-agent-support` · modèle `NARWHAL` · graine `512869035` · `support-agent-support.webp`
- 2026-10-26 · `support-technicien-support` · modèle `NARWHAL` · graine `1427943675` · `support-technicien-support.webp`
- 2026-10-26 · `support-responsable-support-ex` · modèle `NARWHAL` · graine `1435446429` · `support-responsable-support-ex.webp`
- 2026-10-26 · `support-standardiste` · modèle `NARWHAL` · graine `207837385` · `support-standardiste.webp`
- 2026-10-26 · `support-assistant-direction` · modèle `NARWHAL` · graine `428491406` · `support-assistant-direction.webp`
- 2026-10-26 · `support-responsable-services-generaux` · modèle `NARWHAL` · graine `530022449` · `support-responsable-services-generaux.webp`
- 2026-10-26 · `support-technicien-micro-informatique` · modèle `NARWHAL` · graine `1153364131` · `support-technicien-micro-informatique.webp`
- 2026-10-26 · `support-administrateur-systemes` · modèle `NARWHAL` · graine `477687444` · `support-administrateur-systemes.webp`
- 2026-10-26 · `rh-assistant-rh` · modèle `NARWHAL` · graine `1203527069` · `rh-assistant-rh.webp`
- 2026-10-26 · `support-ingenieur-systemes` · modèle `NARWHAL` · graine `1636257269` · `support-ingenieur-systemes.webp`
- 2026-10-26 · `support-redacteur-technique` · modèle `NARWHAL` · graine `2109089677` · `support-redacteur-technique.webp`
- 2026-10-26 · `support-charge-documentation` · modèle `NARWHAL` · graine `294282726` · `support-charge-documentation.webp`
- 2026-10-26 · `support-responsable-documentation` · modèle `NARWHAL` · graine `1589950124` · `support-responsable-documentation.webp`
- 2026-10-26 · `support-technicien-reseau` · modèle `NARWHAL` · graine `834082219` · `support-technicien-reseau.webp`
- 2026-10-26 · `support-administrateur-reseau` · modèle `NARWHAL` · graine `937459968` · `support-administrateur-reseau.webp`
- 2026-10-26 · `support-correspondant-informatique` · modèle `NARWHAL` · graine `2075758151` · `support-correspondant-informatique.webp`
- 2026-10-26 · `support-referent-informatique` · modèle `NARWHAL` · graine `362395001` · `support-referent-informatique.webp`
- 2026-10-26 · `support-assistant-methodes` · modèle `NARWHAL` · graine `124808530` · `support-assistant-methodes.webp`
- 2026-10-26 · `support-technicien-methodes` · modèle `NARWHAL` · graine `73981734` · `support-technicien-methodes.webp`
- 2026-10-26 · `rh-charge-recrutement` · modèle `NARWHAL` · graine `124784565` · `rh-charge-recrutement.webp`
- 2026-10-26 · `rh-charge-sourcing` · modèle `NARWHAL` · graine `inconnue` · `rh-charge-sourcing.webp`
- 2026-10-26 · `rh-chasseur-tetes` · modèle `NARWHAL` · graine `224052294` · `rh-chasseur-tetes.webp`
- 2026-10-26 · `rh-directeur-talents` · modèle `NARWHAL` · graine `830636382` · `rh-directeur-talents.webp`
- 2026-10-26 · `rh-gestionnaire-formation` · modèle `NARWHAL` · graine `1592319664` · `rh-gestionnaire-formation.webp`
- 2026-10-26 · `rh-responsable-formation` · modèle `NARWHAL` · graine `300403632` · `rh-responsable-formation.webp`
- 2026-10-26 · `direction-auditeur-direction` · **fichier renommé** avec son id (D-096 (4)), graine reprise de la production du 25/10/2026 `direction-auditeur-interne` · graine `1811249482` · `direction-auditeur-direction.webp`
- 2026-10-28 · `sse-medecin-travail-star3` · modèle `NARWHAL` · graine `0` · `sse-medecin-travail-star3.webp`
- 2026-10-28 · `amelioration-directeur-qualite-star3` · modèle `NARWHAL` · graine `125557385` · `amelioration-directeur-qualite-star3.webp`
- 2026-10-28 · `qvt-chief-happiness-officer-star3` · modèle `NARWHAL` · graine `1626243013` · `qvt-chief-happiness-officer-star3.webp`
- 2026-10-28 · `atelier-responsable-process-star3` · modèle `NARWHAL` · graine `0` · `atelier-responsable-process-star3.webp`
