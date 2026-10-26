-- Le comité (ex-Boîte à idées) — le mur : post-its, votes, commentaires (#135).
--
-- Contrat de données : `docs/COMITE.md` §3 (« Le fichier du mur »). Le schéma le reprend
-- champ pour champ, avec une différence assumée : `position` éclate en trois colonnes
-- (`position_x`, `position_y`, `position_angle`) plutôt qu'en JSON, pour que les bornes
-- 0–100 / −5–+5 soient tenues par la base et non par le client. La vue `postits_avec_votes`
-- recompose la forme du contrat (`position`, `votes: { up, down }`).
--
-- Décisions : D-058 (le mur, ses deux familles), D-059 (statuts et identité : pseudo local +
-- identifiant d'appareil, pas de compte), D-068 (les trois apparences, le gueulage, la
-- disposition en pourcentage, les pouces qui attendent la base).
--
-- **Identité** : un appareil obtient une identité **anonyme** (Supabase `signInAnonymously`,
-- côté client) ; la clé étrangère de `auteur` / `votant` est donc `auth.uid()`, jamais une
-- valeur écrite par le client. Pas de clé étrangère vers `auth.users` : une identité anonyme
-- peut être purgée côté GoTrue, et un post-it ne doit pas disparaître avec l'appareil qui l'a
-- écrit — le pseudo est recopié sur la ligne, c'est lui que le mur affiche (D-059).
--
-- **Règles d'accès** (acceptance criteria #135) : chaque appareil **lit tout le mur** et
-- **n'écrit que ses lignes**. Une politique par commande, parce qu'une politique `for all`
-- restreinte à l'auteur restreindrait aussi la lecture : les politiques permissives
-- s'additionnent en OU, donc la lecture reste ouverte et l'écriture reste fermée.
-- La garde qui prouve que ces politiques mordent : `supabase/mur.test.ts` (PGlite, PostgreSQL
-- réel en WASM) — il rejoue cette migration, puis une version mutée où les conditions valent
-- `true`, et exige d'y constater la fuite.

begin;

-- ---------------------------------------------------------------------------------------------
-- Les post-its
-- ---------------------------------------------------------------------------------------------

create table public.postits (
  -- « court, stable, jamais réutilisé » (§3). Un id qui suit le nom, comme pour les cartes.
  id             text            primary key check (char_length(btrim(id)) between 1 and 32),

  -- « IP » (Idée de Progrès) ou « OUF » (signalement), et rien d'autre (D-058).
  kind           text            not null check (kind in ('IP', 'OUF')),

  titre          text            not null check (char_length(btrim(titre)) > 0),
  texte          text            not null check (char_length(btrim(texte)) > 0),

  -- Accueil | Collection | Deck | Combat | Réglages | Autre ; vide tant que le formulaire ne le dit pas.
  ecran          text            check (ecran in ('Accueil', 'Collection', 'Deck', 'Combat', 'Réglages', 'Autre')),

  -- Le nom local du posteur (Réglages), « anonyme » s'il n'en a pas (D-059).
  pseudo         text            not null default 'anonyme',
  -- Ce que Réglages affichait chez lui — un retour sans version ne dit pas s'il est encore vrai.
  version        text            not null check (char_length(btrim(version)) > 0),

  -- Le tri (D-059) : en attente → retenu → en cours → fait, plus écarté avec sa raison.
  statut         text            not null default 'en attente'
                                 check (statut in ('en attente', 'retenu', 'en cours', 'fait', 'écarté')),
  raison         text            not null default '',
  -- Le numéro d'issue GitHub, dès qu'il y en a un.
  ticket         integer         check (ticket is null or ticket > 0),

  -- Un gueulage s'affiche blanc et plus grand, même s'il finit en IP ou en OUF (D-068).
  gueulage       boolean         not null default false,

  -- Disposition « collée main », en POURCENTAGE du tableau — jamais en pixels, l'écran change (D-068).
  position_x     double precision not null default 50 check (position_x between 0 and 100),
  position_y     double precision not null default 50 check (position_y between 0 and 100),
  position_angle double precision not null default 0  check (position_angle between -5 and 5),

  -- L'appareil qui a écrit la ligne : une identité anonyme, pas un compte (D-059).
  auteur         uuid            not null default auth.uid(),
  created_at     timestamptz     not null default now(),

  -- « Un post-it écarté sans raison est un mur mort » (§2, D-059) : la base le refuse.
  constraint postits_ecarte_a_sa_raison
    check (statut <> 'écarté' or char_length(btrim(raison)) > 0)
);

comment on table public.postits is
  'Les post-its du mur (D-058). Le jeu lit tout, chaque appareil n''écrit que ses lignes.';
comment on column public.postits.auteur is
  'Identité anonyme de l''appareil (auth.uid()). Pas de FK vers auth.users : un post-it survit à la purge d''une identité.';
comment on column public.postits.position_x is
  'En pourcentage du tableau (0–100), jamais en pixels (D-068).';

-- ---------------------------------------------------------------------------------------------
-- Les votes (un appareil, un vote par post-it)
-- ---------------------------------------------------------------------------------------------

create table public.votes (
  postit_id     text        not null references public.postits (id) on delete cascade,
  -- La contrainte de clé primaire EST la règle « un appareil ne vote qu'une fois par post-it » :
  -- changer d'avis est un UPDATE de sa propre ligne, pas une seconde ligne.
  votant        uuid        not null default auth.uid(),
  sens          text        not null check (sens in ('up', 'down')),
  created_at    timestamptz not null default now(),

  primary key (postit_id, votant)
);

-- ---------------------------------------------------------------------------------------------
-- Les commentaires
-- ---------------------------------------------------------------------------------------------

create table public.commentaires (
  id            bigint      generated always as identity primary key,
  postit_id     text        not null references public.postits (id) on delete cascade,
  auteur        uuid        not null default auth.uid(),
  pseudo        text        not null default 'anonyme',
  texte         text        not null check (char_length(btrim(texte)) > 0),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- La lecture du mur : la forme du contrat, compteurs de pouces compris
-- ---------------------------------------------------------------------------------------------

-- `security_invoker = true` : la vue ne contourne pas les politiques, elle les subit comme
-- n'importe quel lecteur. Sans ça une vue `security definer` (le défaut) lirait les lignes
-- d'autrui avec les droits de son propriétaire — une porte dérobée à côté de la garde.
create view public.postits_avec_votes
with (security_invoker = true) as
select
  p.id,
  p.kind,
  p.titre,
  p.texte,
  p.ecran,
  p.pseudo,
  p.version,
  p.statut,
  p.raison,
  p.ticket,
  p.gueulage,
  jsonb_build_object('x', p.position_x, 'y', p.position_y, 'angle', p.position_angle) as position,
  jsonb_build_object(
    'up', count(*) filter (where v.sens = 'up'),
    'down', count(*) filter (where v.sens = 'down')
  ) as votes,
  p.auteur,
  p.created_at
from public.postits p
left join public.votes v on v.postit_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------------------------
-- Droits : le rôle `authenticated` (l'identité anonyme), et lui seul
-- ---------------------------------------------------------------------------------------------

-- Un appareil non identifié (`anon`) n'a rien à faire ici : on signe d'abord, on lit ensuite.
-- Sans cette révocation, les privilèges par défaut de Supabase ouvriraient les tables à `anon`.
revoke all on public.postits, public.votes, public.commentaires, public.postits_avec_votes from anon;

grant select, insert, update, delete on public.postits      to authenticated;
grant select, insert, update, delete on public.votes        to authenticated;
grant select, insert, update, delete on public.commentaires to authenticated;
grant select on public.postits_avec_votes                   to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS : chacun lit tout, chacun n'écrit que les siens
-- ---------------------------------------------------------------------------------------------

-- `force` est indispensable : sans lui, le propriétaire des tables (le rôle qui a joué la
-- migration) échappe à ses propres politiques.
alter table public.postits      enable row level security;
alter table public.postits      force  row level security;
alter table public.votes        enable row level security;
alter table public.votes        force  row level security;
alter table public.commentaires enable row level security;
alter table public.commentaires force  row level security;

-- Post-its -------------------------------------------------------------------------------------

create policy "postits : chacun lit tout le mur"
  on public.postits for select to authenticated
  using (true);

create policy "postits : chacun colle les siens"
  on public.postits for insert to authenticated
  with check (auteur = auth.uid());

create policy "postits : chacun deplace les siens"
  on public.postits for update to authenticated
  using (auteur = auth.uid())
  with check (auteur = auth.uid());

create policy "postits : chacun retire les siens"
  on public.postits for delete to authenticated
  using (auteur = auth.uid());

-- Votes ----------------------------------------------------------------------------------------

create policy "votes : chacun lit les votes de tous"
  on public.votes for select to authenticated
  using (true);

create policy "votes : chacun vote en son nom"
  on public.votes for insert to authenticated
  with check (votant = auth.uid());

create policy "votes : chacun change d'avis en son nom"
  on public.votes for update to authenticated
  using (votant = auth.uid())
  with check (votant = auth.uid());

create policy "votes : chacun retire son vote"
  on public.votes for delete to authenticated
  using (votant = auth.uid());

-- Commentaires ---------------------------------------------------------------------------------

create policy "commentaires : chacun lit tout"
  on public.commentaires for select to authenticated
  using (true);

create policy "commentaires : chacun commente en son nom"
  on public.commentaires for insert to authenticated
  with check (auteur = auth.uid());

create policy "commentaires : chacun modifie les siens"
  on public.commentaires for update to authenticated
  using (auteur = auth.uid())
  with check (auteur = auth.uid());

create policy "commentaires : chacun retire les siens"
  on public.commentaires for delete to authenticated
  using (auteur = auth.uid());

commit;
