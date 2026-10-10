import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { Catalog, Detail, Occupation } from "../src/lib/types";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const source = json("data/processed/catalog.json");
const manifest = json("public/data/manifest.json");
const catalog: Catalog = json(`public${manifest.catalog}`);

test("static catalog is compact and preserves every option, filter value and alias", () => {
  assert.equal(catalog.occupations.length, source.occupations.length);
  assert.deepEqual(catalog.areas, source.areas);
  assert.equal(new Set(catalog.occupations.map((o) => o.code)).size, 3223);
  assert.ok(
    gzipSync(readFileSync(`public${manifest.catalog}`)).length < 300_000,
  );
  const originals = new Map<string, Occupation>(
    source.occupations.map((o: Occupation) => [o.code, o]),
  );
  for (const o of catalog.occupations) {
    const original = originals.get(o.code)!;
    for (const field of Object.keys(o) as (keyof Occupation)[])
      assert.deepEqual(o[field], original[field], `${o.code}: ${field}`);
    assert.equal("activities" in o, false);
    assert.equal("description" in o, false);
  }
});

test("every option has a separate detail file with tasks, salary and family provenance intact", () => {
  assert.equal(
    readdirSync(`public${manifest.details}`).length,
    source.occupations.length,
  );
  const families = new Map<string, Record<string, unknown>>(
    source.families.map((f: { code: string }) => [f.code, f]),
  );
  for (const original of source.occupations) {
    const detail: Detail = json(
      `public${manifest.details}/${original.code}.json`,
    );
    assert.equal(detail.code, original.code);
    assert.deepEqual(detail.activities, original.activities);
    assert.equal(detail.salary, original.salary);
    assert.equal(detail.salaryMean, original.salaryMean);
    assert.equal(detail.description, original.description ?? null);
    const family = families.get(original.family);
    assert.equal(detail.familyTitle, family?.title ?? null);
    for (const field of [
      "preparationSummary",
      "preparationSource",
      "preparationSnapshot",
    ] as const)
      assert.equal(detail[field], family?.[field] ?? null);
    if (original.kind !== "cbo") assert.equal(detail.salary, null);
  }
});
