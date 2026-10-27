# Jalons alpha et beta — ce que dit l'industrie

> **Lot de recherche**, pas de captures. Ouvert le **27/10/2026**.
> Toutes les URL citées ont été lues le **27/10/2026**.
>
> **Emplacement** : `docs/preuves/jalons-2026-10-27/README.md` — la convention de
> `docs/preuves/README.md` est « **un lot, un dossier daté** », et `regles-2026-10-20/`
> (lot de recherche documentaire, sans capture) est le précédent exact. Un fichier à plat,
> `docs/preuves/jalons-industrie-2026-10-27.md`, aurait été le seul cas de l'arborescence.
>
> **Traçabilité** : l'usage « jalons » figure dans le tableau de `docs/preuves/README.md`
> (ligne `jalons-<AAAA-MM-JJ>/`), et le lot est rangé à cet emplacement. Rien d'autre n'est à
> ajouter pour que le lot soit rattaché. Ce qui reste **non lu** est dit en §7, « Sources non
> trouvées » : ce n'est pas un suivi de rangement.

## 0. Méthode — et sa limite

Chaque affirmation porte **une URL** et, entre guillemets, **ce que la source dit**, en une
phrase. Trois niveaux, jamais mélangés (repris de `docs/preuves/regles-2026-10-20/README.md`) :

| Niveau | Ce que c'est | Exemple ici |
|---|---|---|
| **Primaire** | le texte de l'éditeur de la plateforme, ou le texte signé par le studio | Steamworks, Play Console, App Review Guidelines, Microsoft Learn, Supergiant, Wizards |
| **Secondaire** | un tiers décrit la pratique | non utilisé : aucun article de blog tiers n'est cité |
| **Opinion** | ni l'un ni l'autre | §5, et §6 quand c'est signalé |

**Ce que ce lot ne peut pas prouver.** Les documents de certification console
(**TRC** PlayStation, lotcheck Nintendo) sont derrière un portail partenaire sous NDA :
ils n'ont pas été lus (§7). Le « guide pas à pas de la certification » Xbox est indexé
par les moteurs mais son accès demande une autorisation Microsoft. Tout ce qui dépend
de ces documents est donc **non documenté ici**, pas « probablement comme sur Xbox ».

Conséquence de méthode : quand une source ne dit rien, ce document écrit
« non documenté » plutôt que de compléter au bon sens. Les notions demandées
(**feature freeze**, **content lock**, **milestone gate**, **vertical slice**) ne sont
**pas** des termes de la documentation des plateformes — elles appartiennent au
vocabulaire interne des studios, qui ne le publie presque jamais. Ce qui est documenté,
c'est **la pratique observable derrière ces mots** (§2), et c'est cela qui est cité.

---

## 1. Ce que veulent dire alpha et beta — et les critères de sortie réellement employés

### 1.1 Le fait qui structure tout le reste

**Aucune source de ce lot ne définit ce qu'est une alpha ou une beta.** Le mot est pourtant
partout : Steam parle de « games that are in a **playable alpha or beta state** », Microsoft
de « **Betas** and Game Previews », Apple de « **beta** distribution via TestFlight », Google
d'une « **closed beta** access to your community ». Aucun de ces textes ne dit ce que le mot
exige en contenu, en fonctionnalités ou en qualité.

Ce qu'ils font tous, en revanche, c'est **attacher le mot à une population et à une règle
d'accès** : 100 testeurs internes, 10 000 testeurs externes, 12 testeurs pendant 14 jours,
10 000 puis 50 000 utilisateurs, un appID enfant, une piste, un groupe de builds. Le jalon
n'est donc pas « ce qui est fait », c'est « **qui y a accès, et pendant combien de temps** ».

C'est la lecture la plus solide que ce corpus permette — et elle est un constat de lecture,
pas une règle énoncée par une source. Elle a une conséquence directe : une alpha que personne
n'a jouée ne peut pas être qualifiée par ce vocabulaire, faute de population à nommer.

### 1.2 Steamworks — Early Access et Playtest

