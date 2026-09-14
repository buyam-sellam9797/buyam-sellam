import { getLocale } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {locale === "fr" ? <TermsFr /> : <TermsEn />}
    </div>
  );
}

function TermsEn() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
      <p className="text-sm text-neutral-500 mb-8">Last updated: September 2026</p>

      <p>
        By using buyamsellam.shop, you agree to these terms. Please read them before buying or
        selling on the platform.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">What Buyam Sellam is</h2>
      <p>
        Buyam Sellam is a marketplace that connects independent sellers with buyers in Cameroon.
        Sellers are independent businesses, not employees or agents of Buyam Sellam. Buyam Sellam
        does not manufacture, own, or inspect the products listed — sellers are responsible for the
        accuracy of their listings and the quality of what they ship.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">How payment works</h2>
      <p>
        When you pay for an order, your money is held by Buyam Sellam rather than sent directly to
        the seller. It is released to the seller once you confirm you received your order, or
        automatically after 5 days from the order being marked as shipped if you have not responded.
        This automatic release exists so sellers aren&rsquo;t left waiting indefinitely, and it is
        why it&rsquo;s important to check your order and confirm (or raise a problem) promptly.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Seller responsibilities</h2>
      <p>
        Sellers agree to list products honestly (accurate photos, price, and condition), ship what
        was ordered promptly, and respond to buyers in good faith. Buyam Sellam may remove listings
        or suspend shops that repeatedly fail to do this.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Buyer responsibilities</h2>
      <p>
        Buyers agree to provide accurate contact and payment details, and to confirm receipt (or
        raise a dispute) honestly and promptly once an order arrives.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Disputes</h2>
      <p>
        If an order doesn&rsquo;t arrive, or arrives significantly different from what was listed,
        contact the seller directly first (using the contact details provided), and reach out to
        Buyam Sellam if it isn&rsquo;t resolved. See our Refund Policy for how this is handled.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Limitation of liability</h2>
      <p>
        Buyam Sellam facilitates transactions and holds payment in escrow, but is not a party to
        the underlying sale between buyer and seller. We do our best to resolve disputes fairly,
        but we cannot guarantee the condition, legality, or delivery of any specific item listed by
        a third-party seller.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Changes to these terms</h2>
      <p>
        We may update these terms as the platform grows. Continued use of the site after a change
        means you accept the updated terms.
      </p>
    </div>
  );
}

function TermsFr() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-1">Conditions d&rsquo;utilisation</h1>
      <p className="text-sm text-neutral-500 mb-8">Dernière mise à jour : septembre 2026</p>

      <p>
        En utilisant buyamsellam.shop, vous acceptez ces conditions. Merci de les lire avant
        d&rsquo;acheter ou de vendre sur la plateforme.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Ce qu&rsquo;est Buyam Sellam</h2>
      <p>
        Buyam Sellam est une marketplace qui met en relation des vendeurs indépendants et des
        acheteurs au Cameroun. Les vendeurs sont des commerçants indépendants, et non des employés
        ou agents de Buyam Sellam. Buyam Sellam ne fabrique, ne possède, ni n&rsquo;inspecte les
        produits publiés — les vendeurs sont responsables de l&rsquo;exactitude de leurs annonces et
        de la qualité de ce qu&rsquo;ils expédient.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Comment fonctionne le paiement</h2>
      <p>
        Lorsque vous payez une commande, votre argent est retenu par Buyam Sellam plutôt
        qu&rsquo;envoyé directement au vendeur. Il est reversé au vendeur dès que vous confirmez
        avoir reçu votre commande, ou automatiquement 5 jours après que la commande a été marquée
        comme expédiée si vous n&rsquo;avez pas répondu. Cette libération automatique existe pour
        que les vendeurs ne restent pas indéfiniment en attente — d&rsquo;où l&rsquo;importance de
        vérifier votre commande et de confirmer (ou signaler un problème) rapidement.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Responsabilités du vendeur</h2>
      <p>
        Les vendeurs s&rsquo;engagent à publier des annonces honnêtes (photos, prix et état
        exacts), à expédier rapidement ce qui a été commandé, et à répondre de bonne foi aux
        acheteurs. Buyam Sellam peut retirer des annonces ou suspendre des boutiques qui manquent
        à ces engagements de façon répétée.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Responsabilités de l&rsquo;acheteur</h2>
      <p>
        Les acheteurs s&rsquo;engagent à fournir des coordonnées et informations de paiement
        exactes, et à confirmer la réception (ou signaler un litige) honnêtement et rapidement une
        fois la commande arrivée.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Litiges</h2>
      <p>
        Si une commande n&rsquo;arrive pas, ou arrive très différente de ce qui était annoncé,
        contactez d&rsquo;abord directement le vendeur (avec les coordonnées fournies), puis
        contactez Buyam Sellam si le problème n&rsquo;est pas résolu. Voir notre Politique de
        remboursement pour la marche à suivre.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Limitation de responsabilité</h2>
      <p>
        Buyam Sellam facilite les transactions et retient le paiement en séquestre, mais
        n&rsquo;est pas partie à la vente elle-même entre acheteur et vendeur. Nous faisons de
        notre mieux pour résoudre les litiges équitablement, mais nous ne pouvons garantir
        l&rsquo;état, la légalité ou la livraison d&rsquo;un article publié par un vendeur tiers.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Modifications de ces conditions</h2>
      <p>
        Nous pouvons mettre à jour ces conditions à mesure que la plateforme évolue. Continuer à
        utiliser le site après une modification signifie que vous acceptez les nouvelles
        conditions.
      </p>
    </div>
  );
}
