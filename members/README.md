# Espace Membres — ICRM

Portail privé de l'Interact Club Ruspina Monastir : HTML / CSS / JavaScript sans framework ni build, compatible avec un hébergement statique. L'authentification et les données passent par **Supabase** (Auth + PostgREST), le client officiel `@supabase/supabase-js@2` étant chargé par CDN.

> Servir le dépôt en **http(s)** (n'importe quel hébergement statique). Les liens de réinitialisation de mot de passe ne fonctionnent pas depuis `file://`.

## Arborescence

```
members/
├─ index.html            portail (coque, landmarks, écran de chargement)
├─ login.html            connexion (e-mail + mot de passe, sans inscription)
├─ reset-password.html   choix d'un nouveau mot de passe (lien reçu par e-mail)
├─ members.css           styles du portail (classes pt-)
├─ auth.css              styles des pages de connexion / réinitialisation (classes pta-)
├─ members.js            garde d'authentification, routeur par hash, navigation, tiroir mobile
├─ README.md
└─ js/
   ├─ config.js              backend (URL + clé publishable), rôles, permissions, navigation, statuts bloquants
   ├─ supabase-client.js     création unique du client + refus de toute clé privée
   ├─ auth.js                erreurs → codes → messages français ; lecture/validation du profil ; déconnexion
   ├─ login.js               logique de connexion et de « mot de passe oublié »
   ├─ reset-password.js      logique du nouveau mot de passe
   ├─ api.js                 façade ICRMPortal.api (le seul point d'entrée des vues)
   ├─ providers/
   │  ├─ supabase.js         fournisseur de production
   │  └─ mock.js             fournisseur de développement (données fictives, sans authentification)
   ├─ mock-data.js           données fictives du fournisseur mock
   ├─ ui.js                  échappement, icônes, dates FR, puces, toasts
   └─ views/                 home.js · planning.js · club.js
```

## Architecture

```
Vues → ICRMPortal.api → providers/<config.BACKEND.provider> → Supabase  (ou données fictives)
```

Les vues ne parlent jamais à Supabase. Changer de fournisseur = changer `BACKEND.provider` dans `config.js` (`'supabase'` | `'mock'`). Le fournisseur mock est conservé temporairement comme référence ; il n'affiche aucune donnée en mode `supabase`.

## Parcours d'authentification

```
/members/  →  écran de chargement (application masquée)
           →  supabase.auth.getSession()
                ├─ pas de session ─────────────────→ /members/login.html
                └─ session → supabase.auth.getUser() (validation serveur)
                     → public.profiles (id = auth.uid())
                          ├─ profil absent / compte non actif → écran d'erreur (jamais le dashboard)
                          └─ OK → ICRMPortal.session {user, rôle depuis profiles.role}
                                   → routeur (#/dashboard …) → vues
login.html →  signInWithPassword → profil + statut vérifiés → /members/
              (profil absent ou inactif : session fermée, message affiché)
Déconnexion → supabase.auth.signOut({ scope: 'local' }) → /members/login.html
```

- **Session** : entièrement gérée par supabase-js (persistance, rafraîchissement du jeton, synchronisation entre onglets). Aucun jeton, mot de passe ou rôle n'est stocké à la main.
- **Événements** (`onAuthStateChange`) : `SIGNED_OUT` → retour au login ; `SIGNED_IN` d'un autre compte → rechargement ; `PASSWORD_RECOVERY` → page de nouveau mot de passe ; `TOKEN_REFRESHED` → rien à faire. Le callback reste synchrone et léger (recommandation Supabase) : tout appel au client y est différé.
- **Erreurs** : chaque erreur (réseau, base, session, profil) est ramenée à un code et à un message français. Aucun message SQL / Postgres n'est affiché ; les détails ne vont qu'à la console (niveau debug).
- **Rôles** : `member`, `commission_head`, `bureau`, `super_admin`, lus dans `profiles.role`. Une valeur inconnue s'affiche comme `member`. Ils pilotent **uniquement l'affichage** (menus, boutons).

## Configuration publique requise

Dans `js/config.js` → `BACKEND.supabase` :

| Champ | Valeur |
|---|---|
| `url` | URL **de l'API** du projet : `https://<ref>.supabase.co` (pas l'URL du dashboard) |
| `publishableKey` | clé « Publishable » du projet (`sb_publishable_…`) |