- **Entrée en Early Access** : « Early Access is a place for games that are in a **playable
  alpha or beta state**, are **worth the current value of the playable build**, and that you
  plan to continue to develop for release. »
  — <https://partner.steamgames.com/doc/store/earlyaccess>
- **Le critère de refus**, règle 6 : « Don't launch in Early Access without a playable game.
  […] If you are trying to test out a concept and haven't yet figured out what players are
  going to do in your game that makes it fun, then it's probably too early. » La même règle
  exige « at a bare minimum […] a video trailer that shows gameplay ».
  — même URL.
- **Le critère de refus inverse**, règle 7 : « Don't launch in Early Access if you are
  finished with development. If you have all your gameplay defined already and are just
  looking for final bug testing, then Early Access isn't right for you. »
  — même URL.
- **Le critère de sortie de l'accès anticipé** : « When you consider your product
  **“feature complete” and no longer in a significant state of change**, you may transition
  from Early Access to 'Released.' » Et : « If your product is no longer marked as Early
  Access, the expectation from customers will be that your product is **stable and delivers
  a complete experience**. » — même URL.
- **Le test fermé n'est pas une version du jeu** : Steam Playtest passe par un **appID
  enfant** séparé, « linked with, but separate from your main game », pour que les avis,
  les listes de souhaits et le temps de jeu des testeurs ne touchent pas la fiche du jeu.
  — <https://partner.steamgames.com/doc/features/playtest>
- **Le seuil implicite du public** : au-delà de **50 000 clés** de Playtest, « your playtest
  is effectively an open beta and you should feel comfortable opening signups on your Steam
  store page ». Au-delà de **2 500 clés** de contournement d'état de sortie, la fuite devient
  probable : « the probability of a leak is increasing to the point where you're likely
  'announcing' your product anyway ». — même URL.
- **Playtest est gratuit et non monétisable** : « it's not OK to charge customers to access
  your Steam Playtest ». Pour facturer une version en chantier, Steam renvoie explicitement
  vers Early Access. — même URL.
- **Le critère de sortie se déclare à l'entrée, publiquement.** Le questionnaire d'accès
  anticipé impose de répondre à « **How is the full version planned to differ from the Early
  Access version?** » et à « What is the current state of the Early Access version? », avec
  cette consigne : « You might need to **update this section every few weeks or months** », et
  « It's best to revisit your Early Access store page at least once a year ».
  — <https://partner.steamgames.com/doc/store/earlyaccess>

  C'est la seule mécanique de plateforme trouvée qui **force** l'équipe à écrire ses critères
  de sortie avant d'entrer, puis à les tenir à jour. La sortie n'est donc pas seulement
  « feature complete » : c'est **« conforme à ce qui avait été annoncé »**.

### 1.3 Google Play — trois pistes, un critère chiffré

- **Trois pistes avant la production** : interne (**100 testeurs** au plus, par liste
  d'e-mails), fermée (listes ou Google Groups), ouverte (visible sur Play, nombre de
  testeurs illimité ou ≥ 1 000). Recommandation officielle : « We recommend starting with an
  internal test, then expanding to a small group of closed testers. »
  — <https://support.google.com/googleplay/android-developer/answer/9845334>
- **Le test est obligatoire** : « You must test your app before releasing it to production. »
  — même URL.
- **Le seul critère de sortie qui compte des personnes, avec une durée** : pour les
  comptes développeur personnels créés après le 13/11/2023, « you must run a closed test for
  your app with a **minimum of 12 testers who have been opted in continuously for at least
  14 days** » avant de pouvoir demander l'accès à la production, demande qui passe par un
  questionnaire sur la conception, le processus de test et l'état de préparation.
  — <https://support.google.com/googleplay/android-developer/answer/14151465>
- **Les testeurs ne sont pas des clients** : « Feedback from your test users won't affect
  your app's public rating » et « Testers cannot leave public reviews on Google Play for test
  versions » (canal de retour à fournir soi-même). — answer/9845334.
- **Le déploiement progressif est un outil de production, pas de test** : un pourcentage de
  déploiement est proposé « if updating an existing app », et « Rollout percentage options
  are unavailable for a first release ».
  — <https://support.google.com/googleplay/android-developer/answer/9859348>

