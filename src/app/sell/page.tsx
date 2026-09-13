"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSellerAccount } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";

export default function SellPage() {
  const router = useRouter();
  const { t } = useLocale();
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
        <h1 className="text-xl font-bold mb-2">{t.sell.almostThere}</h1>
        <p className="text-neutral-600 text-sm">
          {t.sell.checkEmailPrefix} {email} {t.sell.checkEmailSuffix}{" "}
          <Link href="/login" className="text-amber-600 hover:underline">
            {t.sell.logIn}
          </Link>{" "}
          {t.sell.toReachDashboard}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">{t.sell.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.sell.subtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          label={t.sell.fullName}
          id="name"
          required
          value={fullName}
          onChange={setFullName}
        />
        <Field
          label={t.sell.shopName}
          id="shopName"
          required
          placeholder={t.sell.shopNamePlaceholder}
          value={shopName}
          onChange={setShopName}
        />
        <Field
          label={t.sell.email}
          id="email"
          type="email"
          required
          value={email}
          onChange={setEmail}
        />
        <Field
          label={t.sell.password}
          id="password"
          type="password"
          required
          value={password}
          onChange={setPassword}
        />
        <Field
          label={t.sell.whatsapp}
          id="whatsapp"
          required
          placeholder={t.sell.whatsappPlaceholder}
          value={whatsapp}
          onChange={setWhatsapp}
        />
        <Field
          label={t.sell.city}
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
          {submitting ? t.sell.creating : t.sell.submit}
        </button>

        <p className="text-xs text-neutral-500 text-center">
          {t.sell.alreadyHaveShop}{" "}
          <Link href="/login" className="text-amber-600 hover:underline">
            {t.sell.logIn}
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
