"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBuyerAccount, createSellerAccount, EMAIL_TAKEN } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";
import { isPasswordStrongEnough } from "@/lib/password";
import { CITIES } from "@/lib/cities";
import { IconBag, IconBox, IconCheckCircle } from "@/components/dash-icons";
import {
  AuthShell,
  AuthField,
  AuthSelect,
  PasswordField,
  AuthError,
  AuthSubmit,
  TrustFooter,
  UserPlusIcon,
} from "@/components/auth-card";

type Role = "buyer" | "seller";

// One sign-up entry point for everyone. People first pick whether they
// are here to buy or to sell, then get only the fields that path needs:
// buyers a short personal form, sellers a two-part professional form
// (about you + your shop). A seller who is signed in straight away is
// sent on to /sell, which picks the shop setup wizard up from the next
// unfinished step (logo, description, delivery, products...).
function SignupFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();

  const initialRole = searchParams.get("role");
  const preset: Role | null = initialRole === "buyer" || initialRole === "seller" ? initialRole : null;
  const [role, setRole] = useState<Role>(preset ?? "buyer");
  const [step, setStep] = useState<"choose" | "form" | "checkEmail">(preset ? "form" : "choose");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState(CITIES[0].name);
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityOptions = CITIES.map((c) => ({ value: c.name, label: c.name }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPasswordStrongEnough(password)) {
      setError(t.resetPassword.errorTooShort);
      return;
    }
    setSubmitting(true);
    try {
      if (role === "buyer") {
        const result = await createBuyerAccount({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          city,
          locale,
        });
        if (!result.hasSession) setStep("checkEmail");
        else router.push("/account");
      } else {
        const result = await createSellerAccount({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          shopName: shopName.trim(),
          whatsappNumber: whatsapp.trim(),
          city,
          locale,
        });
        if (!result.hasSession) setStep("checkEmail");
        else router.push("/sell");
      }
    } catch (err) {
      if (err instanceof Error && err.message === EMAIL_TAKEN) setError(EMAIL_TAKEN);
      else setError(err instanceof Error ? err.message : t.auth.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "checkEmail") {
    return (
      <AuthShell
        icon={<IconCheckCircle className="w-6 h-6" />}
        title={t.auth.checkEmailTitle}
        panelHeadline={t.auth.signupPanelHeadline}
      >
        <p className="text-sm text-neutral-600 text-center">
          {t.auth.checkEmailBody} <strong className="text-neutral-900">{email}</strong>. {t.auth.checkEmailThen}
        </p>
        <Link
          href="/login"
          className="mt-8 w-full rounded-xl bg-neutral-900 text-white font-semibold px-6 py-3.5 flex items-center justify-center hover:bg-neutral-700"
        >
          {t.auth.goToLogin}
        </Link>
      </AuthShell>
    );
  }

  if (step === "choose") {
    return (
      <AuthShell
        icon={<UserPlusIcon className="w-6 h-6" />}
        title={t.auth.signupTitle}
        subtitle={t.auth.signupSubtitle}
        panelHeadline={t.auth.signupPanelHeadline}
      >
        <div className="flex flex-col gap-3" role="radiogroup" aria-label={t.auth.signupSubtitle}>
          <RoleCard
            selected={role === "buyer"}
            onSelect={() => setRole("buyer")}
            icon={<IconBag className="w-5 h-5" />}
            title={t.auth.roleBuyerTitle}
            body={t.auth.roleBuyerBody}
          />
          <RoleCard
            selected={role === "seller"}
            onSelect={() => setRole("seller")}
            icon={<IconBox className="w-5 h-5" />}
            title={t.auth.roleSellerTitle}
            body={t.auth.roleSellerBody}
          />
        </div>
        <button
          type="button"
          onClick={() => setStep("form")}
          className="mt-6 w-full rounded-xl bg-neutral-900 text-white font-semibold px-6 py-3.5 hover:bg-neutral-700 transition"
        >
          {t.auth.continue}
        </button>
        <p className="text-sm text-neutral-500 text-center mt-6">
          {t.auth.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-neutral-900 hover:text-amber-600">
            {t.auth.logIn}
          </Link>
        </p>
        <TrustFooter />
      </AuthShell>
    );
  }

  const isSeller = role === "seller";

  return (
    <AuthShell
      icon={isSeller ? <IconBox className="w-6 h-6" /> : <IconBag className="w-6 h-6" />}
      title={isSeller ? t.auth.sellerFormTitle : t.auth.buyerFormTitle}
      subtitle={isSeller ? t.auth.roleSellerBody : t.auth.roleBuyerBody}
      panelHeadline={t.auth.signupPanelHeadline}
    >
      <button
        type="button"
        onClick={() => {
          setError(null);
          setStep("choose");
        }}
        className="text-sm text-neutral-500 hover:text-neutral-900 mb-5 inline-flex items-center gap-1"
      >
        ← {t.auth.back}
      </button>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {isSeller && <SectionLabel>{t.auth.sellerSectionYou}</SectionLabel>}
        <AuthField
          id="fullName"
          label={t.auth.fullName}
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <AuthField
          id="email"
          label={t.auth.email}
          type="email"
          required
          autoComplete="email"
          placeholder={t.auth.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {!isSeller && (
          <AuthField
            id="phone"
            label={t.auth.phone}
            type="tel"
            required
            autoComplete="tel"
            placeholder={t.auth.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
        <PasswordField
          id="password"
          label={t.auth.password}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          hint={t.auth.passwordHint}
        />

        {isSeller && (
          <>
            <SectionLabel>{t.auth.sellerSectionShop}</SectionLabel>
            <AuthField
              id="shopName"
              label={t.auth.shopName}
              required
              placeholder={t.auth.shopNamePlaceholder}
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
            />
            <AuthField
              id="whatsapp"
              label={t.auth.whatsapp}
              type="tel"
              required
              placeholder={t.auth.whatsappPlaceholder}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </>
        )}
        <AuthSelect
          id="city"
          label={t.auth.city}
          options={cityOptions}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        {error === EMAIL_TAKEN ? (
          <AuthError>
            {t.auth.errorEmailTaken}{" "}
            <Link href="/login" className="font-semibold underline underline-offset-2">
              {t.auth.errorEmailTakenLink}
            </Link>
          </AuthError>
        ) : (
          error && <AuthError>{error}</AuthError>
        )}
        <AuthSubmit disabled={submitting}>
          {submitting ? t.auth.creating : isSeller ? t.auth.createSeller : t.auth.createBuyer}
        </AuthSubmit>
        <p className="text-xs text-neutral-500 text-center">
          {t.auth.terms}{" "}
          <Link href="/terms" className="underline hover:text-neutral-900">
            {t.auth.termsLink}
          </Link>{" "}
          {t.auth.and}{" "}
          <Link href="/privacy" className="underline hover:text-neutral-900">
            {t.auth.privacyLink}
          </Link>
          .
        </p>
      </form>

      <p className="text-sm text-neutral-500 text-center mt-6">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-neutral-900 hover:text-amber-600">
          {t.auth.logIn}
        </Link>
      </p>
      <TrustFooter />
    </AuthShell>
  );
}

function RoleCard({
  selected,
  onSelect,
  icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border-2 p-4 flex gap-4 items-start transition ${
        selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
      }`}
    >
      <span
        className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${
          selected ? "bg-neutral-900 text-amber-400" : "bg-neutral-100 text-neutral-700"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-neutral-500 mt-0.5">{body}</span>
      </span>
      <span
        aria-hidden
        className={`mt-1 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
          selected ? "border-neutral-900" : "border-neutral-300"
        }`}
      >
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-neutral-900" />}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 -mb-2">{children}</p>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupFlow />
    </Suspense>
  );
}