### 1.4 Apple — TestFlight, et la bêta qui n'est pas un canal de distribution

- **Volumétrie** : jusqu'à **100 testeurs internes** (rôles Account Holder, Admin, App
  Manager, Developer, Marketing inclus), **10 000 testeurs externes**, **100 builds**
  partageables, plusieurs builds testables en parallèle, et des **groupes** pour distribuer
  des builds différents à des publics différents.
  — <https://developer.apple.com/testflight/>
- **La revue** : « your first build already approved by App Review for TestFlight » est
  nécessaire avant d'inviter des testeurs externes ; « Your builds are automatically sent for
  review once they're added to a group ». — même URL.
- **Règle 2.2 des App Review Guidelines** : « Demos, betas, and trial versions of your app
  don't belong on the App Store – use TestFlight instead. Any app submitted for beta
  distribution via TestFlight should be **intended for public distribution** and should
  comply with the App Review Guidelines. » Et : « apps using TestFlight cannot be distributed
  to testers in exchange for compensation of any kind, including as a reward for
  crowd-sourced funding. » Et : « **Significant updates to your beta build should be submitted
  to TestFlight App Review** before being distributed to your testers. »
  — <https://developer.apple.com/app-store/review/guidelines/>

  Autrement dit : chez Apple, **chaque mise à jour significative de la bêta repasse une
  revue**. La bêta est un état surveillé, pas un refuge.

### 1.5 Microsoft / Xbox — la seule barrière « bêta vs jeu complet » écrite noir sur blanc

- « XBOX offers the option to test Betas and Game Previews against a **reduced set of XBOX
  Requirements**, as players expect these products to be unfinished. »
  — <https://learn.microsoft.com/en-us/gaming/gdk/docs/store/policies/certification-requirements-beta-game-preview>
- **Les seuils**, qui sont des critères de sortie au sens propre (franchir un seuil déclenche
  une revue) :
  - bêta fermée **< 10 000** utilisateurs gérés par l'éditeur → pas de revue Beta XR, mais
    une revue par Microsoft ;
  - bêta fermée **≥ 10 000** → revue Beta XR ;
  - bêta fermée via le programme Xbox Insiders **< 50 000** → pas de revue Beta XR ;
  - **≥ 50 000** → revue Beta XR.
  Toute **bêta ouverte** doit être certifiée avant sortie. — même URL.
- **La frontière est étanche** : « beta products are separate from the full game. All XRs are
  applicable when only the full game is prepared for the release. » Et : « when a beta
  migrates to a full title, it must undergo a **full certification pass**, and all XRs are
  applicable. » Idem à la sortie du programme Game Preview. — même URL.
- La documentation Xbox sépare aussi la **mise à jour de contenu** (« CU or Content Update »)
  de la soumission initiale, dans son glossaire de publication.
  — <https://learn.microsoft.com/en-us/gaming/game-publishing/glossary>

### 1.6 PlayStation

**Non documenté ici.** Les TRC et les exigences de certification PlayStation vivent sur le
portail partenaire, sous accord de confidentialité ; aucune version publique n'a été trouvée
(§7). Ce qui est affirmé pour Xbox ne doit pas être transposé à PlayStation par analogie.

---

## 2. Est-ce qu'on développe la beta pendant l'alpha ?

Réponse courte, étayée : **oui, et c'est même la norme documentée** — avec, pour le contenu
d'un jeu de cartes, un **verrou** explicite qui n'existe pas ailleurs.

### 2.1 La production continue pendant le test public (source studio)

- Supergiant, sur *Hades II*, à l'annonce du calendrier : « our focus is to keep building core
  content — environments, characters, weapons, Boons, story events, music, and more — as we
  gear up for our Technical Test and Early Access launch ».
  — <https://www.supergiantgames.com/blog/hades-ii-development-update> (14/11/2023)
