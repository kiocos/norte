import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

// Build only: all inputs are versioned local snapshots. No database or network.
const data = JSON.parse(await readFile("data/processed/catalog.json", "utf8"));
const sources = JSON.parse(await readFile("data/manifest.json", "utf8"));
const updatedAt = sources
  .map((s) => s.retrieved_at.slice(0, 10))
  .sort()
  .at(-1);
const families = new Map(data.families.map((f) => [f.code, f]));
const areas = new Set(data.areas.map((a) => a.id));
const codes = new Set();
const fields = [
  "code",
  "title",
  "area",
  "family",
  "aliases",
  "riasec",
  "remote",
  "salary",
  "salaryLow",
  "salaryHigh",
  "sample",
  "employment",
  "kind",
  "sourceUrl",
  "workModes",
  "preparation",
];
const occupations = [...data.occupations].sort(
  (a, b) =>
    a.title.localeCompare(b.title, "pt-BR") || a.code.localeCompare(b.code),
);
const summaries = occupations.map((o) => {
  if (
    !/^(\d{6}|mei-[a-z0-9-]+|path-[a-z0-9-]+)$/.test(o.code) ||
    codes.has(o.code)
  )
    throw new Error(`Invalid or duplicate occupation code: ${o.code}`);
  if (!areas.has(o.area) || (o.family && !families.has(o.family)))
    throw new Error(`Missing area or family for ${o.code}`);
  codes.add(o.code);
  const result = Object.fromEntries(fields.map((field) => [field, o[field]]));
  if (fields.some((field) => result[field] === undefined))
    throw new Error(`Incomplete catalog entry: ${o.code}`);
  return result;
});
const catalog = JSON.stringify({
  areas: data.areas,
  occupations: summaries,
  updatedAt,
});
const details = occupations.map((o, i) => {
  const family = families.get(o.family);
  return JSON.stringify({
    ...summaries[i],
    activities: o.activities,
    remoteReason: o.remoteReason,
    description: o.description ?? null,
    familyTitle: family?.title ?? null,
    salaryMean: o.salaryMean,
    salaryStatus: o.kind === "cbo" ? o.salaryStatus : null,
    admissionSalary: o.admissionSalary,
    admissions: o.kind === "cbo" ? o.admissions : null,
    dismissals: o.kind === "cbo" ? o.dismissals : null,
    balance: o.kind === "cbo" ? o.balance : null,
    preparationSummary: family?.preparationSummary ?? null,
    preparationSource: family?.preparationSource ?? null,
    preparationSnapshot: family?.preparationSnapshot ?? null,
  });
});
const hash = createHash("sha256").update(catalog);
for (const detail of details) hash.update(detail);
const version = hash.digest("hex").slice(0, 16);
const base = `/data/${version}`;
const manifest = {
  version,
  catalog: `${base}/catalog.json`,
  details: `${base}/occupations`,
};

await rm("public/data", { recursive: true, force: true });
await mkdir(`public${manifest.details}`, { recursive: true });
await writeFile(`public${manifest.catalog}`, catalog);
// Bound file writes so exports also work on machines with low descriptor limits.
for (let i = 0; i < occupations.length; i += 100)
  await Promise.all(
    occupations
      .slice(i, i + 100)
      .map((o, j) =>
        writeFile(`public${manifest.details}/${o.code}.json`, details[i + j]),
      ),
  );
await writeFile("public/data/manifest.json", JSON.stringify(manifest));
await writeFile("src/lib/catalog-assets.json", JSON.stringify(manifest));
await writeFile(
  "public/health.json",
  JSON.stringify({
    status: "ok",
    storage: "static",
    total: occupations.length,
    areas: data.areas.length,
    updatedAt,
    ...manifest,
  }),
);
console.log(
  `Static export: ${occupations.length} options, ${data.areas.length} areas; catalog ${gzipSync(catalog).length} bytes gzip; version ${version}.`,
);
