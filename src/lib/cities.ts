// The curated set of Cameroonian cities Buyam Sellam has a dedicated
// landing page for (see /shop-in/[city]) — a mix of the city that
// already has active shops today and the country's other major urban
// centres, so a page exists and can start ranking in search before a
// seller from that city has even signed up yet. Deliberately a fixed,
// hand-picked list rather than every town in Cameroon: a page for
// somewhere Buyam Sellam has no real activity in yet is only useful if
// it's honest about that (see generateMetadata's `noindex` for cities
// with zero listings so far, in shop-in/[city]/page.tsx) rather than a
// thin page pretending to have local inventory.
export type CityInfo = {
  slug: string;
  name: string;
  region: string;
};

export const CITIES: CityInfo[] = [
  { slug: "douala", name: "Douala", region: "Littoral" },
  { slug: "yaounde", name: "Yaoundé", region: "Centre" },
  { slug: "bafoussam", name: "Bafoussam", region: "West" },
  { slug: "bamenda", name: "Bamenda", region: "North West" },
  { slug: "buea", name: "Buea", region: "South West" },
  { slug: "limbe", name: "Limbe", region: "South West" },
  { slug: "kribi", name: "Kribi", region: "South" },
  { slug: "garoua", name: "Garoua", region: "North" },
  { slug: "maroua", name: "Maroua", region: "Far North" },
  { slug: "ngaoundere", name: "Ngaoundéré", region: "Adamawa" },
  { slug: "dschang", name: "Dschang", region: "West" },
  { slug: "ebolowa", name: "Ebolowa", region: "South" },
];

export function getCityBySlug(slug: string): CityInfo | undefined {
  return CITIES.find((c) => c.slug === slug);
}