- Pendant l'accès anticipé lui-même : « During Early Access, our plan is to release a **Major
  Update every few months** containing new features and content, followed soon after by
  patches to shore up any issues. » — <https://www.supergiantgames.com/blog/hades2-early-access-is-here>
  (06/05/2024)
- Et la sortie 1.0 est un **contenu**, pas un gel : « a slew of exciting additions in our v1.0
  Launch Update, notably the true ending of the story, scores of new events ». Elle se fait
  **en même temps** sur console et PC. — <https://www.supergiantgames.com/blog/hades2-now-available>

### 2.2 Le critère de choix du moment (source studio, et c'est le plus utile)

Supergiant, FAQ *Hades II* : « we wanted Hades II to be **far enough along that as many
players as possible could have a good experience right away, yet not far enough along that
it's too late in development for us to act on the feedback we receive** ».
— <https://store.epicgames.com/p/hades-ii-faq-25dbc1>

C'est la formulation la plus opérationnelle trouvée : le jalon n'est pas fixé par un
pourcentage d'avancement, mais par **la capacité restante à changer le jeu**. Un test qui
ouvre quand tout est décidé n'apprend rien d'actionnable — ce que Steam dit aussi autrement
(règle 7 : ne pas entrer en accès anticipé si le game design est déjà figé).

Et Supergiant avait **écrit ses critères de sortie avant d'entrer** — ce que Steam exige
(§1.2) : la version complète devait inclure « a more-complete, more-polished set of features
and content […] along with Achievements and the true ending to the story », et la 1.0 a
livré exactement cela (« the true ending of the story, scores of new events »).
— <https://store.epicgames.com/p/hades-ii-faq-25dbc1> et
<https://www.supergiantgames.com/blog/hades2-now-available>

### 2.3 Le verrou de contenu, documenté chez Wizards

- Quatre étapes, chacune avec sa méthode de test : **exploratory design**, **vision design**,
  **set design**, **play design**. « Set design and play design are the only two parts of the
  design process that overlap. » — <https://magic.wizards.com/en/news/making-magic/playtesting>
  (10/08/2026)
- **Le gel** : « Usually when play design starts, the Set Design team stops having regularly
  scheduled meetings because **the file is locked down** to allow the FFL and CPL to do their
  work. » Puis : « the final **pencils-down moment** of set design and play design ». — même URL.
- **La durée** : « This whole process from the beginning of exploratory design to the final
  pencils-down moment […] takes about **two and a half years**. There are another **six months**
  required for all the teams downstream of design to actually make and distribute the set. »
  — même URL.
- **Le test se fait sur le futur** : la *Future Future League* joue le Standard « about a year
  ahead of the real world » ; elle a remplacé une ligue à six mois, jugée « not early enough
  to allow us to adapt to the lessons we learned ». — même URL.

Donc : **le contenu du set est gelé avant d'être testé sérieusement**, et le test sérieux
porte sur un fichier qu'on ne modifie plus sans rouvrir une réunion. C'est le contraire du
« on équilibre en production ».

### 2.4 Les quatre mots, confrontés aux sources

| Notion | Ce qui est documenté | Verdict |
|---|---|---|
| **feature freeze** | Aucune plateforme n'emploie le terme. Son équivalent fonctionnel est écrit : Steam, « feature complete and no longer in a significant state of change » ; Apple, « significant updates » repassent en revue. | **pratique réelle, terme non documenté** |
| **content lock** | Magic : « the file is locked down », « pencils-down moment », gel entre set design et play design. | **documenté, chez un studio** |
| **milestone gate** | Xbox : seuils 10 000 / 50 000 utilisateurs déclenchant une revue ; sortie de bêta = « full certification pass ». Google Play : 12 testeurs × 14 jours avant la production. | **documenté, comme barrière chiffrée** |
| **vertical slice** | Rien. Aucune définition d'un studio, d'un éditeur ou d'une plateforme n'a été trouvée. | **non documenté** (§7) |
| **production vs pre-production** | Magic décrit fonctionnellement les deux (exploratory + vision = amont ; set design = construction ; play design = finition) sans employer ces mots. | **structure documentée, vocabulaire non** |

### 2.5 La question posée telle quelle : « est-ce qu'on met tout en pause ? »

