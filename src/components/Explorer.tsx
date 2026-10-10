"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  Compass,
  GitCompareArrows,
  Globe2,
  GraduationCap,
  Heart,
  Info,
  List,
  LoaderCircle,
  Map,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import MapCanvas from "./MapCanvas";
import { ThemeToggle } from "./ThemeProvider";
import {
  Area,
  Catalog,
  Detail,
  Filters,
  INITIAL_FILTERS,
  INTERESTS,
  Interest,
  KIND_LABELS,
  money,
  number,
  Occupation,
  REMOTE_LABELS,
  PREPARATION_LABELS,
  Preparation,
} from "@/lib/types";
import { filterCatalog } from "@/lib/filter";
import catalogAssets from "@/lib/catalog-assets.json";

function useDialogFocus(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  close: () => void,
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (!root) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const targets = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,[tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!targets.length) {
        e.preventDefault();
        return;
      }
      const first = targets[0],
        last = targets[targets.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === root)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === root)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", handler);
    return () => {
      root.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, ref]);
}
function toggle<T>(items: T[], item: T) {
  return items.includes(item)
    ? items.filter((v) => v !== item)
    : [...items, item];
}
function safeStored(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((x: unknown) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function SalaryNumber({
  label,
  value,
  min,
  max,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      aria-label={label}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={500}
      value={draft}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const next = Number(raw);
        if (raw !== "" && Number.isFinite(next) && next >= min && next <= max)
          onValueChange(next);
      }}
      onBlur={() => {
        const parsed = Number(draft);
        const next = Math.max(
          min,
          Math.min(Number.isFinite(parsed) ? parsed : value, max),
        );
        setDraft(String(next));
        if (next !== value) onValueChange(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

export default function Explorer() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS),
    [view, setView] = useState<"map" | "list">("map");
  const [saved, setSaved] = useState<string[]>([]),
    [compare, setCompare] = useState<string[]>([]);
  const [selected, setSelected] = useState<Occupation | null>(null),
    [showCompare, setShowCompare] = useState(false),
    [showGuide, setShowGuide] = useState(false);
  const [showFilters, setShowFilters] = useState(false),
    [showAllAreas, setShowAllAreas] = useState(false),
    [sort, setSort] = useState("name"),
    [page, setPage] = useState(1),
    [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const [compact, setCompact] = useState(false);
  const filtersVisible = showFilters || (view === "list" && !compact);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (showFilters) filterRef.current?.focus({ preventScroll: true });
  }, [showFilters]);
  const closeFilters = () => {
    setShowFilters(false);
    filterTriggerRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch(catalogAssets.catalog, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Não foi possível conectar ao catálogo.");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    setSaved(safeStored("norte-saved"));
    setCompare(safeStored("norte-compare").slice(0, 3));
    const p = new URLSearchParams(window.location.search);
    const f = { ...INITIAL_FILTERS };
    if (p.has("q")) f.query = p.get("q")!.slice(0, 120);
    f.areas = p.get("areas")?.split(",").filter(Boolean) || [];
    f.interests = (p.get("interests")?.split(",") || []).filter(
      (s): s is Interest => "RIASEC".includes(s) && s.length === 1,
    );
    f.remote = ["alto", "parcial", "presencial", "nao_avaliado"].includes(
      p.get("remote") || "",
    )
      ? p.get("remote")!
      : "";
    f.kinds = (p.get("kinds")?.split(",") || []).filter((s) =>
      ["cbo", "mei", "caminho"].includes(s),
    );
    f.preparation = (p.get("preparation")?.split(",") || []).filter(
      (s) => s in PREPARATION_LABELS,
    );
    const min = Number(p.get("min") || 0),
      max = Number(p.get("max") || 30000);
    f.salaryMin = Number.isFinite(min) ? Math.max(0, Math.min(min, 30000)) : 0;
    f.salaryMax = Number.isFinite(max)
      ? Math.max(f.salaryMin, Math.min(max, 30000))
      : 30000;
    f.includeUnknown = p.get("unknown") !== "0";
    setFilters(f);
    setHydrated(true);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("norte-saved", JSON.stringify(saved));
  }, [saved, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("norte-compare", JSON.stringify(compare));
  }, [compare, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const p = new URLSearchParams();
    if (filters.query) p.set("q", filters.query);
    if (filters.areas.length) p.set("areas", filters.areas.join(","));
    if (filters.interests.length)
      p.set("interests", filters.interests.join(","));
    if (filters.remote) p.set("remote", filters.remote);
    if (filters.preparation.length)
      p.set("preparation", filters.preparation.join(","));
    if (filters.kinds.length) p.set("kinds", filters.kinds.join(","));
    if (filters.salaryMin) p.set("min", String(filters.salaryMin));
    if (filters.salaryMax !== 30000) p.set("max", String(filters.salaryMax));
    if (!filters.includeUnknown) p.set("unknown", "0");
    window.history.replaceState(
      null,
      "",
      `${location.pathname}${p.size ? "?" + p.toString() : ""}`,
    );
  }, [filters, hydrated]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const deferred = useDeferredValue(filters);
  const results = useMemo(
    () => (catalog ? filterCatalog(catalog.occupations, deferred, saved) : []),
    [catalog, deferred, saved],
  );
  const sorted = useMemo(
    () =>
      [...results].sort((a, b) =>
        sort === "salary"
          ? (b.salary ?? -1) - (a.salary ?? -1)
          : sort === "employment"
            ? b.employment - a.employment
            : a.title.localeCompare(b.title, "pt-BR"),
      ),
    [results, sort],
  );
  useEffect(() => setPage(1), [deferred, sort]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const save = (code: string) => {
    setSaved((s) => toggle(s, code));
  };
  const compareToggle = (code: string) => {
    if (compare.includes(code)) setCompare((c) => c.filter((x) => x !== code));
    else if (compare.length < 3) setCompare((c) => [...c, code]);
    else
      setToast(
        "Você pode comparar até 3 opções. Remova uma para adicionar outra.",
      );
  };
  const activeCount =
    filters.areas.length +
    filters.interests.length +
    filters.kinds.length +
    filters.preparation.length +
    Number(!!filters.remote) +
    Number(filters.salaryMin > 0 || filters.salaryMax < 30000) +
    Number(filters.savedOnly);
  const areaCount =
    catalog?.areas.filter((a) => results.some((o) => o.area === a.id)).length ||
    0;
  if (error)
    return (
      <main className="loading-screen">
        <h1>O catálogo está fora do ar.</h1>
        <p>{error}</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </main>
    );
  if (!catalog)
    return (
      <main className="loading-screen">
        <h1>Encontre seu norte.</h1>
        <p>
          <LoaderCircle className="spin" size={18} /> Carregando possibilidades…
        </p>
      </main>
    );
  const compared = catalog.occupations.filter((o) => compare.includes(o.code));
  return (
    <div className="app-shell">
      <a href="#explore-content" className="skip-link">
        Pular para o mapa
      </a>
      <h1 className="sr-only">Norte — mapa de carreiras do Brasil</h1>
      <div
        className={`explorer-shell ${view === "list" ? "is-list" : ""} ${showFilters ? "filters-expanded" : ""}`}
        id="explore-content"
      >
        <aside
          ref={filterRef}
          tabIndex={-1}
          id="career-filters"
          hidden={!filtersVisible}
          className={`filter-panel ${showFilters ? "is-open" : ""} ${view === "list" ? "pinned" : ""}`}
          aria-label="Filtros de carreiras"
          onKeyDown={(event) => {
            if (event.key === "Escape" && showFilters) {
              event.stopPropagation();
              closeFilters();
            }
          }}
        >
          <div className="filter-heading">
            <span>
              <SlidersHorizontal size={17} /> Seu jeito de explorar
            </span>
            <button
              className="icon-button"
              aria-label="Fechar filtros"
              onClick={closeFilters}
            >
              <X size={18} />
            </button>
          </div>
          <div className="filter-scroll">
            <div className="filter-section">
              <div className="section-label">
                ÁREAS DE INTERESSE
                <button
                  onClick={() => set("areas", [])}
                  disabled={!filters.areas.length}
                >
                  Todas
                </button>
              </div>
              <div className="area-options">
                {(showAllAreas ? catalog.areas : catalog.areas.slice(0, 6)).map(
                  (a) => (
                    <label key={a.id} className="area-check">
                      <input
                        type="checkbox"
                        checked={filters.areas.includes(a.id)}
                        onChange={() =>
                          set("areas", toggle(filters.areas, a.id))
                        }
                      />
                      <span
                        className="color-dot"
                        style={{ background: a.color }}
                      />
                      <span>{a.title}</span>
                      <small>
                        {number(
                          catalog.occupations.filter((o) => o.area === a.id)
                            .length,
                        )}
                      </small>
                    </label>
                  ),
                )}
              </div>
              <button
                className="text-button more-areas"
                onClick={() => setShowAllAreas((v) => !v)}
              >
                {showAllAreas
                  ? "Mostrar menos"
                  : `Ver todas as ${catalog.areas.length} áreas`}
                <ChevronDown
                  size={14}
                  className={showAllAreas ? "rotate" : ""}
                />
              </button>
            </div>
            <div className="filter-section">
              <div className="section-label">
                O QUE TE MOVE?
                <button
                  aria-label="Entender os interesses"
                  onClick={() => {
                    setShowFilters(false);
                    setShowGuide(true);
                  }}
                >
                  <Info size={14} />
                </button>
              </div>
              <p className="filter-help">
                Encontre opções com uma destas afinidades.
              </p>
              <div className="interest-options">
                {INTERESTS.map((i) => (
                  <button
                    key={i.id}
                    title={i.description}
                    aria-pressed={filters.interests.includes(i.id)}
                    className={
                      filters.interests.includes(i.id)
                        ? "interest-chip selected"
                        : "interest-chip"
                    }
                    onClick={() =>
                      set("interests", toggle(filters.interests, i.id))
                    }
                  >
                    <span>{i.id}</span>
                    {i.label}
                    {filters.interests.includes(i.id) && <Check size={12} />}
                  </button>
                ))}
              </div>
              <span className="subtle-note">
                Associações orientativas · modelo RIASEC
              </span>
            </div>
            <div className="filter-section">
              <div className="section-label">
                SALÁRIO MENSAL<span className="small-tag">BRUTO</span>
              </div>
              <p className="filter-help">
                Mediana dos vínculos formais · RAIS 2025
              </p>
              <div className="salary-values">
                <label>
                  <span>A partir de</span>
                  <div>
                    <small>R$</small>
                    <SalaryNumber
                      label="Salário mínimo"
                      min={0}
                      max={filters.salaryMax}
                      value={filters.salaryMin}
                      onValueChange={(value) =>
                        setFilters((f) => ({
                          ...f,
                          salaryMin: value,
                          includeUnknown: false,
                        }))
                      }
                    />
                  </div>
                </label>
                <span className="range-dash">—</span>
                <label>
                  <span>
                    Até {filters.salaryMax === 30000 ? "(sem teto)" : ""}
                  </span>
                  <div>
                    <small>R$</small>
                    <SalaryNumber
                      label="Salário máximo"
                      min={filters.salaryMin}
                      max={30000}
                      value={filters.salaryMax}
                      onValueChange={(value) =>
                        setFilters((f) => ({
                          ...f,
                          salaryMax: value,
                          includeUnknown: false,
                        }))
                      }
                    />
                  </div>
                </label>
              </div>
              <div className="dual-range">
                <div className="range-track" />
                <div
                  className="range-progress"
                  style={{
                    left: `${filters.salaryMin / 300}%`,
                    right: `${100 - filters.salaryMax / 300}%`,
                  }}
                />
                <input
                  aria-label="Ajustar salário mínimo"
                  type="range"
                  min="0"
                  max="30000"
                  step="500"
                  value={filters.salaryMin}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      salaryMin: Math.min(Number(e.target.value), f.salaryMax),
                      includeUnknown: false,
                    }))
                  }
                />
                <input
                  aria-label="Ajustar salário máximo"
                  type="range"
                  min="0"
                  max="30000"
                  step="500"
                  value={filters.salaryMax}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      salaryMax: Math.max(Number(e.target.value), f.salaryMin),
                      includeUnknown: false,
                    }))
                  }
                />
              </div>
              <div className="range-labels">
                <span>R$ 0</span>
                <span>R$ 30 mil+</span>
              </div>
              <label className="simple-check">
                <input
                  type="checkbox"
                  checked={filters.includeUnknown}
                  onChange={(e) => set("includeUnknown", e.target.checked)}
                />
                <span>Incluir opções sem dados de salário</span>
              </label>
            </div>
            <div className="filter-section">
              <div className="section-label">
                FORMAÇÃO DE REFERÊNCIA <GraduationCap size={15} />
              </div>
              <p className="filter-help">
                Quais caminhos de formação você considera?
              </p>
              {Object.entries(PREPARATION_LABELS).map(([value, label]) => (
                <label key={value} className="simple-check kind-check">
                  <input
                    type="checkbox"
                    checked={filters.preparation.includes(value)}
                    onChange={() =>
                      set("preparation", toggle(filters.preparation, value))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
              <p className="subtle-note">
                Referência histórica por família CBO. Confira requisitos atuais
                nos detalhes; formação não mede todo o esforço de entrada.
              </p>
            </div>
            <div className="filter-section">
              <div className="section-label">
                TRABALHO REMOTO
                <Globe2 size={14} />
              </div>
              <label className="select-wrap">
                <span className="sr-only">Potencial de trabalho remoto</span>
                <select
                  value={filters.remote}
                  onChange={(e) => set("remote", e.target.value)}
                >
                  <option value="">Qualquer possibilidade</option>
                  {Object.entries(REMOTE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <p className="subtle-note">
                Potencial por atividade; não é frequência de vagas.
              </p>
            </div>
            <div className="filter-section">
              <div className="section-label">TIPO DE CAMINHO</div>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <label key={k} className="simple-check kind-check">
                  <input
                    type="checkbox"
                    checked={filters.kinds.includes(k)}
                    onChange={() => set("kinds", toggle(filters.kinds, k))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="filter-note">
              <Info size={15} />
              <p>
                Seu caminho pode combinar mais de uma profissão. Explore sem
                precisar decidir agora.
              </p>
            </div>
          </div>
          <div className="filter-footer">
            <button
              onClick={() => {
                setFilters(INITIAL_FILTERS);
                setToast(
                  "Filtros limpos. Todas as possibilidades estão no mapa.",
                );
              }}
            >
              <X size={14} /> Limpar filtros{" "}
              {activeCount > 0 && <span>{activeCount}</span>}
            </button>
            <button className="primary" onClick={closeFilters}>
              Ver {number(results.length)} opções
            </button>
          </div>
        </aside>
        <main
          className={`workspace ${view === "list" ? "list-workspace" : ""}`}
        >
          <div className="workspace-toolbar">
            <div className="floating-actions">
              <button
                ref={filterTriggerRef}
                className={`filter-trigger ${activeCount ? "has-filters" : ""}`}
                aria-label={filtersVisible ? "Fechar filtros" : "Abrir filtros"}
                aria-expanded={filtersVisible}
                aria-controls="career-filters"
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal size={18} />
                <span>Filtros</span>
                {activeCount > 0 && <b>{activeCount}</b>}
              </button>
              <button
                className={`floating-action saved-trigger ${filters.savedOnly ? "selected" : ""}`}
                aria-label="Salvos"
                title="Salvos"
                aria-pressed={filters.savedOnly}
                onClick={() => {
                  setFilters({ ...INITIAL_FILTERS, savedOnly: true });
                  setShowFilters(false);
                  setView("list");
                }}
              >
                <Bookmark size={18} />
                <span>Salvos</span>
                {saved.length > 0 && <b>{saved.length}</b>}
              </button>
              <button
                className="floating-action guide-trigger"
                aria-label="Não sei por onde começar"
                title="Não sei por onde começar"
                onClick={() => {
                  setShowFilters(false);
                  setShowGuide(true);
                }}
              >
                <Sparkles size={18} />
                <span>Não sei por onde começar</span>
              </button>
            </div>
            <label className="search-box">
              <Search size={18} />
              <input
                ref={searchRef}
                type="search"
                placeholder="Buscar profissão ou ideia…"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                aria-label="Buscar profissão ou caminho"
              />
            </label>
            <div className="view-toggle" aria-label="Visualização">
              <button
                aria-label="Mapa"
                aria-pressed={view === "map"}
                className={view === "map" ? "active" : ""}
                onClick={() => {
                  setShowFilters(false);
                  setView("map");
                }}
              >
                <Map size={15} />
                <span>Mapa</span>
              </button>
              <button
                aria-label="Lista"
                aria-pressed={view === "list"}
                className={view === "list" ? "active" : ""}
                onClick={() => {
                  setShowFilters(false);
                  setView("list");
                }}
              >
                <List size={16} />
                <span>Lista</span>
              </button>
            </div>
            <ThemeToggle />
          </div>
          <div className="results-bar">
            <div aria-live="polite">
              <span className="live-dot" />
              <strong>{number(results.length)}</strong> possibilidades{" "}
              <span className="muted">em {areaCount} áreas</span>
              {filters.savedOnly && (
                <span className="filter-pill">
                  Salvos{" "}
                  <button
                    aria-label="Mostrar todos"
                    onClick={() => set("savedOnly", false)}
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>
            <a className="sources-link" href="/sobre">
              Fontes e metodologia <ArrowUpRight size={11} />
            </a>
          </div>
          {(filters.areas.length > 0 ||
            filters.interests.length > 0 ||
            filters.preparation.length > 0 ||
            filters.remote) && (
            <div className="active-filters">
              {filters.areas.map((id) => (
                <button
                  key={id}
                  onClick={() =>
                    set(
                      "areas",
                      filters.areas.filter((a) => a !== id),
                    )
                  }
                >
                  {catalog.areas.find((a) => a.id === id)?.title || id}
                  <X size={12} />
                </button>
              ))}
              {filters.interests.map((id) => (
                <button
                  key={id}
                  onClick={() =>
                    set(
                      "interests",
                      filters.interests.filter((a) => a !== id),
                    )
                  }
                >
                  {INTERESTS.find((i) => i.id === id)?.label}
                  <X size={12} />
                </button>
              ))}
              {filters.preparation.map((id) => (
                <button
                  key={id}
                  onClick={() =>
                    set(
                      "preparation",
                      filters.preparation.filter((p) => p !== id),
                    )
                  }
                >
                  {PREPARATION_LABELS[id as Preparation]}
                  <X size={12} />
                </button>
              ))}
              {filters.remote && (
                <button onClick={() => set("remote", "")}>
                  {REMOTE_LABELS[filters.remote as keyof typeof REMOTE_LABELS]}
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          <div className="visualization" aria-busy={filters !== deferred}>
            {results.length === 0 ? (
              <div className="empty-state">
                <Compass size={42} strokeWidth={1} />
                <h2>Nenhum caminho com essa combinação.</h2>
                <p>
                  Experimente ampliar o intervalo salarial ou retirar um dos
                  filtros.
                </p>
                <button
                  className="primary"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  Explorar todas as possibilidades <ArrowRight size={15} />
                </button>
              </div>
            ) : view === "map" ? (
              <MapCanvas
                occupations={results}
                areas={catalog.areas}
                selected={selected?.code || null}
                saved={saved}
                hasComparison={compared.length > 0}
                onSelect={setSelected}
              />
            ) : (
              <div className="list-view">
                <div className="list-header">
                  <span>
                    {filters.savedOnly
                      ? "Seu repertório de possibilidades"
                      : "Explore no seu ritmo"}
                  </span>
                  <label>
                    Ordenar por{" "}
                    <select
                      aria-label="Ordenar resultados"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="name">Nome</option>
                      <option value="salary">Maior salário</option>
                      <option value="employment">Mais vínculos formais</option>
                    </select>
                  </label>
                </div>
                <div className="career-grid">
                  {sorted.slice(0, page * 36).map((o) => (
                    <CareerCard
                      key={o.code}
                      occupation={o}
                      area={catalog.areas.find((a) => a.id === o.area)!}
                      saved={saved.includes(o.code)}
                      onSave={() => save(o.code)}
                      onSelect={() => setSelected(o)}
                    />
                  ))}
                </div>
                {page * 36 < results.length && (
                  <button
                    className="load-more"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Mostrar mais 36 opções <ArrowDown size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
          {compared.length > 0 && (
            <button
              className="compare-tray"
              onClick={() => setShowCompare(true)}
              aria-label="Comparar caminhos"
            >
              <GitCompareArrows size={18} />
              <span>Comparar</span>
              <b>{compared.length}</b>
              <ArrowUpRight size={15} />
            </button>
          )}
        </main>
      </div>
      {selected && (
        <DetailDrawer
          occupation={selected}
          areas={catalog.areas}
          all={catalog.occupations}
          saved={saved.includes(selected.code)}
          compared={compare.includes(selected.code)}
          onClose={() => setSelected(null)}
          onSave={() => save(selected.code)}
          onCompare={() => compareToggle(selected.code)}
          onSelect={setSelected}
        />
      )}
      {showGuide && (
        <Guide
          onClose={() => setShowGuide(false)}
          onApply={(interests) => {
            setFilters({ ...INITIAL_FILTERS, interests });
            setShowGuide(false);
            setToast(
              "Mapa atualizado com suas afinidades. Você pode ajustar os filtros a qualquer momento.",
            );
          }}
        />
      )}
      {showCompare && (
        <Comparison
          occupations={compared}
          areas={catalog.areas}
          onClose={() => setShowCompare(false)}
          onRemove={(code) => {
            compareToggle(code);
            if (compare.length === 1) setShowCompare(false);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function CareerCard({
  occupation: o,
  area,
  saved,
  onSave,
  onSelect,
}: {
  occupation: Occupation;
  area: Area;
  saved: boolean;
  onSave: () => void;
  onSelect: () => void;
}) {
  return (
    <article
      className="career-card"
      style={{ "--area-color": area.color } as React.CSSProperties}
    >
      <div className="card-top">
        <span>
          <i style={{ background: area.color }} />
          {area.title}
        </span>
        <button
          className={`icon-button ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Remover dos salvos" : "Salvar"} ${o.title}`}
          onClick={onSave}
        >
          <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="card-main" onClick={onSelect}>
        <span className="kind-caption">{KIND_LABELS[o.kind]}</span>
        <h3>{o.title}</h3>
        <div className="card-salary">
          {o.salary ? (
            <>
              <strong>{money(o.salary)}</strong>
              <span>/ mês · mediana</span>
            </>
          ) : (
            <span className="unknown-income">
              Rendimento sem dados comparáveis
            </span>
          )}
        </div>
        <div className="card-bottom">
          <span>
            <Globe2 size={13} />
            {REMOTE_LABELS[o.remote]}
          </span>
          <ArrowUpRight size={17} />
        </div>
      </button>
    </article>
  );
}

function DetailDrawer({
  occupation: o,
  areas,
  all,
  saved,
  compared,
  onClose,
  onSave,
  onCompare,
  onSelect,
}: {
  occupation: Occupation;
  areas: Area[];
  all: Occupation[];
  saved: boolean;
  compared: boolean;
  onClose: () => void;
  onSave: () => void;
  onCompare: () => void;
  onSelect: (o: Occupation) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(false),
    [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref, onClose);
  useEffect(() => {
    setDetail(null);
    setError(false);
    setMore(false);
    const c = new AbortController();
    fetch(`${catalogAssets.details}/${encodeURIComponent(o.code)}.json`, {
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDetail)
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    ref.current?.scrollTo(0, 0);
    return () => c.abort();
  }, [o.code]);
  const area = areas.find((a) => a.id === o.area)!;
  const similar = all
    .filter((x) => x.code !== o.code && x.area === o.area)
    .sort(
      (a, b) =>
        Number(b.family === o.family) - Number(a.family === o.family) ||
        b.employment - a.employment,
    )
    .slice(0, 3);
  return (
    <div className="drawer-layer">
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Fechar detalhes"
      />
      <div
        className="detail-drawer"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="drawer-top">
          <span style={{ color: area.color }}>
            <i style={{ background: area.color }} />
            {area.title}
          </span>
          <button
            className="icon-button"
            aria-label="Fechar detalhes"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="detail-hero">
          <span className="kind-caption">
            {KIND_LABELS[o.kind]}
            {o.kind === "cbo"
              ? ` · ${o.code.slice(0, 4)}-${o.code.slice(4)}`
              : ""}
          </span>
          <h2 id="detail-title">{o.title}</h2>
          {detail?.description && <p>{detail.description}</p>}
          {!detail?.description && detail?.familyTitle && (
            <p>{detail.familyTitle}</p>
          )}
          <div className="detail-actions">
            <button
              className={saved ? "primary" : "secondary"}
              onClick={onSave}
            >
              <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
              {saved ? "Salvo nos seus caminhos" : "Salvar caminho"}
            </button>
            <button
              className={compared ? "secondary selected" : "secondary"}
              onClick={onCompare}
            >
              <GitCompareArrows size={16} />
              {compared ? "Na comparação" : "Comparar"}
            </button>
          </div>
        </div>
        <section className="salary-card">
          <span className="eyebrow">
            {o.kind === "cbo"
              ? "REMUNERAÇÃO FORMAL NO BRASIL"
              : "POSSIBILIDADE DE RENDA"}
          </span>
          {o.salary ? (
            <>
              <div className="big-salary">
                {money(o.salary)}
                <small>/ mês</small>
              </div>
              <p>Mediana: metade dos vínculos recebe até esse valor.</p>
              <div className="salary-band">
                <span>
                  {money(o.salaryLow)}
                  <small>25º percentil</small>
                </span>
                <div />
                <span>
                  {money(o.salaryHigh)}
                  <small>75º percentil</small>
                </span>
              </div>
              <p className="salary-source">
                RAIS 2025 · agregado por{" "}
                <a
                  href="https://futurodascarreiras.com/metodologia/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Futuro das Carreiras ↗
                </a>
                <br />
                {number(o.sample)} vínculos com remuneração · valores brutos
                nominais
              </p>
            </>
          ) : (
            <>
              <h3>Sem estimativa confiável</h3>
              <p>
                {o.kind === "cbo"
                  ? o.sample > 0
                    ? "A amostra é pequena. O salário foi ocultado para evitar uma comparação pouco confiável."
                    : "Não há remuneração suficiente na base para esta ocupação."
                  : "A receita depende de clientes, custos e execução. Faturamento não equivale a salário ou lucro."}
              </p>
            </>
          )}
          <div className="salary-caveat">
            <Info size={14} />
            <span>
              {o.kind === "cbo"
                ? "Vínculos formais. Não representa rendimento de autônomos ou PJ, nem salário inicial."
                : "Este é um caminho de atuação. Não existe garantia de demanda ou retorno financeiro."}
            </span>
          </div>
        </section>
        <section className="detail-section">
          <h3>
            <GraduationCap size={17} /> Formação para explorar este caminho
          </h3>
          <strong>{PREPARATION_LABELS[o.preparation]}</strong>
          <p>
            {!detail
              ? "Carregando referência de formação…"
              : detail.preparationSummary ||
                "Não temos uma referência de formação classificada para este caminho. Isso não significa ausência de requisitos."}
          </p>
          {detail?.preparationSource && (
            <a
              className="training-source"
              href={detail.preparationSource}
              target="_blank"
              rel="noreferrer"
            >
              Fonte: CBO / MTE · arquivo histórico de{" "}
              {detail.preparationSnapshot?.slice(0, 4)}{" "}
              <ArrowUpRight size={13} />
            </a>
          )}
          <p className="subtle-note">
            A referência descreve uma família ocupacional. Não é uma exigência
            legal atual nem mede custo, tempo de estudo ou experiência
            necessária para começar. Verifique a formação específica da
            atividade.
          </p>
        </section>
        <section className="detail-section">
          <h3>
            <Globe2 size={17} /> Trabalho remoto
          </h3>
          <span className={`remote-badge ${o.remote}`}>
            {REMOTE_LABELS[o.remote]}
          </span>
          <p>{detail?.remoteReason || "Carregando avaliação…"}</p>
          <small className="subtle-note">
            Avaliação editorial das tarefas · não mede a frequência de vagas
            remotas.
          </small>
        </section>
        <section className="detail-section">
          <h3>
            <Sparkles size={17} /> Afinidades deste caminho
          </h3>
          <div className="profile-bars">
            {INTERESTS.map((i) => (
              <div key={i.id}>
                <span>{i.label}</span>
                <div className="profile-bar">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i
                      key={n}
                      style={{
                        background:
                          n <= o.riasec[i.id] ? area.color : "var(--line)",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="subtle-note">
            Associação editorial inspirada no RIASEC. Não é uma avaliação
            psicológica ou medida de aptidão.
          </p>
        </section>
        <section className="detail-section">
          <h3>O que você pode fazer no dia a dia</h3>
          {error ? (
            <p>
              Não foi possível carregar as atividades. Feche e abra esta opção
              para tentar novamente.
            </p>
          ) : !detail ? (
            <p className="skeleton-text">Carregando atividades…</p>
          ) : detail.activities.length ? (
            <ul className="activity-list">
              {detail.activities.slice(0, more ? undefined : 6).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p>
              As atividades detalhadas ainda não estão disponíveis nesta versão
              da base.
            </p>
          )}
          {detail && detail.activities.length > 6 && (
            <button className="text-button" onClick={() => setMore((v) => !v)}>
              {more
                ? "Mostrar menos"
                : `Ver todas as ${detail.activities.length} atividades`}
              <ChevronDown size={13} />
            </button>
          )}
        </section>
        {detail?.admissionSalary && (
          <section className="detail-section">
            <h3>Entrada no mercado formal</h3>
            <div className="stat-pair">
              <span>
                <strong>{money(detail.admissionSalary)}</strong>
                <small>Mediana na admissão</small>
              </span>
              <span>
                <strong>{number(detail.admissions)}</strong>
                <small>Admissões no período</small>
              </span>
            </div>
            <p className="subtle-note">
              Novo CAGED · set/2025–ago/2026 · agregado por Futuro das
              Carreiras. Uma admissão não equivale ao primeiro emprego.
            </p>
          </section>
        )}
        {o.aliases.length > 0 && (
          <section className="detail-section">
            <h3>Também pode aparecer como</h3>
            <p>{o.aliases.slice(0, 12).join(" · ")}</p>
          </section>
        )}
        <section className="detail-section">
          <h3>Outros caminhos para conhecer</h3>
          <div className="similar-list">
            {similar.map((x) => (
              <button key={x.code} onClick={() => onSelect(x)}>
                <span>
                  {x.title}
                  <small>
                    {x.salary
                      ? `${money(x.salary)} / mês`
                      : "Sem renda comparável"}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        </section>
        <div className="detail-source">
          <a href={o.sourceUrl} target="_blank" rel="noreferrer">
            Consultar fonte desta opção <ArrowUpRight size={13} />
          </a>
          <a href="/sobre">Entenda os dados e suas limitações</a>
        </div>
      </div>
    </div>
  );
}

function Guide({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (i: Interest[]) => void;
}) {
  const [interests, setInterests] = useState<Interest[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref, onClose);
  return (
    <div className="modal-layer">
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="guide-modal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Fechar descoberta de interesses"
        >
          <X size={20} />
        </button>
        <span className="guide-spark">
          <Sparkles size={27} />
        </span>
        <div className="eyebrow">UM PRIMEIRO PASSO, SEM PRESSÃO.</div>
        <h2 id="guide-title">O que desperta sua curiosidade?</h2>
        <p>
          Imagine um dia de trabalho interessante. O que você gostaria de estar
          fazendo? Escolha quantas opções fizerem sentido.
        </p>
        <div className="guide-choices">
          {INTERESTS.map((i) => (
            <button
              key={i.id}
              aria-pressed={interests.includes(i.id)}
              className={interests.includes(i.id) ? "chosen" : ""}
              onClick={() => setInterests((s) => toggle(s, i.id))}
            >
              <span className="interest-letter">{i.id}</span>
              <span>
                <strong>{i.verb}</strong>
                <small>{i.description}</small>
              </span>
              <span className="choice-check">
                {interests.includes(i.id) && <Check size={13} />}
              </span>
            </button>
          ))}
        </div>
        <div className="guide-bottom">
          <small>
            Exploração inspirada no RIASEC.
            <br />
            Não é um teste vocacional validado.
          </small>
          <button
            className="primary"
            disabled={!interests.length}
            onClick={() => onApply(interests)}
          >
            Encontrar possibilidades <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
function Comparison({
  occupations,
  areas,
  onClose,
  onRemove,
}: {
  occupations: Occupation[];
  areas: Area[];
  onClose: () => void;
  onRemove: (code: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref, onClose);
  return (
    <div className="modal-layer">
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="comparison-modal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Fechar comparação"
        >
          <X size={20} />
        </button>
        <div className="eyebrow">
          COLOQUE SUAS POSSIBILIDADES EM PERSPECTIVA
        </div>
        <h2 id="compare-title">Qual caminho combina com seu momento?</h2>
        <p>
          A comparação é um ponto de partida. Conhecer a rotina de quem já atua
          pode ajudar no próximo passo.
        </p>
        <div className="comparison-scroll">
          <table>
            <thead>
              <tr>
                <th>O que considerar</th>
                {occupations.map((o) => (
                  <th key={o.code}>
                    <span
                      style={{
                        color: areas.find((a) => a.id === o.area)?.color,
                      }}
                    >
                      {areas.find((a) => a.id === o.area)?.title}
                    </span>
                    {o.title}
                    <button
                      className="comparison-remove"
                      aria-label={`Remover ${o.title} da comparação`}
                      onClick={() => onRemove(o.code)}
                    >
                      <X size={12} /> Remover
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Tipo de caminho</th>
                {occupations.map((o) => (
                  <td key={o.code}>{KIND_LABELS[o.kind]}</td>
                ))}
              </tr>
              <tr>
                <th>
                  Salário mensal mediano
                  <small>RAIS 2025 · vínculo formal</small>
                </th>
                {occupations.map((o) => (
                  <td key={o.code} className="comparison-salary">
                    {money(o.salary)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Faixa central (25%–75%)</th>
                {occupations.map((o) => (
                  <td key={o.code}>
                    {o.salary
                      ? `${money(o.salaryLow)} a ${money(o.salaryHigh)}`
                      : "Sem dados comparáveis"}
                  </td>
                ))}
              </tr>
              <tr>
                <th>
                  Formação de referência
                  <small>Descrição histórica da família CBO</small>
                </th>
                {occupations.map((o) => (
                  <td key={o.code}>{PREPARATION_LABELS[o.preparation]}</td>
                ))}
              </tr>
              <tr>
                <th>
                  Potencial remoto<small>Avaliação editorial</small>
                </th>
                {occupations.map((o) => (
                  <td key={o.code}>{REMOTE_LABELS[o.remote]}</td>
                ))}
              </tr>
              <tr>
                <th>
                  Afinidades predominantes<small>Associação editorial</small>
                </th>
                {occupations.map((o) => (
                  <td key={o.code}>
                    {INTERESTS.filter((i) => o.riasec[i.id] >= 4)
                      .map((i) => i.label)
                      .join(" · ")}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Amostra salarial</th>
                {occupations.map((o) => (
                  <td key={o.code}>
                    {o.salary
                      ? `${number(o.sample)} vínculos`
                      : "Insuficiente ou indisponível"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="comparison-note">
          <Info size={15} />
          Salários formais e faturamento de negócios não são comparáveis. Os
          campos sem dados não são estimativas de renda zero.
        </div>
      </div>
    </div>
  );
}
