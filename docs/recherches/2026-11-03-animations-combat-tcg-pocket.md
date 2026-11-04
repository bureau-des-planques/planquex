# Animations de combat : Pokémon TCG Pocket (mesures sur la vidéo feAya7Pixc4)

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `refs-2026-11-03/ANIMATIONS.md`. Les planches `rafales/<nom>-p.jpg` et les scripts
> (`rafale.py`, `planche_portrait.py`, `scenes.txt`) cités ne sont pas archivés : ce texte est la
> seule trace conservée. Les libellés d'interface entre guillemets sont de courtes mentions ;
> aucune illustration ni texte de carte n'est reproduit.

> Chaque fiche s'appuie sur une planche `rafales/<nom>-p.jpg` (portrait, vignettes lisibles ; refaite par
> `planche_portrait.py` parce que `rafales/<nom>.jpg` de `rafale.py` est en 16:9 et rend la vidéo portrait illisible).
> Résolution temporelle : **0,05 s** à 20 fps, **0,033 s** à 30 fps. Les durées sont « première → dernière image
> où quelque chose bouge » ; l'erreur est donc d'une image (± 0,05 s).
> Les positions sont en **pourcentage de la hauteur/largeur de l'écran** (cadre 720×1280), lues à l'œil sur
> vignettes : précision ≈ ± 3 points. Les easings ne se lisent pas à cette cadence : « incertain » partout où je
> parle de courbe.
> Légende de l'écran (haut → bas) : main adverse, Banc adverse, Actif adverse, Actif joueur, Banc joueur, main
> joueur ; paquet adverse à gauche, paquet du joueur à droite.

## Récapitulatif