**Aucune source primaire lue ne documente une équipe mettant en pause toute la production
non-alpha.** Ce qui est documenté est l'inverse — production de contenu en parallèle
(§2.1, §2.2) — plus un **gel local** sur le fichier de cartes (Magic, §2.3) et des
**fenêtres de stabilité** avant une échéance de certification (Xbox, §1.5 : la certification
complète est un passage, pas un état permanent).

Deux réserves, à ne pas effacer :
- **Un biais de corpus.** Les studios qui publient leur processus sont ceux qui ont réussi et
  qui avaient intérêt à raconter une production parallèle maîtrisée. Une équipe qui a mis
  tout en pause et s'est plantée ne publie pas de blog.
- **Un biais d'outil.** Steam et Epic vendent un modèle (accès anticipé = itérations
  publiques). Leur documentation n'est pas neutre sur la question.

Donc : « on ne met pas en pause » est une **pratique courante attestée**, pas une règle
établie.

---

## 3. Comment on organise les branches

**Point de départ, et il est net : aucune des sources de plateforme ne parle de git.** Elles
parlent de **canaux de builds**. Le modèle de branches est une affaire d'équipe ; le canal est
une affaire de plateforme. Confondre les deux est l'erreur que ce paragraphe évite.

### 3.1 Ce que Steam appelle une branche

- « Branches, also known as Betas, are **specific builds** of your application that you have
  made available publicly or privately through Steam. »
  — <https://partner.steamgames.com/doc/store/application/branches>
- **La branche par défaut est la production** : « The default branch is the version of your
  game delivered to your customers on Steam. » Et la publication y est **manuelle** : « you
  can not set the build live on the default branch automatically. You must do that manually
  in App Admin. » — même URL.
- **Un canal par public** : « you might have beta testers playing one branch, but provide
  Press/Influencer access to a separate branch » ; les branches peuvent être protégées par
  **mot de passe**. — <https://partner.steamgames.com/doc/store/testing>
- **L'usage majoritaire annoncé** : « The most common use of a beta branch is for testing. »
  — doc des branches.

### 3.2 Ce que Google Play appelle une piste (et le piège des codes de version)

- Une **piste** n'est pas une branche : un même build appartient à une piste, et l'appareil
  reçoit « the app version that meets both criteria : contains the **highest version code**
  compatible with the device ; is published to a track the user is eligible to receive ».
  — <https://support.google.com/googleplay/android-developer/answer/9845334>
- **Le piège, écrit tel quel** : « If an app bundle with a higher version code is published to
  the Production track than to a test track where a user opted in, **the user receives the
  production release**. » — même URL. Une « branche de bêta » qui traîne un code de version
  inférieur à la production est **silencieusement ignorée**.
- Les pistes peuvent tourner **en parallèle** : « You can run multiple closed tests and one
  open test at the same time », et les pistes fermées supplémentaires servent explicitement à
  « different development teams that need to address bugs across different features ». — même URL.

### 3.3 Ce qu'Apple appelle un build et un groupe

- « You can share up to **100 builds**, and start testing multiple builds at once » ; les
  **groupes** servent à « create multiple groups and add different builds to each one — for
  example, you might want a specific group to focus on testing on a new platform ».
  — <https://developer.apple.com/testflight/>
- La granularité n'est donc pas la branche mais le **build affecté à un groupe**.

### 3.4 Ce que Microsoft appelle une soumission

- La certification porte sur une **soumission** ; la bêta a son propre jeu d'exigences réduit,
  et une **mise à jour de contenu** est un objet séparé de la soumission initiale (glossaire).
  — <https://learn.microsoft.com/en-us/gaming/game-publishing/glossary>

### 3.5 Le seul texte qui tranche le modèle git — et il se contredit lui-même, exprès

Vincent Driessen, auteur de git-flow, dans une note ajoutée **dix ans après** son article :

