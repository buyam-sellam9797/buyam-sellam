import { notFound } from "next/navigation";
import { getGroupBuyById, getProductById } from "@/lib/supabase";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import JoinGroupBuyForm from "./join-group-buy-form";

export const dynamic = "force-dynamic";

export default async function GroupBuyPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await params;
  const groupBuy = await getGroupBuyById(id);
  if (!groupBuy) notFound();

  const product = await getProductById(groupBuy.product_id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold mb-6">{t.groupBuyJoin.pageTitle}</h1>
      <JoinGroupBuyForm groupBuy={groupBuy} product={product} />
    </div>
  );
}
