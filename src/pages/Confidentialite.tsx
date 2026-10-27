/**
 * La page de confidentialité — publique, et **hors de la garde des comptes**.
 *
 * Elle est exigée par Google pour publier l'application OAuth (`D-088`), et elle a une
 * raison propre : depuis D-088 on demande un compte, et depuis D-086 on garde la trace des
 * parties — solo comme à deux (D-105). Une page qui ne dit pas ce qu'on collecte serait un
 * mensonge par omission.
 *
 * Trois règles d'écriture, et elles ne bougeront pas :
 *
 * 1. **on écrit ce qu'on fait, pas ce qu'on aimerait faire** : chaque ligne correspond à une
 *    colonne réellement écrite en base (`supabase/migrations/`) ;
 * 2. **aucun jargon** : pas de « données à caractère personnel », pas de « finalité
 *    légitime » — des phrases, et des exemples ;
 * 3. **elle se lit sans compte** : la route est déclarée hors de `Layout`, comme
 *    `/connexion`, sinon un visiteur devrait s'inscrire pour lire ce qu'on collecte.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Le courriel de contact, pour demander la suppression de ses données.
 *
 * **À confirmer par Bastien avant publication** : c'est la seule adresse publiée du site, et
 * elle doit être une adresse qui lui appartient et qu'il relève. Elle ne doit pas porter
 * l'ancien nom du projet (`AGENTS.md` §3).
 */
export const CONTACT = 'planquex@4k7.org';

interface Rubrique {
  titre: string;
  lignes: string[];
}

const COLLECTE: Rubrique[] = [
  {
    titre: 'Un compte, pour te reconnaître',
    lignes: [
      'Si tu te connectes avec Google, on reçoit ton adresse de courriel et un identifiant technique.',
      'Si tu crées un compte avec un mot de passe, on garde ton adresse de courriel ; le mot de passe est chiffré et nous ne le voyons jamais.',
      'Ton pseudo est choisi dans Réglages. Il vit sur ton appareil et il accompagne ce que tu écris ; sans pseudo, c’est « anonyme ».'
    ]
  },
  {
    titre: 'Ce que tu écris sur le mur',
    lignes: [
      'Un post-it : son titre, son texte, l’écran concerné, la version du jeu, et le lien de capture si tu en mets un.',
      'Tes commentaires, et tes pouces (un par post-it, pour savoir combien de personnes sont d’accord).',
      'Ces textes sont visibles de tous les testeurs : c’est un mur, pas une boîte aux lettres.'
    ]
  },
  {
    titre: 'Tes parties terminées',
    lignes: [
      'Le déroulé de la partie, solo comme à deux : la graine de hasard, les deux Decks, les types de café et la suite des actions jouées.',
      'Cela sert à voir comment le jeu est réellement joué, et où il coince.',
      'Ni ton pseudo, ni ton adresse, ni aucun texte de ta part n’y figurent.'
    ]
  },
  {
    titre: 'Ce qui part du mur quand il bouge',
    lignes: [
      'Quand un post-it arrive sur le mur, et chaque fois que son statut change (retenu, en cours, fait, écarté avec sa raison), une annonce part dans le salon #comite du serveur des testeurs : la famille (idée ou signalement), le titre, ton pseudo et le lien vers la page du comité.',
      'Un gueulage, lui, s’annonce sans rien dire de lui : on annonce qu’il est arrivé, jamais son texte — ni son titre.',
      'Rien d’autre ne part : ni ton compte, ni ton adresse de courriel, ni ton identifiant, ni tes votes, ni tes commentaires. Le pseudo est la seule chose qui te nomme, et il est déjà visible de tous sur le mur.',
      'Ces annonces partent de la base du jeu, pas de ton navigateur : le jeu n’embarque aucun code de Discord, et ne pas rejoindre le serveur ne change rien à ce qui part.'
    ]
  },
  {
    titre: 'Ce qu’on ne fait pas',
    lignes: [
      'Aucune publicité, aucun traceur publicitaire, aucune revente de données.',
      'Aucun profilage : on ne cherche pas à te connaître, on cherche à savoir si le jeu tient.',
      'Rien d’autre que ce qui est écrit ci-dessus : les tables de la base portent ces champs-là, et pas d’autres.'
    ]
  }
];

const QUESTIONS: Rubrique[] = [
  {
    titre: 'Le serveur des testeurs (facultatif)',
    lignes: [
      'Le lien « Rejoindre le serveur des testeurs », dans Réglages et au pied du comité, ouvre Discord : c’est un service à part, hors du jeu, et on peut jouer sans jamais y aller.',
      'Si tu le rejoins, Discord applique ses propres règles et sa propre politique de confidentialité : ce que tu y écris ne dépend plus de nous.',
      'Le jeu n’embarque ni iframe, ni script, ni widget Discord : avant que tu cliques, rien de Discord n’est chargé, et la promesse « aucun traceur » tient toujours.'
    ]
  },
  {
    titre: 'Combien de temps',
    lignes: [
      'Le temps de l’alpha, c’est-à-dire le temps de recueillir assez de retours pour décider de la suite.',
      'Tu peux demander la suppression de ton compte et de ce que tu as écrit à tout moment : écris-nous, et c’est fait.'
    ]
  },
  {
    titre: 'Voir, corriger, supprimer',
    lignes: [
      'Tu peux corriger ou retirer tes post-its depuis le mur, tant qu’ils n’ont pas été triés.',
      'Tu peux retirer tes commentaires. Pour le reste — ton compte, tes parties enregistrées — demande-le nous.'
    ]
  },
  {
    titre: 'Un doute',
    lignes: [
      'Écris-nous : le comité est là pour ça, et un courriel marche aussi.',
      'Cette page dit ce que le jeu fait aujourd’hui. Si elle cesse d’être vraie, c’est un bug, et on la corrige.'
    ]
  }
];

function Bloc({ rubrique }: { rubrique: Rubrique }) {
  return (
    <section className="section panel">
      <h2>{rubrique.titre}</h2>
      <ul className="liste-points m-0 flex flex-col gap-2 pl-5 text-[0.92rem] leading-relaxed">
        {rubrique.lignes.map((ligne) => (
          <li key={ligne}>{ligne}</li>
        ))}
      </ul>
    </section>
  );
}

export function Confidentialite() {
  return (
    <div className="page">
      <section className="section panel">
        <h1 className="m-0 font-heading text-[1.5rem] font-bold">Confidentialité</h1>
        <p className="muted m-0 max-w-[62ch]">
          Le Bureau des Planqués est un jeu d’alpha, testé par quelques testeurs. Voici, en clair et sans formule, ce
          que le jeu garde de toi, et pourquoi.
        </p>
      </section>

      {COLLECTE.map((rubrique) => (
        <Bloc key={rubrique.titre} rubrique={rubrique} />
      ))}

      {QUESTIONS.map((rubrique) => (
        <Bloc key={rubrique.titre} rubrique={rubrique} />
      ))}

      <section className="section panel">
        <h2>Nous écrire</h2>
        <p className="m-0 text-[0.92rem] leading-relaxed">
          Pour toute question, ou pour demander la suppression de tes données :{' '}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <p className="m-0">
        <Link className="button" to="/">
          <ArrowLeft size={16} /> Retour au bureau
        </Link>
      </p>
    </div>
  );
}
