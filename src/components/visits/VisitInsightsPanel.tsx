import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, CircleSlash, FileText, Percent } from "lucide-react";

import {
  DetailPanel,
  GroupList,
  MetricCard,
  NoData,
  type Group,
} from "@/components/dashboard/DashboardKit";
import { LoadingState } from "@/components/DataState";
import { PeriodFilter } from "@/components/visits/PeriodFilter";
import { useProfiles, useSegments } from "@/lib/queries";
import { useCommercialDocuments } from "@/lib/commercialQueries";
import { groupBy, periodLabel, presetRange, rate, type DateRange } from "@/lib/dashboard";
import {
  useAllRouteStops,
  useLeadsLite,
  useLeadVisits,
  useVisitRoutes,
} from "@/lib/visitQueries";
import {
  buildVisitRows,
  EMPTY_VISIT_FILTERS,
  filterVisitRows,
  NOT_DONE_STOPS,
  PENDING_STOPS,
  routeLabel,
  stopsInRange,
  type VisitRow,
} from "@/lib/visitHistory";
import { stopStatusLabel } from "@/lib/visits";

/**
 * Inteligência Operacional: indicadores simples derivados exclusivamente dos
 * dados reais visíveis ao usuário (RLS). Cada quadro expande a relação dos
 * registros que o compõem, no mesmo padrão do Dashboard.
 */
export function VisitInsightsPanel() {
  const { data: visits = [], isLoading } = useLeadVisits();
  const { data: leads = [] } = useLeadsLite();
  const { data: routes = [] } = useVisitRoutes();
  const { data: stops = [] } = useAllRouteStops();
  const { data: profiles = [] } = useProfiles();
  const { data: segments = [] } = useSegments();
  const { data: documents = [] } = useCommercialDocuments();

  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState<DateRange>(() => presetRange("30"));
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () => buildVisitRows({ visits, leads, routes, profiles, segments }),
    [visits, leads, routes, profiles, segments],
  );
  const period = useMemo(
    () => filterVisitRows(rows, range, EMPTY_VISIT_FILTERS),
    [rows, range],
  );

  const done = period.filter((r) => r.visit.finished_at);
  const withNext = period.filter((r) => r.visit.next_contact_date);

  const periodStops = useMemo(() => stopsInRange(stops, routes, range), [stops, routes, range]);
  const pending = periodStops.filter((s) => PENDING_STOPS.includes(s.stop.status));
  const notDone = periodStops.filter((s) => NOT_DONE_STOPS.includes(s.stop.status));
  const base = done.length + pending.length + notDone.length;
  const doneRate = rate(done.length, base);

  const leadName = (id: string) => leads.find((l) => l.id === id)?.company_name ?? "Lead";

  /** Oportunidade comercial: documento do módulo Comercial criado a partir da visita. */
  const opportunities = period.filter((row) =>
    documents.some(
      (d) =>
        d.lead_id === row.leadId &&
        !d.deleted_at &&
        new Date(d.created_at).getTime() >=
          new Date(row.visit.started_at ?? row.visit.created_at).getTime(),
    ),
  );

  if (isLoading) return <LoadingState label="Calculando indicadores..." />;

  const cards = [
    {
      id: "realizadas",
      label: "Visitas realizadas",
      value: String(done.length),
      icon: CheckCircle2,
    },
    { id: "pendentes", label: "Visitas pendentes", value: String(pending.length), icon: CalendarClock },
    {
      id: "nao_realizadas",
      label: "Visitas não realizadas",
      value: String(notDone.length),
      icon: CircleSlash,
    },
    { id: "taxa", label: "Taxa de realização", value: `${doneRate}%`, icon: Percent },
    { id: "resultados", label: "Resultados das visitas", value: String(period.length) },
    { id: "colaborador", label: "Visitas por colaborador", value: String(period.length) },
    { id: "segmento", label: "Visitas por segmento", value: String(period.length) },
    { id: "regiao", label: "Visitas por região", value: String(period.length) },
    { id: "proxima", label: "Geraram próxima ação", value: String(withNext.length) },
    {
      id: "comercial",
      label: "Oportunidade comercial",
      value: String(opportunities.length),
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <PeriodFilter preset={preset} range={range} onPreset={setPreset} onRange={setRange} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <MetricCard
            key={c.id}
            id={c.id}
            label={c.label}
            value={c.value}
            {...(c.icon ? { icon: c.icon } : {})}
            expandedId={expanded}
            onToggle={setExpanded}
          />
        ))}
      </div>

      {expanded ? (
        <DetailPanel
          id={expanded}
          title={cards.find((c) => c.id === expanded)?.label ?? "Detalhamento"}
          description={`Registros reais de ${periodLabel(range)}.`}
          onClose={() => setExpanded(null)}
        >
          {expanded === "realizadas" ? <VisitList rows={done} /> : null}
          {expanded === "pendentes" ? (
            <StopList
              items={pending.map((s) => ({
                id: s.stop.id,
                leadId: s.stop.lead_id,
                name: leadName(s.stop.lead_id),
                extra: `${routeLabel(s.route)} · ${stopStatusLabel(s.stop.status)}`,
              }))}
            />
          ) : null}
          {expanded === "nao_realizadas" ? (
            <StopList
              items={notDone.map((s) => ({
                id: s.stop.id,
                leadId: s.stop.lead_id,
                name: leadName(s.stop.lead_id),
                extra: `${routeLabel(s.route)} · ${stopStatusLabel(s.stop.status)}`,
              }))}
            />
          ) : null}
          {expanded === "taxa" ? (
            <p className="text-sm text-muted-foreground">
              {done.length} realizadas de {base} paradas previstas no período ({doneRate}%).
              Pendentes: {pending.length}. Não realizadas: {notDone.length}.
            </p>
          ) : null}
          {expanded === "resultados" ? <Grouped rows={period} by={(r) => r.resultLabel} /> : null}
          {expanded === "colaborador" ? <Grouped rows={period} by={(r) => r.ownerName} /> : null}
          {expanded === "segmento" ? <Grouped rows={period} by={(r) => r.segmentName} /> : null}
          {expanded === "regiao" ? <Grouped rows={period} by={(r) => r.region} /> : null}
          {expanded === "proxima" ? <VisitList rows={withNext} /> : null}
          {expanded === "comercial" ? <VisitList rows={opportunities} /> : null}
        </DetailPanel>
      ) : null}
    </div>
  );
}

