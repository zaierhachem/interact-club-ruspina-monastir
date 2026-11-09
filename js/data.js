/* =========================================================================
   INTERACT CLUB RUSPINA MONASTIR — DONNÉES & MÉDIAS
   -------------------------------------------------------------------------
   Ce fichier conserve les médias et les valeurs de secours du site public.
   Les membres du Bureau exécutif sont gérés exclusivement dans Mon équipe.
   Un chemin vide ("") affiche automatiquement un cadre placeholder élégant.
   ========================================================================= */

window.SITE = {

  /* ---------------------------------------------------------------------
     1. MÉDIAS GLOBAUX
     --------------------------------------------------------------------- */
  MEDIA: {
    HERO_VIDEO:        "assets/video/hero.mp4",
    HERO_POSTER:       "assets/img/hero-poster.jpg",
    ROTARY_LOGO:       "assets/logos/rotary.png",
    INTERACT_LOGO:     "assets/logos/interact-blue.png",   // version bleue (fonds clairs)
    INTERACT_LOGO_WHITE: "assets/logos/interact-white.png", // version blanche (fonds sombres)
    ICRM_LOGO:         "assets/logos/NEW_ICRM_LOGO.png",    // logo officiel ICRM (navbar, hero, footer, intro)
    END_GRAPHIC:       "assets/img/NEW_END_GRAPHIC.png",    // visuel final (section contact)
    CLUB_PHOTO:        "assets/img/club.jpg"
  },

  /* ---------------------------------------------------------------------
     2. COORDONNÉES — laisser "" tant que l'information n'est pas fournie
     --------------------------------------------------------------------- */
  CONTACT: {
    EMAIL:     "ruspinamonastirinteractclub@gmail.com",
    PHONE:     "55 578 707",
    INSTAGRAM: "https://www.instagram.com/interact.club.ruspina.monastir?stkn=MTM4YmpwOWw4YXlkYg=="
  },

  /* ---------------------------------------------------------------------
     3. LES 7 ACTIONS — l'ordre du tableau = l'ordre du parcours
        category : "financiere" | "humanitaire"
        layout   : "a" (média à gauche) | "b" (média à droite) | "c" (média pleine largeur)
        media    : { type: "image" | "video", src, poster, alt, position }
        impact   : { value, prefix, suffix, label }  OU  { text }  OU  [ { display, label }, … ] (plusieurs chiffres)
     --------------------------------------------------------------------- */
  ACTIONS: [
    {
      id: "festival-jazz",
      category: "financiere",
      layout: "a",
      title: "FESTIVAL JAZZ",
      subtitle: "",
      axis: [],
      description: [
        "Le Festival Jazz est une action financière organisée par notre club afin de soutenir un projet d’intérêt public en faveur d’une maternité. Pendant sept jours, le festival accueille sept groupes de jazz, offrant au public une programmation musicale variée dans une ambiance conviviale et solidaire.",
        "Au-delà de sa dimension culturelle, cet événement a pour objectif de collecter les fonds nécessaires à l’amélioration des conditions d’accueil et de prise en charge au sein de la maternité. Les bénéfices récoltés sont consacrés au financement d’équipements, de matériel ou de travaux répondant aux besoins de l’établissement et de ses patientes."
      ],
      impact: { value: 500, prefix: "+", suffix: "", label: "PARTICIPANTS" },
      media: {
        type: "image",
        src: "assets/img/festival-jazz.jpg",       // ACTION_FESTIVAL_JAZZ_IMAGE
        alt: "Affiche du Festival Jazz organisé par l’Interact Club Ruspina Monastir",
        position: "50% 50%"
      }
    },
    {
      id: "hadra",
      category: "financiere",
      layout: "b",
      title: "HADRA",
      subtitle: "",
      axis: [],
      description: [
        "Hadra est notre action financière annuelle, organisée afin de collecter les fonds nécessaires au financement de nos projets d’intérêt public.",
        "Cette édition avait pour objectif de soutenir la rénovation des locaux de l’Association AGIM, dédiée à l’accompagnement et à l’intégration des personnes en situation de handicap moteur.",
        "Grâce à la mobilisation de nos membres, de nos partenaires et de la communauté, les fonds récoltés ont permis de contribuer à l’amélioration des espaces de l’association, offrant ainsi un environnement plus accueillant, accessible et adapté aux bénéficiaires."
      ],
      impact: { value: 600, prefix: "+", suffix: "", label: "PARTICIPANTS" },
      media: {
        type: "image",
        src: "assets/img/hadra.jpg",                // ACTION_HADRA_IMAGE
        alt: "Affiche de l’action Hadra de l’Interact Club Ruspina Monastir",
        position: "50% 50%"
      }
    },
    {
      id: "leaders-act",
      category: "financiere",
      layout: "a",
      title: "LEADERS’ ACT 8.0",
      subtitle: "Forger l’Avenir",
      axis: ["Leadership & Développement Personnel", "CNIT × ICRM"],
      description: [
        "L’événement phare dédié à la formation et à l’autonomisation des jeunes leaders. À travers des ateliers immersifs, des conférences stimulantes et des opportunités de networking, Leaders’ Act 8.0 offre un espace d’échange interculturel et de développement de compétences clés pour les décideurs de demain."
      ],
      impact: { text: "Formation de dizaines de jeunes, développement de soft skills et création de synergies nationales." },
      media: {
        type: "image",
        src: "assets/img/leaders-act.jpg",         // ACTION_LEADERS_ACT_MEDIA
        alt: "Visuel de Leaders’ Act 8.0, l’événement leadership de l’Interact Club Ruspina Monastir",
        position: "50% 50%"
      }
    },
    {
      id: "hiver-au-chaud",
      category: "humanitaire",
      layout: "c",
      title: "L’HIVER AU CHAUD",
      subtitle: "",
      axis: [],
      description: [
        "L’Hiver au Chaud est notre action annuelle, organisée chaque hiver pour apporter chaleur et réconfort aux familles vivant dans des conditions difficiles, surtout dans les zones rurales ou isolées.",
        "Entre décembre et janvier, nous avons collaboré avec l’Interact Club Ruspina Monastir, le Rotaract Club de Monastir et l’Interact Club Anastasia pour atteindre notre objectif de 700 familles… et nous l’avons dépassé, atteignant 103 %.",
        "Derrière ces chiffres se cachent des sourires, des couvertures, des matelas et un peu de chaleur humaine pour ceux qui en avaient le plus besoin."
      ],
      impact: { value: 300, prefix: "", suffix: "", label: "FAMILLES" },
      media: {
        type: "video",
        src: "assets/video/hiver-au-chaud.mp4",    // ACTION_HIVER_VIDEO
        poster: "assets/img/hiver-poster.jpg",
        alt: "Des membres du club chargent et distribuent des cartons de couvertures et de matelas",
        position: "50% 50%"
      }
    },
    {
      id: "kofet-ramadan",
      category: "humanitaire",
      layout: "a",
      title: "KOFET RAMADAN",
      subtitle: "",
      axis: [],
      description: [
        "Kofet Ramadan est notre action annuelle, organisée à l’occasion du mois sacré pour soutenir les familles en difficulté.",
        "Chaque année, nous collaborons avec différents clubs ; cette année, nous avons travaillé avec l’Interact Club Ruspina Monastir.",
        "Les paniers alimentaires contenaient des produits essentiels comme la semoule, l’huile, le sucre, les dattes et le lait, et grâce à l’engagement de tous, nous avons atteint 160 % de notre objectif, apportant chaleur et soutien à encore plus de foyers."
      ],
      impact: { value: 200, prefix: "", suffix: "", label: "COUFFINS DISTRIBUÉS" },
      media: {
        type: "video",
        src: "assets/video/kofet-ramadan.mp4",     // ACTION_KOFET_VIDEO
        poster: "assets/img/kofet-poster.jpg",
        alt: "Des membres du club préparent et distribuent des paniers alimentaires",
        position: "50% 50%"
      }
    },
    {
      id: "novembre-bleu",
      category: "humanitaire",
      layout: "b",
      title: "NOVEMBRE BLEU",
      subtitle: "Sensibilisation & Santé Masculine",
      axis: ["Santé Publique & Action Sociale"],
      description: [
        "Une campagne d’impact dédiée à la sensibilisation aux cancers masculins et à la promotion du dépistage précoce. Basée sur la conviction que « Mieux vaut prévenir que guérir », cette initiative vise à briser les tabous, éduquer la communauté et encourager des habitudes de vie préventives."
      ],
      impact: { text: "Mobilisation de la jeunesse, diffusion de contenus éducatifs et sensibilisation directe du grand public." },
      media: {
        type: "image",
        src: "assets/img/novembre-bleu.jpg",       // ACTION_NOVEMBRE_BLEU_MEDIA
        alt: "Visuel de la campagne Novembre Bleu : le mois de sensibilisation aux cancers masculins",
        position: "50% 50%"
      }
    },
    {
      id: "kits-maternite",
      category: "humanitaire",
      layout: "c",
      title: "KITS DE MATERNITÉ",
      subtitle: "Un Berceau d’Amour",
      axis: ["Action Humanitaire Inter-Clubs", "ICM × ICRM × ICTD × ICE"],
      description: [
        "Un projet solidaire à fort impact social visant à soutenir les nouvelles mamans en situation de vulnérabilité. En réunissant la force de plusieurs clubs Interact, nous collectons et distribuons des kits de puériculture essentiels pour garantir à chaque nouveau-né un accueil digne, chaleureux et sécurisé."
      ],
      impact: { text: "Soutien matériel direct aux familles démunies et renforcement du réseau d’entraide communautaire." },
      media: {
        type: "image",
        src: "assets/img/kits-maternite.jpg",      // ACTION_KITS_MATERNITE_MEDIA
        alt: "Visuel de la collecte des kits de maternité : un berceau d’amour pour chaque nouveau-né",
        position: "50% 50%"
      }
    },
    {
      id: "rentree-scolaire",
      category: "humanitaire",
      layout: "a",
      title: "RENTRÉE SCOLAIRE",
      subtitle: "",
      axis: ["Action Humanitaire & Éducation"],
      description: [
        "À l’approche de la rentrée scolaire, plusieurs Interact Clubs s’unissent pour soutenir les écoliers en situation de vulnérabilité. Cette initiative vise à collecter et distribuer des cartables et fournitures scolaires essentielles afin d’offrir à chaque enfant un départ plus serein, équitable et digne. Au-delà du don matériel, cette action porte un message de solidarité et rappelle que l’accès aux outils d’apprentissage contribue à construire un avenir meilleur."
      ],
      impact: [
        { display: "+1\u00a0000", label: "CARTABLES" },
        { display: "128\u00a0%",  label: "OBJECTIF ATTEINT" }
      ],
      media: {
        type: "video",
        src: "assets/video/rentree-scolaire.mp4",   // ACTION_RENTREE_SCOLAIRE_VIDEO
        poster: "assets/img/rentree-poster.jpg",
        alt: "Des membres du club accompagnent des écoliers pour la rentrée scolaire",
        position: "50% 50%"
      }
    }
  ],

  /* ---------------------------------------------------------------------
     4. CHIFFRES D'IMPACT — uniquement les chiffres fournis
     --------------------------------------------------------------------- */
  IMPACT: [
    { value: 500, prefix: "+", suffix: "",   label: "PARTICIPANTS",     source: "Festival Jazz" },
    { value: 600, prefix: "+", suffix: "",   label: "PARTICIPANTS",     source: "Hadra" },
    { value: 300, prefix: "",  suffix: "",   label: "FAMILLES",         source: "L’Hiver au Chaud" },
    { value: 200, prefix: "",  suffix: "",   label: "COUFFINS",         source: "Kofet Ramadan" },
    { value: 103, prefix: "",  suffix: " %", label: "OBJECTIF ATTEINT", source: "L’Hiver au Chaud", accent: true },
    { value: 160, prefix: "",  suffix: " %", label: "OBJECTIF ATTEINT", source: "Kofet Ramadan",    accent: true }
  ],

  /* ---------------------------------------------------------------------
     5. SPONSORS — uniquement les logos fournis.
        { name, logo, url?, fit? }   fit : "contain" (défaut, logo entier) ou "cover"
        Un logo manquant (logo: "") affiche un cadre placeholder discret.
        L'ordre du tableau = l'ordre d'affichage.
     --------------------------------------------------------------------- */
  SPONSORS: [
    { name: "Sadine Tours",        logo: "assets/sponsors/sadine-tours.jpg" },
    { name: "Archi Services",      logo: "assets/sponsors/archi-services.jpg", fit: "cover" },
    { name: "Warda",               logo: "assets/sponsors/warda.jpg" },
    { name: "Tarantino ciné-café", logo: "assets/sponsors/tarantino-cine-cafe.png", fit: "cover" },
    { name: "Délice Danone",       logo: "assets/sponsors/delice-danone.jpg" },
    { name: "",                    logo: "assets/sponsors/sponsor-go.jpg" },
    { name: "Bogo",                logo: "assets/sponsors/bogo.jpg" }
  ]
};


