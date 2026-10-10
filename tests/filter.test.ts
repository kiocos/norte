import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterCatalog, matches } from "../src/lib/filter";
import { INITIAL_FILTERS, Occupation } from "../src/lib/types";
const data = JSON.parse(
  readFileSync("data/processed/catalog.json", "utf8"),
) as { occupations: Occupation[] };
test("catalog has all CBO records, official MEI entries and distinct curated pathways", () => {
  const o = data.occupations;
  assert.equal(o.filter((x) => x.kind === "cbo").length, 2694);
  assert.equal(o.filter((x) => x.kind === "mei").length, 471);
  assert.ok(o.filter((x) => x.kind === "caminho").length >= 50);
  assert.equal(new Set(o.map((x) => x.code)).size, o.length);
  assert.ok(o.some((x) => x.code === "010105"));
  assert.ok(o.filter((x) => x.kind !== "cbo").every((x) => x.salary === null));
});
test("search ignores accents and includes aliases, code and modern pathways", () => {
  for (const [query, code] of [
    ["psicologo", "251510"],
    ["youtuber", "path-youtube"],
    ["indie hacker", "path-micro-saas"],
    ["010105", "010105"],
  ])
    assert.ok(
      filterCatalog(data.occupations, { ...INITIAL_FILTERS, query }).some(
        (o) => o.code === code,
      ),
      query,
    );
});
test("salary is an inclusive interval; missing values are never treated as zero", () => {
  const result = filterCatalog(data.occupations, {
    ...INITIAL_FILTERS,
    salaryMin: 5000,
    salaryMax: 8000,
    includeUnknown: false,
  });
  assert.ok(result.length > 0);
  assert.ok(
    result.every(
      (x) => x.salary !== null && x.salary >= 5000 && x.salary <= 8000,
    ),
  );
  assert.equal(
    matches(
      { ...data.occupations[0], salary: null },
      { ...INITIAL_FILTERS, salaryMin: 1, includeUnknown: false },
    ),
    false,
  );
  assert.equal(
    matches(
      { ...data.occupations[0], salary: 5000 },
      {
        ...INITIAL_FILTERS,
        salaryMin: 5000,
        salaryMax: 5000,
        includeUnknown: false,
      },
    ),
    true,
  );
});
test("different dimensions intersect; categories within a dimension form a union", () => {
  const f = {
    ...INITIAL_FILTERS,
    areas: ["tecnologia", "saude"],
    remote: "alto",
    interests: ["I", "S"] as ("I" | "S")[],
    salaryMin: 2000,
    salaryMax: 10000,
    includeUnknown: false,
  };
  const result = filterCatalog(data.occupations, f);
  assert.ok(result.length > 0);
  assert.ok(
    result.every(
      (x) =>
        f.areas.includes(x.area) &&
        x.remote === "alto" &&
        (x.riasec.I >= 4 || x.riasec.S >= 4) &&
        x.salary! >= 2000 &&
        x.salary! <= 10000,
    ),
  );
});
test("salary quantiles and minimum sample are respected; unknown values stay unknown", () => {
  for (const o of data.occupations) {
    if (o.salary !== null) {
      assert.ok(o.sample >= 30, o.code);
      assert.ok(o.salaryLow! <= o.salary && o.salary <= o.salaryHigh!, o.code);
    }
  }
});
test("saved filter limits results to browser-saved IDs", () => {
  const result = filterCatalog(
    data.occupations,
    { ...INITIAL_FILTERS, savedOnly: true },
    ["path-saas"],
  );
  assert.deepEqual(
    result.map((x) => x.code),
    ["path-saas"],
  );
});
test("social interest, salary and preparation intersect without including missing training", () => {
  const result = filterCatalog(data.occupations, {
    ...INITIAL_FILTERS,
    interests: ["S"],
    salaryMin: 3000,
    salaryMax: 7000,
    includeUnknown: false,
    preparation: ["fundamental", "medio", "tecnica"],
  });
  assert.ok(result.length > 0);
  assert.ok(
    result.every(
      (o) =>
        o.riasec.S >= 4 &&
        o.salary! >= 3000 &&
        o.salary! <= 7000 &&
        ["fundamental", "medio", "tecnica"].includes(o.preparation),
    ),
  );
  assert.ok(
    data.occupations
      .filter((o) => o.kind !== "cbo")
      .every((o) => o.preparation === "nao_informada"),
  );
});