### Pourquoi la clé Publishable peut être dans le navigateur
Elle est conçue pour être publique : seule, elle n'ouvre aucun droit. Ce que chaque utilisateur peut lire ou écrire est décidé par **Row Level Security** dans PostgreSQL, à partir de son identité authentifiée.

### Pourquoi une clé secrète / service_role ne doit JAMAIS y figurer
Elle contourne la RLS : quiconque ouvre le code source obtiendrait un accès total à la base. `supabase-client.js` refuse de démarrer si la clé configurée est de type `sb_secret_…` ou `service_role`. N'ajoutez jamais de clé privée, de mot de passe de base ni de fichier `.env` dans ce dépôt ; les opérations privilégiées (invitations, gestion des rôles) devront passer par un code serveur (Edge Function), jamais par le navigateur.

## Réglages à faire dans le dashboard Supabase

1. **Authentication → URL Configuration** : renseigner *Site URL* (domaine du site) et ajouter à *Redirect URLs* : `https://<domaine>/members/reset-password.html`.
2. **Authentication → Providers → Email** : activé. Pour un club **sur invitation**, désactiver l'inscription libre (« Allow new users to sign up »).
3. Vérifier que les valeurs de `profiles.status` correspondent à `config.js › USABLE_STATUSES` (`active`, `follow_up` ouvrent l'interface ; tout le reste est refusé) et que `profiles.role` vaut l'un des quatre rôles.

## Tests manuels recommandés (projet réel)

1. Ouvrir `/members/` déconnecté → redirection vers `login.html`.
2. Mauvais mot de passe → message d'erreur, aucun accès.
3. Identifiants du Super Admin → dashboard, rôle « Super admin ».
4. Rafraîchir → la session persiste.
5. Se déconnecter → retour au login ; rouvrir `/members/` → login.
6. Ouvrir `login.html` connecté → redirection vers `/members/`.
7. « Mot de passe oublié ? » → e-mail reçu → nouveau mot de passe.

## Profil et préférences du compte

- **Modifier mes informations** met à jour uniquement `profiles.full_name` et `profiles.phone` pour l'utilisateur connecté. Le rôle, le statut, l'e-mail et les affectations ne sont pas modifiables depuis le profil. L'autorisation finale dépend des privilèges/RLS Supabase existants.
- **Paramètres** enregistre les préférences de notification dans `auth.users.user_metadata.icrm_preferences` via `supabase.auth.updateUser()` en préservant les autres clés de métadonnées. Ces préférences ne sont pas utilisées pour gérer les rôles ou contrôler des permissions.
- **Limite actuelle :** seul le français est pris en charge. Les préférences d'annonces, réunions et tâches sont sauvegardées, mais les envois automatiques par e-mail/push ne sont pas implémentés. L'interface le précise pour éviter de laisser croire que des alertes sont délivrées.
- En mode `mock`, modification du profil et préférences ne changent que la mémoire de démonstration, avec un message explicite. Elles ne touchent jamais Supabase.

## Données

Hors authentification, les tables sont lues en **lecture seule** avec `select('*')` puis converties par `js/providers/mappers.js` (fonctions pures, testées). Le contrat colonne par colonne (existence, RLS, transformation) est dans **`supabase/docs/db-frontend-contract.md`**.

Règles de conversion importantes :
- **Statut de membre** (`profiles.status`) : `active` → actif ; `follow_up` → « À suivre » (utilisable, jamais affiché comme pleinement actif) ; `inactive`, valeur inconnue ou vide → accès refusé (`config.js › USABLE_STATUSES`, liste blanche).
- **Responsable de commission** : `commission_members.position = 'responsable'` (la colonne `role` n'est pas lue).
- **Documents** : niveau d'accès = `documents.access_type` (`all_members` / `commission` / `bureau`) ; toute autre valeur s'affiche « Accès non reconnu » (jamais « libre »). L'étiquette n'accorde aucun droit : la RLS décide. Type de fichier = extension de `name`, sinon de `storage_path`. Aucune URL de téléchargement n'est fabriquée (phase Storage).
- **Présence** (`attendance.status` : `present` / `absent` / `excused` / `late`) : les 4 états sont conservés (Présent / Absent / Excusé / En retard). *Indicateur de présence* = (présent + en retard) ÷ (présent + en retard + absent). Les absences **excusées** sont exclues du numérateur **et** du dénominateur (elles ne comptent pas comme une présence, et ne pénalisent pas le taux) ; elles sont affichées à part.
- **Journal d'activité** : libellé tiré de `entity_type` + `action`, détail lu dans `metadata` (jsonb).
- **Fonctionnalités absentes du schéma initial** (ordre du jour / notes / décisions de réunion, lien tâche→réunion, priorité et pièces jointes d'annonce, dossiers de documents) : l'interface affiche « pas encore disponible » (ou des filtres par niveau d'accès pour les documents) au lieu de simuler un « vide » ; elles s'activent d'elles-mêmes si les colonnes apparaissent (voir `supabase/migrations/`, propositions **non appliquées**).
- Une table illisible ne casse jamais le dashboard (section vide) ; sur une page dédiée, un message français s'affiche.

### Annuaire de commission
Un membre ordinaire peut ne pas pouvoir lire les noms de ses coéquipiers (RLS de `profiles`). Le portail appelle la fonction SQL `commission_directory` si elle existe (migration proposée, non appliquée) et se replie sinon sur `profiles` : noms « Membre », responsable et statuts « — » (jamais « Inactif » par défaut).

### Tests
```bash
node tests/members-mappers.test.js      # conversions base → interface (sans réseau ni dépendance)
```
Les tests de sécurité de la base (pgTAP) sont dans `supabase/tests/database/` (préparés, non exécutés : voir `supabase/README.md`).

## Différences mock / supabase

| | `mock` | `supabase` |
|---|---|---|
| Authentification | aucune | Supabase Auth (e-mail + mot de passe) |
| Données | `mock-data.js` (fictives) | tables PostgreSQL filtrées par la RLS |
| Garde d'accès | aucune | session obligatoire, profil et statut vérifiés |
| Badge « Maquette » | affiché | masqué |
| Déconnexion | message « non disponible » | `signOut()` |

## Création de réunions et d'annonces

Les boutons « Nouvelle réunion » (page Réunions) et « Nouvelle annonce » (page Annonces) ouvrent une fenêtre accessible (`js/forms.js`). Le flux est : validation (`js/payloads.js`) → `ICRMPortal.api.createMeeting` / `createAnnouncement` → fournisseur (`supabase.js` ou `mock.js`).

- **Permissions d'affichage** : Bureau exécutif et Super Admin créent des réunions club ou de commission et des annonces pour tous les publics. Un membre du Bureau élargi ne crée que des réunions de commission, uniquement pour les commissions qu'il gère (`commission_members.position = 'responsable'`). Un membre n'a aucun bouton. **Ces règles ne sont qu'un confort d'interface : la RLS de PostgreSQL décide.**
- **Colonnes écrites** : `meetings` (title, description, scope, kind, commission_id, location, starts_at, ends_at, created_by) ; `announcements` (title, content, audience, commission_id, created_by). Aucune autre colonne n'est envoyée (ni priority, agenda, notes, decisions, meeting_id, attachments, published_at).
- **Heure** : les dates saisies sont des heures de Tunis (Africa/Tunis), converties en UTC par `Intl` ; indépendant du fuseau du poste.
- **Pas de doublon** : chaque formulaire porte un identifiant client (UUID). Un double envoi est bloqué pendant l'enregistrement, et un renvoi après une réponse perdue ne crée pas de second enregistrement.
- **Pas de faux succès** : le succès n'est annoncé que si la base accepte l'insertion (aucun `.select()`, donc aucune lecture de retour supposée). Un refus (RLS, contrainte, réseau, session) est affiché avec « Rien n'a été enregistré » ou « enregistrement non confirmé », et les valeurs saisies sont conservées.
- **Mode maquette** : le fournisseur `mock` ajoute en mémoire seulement, ne touche jamais Supabase, et l'interface annonce « rien n'est enregistré dans la base ».

### Tests
```bash
node tests/members-mappers.test.js    # conversions base → interface
node tests/members-creation.test.js   # validation, règles par rôle, heure de Tunis, erreurs d'écriture
python3 tests/members-creation.e2e.py # parcours complet dans un navigateur, avec un double du client Supabase
```
Le test de bout en bout utilise un **double** de `supabase-js` : il valide le code du portail, pas l'écriture réelle en base (voir `supabase/README.md`).

## Invitations (phase suivante)

Il n'y a volontairement ni inscription ni gestion d'invitations dans cette phase. Le principe prévu : un administrateur invite un membre par e-mail depuis un code **serveur** (Edge Function utilisant l'API d'administration, la clé privée restant côté serveur) ; le membre reçoit un lien, choisit son mot de passe via `reset-password.html`, et son profil (`profiles`) est créé avec le rôle et le statut voulus.

## Ma Commission, propositions d'actions et suppression (phase « commissions »)

- **Ma Commission** : un parcours par rôle. Le membre choisit exactement deux commissions (sélection initiale, une seule fois), puis voit ses deux cartes (responsables, membres, « Proposer une action »). Le membre du Bureau élargi voit ses commissions et sa boîte de réception. Le Bureau exécutif et le Super Admin voient les six commissions et le détail de chacune.
- **Propositions** : formulaire accessible, protection contre la perte de saisie, envoi réel. La base impose l'auteur, la commission et la longueur des champs. Les deux responsables voient la même boîte. Les revues changent le statut avec une note ; chaque changement est tracé.
- **Suppression** : réservée au Bureau et au Super Admin, avec confirmation. Un membre du Bureau élargi ou un membre ordinaire ne supprime jamais, même ce qu'il a créé. Une réunion ayant encore des présences est refusée explicitement (aucune cascade). Les tâches liées à une réunion supprimée sont conservées, sans lien (ON DELETE SET NULL).
- **Fournisseurs** : `supabase.js` appelle uniquement les fonctions et tables décrites dans `supabase/migrations/` ; `mock.js` implémente le même contrat avec des données fictives, et chaque résultat d'écriture porte `mock: true`.

### Tests
```bash
node tests/members-mappers.test.js        # conversions
node tests/members-creation.test.js       # création : validation, rôles, heure de Tunis
node tests/members-commissions.test.js    # commissions, propositions, boîte, revue, suppression (Supabase SIMULÉ)
python3 tests/members-commissions.e2e.py  # parcours navigateur (double SIMULÉ)
python3 tests/members-creation.e2e.py     # création de réunions et d'annonces (double SIMULÉ)
```
Tests de base de données (NON exécutés dans cette livraison) : `supabase/tests/database/*.test.sql`, à lancer en local avec `supabase test db`.
Procédure de déploiement : `supabase/docs/deployment-runbook.md`. Contrôle préalable : `supabase/docs/preflight-commission-heads.sql`.

## ICRM IMPACT (progression, XP, badges)
- Mon Profil affiche le parcours : niveau, barre de progression, badges (obtenus et verrouillés avec leur condition), historique XP, célébration unique.
- Règles et seuils : `supabase/docs/xp-rules.md` (source : `supabase/migrations/20261012100000_member_progression.sql`).
- Les valeurs affichées viennent toujours de la base. En cas d'échec de lecture, le portail affiche une erreur et **n'estime aucune valeur**.
- Validation des tâches : bouton « Valider la tâche » réservé aux membres du Bureau élargi, au Bureau exécutif et au Super Admin, jamais pour sa propre tâche.
- Tests : `node tests/members-progression.test.js` (règles lues dans la migration) ; `python3 tests/members-progression.e2e.py` (double Supabase simulé) ; pgTAP `supabase/tests/database/050_member_progression.test.sql` (**non exécuté**).


## Installation de l’espace membres (PWA)

- `manifest.webmanifest` définit le nom, l’icône et l’ouverture autonome sur `/members/`.
- `service-worker.js` ne met en cache que le shell statique. Les requêtes Supabase, les jetons et les données des membres ne sont jamais mis en cache par ce worker.
- `js/install.js` mémorise `beforeinstallprompt`. Sur les navigateurs qui le fournissent (notamment Chrome Android quand les critères sont remplis), le clic appelle `prompt()` immédiatement, sans modal maison intermédiaire.
- Le CTA d’installation apparaît dans Paramètres et sur la page de connexion, avant authentification, tant que le portail n’est pas déjà installé. Sur iOS, le navigateur ne fournit pas `beforeinstallprompt` : le bouton ouvre un guide compact pour ajouter le portail via Partager → « Ajouter à l’écran d’accueil ». Il n’existe pas d’API web permettant de forcer cette étape sur iOS.
- Si Android ne fournit pas encore de prompt, un guide de secours renvoie au menu du navigateur. Le bouton n’affirme jamais qu’une installation a réussi lorsqu’elle ne l’a pas été.
- Cette fonction installe une PWA/web app, pas un APK Android ni un binaire iOS signé. Une véritable application native nécessite une distribution séparée.
- Le déploiement doit rester en HTTPS. Après publication, contrôler dans Chrome DevTools → Application → Manifest et Service Workers que le manifeste est valide et que le worker est actif.
