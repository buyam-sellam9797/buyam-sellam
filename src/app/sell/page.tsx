"use client";

import { useState } from "react";
import { categories } from "@/lib/mock-data";

export default function SellPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Once Supabase is connected, this creates a row in `profiles`
    // (role: seller) and `shops`, then redirects to /dashboard.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">Application received ✓</h1>
        <p className="text-neutral-600 text-sm">
          In the live version, we&apos;d verify your details and your shop
          would go live within 24 hours. For now this is a demo — the real
          version connects once the database is set up.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">Open your shop</h1>
      <p className="text-neutral-500 text-sm mb-8">
        Free to list. You only get paid once a buyer confirms they received
        their order.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Your full name" id="name" required />
        <Field label="Shop name" id="shopName" required placeholder="e.g. Mama Clara Fashion" />
        <Field
          label="WhatsApp number"
          id="whatsapp"
          required
          placeholder="6XX XXX XXX"
        />

        <div>
          <label className="text-sm font-medium block mb-2">
            Main category
          </label>
          <select
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <Field
          label="Neighborhood in Douala"
          id="neighborhood"
          required
          placeholder="e.g. Akwa, Bonaberi, Bepanda"
        />

        <button
          type="submit"
          className="mt-2 rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700"
        >
          Submit application
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  id,
  required,
  placeholder,
}: {
  label: string;
  id: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
