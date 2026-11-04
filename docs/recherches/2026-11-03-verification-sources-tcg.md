# Vérification contradictoire des sources TCG

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `recherche-tcg-backend/VERIFICATION.md`. Les deux documents qu'il vérifie
> (`RECHERCHE.md`, `A-VERIFIER.md`) ne sont pas archivés. Les citations du tableau sont de
> **courtes citations** (≤ 25 mots) de pages publiques — assistance officielle, conditions
> d'utilisation, wikis — gardées comme preuve de vérification : aucune illustration ni texte de
> carte n'est reproduit. **Écart de copie, en plus des chemins** : quatre occurrences du mot
> retiré par D-117 (6) — il désignait le compte sans lien d'un autre jeu — sont devenues
> « anonyme » ; depuis cette décision le mot est réservé au testeur de l'alpha, et
> `src/renommages.test.ts` le refuse dans `docs/`.

Vérifié le 3 novembre 2026. Périmètre : les dix constats d’`A-VERIFIER.md`, les six sources supplémentaires et les trois contradictions demandées. **13 appels web**, tous par `webfetch`, vers **12 URL distinctes** ; aucune recherche générale ni URL devinée. La FAQ gameplay couvre aussi la source supplémentaire e. La FAQ Pokémon France a nécessité une seconde lecture en HTML, les réponses repliées étant absentes de l’extraction Markdown.

**Bilan des dix constats : 6 confirmés, 4 partiels, 0 non retrouvé, 0 faux.** Les six sources supplémentaires contiennent bien les éléments annoncés, avec les réserves de provenance et de portée ci-dessous. Un constat « confirmé » signifie que la source dit cela, pas que son implémentation a été auditée. Les citations de chaque cellule restent sous 25 mots.

