import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMapLayout } from "../src/lib/map-layout";
import type { Area, Occupation } from "../src/lib/types";
const data = JSON.parse(
  readFileSync("data/processed/catalog.json", "utf8"),
) as { areas: Area[]; occupations: Occupation[] };
test("all actual professions have nonoverlapping circles, without preview replacements", () => {
  const map = buildMapLayout(data.occupations, data.areas);
  const points = map.islands.flatMap((i) => i.points);
  assert.equal(points.length, 3223);
  assert.equal(new Set(points.map((p) => p.occupation.code)).size, 3223);
  for (const island of map.islands) {
    assert.equal(island.points.length, island.items.length);
    for (const p of island.points) {
      assert.equal(p.r, 60);
      assert.ok(p.x - p.r >= island.x && p.x + p.r <= island.x + island.w);
      assert.ok(p.y - p.r >= island.y && p.y + p.r <= island.y + island.h);
    }
    for (let i = 0; i < island.points.length; i++)
      for (let j = i + 1; j < island.points.length; j++) {
        const a = island.points[i],
          b = island.points[j];
        assert.ok(
          Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r + 39,
          `${a.occupation.code}/${b.occupation.code}`,
        );
      }
  }
  for (let i = 0; i < map.islands.length; i++)
    for (let j = i + 1; j < map.islands.length; j++) {
      const a = map.islands[i],
        b = map.islands[j];
      assert.ok(
        a.x + a.w <= b.x ||
          b.x + b.w <= a.x ||
          a.y + a.h <= b.y ||
          b.y + b.h <= a.y,
        `${a.area.id}/${b.area.id}`,
      );
    }
});
test("related fields stay neighbors; filtering preserves only matching circles and fits bounds", () => {
  const map = buildMapLayout(data.occupations, data.areas);
  const distance = (a: string, b: string) => {
    const aa = map.islands.find((i) => i.area.id === a)!,
      bb = map.islands.find((i) => i.area.id === b)!;
    return Math.hypot(
      aa.x + aa.w / 2 - bb.x - bb.w / 2,
      aa.y + aa.h / 2 - bb.y - bb.h / 2,
    );
  };
  assert.ok(distance("educacao", "saude") < distance("educacao", "industria"));
  assert.ok(
    distance("tecnologia", "ciencia") < distance("tecnologia", "seguranca"),
  );
  const subset = data.occupations.filter((o) => o.area === "tecnologia");
  const filtered = buildMapLayout(subset, data.areas);
  assert.equal(filtered.islands.length, 1);
  assert.equal(filtered.islands[0].points.length, subset.length);
  assert.ok(filtered.islands[0].x < 30 && filtered.islands[0].y < 30);
  assert.ok(Number.isFinite(buildMapLayout([], data.areas).w));
});
