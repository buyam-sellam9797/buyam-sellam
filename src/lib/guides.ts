// Buyam Sellam guides: long-form, search-focused articles that teach
// people in Cameroon how to buy and sell online without getting
// scammed. Trust is the real bottleneck for online shopping here, so
// being the place that explains it well is both useful to readers and
// the site's strongest SEO asset.
//
// Every guide exists twice — once in English, once in French — each
// with its OWN url (slug) in its own language, linked to each other
// with hreflang. The site's interface language is a cookie, which
// search engines never send, so a single url could only ever be
// indexed in one language; separate urls let both versions rank.
//
// Facts about how Buyam Sellam works (escrow, 5-day auto-release, 5%
// commission, disputes before confirming, ID + selfie verification)
// must stay in line with the Help Centre and the real product.

export type GuideLang = "en" | "fr";
export type GuideTopic = "buyers" | "sellers" | "payments";

export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
};

export type Guide = {
  slug: string;
  lang: GuideLang;
  // slug of the same guide in the other language
  altSlug: string;
  topic: GuideTopic;
  title: string;
  // <title>/meta description for search results (~150 chars)
  description: string;
  // one-line summary shown on cards
  excerpt: string;
  readMinutes: number;
  updated: string; // ISO date
  intro: string[];
  sections: GuideSection[];
  keyTakeaways: string[];
  faq: { q: string; a: string }[];
  related: string[]; // slugs in the same language
};

