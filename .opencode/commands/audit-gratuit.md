---
description: Audit d'avancement en lecture seule avec le modèle gratuit
agent: explore
model: openrouter/cohere/north-mini-code:free
subagent: true
---

Audite le projet `planquex/` en **lecture seule**. Ne modifie aucun fichier.

Contexte : **Bureau des Planqués**, PWA TypeScript (Vite + React + Zustand + vite-plugin-pwa) située dans `planquex/`. `../grevomon/grevomon-pocket/` est **legacy** : ne pas l'auditer. Lis `AGENTS.md` (§7 commandes, §8 audits) pour le protocole et l'état de référence.

Ta mission :
1. Vérifie ce qui existe réellement dans `src/` et `public/`.
2. Repère les imports cassés, fichiers manquants, incohérences de types, boutons morts, routes manquantes.
3. Vérifie l'état des tests et du build (`npm run status`, `npm run check`, `npm test`, `npm run build` dans `planquex/`) sans modifier le code.
4. Rends un rapport en français avec : modules faits/partiels/manquants, **exit code et extrait exact** de chaque commande, risques concrets classés, et 10 prochaines actions.
5. **Ne donne pas d'estimation de temps ou de pourcentage inventée.** Si tu ne peux pas mesurer, écris « non mesuré ». N'utilise pas les pourcentages de `../grevomon/grevomon-pocket/PLAN.md`.
6. **Cite la version que tu as regardée** : lis-la à la source — `APP_LABEL` affiché en bas de Réglages, ou `package.json` (`version` + `stage`) — et écris-la dans ton rapport. Un audit sans version ne dit pas ce qu'il a audité ; la règle complète est dans `docs/VERSIONS.md`.

Sois factuel, cite les chemins de fichiers, et distingue clairement les observations des suppositions.
