---
description: Audit d’avancement en lecture seule avec le modèle gratuit
agent: explore
model: openrouter/cohere/north-mini-code:free
subagent: true
---

Audite le projet `grevomon-tcg/` en **lecture seule**. Ne modifie aucun fichier.

Contexte : **Bureau des Planqués**, PWA TypeScript (Vite + React + Zustand + vite-plugin-pwa) située dans `grevomon-tcg/`. `grevomon-pocket/` est **legacy** : ne pas l’auditer. Lis `grevomon-tcg/AGENTS.md` (§7 commandes, §8 audits) pour le protocole et l’état de référence.

Ta mission :
1. Vérifie ce qui existe réellement dans `grevomon-tcg/src/` et `public/`.
2. Repère les imports cassés, fichiers manquants, incohérences de types, boutons morts, routes manquantes.
3. Vérifie l’état des tests et du build (`npm run status`, `npm run check`, `npm test`, `npm run build` dans `grevomon-tcg/`) sans modifier le code.
4. Rends un rapport en français avec : modules faits/partiels/manquants, **exit code et extrait exact** de chaque commande, risques concrets classés, et 10 prochaines actions.
5. **Ne donne pas d’estimation de temps ou de pourcentage inventée.** Si tu ne peux pas mesurer, écris « non mesuré ». N’utilise pas les pourcentages de `grevomon-pocket/PLAN.md`.

Sois factuel, cite les chemins de fichiers, et distingue clairement les observations des suppositions.
