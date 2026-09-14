import { getLocale } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {locale === "fr" ? <PrivacyFr /> : <PrivacyEn />}
    </div>
  );
}

function PrivacyEn() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-sm text-neutral-500 mb-8">Last updated: September 2026</p>

      <p>
        Buyam Sellam (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a marketplace connecting buyers and
        independent sellers in Cameroon. This page explains what information we collect when you
        use buyamsellam.shop, and how it is used.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">What we collect</h2>
      <p>
        When you buy as a guest, we collect the phone number you check out with, so we can confirm
        your mobile money payment and let the seller reach you about delivery. When you open a shop
        as a seller, we collect your name, email, WhatsApp number, city, and the products you list
        (including photos). We do not require buyers to create an account.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">How we use it</h2>
      <p>
        Your information is used only to process orders, connect buyers and sellers, and operate
        the escrow system that holds a payment until you confirm you received your order. We do
        not sell your personal information to anyone, and we do not use it for advertising.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Payments</h2>
      <p>
        Mobile money payments are processed by NotchPay, a licensed payment provider. Buyam Sellam
        never sees or stores your mobile money PIN — that is handled entirely by your mobile money
        provider (MTN or Orange) and NotchPay.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Cookies</h2>
      <p>
        We use a single small cookie to remember whether you prefer the site in English or French.
        It does not track you across other websites.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Where your data is stored</h2>
      <p>
        Your data is stored securely with Supabase, our database provider, using industry-standard
        access controls.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Contact us</h2>
      <p>
        If you have questions about your data, or want it deleted, message us on WhatsApp using the
        number listed on the shop you dealt with, or contact Buyam Sellam directly.
      </p>
    </div>
  );
}

function PrivacyFr() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-1">Politique de confidentialité</h1>
      <p className="text-sm text-neutral-500 mb-8">Dernière mise à jour : septembre 2026</p>

      <p>
        Buyam Sellam (« nous ») est une marketplace mettant en relation acheteurs et vendeurs
        indépendants au Cameroun. Cette page explique quelles informations nous collectons lorsque
        vous utilisez buyamsellam.shop, et comment elles sont utilisées.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Ce que nous collectons</h2>
      <p>
        Lorsque vous achetez en tant qu&rsquo;invité, nous collectons le numéro de téléphone utilisé
        pour la commande, afin de confirmer votre paiement Mobile Money et permettre au vendeur de
        vous contacter pour la livraison. Lorsque vous ouvrez une boutique en tant que vendeur, nous
        collectons votre nom, votre email, votre numéro WhatsApp, votre ville et les produits que
        vous publiez (y compris les photos). Aucun compte n&rsquo;est requis pour acheter.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Comment nous les utilisons</h2>
      <p>
        Vos informations servent uniquement à traiter les commandes, mettre en relation acheteurs
        et vendeurs, et faire fonctionner le système de paiement retenu jusqu&rsquo;à confirmation
        de réception. Nous ne vendons jamais vos données personnelles et ne les utilisons pas à des
        fins publicitaires.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Paiements</h2>
      <p>
        Les paiements Mobile Money sont traités par NotchPay, un prestataire de paiement agréé.
        Buyam Sellam ne voit ni ne stocke jamais votre code PIN Mobile Money — cela est géré
        entièrement par votre opérateur (MTN ou Orange) et NotchPay.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Cookies</h2>
      <p>
        Nous utilisons un seul petit cookie pour mémoriser si vous préférez le site en français ou
        en anglais. Il ne vous suit pas sur d&rsquo;autres sites web.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Où vos données sont stockées</h2>
      <p>
        Vos données sont stockées de manière sécurisée chez Supabase, notre fournisseur de base de
        données, avec des contrôles d&rsquo;accès conformes aux standards du secteur.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Nous contacter</h2>
      <p>
        Pour toute question sur vos données, ou pour demander leur suppression, contactez-nous via
        WhatsApp au numéro indiqué sur la boutique concernée, ou contactez directement Buyam Sellam.
      </p>
    </div>
  );
}
