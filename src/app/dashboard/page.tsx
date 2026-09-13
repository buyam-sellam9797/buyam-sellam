import { products, formatFcfa } from "@/lib/mock-data";

// Demo seller dashboard. Once a seller logs in for real, this will
// query Supabase for that seller's own shop, products, and orders.
export default function DashboardPage() {
  const myProducts = products.filter((p) => p.shopSlug === "mama-clara-fashion");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Mama Clara Fashion</h1>
      <p className="text-neutral-500 text-sm mb-8">Seller dashboard (demo)</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Stat label="Listings" value={String(myProducts.length)} />
        <Stat label="Orders held" value="0" />
        <Stat label="Paid out" value={formatFcfa(0)} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your listings</h2>
        <button className="text-sm rounded-full bg-neutral-900 text-white px-4 py-1.5">
          + Add product
        </button>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {myProducts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl">
              {p.imageEmoji}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{p.title}</p>
              <p className="text-xs text-neutral-500">{p.category}</p>
            </div>
            <p className="text-sm font-semibold">{formatFcfa(p.priceFcfa)}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mt-10 mb-4">Orders</h2>
      <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
        No orders yet. Once a buyer pays, it will show up here as
        &ldquo;held&rdquo; until you mark it shipped and the buyer confirms
        receipt.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
