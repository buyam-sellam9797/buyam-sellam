import { getLocale } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export default async function RefundPage() {
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {locale === "fr" ? <RefundFr /> : <RefundEn />}
    </div>
  );
}

function RefundEn() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-1">Refund Policy</h1>
      <p className="text-sm text-neutral-500 mb-8">Last updated: September 2026</p>

      <p>
        Buyam Sellam holds your payment until you confirm you received your order — that&rsquo;s
        the core protection built into every purchase. This page explains exactly how that works.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">While your order is being prepared</h2>
      <p>
        Once you pay, your money is held safely. If the seller cancels, or doesn&rsquo;t ship
        within a reasonable time, contact us and we will arrange a full refund.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">When your order ships</h2>
      <p>
        Once the seller marks your order as shipped, you have 5 days to check it. If it&rsquo;s
        correct, click &ldquo;I received my order&rdquo; on your order page so the seller gets
        paid. If you don&rsquo;t respond within 5 days, the order is automatically marked as
        received and the seller is paid — so please check your order promptly.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">If something is wrong</h2>
      <p>
        If your order never arrives, or arrives significantly different from the listing (wrong
        item, badly damaged, or clearly not as described), do not click &ldquo;I received my
        order.&rdquo; Instead, contact the seller directly first using the WhatsApp number on their
        shop page. Most issues are resolved directly between buyer and seller this way. If you
        can&rsquo;t reach an agreement, contact Buyam Sellam with your order details and photos of
        the issue, and we will help mediate — including refunding you from the held payment where
        appropriate.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">What isn&rsquo;t covered</h2>
      <p>
        Minor differences in color or shade due to photos or screens, and buyer&rsquo;s remorse
        (simply changing your mind after receiving a correctly-described item), are not eligible
        for a refund once you&rsquo;ve confirmed receipt.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">How refunds are paid</h2>
      <p>
        Refunds are sent back to the mobile money number used for the original payment.
      </p>
    </div>
  );
}

function RefundFr() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-1">Politique de remboursement</h1>
      <p className="text-sm text-neutral-500 mb-8">Dernière mise à jour : septembre 2026</p>

      <p>
        Buyam Sellam retient votre paiement jusqu&rsquo;à ce que vous confirmiez avoir reçu votre
        commande — c&rsquo;est la protection au cœur de chaque achat. Cette page explique
        précisément comment cela fonctionne.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Pendant la préparation de votre commande</h2>
      <p>
        Une fois le paiement effectué, votre argent est retenu en toute sécurité. Si le vendeur
        annule, ou n&rsquo;expédie pas dans un délai raisonnable, contactez-nous et nous
        organiserons un remboursement complet.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Une fois votre commande expédiée</h2>
      <p>
        Dès que le vendeur marque votre commande comme expédiée, vous disposez de 5 jours pour la
        vérifier. Si tout est correct, cliquez sur « J&rsquo;ai reçu ma commande » sur la page de
        votre commande afin que le vendeur soit payé. Si vous ne répondez pas dans les 5 jours, la
        commande est automatiquement marquée comme reçue et le vendeur est payé — merci donc de
        vérifier votre commande rapidement.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">En cas de problème</h2>
      <p>
        Si votre commande n&rsquo;arrive jamais, ou arrive très différente de l&rsquo;annonce
        (mauvais article, gravement endommagé, ou clairement non conforme à la description), ne
        cliquez pas sur « J&rsquo;ai reçu ma commande ». Contactez d&rsquo;abord directement le
        vendeur via le numéro WhatsApp indiqué sur sa boutique. La plupart des problèmes se
        résolvent ainsi entre acheteur et vendeur. Si vous ne trouvez pas d&rsquo;accord, contactez
        Buyam Sellam avec les détails de votre commande et des photos du problème, et nous vous
        aiderons à trouver une solution — y compris un remboursement à partir du paiement retenu si
        cela est justifié.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Ce qui n&rsquo;est pas couvert</h2>
      <p>
        Les légères différences de couleur ou de teinte dues aux photos ou aux écrans, ainsi que le
        simple changement d&rsquo;avis après réception d&rsquo;un article correctement décrit, ne
        sont pas éligibles à un remboursement une fois la réception confirmée.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Comment les remboursements sont versés</h2>
      <p>
        Les remboursements sont renvoyés vers le numéro Mobile Money utilisé pour le paiement
        initial.
      </p>
    </div>
  );
}