| constat | verdict | citation retrouvée (≤25 mots) | URL |
|---|---|---|---|
| 1. Pocket : connexion obligatoire au lancement | **partiel** — citation exacte retrouvée, mais une erreur liée au réseau ne démontre pas, seule, l’absence de tout démarrage hors ligne. | « Error 102-002-007 typically occurs due to an issue with your device’s current network environment. » | https://support.pokemon.com/hc/en-us/articles/30332689777428-Pok%C3%A9mon-TCG-Pocket-Technical-Troubleshooting-FAQ |
| 2. Pocket : reconnexion PvP de 120 secondes | **confirmé** — environ 120 s, puis défaite ; ne pas transformer cette approximation en plafond technique exact. | « you may attempt to rejoin the match within the reconnection window of around 120 seconds. » | https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ |
| 3. Pocket : résultat conservé si l’application est fermée | **confirmé** — la rubrique porte sur les points des matchs classés ; aucune preuve concernant le solo ou l’interruption avant résolution du combat. | « If you are unable to view the battle results screen (for example if you closed the app), the battle outcome is still recorded » | https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ |
| 4. Pocket : horloge locale inopérante contre des « minuteurs serveur » | **partiel** — l’inefficacité est explicite ; la localisation du mécanisme de contrôle ne l’est pas. Une erreur est possible, pas systématique ni qualifiée d’« erreur serveur ». | « Even if you change the time on your device, you cannot reduce the time for packs or wonder picks to be made available. » | https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ |
| 5. Pocket : sauvegarde transférable conservée sur le serveur | **confirmé** — ne détaille ni toutes les données, ni leur cache local, ni leur modèle d’autorité. | « The save data that can be transferred is the last save data stored on the server. » | https://support.pokemon.com/hc/en-us/articles/30331783530644-Pok%C3%A9mon-TCG-Pocket-Account-Link-and-Data-Transfer-FAQ |
| 6. Pocket : réconciliation « idempotente » des achats | **partiel** — procédure Complete Purchase retrouvée ; ni idempotence, ni protocole de réconciliation, ni lien avec les ouvertures de boosters ne sont documentés. | « If your premium pass becomes unusable while it is still valid, the Complete Purchase process may resolve the issue. » | https://support.pokemon.com/hc/en-us/articles/30331739144596-Pok%C3%A9mon-TCG-Pocket-Purchase-and-Premium-Pass-FAQ |
| 7. Pocket : interdiction de session simultanée sur plusieurs terminaux | **confirmé** — article 11.3 ; une règle contractuelle et la FAQ indiquent l’impossibilité d’usage simultané, pas le mécanisme d’éviction du premier terminal. | « Users cannot log in and use the same account linked with this Service from multiple devices at the same time. » | https://www.apppokemon.com/tcgp/kiyaku/kiyaku001/rule/detail/en/ |
| 8. Pocket : outils non autorisés et reverse engineering interdits | **confirmé** — articles 17.1.8 et 17.1.13 ; vise notamment les logiciels non autorisés modifiant l’application, pas tout outil tiers. Aucune efficacité anti-triche démontrée. | « for example bots, mods, hacks, and scripts » ; « decompiling, disassembly, or reverse engineering » | https://www.apppokemon.com/tcgp/kiyaku/kiyaku001/rule/detail/en/ |
| 9. Marvel Snap : compte anonyme « local », puis liaison après tutoriel | **partiel** — parcours anonyme optionnel et sollicitation après Deck Edit confirmés ; stockage « local » absent. La connexion Google/Apple peut aussi être choisie d’emblée. | « If you chose New Game to login with a Guest account » ; « after you've finished the Deck Edit tutorial » | https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/52-how-do-i-link-my-account/ |
| 10. Hearthstone : contenu des paquets déterminé à l’ouverture | **confirmé dans le wiki secondaire** — phrase exacte retrouvée ; ne précise pas « côté serveur » et ne concerne pas Pocket. Sources sous-jacentes non contrôlées ici. | « The contents of each pack are decided at random, at the time of opening. » | https://hearthstone.wiki.gg/wiki/Card_pack |
| a. Pocket : Domain-Centred et capacité de test 1 M RPS / 20 M QPS | **confirmé** — notice officielle CEDEC 2026, intervenant DeNA ; décrit une capacité de test, pas un trafic réel mesuré en production. Diapositives derrière connexion, non lues. | « Domain-Centred なアーキテクチャ » ; « 100万 RPS / 2,000万 QPS 水準の負荷試験が可能な内製負荷試験フレームワーク » | https://cedil.cesa.or.jp/cedil_sessions/view/3334 |
| b. Pocket : API et Battler sur GKE, Spanner et Memorystore | **confirmé comme propos du compte rendu secondaire** — texte explicite, attribué à une présentation de deux intervenants DeNA ; pas une publication d’ingénierie DeNA elle-même. | « API Server(GKE Cluster) » ; « Battler Server(GKE Cluster) » ; « Memorystore for Redisや Cloud Spanner が利用されています » | https://qiita.com/asahide/items/aa95654f2e0fc21f0cee |
| c. Pocket : serveurs dédiés PvP, GKE + Agones, objectif 1,5 M connexions | **confirmé** — notice officielle CEDEC 2025, intervenant DeNA ; gestion des connexions et progression des combats, anti-triche et équité. Objectif de test, pas audience réelle attestée. | « 専用ゲームサーバ (Dedicated Game Server) » ; « 150 万同時接続数を目標 » ; « GKE 及び Agones を採用しましたが » | https://cedec.cesa.or.jp/2025/timetable/detail/s67af0efb33af1 |
| d. Pocket : connexion requise aussi pour paquets et solo | **confirmé dans cette source secondaire de fans** — réponse retrouvée dans le HTML, sous la question internet ; ne décrit aucun protocole de validation des résultats. | « Yes, the game requires a connection to work, including to open packs and play solo. » | https://www.pokemon-france.com/en/guides/pokemon-tcg-pocket/faq/ |
| e. Pocket : fenêtre de reconnexion versus d’environ 120 s | **confirmé** — même page et même passage que le constat 2 ; pas une preuve indépendante supplémentaire. | « you may attempt to rejoin the match within the reconnection window of around 120 seconds. » | https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ |
| f. Legends of Runeterra : autorité du serveur de jeu | **confirmé** — billet primaire Riot du 31 mai 2021 ; décrit l’architecture de LoR à cette date, pas celle de Pocket. | « LoR is game-server authoritative » | https://www.riotgames.com/en/news/legends-runeterra-cicd-pipeline |

## Trois contradictions tranchées

### 1. « Fournisseur cloud / infrastructure : non public » — faux

**Ce que les sources disent :**

- **a, primaire :** la notice CEDEC 2026 annonce « Cloud Spanner を使うアプリケーションの負荷試験手法 » : méthodes de test de charge pour une application utilisant Cloud Spanner. Elle documente aussi Domain-Centred et la capacité du framework de test. Elle ne dit pas dans ce texte que toute l’infrastructure appartient à un fournisseur unique.
- **b, secondaire :** le compte rendu décrit explicitement API Server et Battler Server en clusters GKE, des bases « Memorystore for Redis » et « Cloud Spanner », ainsi que l’adoption d’Axion/C4A de Google Cloud dans GKE. Il distingue aussi les charges testées du trafic réel, qu’il dit non public.
- **c, primaire :** « 専用ゲームサーバの管理基盤には GKE 及び Agones を採用しましたが » : adoption de GKE et Agones pour la plateforme de gestion des serveurs dédiés. Le texte vise expressément **だれかとバトル**, le combat en ligne, et non le solo.

