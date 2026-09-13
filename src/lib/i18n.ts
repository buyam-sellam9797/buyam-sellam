// All the site's translated text lives here, in one place, so every
// page can pull strings the same way and nothing gets translated
// halfway. Cameroon is officially bilingual (French/English), so both
// full dictionaries are kept in sync by hand rather than using a
// heavier i18n library that this small a site doesn't need.

export type Locale = "en" | "fr";

export const locales: Locale[] = ["en", "fr"];

const en = {
  nav: {
    browse: "Browse",
    sell: "Sell on Buyam Sellam",
    openShop: "Open a shop",
    city: "Douala",
  },
  footer: {
    rights: "Buyam Sellam. Douala, Cameroon.",
    payWith: "Pay with MTN Mobile Money or Orange Money.",
  },
  home: {
    heroTitle:
      "Real Douala sellers. Real fashion & beauty. Pay safely by mobile money.",
    heroSubtitle:
      "Your payment is held until you confirm you received your order — so you can shop with sellers you don't know yet, safely.",
    browseCta: "Browse products",
    openShopCta: "Open your shop, it's free",
    shopByCategory: "Shop by category",
    justListed: "Just listed",
    seeAll: "See all",
    noProductsYet: "No products listed yet.",
    beFirstToOpenShop: "Be the first to open a shop",
    how1Title: "1. Pick a real seller",
    how1Body:
      "Verified shops from sellers around Douala — fashion, beauty, and accessories.",
    how2Title: "2. Pay by mobile money",
    how2Body:
      "MTN Mobile Money or Orange Money. Your payment is held by Buyam Sellam, not sent straight to the seller.",
    how3Title: "3. Confirm and release",
    how3Body:
      "Only once you confirm you received your order does the seller get paid.",
  },
  browse: {
    title: "Browse Douala shops",
    itemOne: "item",
    itemOther: "items",
    inCategory: "in",
    all: "All",
    noListings: "No listings in this category yet.",
  },
  product: {
    soldBy: "Sold by",
    buyNow: "Buy now with Mobile Money",
    escrowNotice:
      "Your payment is held by Buyam Sellam and only released to the seller once you confirm you received this order.",
  },
  shop: {
    verified: "Buyam Sellam verified shop",
    listingOne: "listing",
    listingOther: "listings",
    noListings: "No listings yet.",
  },
  checkout: {
    confirmOrder: "Confirm your order",
    payWithLabel: "Pay with",
    mtn: "MTN Mobile Money",
    orange: "Orange Money",
    phoneLabel: "Mobile money number",
    phonePlaceholder: "+237 6XX XXX XXX",
    payButton: "Pay",
    checkingPhone: "Check your phone…",
    waitingNote:
      "A payment approval request was sent to your phone. Approve it there to complete the order.",
    heldTitle: "Payment held ✓",
    heldBody:
      "is confirmed and held by Buyam Sellam. The seller has been notified to ship your order — you'll be asked to confirm receipt before they get paid.",
    trackOrder: "Track your order",
    tryAgain: "Try again",
    errorGeneric: "The payment could not be completed.",
    errorStart: "Something went wrong starting the payment.",
    errorNotApproved: "The payment was not approved on your phone.",
    errorTimeout:
      "We didn't see a confirmation in time. Check your phone, or try again.",
    errorUnreachable: "Could not reach the payment service. Please try again.",
  },
  sell: {
    title: "Open your shop",
    subtitle:
      "Free to list. You only get paid once a buyer confirms they received their order.",
    fullName: "Your full name",
    shopName: "Shop name",
    shopNamePlaceholder: "e.g. Mama Clara Fashion",
    email: "Email",
    password: "Password",
    whatsapp: "WhatsApp number",
    whatsappPlaceholder: "+237 6XX XXX XXX",
    city: "City",
    creating: "Creating your shop…",
    submit: "Open my shop",
    alreadyHaveShop: "Already have a shop?",
    logIn: "Log in",
    almostThere: "Almost there ✓",
    checkEmailPrefix: "Your shop was created. Check",
    checkEmailSuffix: "for a confirmation link, then",
    toReachDashboard: "to reach your dashboard.",
  },
  login: {
    title: "Seller login",
    subtitle: "Log in to manage your shop and listings.",
    email: "Email",
    password: "Password",
    loggingIn: "Logging in…",
    submit: "Log in",
    noShopYet: "No shop yet?",
    openForFree: "Open one for free",
  },
  dashboard: {
    loading: "Loading…",
    noShopFound: "We couldn't find a shop linked to your account.",
    sellerDashboard: "Seller dashboard",
    listings: "Listings",
    ordersHeld: "Orders held",
    owed: "You are owed",
    paidOut: "Paid out",
    yourListings: "Your listings",
    addProduct: "+ Add product",
    cancel: "Cancel",
    productName: "Product name",
    description: "Description",
    price: "Price (FCFA)",
    stock: "Stock",
    category: "Category",
    photo: "Photo",
    photoKeepCurrent: " (leave blank to keep the current one)",
    saveChanges: "Save changes",
    addProductBtn: "Add product",
    saving: "Saving…",
    edit: "Edit",
    delete: "Delete",
    removeConfirm: "Remove this listing? This can't be undone.",
    noListingsYet: "No listings yet — add your first product above.",
    orders: "Orders",
    noOrdersYet:
      'No orders yet. Once a buyer pays, it will show up here as "held" until you mark it shipped and the buyer confirms receipt.',
    markShipped: "Mark shipped",
    unknownBuyer: "unknown buyer",
    statusLabels: {
      pending_payment: "awaiting payment",
      paid_held: "payment held",
      shipped: "shipped",
      completed: "completed",
      disputed: "disputed",
      refunded: "refunded",
      cancelled: "cancelled",
    } as Record<string, string>,
  },
  order: {
    title: "Your order",
    status: "Status",
    confirmReceived: "I received my order",
    confirming: "Confirming…",
    confirmedThanks: "Thanks! The seller has been notified they can be paid.",
    notFound: "We couldn't find this order.",
    shipped:
      "Your order is on its way. Once you receive it, confirm below so the seller gets paid.",
    alreadyHeld:
      "Your payment is held. The seller has been notified to ship your order.",
    alreadyCompleted:
      "This order is complete — thanks for shopping on Buyam Sellam!",
    backHome: "Back to homepage",
  },
  admin: {
    title: "Payouts",
    notAuthorized: "You're not authorized to view this page.",
    loading: "Loading…",
    noneOwed: "Nobody is currently owed a payout.",
    markPaid: "Mark paid",
    marking: "Saving…",
    shop: "Shop",
    amount: "Amount",
    buyer: "Buyer",
    date: "Date",
  },
};

