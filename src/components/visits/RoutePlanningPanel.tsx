import { useEffect, useMemo, useState } from "react";
import { MapPin, MapPinOff, CalendarClock, Footprints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchField } from "@/components/SearchField";
import { EmptyState, LoadingState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useProfiles, useSegments } from "@/lib/queries";
import { useLeadSearches, useVisitedLeadIds } from "@/lib/searchQueries";
import {
  hasLocation,
  leadAddress,
  loadPoints,
  loadSelection,
  savePoints,
  saveSelection,
  useCandidateLeads,
  useScheduledLeadIds,
  type CandidateLead,
  type PlanningPoints,
} from "@/lib/routePlanning";
import {
  GeoValidationSection,
  PointsSection,
  ProximitySection,
  ReadinessSection,
} from "@/components/visits/RoutePlanningSteps";

const ALL = "todos";
const NAO_DISPONIVEL = "Não disponível";

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Fase 3.1 — Seleção de Pesquisas Arquivadas e consolidação dos Leads candidatos.
 * Não gera roteiro, não calcula distância e não chama nenhum serviço externo.
 */
export function RoutePlanningPanel() {
  const { data: searches = [], isLoading: loadingSearches } = useLeadSearches();
  const { data: profiles = [] } = useProfiles();
  const { data: segments = [] } = useSegments();

  const initial = useMemo(() => loadSelection(), []);
  const [searchIds, setSearchIds] = useState<Set<string>>(() => new Set(initial.searchIds));
  const [leadIds, setLeadIds] = useState<Set<string>>(() => new Set(initial.leadIds));
  const [points, setPoints] = useState<PlanningPoints>(() => loadPoints());

  const [searchTerm, setSearchTerm] = useState("");
  const [term, setTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [visitFilter, setVisitFilter] = useState(ALL);

  const selectedSearchIds = useMemo(() => Array.from(searchIds), [searchIds]);
  const { data: leads = [], isLoading: loadingLeads } = useCandidateLeads(selectedSearchIds);
  const leadIdList = useMemo(() => leads.map((l) => l.id), [leads]);
  const { data: visited = new Set<string>() } = useVisitedLeadIds(leadIdList);
  const { data: scheduled = new Set<string>() } = useScheduledLeadIds(leadIdList);

  useEffect(() => {
    saveSelection({ searchIds: Array.from(searchIds), leadIds: Array.from(leadIds) });
  }, [searchIds, leadIds]);

  useEffect(() => {
    savePoints(points);
  }, [points]);

  const profileName = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? NAO_DISPONIVEL;
  const segmentName = (id: string | null) =>
    (id ? segments.find((s) => s.id === id)?.name : null) ?? NAO_DISPONIVEL;
  const searchName = (id: string | null) =>
    (id ? searches.find((s) => s.id === id)?.name : null) ?? NAO_DISPONIVEL;

  const visibleSearches = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return searches;
    return searches.filter((s) =>
      `${s.name} ${s.region ?? ""} ${s.city ?? ""} ${s.state ?? ""}`.toLowerCase().includes(t),
    );
  }, [searches, searchTerm]);

  function toggleSearch(id: string) {
    setSearchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const withLocation = leads.filter(hasLocation);
  const withoutLocation = leads.filter((l) => !hasLocation(l));

  const filteredLeads = useMemo(() => {
    const t = term.trim().toLowerCase();
    return leads.filter((l) => {
      if (locationFilter === "com" && !hasLocation(l)) return false;
      if (locationFilter === "sem" && hasLocation(l)) return false;
      if (statusFilter !== ALL && l.status !== statusFilter) return false;
      if (ownerFilter !== ALL && l.created_by !== ownerFilter) return false;
      if (visitFilter === "visitados" && !visited.has(l.id)) return false;
      if (visitFilter === "nao_visitados" && visited.has(l.id)) return false;
      if (visitFilter === "agendados" && !scheduled.has(l.id)) return false;
      if (visitFilter === "sem_agenda" && scheduled.has(l.id)) return false;
      if (
        t &&
        !`${l.company_name} ${l.neighborhood_name ?? ""} ${l.city ?? ""} ${l.phone ?? ""}`
          .toLowerCase()
          .includes(t)
      )
        return false;
      return true;
    });
  }, [leads, term, locationFilter, statusFilter, ownerFilter, visitFilter, visited, scheduled]);

  const statuses = useMemo(() => Array.from(new Set(leads.map((l) => l.status))).sort(), [leads]);

  /** Mantém na seleção somente Leads que o usuário realmente enxerga (a RLS é a autoridade). */
  const selectedLeads = useMemo(
    () => leads.filter((l) => leadIds.has(l.id)),
    [leads, leadIds],
  );

  function toggleLead(id: string) {
    setLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setLeadIds((prev) => {
      const next = new Set(prev);
      for (const l of filteredLeads) next.add(l.id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* 1. Pesquisas arquivadas */}
      <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">1. Selecionar pesquisas arquivadas</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchIds(new Set(visibleSearches.map((s) => s.id)))}
              disabled={visibleSearches.length === 0}
            >
              Selecionar todas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchIds(new Set());
                setLeadIds(new Set());
              }}
              disabled={searchIds.size === 0}
            >
              Limpar seleção
            </Button>
          </div>
        </div>
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Pesquisar pelo nome, região ou cidade..."
          label="Pesquisar pesquisas arquivadas"
        />
        {loadingSearches ? <LoadingState label="Carregando pesquisas..." /> : null}
        {!loadingSearches && visibleSearches.length === 0 ? (
          <EmptyState title="Nenhuma pesquisa arquivada" description="Arquive uma pesquisa para usá-la aqui." />
        ) : null}
        <ul className="space-y-2">
          {visibleSearches.map((s) => (
            <li key={s.id} className="rounded-xl border p-3">
              <label className="flex items-start gap-3">
                <Checkbox
                  checked={searchIds.has(s.id)}
                  onCheckedChange={() => toggleSearch(s.id)}
                  aria-label={`Selecionar ${s.name}`}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{s.name}</span>
                    <Badge variant="outline">{s.status}</Badge>
                    <Badge variant="secondary">{s.imported_count} Leads</Badge>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground break-words">
                    {s.region ?? NAO_DISPONIVEL} · {[s.city, s.state].filter(Boolean).join("/") || NAO_DISPONIVEL} ·{" "}
                    {s.segment_name ?? NAO_DISPONIVEL}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground break-words">
                    {fmtDate(s.searched_at)} · Responsável: {profileName(s.owner_id)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Consolidação */}
      <section className="rounded-2xl border bg-card p-3 sm:p-4">
        <h2 className="text-sm font-semibold">2. Conjunto consolidado</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Metric label="Pesquisas selecionadas" value={searchIds.size} />
          <Metric label="Leads únicos" value={leads.length} />
          <Metric label="Com localização" value={withLocation.length} tone="success" />
          <Metric label="Sem localização" value={withoutLocation.length} tone="warning" />
          <Metric label="Leads selecionados" value={selectedLeads.length} tone="primary" />
        </div>
        {withoutLocation.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {withoutLocation.length} Lead(s) sem latitude/longitude. Eles não impedem a consolidação — use o filtro
            &quot;Sem localização&quot; para identificá-los e corrigir depois.
          </p>
        ) : null}
      </section>

      {/* 3. Leads */}
      <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">3. Leads candidatos</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={filteredLeads.length === 0}>
              Selecionar todos
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLeadIds(new Set())} disabled={leadIds.size === 0}>
              Limpar seleção
            </Button>
          </div>
        </div>

        <SearchField
          value={term}
          onChange={setTerm}
          placeholder="Pesquisar empresa, bairro, cidade ou telefone..."
          label="Pesquisar Leads candidatos"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <Label className="text-xs">Localização</Label>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="com">Com localização</SelectItem>
                <SelectItem value="sem">Sem localização</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Situação</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Responsável</Label>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Visita / agenda</Label>
            <Select value={visitFilter} onValueChange={setVisitFilter}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="visitados">Já visitados</SelectItem>
                <SelectItem value="nao_visitados">Ainda não visitados</SelectItem>
                <SelectItem value="agendados">Com agendamento</SelectItem>
                <SelectItem value="sem_agenda">Sem agendamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {searchIds.size === 0 ? (
          <EmptyState
            title="Nenhuma pesquisa selecionada"
            description="Selecione ao menos uma pesquisa arquivada para consolidar os Leads."
          />
        ) : null}
        {loadingLeads ? <LoadingState label="Consolidando Leads..." /> : null}
        {!loadingLeads && searchIds.size > 0 && filteredLeads.length === 0 ? (
          <EmptyState title="Nenhum Lead encontrado" description="Ajuste os filtros para ver os Leads." />
        ) : null}

        <ul className="space-y-2">
          {filteredLeads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              checked={leadIds.has(lead.id)}
              onToggle={() => toggleLead(lead.id)}
              segment={segmentName(lead.segment_id)}
              owner={profileName(lead.created_by)}
              origin={searchName(lead.search_id)}
              visited={visited.has(lead.id)}
              scheduled={scheduled.has(lead.id)}
            />
          ))}
        </ul>

        <p className="text-sm font-medium" aria-live="polite">
          {selectedLeads.length} Leads selecionados
        </p>
        <p className="text-xs text-muted-foreground">
          Nada é gravado como roteiro nesta etapa.
        </p>
      </section>

      <GeoValidationSection selectedLeads={selectedLeads} />
      <PointsSection points={points} onChange={setPoints} />
      <ReadinessSection
        searchCount={searchIds.size}
        consolidated={leads.length}
        selectedLeads={selectedLeads}
        points={points}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "primary";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="min-w-0 rounded-xl border p-3">
      <p className="text-xs text-muted-foreground break-words">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function LeadRow({
  lead,
  checked,
  onToggle,
  segment,
  owner,
  origin,
  visited,
  scheduled,
}: {
  lead: CandidateLead;
  checked: boolean;
  onToggle: () => void;
  segment: string;
  owner: string;
  origin: string;
  visited: boolean;
  scheduled: boolean;
}) {
  const located = hasLocation(lead);
  return (
    <li className="rounded-xl border p-3">
      <label className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Selecionar ${lead.company_name}`}
          className="mt-1"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium break-words">{lead.company_name}</span>
            <StatusBadge status={lead.status} />
            {located ? (
              <Badge variant="outline" className="gap-1 text-success">
                <MapPin className="h-3 w-3" /> Com localização
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-warning">
                <MapPinOff className="h-3 w-3" /> Sem localização
              </Badge>
            )}
            {visited ? (
              <Badge variant="secondary" className="gap-1">
                <Footprints className="h-3 w-3" /> Já visitado
              </Badge>
            ) : null}
            {scheduled ? (
              <Badge variant="secondary" className="gap-1">
                <CalendarClock className="h-3 w-3" /> Agendado
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground break-words">
            {leadAddress(lead) || NAO_DISPONIVEL}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground break-words">
            {segment} · {lead.phone ?? NAO_DISPONIVEL} · Responsável: {owner}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground break-words">
            Origem: {origin}
            {located ? ` · ${lead.latitude?.toFixed(5)}, ${lead.longitude?.toFixed(5)}` : ""}
          </span>
        </span>
      </label>
    </li>
  );
}
