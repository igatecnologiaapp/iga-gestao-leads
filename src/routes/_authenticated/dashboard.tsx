import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  FileText,
  Layers,
  Receipt,
  ScrollText,
  TrendingUp,
  UserRound,
  Users2,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
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
  MetricCard,
  DetailPanel,
  DashboardSection,
  GroupList,
  NoData,
} from "@/components/dashboard/DashboardKit";
import {
  AppointmentList,
  DocumentList,
  LeadList,
  type Naming,
} from "@/components/dashboard/DashboardLists";
import { useAuth } from "@/hooks/useAuth";
import {
  useAppointments,
  useContactTypes,
  useProfiles,
  useSegments,
  type Appointment,
} from "@/lib/queries";
import { useCommercialDocuments, type CommercialDocument } from "@/lib/commercialQueries";
import { isOverdue, isToday, toLocalParts } from "@/lib/appointments";
import { leadPending, pendingClass, type PendingTone } from "@/lib/pendings";
import { LEAD_STATUSES, statusLabel } from "@/lib/leads";
import { DOC_TYPES, formatCurrency, docTypeLabel } from "@/lib/commercial";
import {
  PERIOD_PRESETS,
  groupBy,
  inRangeDate,
  inRangeIso,
  periodLabel,
  presetRange,
  rate,
  sum,
  todayKey,
  type DashLead,
  type DateRange,
} from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard gerencial — IGA TECNOLOGIA" },
      {
        name: "description",
        content:
          "Painel de gestão: pendências, evolução dos leads, desempenho comercial e resultados por colaborador e segmento.",
      },
      { property: "og:title", content: "Dashboard gerencial — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content:
          "Painel de gestão: pendências, evolução dos leads, desempenho comercial e resultados por colaborador e segmento.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin, profile } = useAuth();
  const canSeeTeam = isAdmin || profile?.can_view_all_leads === true;

  const { data: segments = [] } = useSegments();
  const { data: profiles = [] } = useProfiles();
  const { data: contactTypes = [] } = useContactTypes();
  const { data: appointments = [], isLoading: loadingAppointments } = useAppointments();
  const { data: documents = [], isLoading: loadingDocs } = useCommercialDocuments();

  const [preset, setPreset] = useState<string>("mes");
  const [range, setRange] = useState<DateRange>(() => presetRange("mes"));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const autoOpened = useRef(false);

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["leads", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, contact_name, phone, status, segment_id, created_at, created_by, neighborhood_name, street_name, city, next_contact_date",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DashLead[];
    },
  });

  const loading = loadingLeads || loadingAppointments || loadingDocs;

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const naming: Naming = useMemo(
    () => ({
      segmentName: (id) => segments.find((s) => s.id === id)?.name ?? "Sem segmento",
      sellerName: (id) =>
        profiles.find((p) => p.id === id)?.full_name?.trim() || (id ? "Usuário" : "Sem responsável"),
      typeName: (id) => contactTypes.find((c) => c.id === id)?.name ?? "Não informado",
    }),
    [segments, profiles, contactTypes],
  );

  /* ---------------- Área 1 — precisa de atenção ---------------- */

  // Compromissos de leads ativos e visíveis (a RLS já limita o que chega aqui).
  const validAppointments = useMemo(
    () => appointments.filter((a) => leadById.has(a.lead_id)),
    [appointments, leadById],
  );
  const apptByLead = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of validAppointments) map.set(a.lead_id, [...(map.get(a.lead_id) ?? []), a]);
    return map;
  }, [validAppointments]);

  const sortByDate = (list: Appointment[]) =>
    [...list].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const overdue = useMemo(
    () => sortByDate(validAppointments.filter((a) => isOverdue(a.scheduled_at, a.status))),
    [validAppointments],
  );
  const todayAppts = useMemo(
    () =>
      sortByDate(
        validAppointments.filter(
          (a) => a.status === "agendado" && isToday(a.scheduled_at) && !isOverdue(a.scheduled_at, a.status),
        ),
      ),
    [validAppointments],
  );
  const upcoming = useMemo(
    () =>
      sortByDate(
        validAppointments.filter(
          (a) =>
            a.status === "agendado" &&
            !isToday(a.scheduled_at) &&
            new Date(a.scheduled_at).getTime() > Date.now(),
        ),
      ),
    [validAppointments],
  );
  const next7 = useMemo(
    () =>
      upcoming.filter((a) => new Date(a.scheduled_at).getTime() <= Date.now() + 7 * 86400000),
    [upcoming],
  );

  /** Situação da próxima ação por lead — mesma regra da listagem (`leadPending`). */
  const pendingByTone = useMemo(() => {
    const acc: Record<PendingTone, DashLead[]> = {
      atrasado: [],
      hoje: [],
      agendado: [],
      sem_acao: [],
    };
    for (const lead of leads) {
      acc[leadPending(lead, apptByLead.get(lead.id) ?? []).tone].push(lead);
    }
    return acc;
  }, [leads, apptByLead]);

  /* ---------------- Área 2 — leads ---------------- */

  const newLeads = useMemo(
    () => leads.filter((l) => inRangeIso(l.created_at, range)),
    [leads, range],
  );

  const leadsByStatus = useMemo(
    () =>
      LEAD_STATUSES.map((s) => ({ status: s.value, items: leads.filter((l) => l.status === s.value) }))
        .filter((g) => g.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length),
    [leads],
  );

  const leadsBySegment = useMemo(
    () => groupBy(leads, (l) => l.segment_id ?? "none"),
    [leads],
  );

  /* ---------------- Área 3 — comercial ---------------- */

  const docsInPeriod = useMemo(
    () => documents.filter((d) => inRangeDate(d.issue_date, range)),
    [documents, range],
  );
  const docsByType = (type: string, list: CommercialDocument[] = docsInPeriod) =>
    list.filter((d) => d.doc_type === type);
  const totalOf = (list: CommercialDocument[]) => sum(list.map((d) => Number(d.total_general)));

  const orcamentos = docsByType("orcamento");
  const propostas = docsByType("proposta");
  const pedidos = docsByType("pedido");
  const movimentado = totalOf(docsInPeriod);

  // Conversão real: baseada apenas em documentos gerados a partir de outro (converted_from_id).
  const convertedFrom = useMemo(() => new Set(documents.map((d) => d.converted_from_id)), [documents]);
  const funnel = useMemo(() => {
    const stages = DOC_TYPES.map((t) => {
      const list = docsByType(t.value);
      const converted = list.filter((d) => convertedFrom.has(d.id));
      return { type: t.value, label: t.plural, list, converted: converted.length };
    });
    return stages;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsInPeriod, convertedFrom]);

  /* ---------------- Área 4 — visões gerenciais ---------------- */

  const byCollaborator = useMemo(() => {
    const ids = new Set<string>([
      ...leads.map((l) => l.created_by ?? "none"),
      ...docsInPeriod.map((d) => d.owner_id),
    ]);
    return [...ids]
      .map((id) => {
        const own = leads.filter((l) => (l.created_by ?? "none") === id);
        const ownPeriod = own.filter((l) => inRangeIso(l.created_at, range));
        const ownDocs = docsInPeriod.filter((d) => d.owner_id === id);
        const ownAppts = validAppointments.filter(
          (a) => (leadById.get(a.lead_id)?.created_by ?? "none") === id,
        );
        return { id, own, ownPeriod, ownDocs, ownAppts, value: totalOf(ownDocs) };
      })
      .sort((a, b) => b.own.length - a.own.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, docsInPeriod, validAppointments, leadById, range]);

  const bySegment = useMemo(() => {
    return leadsBySegment.map((g) => {
      const ids = new Set(g.items.map((l) => l.id));
      const segDocs = docsInPeriod.filter((d) => ids.has(d.lead_id));
      const segAppts = validAppointments.filter((a) => ids.has(a.lead_id));
      return { ...g, segDocs, segAppts, value: totalOf(segDocs) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadsBySegment, docsInPeriod, validAppointments]);

  const realizados = useMemo(
    () => validAppointments.filter((a) => a.status === "realizado" && inRangeIso(a.scheduled_at, range)),
    [validAppointments, range],
  );
  const naoRealizados = useMemo(
    () =>
      validAppointments.filter(
        (a) => a.status === "nao_realizado" && inRangeIso(a.scheduled_at, range),
      ),
    [validAppointments, range],
  );

  function applyPreset(v: string) {
    setPreset(v);
    if (v !== "custom") setRange(presetRange(v));
  }

  /** Nível 1: apenas uma seção aberta por vez; ao trocar, os detalhes são recolhidos. */
  function toggleSection(id: string | null) {
    setOpenSection(id);
    setExpanded(null);
  }

  const close = () => setExpanded(null);
  const detail = (id: string) => expanded === id;
  const periodo = periodLabel(range);


  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão de gestão. Toque em qualquer quadro para ver os registros que compõem o resultado."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/agenda">
              <CalendarDays className="h-4 w-4" aria-hidden="true" /> Agenda
            </Link>
          </Button>
        }
      />

      {/* Filtro global de período */}
      <section
        aria-label="Filtro de período"
        className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]"
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="periodo">Período</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger id="periodo" className="h-11">
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
          Período selecionado: <strong>{periodo}</strong>. Indicadores marcados como{" "}
          <em>no período</em> consideram a movimentação nessas datas; os demais representam a base
          acumulada atual.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Carregando indicadores...
        </p>
      ) : null}

      {/* ÁREA 1 — Precisa de atenção */}
      <DashboardSection
        id="atencao"
        title="1. Precisa de atenção"
        hint="Base acumulada"
        summary={`${overdue.length} atrasados · ${todayAppts.length} para hoje · ${pendingByTone.sem_acao.length} sem próxima ação`}
        icon={CircleAlert}
        open={openSection === "atencao"}
        onToggle={toggleSection}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            id="atrasados"
            label="Compromissos atrasados"
            value={String(overdue.length)}
            hint="Agendados com data vencida"
            icon={AlarmClock}
            toneClass={pendingClass("atrasado")}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="hoje"
            label="Compromissos para hoje"
            value={String(todayAppts.length)}
            hint="Agenda do dia"
            icon={CalendarClock}
            toneClass={pendingClass("hoje")}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="proximos"
            label="Próximos compromissos"
            value={String(upcoming.length)}
            hint={`${next7.length} nos próximos 7 dias`}
            icon={CalendarCheck2}
            toneClass={pendingClass("agendado")}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="sem_acao"
            label="Leads sem próxima ação"
            value={String(pendingByTone.sem_acao.length)}
            hint="Nenhum retorno definido"
            icon={CircleAlert}
            toneClass={pendingClass("sem_acao")}
            expandedId={expanded}
            onToggle={setExpanded}
          />
        </div>

        {detail("atrasados") && (
          <DetailPanel
            id="atrasados"
            title={`Compromissos atrasados (${overdue.length})`}
            description="Ordenados do mais antigo para o mais recente."
            onClose={close}
          >
            <AppointmentList
              appointments={overdue}
              leadById={leadById}
              naming={naming}
              emptyText="Nenhum compromisso atrasado."
            />
            <GoTo to="/agenda" label="Abrir a Agenda" />
          </DetailPanel>
        )}
        {detail("hoje") && (
          <DetailPanel
            id="hoje"
            title={`Compromissos para hoje (${todayAppts.length})`}
            onClose={close}
          >
            <AppointmentList
              appointments={todayAppts}
              leadById={leadById}
              naming={naming}
              emptyText="Nenhum compromisso para hoje."
            />
            <GoTo to="/agenda" label="Abrir a Agenda" />
          </DetailPanel>
        )}
        {detail("proximos") && (
          <DetailPanel
            id="proximos"
            title={`Próximos compromissos (${upcoming.length})`}
            description="Compromissos ativos futuros, em ordem cronológica."
            onClose={close}
          >
            <AppointmentList
              appointments={upcoming}
              leadById={leadById}
              naming={naming}
              emptyText="Nenhum compromisso futuro."
            />
            <GoTo to="/agenda" label="Abrir a Agenda" />
          </DetailPanel>
        )}
        {detail("sem_acao") && (
          <DetailPanel
            id="sem_acao"
            title={`Leads sem próxima ação (${pendingByTone.sem_acao.length})`}
            description="Empresas sem agendamento ativo e sem previsão de retorno."
            onClose={close}
          >
            <LeadList
              leads={pendingByTone.sem_acao}
              naming={naming}
              emptyText="Todos os leads possuem próxima ação definida."
            />
            <GoTo to="/leads" search={{ pendencia: "sem_acao" as PendingTone }} label="Ver na listagem de Leads" />
          </DetailPanel>
        )}
      </DashboardSection>

      {/* ÁREA 2 — Visão geral dos Leads */}
      <DashboardSection
        id="leads"
        title="2. Visão geral dos Leads"
        hint={`Período: ${periodo}`}
        summary={`${leads.length} leads na base · ${newLeads.length} novos no período`}
        icon={Users2}
        open={openSection === "leads"}
        onToggle={toggleSection}
      >
        <SubTitle text="Resumo" />
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricCard
            id="total_leads"
            label="Total de Leads (acumulado)"
            value={String(leads.length)}
            hint="Empresas ativas visíveis a você"
            icon={Users2}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="novos_leads"
            label="Novos Leads no período"
            value={String(newLeads.length)}
            hint={periodo}
            icon={TrendingUp}
            expandedId={expanded}
            onToggle={setExpanded}
          />
        </div>
        <SubTitle text="Distribuição" />
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricCard
            id="status_leads"
            label="Leads por Status"
            value={String(leadsByStatus.length)}
            hint="Situações em uso"
            icon={ScrollText}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="segmento_leads"
            label="Leads por Segmento"
            value={String(leadsBySegment.length)}
            hint="Segmentos com leads"
            icon={Layers}
            expandedId={expanded}
            onToggle={setExpanded}
          />
        </div>

        {detail("total_leads") && (
          <DetailPanel id="total_leads" title={`Todos os Leads (${leads.length})`} onClose={close}>
            <LeadList leads={leads} naming={naming} />
            <GoTo to="/leads" label="Abrir a listagem de Leads" />
          </DetailPanel>
        )}
        {detail("novos_leads") && (
          <DetailPanel
            id="novos_leads"
            title={`Novos Leads — ${periodo} (${newLeads.length})`}
            onClose={close}
          >
            <LeadList
              leads={newLeads}
              naming={naming}
              emptyText="Nenhum lead cadastrado no período."
            />
          </DetailPanel>
        )}
        {detail("status_leads") && (
          <DetailPanel
            id="status_leads"
            title="Leads por Status"
            description="Selecione um status para ver as empresas."
            onClose={close}
          >
            <GroupList
              groups={leadsByStatus.map((g) => ({
                key: g.status,
                name: statusLabel(g.status),
                count: g.items.length,
                extra: `${rate(g.items.length, leads.length)}% da base`,
                items: <LeadList leads={g.items} naming={naming} />,
              }))}
            />
          </DetailPanel>
        )}
        {detail("segmento_leads") && (
          <DetailPanel
            id="segmento_leads"
            title="Leads por Segmento"
            description="Selecione um segmento para ver as empresas correspondentes."
            onClose={close}
          >
            <GroupList
              groups={leadsBySegment.map((g) => ({
                key: g.key,
                name: naming.segmentName(g.key === "none" ? null : g.key),
                count: g.items.length,
                extra: `${rate(g.items.length, leads.length)}% da base`,
                items: <LeadList leads={g.items} naming={naming} />,
              }))}
            />
          </DetailPanel>
        )}
      </DashboardSection>

      {/* ÁREA 3 — Visão comercial */}
      <DashboardSection
        id="comercial"
        title="3. Visão comercial"
        hint={`Documentos emitidos em ${periodo}`}
        summary={`${docsInPeriod.length} documentos · ${formatCurrency(movimentado)} no período`}
        icon={Wallet}
        open={openSection === "comercial"}
        onToggle={toggleSection}
      >
        <SubTitle text="Documentos e resultados" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            id="orcamentos"
            label="Orçamentos no período"
            value={String(orcamentos.length)}
            hint={formatCurrency(totalOf(orcamentos))}
            icon={FileText}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="propostas"
            label="Propostas no período"
            value={String(propostas.length)}
            hint={formatCurrency(totalOf(propostas))}
            icon={ScrollText}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="pedidos"
            label="Pedidos no período"
            value={String(pedidos.length)}
            hint={formatCurrency(totalOf(pedidos))}
            icon={Receipt}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="valor"
            label="Valor movimentado no período"
            value={formatCurrency(movimentado)}
            hint={`${docsInPeriod.length} documentos`}
            icon={Wallet}
            expandedId={expanded}
            onToggle={setExpanded}
          />
        </div>

        {(["orcamento", "proposta", "pedido"] as const).map((t) => {
          const id = t === "orcamento" ? "orcamentos" : t === "proposta" ? "propostas" : "pedidos";
          const list = docsByType(t);
          return detail(id) ? (
            <DetailPanel
              key={id}
              id={id}
              title={`${docTypeLabel(t)}s — ${periodo} (${list.length})`}
              description={`Valor total: ${formatCurrency(totalOf(list))}`}
              onClose={close}
            >
              <DocumentList
                documents={list}
                naming={naming}
                emptyText="Nenhum documento deste tipo no período."
              />
              <GoTo to="/comercial" label="Abrir o módulo Comercial" />
            </DetailPanel>
          ) : null;
        })}

        {detail("valor") && (
          <DetailPanel
            id="valor"
            title={`Documentos do período (${docsInPeriod.length})`}
            description={`Valor movimentado: ${formatCurrency(movimentado)}`}
            onClose={close}
          >
            <DocumentList
              documents={[...docsInPeriod].sort((a, b) =>
                Number(b.total_general) - Number(a.total_general),
              )}
              naming={naming}
              emptyText="Nenhum documento emitido no período."
            />
          </DetailPanel>
        )}

        <SubTitle text="Conversão" />
        {/* Funil comercial: Orçamento → Proposta → Pedido */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-bold">Funil comercial — Orçamento → Proposta → Pedido</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A conversão considera apenas documentos que originaram outro documento no sistema
            (rastreabilidade real).
          </p>
          <div className="mt-3">
            <GroupList
              groups={funnel.map((s) => ({
                key: s.type,
                name: s.label,
                count: s.list.length,
                extra: `${formatCurrency(totalOf(s.list))} · ${s.converted} convertido(s) — ${rate(
                  s.converted,
                  s.list.length,
                )}%`,
                items: (
                  <DocumentList
                    documents={s.list}
                    naming={naming}
                    emptyText="Nenhum documento nesta etapa."
                  />
                ),
              }))}
            />
          </div>
        </div>
      </DashboardSection>

      {/* ÁREA 4 — Visões gerenciais */}
      <DashboardSection
        id="gerencial"
        title="4. Visões gerenciais"
        hint={`Período: ${periodo}`}
        summary={`${realizados.length} realizados · ${naoRealizados.length} não realizados · ${next7.length} nos próximos 7 dias`}
        icon={UserRound}
        open={openSection === "gerencial"}
        onToggle={toggleSection}
      >
        <SubTitle text="Operação e compromissos" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            id="realizados"
            label="Compromissos realizados"
            value={String(realizados.length)}
            hint={periodo}
            icon={CalendarCheck2}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="nao_realizados"
            label="Compromissos não realizados"
            value={String(naoRealizados.length)}
            hint={periodo}
            icon={CalendarClock}
            expandedId={expanded}
            onToggle={setExpanded}
          />
          <MetricCard
            id="agenda7"
            label="Agenda dos próximos 7 dias"
            value={String(next7.length)}
            hint="Compromissos ativos"
            icon={CalendarDays}
            expandedId={expanded}
            onToggle={setExpanded}
          />
        </div>
        <SubTitle text={canSeeTeam ? "Resultados por Colaborador" : "Meus resultados"} />
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricCard
            id={canSeeTeam ? "colaboradores" : "meus_resultados"}
            label={canSeeTeam ? "Resultados por Colaborador" : "Meus resultados"}
            value={String(canSeeTeam ? byCollaborator.length : leads.length)}
            hint={canSeeTeam ? "Responsáveis com registros" : "Leads sob sua responsabilidade"}
            icon={UserRound}
            expandedId={expanded}
            onToggle={setExpanded}
          />
        </div>

        {detail("realizados") && (
          <DetailPanel
            id="realizados"
            title={`Compromissos realizados — ${periodo} (${realizados.length})`}
            onClose={close}
          >
            <AppointmentList
              appointments={realizados}
              leadById={leadById}
              naming={naming}
              emptyText="Nenhum compromisso realizado no período."
            />
          </DetailPanel>
        )}
        {detail("nao_realizados") && (
          <DetailPanel
            id="nao_realizados"
            title={`Compromissos não realizados — ${periodo} (${naoRealizados.length})`}
            onClose={close}
          >
            <AppointmentList
              appointments={naoRealizados}
              leadById={leadById}
              naming={naming}
              emptyText="Nenhum compromisso não realizado no período."
            />
          </DetailPanel>
        )}
        {detail("agenda7") && (
          <DetailPanel
            id="agenda7"
            title={`Agenda dos próximos 7 dias (${next7.length})`}
            onClose={close}
          >
            <AppointmentList
              appointments={next7}
              leadById={leadById}
              naming={naming}
              emptyText="Nenhum compromisso nos próximos 7 dias."
            />
            <GoTo to="/agenda" label="Abrir a Agenda" />
          </DetailPanel>
        )}
        {detail("colaboradores") && (
          <DetailPanel
            id="colaboradores"
            title="Resultados por Colaborador"
            description="Leads, compromissos e documentos conforme a sua permissão de visualização."
            onClose={close}
          >
            <GroupList
              groups={byCollaborator.map((c) => ({
                key: c.id,
                name: naming.sellerName(c.id === "none" ? null : c.id),
                count: c.own.length,
                extra: `${c.ownPeriod.length} no período · ${c.ownAppts.length} compromissos · ${c.ownDocs.length} documentos · ${formatCurrency(c.value)}`,
                items: (
                  <div className="space-y-3 p-3">
                    <SubTitle text={`Leads (${c.own.length})`} />
                    <LeadList leads={c.own} naming={naming} />
                    <SubTitle text={`Documentos no período (${c.ownDocs.length})`} />
                    <DocumentList
                      documents={c.ownDocs}
                      naming={naming}
                      emptyText="Nenhum documento no período."
                    />
                  </div>
                ),
              }))}
            />
          </DetailPanel>
        )}
        {detail("meus_resultados") && (
          <DetailPanel
            id="meus_resultados"
            title={`Meus resultados (${leads.length} leads)`}
            description={`${newLeads.length} novos no período · ${docsInPeriod.length} documentos · ${formatCurrency(movimentado)}`}
            onClose={close}
          >
            <LeadList leads={leads} naming={naming} />
          </DetailPanel>
        )}

        {/* Resultados por segmento */}
        <SubTitle text="Resultados por Segmento" />
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-bold">Resultados por Segmento</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Leads acumulados, compromissos e volume comercial no período selecionado.
          </p>
          <div className="mt-3">
            {bySegment.length ? (
              <GroupList
                groups={bySegment.map((g) => ({
                  key: g.key,
                  name: naming.segmentName(g.key === "none" ? null : g.key),
                  count: g.items.length,
                  extra: `${g.segAppts.length} compromissos · ${g.segDocs.length} documentos · ${formatCurrency(g.value)}`,
                  items: (
                    <div className="space-y-3 p-3">
                      <SubTitle text={`Empresas (${g.items.length})`} />
                      <LeadList leads={g.items} naming={naming} />
                      <SubTitle text={`Documentos no período (${g.segDocs.length})`} />
                      <DocumentList
                        documents={g.segDocs}
                        naming={naming}
                        emptyText="Nenhum documento no período."
                      />
                    </div>
                  ),
                }))}
              />
            ) : (
              <NoData text="Nenhum lead cadastrado." />
            )}
          </div>
        </div>
      </DashboardSection>

      <p className="pb-2 text-xs text-muted-foreground">
        Todos os indicadores respeitam as permissões do banco de dados: você visualiza apenas os
        leads, compromissos e documentos aos quais tem acesso. Base de referência: {todayKey()}.
      </p>
    </div>
  );
}

function SectionTitle({ id, text, hint }: { id: string; text: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-sm font-bold tracking-wide uppercase">
        {text}
      </h2>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function SubTitle({ text }: { text: string }) {
  return <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{text}</p>;
}

/** Atalho para a tela completa correspondente ao indicador. */
function GoTo({
  to,
  label,
  search,
}: {
  to: "/leads" | "/agenda" | "/comercial";
  label: string;
  search?: { pendencia: PendingTone };
}) {
  return (
    <div className="mt-3">
      <Button asChild variant="outline" size="sm">
        {search ? (
          <Link to={to} search={search}>
            {label}
          </Link>
        ) : (
          <Link to={to}>{label}</Link>
        )}
      </Button>
    </div>
  );
}
