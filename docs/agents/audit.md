# Audits — batterie, pièges et format de rapport

Ce document complète `AGENTS.md` §8 (protocole et definition of done restent là-bas). Un audit se fait toujours sur `planquex/`, jamais sur les versions abandonnées.

### 8.2 Batterie de référence

```bash
cd /home/chapax/Documents/opencode/gamedev/planquex
npm run status
npm run check
npm test
npm run build
ls -la dist/index.html dist/sw.js
find src scripts -name '*.test.*' -o -name '*.spec.*'
grep -rn "Galère" src || true
grep -rn "from '@/" src | wc -l
find src -type f | sort
```

Pour un audit de contenu, compter aussi les cartes et les variantes :

```bash
grep -c "base({" src/data/sse.ts
grep -c "variant(" src/data/sse.ts
```

### 8.3 Pièges connus

- **`dist/sw.js` seul ne prouve rien** : il peut rester d'un build isolé antérieur. Le build valide produit `dist/index.html` **et** `dist/sw.js`.
- **`docs/STATUS.md` est daté du 18/10/2026, 20:57**, avant la correction de `scripts/preuves/status.mjs` et de `tsconfig.json`. Ses constats sur le `%20` et `baseUrl` ne sont plus l'état courant ; relancer les commandes.
- **Les pourcentages du `PLAN.md` des versions abandonnées ne s'appliquent pas** à ce projet. Ne pas les recopier.
- `npm test` en échec par absence de tests n'est pas un test réussi.
- Le dossier a un historique git depuis le 18/10/2026, avec plusieurs commits sur `main` : lancer `git log` avant de parler d'un commit, `git worktree list` avant de conclure qu'il n'y a qu'un seul répertoire de travail, et `git status` avant d'affirmer qu'un fichier est à jour.
- Les alias `@/` sont déclarés dans `tsconfig.json` **et** `vite.config.ts` ; un seul des deux ne suffit pas.

### 8.5 Format de rapport

```markdown
## Audit — <date>

Périmètre :
Commandes : <commande> → exit <code> ; extrait :
Observé :
Non vérifié :
Bloquants :
Prochaine action vérifiable :
```

