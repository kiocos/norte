"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMapLayout, MapPoint as Point, MapIsland } from "@/lib/map-layout";
import { Plus, Minus, Maximize, MousePointer2 } from "lucide-react";
import { Area, Occupation } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

type View = { x: number; y: number; k: number };
const NAME_FONT_SIZE = 12;
const NAME_FADE_START = 0.095;
const NAME_FADE_RANGE = 0.055;
function smoothProgress(value: number) {
  const progress = Math.max(0, Math.min(1, value));
  return progress * progress * (3 - 2 * progress);
}
function nameOpacity(scale: number) {
  return smoothProgress((scale - NAME_FADE_START) / NAME_FADE_RANGE);
}
function titleLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (ctx.measureText(line + " " + word).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[,; ]+$/, "") + "…";
  }
  return lines.map((line) => {
    if (ctx.measureText(line).width <= maxWidth) return line;
    while (line.length > 1 && ctx.measureText(line + "…").width > maxWidth)
      line = line.slice(0, -1);
    return line + "…";
  });
}

export default function MapCanvas({
  occupations,
  areas,
  onSelect,
  selected,
  saved,
  hasComparison,
}: {
  occupations: Occupation[];
  areas: Area[];
  onSelect: (o: Occupation) => void;
  selected: string | null;
  saved: string[];
  hasComparison: boolean;
}) {
  const { theme } = useTheme();
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 640 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [hintDismissed, setHintDismissed] = useState(false);
  const hasZoomedIn = useRef(false);
  const [hover, setHover] = useState<{
    o: Occupation;
    x: number;
    y: number;
  } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    moved: boolean;
    areaId?: string;
  } | null>(null);
  const animation = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    k: number;
    wx: number;
    wy: number;
  } | null>(null);
  const hits = useRef<Point[]>([]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const layout = useMemo(
    () => buildMapLayout(occupations, areas, size.w < 550),
    [occupations, areas, size.w],
  );
  const fit = useCallback(() => {
    const portrait = size.w < 550;
    const k =
      (portrait
        ? (size.w - 24) / layout.w
        : Math.min((size.w - 24) / layout.w, (size.h - 160) / layout.h)) * 0.97;
    return {
      x: (size.w - layout.w * k) / 2,
      y: portrait ? 116 : 90 + (size.h - 160 - layout.h * k) / 2,
      k,
    };
  }, [size, layout]);
  useEffect(() => {
    if (!wrapper.current) return;
    const obs = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    obs.observe(wrapper.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    const next = fit();
    // A portrait screen starts closer, with room to pan. The fit button remains
    // available for the entire geography, without replacing any circles.
    if (size.w < 550 && layout.islands.length > 2) {
      next.k = Math.max(next.k, Math.min(0.8, (size.h - 200) / layout.h));
      next.x = (size.w - layout.w * next.k) / 2;
      next.y = 110;
    }
    setView(next);
    setHover(null);
  }, [fit, size, layout]);
  const animate = useCallback((next: View) => {
    cancelAnimationFrame(animation.current);
    const start = viewRef.current;
    const time = performance.now();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const tick = (now: number) => {
      const p = reduced ? 1 : Math.min((now - time) / 360, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setView({
        x: start.x + (next.x - start.x) * ease,
        y: start.y + (next.y - start.y) * ease,
        k: start.k + (next.k - start.k) * ease,
      });
      if (p < 1) animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(animation.current), []);
  const zoom = useCallback(
    (factor: number, px = size.w / 2, py = size.h / 2) => {
      const v = viewRef.current,
        k = Math.min(20, Math.max(fit().k * 0.65, v.k * factor));
      if (k > v.k) hasZoomedIn.current = true;
      animate({
        k,
        x: px - ((px - v.x) * k) / v.k,
        y: py - ((py - v.y) * k) / v.k,
      });
    },
    [size, fit, animate],
  );
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest(".map-controls, .map-minimap"))
        return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const v = viewRef.current;
      const k = Math.min(
        20,
        Math.max(fit().k * 0.65, v.k * Math.exp(-event.deltaY * 0.0015)),
      );
      if (k > v.k) hasZoomedIn.current = true;
      cancelAnimationFrame(animation.current);
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      setView({
        k,
        x: x - ((x - v.x) * k) / v.k,
        y: y - ((y - v.y) * k) / v.k,
      });
      setHover(null);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [fit]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = size.w * dpr;
    el.height = size.h * dpr;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.k, view.k);
    hits.current = [];
    let labelCount = 0;
    const dark = theme === "dark";
    const labelOpacity = nameOpacity(view.k);
    for (const island of layout.islands) {
      const { area } = island;
      for (const p of island.points) {
        const screenX = p.x * view.k + view.x,
          screenY = p.y * view.k + view.y;
        if (
          screenX + p.r * view.k < 0 ||
          screenX - p.r * view.k > size.w ||
          screenY + p.r * view.k < 0 ||
          screenY - p.r * view.k > size.h
        )
          continue;
        hits.current.push(p);
        const active = p.occupation.code === selected;
        const hovered = p.occupation.code === hover?.o.code;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = active
          ? area.color
          : area.color + (hovered ? (dark ? "60" : "50") : dark ? "30" : "23");
        ctx.fill();
        ctx.lineWidth = (active ? 2.5 : hovered ? 2 : 1) / view.k;
        ctx.strokeStyle =
          area.color + (active || hovered ? "ff" : dark ? "b0" : "80");
        ctx.stroke();
        if (saved.includes(p.occupation.code) && p.r * view.k > 8) {
          ctx.beginPath();
          ctx.arc(
            p.x + p.r * 0.64,
            p.y - p.r * 0.64,
            Math.min(5 / view.k, p.r * 0.24),
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = dark ? "#e5e5e5" : "#444444";
          ctx.fill();
        }
        // Keep early labels readable in small circles; truncate to the space
        // available, then reveal more of the title as the user zooms in.
        const fontSize = Math.max(NAME_FONT_SIZE, 5 / view.k);
        if (labelOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = labelOpacity;
          ctx.font = `500 ${fontSize}px Arial,sans-serif`;
          ctx.fillStyle = active ? "#161616" : dark ? "#f1f1f1" : "#303030";
          const short = p.occupation.title.replace(
            /, independente| independente/gi,
            "",
          );
          const maxLines = Math.max(
            1,
            Math.min(5, Math.floor((p.r * 1.3) / (fontSize * 1.2))),
          );
          const lines = titleLines(ctx, short, p.r * 1.52, maxLines);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          lines.forEach((line, index) =>
            ctx.fillText(
              line,
              p.x,
              p.y + (index - (lines.length - 1) / 2) * fontSize * 1.2,
            ),
          );
          ctx.restore();
          labelCount++;
        }
      }
    }
    ctx.restore();
    el.dataset.externalLabels = "0";
    el.dataset.nodeLabels = String(labelCount);
    el.dataset.visibleNodes = String(hits.current.length);
    el.dataset.theme = theme;
    if (
      !hintDismissed &&
      hasZoomedIn.current &&
      labelCount > 0 &&
      labelOpacity >= 0.98
    ) {
      setHintDismissed(true);
    }
  }, [layout, size, view, hover, selected, saved, theme, hintDismissed]);
  const zoomToArea = (island: MapIsland) => {
    const k = Math.max(
      0.85,
      Math.min((size.w - 64) / island.w, (size.h - 180) / island.h) * 0.92,
    );
    if (k > viewRef.current.k) hasZoomedIn.current = true;
    animate({
      k,
      x: size.w / 2 - (island.x + island.w / 2) * k,
      y: 90 + (size.h - 180) / 2 - (island.y + island.h / 2) * k,
    });
  };
  const hit = (x: number, y: number) => {
    const wx = (x - viewRef.current.x) / viewRef.current.k,
      wy = (y - viewRef.current.y) / viewRef.current.k;
    return hits.current.find(
      (p) => (wx - p.x) ** 2 + (wy - p.y) ** 2 <= p.r ** 2,
    );
  };
  const position = (event: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };
  return (
    <div
      className="map-surface"
      ref={wrapper}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const target = e.target as Element;
        if (target.closest(".map-controls, .map-minimap")) return;
        const areaId =
          target.closest<HTMLElement>("[data-map-area]")?.dataset.mapArea;
        cancelAnimationFrame(animation.current);
        canvas.current?.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, position(e));
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          const v = viewRef.current;
          pinch.current = {
            distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            k: v.k,
            wx: ((a.x + b.x) / 2 - v.x) / v.k,
            wy: ((a.y + b.y) / 2 - v.y) / v.k,
          };
          drag.current = null;
          return;
        }
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          vx: view.x,
          vy: view.y,
          moved: false,
          areaId,
        };
      }}
      onPointerMove={(e) => {
        const p = position(e);
        if (pointers.current.has(e.pointerId))
          pointers.current.set(e.pointerId, p);
        if (pinch.current && pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          const initial = pinch.current;
          const k = Math.min(
            20,
            Math.max(
              fit().k * 0.65,
              (initial.k * Math.hypot(a.x - b.x, a.y - b.y)) / initial.distance,
            ),
          );
          if (k > viewRef.current.k) hasZoomedIn.current = true;
          setView({
            k,
            x: (a.x + b.x) / 2 - initial.wx * k,
            y: (a.y + b.y) / 2 - initial.wy * k,
          });
          setHover(null);
          return;
        }
        const currentDrag = drag.current;
        if (currentDrag) {
          const dx = e.clientX - currentDrag.x,
            dy = e.clientY - currentDrag.y;
          if (Math.abs(dx) + Math.abs(dy) > 5) currentDrag.moved = true;
          if (currentDrag.moved) {
            const x = currentDrag.vx + dx,
              y = currentDrag.vy + dy;
            setView((v) => ({ ...v, x, y }));
            setHover(null);
          }
        } else {
          const h = hit(p.x, p.y);
          setHover(h ? { o: h.occupation, x: p.x, y: p.y } : null);
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pinch.current) {
          if (!pointers.current.size) pinch.current = null;
          drag.current = null;
          return;
        }
        const d = drag.current;
        drag.current = null;
        if (!d || d.moved) return;
        if (d.areaId) {
          const island = layout.islands.find((i) => i.area.id === d.areaId);
          if (island) zoomToArea(island);
          return;
        }
        const p = position(e),
          h = hit(p.x, p.y);
        if (h) {
          onSelect(h.occupation);
          return;
        }
        const wx = (p.x - view.x) / view.k,
          wy = (p.y - view.y) / view.k;
        const island = layout.islands.find(
          (i) => wx >= i.x && wx <= i.x + i.w && wy >= i.y && wy <= i.y + i.h,
        );
        if (island) zoomToArea(island);
      }}
      onPointerCancel={() => {
        pointers.current.clear();
        pinch.current = null;
        drag.current = null;
      }}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={(e) => {
        if ((e.target as Element).closest("button")) return;
        const r = canvas.current!.getBoundingClientRect();
        zoom(1.7, e.clientX - r.left, e.clientY - r.top);
      }}
    >
      <canvas
        ref={canvas}
        data-node-count={occupations.length}
        style={{
          width: "100%",
          height: "100%",
          cursor: drag.current ? "grabbing" : hover ? "pointer" : "grab",
        }}
        tabIndex={0}
        role="img"
        aria-label="Mapa interativo de carreiras por área. Arraste para navegar; use os botões para ampliar. A visualização em lista permite explorar todas as opções pelo teclado."
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoom(1.4);
          }
          if (e.key === "-") {
            e.preventDefault();
            zoom(1 / 1.4);
          }
          if (e.key === "0") {
            e.preventDefault();
            animate(fit());
          }
          const delta = 80;
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            setView((v) => ({
              ...v,
              x:
                v.x +
                (e.key === "ArrowLeft"
                  ? delta
                  : e.key === "ArrowRight"
                    ? -delta
                    : 0),
              y:
                v.y +
                (e.key === "ArrowUp"
                  ? delta
                  : e.key === "ArrowDown"
                    ? -delta
                    : 0),
            }));
          }
        }}
      />
      {layout.islands.map((island) => {
        const opacity = 1 - smoothProgress((view.k - 0.075) / 0.07);
        if (opacity <= 0) return null;
        const left = (island.x + island.w / 2) * view.k + view.x;
        const top = (island.y + island.h / 2) * view.k + view.y;
        const width = Math.max(110, Math.min(420, island.w * view.k * 0.92));
        if (
          left - width / 2 > size.w ||
          left + width / 2 < 0 ||
          top - 100 > size.h ||
          top + 100 < 0
        )
          return null;
        return (
          <button
            key={island.area.id}
            className="map-area-label"
            data-map-area={island.area.id}
            style={{
              left,
              top,
              width,
              opacity,
              fontSize: Math.max(16, Math.min(42, island.w * view.k * 0.135)),
              pointerEvents: opacity < 0.1 ? "none" : "auto",
            }}
            tabIndex={opacity < 0.1 ? -1 : 0}
            aria-hidden={opacity < 0.1}
            aria-label={`Aproximar área ${island.area.title}`}
            title={`${island.area.title} · ${island.items.length} opções · aproximar sem filtrar`}
            onClick={(event) => {
              if (event.detail === 0) zoomToArea(island);
            }}
          >
            <span>{island.area.title}</span>
          </button>
        );
      })}
      {!hintDismissed && !hasComparison && (
        <div className="map-instruction">
          <MousePointer2 size={13} />
          Arraste para explorar · aproxime para ler os nomes
        </div>
      )}
      <div className="map-controls">
        <button aria-label="Aumentar zoom" onClick={() => zoom(1.45)}>
          <Plus size={18} />
        </button>
        <span>{Math.round((view.k / fit().k) * 100)}%</span>
        <button aria-label="Diminuir zoom" onClick={() => zoom(1 / 1.45)}>
          <Minus size={18} />
        </button>
        <i />
        <button aria-label="Ajustar mapa à tela" onClick={() => animate(fit())}>
          <Maximize size={17} />
        </button>
      </div>
      <div className="map-minimap" aria-hidden="true">
        <svg viewBox={`0 0 ${layout.w} ${layout.h}`}>
          {layout.islands.map((i) => (
            <ellipse
              key={i.area.id}
              cx={i.x + i.w / 2}
              cy={i.y + i.h / 2}
              rx={i.w / 2}
              ry={i.h / 2}
              fill={i.area.color}
              opacity=".35"
            />
          ))}
          <rect
            x={-view.x / view.k}
            y={-view.y / view.k}
            width={size.w / view.k}
            height={size.h / view.k}
            fill="none"
            stroke={theme === "dark" ? "#dedede" : "#595959"}
            strokeWidth="16"
          />
        </svg>
      </div>
    </div>
  );
}