| nom | début → fin (s) | durée |
|---|---|---|
| tirage → plateau (`distribution-main`) | 7,30 → 8,20 | 0,9 s |
| pioche initiale (`distribution-main`) | 8,75 → 9,35 | 0,6 s |
| tap + agrandissement (`main-agrandie`) | 10,55 → 10,90 | 0,35 s (puis tenu 1,5 s) |
| pose Actif (`pose-actif`) | 12,40 → 13,45 | 1,05 s |
| retournement (`retournement-flip`) | 19,20 → 19,57 | 0,37 s |
| bannière de tour (`retournement`, `changement-tour`) | 22,15 → 23,25 / 230,35 → 231,40 | 1,1 s |
| pioche du tour (`pioche-tour`, `pioche-suite`) | 33,10 → 34,20 | 1,1 s |
| énergie du tour (`pioche-suite`, `energie`) | 34,55 → 35,40 / 47,05 → 47,50 | 0,85 s / 0,45 s |
| pose Banc (`pose-banc`) | 42,20 → 43,55 | 1,35 s |
| évolution (`evolution-suite`) | 141,35 → 143,60 | 2,25 s |
| attaque : bannière (`attaque-bandeau`) | 124,60 → 125,65 | 1,05 s |
| dégâts (`degats`) | 125,85 → 127,10 | 1,25 s |
| K.O. (`ko-pv`, `ko-point`) | 171,40 → 172,95 | 1,55 s (dont 0,7 s d'arrêt à 0 PV) |
| bande de point (`ko-point`, `point-bande`) | 174,50 → ≥ 177,5 | ≥ 3,0 s |
| écran de fin (`ecran-fin`) | 381,15 → 382,95 | 1,8 s |

---

## 1. Distribution de la main de départ — `distribution-main` (7,0 → 9,5 s, 20 fps)

- **Fin du tirage** : « Going second » reste affiché de 7,0 à 7,25 s, s'efface 7,30–7,40 s ; la pièce noire reste centrée, fond orange.
  À 7,55–7,60 s le fond orange se fond en plateau bleu clair et la pièce **rétrécit** (≈ 45 % → 15 % de la largeur) puis devient un **point** (7,65–7,70 s), puis disparaît à 7,75 s.
  Le fond est un **dégradé orange → bleu qui fait un fondu** en 0,15 s (pas de glissement).
- **Plateau qui se met en place** : à 7,75 s on voit le plateau **de très près** (cercle central et emplacements, énormes, rognés par les bords). Entre 7,95 et 8,20 s, la caméra **recule** (zoom arrière, ×1,3 environ) : les anneaux orange/bleu du bord apparaissent à 8,05 s, le menu hamburger à 8,25 s. Durée du dézoom ≈ 0,3 s.
- **Paquets** : à 8,00 s les deux paquets entrent par les **bords** (gauche et droite, mi-hauteur) ; ils sont en place à 8,20 s (≈ 0,2 s, glissé).
- **Distribution** : 8,75 → 9,35 s (≈ 0,6 s).
  - Côté adverse : à 8,75 s une carte sort du paquet de gauche (en haut du paquet, orientée sur sa tranche), les suivantes à 8,80, 8,85, 8,90 (décalage ≈ 0,05 s) ; elles montent vers le haut du plateau et **se rangent en éventail** (5 cartes) de 9,00 à 9,25 s.
  - Côté joueur : à 8,85–8,90 s une carte part du paquet de droite vers le bas, **tranche vers l'écran** (vue de profil : fine barre verte à 8,90–8,95 s), s'ouvre à 9,00 s (faces vertes visibles) et se loge dans la main en bas ; 5 cartes à 9,25–9,35 s, l'éventail se resserre à 9,30–9,45 s.
  - Les cartes **tournent autour de leur axe vertical** pendant le trajet (une carte vue de profil à 8,90 s), le face-à-face apparaît à l'arrivée.
- **Devant/derrière** : les cartes en vol passent **devant** le plateau ; le paquet reste dessous.

## 2. Tap et agrandissement d'une carte de la main — `main-agrandie` (9,5 → 12,0 s)

- Contexte : à 9,75–9,90 s apparaissent la **pastille « Time limit 90 »** au centre (9,75 s, elle grandit 9,75 → 9,80 s) et la **bulle de consigne** en haut (fondu 9,80–9,95 s). Le **liseré cyan** de la carte jouable en bas est allumé dès 9,80 s.
- **Tap** : l'appui sur Exeggcute se lit à 10,55–10,70 s : la carte **se soulève** (elle monte de ≈ 3 points et son liseré cyan s'épaissit), les voisines s'écartent (10,60 s). Le compteur « ☐ 5 » apparaît en bas à droite en même temps.
- **Agrandissement** : la grande carte **apparaît en une image** (absente à 10,85 s, pleine à 10,90 s) : pas d'interpolation visible à 20 fps, soit < 0,05 s. *(Incertain : à 30 fps on verrait peut-être 2 images de scale.)*
  Taille : **≈ 75–80 % de la largeur** (de 8 % à 88 %) et **≈ 55 % de la hauteur** (de 17 % à 73 %), centrée un peu au-dessus du milieu. La carte réelle de la main reste visible et liserée en dessous.
