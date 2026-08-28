import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  MessageCircle,
  Phone,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/DataState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AppointmentFields,
  emptyAppointment,
  type AppointmentDraft,
} from "@/components/AppointmentFields";
import {
  APPOINTMENT_STATUSES,
  appointmentStatusClass,
  appointmentStatusLabel,
  formatAppointment,
  formatAppointmentTime,
  fromLocalParts,
  isOverdue,
  toLocalParts,
} from "@/lib/appointments";
import { createAppointment, setAppointmentStatus } from "@/lib/appointmentActions";
import { useAppointments, useContactTypes, useProfiles, type Appointment } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda Operacional — IGA TECNOLOGIA" },
      {
        name: "description",
        content:
          "Agenda dos compromissos com leads: visão por dia, semana e mês, com pendências e ações rápidas.",
      },
      { property: "og:title", content: "Agenda Operacional — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content:
          "Agenda dos compromissos com leads: visão por dia, semana e mês, com pendências e ações rápidas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

type LeadLite = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  created_by: string | null;
};


type ViewMode = "dia" | "semana" | "mes";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function key(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromKey(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
function br(k: string) {
  const [y, m, d] = k.split("-");
  return `${d}/${m}/${y}`;
}
function addDays(k: string, n: number) {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return key(d);
}
function startOfWeek(k: string) {
  const d = fromKey(k);
  d.setDate(d.getDate() - d.getDay());
  return key(d);
}
function addMonths(k: string, n: number) {
  const d = fromKey(k);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return key(d);
}

function AgendaPage() {
  const today = key(new Date());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, profile, user } = useAuth();
  const canSeeOthers = isAdmin || profile?.can_view_all_leads === true;

  const { data: appointments = [], isLoading } = useAppointments();
  const { data: contactTypes = [] } = useContactTypes();
  const { data: profiles = [] } = useProfiles();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, contact_name, phone, created_by")
        .is("deleted_at", null);

      if (error) throw error;
      return data as LeadLite[];
    },
  });

  const [view, setView] = useState<ViewMode>("dia");
  const [cursor, setCursor] = useState(today);
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [ownerFilter, setOwnerFilter] = useState("todos");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [scheduleFor, setScheduleFor] = useState<LeadLite | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft>(emptyAppointment);
  const [saving, setSaving] = useState(false);

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const typeName = (id: string | null) =>
    contactTypes.find((c) => c.id === id)?.name ?? "Não informado";
  const ownerName = (id: string | null) =>
    profiles.find((p) => p.id === id)?.full_name?.trim() || "Não informado";

  /**
   * Mesma regra da Central do Lead e das políticas RLS (can_edit_lead):
   * administrador ou autor do lead pode alterar/criar agendamentos.
   */
  const canEditLead = (leadId: string) => {
    const lead = leadById.get(leadId);
    return isAdmin || (!!lead && !!user && lead.created_by === user.id);
  };

  // Somente agendamentos de leads ativos e visíveis (RLS já filtra no banco).
  const visible = useMemo(
    () => appointments.filter((a) => leadById.has(a.lead_id)),
    [appointments, leadById],
  );

  const filtered = useMemo(
    () =>
      visible.filter((a) => {
        if (typeFilter !== "todos" && a.contact_type_id !== typeFilter) return false;
        if (statusFilter !== "todos" && a.status !== statusFilter) return false;
        if (canSeeOthers && ownerFilter !== "todos" && a.created_by !== ownerFilter) return false;
        if (onlyOverdue && !isOverdue(a.scheduled_at, a.status)) return false;
        return true;
      }),
    [visible, typeFilter, statusFilter, ownerFilter, onlyOverdue, canSeeOthers],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const k = toLocalParts(a.scheduled_at).date;
      const list = map.get(k) ?? [];
      list.push(a);
      map.set(k, list);
    }
    for (const list of map.values())
      list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return map;
  }, [filtered]);

  const overdue = visible.filter((a) => isOverdue(a.scheduled_at, a.status));
  const todayCount = visible.filter(
    (a) => toLocalParts(a.scheduled_at).date === today && a.status === "agendado",
  ).length;
  /** Próximos: agendamentos ativos posteriores a hoje, em ordem cronológica. */
  const upcomingList = useMemo(
    () =>
      filtered
        .filter((a) => toLocalParts(a.scheduled_at).date > today && a.status === "agendado")
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [filtered, today],
  );
  const upcoming = visible.filter(
    (a) => toLocalParts(a.scheduled_at).date > today && a.status === "agendado",
  ).length;


  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthDays = useMemo(() => {
    const first = fromKey(cursor);
    first.setDate(1);
    const start = fromKey(startOfWeek(key(first)));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return key(d);
    });
  }, [cursor]);

  function shift(dir: number) {
    if (view === "dia") setCursor(addDays(cursor, dir));
    else if (view === "semana") setCursor(addDays(cursor, dir * 7));
    else setCursor(addMonths(cursor, dir));
  }

  const periodLabel = (() => {
    const d = fromKey(cursor);
    if (view === "dia")
      return `${WEEKDAYS[d.getDay()]}, ${br(cursor)}${cursor === today ? " (hoje)" : ""}`;
    if (view === "semana") return `${br(weekStart)} a ${br(addDays(weekStart, 6))}`;
    return `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  })();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["lead_appointments"] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  }

  async function changeStatus(a: Appointment, status: string) {
    const { ok } = await setAppointmentStatus(a, status);
    if (!ok) {
      toast.error("Não foi possível atualizar o agendamento.");
      return;
    }
    setSelected(null);
    refresh();
    toast.success("Agendamento atualizado.");
  }

  async function saveNew() {
    if (!scheduleFor) return;
    const scheduledAt = fromLocalParts(draft.date, draft.time);
    if (!scheduledAt) {
      toast.error("Informe data e hora do agendamento.");
      return;
    }
    setSaving(true);
    const { ok } = await createAppointment({
      leadId: scheduleFor.id,
      scheduledAt,
      contactTypeId: draft.contactTypeId,
      typeLabel: typeName(draft.contactTypeId),
    });
    setSaving(false);
    if (!ok) {
      toast.error("Não foi possível criar o agendamento.");
      return;
    }
    setScheduleFor(null);
    refresh();
    toast.success("Agendamento criado.");
  }

  function AppointmentRow({ a }: { a: Appointment }) {
    const lead = leadById.get(a.lead_id);
    const late = isOverdue(a.scheduled_at, a.status);
    return (
      <button
        type="button"
        onClick={() => setSelected(a)}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/60",
          late ? "border-destructive/40 bg-destructive/5" : "bg-card",
        )}
      >
        <span className="mt-0.5 shrink-0 rounded-lg bg-muted px-2 py-1 text-xs font-bold">
          {formatAppointmentTime(a.scheduled_at)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {lead?.company_name ?? "Lead"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {lead?.contact_name ? `${lead.contact_name} · ` : ""}
            {typeName(a.contact_type_id)}
            {canSeeOthers ? ` · ${ownerName(a.created_by)}` : ""}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            late
              ? "border-destructive/30 bg-destructive/15 text-destructive"
              : appointmentStatusClass(a.status),
          )}
        >
          {late ? "Atrasado" : appointmentStatusLabel(a.status)}
        </span>
      </button>
    );
  }

  function DayList({ dayKey, emptyLabel }: { dayKey: string; emptyLabel?: string }) {
    const list = byDay.get(dayKey) ?? [];
    if (!list.length)
      return (
        <p className="px-1 py-3 text-sm text-muted-foreground">
          {emptyLabel ?? "Nenhum compromisso neste dia."}
        </p>
      );
    return (
      <div className="grid gap-2">
        {list.map((a) => (
          <AppointmentRow key={a.id} a={a} />
        ))}
      </div>
    );
  }

  const selectedLead = selected ? leadById.get(selected.lead_id) : null;
  const digits = selectedLead?.phone?.replace(/\D/g, "") ?? "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agenda"
        description="Compromissos vinculados aos leads: hoje, atrasados e próximos."
      />

      {/* Indicadores de atenção */}
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          aria-pressed={onlyOverdue}
          onClick={() => {
            setShowUpcoming(false);
            setOnlyOverdue(true);
            setStatusFilter("agendado");
            setView("mes");
          }}
          className={cn(
            "rounded-xl border p-3 text-left",
            overdue.length ? "border-destructive/40 bg-destructive/10" : "bg-card",
            onlyOverdue && "ring-2 ring-destructive/40",
          )}
        >
          <p className="text-xs font-semibold text-muted-foreground">🔴 Atrasados</p>
          <p className="text-lg font-extrabold">
            {overdue.length} compromisso{overdue.length === 1 ? "" : "s"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowUpcoming(false);
            setOnlyOverdue(false);
            setCursor(today);
            setView("dia");
          }}
          className="rounded-xl border bg-card p-3 text-left"
        >
          <p className="text-xs font-semibold text-muted-foreground">📅 Hoje</p>
          <p className="text-lg font-extrabold">{todayCount} agendado(s)</p>
        </button>
        <button
          type="button"
          aria-pressed={showUpcoming}
          onClick={() => {
            setOnlyOverdue(false);
            setStatusFilter("agendado");
            setShowUpcoming(true);
          }}
          className={cn(
            "rounded-xl border bg-card p-3 text-left",
            showUpcoming && "ring-2 ring-primary/40",
          )}
        >
          <p className="text-xs font-semibold text-muted-foreground">⏰ Próximos</p>
          <p className="text-lg font-extrabold">{upcoming} agendado(s)</p>
        </button>

      </div>

      {/* Navegação e visualização */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={view}
          onValueChange={(v) => {
            setShowUpcoming(false);
            setView(v as ViewMode);
          }}
        >
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Período anterior"
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-10" onClick={() => setCursor(today)}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Próximo período"
            onClick={() => shift(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm font-semibold" aria-live="polite">
          {showUpcoming ? "Próximos compromissos" : periodLabel}
        </p>
        {onlyOverdue && (
          <Button variant="ghost" className="h-10" onClick={() => setOnlyOverdue(false)}>
            Limpar filtro de atrasados
          </Button>
        )}
        {showUpcoming && (
          <Button variant="ghost" className="h-10" onClick={() => setShowUpcoming(false)}>
            Voltar para a visão {view}
          </Button>
        )}

      </div>

      {/* Filtros */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="agenda-tipo">Tipo de contato</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="agenda-tipo" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {contactTypes
                .filter((c) => c.active)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="agenda-status">Situação</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="agenda-status" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {APPOINTMENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canSeeOthers && (
          <div className="space-y-1">
            <Label htmlFor="agenda-responsavel">Responsável</Label>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger id="agenda-responsavel" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <LoadingState label="Carregando agenda..." />
      ) : showUpcoming ? (
        <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-bold">Próximos compromissos agendados</h2>
          {upcomingList.length ? (
            <div className="grid gap-2">
              {upcomingList.map((a) => (
                <div key={a.id} className="grid gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {br(toLocalParts(a.scheduled_at).date)}
                  </p>
                  <AppointmentRow a={a} />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 py-3 text-sm text-muted-foreground">
              Nenhum compromisso futuro agendado.
            </p>
          )}
        </section>
      ) : view === "dia" ? (

        <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-bold">Compromissos do dia</h2>
          <DayList dayKey={cursor} />
        </section>
      ) : view === "semana" ? (
        <section className="grid gap-3 lg:grid-cols-7">
          {weekDays.map((k) => {
            const list = byDay.get(k) ?? [];
            return (
              <div
                key={k}
                className={cn(
                  "rounded-2xl border p-3",
                  k === today ? "border-primary/50 bg-primary/5" : "bg-card",
                )}
              >
                <button
                  type="button"
                  className="mb-2 flex w-full items-baseline justify-between gap-2 text-left"
                  onClick={() => {
                    setCursor(k);
                    setView("dia");
                  }}
                >
                  <span className="text-sm font-bold">
                    {WEEKDAYS[fromKey(k).getDay()]} {br(k).slice(0, 5)}
                  </span>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </button>
                <div className="grid gap-2">
                  {list.length ? (
                    list.map((a) => <AppointmentRow key={a.id} a={a} />)
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem compromissos.</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="rounded-2xl border bg-card p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthDays.map((k) => {
                const count = (byDay.get(k) ?? []).length;
                const late = (byDay.get(k) ?? []).some((a) =>
                  isOverdue(a.scheduled_at, a.status),
                );
                const otherMonth = fromKey(k).getMonth() !== fromKey(cursor).getMonth();
                return (
                  <button
                    key={k}
                    type="button"
                    aria-label={`${br(k)} — ${count} compromisso(s)`}
                    onClick={() => setCursor(k)}
                    className={cn(
                      "flex min-h-11 flex-col items-center justify-center rounded-lg border p-1 text-xs",
                      otherMonth && "opacity-40",
                      k === cursor && "border-primary bg-primary/10 font-bold",
                      k === today && k !== cursor && "border-primary/50",
                    )}
                  >
                    <span>{fromKey(k).getDate()}</span>
                    {count ? (
                      <span
                        className={cn(
                          "mt-0.5 rounded-full px-1.5 text-[10px] font-bold",
                          late
                            ? "bg-destructive/20 text-destructive"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-2 text-sm font-bold">Compromissos de {br(cursor)}</h2>
            <DayList dayKey={cursor} />
          </div>
        </section>
      )}

      {!isLoading && !filtered.length && (
        <EmptyState
          title="Nenhum compromisso encontrado"
          description="Ajuste os filtros ou agende um contato a partir da Central do Lead."
          action={
            <Button asChild variant="outline" className="h-11">
              <Link to="/leads">Ir para Leads</Link>
            </Button>
          }
        />
      )}

      {/* Detalhe e ações rápidas */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedLead?.company_name ?? "Compromisso"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                {formatAppointment(selected.scheduled_at)}
                {isOverdue(selected.scheduled_at, selected.status) && (
                  <span className="text-xs font-bold text-destructive">🔴 ATRASADO</span>
                )}
              </p>
              <p className="text-muted-foreground">
                {typeName(selected.contact_type_id)} · {appointmentStatusLabel(selected.status)}
              </p>
              {selectedLead?.contact_name && (
                <p className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  {selectedLead.contact_name}
                </p>
              )}
              {canSeeOthers && (
                <p className="text-xs text-muted-foreground">
                  Responsável: {ownerName(selected.created_by)}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-11 justify-start"
                  onClick={() => {
                    const id = selected.lead_id;
                    setSelected(null);
                    void navigate({ to: "/leads/$id", params: { id } });
                  }}
                >
                  <CalendarDays className="h-4 w-4" /> Ver Lead
                </Button>
                {digits && (
                  <Button asChild variant="outline" className="h-11 justify-start">
                    <a href={`tel:${digits}`}>
                      <Phone className="h-4 w-4" /> Contatar
                    </a>
                  </Button>
                )}
                {digits.length >= 10 && (
                  <Button asChild variant="outline" className="h-11 justify-start">
                    <a
                      href={`https://wa.me/55${digits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                )}
                {/* Ações de escrita apenas para quem pode editar o lead (mesma regra do RLS). */}
                {canEditLead(selected.lead_id) ? (
                  <>
                    <Button
                      variant="outline"
                      className="h-11 justify-start"
                      onClick={() => {
                        setDraft(emptyAppointment);
                        setScheduleFor(selectedLead ?? null);
                        setSelected(null);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Agendar
                    </Button>
                    {selected.status === "agendado" && (
                      <>
                        <Button
                          variant="outline"
                          className="h-11 justify-start"
                          onClick={() => changeStatus(selected, "realizado")}
                        >
                          <Check className="h-4 w-4" /> Realizado
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 justify-start"
                          onClick={() => changeStatus(selected, "nao_realizado")}
                        >
                          <X className="h-4 w-4" /> Não realizado
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Somente o responsável pelo lead ou um administrador pode alterar este
                    agendamento.
                  </p>
                )}
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Novo agendamento para o mesmo lead */}
      <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo agendamento — {scheduleFor?.company_name}</DialogTitle>
          </DialogHeader>
          <AppointmentFields idPrefix="agenda-novo" value={draft} onChange={setDraft} />
          <DialogFooter>
            <Button className="h-11 w-full sm:w-auto" onClick={saveNew} disabled={saving}>
              Salvar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