**Verdict :** les lignes 48 et 58 de `RECHERCHE.md` doivent être corrigées. Il existe au moins deux notices publiques de conférences DeNA détaillant des éléments techniques de Pocket. **Google Cloud est identifiable par les produits publiquement nommés : GKE et Cloud Spanner.** L’identité du fournisseur de ces services est une identification technique ; l’affirmation que **tous** les services de Pocket seraient exclusivement chez Google ne découle pas de ces notices. Agones seul ne désigne pas un fournisseur cloud.

### 2. « Identifiant anonyme hébergé sur le serveur ; Nintendo/Google/Apple facultatif » — partiellement étayé, pas intégralement sourcé

**Sources et citations retrouvées :**

- FAQ achats officielle : « If you reinstall the app without linking your save data to an account » ; la suite explique que la récupération autonome est impossible. La même FAQ traite explicitement le cas « If no account is linked, please follow step 5. » Source : https://support.pokemon.com/hc/en-us/articles/30331739144596-Pok%C3%A9mon-TCG-Pocket-Purchase-and-Premium-Pass-FAQ
- FAQ liaison officielle : « You can link an account from the game’s title screen or main menu. » Elle énumère Nintendo, Google et Apple, avec restrictions d’âge et Apple limité à iOS. Source : https://support.pokemon.com/hc/en-us/articles/30331783530644-Pok%C3%A9mon-TCG-Pocket-Account-Link-and-Data-Transfer-FAQ
- Cette dernière FAQ confirme séparément « the last save data stored on the server ». Les CGU mentionnent un « support ID », mais pas sa génération automatique ni son emploi comme jeton d’authentification anonyme.

**Verdict :** l’existence d’une sauvegarde jouable **non liée à un compte tiers** est bien étayée par une source primaire ; la liaison facultative est cohérente avec les procédures officielles. En revanche, **le parcours initial précis**, « identité anonyme hébergée », « Support ID généré automatiquement » et la façon d’authentifier ce compte ne sont **pas retrouvés** dans les pages contrôlées. Relier l’existence de sauvegardes serveur à celle de sauvegardes non liées pour reconstruire une architecture d’identité est une **déduction**, pas une citation. Le parcours anonyme de Marvel Snap ne peut pas prouver celui de Pocket.

### 3. « Le solo passe par le serveur pour valider ses récompenses » — non établi

**Source et citation retrouvée :** la source d dit seulement « including to open packs and play solo » dans sa réponse sur la connexion obligatoire. La FAQ gameplay officielle mentionne les récompenses et missions, mais ne décrit pas la validation serveur d’un résultat solo. Les sources a et b ne séparent pas explicitement les modes de combat ; c traite du PvP. La sauvegarde serveur et la persistance des points classés ne prouvent pas le protocole du solo.

**Verdict :** aucune citation contrôlée n’établit que **la simulation solo s’exécute côté client**, que le résultat est vérifié côté serveur, ou qu’un journal d’actions est rejoué avant récompense. L’affirmation de `RECHERCHE.md` ligne 39 doit devenir **hypothèse non vérifiée**. Connexion obligatoire ≠ simulation serveur ≠ validation anti-triche des récompenses. « Authentifier une requête » n’est pas davantage « vérifier la légitimité du résultat ».

## Ce que ces faits permettent de conclure pour un jeu de cartes web dont le solo est joué côté client

- **Fait :** Pocket documente une sauvegarde serveur et des serveurs dédiés pour ses combats en ligne ; Riot décrit LoR comme serveur autoritaire.
- **Fait :** aucune source contrôlée ne démontre le protocole anti-triche des récompenses solo de Pocket.
- **Déduction :** on peut séparer simulation solo locale et stockage distant sans prétendre que cela reproduit Pocket.
- **Déduction :** exiger une connexion ou un compte n’atteste pas qu’un résultat calculé par un client modifiable soit légitime.
- **Déduction :** une économie partagée exige de décider explicitement quels résultats et mutations le serveur est capable de vérifier.
- **Déduction :** vérifier un journal en rejouant le moteur est une option à évaluer, pas une pratique de Pocket établie ici.
- **Déduction :** ni GKE/Spanner ni les objectifs de charge de Pocket ne justifient à eux seuls la même infrastructure pour un petit jeu web.
- **Déduction :** idempotence, reprise après coupure et anti-triche sont des propriétés à spécifier et tester séparément.
