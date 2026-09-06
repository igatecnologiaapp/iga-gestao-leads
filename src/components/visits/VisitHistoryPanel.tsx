import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/DataState";
import { PeriodFilter } from "@/components/visits/PeriodFilter";
import { useProfiles, useSegments } from "@/lib/queries";
import { presetRange, type DateRange } from "@/lib/dashboard";
import { useLeadsLite, useLeadVisits, useVisitRoutes } from "@/lib/visitQueries";
import {
  buildVisitRows,
  EMPTY_VISIT_FILTERS,
  filterVisitRows,
  routeLabel,
  type VisitFilters,
} from "@/lib/visitHistory";
import { VISIT_RESULTS } from "@/lib/visits";

/**
 * Histórico de Visitas: registros reais de lead_visits, filtráveis e com
 * acesso direto à Central do Lead. O RLS limita o que cada usuário enxerga.
 */
export function VisitHistoryPanel() {
  const { data: visits = [], isLoading } = useLeadVisits();
  const { data: leads = [] } = useLeadsLite();
  const { data: routes = [] } = useVisitRoutes();
  const { data: profiles = [] } = useProfiles();
  const { data: segments = [] } = useSegments();

  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState<DateRange>(() => presetRange("30"));
  const [filters, setFilters] = useState<VisitFilters>(EMPTY_VISIT_FILTERS);

  const rows = useMemo(
    () => buildVisitRows({ visits, leads, routes, profiles, segments }),
    [visits, leads, routes, profiles, segments],
  );
  const list = useMemo(() => filterVisitRows(rows, range, filters), [rows, range, filters]);

  const regions = useMemo(
    () => [...new Set(rows.map((r) => r.region))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const owners = useMemo(
    () =>
      [...new Map(rows.map((r) => [r.ownerId, r.ownerName])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [rows],
  );

  function set(key: keyof VisitFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) return <LoadingState label="Carregando histórico de visitas..." />;

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <PeriodFilter preset={preset} range={range} onPreset={setPreset} onRange={setRange} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            label="Responsável"
            value={filters.ownerId}
            onChange={(v) => set("ownerId", v)}
            options={owners.map(([id, name]) => ({ value: id, label: name }))}
          />
          <FilterSelect
            label="Segmento"
            value={filters.segmentId}
            onChange={(v) => set("segmentId", v)}
            options={segments.map((s) => ({ value: s.id, label: s.name }))}
          />
          <FilterSelect
            label="Região/Bairro"
            value={filters.region}
            onChange={(v) => set("region", v)}
            options={regions.map((r) => ({ value: r, label: r }))}
          />
          <FilterSelect
            label="Resultado"
            value={filters.result}
            onChange={(v) => set("result", v)}
            options={VISIT_RESULTS.map((r) => ({ value: r.value, label: r.label }))}
          />
          <FilterSelect
            label="Roteiro"
            value={filters.routeId}
            onChange={(v) => set("routeId", v)}
            options={routes.map((r) => ({ value: r.id, label: routeLabel(r) }))}
          />
          <div className="flex items-end">
            <p className="text-xs text-muted-foreground">
              {list.length} visita{list.length === 1 ? "" : "s"} no filtro atual.
            </p>
          </div>
        </div>
      </section>

      {!list.length ? (
        <EmptyState
          title="Nenhuma visita registrada"
          description="Ajuste o período ou os filtros. Somente visitas reais registradas em campo aparecem aqui."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((row) => (
            <li
              key={row.visit.id}
              className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{row.companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.dateLabel} · {row.startedLabel}
                    {row.visit.finished_at ? ` às ${row.finishedLabel}` : ""} · {row.ownerName}
                  </p>
                </div>
                <Badge variant="outline">{row.situation}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Info label="Roteiro" value={row.routeTitle} />
                <Info label="Resultado" value={row.resultLabel} />
                <Info label="Próxima ação" value={row.nextActionLabel} />
                <Info label="Segmento" value={row.segmentName} />
              </dl>
              {row.visit.notes ? (
                <p className="mt-3 text-sm text-muted-foreground">{row.visit.notes}</p>
              ) : null}
              <Link
                to="/leads/$id"
                params={{ id: row.leadId }}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                Abrir Central do Lead <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold" title={value}>
        {value}
      </dd>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
