import { Filters, Occupation } from "./types";
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
export function matches(
  o: Occupation,
  f: Filters,
  saved: string[] = [],
): boolean {
  if (f.areas.length && !f.areas.includes(o.area)) return false;
  if (f.kinds.length && !f.kinds.includes(o.kind)) return false;
  if (f.preparation.length && !f.preparation.includes(o.preparation))
    return false;
  if (f.savedOnly && !saved.includes(o.code)) return false;
  if (f.remote && o.remote !== f.remote) return false;
  if (f.interests.length && !f.interests.some((i) => o.riasec[i] >= 4))
    return false;
  const salaryActive = f.salaryMin > 0 || f.salaryMax < 30000;
  if (o.salary == null) {
    if (!f.includeUnknown) return false;
  } else if (
    o.salary < f.salaryMin ||
    (f.salaryMax < 30000 && o.salary > f.salaryMax)
  )
    return false;
  if (salaryActive && o.kind !== "cbo" && !f.includeUnknown) return false;
  const terms = normalize(f.query).trim().split(/\s+/).filter(Boolean);
  if (terms.length) {
    const text = normalize([o.title, o.code, ...o.aliases].join(" "));
    if (!terms.every((t) => text.includes(t))) return false;
  }
  return true;
}
export function filterCatalog(
  items: Occupation[],
  f: Filters,
  saved: string[] = [],
) {
  return items.filter((o) => matches(o, f, saved));
}