- **Tenue** : 10,90 → 12,35 s (au moins 1,45 s tant qu'on garde le doigt) ; le fond et la main restent nets, **aucun voile sombre** pendant l'agrandissement.
- La carte agrandie couvre la bulle de consigne et les emplacements, mais **pas la main** ni le menu.

## 3. Pose de la carte sur l'emplacement Actif — `pose-actif` (11,0 → 13,5 s) et `scan-revele`

- **Fermeture de l'agrandissement** : 12,35 → 12,40 s, la grande carte disparaît en **une image** ; le plateau passe sous un **voile gris-bleu** (12,40–12,50 s, fondu ≈ 0,1 s) et l'emplacement Actif central s'allume en **cyan** (12,40 s). La carte de la main est soulevée, entourée d'un halo blanc (12,50 s).
- **Carte adverse face cachée** : à 12,65 s un dos de carte **apparaît en haut** (y ≈ 5 %) et **descend** jusqu'à l'emplacement Actif adverse (y ≈ 30 %), arrivée à ≈ 13,00 s (0,35 s, ralentit à l'arrivée *(incertain)*). Le dos est de la taille d'une carte de plateau.
- **Carte du joueur** : de 12,75 à 13,00 s elle **monte** de la main (y ≈ 83 %) vers l'Actif (y ≈ 55 %), avec un halo blanc, puis à 13,00–13,15 s elle **entre dans l'emplacement cyan** en rétrécissant ; un flash vert pâle sur l'emplacement à 13,10 s.
- **Fin** : à 13,25 s le voile se lève (fondu 0,1 s), le plateau est clair ; la carte est posée, l'emplacement perd son liseré à 13,40 s. Pastille « 87 ».
- **Total** : 12,40 → 13,45 s ≈ **1,05 s**.
- **Ce qui passe devant quoi** : la carte du joueur et son halo passent **devant** le voile ; la carte adverse (dos) descend **derrière** la carte du joueur à la fin ? **incertain** (les deux ne se chevauchent pas avant 13,45 s).

## 4. Retournement de la carte adverse — `retournement-flip` (18,9 → 20,0 s, **30 fps**) et `scan-revele`

- Déclencheur : `Start Battle` pressé vers **18,95 s** ; consigne et boutons disparaissent à 18,5–19,0 s ; le **pastille « Time limit »** disparaît à 19,03 s (elle s'efface en un fondu rapide) ; **les PV « 50 »** de notre carte apparaissent à 19,03 s.
- **Retournement** : la carte adverse (dos bleu, **fixe** depuis 13 s) **pivote autour de l'axe vertical** :
  - 19,20 s : début, bord droit qui se soulève (largeur ≈ 100 %) ;
  - 19,30–19,37 s : **tranche** (largeur ≈ 15 % de la carte) ; à 19,37 s la tranche est déjà **orange** (face visible) ;
  - 19,43–19,53 s : la face orange (Riolu) se **rouvre**, orientée en légère perspective ;
  - 19,57 s : carte à plat.
  - **Durée : 0,37 s** (19,20 → 19,57).
- Pendant le retournement la carte **rétrécit** (≈ 105 % → 90 % de sa taille de repos) et se **déplace de ≈ 3 points vers le bas** pour se poser dans l'emplacement Actif adverse.
- **Après** : **liseré cyan** autour de la carte retournée de 19,57 à 19,97 s (≥ 0,4 s), badge « 60 » PV à 19,77 s. L'horloge de partie (barre du haut) apparaît à 19,87 s.
- **Ready? Go!** (`retournement`, 20,7 → 21,6 s) : halo blanc et **cercle clair** qui s'ouvre à 20,9 s, texte « Ready? Go! » incliné (≈ −8°) avec deux traits rouge/bleu qui le soulignent, fondu en sortie à 21,65 s. Durée ≈ 0,95 s.

## 5. Bannière de tour : « Opponent's turn » (`retournement`, 21,5 → 24 s) et « Your turn » (`changement-tour`, `pioche-tour`)

**Opponent's turn (tour 1, 22,15 → 23,25 s)**
- **Entrée** : la bande orange entre **par la droite** : 22,15 s bout de bande au bord droit, 22,25 s à mi-écran, texte **fondu** (22,30 s), bande complète à 22,35 s. Entrée ≈ 0,2 s.
- **Tenue** : 22,35 → 23,05 s (≈ 0,7 s). La bande couvre la **moitié basse du Actif adverse / haut du Actif joueur** (y ≈ 50 %) ; en dessous, la pastille « Current turn: 1 » (grise).
- **Sortie** : 23,10 s la bande sort **vers la gauche**, plus qu'une cale rouge-orangé à gauche ; disparue à 23,25 s (0,15 s).
- **Hexagones** : 22,45 → 23,20 s, des **hexagones pastel** (vert, bleu, rose) sur le plateau, qui apparaissent par le haut à droite puis se diffusent vers le bas (0,75 s), en transparence ; ils se **fondent en confettis** à 23,00–23,15 s.
- **Bascule de teinte** : le plateau passe de **bleu à rouge** de 22,55 s (début en haut) à 23,30 s (fin complète) ≈ **0,75 s**, **en même temps que les hexagones**, pas à la fin.
- La bannière est **devant tout**, mais les cartes du plateau restent **au-dessus** des hexagones.

**Your turn (tour 10, 230,35 → 231,45 s, `changement-tour` ; tour 2, 31,5 → 32,3 s, `pioche-tour`)**
- Même schéma, couleur **cyan/bleu** et sens inversé : fondu d'entrée du texte 230,40 s, bande pleine 230,45 s (**0,1 s**), tenue **0,7 s** (230,45 → 231,15 s), fondu du texte à 231,20 s, la bande sort **vers la droite** (231,25 → 231,35 s, 0,1 s).
- Hexagones **230,65 → 231,35 s**, teinte du plateau rouge → bleu **de 230,85 à 231,40 s** (≈ 0,55 s), balayage du bas vers le haut *(le haut reste rosé jusqu'à 231,40 s)*.
- Total ≈ **1,05 s**.

## 6. Pioche du tour — `pioche-tour` (31,5 → 34,0 s) + `pioche-suite` (33,9 → 36,4 s)

- Précondition : bannière « Your turn » (fiche 5) jusqu'à 32,3 s, puis ≈ 0,8 s sans mouvement (32,3 → 33,1 s).
- **Départ** : à 33,10 s une carte **sort du paquet du joueur** (bord droit, y ≈ 65 %) en **vue de tranche** (étroite, inclinée), traversant le plateau vers le centre-gauche ; **elle grandit et se retourne** : à 33,15 s elle est encore à ≈ 25 % de la largeur finale, tournée de côté ; à 33,20 s ≈ 55 % de la largeur, à 33,25 s ≈ 75 % ; **pleine taille (≈ 80 % de la largeur) à 33,35 s**.
- **Trajectoire** : du bord droit (x ≈ 90 %, y ≈ 62 %) vers le centre (x ≈ 45 %, y ≈ 40 %) en **0,25 s** ; légère rotation (≈ −5°) qui s'annule à l'arrivée.
- **Tenue** : la carte reste agrandie de 33,35 à 34,00 s (**≈ 0,65 s**), sans voile, **devant** les cartes du plateau mais **derrière** la main.
- **Rentrée en main** : à 34,00 s elle **rétrécit et glisse** vers le bas-droit (34,05 s ≈ 45 %, 34,10 s ≈ 30 %), arrive à 34,15–34,20 s dans la main, l'éventail se **rouvre** (34,20–34,30 s). Durée ≈ 0,2 s.
- **Total** pioche : 33,10 → 34,20 s ≈ **1,1 s**.
- **Énergie du tour** (même fenêtre) : à 34,55 s un **éclat blanc-vert** apparaît sur l'orbe en bas à droite (34,55–34,70 s, brillance à 34,60–34,65 s), une petite **figurine verte** en sort (34,70–34,75 s), l'orbe garde un liseré cyan et un halo (34,80 → 35,0 s) ; à 34,95–35,40 s une **infobulle sombre « Next Energy generated »** à droite de l'orbe (≈ 0,45 s).

## 7. Pose sur le Banc — `pose-banc` (41,5 → 44,0 s)

- **Tap** : la carte (Bulbasaur) est à droite de la main (41,5 s). À 42,15–42,35 s une ombre de la carte agrandie se dessine : **fondu à 42,40 s** (translucide), **solide à 42,45 s** — **pop en ≈ 0,1 s**. Taille : ≈ **78 % de la largeur**, pleine hauteur ≈ 55 %, **illustration entière (pleine page)** sur fond prismatique.
- **Tenue** : 42,45 → 42,70 s (0,3 s seulement ici ; le doigt a vite lâché).
- **Passage au glissé** : à 42,75 s l'agrandissement disparaît (une image), le plateau se **voile en gris-bleu** et les **trois emplacements de Banc** s'allument en cyan épais (liseré brillant). La petite carte (≈ 20 % de largeur) est **au-dessus de la main, à droite** (x ≈ 70 %, y ≈ 80 %).
- **Glissé** : de 42,75 à 43,30 s, la carte **suit le doigt** vers la gauche : x 70 % → 55 % (42,85) → 45 % (43,00–43,10, légère inclinaison) → 33 % (43,25) → **22 % (43,30)** sur le premier emplacement du Banc, avec un halo blanc. **Durée du glissé ≈ 0,55 s** ; le trajet est un **déplacement de pointeur** (accélère/ralentit, pas de courbe nette).
- **Surbrillance** : l'emplacement visé s'allume en **vert** (42,90–42,95 s) quand la carte passe dessus, retour cyan ; les autres emplacements restent cyan.
- **Pose** : 43,35 s dernier état glissé ; 43,40 s le voile **tombe** (fondu 0,1 s) et les liserés cyan disparaissent ; la carte **est posée et petite** (≈ 15 % de la largeur) ; à 43,55 s elle a sa taille de Banc stable.
- **Total** : 42,20 → 43,55 s ≈ **1,35 s**.

## 8. Énergie vers une carte — `energie` (45,4 → 47,9 s)

- Contexte : Bulbasaur est posé au Banc (45,4 → 45,85 s, il arrive de l'agrandissement à gauche du plateau : la grande carte glisse vers le Banc et rétrécit en 0,35 s) ; bouton `End Turn` à 46,35 s.
- **Tap sur l'orbe** : 46,55–46,60 s le plateau se **voile** (fondu 0,05 s) ; l'Actif (Exeggcute) et le Banc (Bulbasaur) s'allument en **cyan** (46,65 s) : cibles possibles.
- **Vol de l'énergie** : à partir de 47,05 s, une **bille verte** sort de l'orbe (bas-droite), laisse une **traînée jaune-vert** ; elle remonte en diagonale vers le haut-gauche : 47,10 s (x 90 %, y 92 %) → 47,25 s (75 %, 85 %) → 47,40 s (60 %, 75 %) → **47,50 s (45 %, 70 %)** contre le Banc/l'Actif. **Durée du vol ≈ 0,45 s**, vitesse apparemment constante *(incertain)*.
- **Arrivée** : à 47,50 s l'Actif **se remplit d'un halo vert** (carte teinte verte, 47,50–47,85 s et au-delà) ; la bille est visible dessus.
- La fenêtre s'arrête à 47,9 s : **fin de l'effet non observée** (voir `scenes.txt` 48,20).

## 9. Évolution — `evolution` + `evolution-suite` (139,0 → 143,9 s)

- **Agrandissement** (139,0 → 139,95 s) : Ivysaur en grand, tenu (≥ 1 s), main avec cartes à liseré jaune (cartes qui peuvent évoluer, **jaune** et non cyan).
- **Glissé** : à 140,0 s le grand écran se ferme, **voile sombre**, la carte cible (Bulbasaur, 10 PV) a un **liseré jaune épais** ; la carte glissée est en bas à (x 40 %, y 78 %) puis monte vers la cible : 140,2 s y ≈ 72 % … 141,3 s (x 40 %, y 70 %) … **141,40–141,50 s** elle **recouvre** la cible (y ≈ 62 %) ; la cible passe du liseré jaune au **liseré vert** à 141,55 s.
- **Tenue sur la cible** : 141,55 → 141,90 s (0,35 s), la carte glissée est entourée d'un halo vert.
- **Pose** : 141,95 s le voile tombe, la carte évoluée (petite) est **posée sur l'ancienne** (qu'on voit encore dessous, légèrement décalée) ; elle reste ainsi 142,00 → 142,40 s (≈ 0,45 s).
- **Animation d'évolution** (142,45 → 143,60 s, **≈ 1,15 s**) :
  1. 142,45 s : la carte **saute en gros plan** au centre (≈ 2,5× la taille de slot, ≈ 40 % de la largeur ; plus grande à 142,65 s ≈ 50 %), **traits de vitesse** radiaux blancs (142,55–142,70 s) ;
  2. 142,75–142,95 s : **flash blanc** qui délave la carte (≈ 0,25 s) ;
  3. 143,00 s : retour à la taille de slot ; 143,10–143,30 s **piliers de lumière cyan** verticaux sur le slot (0,25 s), étincelles blanches 143,25–143,55 s ;
  4. 143,65 s : badge de PV « 30 » apparaît.
- Passages : la carte agrandie est **devant tout** ; la lumière est **devant** le plateau et **derrière** les compteurs de PV.
- **Total** : 141,35 (glissé) → 143,60 ≈ **2,25 s**, dont **1,15 s** d'animation proprement dite.

## 10. Attaque : bannière et attaquant — `attaque-bandeau` (123,0 → 125,5 s)

- Précontexte : infobulle blanche de capacité (« Attacks by Fighting-type Pokémon do +20 damage… ») de 123,0 à 123,95 s en haut du plateau (≥ 1 s, disparaît en une image à 124,00 s).
- **Bannière** : **entrée par la droite** : 124,60 s la bande orange est visible de x 45 % à 100 % et a un bord gauche en biseau ; 124,65 s ; 124,70 s elle couvre toute la largeur, **sans texte** ; **texte « Submarine Blow » visible à 124,75 s** (révélé de la gauche vers la droite, cadré par le bord) ; sous-titre en petit « Lucario ». Entrée ≈ **0,15 s**.
- **Position** : **diagonale** (≈ −8°, bord droit plus haut), **y ≈ 78 %** de l'écran (couvre le Banc du joueur et le haut de la main).
- **Voile** : à 124,85 s le plateau **s'assombrit** (voile gris, fondu 0,05 s) ; l'attaquant (Lucario) **grossit** et monte à y ≈ 5–25 % (×1,5 environ) à 124,90 s, avec un reflet violet à 124,95 s. Cette pose est **tenue** de 124,90 à 125,65 s (≈ 0,75 s).
- **Sortie** : la bannière s'éloigne vers la **gauche** (125,50–125,65 s, elle ne laisse qu'une cale à gauche à 125,50 s) ; en `degats`, cale visible à 125,50–125,60 s, absente à 125,65 s.
- **Total bannière** : 124,60 → 125,65 s ≈ **1,05 s** (entrée 0,15, tenue ≈ 0,75, sortie 0,15).
- **Devant/derrière** : bannière devant tout ; attaquant grossi **devant** la bannière ? **incertain** (la carte semble passer **derrière** la bande, qui la recoupe en bas).

## 11. Dégâts — `degats` (125,5 → 128,0 s)

- **Retour de l'attaquant** : à 125,65–125,70 s le voile tombe (fondu 0,05 s) ; la carte adverse **redescend** à sa place (125,70–125,80 s, ≈ 0,15 s) et reprend sa taille.
- **Impact** : à 125,85 s un **flash orange-blanc** sur notre Actif (halo rond ≈ 30 % de largeur, 125,85–125,95 s) ; à 126,00 s apparaît le **chiffre de dégâts « 60 »** centré sur la carte, **dans une étoile orange à pointes** ; l'étoile reste jusqu'à 126,15 s, **grossissant légèrement** (126,00 → 126,10 s).
- **Poussière** : 126,15 → 126,55 s un **anneau de poussière brune** autour de la carte (débris qui s'écartent), l'étoile est remplacée par une pastille « 60 » avec un petit libellé « Damage » en dessous (126,20 → 126,65 s). Le tout **s'efface** de 126,60 à 126,75 s.
- **Compteur de PV** : à 126,65 s un **« 70 » rouge** apparaît à droite du haut de la carte (PV avant coup : 70) ; il **décroit par pas de 10** : 70 (126,65–126,75), 60 (126,80), 50 (126,85–126,90), 40 (126,95), 30 (127,00), 20 (127,05), **10 (127,10)** puis se **replie en noir** (127,15 → 127,30 s). Descente ≈ **0,45 s**, pas de ≈ 0,05 s (le pas de 70 → 60 dure 0,10 s).
- **Fin** : barre de PV mise à jour ; à 127,95 s une bannière bleue d'avertissement monte (début de la bannière de tour).
- **Total** : 125,85 → 127,10 s ≈ **1,25 s** ; celle de l'attaque entière (bannière + dégâts) ≈ **2,5 s**.
- **Secousse** : **aucune secousse d'écran ni de carte** n'est visible à 20 fps ; **incertain** à 30 fps.

## 12. K.O. — `ko` (169,0 → 171,5 s), `ko-pv` (171,4 → 172,6 s, **30 fps**), `ko-point` (172,5 → 175,0 s)

- **Avant** : bannière « Fighting Headbutt » (sous-titre « Sudowoodo ») entrée par la droite 169,15 → 169,35 s (0,2 s), tenue 169,35 → 170,00 s, sortie par la gauche 170,05–170,15 s. L'attaquant grandit de 169,35 s et revient à sa place entre 170,10 et 170,25 s.
- **Impact** : flash blanc-jaune 170,40–170,50 s, étoile « 40 » à 170,55–170,65 s, poussière 170,70–171,05 s ; compteur de PV rouge « 30 » à 171,15 s.
- **Compteur** (30 fps) : **30** (171,40) → **20** (171,43) → 20 jusqu'à 171,57 → **10** (171,60) → **0** (171,67). Descente **0,27 s** (pas 0,17 s entre 30 et 10 puis 0,07 s). Les chiffres sont en **rouge** quand ils bougent et deviennent noirs fixes à 0 (171,70 s).
- **Arrêt** : la carte reste à 0 PV, intacte, de 171,67 à ≈ 172,40 s (**≈ 0,7 s** de pause).
- **Disparition** (**172,40 → 172,95 s**, ≈ 0,55 s) :
  - 172,40–172,47 s : une **lueur cyan** apparaît derrière la carte ;
  - 172,50 s : halo plus large, la carte commence à pâlir ;
  - 172,53 s : **la carte rétrécit** (≈ 100 % → 35 % en 0,05 s) ;
  - 172,57–172,60 s : une **petite carte** à l'intérieur d'un **anneau cyan** (≈ 40 % de largeur) ;
  - 172,65–172,85 s : l'anneau **grossit** (≈ 60 % de largeur à 172,75 s), devient blanc, **s'estompe** ;
  - 172,95 s : emplacement vide.
- **Vers la défausse** *(incertain)* : à 173,20–173,50 s une carte verte **réapparaît au bord droit** (x ≈ 92 %, y ≈ 48–62 %) près de la défausse du joueur, se déplace vers le bas, puis la défausse affiche un dessus ; je ne vois **aucun trajet continu** entre l'anneau et la défausse.
- **Remplaçant** : le plateau reste vide 172,95 → 174,45 s (**≈ 1,5 s**) avant la bande de point : la carte de remplacement est choisie **après** la bande de point (fenêtre 178 s).

## 13. Bande de point — `ko-point` (172,5 → 175,0 s) et `point-bande` (175,0 → 177,5 s)

- **Entrée** : 174,50 s le plateau **se floute et s'éclaircit** (voile blanc, fondu 0,05 s) ; 174,55 s une **bande rouge** entre **par la droite**, avec un bord gauche arrondi ; 174,60 s à mi-écran ; 174,65 s bande pleine, **avatar adverse** qui **apparaît en agrandissement** (0 → 100 % en 0,05–0,10 s) ; pastilles `1 2 3` éteintes (rouge sombre). Entrée ≈ **0,15 s**.
- **Position** : bande centrée à **y ≈ 52–65 %**, hauteur ≈ **13 %** de l'écran, avatar **à cheval** sur le bord haut (cercle ≈ 18 % de largeur), pastilles dans la bande, nom du joueur en tout petit sous l'avatar.
- **Pastille** (175,00 → 175,60 s) : 175,20 s un **disque blanc** (≈ 15 % de largeur) à la place de la pastille 1 ; 175,25–175,40 s il se réduit en **anneau blanc fin** avec **quatre petites étincelles** ; 175,45 s la pastille devient **jaune** avec un point lumineux, 175,60 s elle est jaune stable. Durée ≈ **0,45 s**.
- **« +1 point! »** : à 176,05 s le texte blanc apparaît **au-dessus de l'avatar** ; un **anneau rose** grandit de 176,10 s (≈ 30 % de largeur) à 176,55 s (≈ 70 %) et s'efface à 176,65 s (**0,55 s**).
- **Tenue** : la bande reste jusqu'à ≥ 177,45 s, puis le texte pâlit (177,45 s) ; elle disparaît **après 177,5 s** (non vu). Durée **≥ 3,0 s** (174,50 → ≥ 177,5).
- **Même gabarit côté joueur** (bande bleue, 214 s, 298 s, 376–378 s) : vu sur les planches, durée non mesurée.

## 14. Écran de fin — `ecran-fin` (380,5 → 383,0 s)

- **Dernier plateau** : 380,5 → 381,10 s, plateau avec Celebi en Actif et l'adversaire vidé.
- **Sortie de plateau** : 381,10 s un reflet blanc balaie le bas à droite ; **381,15–381,20 s** le plateau est étiré en **flou de mouvement horizontal** (traînées vers la droite, tout est étiré), **381,25 s : écran tout blanc**, tenu **0,65 s** (381,25 → 381,90 s).
- **Entrée du dos de carte** : à 381,95 s un fond **gris-bleu avec traînées horizontales blanches** (lignes de vitesse) ; au centre un **dos de carte** incliné (≈ −8°, ≈ 17 % de largeur), les traînées s'estompent à 382,05 s, le fond devient **un dégradé gris-bleu sombre** avec petites étoiles.
- **Dos de carte** : 382,00 → 382,45 s il **dérive** très légèrement vers le haut et **gonfle un peu** (≈ 17 % → 20 %), puis 382,50–382,55 s il **se rétrécit** (tranche) et **se retourne** (tranche visible à 382,55–382,60 s) ; **retournement ≈ 0,1 s**.
- **Face** : à 382,65 s la face de la carte (**Exeggutor, carte de la partie**) apparaît sur fond **blanc iridescent** (pastel arc-en-ciel) ; elle est **grande** (≈ 60 % de largeur, ≈ 45 % de hauteur) et **inclinée** (≈ −6°) ; à 382,75 s « **Victory!** » entre **de la gauche**, énorme, en blanc nacré, partiellement caché derrière la carte, et grossit jusqu'à 382,95 s ; **étincelles** blanches autour de la carte (382,80 s →). Le nom du joueur et son avatar apparaissent en haut à gauche à 382,85 s.
- **Devant/derrière** : la carte est **devant** le mot « Victory! ».
- **Durée de l'écran** : 381,15 → 382,95 s ≈ **1,8 s** pour atteindre l'état « Victory! » ; les écrans suivants (récap 386–392 s) sont vus uniquement sur planches de 2 s.

---

## Limites

- **Pas de mesure d'easing** : aucune fiche ne dit « ease-out » ; je n'ai pas échantillonné assez finement. Les vitesses sont des déplacements entre images, à lire comme des ordres de grandeur.
- **Pas de secousse** (shake) observée sur les cartes ou l'écran à 20/30 fps ; elle pourrait exister à une image près.
- Les tailles/positions en % sont lues sur vignettes de ≈ 160 px de large ; ± 3 points.
- Fenêtres non découpées : énergie attachée avec fin d'effet (après 47,9 s), bande bleue (côté joueur), écran récapitulatif, remplaçant choisi (178 s), pièces de l'attaque de Celebi (364–372 s), « Waiting for opponent… », boîte « End your turn ? ».
