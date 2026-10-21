import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useStore } from '@/store/useStore';

/**
 * La « Journée d'intégration » : les quatre gestes de la première partie
 * (`AGENTS.md` §3 — le tutoriel s'appelle comme ça, jamais « onboarding »).
 *
 * Volontairement **court** : elle sera imparfaite, c'est assumé pour l'alpha. Elle
 * donne les quatre repères sans lesquels un testeur se perd — où sont ses Planqués,
 * comment en obtenir, comment composer un Chariot, comment lancer un combat.
 *
 * Elle se montre **une fois** (`tutorielVu`, forme persistée v5) et se rouvre depuis
 * Réglages. Le texte suit le vocabulaire du projet, celui de `AGENTS.md` §3.
 */
const ETAPES = [
  {
    titre: 'Ton Parc',
    texte:
      'Tes Planqués vivent dans le Parc, avec leurs variantes. Sur une carte : le Seuil est la limite avant la casse, et le Stress monte jusqu’à lui. Chaque Planqué a une faction, et une seule.'
  },
  {
    titre: 'Ouvre un Arrivage',
    texte:
      'Un Arrivage, c’est cinq cartes : trois communes, une peu commune, une rare au minimum. C’est l’écran d’accueil qui l’ouvre — chaque Arrivage suit son propre tirage.'
  },
  {
    titre: 'Compose ton Chariot',
    texte:
      'Un Chariot, c’est vingt cartes, deux exemplaires maximum du même nom, et au moins un Planqué Entrant. Choisis aussi jusqu’à trois types de café : c’est ce qui paiera tes Pressions.'
  },
  {
    titre: 'Lance un combat',
    texte:
      'Un Planqué au Poste, trois places de Rack derrière. La Pression fait monter le Stress et termine ton tour. Trois Interventions et la partie est à toi — un COMEX en vaut deux.'
  }
] as const;

export function JourneeIntegration() {
  const tutorielVu = useStore((state) => state.tutorielVu);
  const setTutorielVu = useStore((state) => state.setTutorielVu);
  const [etape, setEtape] = useState(0);

  const terminer = () => {
    setTutorielVu(true);
    setEtape(0);
  };

  const courante = ETAPES[Math.min(etape, ETAPES.length - 1)];
  const derniere = etape >= ETAPES.length - 1;

  return (
    <Dialog
      open={!tutorielVu}
      onOpenChange={(ouvert) => {
        if (!ouvert) terminer();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Journée d’intégration — étape {etape + 1} sur {ETAPES.length}
          </DialogTitle>
          <DialogDescription>{courante.titre}</DialogDescription>
        </DialogHeader>

        <p>{courante.texte}</p>

        <div className="actions actions--tight">
          <Button variant="outline" onClick={terminer}>
            Passer
          </Button>
          {derniere ? (
            <Button onClick={terminer}>C’est parti</Button>
          ) : (
            <Button
              onClick={() => {
                setEtape((courant) => courant + 1);
              }}
            >
              Suivant
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
