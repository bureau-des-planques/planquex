// Setup for Node environment tests
// Empty - no DOM APIs needed for pure logic tests
import { afterEach } from 'vitest';
import { reinitialiserArrivage } from './arrivageDeTest';

// Le faux serveur d'Arrivage ne survit pas d'un test au suivant (#651).
afterEach(reinitialiserArrivage);
