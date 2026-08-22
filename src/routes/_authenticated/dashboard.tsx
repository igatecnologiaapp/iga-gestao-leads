import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Layers, UserRound, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/lib/leads";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAppointments,
  useContactTypes,
  useProfiles,
  useSegments,
  type Appointment,
} from "@/lib/queries";
import {
  APPOINTMENT_STATUSES,
  appointmentStatusClass,
  appointmentStatusLabel,
  formatAppointment,
  formatAppointmentTime,
  isOverdue,
  isToday,
  toLocalParts,
} from "@/lib/appointments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IGA TECNOLOGIA" },
      {
        name: "description",
        content:
          "Painel operacional: total de leads, agendamentos, segmentos e captação por vendedor.",
      },
      { property: "og:title", content: "Dashboard — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content:
          "Painel operacional: total de leads, agendamentos, segmentos e captação por vendedor.",
      },
    ],
  }),
  component: Dashboard,
});

type LeadRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  status: string;
  segment_id: string | null;
  created_at: string;
  created_by: string | null;
  neighborhood_name: string | null;
  street_name: string | null;
  city: string | null;
};

const PERIOD_PRESETS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "custom", label: "Personalizado" },
] as const;

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  if (preset === "hoje") return { from: today, to: today };
  if (preset === "ontem") {
    const y = new Date(now.getTime() - 86400000);
    return { from: isoDate(y), to: isoDate(y) };
  }
  if (preset === "7") return { from: isoDate(new Date(now.getTime() - 6 * 86400000)), to: today };
  if (preset === "30") return { from: isoDate(new Date(now.getTime() - 29 * 86400000)), to: today };
  if (preset === "mes")
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (preset === "mes_anterior")
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

function Dashboard() {
  const { data: segments = [] } = useSegments();
  const { data: profiles = [] } = useProfiles();
  const { data: contactTypes = [] } = useContactTypes();
  const { data: appointments = [] } = useAppointments();

  const [preset, setPreset] = useState<string>("mes");
  const [range, setRange] = useState(() => presetRange("mes"));
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, contact_name, phone, status, segment_id, created_at, created_by, neighborhood_name, street_name, city",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
  });

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const segmentName = (id: string | null) =>
    segments.find((s) => s.id === id)?.name ?? "Sem segmento";
  const sellerName = (id: string | null) =>
    profiles.find((p) => p.id === id)?.full_name?.trim() || (id ? "Usuário" : "Sem vendedor");
  const typeName = (id: string | null) =>
    contactTypes.find((c) => c.id === id)?.name ?? "Não informado";

  const inPeriod = useMemo(
    () =>
      leads.filter((l) => {
        const d = toLocalParts(l.created_at).date;
        return d >= range.from && d <= range.to;
      }),
    [leads, range],
  );

  // Agendamentos apenas de leads ativos (exclusão lógica respeitada)
  const validAppointments = useMemo(
    () => appointments.filter((a) => leadById.has(a.lead_id)),
    [appointments, leadById],
  );
  const activeAppointments = validAppointments.filter((a) => a.status === "agendado");
  const scheduledLeadIds = new Set(activeAppointments.map((a) => a.lead_id));

  function applyPreset(v: string) {
    setPreset(v);
    if (v !== "custom") setRange(presetRange(v));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Dashboard"
        description="Painel operacional da captação. Toque em um quadro para expandir."
      />

      <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label>Período de captação</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">De</Label>
            <Input
              id="from"
              type="date"
              className="h-11"
              value={range.from}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, from: e.target.value }));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Até</Label>
            <Input
              id="to"
              type="date"
              className="h-11"
              value={range.to}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, to: e.target.value }));
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O período afeta os quadros “Leads por segmentos” e “Leads por vendedor”. “Total de leads”
          considera todos os leads ativos e “Leads agendados” usa a data do agendamento.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          id="total"
          label="Total de leads"
          value={String(leads.length)}
          icon={Users2}
          expanded={expanded === "total"}
          onToggle={setExpanded}
        />
        <StatCard
          id="agendados"
          label="Leads agendados"
          value={String(scheduledLeadIds.size)}
          hint={`${activeAppointments.length} agendamentos ativos`}
          icon={CalendarClock}
          expanded={expanded === "agendados"}
          onToggle={setExpanded}
        />
        <StatCard
          id="segmentos"
          label="Leads por segmentos"
          value={String(new Set(inPeriod.map((l) => l.segment_id)).size)}
          hint={`${inPeriod.length} leads no período`}
          icon={Layers}
          expanded={expanded === "segmentos"}
          onToggle={setExpanded}
        />
        <StatCard
          id="vendedor"
          label="Leads por vendedor"
          value={String(inPeriod.length)}
          hint={`${new Set(inPeriod.map((l) => l.created_by)).size} vendedores no período`}
          icon={UserRound}
          expanded={expanded === "vendedor"}
          onToggle={setExpanded}
        />
      </div>

      {expanded === "total" && (
        <Panel title={`Todos os leads (${leads.length})`}>
          <LeadList leads={leads} segmentName={segmentName} sellerName={sellerName} />
        </Panel>
      )}

      {expanded === "agendados" && (
        <Panel
          title={`${scheduledLeadIds.size} leads | ${activeAppointments.length} agendamentos ativos`}
        >
          <AppointmentsPanel
            appointments={validAppointments}
            leadById={leadById}
            segmentName={segmentName}
            sellerName={sellerName}
            typeName={typeName}
          />
        </Panel>
      )}

      {expanded === "segmentos" && (
        <Panel title={`Leads por segmentos — ${inPeriod.length} no período`}>
          <SegmentsPanel
            leads={inPeriod}
            segments={segments}
            appointments={activeAppointments}
            typeName={typeName}
          />
        </Panel>
      )}

      {expanded === "vendedor" && (
        <Panel title={`Leads por vendedor — total ${inPeriod.length}`}>
          <SellersPanel leads={inPeriod} sellerName={sellerName} segmentName={segmentName} />
        </Panel>
      )}
    </div>
  );
}

