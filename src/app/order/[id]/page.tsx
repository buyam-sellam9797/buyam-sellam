import OrderStatus from "./order-status";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <OrderStatus orderId={id} />
    </div>
  );
}