export const GUIDES: Guide[] = [
  // ------------------------------------------------------------------
  // 1. Shopping safely online
  // ------------------------------------------------------------------
  {
    slug: "how-to-shop-safely-online-in-cameroon",
    lang: "en",
    altSlug: "acheter-en-ligne-en-securite-au-cameroun",
    topic: "buyers",
    title: "How to shop safely online in Cameroon: a practical guide",
    description:
      "Buying online in Cameroon without getting scammed: how to check a seller, pay safely with MTN MoMo or Orange Money, and what to do before you confirm delivery.",
    excerpt: "The checks to make before you pay anyone online — and why the way you pay matters most.",
    readMinutes: 7,
    updated: "2026-09-23",
    intro: [
      "Buying online in Cameroon has become normal: clothes from a boutique in Douala, hair from a seller in Yaoundé, shoes spotted in a WhatsApp group or on TikTok. Most sellers are honest. But almost everyone knows someone who sent mobile money for an order that never came, or received something very different from the photos.",
      "The good news is that most online shopping losses follow a few predictable patterns. If you know them, you can avoid nearly all of them. This guide walks through the checks to make before you pay, the safest way to pay, and what to do when something goes wrong.",
    ],
    sections: [
      {
        heading: "The biggest risk: paying before you have any protection",
        paragraphs: [
          "The most common way people lose money online is simple: they send the full amount by mobile money directly to a stranger, before receiving anything. Once a mobile money transfer is sent, getting it back depends entirely on the goodwill of the person who received it. If the seller disappears, blocks your number or keeps promising \"tomorrow\", you have very little leverage.",
          "That is why the single most important question is not \"Is this seller nice?\" but \"If this goes wrong, who is holding my money?\"",
        ],
      },
      {
        heading: "Check the seller before you pay",
        paragraphs: ["Take five minutes before any payment. Look for these signs:"],
        bullets: [
          "A real, consistent identity: a shop name, a city and a phone number that match everywhere the seller appears.",
          "A history: older posts, previous customers, reviews that mention specific details rather than just \"top vendeur 🔥\".",
          "Clear information about delivery: which areas they cover, how much it costs, and how long it takes.",
          "Real photos: ask for a photo of the item next to today's date written on paper, or a short video. Honest sellers do this easily.",
          "A normal price: a phone, wig or pair of sneakers at half the usual market price is the classic bait.",
        ],
      },
      {
        heading: "Red flags that should make you stop",
        bullets: [
          "Pressure to pay immediately: \"only one left\", \"price ends tonight\", \"others are waiting\".",
          "The seller refuses any payment method except a direct transfer to a personal number.",
          "The name on the mobile money account does not match the name the seller gave you.",
          "They ask you to pay \"delivery fees\" or \"customs fees\" first, then more fees later.",
          "They refuse a video call, a live photo or any way to see the item.",
          "The account is new, has few followers, and comments are turned off.",
        ],
      },
      {
        heading: "Pay in a way that protects you",
        paragraphs: [
          "The safest option is a payment where the money is held by a neutral party until you confirm you received your order. This is called escrow. On Buyam Sellam, every order works this way: you pay with MTN Mobile Money or Orange Money, Buyam Sellam holds the payment, the seller delivers, and the seller is only paid after you confirm you received the right item.",
          "If you do buy outside a marketplace, reduce your risk: pay a small deposit rather than the full amount, prefer cash on delivery for local orders, and never pay extra \"unlock\" or \"release\" fees.",
        ],
      },
      {
        heading: "When the order arrives: check before you confirm",
        steps: [
          "Open the package in front of the delivery person if you can.",
          "Compare the item with the listing: size, colour, model, quantity, condition.",
          "Test electronics before the delivery person leaves.",
          "Only then confirm delivery. On Buyam Sellam, confirming releases the payment to the seller, so do it only when you are satisfied.",
        ],
      },
      {
        heading: "If something goes wrong",
        paragraphs: [
          "If the item does not arrive, or is not what you ordered, act quickly and keep everything in writing. On Buyam Sellam, use the \"Report a problem\" button on your order page before the order is confirmed — while a problem is open, the payment is not released to the seller. Keep your chat messages, photos of what you received and your payment reference.",
          "Outside a marketplace, contact the seller in writing, keep screenshots, and contact your mobile money operator's customer service quickly with the transaction ID.",
        ],
      },
    ],
    keyTakeaways: [
      "Most losses come from paying a stranger directly before receiving anything.",
      "Check identity, history, photos and price before paying.",
      "Use a payment that holds your money until you confirm delivery.",
      "Inspect the item before confirming — confirming releases the payment.",
    ],
    faq: [
      {
        q: "Is it safe to pay with mobile money online?",
        a: "Mobile money itself is safe, but a direct transfer to a stranger offers no protection if the seller never delivers. Paying through an escrow marketplace such as Buyam Sellam means your money is held until you confirm you received your order.",
      },
      {
        q: "What should I do if a seller blocks me after I paid?",
        a: "Keep screenshots of the conversation and the payment, contact your mobile money operator with the transaction ID as quickly as possible, and report the account on the platform where you found it.",
      },
      {
        q: "Can I get my money back on Buyam Sellam if my order never arrives?",
        a: "Yes, as long as you report the problem from your order page before confirming delivery. The payment stays held while the problem is reviewed.",
      },
    ],
    related: [
      "how-to-spot-a-fake-seller-on-whatsapp-and-facebook",
      "mobile-money-scams-in-cameroon-and-how-to-avoid-them",
      "escrow-payment-explained",
    ],
  },
  {
    slug: "acheter-en-ligne-en-securite-au-cameroun",
    lang: "fr",
    altSlug: "how-to-shop-safely-online-in-cameroon",
    topic: "buyers",
    title: "Acheter en ligne en toute sécurité au Cameroun : le guide pratique",
    description:
      "Comment acheter en ligne au Cameroun sans se faire arnaquer : vérifier un vendeur, payer en sécurité par MTN MoMo ou Orange Money, et quoi faire avant de confirmer la livraison.",
    excerpt: "Les vérifications à faire avant de payer qui que ce soit en ligne — et pourquoi la façon de payer compte le plus.",
    readMinutes: 7,
    updated: "2026-09-23",
    intro: [
      "Acheter en ligne est devenu normal au Cameroun : des vêtements d'une boutique à Douala, des mèches d'une vendeuse à Yaoundé, des chaussures repérées dans un groupe WhatsApp ou sur TikTok. La plupart des vendeurs sont honnêtes. Mais presque tout le monde connaît quelqu'un qui a envoyé de l'argent par mobile money pour une commande jamais arrivée, ou qui a reçu tout autre chose que sur les photos.",
      "La bonne nouvelle, c'est que la plupart des pertes suivent quelques schémas prévisibles. En les connaissant, on peut éviter presque toutes. Ce guide explique les vérifications à faire avant de payer, la façon la plus sûre de payer, et quoi faire quand ça se passe mal.",
    ],
    sections: [
      {
        heading: "Le plus gros risque : payer avant d'avoir la moindre protection",
        paragraphs: [
          "La façon la plus courante de perdre de l'argent en ligne est simple : on envoie la totalité par mobile money directement à un inconnu, avant d'avoir reçu quoi que ce soit. Une fois le transfert envoyé, le récupérer dépend entièrement de la bonne volonté de celui qui l'a reçu. Si le vendeur disparaît, bloque votre numéro ou promet « demain » sans fin, vous n'avez presque aucun moyen de pression.",
          "La vraie question n'est donc pas « Ce vendeur a-t-il l'air gentil ? » mais « Si ça tourne mal, qui détient mon argent ? »",
        ],
      },
      {
        heading: "Vérifier le vendeur avant de payer",
        paragraphs: ["Prenez cinq minutes avant tout paiement. Cherchez ces signes :"],
        bullets: [
          "Une identité réelle et cohérente : un nom de boutique, une ville et un numéro identiques partout où le vendeur apparaît.",
          "Un historique : des publications anciennes, d'anciens clients, des avis qui citent des détails précis plutôt que juste « top vendeur 🔥 ».",
          "Des informations claires sur la livraison : zones couvertes, prix et délais.",
          "De vraies photos : demandez une photo de l'article à côté de la date du jour écrite sur un papier, ou une courte vidéo. Un vendeur honnête le fait sans problème.",
          "Un prix normal : un téléphone, une perruque ou des baskets à moitié prix du marché, c'est l'appât classique.",
        ],
      },
      {
        heading: "Les signaux d'alerte qui doivent vous arrêter",
        bullets: [
          "La pression pour payer tout de suite : « il en reste un seul », « le prix finit ce soir », « d'autres attendent ».",
          "Le vendeur refuse tout moyen de paiement sauf un transfert direct vers un numéro personnel.",
          "Le nom du compte mobile money ne correspond pas au nom donné par le vendeur.",
          "On vous demande d'abord des « frais de livraison » ou des « frais de douane », puis d'autres frais ensuite.",
          "Le vendeur refuse un appel vidéo, une photo en direct ou tout moyen de voir l'article.",
          "Le compte est récent, a peu d'abonnés et les commentaires sont désactivés.",
        ],
      },
      {
        heading: "Payer d'une façon qui vous protège",
        paragraphs: [
          "L'option la plus sûre est un paiement où l'argent est gardé par un tiers neutre jusqu'à ce que vous confirmiez avoir reçu votre commande. C'est ce qu'on appelle un paiement séquestre (escrow). Sur Buyam Sellam, chaque commande fonctionne ainsi : vous payez par MTN Mobile Money ou Orange Money, Buyam Sellam garde le paiement, le vendeur livre, et il n'est payé qu'après votre confirmation d'avoir reçu le bon article.",
          "Si vous achetez hors d'une marketplace, réduisez votre risque : versez une petite avance plutôt que la totalité, préférez le paiement à la livraison pour les commandes locales, et ne payez jamais de « frais de déblocage » supplémentaires.",
        ],
      },
      {
        heading: "À la réception : vérifier avant de confirmer",
        steps: [
          "Ouvrez le colis devant le livreur si possible.",
          "Comparez avec l'annonce : taille, couleur, modèle, quantité, état.",
          "Testez l'électronique avant le départ du livreur.",
          "Confirmez la livraison seulement ensuite. Sur Buyam Sellam, confirmer libère le paiement au vendeur : faites-le uniquement si vous êtes satisfait.",
        ],
      },
      {
        heading: "Si quelque chose se passe mal",
        paragraphs: [
          "Si l'article n'arrive pas, ou ne correspond pas, agissez vite et gardez tout par écrit. Sur Buyam Sellam, utilisez le bouton « Signaler un problème » sur la page de votre commande avant de confirmer : tant qu'un problème est ouvert, le paiement n'est pas versé au vendeur. Gardez vos messages, des photos de ce que vous avez reçu et votre référence de paiement.",
          "Hors marketplace, contactez le vendeur par écrit, faites des captures d'écran, et contactez rapidement le service client de votre opérateur mobile money avec l'identifiant de la transaction.",
        ],
      },
    ],
    keyTakeaways: [
      "La plupart des pertes viennent d'un paiement direct à un inconnu avant réception.",
      "Vérifiez identité, historique, photos et prix avant de payer.",
      "Utilisez un paiement qui garde votre argent jusqu'à la confirmation de livraison.",
      "Inspectez l'article avant de confirmer : confirmer libère le paiement.",
    ],
    faq: [
      {
        q: "Est-ce sûr de payer par mobile money en ligne ?",
        a: "Le mobile money est sûr, mais un transfert direct à un inconnu ne vous protège pas si le vendeur ne livre jamais. En payant via une marketplace à paiement séquestre comme Buyam Sellam, votre argent est gardé jusqu'à ce que vous confirmiez la réception.",
      },
      {
        q: "Que faire si un vendeur me bloque après paiement ?",
        a: "Gardez les captures de la conversation et du paiement, contactez au plus vite votre opérateur mobile money avec l'identifiant de transaction, et signalez le compte sur la plateforme où vous l'avez trouvé.",
      },
      {
        q: "Puis-je récupérer mon argent sur Buyam Sellam si ma commande n'arrive jamais ?",
        a: "Oui, à condition de signaler le problème depuis la page de votre commande avant de confirmer la livraison. Le paiement reste bloqué pendant l'examen du problème.",
      },
    ],
    related: [
      "reconnaitre-un-faux-vendeur-sur-whatsapp-et-facebook",
      "arnaques-mobile-money-au-cameroun-comment-les-eviter",
      "paiement-sequestre-explique",
    ],
  },

  // ------------------------------------------------------------------
  // 2. Spotting a fake seller
  // ------------------------------------------------------------------
  {
    slug: "how-to-spot-a-fake-seller-on-whatsapp-and-facebook",
    lang: "en",
    altSlug: "reconnaitre-un-faux-vendeur-sur-whatsapp-et-facebook",
    topic: "buyers",
    title: "How to spot a fake seller on WhatsApp, Facebook and TikTok",
    description:
      "The warning signs of a fake online seller in Cameroon — stolen photos, impossible prices, pressure tactics — and the quick checks that expose them before you pay.",
    excerpt: "Stolen photos, impossible prices and pressure tactics: how fake sellers work and how to catch them.",
    readMinutes: 6,
    updated: "2026-09-23",
    intro: [
      "WhatsApp groups, Facebook pages and TikTok are where a lot of real selling happens in Cameroon. They are also where fake sellers hide best, because anyone can create a page or join a group in a few minutes, copy photos from real shops and start taking orders.",
      "Fake sellers rarely look fake. They use beautiful photos, answer quickly and sound friendly. What gives them away is how they behave around payment. Here is what to look for.",
    ],
    sections: [
      {
        heading: "1. The photos are too perfect — or not theirs",
        paragraphs: [
          "Many fake sellers use pictures taken from real online shops, Instagram accounts or international websites. Signs to watch: studio-quality photos with no background from Cameroon, the same picture used by several different \"sellers\", or watermarks that have been cropped out.",
          "Simple test: ask for a photo of the item with a paper showing your name and today's date, or a 10-second video turning the item around. A real seller with the item in hand can do it in minutes. A fake seller will find excuses.",
        ],
      },
      {
        heading: "2. The price is too good to be true",
        paragraphs: [
          "An iPhone, a designer bag or a brand-new wig far below the normal market price is the most common bait. Fake sellers know that a very low price makes people rush and skip their usual checks. If the price is much lower than everywhere else, assume there is a reason.",
        ],
      },
      {
        heading: "3. Everything is urgent",
        bullets: [
          "\"Only two left, pay now to reserve.\"",
          "\"The promo ends in one hour.\"",
          "\"Someone else wants it, I can't hold it for you.\"",
        ],
        paragraphs: [
          "Urgency exists to stop you thinking. An honest seller would rather lose one sale than lose their reputation.",
        ],
      },
      {
        heading: "4. The payment story keeps changing",
        paragraphs: [
          "Watch out if the seller asks you to send money to a number in a different name, to split the payment across several numbers, or to pay extra fees after the first payment (\"delivery\", \"customs\", \"insurance\", \"release code\"). Each new fee is a sign you are being drained step by step.",
        ],
      },
      {
        heading: "5. There is no history",
        paragraphs: [
          "Check when the page or account was created, whether older posts exist, and whether real customers have commented or tagged the seller. A page created last week with thousands of likes but no comments is suspicious. Search the seller's phone number and shop name: scam numbers are often reported by other victims.",
        ],
      },
      {
        heading: "How a marketplace changes the picture",
        paragraphs: [
          "On Buyam Sellam, sellers can get a verified badge after an automatic ID and live-selfie check, and every order is paid through escrow: the seller only receives the money after you confirm you received your order. Even a seller you don't know can't simply take your money and disappear. That is the difference between trusting a person and trusting a process.",
        ],
      },
    ],
    keyTakeaways: [
      "Ask for a live photo or short video of the item — fake sellers avoid it.",
      "Very low prices and urgent pressure are deliberate tactics.",
      "Changing payment instructions and extra fees are major warning signs.",
      "Prefer sellers with a verified identity and payment held in escrow.",
    ],
    faq: [
      {
        q: "How can I check if a seller's photos are real?",
        a: "Ask for a new photo of the item next to a paper with your name and today's date, or a short video. You can also use a reverse image search to see if the same photo appears on other websites.",
      },
      {
        q: "What does the verified badge on Buyam Sellam mean?",
        a: "It means the seller passed an identity check: their ID document was scanned and matched to a live selfie by an independent verification service.",
      },
    ],
    related: [
      "how-to-shop-safely-online-in-cameroon",
      "mobile-money-scams-in-cameroon-and-how-to-avoid-them",
      "what-to-do-if-your-online-order-does-not-arrive",
    ],
  },
  {
    slug: "reconnaitre-un-faux-vendeur-sur-whatsapp-et-facebook",
    lang: "fr",
    altSlug: "how-to-spot-a-fake-seller-on-whatsapp-and-facebook",
    topic: "buyers",
    title: "Comment reconnaître un faux vendeur sur WhatsApp, Facebook et TikTok",
    description:
      "Les signes d'un faux vendeur en ligne au Cameroun — photos volées, prix impossibles, pression pour payer — et les vérifications rapides qui les démasquent avant de payer.",
    excerpt: "Photos volées, prix impossibles et pression : comment opèrent les faux vendeurs et comment les repérer.",
    readMinutes: 6,
    updated: "2026-09-23",
    intro: [
      "Les groupes WhatsApp, les pages Facebook et TikTok sont des lieux où beaucoup de vraies ventes se font au Cameroun. Ce sont aussi les endroits où les faux vendeurs se cachent le mieux : n'importe qui peut créer une page ou rejoindre un groupe en quelques minutes, copier les photos de vraies boutiques et commencer à prendre des commandes.",
      "Les faux vendeurs ont rarement l'air faux. Belles photos, réponses rapides, ton sympathique. Ce qui les trahit, c'est leur comportement autour du paiement. Voici quoi surveiller.",
    ],
    sections: [
      {
        heading: "1. Les photos sont trop parfaites — ou pas les leurs",
        paragraphs: [
          "Beaucoup de faux vendeurs utilisent des images prises sur de vraies boutiques en ligne, des comptes Instagram ou des sites étrangers. Signes à surveiller : des photos de studio sans aucun décor camerounais, la même photo utilisée par plusieurs « vendeurs », ou des filigranes coupés.",
          "Test simple : demandez une photo de l'article avec un papier portant votre nom et la date du jour, ou une vidéo de 10 secondes où l'on tourne l'article. Un vrai vendeur qui a l'article en main le fait en quelques minutes. Un faux trouvera des excuses.",
        ],
      },
      {
        heading: "2. Le prix est trop beau pour être vrai",
        paragraphs: [
          "Un iPhone, un sac de marque ou une perruque neuve bien en dessous du prix du marché, c'est l'appât le plus courant. Les faux vendeurs savent qu'un prix très bas pousse à se précipiter et à sauter les vérifications. Si le prix est beaucoup plus bas qu'ailleurs, il y a forcément une raison.",
        ],
      },
      {
        heading: "3. Tout est urgent",
        bullets: [
          "« Il n'en reste que deux, payez maintenant pour réserver. »",
          "« La promo se termine dans une heure. »",
          "« Quelqu'un d'autre le veut, je ne peux pas vous le garder. »",
        ],
        paragraphs: [
          "L'urgence sert à vous empêcher de réfléchir. Un vendeur honnête préfère perdre une vente que sa réputation.",
        ],
      },
      {
        heading: "4. Les instructions de paiement changent",
        paragraphs: [
          "Méfiez-vous si le vendeur vous demande d'envoyer l'argent à un numéro au nom de quelqu'un d'autre, de répartir le paiement sur plusieurs numéros, ou de payer des frais supplémentaires après le premier paiement (« livraison », « douane », « assurance », « code de déblocage »). Chaque nouveau frais est le signe qu'on vous vide petit à petit.",
        ],
      },
      {
        heading: "5. Aucun historique",
        paragraphs: [
          "Vérifiez quand la page ou le compte a été créé, s'il y a des publications anciennes, et si de vrais clients ont commenté ou identifié le vendeur. Une page créée la semaine dernière avec des milliers de j'aime mais aucun commentaire est suspecte. Recherchez le numéro et le nom de la boutique : les numéros d'arnaqueurs sont souvent signalés par d'autres victimes.",
        ],
      },
      {
        heading: "Ce que change une marketplace",
        paragraphs: [
          "Sur Buyam Sellam, les vendeurs peuvent obtenir un badge vérifié après un contrôle automatique de pièce d'identité et de selfie en direct, et chaque commande est payée par séquestre : le vendeur ne reçoit l'argent qu'après votre confirmation de réception. Même un vendeur que vous ne connaissez pas ne peut pas simplement prendre votre argent et disparaître. C'est la différence entre faire confiance à une personne et faire confiance à un système.",
        ],
      },
    ],
    keyTakeaways: [
      "Demandez une photo ou une vidéo en direct de l'article : les faux vendeurs l'évitent.",
      "Prix très bas et pression pour payer sont des tactiques délibérées.",
      "Des instructions de paiement qui changent et des frais en plus sont des alertes majeures.",
      "Préférez des vendeurs à l'identité vérifiée et un paiement séquestre.",
    ],
    faq: [
      {
        q: "Comment vérifier si les photos d'un vendeur sont réelles ?",
        a: "Demandez une nouvelle photo de l'article à côté d'un papier avec votre nom et la date du jour, ou une courte vidéo. Une recherche d'image inversée permet aussi de voir si la même photo apparaît sur d'autres sites.",
      },
      {
        q: "Que signifie le badge vérifié sur Buyam Sellam ?",
        a: "Il signifie que le vendeur a passé un contrôle d'identité : sa pièce d'identité a été scannée et comparée à un selfie en direct par un service de vérification indépendant.",
      },
    ],
    related: [
      "acheter-en-ligne-en-securite-au-cameroun",
      "arnaques-mobile-money-au-cameroun-comment-les-eviter",
      "commande-en-ligne-non-recue-que-faire",
    ],
  },

  // ------------------------------------------------------------------
  // 3. Mobile money scams
  // ------------------------------------------------------------------
  {
    slug: "mobile-money-scams-in-cameroon-and-how-to-avoid-them",
    lang: "en",
    altSlug: "arnaques-mobile-money-au-cameroun-comment-les-eviter",
    topic: "payments",
    title: "Mobile money scams in Cameroon and how to avoid them",
    description:
      "The most common MTN MoMo and Orange Money scams in Cameroon — fake transfer SMS, \"wrong number\" refunds, fake agents asking for your PIN — and how to protect yourself.",
    excerpt: "Fake transfer SMS, \"wrong number\" refunds and fake agents: the tricks, and the simple rules that stop them.",
    readMinutes: 6,
    updated: "2026-09-23",
    intro: [
      "MTN Mobile Money and Orange Money have made paying and getting paid easy for millions of people in Cameroon. Scammers have followed. Almost all mobile money scams rely on the same thing: getting you to act fast on information that did not come from your operator.",
      "Whether you buy or sell online, these are the tricks to know.",
    ],
    sections: [
      {
        heading: "The fake \"money received\" SMS",
        paragraphs: [
          "Common against sellers. A \"buyer\" says they have paid, and you receive an SMS that looks like a mobile money confirmation. You hand over the goods — but the SMS came from an ordinary phone number, not from your operator, and no money ever arrived.",
          "Rule: never trust an SMS or a screenshot. Always check your real balance through the official menu (*126# for MTN MoMo, #150# for Orange Money) or your operator's app before delivering anything.",
        ],
      },
      {
        heading: "The \"I sent it to the wrong number\" refund",
        paragraphs: [
          "Someone calls or texts, very polite or very upset, saying they sent you money by mistake and begging you to send it back. Sometimes a fake SMS supports the story; sometimes real money was sent using a stolen account and will later be reversed.",
          "Rule: check your real balance. If money really did arrive by mistake, do not send it back yourself — tell the person to contact the operator, who can reverse the transaction properly.",
        ],
      },
      {
        heading: "The fake agent or \"customer service\" call",
        paragraphs: [
          "A caller claims to be from MTN, Orange or a bank. Your account will be \"blocked\", you \"won a promotion\", or there is a \"problem with a transaction\" — and to fix it they need your PIN or a code you just received by SMS.",
          "Rule: your operator will never ask for your PIN or secret code. Anyone who asks for it is a scammer. Hang up and call the official customer service number yourself.",
        ],
      },
      {
        heading: "Pay-first online sales",
        paragraphs: [
          "The seller takes full payment by transfer and then disappears, or asks for more and more \"fees\" before delivering. This is the scam that escrow payment is designed to stop.",
        ],
      },
      {
        heading: "Simple rules that stop almost every scam",
        bullets: [
          "Never share your PIN or any code received by SMS — with anyone.",
          "Check your real balance via *126# (MTN) or #150# (Orange), never via an SMS or screenshot.",
          "Do not \"refund\" wrong transfers yourself; send people to the operator.",
          "Be suspicious of urgency, prizes and threats of blocking.",
          "When buying online, use a payment that is held until you confirm delivery.",
        ],
      },
      {
        heading: "How Buyam Sellam handles payments",
        paragraphs: [
          "On Buyam Sellam, buyers pay through the official MTN Mobile Money or Orange Money payment prompt on their own phone, and the payment is confirmed directly with the payment provider, not by an SMS or a screenshot. Sellers never have to guess whether a payment is real: the order only shows as paid when the money has actually been received and is being held. And the buyer's money is only released to the seller after the buyer confirms delivery.",
        ],
      },
    ],
    keyTakeaways: [
      "Never share your PIN or SMS codes — operators never ask for them.",
      "Check your balance through the official menu, not SMS or screenshots.",
      "Send \"wrong number\" refund requests to the operator.",
      "Escrow payment removes the pay-first risk for both buyers and sellers.",
    ],
    faq: [
      {
        q: "How do I check if I really received a mobile money payment?",
        a: "Dial the official menu (*126# for MTN Mobile Money, #150# for Orange Money) or open your operator's official app and check your balance and recent transactions. Never rely on an SMS from a normal phone number or a screenshot.",
      },
      {
        q: "Will MTN or Orange ever ask for my PIN?",
        a: "No. Your PIN and the codes you receive by SMS are for you only. Anyone who asks for them is trying to steal from you.",
      },
    ],
    related: [
      "escrow-payment-explained",
      "how-to-shop-safely-online-in-cameroon",
      "how-to-sell-online-in-cameroon",
    ],
  },
  {
    slug: "arnaques-mobile-money-au-cameroun-comment-les-eviter",
    lang: "fr",
    altSlug: "mobile-money-scams-in-cameroon-and-how-to-avoid-them",
    topic: "payments",
    title: "Arnaques mobile money au Cameroun : comment les éviter",
    description:
      "Les arnaques MTN MoMo et Orange Money les plus courantes au Cameroun — faux SMS de transfert, « erreur de numéro », faux agents qui demandent votre code — et comment vous protéger.",
    excerpt: "Faux SMS de transfert, « erreur de numéro » et faux agents : les techniques, et les règles simples qui les arrêtent.",
    readMinutes: 6,
    updated: "2026-09-23",
    intro: [
      "MTN Mobile Money et Orange Money ont rendu le paiement facile pour des millions de personnes au Cameroun. Les arnaqueurs ont suivi. Presque toutes les arnaques mobile money reposent sur la même chose : vous faire agir vite sur une information qui ne vient pas de votre opérateur.",
      "Que vous achetiez ou vendiez en ligne, voici les techniques à connaître.",
    ],
    sections: [
      {
        heading: "Le faux SMS « argent reçu »",
        paragraphs: [
          "Fréquent contre les vendeurs. Un « acheteur » dit avoir payé et vous recevez un SMS qui ressemble à une confirmation mobile money. Vous remettez la marchandise — mais le SMS venait d'un numéro ordinaire, pas de votre opérateur, et aucun argent n'est arrivé.",
          "Règle : ne faites jamais confiance à un SMS ou à une capture d'écran. Vérifiez toujours votre vrai solde via le menu officiel (*126# pour MTN MoMo, #150# pour Orange Money) ou l'application de votre opérateur avant de livrer quoi que ce soit.",
        ],
      },
      {
        heading: "Le remboursement « je me suis trompé de numéro »",
        paragraphs: [
          "Quelqu'un appelle ou écrit, très poli ou très paniqué, disant vous avoir envoyé de l'argent par erreur et vous suppliant de le renvoyer. Parfois un faux SMS appuie l'histoire ; parfois de l'argent a vraiment été envoyé depuis un compte volé et sera annulé plus tard.",
          "Règle : vérifiez votre vrai solde. Si de l'argent est vraiment arrivé par erreur, ne le renvoyez pas vous-même : demandez à la personne de contacter l'opérateur, qui peut annuler la transaction correctement.",
        ],
      },
      {
        heading: "Le faux agent ou faux « service client »",
        paragraphs: [
          "Un appelant prétend être de MTN, Orange ou d'une banque. Votre compte va être « bloqué », vous avez « gagné une promotion », ou il y a un « problème sur une transaction » — et pour régler ça, il lui faut votre code secret ou un code reçu par SMS.",
          "Règle : votre opérateur ne vous demandera jamais votre code secret. Quiconque le demande est un arnaqueur. Raccrochez et appelez vous-même le service client officiel.",
        ],
      },
      {
        heading: "Les ventes en ligne « payez d'abord »",
        paragraphs: [
          "Le vendeur prend la totalité par transfert puis disparaît, ou réclame toujours plus de « frais » avant de livrer. C'est exactement l'arnaque que le paiement séquestre empêche.",
        ],
      },
      {
        heading: "Des règles simples qui arrêtent presque toutes les arnaques",
        bullets: [
          "Ne partagez jamais votre code secret ni un code reçu par SMS — avec personne.",
          "Vérifiez votre vrai solde via *126# (MTN) ou #150# (Orange), jamais via un SMS ou une capture.",
          "Ne « remboursez » pas vous-même un transfert erroné ; renvoyez vers l'opérateur.",
          "Méfiez-vous de l'urgence, des gains et des menaces de blocage.",
          "Pour acheter en ligne, utilisez un paiement gardé jusqu'à la confirmation de livraison.",
        ],
      },
      {
        heading: "Comment Buyam Sellam gère les paiements",
        paragraphs: [
          "Sur Buyam Sellam, l'acheteur paie via la demande de paiement officielle MTN Mobile Money ou Orange Money sur son propre téléphone, et le paiement est confirmé directement auprès du prestataire de paiement, pas par un SMS ni une capture d'écran. Le vendeur n'a jamais à deviner si un paiement est réel : la commande n'apparaît payée que lorsque l'argent a vraiment été reçu et est gardé. Et l'argent n'est versé au vendeur qu'après la confirmation de livraison par l'acheteur.",
        ],
      },
    ],
    keyTakeaways: [
      "Ne partagez jamais votre code secret ni les codes SMS : les opérateurs ne les demandent jamais.",
      "Vérifiez votre solde via le menu officiel, pas via un SMS ou une capture.",
      "Renvoyez les demandes de « remboursement d'erreur » vers l'opérateur.",
      "Le paiement séquestre supprime le risque du « payez d'abord » pour acheteurs et vendeurs.",
    ],
    faq: [
      {
        q: "Comment vérifier si j'ai vraiment reçu un paiement mobile money ?",
        a: "Composez le menu officiel (*126# pour MTN Mobile Money, #150# pour Orange Money) ou ouvrez l'application officielle de votre opérateur et vérifiez votre solde et vos dernières transactions. Ne vous fiez jamais à un SMS venant d'un numéro ordinaire ni à une capture d'écran.",
      },
      {
        q: "MTN ou Orange peuvent-ils me demander mon code secret ?",
        a: "Non. Votre code secret et les codes reçus par SMS sont pour vous seul. Quiconque les demande essaie de vous voler.",
      },
    ],
    related: [
      "paiement-sequestre-explique",
      "acheter-en-ligne-en-securite-au-cameroun",
      "vendre-en-ligne-au-cameroun",
    ],
  },

  // ------------------------------------------------------------------
  // 4. Escrow explained
  // ------------------------------------------------------------------
  {
    slug: "escrow-payment-explained",
    lang: "en",
    altSlug: "paiement-sequestre-explique",
    topic: "payments",
    title: "Escrow payment explained: how your money is protected on Buyam Sellam",
    description:
      "What escrow payment means, how it works with MTN MoMo and Orange Money on Buyam Sellam, when the seller gets paid, and what happens if there is a problem with your order.",
    excerpt: "Pay, receive, confirm, then the seller is paid — step by step, with what happens if something goes wrong.",
    readMinutes: 5,
    updated: "2026-09-23",
    intro: [
      "\"Escrow\" sounds technical, but the idea is simple: a neutral party holds the money during a sale, so that neither the buyer nor the seller has to trust the other blindly. The buyer knows the seller can't take the money and disappear. The seller knows the money is real and already paid.",
      "Here is exactly how it works on Buyam Sellam.",
    ],
    sections: [
      {
        heading: "Step by step",
        steps: [
          "You order and pay with MTN Mobile Money or Orange Money by confirming the prompt on your phone.",
          "Buyam Sellam holds your payment. The seller sees that the order is paid, but does not receive the money yet.",
          "The seller prepares your order and arranges delivery with you through the chat, then on WhatsApp once you have paid.",
          "You receive the item and check it.",
          "You confirm delivery on your order page. Only now is the seller paid, minus Buyam Sellam's 5% commission.",
        ],
      },
      {
        heading: "What if I forget to confirm?",
        paragraphs: [
          "So that honest sellers are not left waiting forever, an order is confirmed automatically 5 days after the seller marks it as shipped if the buyer has not reported a problem. If something is wrong, report it before then.",
        ],
      },
      {
        heading: "What if there is a problem?",
        paragraphs: [
          "Use \"Report a problem\" on your order page before confirming: for example if the item never arrived, is damaged or is not what you ordered. While the problem is open, the payment is not released. The Buyam Sellam team looks at the order, the chat and any photos, and resolves it with the buyer and the seller — including refunding the buyer when the order clearly went wrong.",
          "Important: once you confirm delivery, the payment is released and cannot be reversed. Always check before confirming.",
        ],
      },
      {
        heading: "Why sellers benefit too",
        bullets: [
          "No more fake \"money received\" SMS: the order shows as paid only when the payment is really received.",
          "Buyers who were afraid of paying strangers are more willing to order.",
          "A clear record of each order in case of disagreement.",
        ],
      },
    ],
    keyTakeaways: [
      "Your payment is held by Buyam Sellam, not sent directly to the seller.",
      "The seller is paid after you confirm delivery, or 5 days after shipping if no problem is reported.",
      "Report problems before confirming — confirming releases the payment.",
    ],
    faq: [
      {
        q: "Does escrow cost the buyer extra?",
        a: "No. Buyers pay the listed price plus any delivery fee shown at checkout. Buyam Sellam's 5% commission is taken from the seller's payout.",
      },
      {
        q: "How long does the seller wait to be paid?",
        a: "Until the buyer confirms delivery, or at most 5 days after the order is marked as shipped if no problem is reported.",
      },
    ],
    related: [
      "how-to-shop-safely-online-in-cameroon",
      "mobile-money-scams-in-cameroon-and-how-to-avoid-them",
      "what-to-do-if-your-online-order-does-not-arrive",
    ],
  },
  {
    slug: "paiement-sequestre-explique",
    lang: "fr",
    altSlug: "escrow-payment-explained",
    topic: "payments",
    title: "Le paiement séquestre expliqué : comment votre argent est protégé sur Buyam Sellam",
    description:
      "Ce que signifie le paiement séquestre (escrow), comment il fonctionne avec MTN MoMo et Orange Money sur Buyam Sellam, quand le vendeur est payé et que se passe-t-il en cas de problème.",
    excerpt: "Payer, recevoir, confirmer, puis le vendeur est payé — étape par étape, avec ce qui se passe en cas de problème.",
    readMinutes: 5,
    updated: "2026-09-23",
    intro: [
      "« Séquestre » (ou escrow) semble technique, mais l'idée est simple : un tiers neutre garde l'argent pendant la vente, pour que ni l'acheteur ni le vendeur n'aient à se faire confiance aveuglément. L'acheteur sait que le vendeur ne peut pas prendre l'argent et disparaître. Le vendeur sait que l'argent est réel et déjà payé.",
      "Voici exactement comment cela fonctionne sur Buyam Sellam.",
    ],
    sections: [
      {
        heading: "Étape par étape",
        steps: [
          "Vous commandez et payez par MTN Mobile Money ou Orange Money en validant la demande sur votre téléphone.",
          "Buyam Sellam garde votre paiement. Le vendeur voit que la commande est payée, mais ne reçoit pas encore l'argent.",
          "Le vendeur prépare votre commande et organise la livraison avec vous via la messagerie, puis sur WhatsApp une fois le paiement effectué.",
          "Vous recevez l'article et le vérifiez.",
          "Vous confirmez la livraison sur la page de votre commande. C'est seulement alors que le vendeur est payé, moins la commission de 5 % de Buyam Sellam.",
        ],
      },
      {
        heading: "Et si j'oublie de confirmer ?",
        paragraphs: [
          "Pour que les vendeurs honnêtes n'attendent pas indéfiniment, une commande est confirmée automatiquement 5 jours après que le vendeur l'a marquée comme expédiée, si l'acheteur n'a signalé aucun problème. Si quelque chose ne va pas, signalez-le avant.",
        ],
      },
      {
        heading: "Et en cas de problème ?",
        paragraphs: [
          "Utilisez « Signaler un problème » sur la page de votre commande avant de confirmer : par exemple si l'article n'est jamais arrivé, est abîmé ou ne correspond pas. Tant que le problème est ouvert, le paiement n'est pas versé. L'équipe Buyam Sellam examine la commande, la conversation et les photos, et règle la situation avec l'acheteur et le vendeur — y compris en remboursant l'acheteur quand la commande a clairement mal tourné.",
          "Important : une fois la livraison confirmée, le paiement est versé et ne peut plus être annulé. Vérifiez toujours avant de confirmer.",
        ],
      },
      {
        heading: "Pourquoi les vendeurs y gagnent aussi",
        bullets: [
          "Fini les faux SMS « argent reçu » : la commande n'apparaît payée que lorsque le paiement est réellement reçu.",
          "Les acheteurs qui avaient peur de payer des inconnus commandent plus facilement.",
          "Un historique clair de chaque commande en cas de désaccord.",
        ],
      },
    ],
    keyTakeaways: [
      "Votre paiement est gardé par Buyam Sellam, pas envoyé directement au vendeur.",
      "Le vendeur est payé après votre confirmation, ou 5 jours après l'expédition si aucun problème n'est signalé.",
      "Signalez les problèmes avant de confirmer : confirmer libère le paiement.",
    ],
    faq: [
      {
        q: "Le séquestre coûte-t-il plus cher à l'acheteur ?",
        a: "Non. L'acheteur paie le prix affiché plus les éventuels frais de livraison indiqués au paiement. La commission de 5 % de Buyam Sellam est prélevée sur le versement au vendeur.",
      },
      {
        q: "Combien de temps le vendeur attend-il pour être payé ?",
        a: "Jusqu'à la confirmation de livraison par l'acheteur, ou au plus 5 jours après que la commande est marquée expédiée si aucun problème n'est signalé.",
      },
    ],
    related: [
      "acheter-en-ligne-en-securite-au-cameroun",
      "arnaques-mobile-money-au-cameroun-comment-les-eviter",
      "commande-en-ligne-non-recue-que-faire",
    ],
  },

  // ------------------------------------------------------------------
  // 5. Order not received
  // ------------------------------------------------------------------
  {
    slug: "what-to-do-if-your-online-order-does-not-arrive",
    lang: "en",
    altSlug: "commande-en-ligne-non-recue-que-faire",
    topic: "buyers",
    title: "Your online order hasn't arrived? What to do, step by step",
    description:
      "Online order not delivered, late, or not what you ordered in Cameroon? The steps to take, what evidence to keep, and how to get your money back on Buyam Sellam.",
    excerpt: "Late, missing or wrong item: the exact steps to take and the evidence to keep.",
    readMinutes: 5,
    updated: "2026-09-23",
    intro: [
      "An order that doesn't arrive is stressful, especially when you have already paid. The most important thing is to act calmly but quickly, and to keep everything in writing. Here is what to do.",
    ],
    sections: [
      {
        heading: "1. Check the delivery details first",
        paragraphs: [
          "Many \"missing\" orders are simply delayed or waiting for the delivery person to reach you. Check the delivery time the seller announced, and whether the phone number and address on your order are correct and reachable.",
        ],
      },
      {
        heading: "2. Contact the seller in writing",
        paragraphs: [
          "Send a clear, polite message: your order reference, what you ordered, when you paid, and your question. On Buyam Sellam, use the chat or WhatsApp link on your order page, so the conversation is linked to the order. Written messages are your evidence later.",
        ],
      },
      {
        heading: "3. Collect your evidence",
        bullets: [
          "Your order page or order reference.",
          "Your payment reference or transaction ID.",
          "Screenshots of your conversation with the seller.",
          "If you received the wrong item: photos of the package, the label and the item.",
        ],
      },
      {
        heading: "4. Report the problem before confirming",
        paragraphs: [
          "On Buyam Sellam, open your order and use \"Report a problem\" before you confirm delivery. Explain what happened and add photos if you have them. While a problem is open, your payment stays held and is not paid to the seller. The Buyam Sellam team reviews the case with you and the seller.",
          "Do not confirm delivery just because the seller asks you to \"confirm first\". Confirming releases the payment.",
        ],
      },
      {
        heading: "5. If you bought outside a marketplace",
        paragraphs: [
          "Keep contacting the seller in writing, report the account on the platform where you found it, and contact your mobile money operator's customer service with the transaction ID as quickly as possible. Unfortunately, recovering a direct transfer is often difficult — which is why paying through escrow matters.",
        ],
      },
    ],
    keyTakeaways: [
      "Check delivery details, then contact the seller in writing.",
      "Keep your order reference, payment ID, chats and photos.",
      "Report the problem before confirming — your payment stays held.",
    ],
    faq: [
      {
        q: "How long do I have to report a problem on Buyam Sellam?",
        a: "Report it before you confirm delivery and before the 5-day automatic confirmation that starts when the seller marks the order as shipped.",
      },
      {
        q: "The seller asks me to confirm delivery before I have the item. Should I?",
        a: "No. Only confirm once you have received and checked your order. Confirming releases the payment to the seller.",
      },
    ],
    related: [
      "escrow-payment-explained",
      "how-to-shop-safely-online-in-cameroon",
      "how-to-spot-a-fake-seller-on-whatsapp-and-facebook",
    ],
  },
  {
    slug: "commande-en-ligne-non-recue-que-faire",
    lang: "fr",
    altSlug: "what-to-do-if-your-online-order-does-not-arrive",
    topic: "buyers",
    title: "Commande en ligne non reçue ? Que faire, étape par étape",
    description:
      "Commande en ligne non livrée, en retard ou non conforme au Cameroun ? Les étapes à suivre, les preuves à garder, et comment récupérer votre argent sur Buyam Sellam.",
    excerpt: "Retard, colis manquant ou mauvais article : les étapes exactes et les preuves à garder.",
    readMinutes: 5,
    updated: "2026-09-23",
    intro: [
      "Une commande qui n'arrive pas, c'est stressant, surtout quand on a déjà payé. Le plus important est d'agir calmement mais rapidement, et de tout garder par écrit. Voici quoi faire.",
    ],
    sections: [
      {
        heading: "1. Vérifiez d'abord les informations de livraison",
        paragraphs: [
          "Beaucoup de commandes « perdues » sont simplement en retard ou attendent que le livreur vous joigne. Vérifiez le délai annoncé par le vendeur, et que le numéro et l'adresse de votre commande sont corrects et joignables.",
        ],
      },
      {
        heading: "2. Contactez le vendeur par écrit",
        paragraphs: [
          "Envoyez un message clair et poli : la référence de commande, ce que vous avez commandé, quand vous avez payé, et votre question. Sur Buyam Sellam, utilisez la messagerie ou le lien WhatsApp de votre page de commande, pour que la conversation soit liée à la commande. Les messages écrits sont vos preuves.",
        ],
      },
      {
        heading: "3. Rassemblez vos preuves",
        bullets: [
          "Votre page ou référence de commande.",
          "Votre référence de paiement ou identifiant de transaction.",
          "Des captures d'écran de la conversation avec le vendeur.",
          "Si vous avez reçu le mauvais article : des photos du colis, de l'étiquette et de l'article.",
        ],
      },
      {
        heading: "4. Signalez le problème avant de confirmer",
        paragraphs: [
          "Sur Buyam Sellam, ouvrez votre commande et utilisez « Signaler un problème » avant de confirmer la livraison. Expliquez ce qui s'est passé et ajoutez des photos si vous en avez. Tant qu'un problème est ouvert, votre paiement reste bloqué et n'est pas versé au vendeur. L'équipe Buyam Sellam examine le cas avec vous et le vendeur.",
          "Ne confirmez pas la livraison simplement parce que le vendeur vous demande de « confirmer d'abord ». Confirmer libère le paiement.",
        ],
      },
      {
        heading: "5. Si vous avez acheté hors d'une marketplace",
        paragraphs: [
          "Continuez à contacter le vendeur par écrit, signalez le compte sur la plateforme où vous l'avez trouvé, et contactez au plus vite le service client de votre opérateur mobile money avec l'identifiant de transaction. Malheureusement, récupérer un transfert direct est souvent difficile — c'est pourquoi le paiement séquestre est important.",
        ],
      },
    ],
    keyTakeaways: [
      "Vérifiez la livraison, puis contactez le vendeur par écrit.",
      "Gardez référence de commande, identifiant de paiement, messages et photos.",
      "Signalez le problème avant de confirmer : votre paiement reste bloqué.",
    ],
    faq: [
      {
        q: "Combien de temps ai-je pour signaler un problème sur Buyam Sellam ?",
        a: "Signalez-le avant de confirmer la livraison et avant la confirmation automatique de 5 jours qui démarre quand le vendeur marque la commande comme expédiée.",
      },
      {
        q: "Le vendeur me demande de confirmer la livraison avant d'avoir l'article. Dois-je le faire ?",
        a: "Non. Confirmez seulement après avoir reçu et vérifié votre commande. Confirmer libère le paiement au vendeur.",
      },
    ],
    related: [
      "paiement-sequestre-explique",
      "acheter-en-ligne-en-securite-au-cameroun",
      "reconnaitre-un-faux-vendeur-sur-whatsapp-et-facebook",
    ],
  },

  // ------------------------------------------------------------------
  // 6. Selling online
  // ------------------------------------------------------------------
  {
    slug: "how-to-sell-online-in-cameroon",
    lang: "en",
    altSlug: "vendre-en-ligne-au-cameroun",
    topic: "sellers",
    title: "How to sell online in Cameroon and get paid safely",
    description:
      "A practical guide to selling online in Cameroon: photos, prices, delivery, getting paid by mobile money without fake payment risk, and using WhatsApp groups to find buyers.",
    excerpt: "Photos, prices, delivery and getting paid without fake-payment risk — plus how to keep using your WhatsApp groups.",
    readMinutes: 8,
    updated: "2026-09-23",
    intro: [
      "Many of the best sellers in Cameroon already sell online — in WhatsApp groups, on Facebook, TikTok and Instagram. What holds them back is rarely the product. It is trust: buyers are afraid to pay first, and sellers are afraid of fake payments and buyers who never collect.",
      "This guide covers the basics of selling well online, and how to remove the trust problem for both sides.",
    ],
    sections: [
      {
        heading: "1. Photos that sell",
        bullets: [
          "Use daylight, near a window, on a plain background.",
          "Show the whole item, then details: fabric, stitching, labels, soles, hair texture.",
          "Show the item being worn or used when possible.",
          "Use your own photos: buyers increasingly recognise copied pictures, and they destroy trust.",
        ],
      },
      {
        heading: "2. Clear prices and descriptions",
        paragraphs: [
          "Write the price, sizes, colours, condition (new, like new, used) and what is included. Answer the questions buyers always ask before they ask them. A clear listing means fewer messages and more orders.",
        ],
      },
      {
        heading: "3. Be clear about delivery",
        paragraphs: [
          "Say which neighbourhoods and cities you deliver to, the price and the usual delay. On Buyam Sellam, you can set a delivery fee and even price delivery automatically by distance, so buyers see the full cost before paying.",
        ],
      },
      {
        heading: "4. Get paid without the fake-payment risk",
        paragraphs: [
          "Fake \"money received\" SMS and screenshots are a real danger for sellers. With Buyam Sellam, the buyer pays through the official MTN Mobile Money or Orange Money prompt, and the order only shows as paid once the payment is actually received. You deliver knowing the money is real. You are paid once the buyer confirms delivery, or automatically 5 days after you mark the order as shipped if the buyer reports no problem. Listing is free; Buyam Sellam takes a 5% commission on completed orders.",
        ],
      },
      {
        heading: "5. Keep your WhatsApp groups — but route payments safely",
        paragraphs: [
          "Your WhatsApp groups and statuses are where your customers already are. Keep using them for reach. From your Buyam Sellam dashboard you can copy your whole catalog as one message with links, and paste it into your groups. Buyers tap a link, pay safely, and you get the order — protected on both sides.",
        ],
      },
      {
        heading: "6. Build trust that lasts",
        bullets: [
          "Get the verified badge with a quick ID and live-selfie check.",
          "Reply to messages fast: a \"usually replies within an hour\" badge appears on your shop once you do.",
          "Ask happy buyers to leave a review, and reply to reviews politely.",
          "Keep stock up to date so buyers never pay for something you don't have.",
        ],
      },
    ],
    keyTakeaways: [
      "Your own clear photos and complete descriptions sell more.",
      "Show delivery areas, fees and delays upfront.",
      "Escrow payment removes fake-payment risk and makes buyers confident.",
      "Keep using WhatsApp for reach, but send buyers to a safe checkout.",
    ],
    faq: [
      {
        q: "How much does it cost to sell on Buyam Sellam?",
        a: "Opening a shop and listing products is free. Buyam Sellam takes a 5% commission on completed orders only.",
      },
      {
        q: "When do I receive my money?",
        a: "After the buyer confirms delivery, or automatically 5 days after you mark the order as shipped if the buyer reports no problem.",
      },
      {
        q: "Can I still sell in my WhatsApp groups?",
        a: "Yes. Share your Buyam Sellam product links or your whole catalog in your groups; buyers pay through the site so both of you are protected.",
      },
    ],
    related: [
      "mobile-money-scams-in-cameroon-and-how-to-avoid-them",
      "escrow-payment-explained",
      "how-to-shop-safely-online-in-cameroon",
    ],
  },
  {
    slug: "vendre-en-ligne-au-cameroun",
    lang: "fr",
    altSlug: "how-to-sell-online-in-cameroon",
    topic: "sellers",
    title: "Vendre en ligne au Cameroun et être payé en toute sécurité",
    description:
      "Guide pratique pour vendre en ligne au Cameroun : photos, prix, livraison, être payé par mobile money sans risque de faux paiement, et utiliser vos groupes WhatsApp pour trouver des clients.",
    excerpt: "Photos, prix, livraison et paiement sans risque de faux paiement — et comment garder vos groupes WhatsApp.",
    readMinutes: 8,
    updated: "2026-09-23",
    intro: [
      "Beaucoup des meilleurs vendeurs du Cameroun vendent déjà en ligne — dans les groupes WhatsApp, sur Facebook, TikTok et Instagram. Ce qui les freine est rarement le produit. C'est la confiance : les acheteurs ont peur de payer d'abord, et les vendeurs ont peur des faux paiements et des clients qui ne viennent jamais récupérer.",
      "Ce guide présente les bases pour bien vendre en ligne, et comment supprimer le problème de confiance des deux côtés.",
    ],
    sections: [
      {
        heading: "1. Des photos qui vendent",
        bullets: [
          "Utilisez la lumière du jour, près d'une fenêtre, sur un fond uni.",
          "Montrez l'article entier, puis les détails : tissu, coutures, étiquettes, semelles, texture des mèches.",
          "Montrez l'article porté ou utilisé quand c'est possible.",
          "Utilisez vos propres photos : les acheteurs reconnaissent de plus en plus les images copiées, et elles détruisent la confiance.",
        ],
      },
      {
        heading: "2. Des prix et descriptions clairs",
        paragraphs: [
          "Indiquez le prix, les tailles, les couleurs, l'état (neuf, comme neuf, occasion) et ce qui est inclus. Répondez aux questions que les acheteurs posent toujours avant qu'ils les posent. Une annonce claire, c'est moins de messages et plus de commandes.",
        ],
      },
      {
        heading: "3. Soyez clair sur la livraison",
        paragraphs: [
          "Précisez les quartiers et villes où vous livrez, le prix et le délai habituel. Sur Buyam Sellam, vous pouvez fixer des frais de livraison et même les calculer automatiquement selon la distance, pour que l'acheteur voie le coût total avant de payer.",
        ],
      },
      {
        heading: "4. Être payé sans risque de faux paiement",
        paragraphs: [
          "Les faux SMS « argent reçu » et les fausses captures sont un vrai danger pour les vendeurs. Avec Buyam Sellam, l'acheteur paie via la demande officielle MTN Mobile Money ou Orange Money, et la commande n'apparaît payée qu'une fois le paiement réellement reçu. Vous livrez en sachant que l'argent est réel. Vous êtes payé quand l'acheteur confirme la livraison, ou automatiquement 5 jours après avoir marqué la commande comme expédiée si l'acheteur ne signale aucun problème. La mise en ligne est gratuite ; Buyam Sellam prend une commission de 5 % sur les commandes terminées.",
        ],
      },
      {
        heading: "5. Gardez vos groupes WhatsApp — mais sécurisez le paiement",
        paragraphs: [
          "Vos groupes et statuts WhatsApp sont là où se trouvent déjà vos clients. Continuez à les utiliser pour vous faire connaître. Depuis votre tableau de bord Buyam Sellam, vous pouvez copier tout votre catalogue en un seul message avec les liens, et le coller dans vos groupes. L'acheteur touche un lien, paie en sécurité, et vous recevez la commande — protégés des deux côtés.",
        ],
      },
      {
        heading: "6. Construire une confiance durable",
        bullets: [
          "Obtenez le badge vérifié grâce à un contrôle rapide de pièce d'identité et selfie en direct.",
          "Répondez vite aux messages : un badge « répond généralement en moins d'une heure » apparaît alors sur votre boutique.",
          "Demandez aux clients satisfaits de laisser un avis, et répondez poliment aux avis.",
          "Tenez vos stocks à jour pour qu'un acheteur ne paie jamais pour un article que vous n'avez pas.",
        ],
      },
    ],
    keyTakeaways: [
      "Vos propres photos claires et des descriptions complètes vendent plus.",
      "Affichez zones, frais et délais de livraison dès le départ.",
      "Le paiement séquestre supprime le risque de faux paiement et rassure les acheteurs.",
      "Gardez WhatsApp pour la visibilité, mais envoyez les acheteurs vers un paiement sécurisé.",
    ],
    faq: [
      {
        q: "Combien coûte la vente sur Buyam Sellam ?",
        a: "Ouvrir une boutique et publier des produits est gratuit. Buyam Sellam prend une commission de 5 % uniquement sur les commandes terminées.",
      },
      {
        q: "Quand est-ce que je reçois mon argent ?",
        a: "Après la confirmation de livraison par l'acheteur, ou automatiquement 5 jours après avoir marqué la commande comme expédiée si l'acheteur ne signale aucun problème.",
      },
      {
        q: "Puis-je continuer à vendre dans mes groupes WhatsApp ?",
        a: "Oui. Partagez vos liens produits Buyam Sellam ou tout votre catalogue dans vos groupes ; les acheteurs paient via le site pour que vous soyez tous les deux protégés.",
      },
    ],
    related: [
      "arnaques-mobile-money-au-cameroun-comment-les-eviter",
      "paiement-sequestre-explique",
      "acheter-en-ligne-en-securite-au-cameroun",
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getGuidesByLang(lang: GuideLang): Guide[] {
  return GUIDES.filter((g) => g.lang === lang);
}
