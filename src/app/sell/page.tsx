"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  supabase,
  createSellerAccount,
  getMyShop,
  getShopProducts,
  getCategories,
  updateShop,
  uploadShopLogo,
  requestShopVerification,
  type Shop,
  type Category,
} from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";
import { ProductForm } from "@/components/product-form";

const TOTAL_STEPS = 9;

// Which step to resume at for a seller who already has a shop (either
// returning mid-wizard after a refresh/dropped connection, or coming
// back to /sell later) — derived from what's actually filled in rather
// than a separately-tracked "progress" field, so there's nothing to
// get out of sync.
function resumeStepFor(shop: Shop, hasProducts: boolean): number {
  if (!shop.logo_url) return 4;
  if (!shop.description) return 5;
  if (!shop.delivery_info && shop.delivery_fee_fcfa == null && !shop.delivery_eta_text) return 6;
  if (!hasProducts) return 7;
  if (!shop.is_verified && !shop.verification_requested_at) return 8;
  return 9;
}

type Stage =
  | { kind: "checking" }
  | { kind: "step1" }
  | { kind: "step2" }
  | { kind: "needsEmailConfirm"; email: string }
  | { kind: "wizard"; step: number; shop: Shop; hasProducts: boolean };

export default function SellPage() {
  const { t, locale } = useLocale();
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const [categories, setCategories] = useState<Category[]>([]);

  // Step 1 — account
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Step 2 — shop
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("Douala");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setStage({ kind: "step1" });
        return;
      }
      const shop = await getMyShop();
      if (cancelled) return;
      if (!shop) {
        setStage({ kind: "step1" });
        return;
      }
      const products = await getShopProducts(shop.id);
      if (cancelled) return;
      const hasProducts = products.length > 0;
      setStage({ kind: "wizard", step: resumeStepFor(shop, hasProducts), shop, hasProducts });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
    });
  }, []);

  function goToStep(step: number) {
    setStage((s) => (s.kind === "wizard" ? { ...s, step } : s));
  }

  function updateShopInStage(patch: Partial<Shop>) {
    setStage((s) => (s.kind === "wizard" ? { ...s, shop: { ...s.shop, ...patch } } : s));
  }

  async function handleCreateShop(e: React.FormEvent) {
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
        locale,
      });
      if (!result.hasSession) {
        setStage({ kind: "needsEmailConfirm", email });
        return;
      }
      const shop = await getMyShop();
      if (!shop) {
        setError("Your shop was created, but we couldn't load it — try refreshing.");
        return;
      }
      setStage({ kind: "wizard", step: 3, shop, hasProducts: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage.kind === "checking") {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-neutral-500">{t.sell.checkingProgress}</div>;
  }

  if (stage.kind === "needsEmailConfirm") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">{t.sell.almostThere}</h1>
        <p className="text-neutral-600 text-sm">
          {t.sell.checkEmailPrefix} {stage.email} {t.sell.checkEmailSuffix}{" "}
          <Link href="/login" className="text-amber-600 hover:underline">
            {t.sell.logIn}
          </Link>{" "}
          {t.sell.toReachDashboard}
        </p>
      </div>
    );
  }

  if (stage.kind === "step1") {
    return (
      <WizardShell step={1} title={t.sell.title} subtitle={t.sell.subtitle}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStage({ kind: "step2" });
          }}
          className="flex flex-col gap-5"
        >
          <h2 className="text-lg font-semibold">{t.sell.step1Title}</h2>
          <Field label={t.sell.fullName} id="name" required value={fullName} onChange={setFullName} />
          <Field label={t.sell.email} id="email" type="email" required value={email} onChange={setEmail} />
          <Field
            label={t.sell.password}
            id="password"
            type="password"
            required
            value={password}
            onChange={setPassword}
          />
          <button
            type="submit"
            className="mt-2 rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700"
          >
            {t.sell.step1Continue}
          </button>
          <p className="text-xs text-neutral-500 text-center">
            {t.sell.alreadyHaveShop}{" "}
            <Link href="/login" className="text-amber-600 hover:underline">
              {t.sell.logIn}
            </Link>
          </p>
        </form>
      </WizardShell>
    );
  }

  if (stage.kind === "step2") {
    return (
      <WizardShell step={2} title={t.sell.title} subtitle={t.sell.subtitle}>
        <form onSubmit={handleCreateShop} className="flex flex-col gap-5">
          <h2 className="text-lg font-semibold">{t.sell.step2Title}</h2>
          <Field
            label={t.sell.shopName}
            id="shopName"
            required
            placeholder={t.sell.shopNamePlaceholder}
            value={shopName}
            onChange={setShopName}
          />
          <Field
            label={t.sell.whatsapp}
            id="whatsapp"
            required
            placeholder={t.sell.whatsappPlaceholder}
            value={whatsapp}
            onChange={setWhatsapp}
          />
          <Field label={t.sell.city} id="city" required value={city} onChange={setCity} />
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
            {submitting ? t.sell.creating : t.sell.step2Submit}
          </button>
        </form>
      </WizardShell>
    );
  }

  // stage.kind === "wizard" from here on
  const { step, shop, hasProducts } = stage;

  return (
    <WizardShell step={step} title={shop.shop_name} subtitle={t.sell.subtitle}>
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <h2 className="text-lg font-semibold">{t.sell.step3Title}</h2>
          <p className="text-sm text-neutral-600">{t.sell.step3Body}</p>
          <WhatsAppConfirmField
            shop={shop}
            onSaved={(number) => {
              updateShopInStage({ whatsapp_number: number });
              goToStep(4);
            }}
          />
        </div>
      )}

      {step === 4 && (
        <LogoStep
          shop={shop}
          t={t}
          onSaved={(logoUrl) => {
            updateShopInStage({ logo_url: logoUrl });
            goToStep(5);
          }}
          onSkip={() => goToStep(5)}
        />
      )}

      {step === 5 && (
        <DescriptionStep
          shop={shop}
          t={t}
          onSaved={(description) => {
            updateShopInStage({ description });
            goToStep(6);
          }}
          onSkip={() => goToStep(6)}
        />
      )}

      {step === 6 && (
        <DeliveryStep
          shop={shop}
          t={t}
          onSaved={(patch) => {
            updateShopInStage(patch);
            goToStep(7);
          }}
          onSkip={() => goToStep(7)}
        />
      )}

      {step === 7 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t.sell.step7Title}</h2>
          <p className="text-sm text-neutral-600">{t.sell.step7Body}</p>
          <ProductForm
            shopId={shop.id}
            categories={categories}
            t={t}
            onDone={() => {
              setStage({ kind: "wizard", step: 8, shop, hasProducts: true });
            }}
            onCancel={() => goToStep(8)}
            cancelLabel={t.sell.skipForNow}
          />
        </div>
      )}

      {step === 8 && (
        <VerificationStep
          shop={shop}
          hasProducts={hasProducts}
          t={t}
          onRequested={() => {
            updateShopInStage({ verification_requested_at: new Date().toISOString() });
            goToStep(9);
          }}
          onSkip={() => goToStep(9)}
        />
      )}

      {step === 9 && (
        <div className="flex flex-col gap-5 text-center py-6">
          <h2 className="text-xl font-bold">{t.sell.step9Title}</h2>
          <p className="text-sm text-neutral-600">{t.sell.step9Body}</p>
          <div className="flex flex-col gap-3 mt-2">
            <Link
              href={`/shop/${shop.slug}`}
              className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700"
            >
              {t.sell.viewMyShop}
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-neutral-300 px-6 py-3 font-semibold hover:border-neutral-900"
            >
              {t.sell.goToDashboard}
            </Link>
          </div>
        </div>
      )}
    </WizardShell>
  );
}

function WizardShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold text-amber-600 mb-1">
        {t.sell.stepLabel} {step} {t.sell.ofLabel} {TOTAL_STEPS}
      </p>
      <div className="h-1.5 w-full rounded-full bg-neutral-100 mb-6 overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${Math.min(100, (step / TOTAL_STEPS) * 100)}%` }}
        />
      </div>
      {step <= 2 && (
        <>
          <h1 className="text-2xl font-bold mb-1">{title}</h1>
          <p className="text-neutral-500 text-sm mb-8">{subtitle}</p>
        </>
      )}
      {children}
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

function WhatsAppConfirmField({
  shop,
  onSaved,
}: {
  shop: Shop;
  onSaved: (number: string) => void;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(shop.whatsapp_number ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      if (value !== shop.whatsapp_number) {
        await updateShop(shop.id, { whatsappNumber: value });
      }
      onSaved(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your number.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        onClick={handleConfirm}
        disabled={saving || !value.trim()}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60 self-start"
      >
        {t.sell.step3Confirm}
      </button>
    </div>
  );
}

function LogoStep({
  shop,
  t,
  onSaved,
  onSkip,
}: {
  shop: Shop;
  t: ReturnType<typeof useLocale>["t"];
  onSaved: (logoUrl: string) => void;
  onSkip: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!file) {
      onSkip();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = await uploadShopLogo(file, shop.id);
      await updateShop(shop.id, { logoUrl: url });
      onSaved(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload your logo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.sell.step4Title}</h2>
      <p className="text-sm text-neutral-600">{t.sell.step4Body}</p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
        >
          {saving ? t.dashboard.saving : t.sell.step4Save}
        </button>
        <button
          onClick={onSkip}
          className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold hover:border-neutral-900"
        >
          {t.sell.skipForNow}
        </button>
      </div>
    </div>
  );
}

function DescriptionStep({
  shop,
  t,
  onSaved,
  onSkip,
}: {
  shop: Shop;
  t: ReturnType<typeof useLocale>["t"];
  onSaved: (description: string) => void;
  onSkip: () => void;
}) {
  const [description, setDescription] = useState(shop.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!description.trim()) {
      onSkip();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateShop(shop.id, { description });
      onSaved(description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your description.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.sell.step5Title}</h2>
      <p className="text-sm text-neutral-600">{t.sell.step5Body}</p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t.dashboard.shopDescriptionPlaceholder}
        rows={3}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
        >
          {saving ? t.dashboard.saving : t.sell.step5Save}
        </button>
        <button
          onClick={onSkip}
          className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold hover:border-neutral-900"
        >
          {t.sell.skipForNow}
        </button>
      </div>
    </div>
  );
}

function DeliveryStep({
  shop,
  t,
  onSaved,
  onSkip,
}: {
  shop: Shop;
  t: ReturnType<typeof useLocale>["t"];
  onSaved: (patch: Partial<Shop>) => void;
  onSkip: () => void;
}) {
  const [deliveryInfo, setDeliveryInfo] = useState(shop.delivery_info ?? "");
  const [deliveryFee, setDeliveryFee] = useState(
    shop.delivery_fee_fcfa != null ? String(shop.delivery_fee_fcfa) : ""
  );
  const [deliveryEta, setDeliveryEta] = useState(shop.delivery_eta_text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!deliveryInfo.trim() && !deliveryFee.trim() && !deliveryEta.trim()) {
      onSkip();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const deliveryFeeFcfa = deliveryFee.trim() ? Number(deliveryFee) : null;
      await updateShop(shop.id, { deliveryInfo, deliveryFeeFcfa, deliveryEtaText: deliveryEta });
      onSaved({
        delivery_info: deliveryInfo || null,
        delivery_fee_fcfa: deliveryFeeFcfa,
        delivery_eta_text: deliveryEta || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your delivery details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.sell.step6Title}</h2>
      <p className="text-sm text-neutral-600">{t.sell.step6Body}</p>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryInfoLabel}</label>
        <textarea
          value={deliveryInfo}
          onChange={(e) => setDeliveryInfo(e.target.value)}
          placeholder={t.dashboard.shopDeliveryInfoPlaceholder}
          rows={2}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryFeeLabel}</label>
          <input
            type="number"
            min={0}
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder={t.dashboard.shopDeliveryFeePlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryEtaLabel}</label>
          <input
            value={deliveryEta}
            onChange={(e) => setDeliveryEta(e.target.value)}
            placeholder={t.dashboard.shopDeliveryEtaPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
        >
          {saving ? t.dashboard.saving : t.sell.step6Save}
        </button>
        <button
          onClick={onSkip}
          className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold hover:border-neutral-900"
        >
          {t.sell.skipForNow}
        </button>
      </div>
    </div>
  );
}

function VerificationStep({
  shop,
  hasProducts,
  t,
  onRequested,
  onSkip,
}: {
  shop: Shop;
  hasProducts: boolean;
  t: ReturnType<typeof useLocale>["t"];
  onRequested: () => void;
  onSkip: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checklist = [
    { label: t.sell.step8ChecklistLogo, done: Boolean(shop.logo_url) },
    { label: t.sell.step8ChecklistDescription, done: Boolean(shop.description) },
    {
      label: t.sell.step8ChecklistDelivery,
      done: Boolean(shop.delivery_info || shop.delivery_fee_fcfa != null || shop.delivery_eta_text),
    },
    { label: t.sell.step8ChecklistProduct, done: hasProducts },
  ];

  async function handleRequest() {
    setSubmitting(true);
    setError(null);
    try {
      await requestShopVerification(shop.id);
      onRequested();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.sell.step8Title}</h2>
      <p className="text-sm text-neutral-600">{t.sell.step8Body}</p>
      <ul className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 text-sm">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center gap-2 px-4 py-2.5">
            <span>{item.done ? "✅" : "⬜"}</span>
            {item.label}
          </li>
        ))}
      </ul>
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={handleRequest}
          disabled={submitting}
          className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
        >
          {submitting ? t.dashboard.saving : t.sell.step8RequestBtn}
        </button>
        <button
          onClick={onSkip}
          className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold hover:border-neutral-900"
        >
          {t.sell.step8SkipToLive}
        </button>
      </div>
    </div>
  );
}
