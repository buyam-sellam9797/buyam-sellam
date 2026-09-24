import type { Dictionary } from "@/lib/i18n";
import { normalizeCondition, conditionLevel, isOwnedFor } from "@/lib/conditions";

// The product page's condition card: grade name, a five-step meter,
// the grade's plain definition and, for second-hand items, how long
// the seller had it. Same definitions the seller saw when picking the
// grade, so both sides mean the same thing by "Very good".
export function ConditionMeter({
  condition,
  ownedFor,
  t,
}: {
  condition: string | null | undefined;
  ownedFor?: string | null;
  t: Dictionary;
}) {
  const grade = normalizeCondition(condition);
  const level = conditionLevel(grade);
  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-neutral-500">{t.conditions.label}: </span>
          <span className="font-semibold">{t.conditions.grades[grade]}</span>
        </p>
        <div className="flex gap-1" role="img" aria-label={t.conditions.meterAria.replace("{level}", String(level))}>
          {[1, 2, 3, 4, 5].map((step) => (
            <span
              key={step}
              className={`h-1.5 w-5 rounded-full ${step <= level ? "bg-neutral-900" : "bg-neutral-200"}`}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-neutral-500 mt-1.5">{t.conditions.hints[grade]}</p>
      {isOwnedFor(ownedFor) && (
        <p className="text-xs text-neutral-700 mt-1">
          {t.conditions.ownedForLine.replace("{period}", t.conditions.ownedFor[ownedFor].toLowerCase())}
        </p>
      )}
    </div>
  );
}