/** Segundo nível: agrupamento com a relação de visitas dentro de cada grupo. */
function Grouped({ rows, by }: { rows: VisitRow[]; by: (row: VisitRow) => string }) {
  const groups: Group[] = groupBy(rows, by).map((g) => ({
    key: g.key,
    name: g.key,
    count: g.items.length,
    items: <VisitList rows={g.items} />,
  }));
  return <GroupList groups={groups} />;
}

function VisitList({ rows }: { rows: VisitRow[] }) {
  if (!rows.length) return <NoData />;
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.visit.id} className="flex items-center justify-between gap-3 p-3">
          <span className="min-w-0">
            <Link
              to="/leads/$id"
              params={{ id: row.leadId }}
              className="block truncate text-sm font-semibold text-primary"
            >
              {row.companyName}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              {row.dateLabel} · {row.ownerName} · {row.resultLabel}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{row.situation}</span>
        </li>
      ))}
    </ul>
  );
}

function StopList({
  items,
}: {
  items: { id: string; leadId: string; name: string; extra: string }[];
}) {
  if (!items.length) return <NoData />;
  return (
    <ul className="divide-y">
      {items.map((i) => (
        <li key={i.id} className="p-3">
          <Link
            to="/leads/$id"
            params={{ id: i.leadId }}
            className="block truncate text-sm font-semibold text-primary"
          >
            {i.name}
          </Link>
          <span className="block truncate text-xs text-muted-foreground">{i.extra}</span>
        </li>
      ))}
    </ul>
  );
}
