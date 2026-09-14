import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { getSupportWhatsapp, getSupportEmail, buildSupportWhatsAppLink } from "@/lib/site";

export const dynamic = "force-dynamic";

function FaqSection({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: { q: string; a: string }[];
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-sm font-semibold">{item.q}</p>
            <p className="text-sm text-neutral-600 mt-1">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function HelpPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const whatsapp = getSupportWhatsapp();
  const email = getSupportEmail();
  const supportLink = buildSupportWhatsAppLink(
    locale === "fr" ? "Bonjour, j'ai une question." : "Hi, I have a question."
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">{t.help.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.help.subtitle}</p>

      <FaqSection id="buying" title={t.help.buyingTitle} items={t.help.buying} />
      <FaqSection id="selling" title={t.help.sellingTitle} items={t.help.selling} />
      <FaqSection id="payments" title={t.help.paymentsTitle} items={t.help.payments} />
      <FaqSection id="delivery" title={t.help.deliveryTitle} items={t.help.delivery} />

      <section id="buyer-protection" className="mb-10 scroll-mt-20">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-900">
          <p className="font-semibold mb-1">{t.help.protectionTitle}</p>
          <p>{t.help.protectionBody}</p>
        </div>
      </section>

      <section id="contact" className="scroll-mt-20">
        <h2 className="text-lg font-bold mb-2">{t.help.contactTitle}</h2>
        <p className="text-sm text-neutral-600 mb-4">{t.help.contactIntro}</p>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm space-y-2">
          <p>
            <span className="text-neutral-500">{t.help.contactWhatsappLabel}: </span>
            <a href={supportLink} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
              {whatsapp}
            </a>
          </p>
          <p>
            <span className="text-neutral-500">{t.help.contactEmailLabel}: </span>
            <a href={`mailto:${email}`} className="text-amber-600 hover:underline">
              {email}
            </a>
          </p>
          <p>
            <span className="text-neutral-500">{t.help.contactHoursLabel}: </span>
            {t.help.contactHours}
          </p>
          <p>
            <span className="text-neutral-500">{t.help.contactResponseLabel}: </span>
            {t.help.contactResponseTime}
          </p>
        </div>
      </section>
    </div>
  );
}
