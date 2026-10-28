/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * La version de l'application et son étape, injectées au build depuis `package.json`
 * (voir le bloc `define` de `vite.config.ts`). Une seule source, jamais recopiée.
 */
declare const __APP_VERSION__: string;
declare const __APP_STAGE__: string;