function StatCard({
  id,
  label,
  value,
  hint,
  icon: Icon,
  expanded,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users2;
  expanded: boolean;
  onToggle: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => onToggle(expanded ? null : id)}
      className={cn(
        "min-h-[92px] rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-colors",
        expanded ? "border-primary ring-1 ring-primary/30" : "hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{hint ?? "Ver detalhes"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </div>
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LeadList({
  leads,
  segmentName,
  sellerName,
  emptyText = "Nenhum lead encontrado.",
}: {
  leads: LeadRow[];
  segmentName: (id: string | null) => string;
  sellerName: (id: string | null) => string;
  emptyText?: string;
}) {
  if (!leads.length) return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y">
      {leads.map((l) => (
        <li key={l.id}>
          <Link
            to="/leads/$id"
            params={{ id: l.id }}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{l.company_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[l.contact_name, l.phone, segmentName(l.segment_id)].filter(Boolean).join(" · ")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[l.street_name, l.neighborhood_name, l.city].filter(Boolean).join(", ") ||
                  "Sem endereço"}
                {" · "}
                {sellerName(l.created_by)}
              </p>
            </div>
            <StatusBadge status={l.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AppointmentsPanel({
  appointments,
  leadById,
  segmentName,
  sellerName,
  typeName,
}: {
  appointments: Appointment[];
  leadById: Map<string, LeadRow>;
  segmentName: (id: string | null) => string;
  sellerName: (id: string | null) => string;
  typeName: (id: string | null) => string;
}) {
  const [period, setPeriod] = useState("todos");
  const [status, setStatus] = useState("agendado");

  const filtered = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((a) => (status === "todos" ? true : a.status === status))
      .filter((a) => {
        if (period === "todos") return true;
        if (period === "hoje") return isToday(a.scheduled_at);
        const days = Number(period);
        const t = new Date(a.scheduled_at).getTime();
        return t <= now + days * 86400000;
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [appointments, period, status]);

  const overdue = filtered.filter((a) => isOverdue(a.scheduled_at, a.status));
  const today = filtered.filter(
    (a) => isToday(a.scheduled_at) && !isOverdue(a.scheduled_at, a.status),
  );
  const upcoming = filtered.filter(
    (a) => !isToday(a.scheduled_at) && !isOverdue(a.scheduled_at, a.status),
  );

  function Card({ a }: { a: Appointment }) {
    const lead = leadById.get(a.lead_id);
    if (!lead) return null;
    return (
      <Link
        to="/leads/$id"
        params={{ id: lead.id }}
        className="block rounded-xl border p-3 transition-colors hover:border-primary/50"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">{formatAppointment(a.scheduled_at)}</p>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              appointmentStatusClass(a.status),
            )}
          >
            {appointmentStatusLabel(a.status)}
            {isOverdue(a.scheduled_at, a.status) ? " — Atrasado" : ""}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold">{lead.company_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[lead.contact_name, lead.phone].filter(Boolean).join(" · ") || "Sem contato"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {segmentName(lead.segment_id)} · {typeName(a.contact_type_id)} ·{" "}
          {sellerName(lead.created_by)}
        </p>
      </Link>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7">Próximos 7 dias</SelectItem>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Situação</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPOINTMENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
              <SelectItem value="todos">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {overdue.length > 0 && (
        <div>
          <p className="text-xs font-bold tracking-wide text-destructive uppercase">
            🔴 Atrasados ({overdue.length})
          </p>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {overdue.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      {today.length > 0 && (
        <div>
          <p className="text-xs font-bold tracking-wide text-primary uppercase">
            Hoje ({today.length})
          </p>
          <ul className="mt-2 space-y-1.5">
            {today.map((a) => {
              const lead = leadById.get(a.lead_id);
              if (!lead) return null;
              return (
                <li key={a.id}>
                  <Link
                    to="/leads/$id"
                    params={{ id: lead.id }}
                    className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm hover:border-primary/50"
                  >
                    <span className="font-bold">{formatAppointmentTime(a.scheduled_at)}</span>
                    <span className="truncate font-semibold">{lead.company_name}</span>
                    <span className="text-muted-foreground">· {typeName(a.contact_type_id)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Próximos agendamentos ({upcoming.length})
        </p>
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          {upcoming.map((a) => (
            <Card key={a.id} a={a} />
          ))}
          {!upcoming.length && (
            <p className="py-2 text-sm text-muted-foreground">Nenhum agendamento futuro.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentsPanel({
  leads,
  segments,
  appointments,
  typeName,
}: {
  leads: LeadRow[];
  segments: { id: string; name: string }[];
  appointments: Appointment[];
  typeName: (id: string | null) => string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    for (const l of leads) {
      const key = l.segment_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        name: segments.find((s) => s.id === key)?.name ?? "Sem segmento",
        items,
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [leads, segments]);

  function nextFor(leadId: string) {
    return appointments
      .filter((a) => a.lead_id === leadId)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  }

  if (!groups.length)
    return <p className="text-sm text-muted-foreground">Nenhum lead no período.</p>;

  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.key} className="rounded-xl border">
          <button
            type="button"
            aria-expanded={open === g.key}
            onClick={() => setOpen(open === g.key ? null : g.key)}
            className="flex min-h-11 w-full items-center justify-between gap-3 p-3 text-left"
          >
            <span className="truncate text-sm font-semibold">{g.name}</span>
            <span className="flex items-center gap-2 text-sm font-bold">
              {g.items.length}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", open === g.key && "rotate-180")}
              />
            </span>
          </button>
          {open === g.key && (
            <ul className="divide-y border-t">
              {g.items.map((l) => {
                const next = nextFor(l.id);
                return (
                  <li key={l.id}>
                    <Link to="/leads/$id" params={{ id: l.id }} className="block px-3 py-2.5">
                      <p className="truncate text-sm font-semibold">{l.company_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {next
                          ? `Próximo contato: ${formatAppointment(next.scheduled_at)} — ${typeName(next.contact_type_id)}`
                          : `Sem agendamento · ${statusLabel(l.status)}`}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function SellersPanel({
  leads,
  sellerName,
  segmentName,
}: {
  leads: LeadRow[];
  sellerName: (id: string | null) => string;
  segmentName: (id: string | null) => string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    for (const l of leads) {
      const key = l.created_by ?? "none";
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        name: key === "none" ? "Sem vendedor" : sellerName(key),
        items,
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [leads, sellerName]);

  if (!groups.length)
    return <p className="text-sm text-muted-foreground">Nenhum lead no período.</p>;

  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.key} className="rounded-xl border">
          <button
            type="button"
            aria-expanded={open === g.key}
            onClick={() => setOpen(open === g.key ? null : g.key)}
            className="flex min-h-11 w-full items-center justify-between gap-3 p-3 text-left"
          >
            <span className="truncate text-sm font-semibold">{g.name}</span>
            <span className="flex items-center gap-2 text-sm font-bold">
              {g.items.length} leads
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", open === g.key && "rotate-180")}
              />
            </span>
          </button>
          {open === g.key && (
            <ul className="divide-y border-t">
              {g.items.map((l) => (
                <li key={l.id}>
                  <Link to="/leads/$id" params={{ id: l.id }} className="block px-3 py-2.5">
                    <p className="truncate text-sm font-semibold">{l.company_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[segmentName(l.segment_id), l.contact_name, l.phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
      <li className="rounded-xl border bg-muted/40 p-3 text-sm font-bold">
        Total — {leads.length} leads
      </li>
    </ul>
  );
}
