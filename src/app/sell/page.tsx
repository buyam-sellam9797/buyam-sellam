"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSellerAccount } from "@/lib/supabase";

export default function SellPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("Douala");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createSellerAccount({
        fullName,
        email,
        password,
        shopName,
        whatsappNumber: whatsapp,
        city,
      });
      if (result.hasSession) {
        router.push("/dashboard");
      } else {
        setNeedsEmailConfirm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (needsEmailConfirm) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">Almost there ✓</h1>
        <p className="text-neutral-600 text-sm">
          Your shop was created. Check {email} for a confirmation link, then{" "}
          <Link href="/login" className="text-amber-600 hover:underline">
            log in
          </Link>{" "}
          to reach your dashboard.
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
        <Field
          label="Your full name"
          id="name"
          required
          value={fullName}
          onChange={setFullName}
        />
        <Field
          label="Shop name"
          id="shopName"
          required
          placeholder="e.g. Mama Clara Fashion"
          value={shopName}
          onChange={setShopName}
        />
        <Field
          label="Email"
          id="email"
          type="email"
          required
          value={email}
          onChange={setEmail}
        />
        <Field
          label="Password"
          id="password"
          type="password"
          required
          value={password}
          onChange={setPassword}
        />
        <Field
          label="WhatsApp number"
          id="whatsapp"
          required
          placeholder="+237 6XX XXX XXX"
          value={whatsapp}
          onChange={setWhatsapp}
        />
        <Field
          label="City"
          id="city"
          required
          value={city}
          onChange={setCity}
        />

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
        >
          {submitting ? "Creating your shop…" : "Open my shop"}
        </button>

        <p className="text-xs text-neutral-500 text-center">
          Already have a shop?{" "}
          <Link href="/login" className="text-amber-600 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  id,
  required,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  id: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
