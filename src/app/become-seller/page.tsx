"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, getMyShop } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";

type State = { kind: "checking" } | { kind: "loggedOut" } | { kind: "buyer" };

// The deliberate step between buying and selling. Instead of a button
// that silently turns an account into a seller, this page explains
// what selling involves (commission, payouts, delivery, verification)
// and asks the person to confirm before the shop setup starts.
export default function BecomeSellerPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setState({ kind: "loggedOut" });
        return;
      }
      const shop = await getMyShop();
      if (cancelled) return;
      if (shop) {
        router.replace("/dashboard");
        return;
      }
      setState({ kind: "buyer" });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.kind === "checking") {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-500">{t.becomeSeller.checking}</div>;
  }

  const points = [
    { title: t.becomeSeller.point1Title, body: t.becomeSeller.point1Body },
    { title: t.becomeSeller.point2Title, body: t.becomeSeller.point2Body },
    { title: t.becomeSeller.point3Title, body: t.becomeSeller.point3Body },
    { title: t.becomeSeller.point4Title, body: t.becomeSeller.point4Body },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">{t.spaces.sellerSpace}</p>
      <h1 className="text-3xl font-bold tracking-tight">{t.becomeSeller.title}</h1>
      <p className="text-neutral-600 mt-3 max-w-2xl">{t.becomeSeller.subtitle}</p>

      <Link
        href="/sell-item"
        className="mt-6 block rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 hover:border-neutral-900"
      >
        {t.sellItem.becomeSellerLink}
      </Link>

      <ol className="mt-8 grid sm:grid-cols-2 gap-4">
        {points.map((p, i) => (
          <li key={p.title} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-bold mb-3">
              {i + 1}
            </span>
            <p className="font-semibold">{p.title}</p>
            <p className="text-sm text-neutral-600 mt-1">{p.body}</p>
          </li>
        ))}
      </ol>

      {state.kind === "buyer" ? (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="text-sm text-neutral-700">{t.becomeSeller.keepBuying}</p>
          <label className="mt-5 flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-neutral-900"
            />
            <span>
              {t.becomeSeller.agree}{" "}
              <Link href="/terms" target="_blank" className="font-semibold underline underline-offset-2">
                {t.becomeSeller.terms}
              </Link>
              .
            </span>
          </label>
          <button
            type="button"
            disabled={!agreed}
            onClick={() => router.push("/sell?confirmed=1")}
            className="mt-5 w-full sm:w-auto rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.becomeSeller.continue}
          </button>
          <Link href="/account" className="block sm:inline sm:ml-4 mt-3 text-sm text-neutral-600 hover:text-neutral-900">
            {t.becomeSeller.notNow}
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="font-semibold">{t.becomeSeller.loggedOutTitle}</p>
          <p className="text-sm text-neutral-600 mt-1">{t.becomeSeller.loggedOutBody}</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup?role=seller"
              className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 text-center"
            >
              {t.becomeSeller.createSellerAccount}
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-neutral-300 font-semibold px-6 py-3 hover:border-neutral-900 text-center"
            >
              {t.becomeSeller.haveAccount}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
