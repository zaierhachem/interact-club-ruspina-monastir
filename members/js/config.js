/* =========================================================================
   ICRM — ESPACE MEMBRES · CONFIGURATION
   Backend, rôles, navigation et permissions. Aucune logique de sécurité ici :
   ces données décident de ce qui est AFFICHÉ. L'accès réel aux données est
   imposé par Supabase (Auth + Row Level Security côté PostgreSQL).
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal = window.ICRMPortal || {};
  P.views = P.views || {};

  /* Permissions par rôle — cumulatives (chaque rôle hérite du précédent). */
  var MEMBER = ['commission:select', 'proposals:create', 
    'profile:read-own', 'profile:edit-own', 'calendar:read', 'commission:read-own',
    'meetings:read', 'tasks:read-own', 'tasks:update-own', 'documents:read', 'announcements:read'
  ];
  var HEAD   = MEMBER.concat(['tasks:create', 'meetings:create', 'commission:manage', 'proposals:review', 'tasks:validate']);
  var BUREAU = HEAD.concat(['members:read-all', 'announcements:create', 'documents:upload', 'documents:delete', 'analytics:read',
                            'meetings:delete', 'announcements:delete', 'attendance:manage']);   // suppression : Bureau exécutif et Super Admin uniquement
  var ADMIN  = BUREAU.concat(['roles:manage', 'audit:read', 'proposals:delete', 'tasks:delete']);

  var MEMBER_NAV = ['dashboard', 'profil', 'calendrier', 'commission', 'reunions', 'taches', 'documents', 'annonces'];
  var BUREAU_NAV = MEMBER_NAV.concat(['gestion-xp']);

  P.config = {
    APP_NAME: 'Espace Membres',

    /* ---- Backend ---------------------------------------------------------------
       provider : 'supabase' (production) | 'mock' (données fictives, sans authentification,
                  conservé temporairement comme référence de développement).
       'supabase' → js/providers/supabase.js ; 'mock' → js/providers/mock.js.
       RÈGLES : seuls l'URL du projet et la clé PUBLISHABLE (publique) peuvent apparaître ici.
       JAMAIS de clé « secret » (sb_secret_…), de clé service_role ni de mot de passe de base ;
       aucun fichier .env côté navigateur. supabase-client.js refuse de démarrer si une clé privée est détectée. */
    BACKEND: {
      provider: 'supabase',
      supabase: {
        /* URL de l'API du projet « interact-ruspina-members » : https://<référence-du-projet>.supabase.co
           (≠ de l'URL du tableau de bord supabase.com/dashboard/...). */
        url: 'https://izxhzmllfdbbvlyoeifz.supabase.co',
        /* Clé PUBLISHABLE (publique par conception : elle ne donne accès qu'à ce que permettent
           l'authentification et les politiques RLS). Une clé « sb_secret_ » ou service_role est refusée au démarrage. */
        publishableKey: 'sb_publishable_jpQqgCWB6BcbOKKo4XtbsA_KaurghnW'
      }
    },

    /* Statuts de profil (enum PostgreSQL profiles.status : active | follow_up | inactive).
       USABLE_STATUSES = statuts qui ouvrent l'interface. « follow_up » reste utilisable (suivi par le bureau) ;
       « inactive » — comme toute valeur inconnue ou vide — est refusé (liste blanche, fail-closed).
       NB : contrôle d'AFFICHAGE uniquement. L'accès réel aux données doit aussi être refusé par la base (RLS) :
       voir supabase/migrations/…_enforce_member_status_rls.sql (à relire avant application). */
    USABLE_STATUSES: ['active', 'follow_up'],

    /* Entrées de navigation principale (id → route hash). */
    NAV_PRIMARY: [
      { id: 'dashboard',  label: 'Dashboard',     icon: 'dashboard' },
      { id: 'profil',     label: 'Mon Profil',    icon: 'user' },
      { id: 'calendrier', label: 'Calendrier',    icon: 'calendar' },
      { id: 'commission', label: 'Ma Commission', icon: 'users' },
      { id: 'reunions',   label: 'Réunions',      icon: 'message' },
      { id: 'taches',     label: 'Mes Tâches',    icon: 'tasks' },
      { id: 'gestion-xp', label: 'Gestion XP', icon: 'users' },
      { id: 'documents',  label: 'Documents',     icon: 'file' },
      { id: 'annonces',   label: 'Annonces',      icon: 'megaphone' }
    ],
    NAV_SECONDARY: [
      { id: 'parametres', label: 'Paramètres', icon: 'settings' }
    ],

    /* Rôles. `home` = vue d'accueil. Les dashboards Commission / Bureau exécutif / Super Admin
       seront de nouvelles vues enregistrées dans ICRMPortal.views, puis
       référencées ici (home + nav) : aucune autre modification de l'architecture. */
    ROLES: {
      member:          { label: 'Membre',            home: 'dashboard', nav: MEMBER_NAV, permissions: MEMBER },
      commission_head: { label: 'Bureau élargi', home: 'dashboard', nav: MEMBER_NAV, permissions: HEAD },   // TODO : dashboard commission
      bureau:          { label: 'Bureau exécutif',   home: 'dashboard', nav: BUREAU_NAV, permissions: BUREAU }, // TODO : dashboard bureau
      super_admin:     { label: 'Super admin',       home: 'dashboard', nav: BUREAU_NAV, permissions: ADMIN }    // TODO : administration
    }
  };

  /* Session courante (renseignée au démarrage par ICRMPortal.api.getSession()).
     can() sert uniquement à l'affichage — ce n'est PAS un contrôle d'accès. */
  P.session = { user: null, role: 'member', permissions: [] };
  P.can = function (permission) { return P.session.permissions.indexOf(permission) > -1; };
})();