const fr: typeof en = {
  nav: {
    browse: "Parcourir",
    sell: "Vendre sur Buyam Sellam",
    openShop: "Ouvrir une boutique",
    city: "Douala",
  },
  footer: {
    rights: "Buyam Sellam. Douala, Cameroun.",
    payWith: "Payez avec MTN Mobile Money ou Orange Money.",
  },
  home: {
    heroTitle:
      "De vrais vendeurs de Douala. De la vraie mode et beauté. Payez en toute sécurité par Mobile Money.",
    heroSubtitle:
      "Votre paiement est retenu jusqu'à ce que vous confirmiez avoir reçu votre commande — vous pouvez donc acheter en toute confiance chez des vendeurs que vous ne connaissez pas encore.",
    browseCta: "Parcourir les produits",
    openShopCta: "Ouvrez votre boutique, c'est gratuit",
    shopByCategory: "Acheter par catégorie",
    justListed: "Nouveautés",
    seeAll: "Tout voir",
    noProductsYet: "Aucun produit pour le moment.",
    beFirstToOpenShop: "Soyez le premier à ouvrir une boutique",
    how1Title: "1. Choisissez un vrai vendeur",
    how1Body:
      "Des boutiques vérifiées tenues par des vendeurs de Douala — mode, beauté et accessoires.",
    how2Title: "2. Payez par Mobile Money",
    how2Body:
      "MTN Mobile Money ou Orange Money. Votre paiement est retenu par Buyam Sellam, pas envoyé directement au vendeur.",
    how3Title: "3. Confirmez et le vendeur est payé",
    how3Body:
      "Le vendeur n'est payé qu'une fois que vous avez confirmé avoir reçu votre commande.",
  },
  browse: {
    title: "Parcourir les boutiques de Douala",
    itemOne: "article",
    itemOther: "articles",
    inCategory: "dans",
    all: "Tout",
    noListings: "Aucun article dans cette catégorie pour le moment.",
  },
  product: {
    soldBy: "Vendu par",
    buyNow: "Acheter avec Mobile Money",
    escrowNotice:
      "Votre paiement est retenu par Buyam Sellam et n'est reversé au vendeur qu'après votre confirmation de réception.",
  },
  shop: {
    verified: "Boutique vérifiée par Buyam Sellam",
    listingOne: "article",
    listingOther: "articles",
    noListings: "Aucun article pour le moment.",
  },
  checkout: {
    confirmOrder: "Confirmez votre commande",
    payWithLabel: "Payer avec",
    mtn: "MTN Mobile Money",
    orange: "Orange Money",
    phoneLabel: "Numéro Mobile Money",
    phonePlaceholder: "+237 6XX XXX XXX",
    payButton: "Payer",
    checkingPhone: "Vérifiez votre téléphone…",
    waitingNote:
      "Une demande d'approbation de paiement a été envoyée sur votre téléphone. Approuvez-la pour finaliser la commande.",
    heldTitle: "Paiement retenu ✓",
    heldBody:
      "est confirmé et retenu par Buyam Sellam. Le vendeur a été averti d'expédier votre commande — on vous demandera de confirmer la réception avant qu'il soit payé.",
    trackOrder: "Suivre votre commande",
    tryAgain: "Réessayer",
    errorGeneric: "Le paiement n'a pas pu être finalisé.",
    errorStart: "Une erreur est survenue au démarrage du paiement.",
    errorNotApproved: "Le paiement n'a pas été approuvé sur votre téléphone.",
    errorTimeout:
      "Nous n'avons pas reçu de confirmation à temps. Vérifiez votre téléphone ou réessayez.",
    errorUnreachable: "Impossible de joindre le service de paiement. Veuillez réessayer.",
  },
  sell: {
    title: "Ouvrez votre boutique",
    subtitle:
      "Gratuit pour vendre. Vous n'êtes payé qu'une fois qu'un acheteur confirme avoir reçu sa commande.",
    fullName: "Votre nom complet",
    shopName: "Nom de la boutique",
    shopNamePlaceholder: "ex. Mama Clara Fashion",
    email: "Email",
    password: "Mot de passe",
    whatsapp: "Numéro WhatsApp",
    whatsappPlaceholder: "+237 6XX XXX XXX",
    city: "Ville",
    creating: "Création de votre boutique…",
    submit: "Ouvrir ma boutique",
    alreadyHaveShop: "Vous avez déjà une boutique ?",
    logIn: "Se connecter",
    almostThere: "Presque terminé ✓",
    checkEmailPrefix: "Votre boutique a été créée. Consultez",
    checkEmailSuffix: "pour un lien de confirmation, puis",
    toReachDashboard: "pour accéder à votre tableau de bord.",
  },
  login: {
    title: "Connexion vendeur",
    subtitle: "Connectez-vous pour gérer votre boutique et vos articles.",
    email: "Email",
    password: "Mot de passe",
    loggingIn: "Connexion…",
    submit: "Se connecter",
    noShopYet: "Pas encore de boutique ?",
    openForFree: "Ouvrez-en une gratuitement",
  },
  dashboard: {
    loading: "Chargement…",
    noShopFound: "Nous n'avons trouvé aucune boutique liée à votre compte.",
    sellerDashboard: "Tableau de bord vendeur",
    listings: "Articles",
    ordersHeld: "Commandes en attente",
    owed: "Vous êtes dû",
    paidOut: "Déjà payé",
    yourListings: "Vos articles",
    addProduct: "+ Ajouter un produit",
    cancel: "Annuler",
    productName: "Nom du produit",
    description: "Description",
    price: "Prix (FCFA)",
    stock: "Stock",
    category: "Catégorie",
    photo: "Photo",
    photoKeepCurrent: " (laissez vide pour garder la photo actuelle)",
    saveChanges: "Enregistrer",
    addProductBtn: "Ajouter le produit",
    saving: "Enregistrement…",
    edit: "Modifier",
    delete: "Supprimer",
    removeConfirm: "Supprimer cet article ? Cette action est irréversible.",
    noListingsYet: "Aucun article pour le moment — ajoutez votre premier produit ci-dessus.",
    orders: "Commandes",
    noOrdersYet:
      "Aucune commande pour le moment. Dès qu'un acheteur paie, elle apparaîtra ici comme « retenue » jusqu'à ce que vous l'expédiiez et que l'acheteur confirme la réception.",
    markShipped: "Marquer comme expédié",
    unknownBuyer: "acheteur inconnu",
    statusLabels: {
      pending_payment: "en attente de paiement",
      paid_held: "paiement retenu",
      shipped: "expédié",
      completed: "terminé",
      disputed: "en litige",
      refunded: "remboursé",
      cancelled: "annulé",
    },
  },
  order: {
    title: "Votre commande",
    status: "Statut",
    confirmReceived: "J'ai reçu ma commande",
    confirming: "Confirmation…",
    confirmedThanks: "Merci ! Le vendeur a été averti qu'il peut être payé.",
    notFound: "Nous n'avons pas trouvé cette commande.",
    shipped:
      "Votre commande est en route. Dès que vous la recevez, confirmez ci-dessous pour que le vendeur soit payé.",
    alreadyHeld:
      "Votre paiement est retenu. Le vendeur a été averti d'expédier votre commande.",
    alreadyCompleted:
      "Cette commande est terminée — merci d'avoir acheté sur Buyam Sellam !",
    backHome: "Retour à l'accueil",
  },
  admin: {
    title: "Paiements aux vendeurs",
    notAuthorized: "Vous n'êtes pas autorisé à voir cette page.",
    loading: "Chargement…",
    noneOwed: "Aucun paiement en attente actuellement.",
    markPaid: "Marquer comme payé",
    marking: "Enregistrement…",
    shop: "Boutique",
    amount: "Montant",
    buyer: "Acheteur",
    date: "Date",
  },
};

export const dictionaries = { en, fr };

export type Dictionary = typeof en;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

// English pluralizes at 0/2+, French treats 0 as singular too — this
// small helper picks the right form without pulling in a full i18n
// library for one rule.
export function plural(count: number, locale: Locale, one: string, other: string) {
  const isSingular = locale === "fr" ? count <= 1 : count === 1;
  return isSingular ? one : other;
}