> « If your team is doing **continuous delivery** of software, I would suggest to adopt a much
> simpler workflow (like **GitHub flow**) instead of trying to shoehorn git-flow into your
> team. If, however, you are building software that is **explicitly versioned**, or if you
> need to **support multiple versions of your software in the wild**, then git-flow may still
> be as good of a fit […] always remember that panaceas don't exist. »

— <https://nvie.com/posts/a-successful-git-branching-model/> (article du 05/01/2010, note du 05/03/2020)

Le critère est donc **« combien de versions vivent dans la nature en même temps »**, pas
« à quel jalon on est ». Une PWA servie depuis une URL unique est dans le premier cas ; un
jeu qu'on installe sur trois consoles est dans le second.

---

## 4. Ce qui est propre aux jeux de cartes à collectionner / gacha

Trois choses changent, et une seule est une contrainte de plateforme.

### 4.1 Le contenu se gèle **avant** d'être testé, et le test coûte des mois

- Magic : le fichier est verrouillé au début du play design, et le pipeline complet fait
  **2,5 ans + 6 mois** (§2.3). Ce n'est pas de la lenteur : c'est que **l'équilibrage se fait
  sur le fichier gelé**, sinon les données de test ne veulent rien dire.
  — <https://magic.wizards.com/en/news/making-magic/playtesting>
