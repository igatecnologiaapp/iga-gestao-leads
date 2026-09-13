import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, MapPin, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { SearchField } from "@/components/SearchField";
import { EmptyState, LoadingState } from "@/components/DataState";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusBadge } from "@/components/StatusBadge";
import { PeriodFilter } from "@/components/visits/PeriodFilter";
import { usePagedList } from "@/hooks/usePagedList";
import { presetRange, type DateRange } from "@/lib/dashboard";
import { useProfiles, useSegments } from "@/lib/queries";
import {
  useLeadSearches,
  useSearchLeads,
  useVisitedLeadIds,
  type LeadSearch,
} from "@/lib/searchQueries";

const ALL = "todos";

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ArchivedSearchesPanel() {
  const { data: searches = [], isLoading } = useLeadSearches();
  const { data: profiles = [] } = useProfiles();
  const { data: segments = [] } = useSegments();

  const [term, setTerm] = useState("");
  const [region, setRegion] = useState(ALL);
  const [segment, setSegment] = useState(ALL);
  const [owner, setOwner] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState<DateRange>(() => presetRange("30"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<LeadSearch | null>(null);

  const profileName = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name ?? "Não disponível";

  const regions = useMemo(
    () => Array.from(new Set(searches.map((s) => s.region).filter(Boolean) as string[])).sort(),
    [searches],
  );
  const statuses = useMemo(
    () => Array.from(new Set(searches.map((s) => s.status))).sort(),
    [searches],
  );

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return searches.filter((s) => {
      const day = s.searched_at.slice(0, 10);
      if (day < range.from || day > range.to) return false;
      if (region !== ALL && s.region !== region) return false;
      if (segment !== ALL && s.segment_id !== segment) return false;
      if (owner !== ALL && s.owner_id !== owner) return false;
      if (status !== ALL && s.status !== status) return false;
      if (t && !`${s.name} ${s.region ?? ""} ${s.city ?? ""}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [searches, term, region, segment, owner, status, range]);

  const paged = usePagedList(filtered, 20);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLeadTotal = filtered
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + s.imported_count, 0);

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
        <SearchField
          value={term}
          onChange={setTerm}
          placeholder="Pesquisar pelo nome da pesquisa..."
          label="Pesquisar pesquisas arquivadas"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <Label className="text-xs">Bairro / região</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as regiões</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Segmento</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os segmentos</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Responsável</Label>
            <Select value={owner} onValueChange={setOwner}>
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
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <PeriodFilter preset={preset} range={range} onPreset={setPreset} onRange={setRange} />
      </section>

      {isLoading ? <LoadingState label="Carregando pesquisas..." /> : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma pesquisa arquivada"
          description="Faça uma pesquisa de Leads e use a ação Arquivar pesquisa para guardar o histórico."
        />
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <>
          {selected.size > 0 ? (
            <p className="text-xs text-muted-foreground">
              {selected.size} pesquisa(s) selecionada(s) · {selectedLeadTotal} Lead(s) captados.
            </p>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
            {paged.pageItems.map((s) => (
              <article key={s.id} className="min-w-0 overflow-hidden rounded-2xl border bg-card p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-1"
                    aria-label={`Selecionar ${s.name}`}
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold">{s.name}</p>
                      <Badge variant="outline">{s.status}</Badge>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">
                          {[s.region, [s.city, s.state].filter(Boolean).join("/")]
                            .filter(Boolean)
                            .join(" · ") || "Não disponível"}
                        </span>
                      </li>
                      <li>Segmento: {s.segment_name ?? "Não disponível"}</li>
                      <li>
                        {fmtDate(s.searched_at)} · Responsável: {profileName(s.owner_id)}
                      </li>
                      <li>
                        Encontrados: {s.found_count} · Selecionados: {s.selected_count} · Captados:{" "}
                        {s.imported_count}
                      </li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setDetail(s)}
                    >
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <PaginationBar
            page={paged.page}
            pageCount={paged.pageCount}
            from={paged.from}
            to={paged.to}
            total={paged.total}
            onPrev={paged.prev}
            onNext={paged.next}
            label="pesquisa(s)"
          />
        </>
      ) : null}

      <SearchDetailDialog
        search={detail}
        onOpenChange={(open) => !open && setDetail(null)}
        ownerName={detail ? profileName(detail.owner_id) : ""}
      />
    </div>
  );
}

function SearchDetailDialog({
  search,
  onOpenChange,
  ownerName,
}: {
  search: LeadSearch | null;
  onOpenChange: (open: boolean) => void;
  ownerName: string;
}) {
  const { data: leads = [], isLoading } = useSearchLeads(search?.id ?? null);
  const { data: visited } = useVisitedLeadIds(leads.map((l) => l.id));

  return (
    <Dialog open={!!search} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-4 w-4" aria-hidden="true" />
            {search?.name}
          </DialogTitle>
        </DialogHeader>
        {search ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {[
                ["Segmento", search.segment_name ?? "Não disponível"],
                ["Região", search.region ?? "Não disponível"],
                ["Cidade/UF", [search.city, search.state].filter(Boolean).join("/") || "Não disponível"],
                ["Raio", search.radius_km != null ? `${search.radius_km} km` : "Não disponível"],
                ["Data", fmtDate(search.searched_at)],
                ["Responsável", ownerName],
                ["Provedor", search.provider ?? "Não disponível"],
                ["Encontrados", String(search.found_count)],
                ["Captados", String(search.imported_count)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-lg border bg-muted/30 p-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-medium break-words">{value}</dd>
                </div>
              ))}
            </dl>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Leads associados</h3>
              {isLoading ? <LoadingState label="Carregando Leads..." /> : null}
              {!isLoading && leads.length === 0 ? (
                <EmptyState
                  title="Nenhum Lead vinculado"
                  description="Esta pesquisa foi arquivada sem Leads captados."
                />
              ) : null}
              <ul className="space-y-2">
                {leads.map((lead) => (
                  <li key={lead.id} className="min-w-0 overflow-hidden rounded-xl border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {lead.company_name}
                      </span>
                      <StatusBadge status={lead.status} />
                      {lead.latitude == null || lead.longitude == null ? (
                        <Badge variant="outline" className="border-warning/40 bg-warning/15">
                          Sem localização
                        </Badge>
                      ) : null}
                      {visited?.has(lead.id) ? (
                        <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
                          Visitado
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        lead.phone ?? "Sem telefone",
                        lead.neighborhood_name,
                        [lead.city, lead.state].filter(Boolean).join("/"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Origem: {lead.source}
                      {lead.source_provider ? ` · ${lead.source_provider}` : ""} · Próxima ação:{" "}
                      {lead.next_contact_date
                        ? new Date(`${lead.next_contact_date}T00:00:00`).toLocaleDateString("pt-BR")
                        : "Não definida"}
                    </p>
                    <Button variant="ghost" size="sm" asChild className="mt-1 h-8 px-2">
                      <Link to="/leads/$id" params={{ id: lead.id }}>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Central do Lead
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
