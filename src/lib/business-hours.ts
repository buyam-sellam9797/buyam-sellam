import type { BusinessHours, BusinessHoursDay } from "@/lib/supabase";

// Shared between the seller dashboard (which edits these hours) and
// the public shop page (which needs to tell a visitor "open now" and
// show the weekly schedule) — kept in one place so the two never
// disagree about what "open" means for a given day/time.
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_ORDER)[number];

// JS's Date.getDay() is 0 = Sunday..6 = Saturday; this project's day
// keys start the week on Monday (matching how Cameroon shops usually
// state their hours: "Lun-Sam"), so the two need an explicit mapping
// rather than assuming they line up.
const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function sameSchedule(a: BusinessHoursDay, b: BusinessHoursDay): boolean {
  if (a.closed !== b.closed) return false;
  if (a.closed) return true;
  return a.open === b.open && a.close === b.close;
}

// Groups consecutive days that share the same open/close times into
// one range, the way a person would actually say it — "Mon-Sat:
// 08:00-18:00 · Sun: Closed" rather than spelling out all seven days.
export function summarizeBusinessHours(
  hours: BusinessHours,
  dayLabels: Record<string, string>,
  closedLabel: string
): string {
  const segments: string[] = [];
  let i = 0;
  while (i < DAY_ORDER.length) {
    const day = DAY_ORDER[i];
    const schedule = hours[day];
    let j = i;
    while (j + 1 < DAY_ORDER.length && sameSchedule(hours[DAY_ORDER[j + 1]], schedule)) {
      j++;
    }
    const rangeLabel =
      i === j ? dayLabels[day] : `${dayLabels[day]}-${dayLabels[DAY_ORDER[j]]}`;
    const text = schedule.closed ? closedLabel : `${schedule.open}-${schedule.close}`;
    segments.push(`${rangeLabel}: ${text}`);
    i = j + 1;
  }
  return segments.join(" · ");
}

// A shop's manual "closed for vacation" toggle always wins — hours
// only decide the answer when the seller has left the shop switched
// on. Without that manual toggle a shop with hours configured but no
// one having flipped it off would otherwise show "open" 24/7, which is
// exactly the confusing state hours were added to prevent.
export function isOpenNow(isOpenToggle: boolean, hours: BusinessHours | null, now: Date = new Date()): boolean {
  if (!isOpenToggle) return false;
  if (!hours) return true;
  const dayKey = JS_DAY_TO_KEY[now.getDay()];
  const today = hours[dayKey];
  if (today.closed || !today.open || !today.close) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = today.open.split(":").map(Number);
  const [closeH, closeM] = today.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return minutesNow >= openMinutes && minutesNow < closeMinutes;
}
