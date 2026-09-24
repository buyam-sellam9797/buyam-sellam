"use client";

import { CONDITIONS, OWNED_FOR, isSecondHand, normalizeCondition, type Condition } from "@/lib/conditions";
import type { Dictionary } from "@/lib/i18n";

// Condition grade chooser for sellers: every grade shows its plain
// definition right under its name, so "Very good" means the same thing
// to every seller (and to the buyer reading it on the product page).
// Second-hand grades also ask how long the seller owned the item.
export function ConditionPicker({
  value,
  onChange,
  ownedFor,
  onOwnedForChange,
  t,
  showShopStock = true,
}: {
  value: string;
  onChange: (value: Condition) => void;
  ownedFor: string;
  onOwnedForChange: (value: string) => void;
  t: Dictionary;
  // "Brand new" (shop stock) makes little sense for a personal seller.
  showShopStock?: boolean;
}) {
  const current = normalizeCondition(value);
  const grades = CONDITIONS.filter((c) => showShopStock || c !== "new");
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-1">{t.conditions.label}</legend>
      <p className="text-xs text-neutral-500 mb-2">{t.conditions.pickHint}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {grades.map((c) => {
          const active = current === c;
          return (
            <label
              key={c}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 transition ${
                active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-500 bg-white"
              }`}
            >
              <input
                type="radio"
                name="condition"
                value={c}
                checked={active}
                onChange={() => onChange(c)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold">{t.conditions.grades[c]}</span>
              <span className={`block text-xs mt-0.5 ${active ? "text-neutral-300" : "text-neutral-500"}`}>{t.conditions.hints[c]}</span>
            </label>
          );
        })}
      </div>
      {isSecondHand(current) && (
        <div className="mt-3">
          <label htmlFor="owned-for" className="text-sm font-medium block mb-1">
            {t.conditions.ownedForLabel}
          </label>
          <select
            id="owned-for"
            value={ownedFor}
            onChange={(e) => onOwnedForChange(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">{t.conditions.ownedForNone}</option>
            {OWNED_FOR.map((o) => (
              <option key={o} value={o}>
                {t.conditions.ownedFor[o]}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 mt-1">{t.conditions.ownedForOptional}</p>
        </div>
      )}
    </fieldset>
  );
}