- Le test se fait sur un métagame **futur** (FFL, un an d'avance), avec des tournois internes
  et un off-site « where they take a whole day to play multiple drafts. This event is usually
  what leads to the **final adjustments on costs**. » — même URL.

Conséquence de calendrier, et elle est structurelle : dans un JCC, **le jalon de contenu
précède le jalon de test** — on gèle, puis on teste le gel. C'est l'inverse de ce que Steam
demande pour entrer en accès anticipé, où l'ouverture est justement le moment où « you haven't
yet figured out what players are going to do in your game that makes it fun » est encore vrai
(règle 6, §1.2).

### 4.2 L'économie est du contenu, donc elle entre dans le gel

- Apple, règle 3.1.1 : « Apps offering **“loot boxes”** or other mechanisms that provide
  randomized virtual items for purchase **must disclose the odds of receiving each type of
  item to customers prior to purchase**. »
  — <https://developer.apple.com/app-store/review/guidelines/>
- Corollaire direct : les taux de tirage doivent être **décidés, écrits et publiés** avant la
  mise en vente. Un rééquilibrage de la rareté après publication devient un changement
  d'affichage public, pas un réglage interne.
- Apple interdit aussi, dans la même règle, qu'une monnaie de jeu achetée **expire** :
  « Any credits or in-game currencies purchased via in-app purchase **may not expire**, and
  you should make sure you have a restore mechanism ». — même URL.

### 4.3 La cadence de contenu est le vrai jalon d'un jeu vivant

- Supergiant : « a Major Update every few months containing new features and content,
  followed soon after by patches » (§2.1). Le jalon n'est donc pas « la bêta » mais **la
  régularité des vagues**.
- Steam le dit à sa façon : sans mise à jour du build par défaut depuis plus de **12 mois**,
  la page reçoit automatiquement une mention — « Steam will add a note to the store page […]
  letting players know that the game has not updated in a while ».
  — <https://partner.steamgames.com/doc/store/earlyaccess>

### 4.4 Le gacha réglementé : ce qui n'a pas été vérifié

Les règles japonaises sur le *kompu gacha* (2012) et les décisions belge et néerlandaise sur
les boîtes à butin n'ont **pas** été lues à la source dans ce lot (§7). Ce qui est cité ici
est la règle **Apple**, qui est une condition d'entrée sur un magasin, pas un cadre légal.

---

## 5. Établi / pratique courante / opinion

### 5.1 Établi — une source primaire le dit explicitement

1. Sur Steam, l'accès anticipé s'ouvre sur un jeu « in a playable alpha or beta state » et se
   ferme quand le produit est « feature complete and no longer in a significant state of
   change ». (Steamworks)
2. Sur Google Play, la production est **inaccessible** à un compte personnel récent sans un
   test fermé de **12 testeurs pendant 14 jours consécutifs**. (Play Console Help)
3. Sur Apple, une bêta ne peut pas être distribuée par l'App Store, et les **mises à jour
   significatives** de la bêta repassent en revue. (App Review Guidelines 2.2)
4. Sur Xbox, une bêta est certifiée contre un **sous-ensemble réduit** des exigences, la
   frontière avec le jeu complet est étanche, et sortir de bêta impose une **certification
   complète**. (Microsoft Learn)
5. Chez Wizards, un set est **gelé** (« the file is locked down », « pencils-down moment »)
   avant d'être testé en profondeur, et les étapes set design / play design sont les seules
   à se recouvrir. (Making Magic, 10/08/2026)
6. L'auteur de git-flow recommande **GitHub flow** pour du logiciel livré en continu, et
   réserve git-flow aux logiciels « explicitly versioned » ou multi-versions. (nvie.com, 2020)
7. Une mise en vente d'objets virtuels aléatoires impose la **publication des taux**. (Apple 3.1.1)

### 5.2 Pratique courante — attestée par un studio, non normée par une plateforme

1. On **continue de produire du contenu** pendant le test public, par vagues de plusieurs mois.
   (Supergiant, *Hades* et *Hades II*)
2. Le moment d'ouverture est choisi pour que **le retour soit encore actionnable**.
   (Supergiant, FAQ *Hades II*)
3. Le test public se fait sur un **canal séparé** de la production : appID enfant chez Steam,
   piste chez Google, groupe de builds chez Apple. C'est une pratique constante des trois
   plateformes, mais aucune ne l'énonce comme une règle générale.
4. Un jeu de cartes se teste **en avance de phase** sur un métagame simulé. (FFL de Magic —
   c'est une pratique de studio, pas une norme du secteur)

### 5.3 Opinion — ou non étayé, et signalé comme tel

1. **« Alpha = feature complete, beta = content complete »** : formule très répandue, **aucune
   source primaire trouvée** qui la définisse. Les sources primaires décrivent **qui joue**,
   pas un contenu requis pour porter le nom.
2. **La « vertical slice »** comme jalon obligatoire : **aucune définition primaire trouvée**.
3. **Les jalons de contrat éditeur** (« milestone gate » au sens contractuel, avec paiement à
   la clé) : c'est le sens le plus courant du mot dans l'industrie, et **aucun contrat n'est
   public**. Rien ici ne l'étaye.
4. Toute affirmation du type « les studios font X » qui ne serait pas adossée à un texte de
   studio cité ci-dessus est une opinion, y compris dans la §6.

---

## 6. Ce que ça implique pour un projet solo assisté d'agents

Chaque ligne dit si elle vient d'une source ou si c'est une déduction.

1. **(source, §1.1)** Aucune des quatre plateformes documentées ne définit ce qu'exige le mot
   « beta » ; toutes l'attachent à une **population** et à une **règle d'accès** (12 testeurs
   × 14 jours, 10 000 puis 50 000 utilisateurs, 100 / 10 000 testeurs, un appID enfant). Une
   alpha que personne n'a jouée ne peut donc pas être qualifiée par ce vocabulaire — c'est un
   prototype, et l'appeler autrement ne change que l'étiquette.
2. **(source pour les seuils, déduction pour la transposition)** Les seuls critères de sortie
   **chiffrés** trouvés sont des seuils de population : 12 testeurs × 14 jours (Google Play),
   10 000 / 50 000 utilisateurs (Xbox). Un projet solo peut s'en donner un du même genre —
   « N testeurs, D jours, une question à laquelle ils répondent » — et il sera plus vérifiable
   qu'une liste de tickets fermés.
3. **(source, §2.1)** La production **ne s'arrête pas** pendant le test public : elle se
   poursuit par vagues. Les 23 tickets beta ne sont donc pas en concurrence avec l'alpha ;
   ils sont la vague suivante, à condition de ne pas toucher ce que l'alpha mesure.
4. **(source §2.3, déduction pour la frontière)** Pour un **jeu de cartes**, le gel documenté
   porte sur **le fichier du set** — valeurs, coûts, courbes (Magic : « the final adjustments
   on costs »). Le transposer tel quel à un projet donne : un ticket beta qui touche une
   valeur de carte, une courbe ou un taux de tirage tombe sous le gel ; un ticket qui touche
   l'écran, la robustesse ou la performance n'y tombe pas. Cette frontière est mon découpage,
   pas une règle écrite.
5. **(source, §3.5)** Une PWA servie depuis une URL unique est dans le cas « continuous
   delivery » : le modèle recommandé par l'auteur de git-flow est GitHub flow, c'est-à-dire
   ce que le dépôt fait déjà (D-113). **Le modèle de branches n'a pas de raison de changer
   pour un jalon.**
6. **(source, §3.1 à §3.3)** Ce qui manque à un projet qui ouvre une bêta n'est pas une
   branche, c'est un **canal** : deux versions servies, deux populations, et un chemin de
   retour. Chez Steam c'est un appID enfant ; sur le web, c'est une URL et un indicateur —
   c'est une décision d'infrastructure, pas de `git`.
7. **(source, §4.2)** Dès qu'il y a des arrivages payants ou des taux de rareté, **les taux
   deviennent un livrable de sortie**, pas un réglage : ils doivent être écrits et publiés
   avant la mise en vente (Apple 3.1.1). À décider tôt, parce que ça se gèle avec le contenu.
8. **(déduction)** Pour un solo assisté d'agents, le coût réel d'un jalon n'est pas le
   développement mais **la boucle de retour** : sans joueur, un agent produit du volume sans
   signal. Le jalon le plus rentable est donc celui qui **branche des joueurs**, pas celui qui
   ferme des tickets.
9. **(déduction)** Les sources décrivent toutes un **état stable et complet** comme condition
   de sortie (Steam, Xbox, Apple). Un projet qui sort de bêta doit pouvoir dire ce qui est
   stable ; « tous les tickets sont fermés » n'est pas cette phrase.
10. **(déduction, et c'est la limite de ce lot)** Aucune source primaire ne traite du cas
    « une seule personne assistée d'agents ». Tout ce qui précède transpose des pratiques
    d'équipes ; la transposition est un raisonnement, pas une preuve.

---

## 7. Sources non trouvées

Cherché, sans résultat exploitable :

1. **TRC PlayStation** (Technical Requirements Checklist) et exigences de certification Sony :
   portail partenaire, sous NDA. Aucune version publique.
2. **Lotcheck Nintendo** : non public.
3. **« Certification step-by-step guide » de Microsoft** : la page
   <https://learn.microsoft.com/en-us/gaming/game-publishing/concepts/certification/certification-guide>
   répond **200** mais affiche « Access to this page requires authorization ». Son contenu
   n'apparaît que dans l'index des moteurs de recherche ; il n'est donc **pas** cité ici comme
   lu.
4. **Définition primaire de « vertical slice »** : cherchée côté GDC, studios et plateformes.
   Les résumés de conférences GDC sont publics, les interventions elles-mêmes sont derrière
   le paywall ou en vidéo — rien de citable en texte.
5. **Définition primaire de « feature freeze », « content lock », « milestone gate »** comme
   termes : absents de toute la documentation de plateforme lue. Seule leur **pratique** est
   documentée (§2.4).
6. **Post-mortem signé par un studio décrivant explicitement son gel de fonctionnalités** :
   non trouvé. Larian, Rami Ismail, Supergiant sur ce point précis : les recherches n'ont pas
   remonté d'article de processus.
7. **Réglementation gacha** : la décision japonaise sur le *kompu gacha* (Agence japonaise
   des affaires de consommation, 2012) et les positions belge et néerlandaise sur les boîtes
   à butin n'ont pas été lues à la source. Non citées.
8. **Exigence d'odds de Google Play** : la page de politique « Real-Money Gambling, Games, and
   Contests » a été ouverte, mais l'exigence sur les objets aléatoires est dans la politique
   de monétisation, qui n'a pas été lue. Seule la règle Apple est citée.
9. **Chromium, comme exemple de branches par jalon** : la page des canaux de version et le
   document `release_branches.md` n'ont pas été récupérés (page vide, puis 404). Non cités.
