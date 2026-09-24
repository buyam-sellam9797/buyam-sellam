// Item condition grades, from "brand new" (shop stock) down to "well
// used". Finer grades than the old new / like new / used trio mean
// fewer "it didn't look like the photos" disputes on second-hand items:
// each grade comes with a one-line definition the seller sees when
// picking it and the buyer sees on the product page.

export const CONDITIONS = [
  "new",
  "new_with_tags",
  "like_new",
  "very_good",
  "good",
  "fair",
  "well_used",
] as const;

export type Condition = (typeof CONDITIONS)[number];

// "used" is the old catch-all grade; any row still carrying it reads as "good".
export function normalizeCondition(value: string | null | undefined): Condition {
  if (value === "used") return "good";
  return (CONDITIONS as readonly string[]).includes(value ?? "") ? (value as Condition) : "new";
}

export function isSecondHand(condition: string | null | undefined): boolean {
  const c = normalizeCondition(condition);
  return c !== "new" && c !== "new_with_tags";
}

// Position on the 5-step condition meter shown on the product page
// (5 = perfect). "new" and "new_with_tags" both sit at the top.
export function conditionLevel(condition: string | null | undefined): number {
  switch (normalizeCondition(condition)) {
    case "new":
    case "new_with_tags":
      return 5;
    case "like_new":
      return 4;
    case "very_good":
      return 3;
    case "good":
      return 2;
    default:
      return 1;
  }
}

export const OWNED_FOR = ["lt_1m", "1_6m", "6_12m", "1_2y", "gt_2y"] as const;
export type OwnedFor = (typeof OWNED_FOR)[number];

export function isOwnedFor(value: unknown): value is OwnedFor {
  return typeof value === "string" && (OWNED_FOR as readonly string[]).includes(value);
}
