/* =========================================================================
   ICRM — ESPACE MEMBRES · FAÇADE API
   Les vues n'appellent QUE ICRMPortal.api.*. La façade délègue au fournisseur
   choisi dans ICRMPortal.config.BACKEND.provider :

        Vues  →  ICRMPortal.api  →  providers/supabase.js    (production : Supabase Auth + PostgREST)
                                 →  providers/mock.js        (référence de développement)

   Changer de fournisseur ne demande aucune modification des vues.

   SÉCURITÉ :
   - le navigateur n'embarque que l'URL du projet + la clé « publishable » (publique) ;
   - JAMAIS de clé service_role dans ce code ;
   - l'autorisation réelle = Row Level Security côté base ; ICRMPortal.can() ne protège rien ;
   - identité : supabase.auth.getUser() (vérifiée par le serveur d'authentification).
   ========================================================================= */
(function () {
  'use strict';
  var P = window.ICRMPortal;

  /* Contrat que tout fournisseur doit implémenter (chaque méthode renvoie une Promise). */
  var CONTRACT = ['getSession', 'getDashboard', 'getProfile', 'getCalendar', 'getCommission', 'getMeetings',
                  'getTasks', 'getDocuments', 'getAnnouncements', 'getCommissionAnnouncements', 'getSettings', 'saveSettings', 'updateMyProfile', 'signOut', 'onAuthChange',
                  'getCommissionOptions', 'createMeeting', 'createAnnouncement', 'createTask', 'uploadDocument', 'getDocumentDownloadUrl', 'deleteDocument',
                  'getCommissionCatalog', 'getMyCommissions', 'getCommissionOverview', 'getCommissionDirectory',
                  'getAdminTeamWorkspace', 'adminSaveClubPosition', 'adminDeleteClubPosition', 'adminSetCommissionHeads', 'adminPublishClubLeadership',
                  'selectMyCommissions', 'createActionProposal', 'getMyActionProposals', 'getInboxProposals',
                  'updateProposalReview', 'deleteActionProposal', 'deleteMeeting', 'deleteAnnouncement',
                  'getMeetingRollCall', 'setMeetingAttendance', 'finalizeMeetingRollCall', 'getXpAdjustmentMembers', 'recordXpAdjustment',
                  'getMyProgress', 'getMyBadges', 'getMyXpHistory', 'getMyProgressNotifications',
                  'markProgressNotificationsSeen', 'validateTask', 'getMeetingPolls', 'createMeetingPoll', 'voteMeetingPoll', 'closeMeetingPoll', 'saveMeetingMinutes', 'savePushSubscription', 'removePushSubscription',
                  'updateMyTaskStatus', 'adminDeleteTask'
];

  function provider() { return (P.providers || {})[P.config.BACKEND.provider] || null; }
  function missing(why) { var e = new Error(why); e.code = 'PROVIDER_UNAVAILABLE'; return Promise.reject(e); }

  P.api = {
    contract: CONTRACT,
    providerName: function () { return P.config.BACKEND.provider; },
    isMock: function () { return P.config.BACKEND.provider === 'mock'; }
  };
  CONTRACT.forEach(function (method) {
    P.api[method] = function () {
      var p = provider();
      if (!p) return missing('Fournisseur de données « ' + P.config.BACKEND.provider + ' » introuvable.');
      if (typeof p[method] !== 'function') return missing('Le fournisseur « ' + p.name + ' » n’implémente pas ' + method + '().');
      return p[method].apply(p, arguments);
    };
  });

  /* Vérification de développement : signale un fournisseur incomplet (avertissement, pas une erreur). */
  var p = provider();
  if (p) CONTRACT.forEach(function (m) { if (typeof p[m] !== 'function' && window.console) console.warn('[ICRM] fournisseur « ' + p.name + ' » : méthode manquante ' + m + '()'); });
})();