/* -------------------------------------------------------------------------
   7. CONTENU ADMINISTRABLE DU SITE PUBLIC
   Valeurs de départ / secours hors ligne. La version publiée en base peut
   modifier ces champs sans modifier le HTML ni les animations existantes.
   ------------------------------------------------------------------------- */
window.SITE.PUBLIC_CONTENT = {
  metaTitle: "Interact Club Ruspina Monastir",
  metaDescription: "Site officiel de l’Interact Club Ruspina Monastir : un club de jeunes engagé dans le service, le leadership et la création d’un impact positif au sein de sa communauté.",
  hero: {
    titleLines: ["INTERACT CLUB", "RUSPINA", "MONASTIR"],
    tagline: ["Des jeunes.", "Des idées.", "Des actions.", "Un impact."],
    lead: "Un club de jeunes engagé dans le service, le leadership et la création d’un impact positif au sein de sa communauté.",
    video: window.SITE.MEDIA.HERO_VIDEO,
    poster: window.SITE.MEDIA.HERO_POSTER,
    primaryLabel: "DÉCOUVRIR LE CLUB",
    secondaryLabel: "NOS ACTIONS"
  },
  intro: {
    rotaryTitle: "Le Rotary",
    rotaryText: "Le Rotary est une organisation internationale dédiée au service humanitaire et à la promotion de la paix. Créé en 1905, il regroupe des membres actifs dans plus de 200 pays et régions du monde.",
    interactTitle: "L’Interact",
    interactText: "L’Interact est un club de service destiné aux jeunes âgés de 12 à 18 ans. Parrainé par des clubs Rotary, il bénéficie de leur soutien et de leurs conseils. Avec plus de 250 000 membres répartis dans 11 000 clubs à travers le monde, l’Interact joue un rôle clé dans l’engagement des jeunes au service de leur communauté.",
    clubTitle: "Interact Club Ruspina Monastir",
    clubText: "L’Interact Club Ruspina Monastir est un club à but non lucratif de jeunes à Monastir, parrainé par le Rotary Club de Monastir, qui œuvre à travers des actions sociales, culturelles et environnementales tout en favorisant le développement personnel et l’esprit d’équipe de ses membres.",
    linkLabel: "Qui sommes-nous"
  },
  club: {
    titleLines: ["QUI SOMMES-", "NOUS ?"],
    subtitle: "INTERACT CLUB RUSPINA MONASTIR",
    photo: window.SITE.MEDIA.CLUB_PHOTO,
    photoAlt: "Les membres de l’Interact Club Ruspina Monastir réunis, vêtus de blanc, souriants",
    facts: [
      { label: "Fondation", value: "2 septembre 2015" },
      { label: "Tranche d’âge", value: "13 à 18 ans" },
      { label: "Club parrain", value: "Rotary Club Monastir" },
      { label: "Gouvernance", value: "Par les jeunes, pour les jeunes" }
    ],
    lead: "L’Interact Club Ruspina Monastir (ICRM) est un club de service à but non lucratif, parrainé par le Rotary Club Monastir.",
    paragraphs: [
      "Destiné aux jeunes âgés de 13 à 18 ans, il est géré par les jeunes et pour les jeunes, offrant un espace d’engagement, d’apprentissage et de développement personnel.",
      "Fondé le 2 septembre 2015, notre club partage, avec tous les Interact Clubs de Tunisie, les mêmes valeurs et la même mission : servir la communauté, former les jeunes au leadership, encourager leur épanouissement et générer un impact positif à l’échelle locale, nationale et internationale."
    ]
  },
  actionsSection: {
    title: "NOS ACTIONS",
    subtitle: "Des idées transformées en actions. Des actions transformées en impact.",
    financialLabel: "FINANCIÈRES",
    humanitarianLabel: "HUMANITAIRES"
  },
  teamSection: { titleLines: ["NOTRE BUREAU", "EXÉCUTIF"] },
  bureauElargiSection: { titleLines: ["NOTRE BUREAU", "ÉLARGI"], intro: "Les responsables qui accompagnent nos commissions et coordonnent les projets du club." },
  partnersSection: { title: "NOS SPONSORS", subtitle: "Les projets prennent vie grâce aux collaborations." },
  sponsors: window.SITE.SPONSORS,
  actions: window.SITE.ACTIONS,
  impactSection: {
    titleLines: ["NOTRE", "IMPACT"],
    subtitle: "Ce que nos actions ont rendu possible."
  },
  impact: window.SITE.IMPACT,
  vision: {
    title: "ET APRÈS ?",
    text: "Chaque action ouvre la voie à une nouvelle initiative, une nouvelle collaboration et un nouvel impact."
  },
  contact: {
    title: "PARLONS.",
    email: window.SITE.CONTACT.EMAIL,
    phone: window.SITE.CONTACT.PHONE,
    instagram: window.SITE.CONTACT.INSTAGRAM,
    joinLabel: "REJOINDRE LE CLUB",
    joinUrl: "",
    partnerLabel: "DEVENIR PARTENAIRE",
    partnerUrl: ""
  },
  footer: { note: "Des jeunes. Des idées. Des actions. Un impact." }
};
