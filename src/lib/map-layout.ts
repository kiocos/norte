import { packSiblings, packEnclose } from "d3-hierarchy";
import type { Area, Occupation } from "./types";

export type MapPoint = {
  x: number;
  y: number;
  r: number;
  occupation: Occupation;
};
export type MapIsland = {
  area: Area;
  x: number;
  y: number;
  w: number;
  h: number;
  items: Occupation[];
  points: MapPoint[];
};

// Editorial geography of related activities, not a measured distance or ranking.
// Education/care, research/technology and construction/production are neighbors.
const ANCHORS: Record<string, [number, number]> = {
  criatividade: [-1.5, -1.6],
  educacao: [-1.5, -0.3],
  saude: [-1.5, 1],
  juridico: [-2.8, -0.3],
  seguranca: [-2.8, 1.2],
  servicos: [-1.1, 2.4],
  negocios: [-0.15, -0.5],
  comercio: [-0.1, 1],
  ciencia: [0.05, -1.9],
  tecnologia: [1.4, -1.9],
  engenharia: [1.5, -0.3],
  natureza: [0.7, 2.4],
  industria: [3.1, 1.4],
  logistica: [2.3, 3.2],
};

export function buildMapLayout(
  occupations: Occupation[],
  areas: Area[],
  portrait = false,
) {
  const density = Math.max(0.15, Math.sqrt(occupations.length / 3223));
  const anchorX = 2200 * density * (portrait ? 0.32 : 1);
  const anchorY = 1000 * density * (portrait ? 1.5 : 1);
  const groups = areas
    .map((area) => {
      const items = occupations
        .filter((o) => o.area === area.id)
        .sort(
          (a, b) =>
            (a.family || a.code).localeCompare(b.family || b.code) ||
            a.title.localeCompare(b.title, "pt-BR"),
        );
      if (!items.length) return null;
      const nodes = packSiblings(
        items.map((occupation) => ({ x: 0, y: 0, r: 80, occupation })),
      );
      const enclosure = packEnclose(nodes);
      const w = Math.max(400, enclosure.r * 2 + 100),
        h = Math.max(300, enclosure.r * 2 + 140);
      const [ax, ay] = ANCHORS[area.id] || [0, 0];
      return {
        area,
        items,
        nodes,
        enclosure,
        w,
        h,
        cx: ax * anchorX,
        cy: ay * anchorY,
        ax: ax * anchorX,
        ay: ay * anchorY,
      };
    })
    .filter((g) => g !== null);
  // Relax overlapping area rectangles while preserving the same semantic anchors
  // across filters. This runs only when data changes; zoom never changes geometry.
  const gap = 100;
  for (let step = 0; step < 240; step++) {
    if (step < 160)
      for (const g of groups) {
        g.cx += (g.ax - g.cx) * 0.012;
        g.cy += (g.ay - g.cy) * 0.012;
      }
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i],
          b = groups[j];
        const dx = b.cx - a.cx,
          dy = b.cy - a.cy;
        const ox = (a.w + b.w) / 2 + gap - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const shift = ((ox + 0.01) / 2) * (dx >= 0 ? 1 : -1);
          a.cx -= shift;
          b.cx += shift;
        } else {
          const shift = ((oy + 0.01) / 2) * (dy >= 0 ? 1 : -1);
          a.cy -= shift;
          b.cy += shift;
        }
      }
  }
  const minX =
    Math.min(
      ...groups.map((g) => g.cx - g.w / 2),
      ...(groups.length ? [] : [0]),
    ) - 24;
  const minY =
    Math.min(
      ...groups.map((g) => g.cy - g.h / 2),
      ...(groups.length ? [] : [0]),
    ) - 24;
  const islands: MapIsland[] = groups.map((g) => {
    const x = g.cx - g.w / 2 - minX,
      y = g.cy - g.h / 2 - minY;
    return {
      area: g.area,
      items: g.items,
      x,
      y,
      w: g.w,
      h: g.h,
      points: g.nodes.map((n) => ({
        occupation: n.occupation,
        r: 60,
        x: x + g.w / 2 + n.x - g.enclosure.x,
        y: y + g.h / 2 + n.y - g.enclosure.y,
      })),
    };
  });
  return {
    islands,
    w: Math.max(1, ...islands.map((g) => g.x + g.w)) + 24,
    h: Math.max(1, ...islands.map((g) => g.y + g.h)) + 24,
  };
}
