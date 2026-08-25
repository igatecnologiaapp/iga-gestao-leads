import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { SearchField } from "@/components/SearchField";
import { LoadingState, EmptyState } from "@/components/DataState";
import { PendingBadge } from "@/components/PendingBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { usePagedList } from "@/hooks/usePagedList";
import { leadPending, pendingClass, type PendingTone } from "@/lib/pendings";
import { LEAD_STATUSES, formatDate } from "@/lib/leads";
import {
  useAllLeadProducts,
  useAppointments,
  useProducts,
  useProfiles,
  useSegments,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const PENDING_TONES: PendingTone[] = ["atrasado", "hoje", "agendado", "sem_acao"];

export const Route = createFileRoute("/_authenticated/leads/")({
  /** Permite abrir a listagem já filtrada por pendência (atalhos do Dashboard). */
  validateSearch: (search: Record<string, unknown>): { pendencia?: PendingTone } => {
    const value = search["pendencia"];
    return typeof value === "string" && (PENDING_TONES as string[]).includes(value)
      ? { pendencia: value as PendingTone }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Leads — IGA TECNOLOGIA" },
      { name: "description", content: "Consulte, filtre e atualize o status dos leads captados." },
      { property: "og:title", content: "Leads — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Consulte, filtre e atualize o status dos leads captados.",
      },
    ],
  }),
  component: LeadsList,
});

type Lead = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  segment_id: string | null;
  street_name: string | null;
  number: string | null;
  neighborhood_name: string | null;
  status: string;
  next_contact_date: string | null;
  created_at: string;
  created_by: string;
};

function LeadsList() {
  const queryClient = useQueryClient();
  const { pendencia } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [segment, setSegment] = useState("todos");
  const [neighborhood, setNeighborhood] = useState("todos");
  const [street, setStreet] = useState("todos");
  const [product, setProduct] = useState("todos");
  const [owner, setOwner] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<string>(pendencia ?? "todos");

  // Mantém o filtro alinhado quando o usuário chega por um atalho do Dashboard.
  useEffect(() => {
    if (pendencia) setPendingFilter(pendencia);
  }, [pendencia]);

  const { data: segments = [] } = useSegments();
  const { data: products = [] } = useProducts();
  const { data: leadProducts = [] } = useAllLeadProducts();
  const { data: appointments = [] } = useAppointments();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, contact_name, phone, segment_id, street_name, number, neighborhood_name, status, next_contact_date, created_at, created_by",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: profiles = [] } = useProfiles();

  const segmentName = (id: string | null) => segments.find((s) => s.id === id)?.name ?? "-";
  const ownerName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "-";
  };

  const neighborhoodOptions = useMemo(
    () =>
      Array.from(new Set(leads.map((l) => l.neighborhood_name).filter(Boolean) as string[])).sort(),
    [leads],
  );
  const streetOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.street_name).filter(Boolean) as string[])).sort(),
    [leads],
  );

  const pendingByLead = useMemo(() => {
    const map = new Map<string, ReturnType<typeof leadPending>>();
    for (const l of leads) {
      map.set(
        l.id,
        leadPending(
          l,
          appointments.filter((a) => a.lead_id === l.id),
        ),
      );
    }
    return map;
  }, [leads, appointments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "todos" && l.status !== status) return false;
      if (segment !== "todos" && l.segment_id !== segment) return false;
      if (neighborhood !== "todos" && l.neighborhood_name !== neighborhood) return false;
      if (street !== "todos" && l.street_name !== street) return false;
      if (owner !== "todos" && l.created_by !== owner) return false;
      if (pendingFilter !== "todos" && pendingByLead.get(l.id)?.tone !== pendingFilter)
        return false;
      if (
        product !== "todos" &&
        !leadProducts.some((lp) => lp.lead_id === l.id && lp.product_id === product)
      )
        return false;
      if (from && l.created_at < from) return false;
      if (to && l.created_at > `${to}T23:59:59`) return false;
      if (!q) return true;
      return [
        l.company_name,
        l.contact_name,
        l.phone,
        l.street_name,
        l.neighborhood_name,
        segmentName(l.segment_id),
        ownerName(l.created_by),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [
    leads,
    search,
    status,
    segment,
    neighborhood,
    street,
    product,
    owner,
    pendingFilter,
    pendingByLead,
    from,
    to,
    leadProducts,
    segments,
    profiles,
  ]);

  async function changeStatus(id: string, value: string) {
    const { error } = await supabase
      .from("leads")
      .update({ status: value as never })
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível alterar o status.");
      return;
    }
    toast.success("Status atualizado.");
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  }

  function clearFilters() {
    setSearch("");
    setStatus("todos");
    setSegment("todos");
    setNeighborhood("todos");
    setStreet("todos");
    setProduct("todos");
    setOwner("todos");
    setPendingFilter("todos");
    setFrom("");
    setTo("");
  }

  /** Contadores por situação da próxima ação, para atalhos rápidos de filtro. */
  const pendingCounts = useMemo(() => {
    const acc: Record<PendingTone, number> = { atrasado: 0, hoje: 0, agendado: 0, sem_acao: 0 };
    for (const p of pendingByLead.values()) acc[p.tone] += 1;
    return acc;
  }, [pendingByLead]);

  const paged = usePagedList(filtered, 25);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Leads"
        description={`${filtered.length} registro(s)`}
        actions={
          <Button asChild className="h-10">
            <Link to="/captar">Captar lead</Link>
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Pesquisar leads"
          placeholder="Pesquisar empresa, contato, telefone, rua..."
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os segmentos</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Atalhos de pendência: identificação rápida de quem precisa de atenção. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(
          [
            ["atrasado", "Atrasados"],
            ["hoje", "Para hoje"],
            ["agendado", "Agendados"],
            ["sem_acao", "Sem próxima ação"],
          ] as [PendingTone, string][]
        ).map(([tone, label]) => {
          const activeChip = pendingFilter === tone;
          return (
            <button
              key={tone}
              type="button"
              aria-pressed={activeChip}
              onClick={() => setPendingFilter(activeChip ? "todos" : tone)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                pendingClass(tone),
                activeChip ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "opacity-90",
              )}
            >
              {label}
              <span className="rounded-full bg-background/60 px-1.5">{pendingCounts[tone]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-10" onClick={() => setMoreFilters((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" /> {moreFilters ? "Menos filtros" : "Mais filtros"}
        </Button>
        <Button variant="ghost" className="h-10" onClick={clearFilters}>
          Limpar filtros
        </Button>
      </div>

      {moreFilters && (
        <div className="grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={neighborhood} onValueChange={setNeighborhood}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Bairro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bairros</SelectItem>
              {neighborhoodOptions.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={street} onValueChange={setStreet}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Rua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as ruas</SelectItem>
              {streetOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Solução" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as soluções</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pendingFilter} onValueChange={setPendingFilter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Próxima ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as pendências</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
              <SelectItem value="hoje">Para hoje</SelectItem>
              <SelectItem value="agendado">Agendados</SelectItem>
              <SelectItem value="sem_acao">Sem próxima ação</SelectItem>
            </SelectContent>
          </Select>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="from">
              De
            </label>
            <Input
              id="from"
              type="date"
              className="h-11"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="to">
              Até
            </label>
            <Input
              id="to"
              type="date"
              className="h-11"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Mobile: cards */}
      <div className="space-y-3 lg:hidden">
        {paged.pageItems.map((l) => (
          <div key={l.id} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <Link to="/leads/$id" params={{ id: l.id }} className="block">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{l.company_name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {l.contact_name ?? "Sem contato"} · {l.phone ?? "Sem telefone"}
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {segmentName(l.segment_id)} · {l.street_name ?? "-"}
                {l.number ? `, ${l.number}` : ""} · {l.neighborhood_name ?? "-"}
              </p>
              <div className="mt-2">
                <PendingBadge pending={pendingByLead.get(l.id)!} />
              </div>
            </Link>
            <div className="mt-3">
              <Select value={l.status} onValueChange={(v) => changeStatus(l.id, v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {isLoading && <LoadingState label="Carregando leads..." />}
        {!filtered.length && !isLoading && (
          <EmptyState
            title="Nenhum lead encontrado"
            description="Ajuste os filtros ou capte um novo lead."
          />
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Captado em</TableHead>
              <TableHead>Próxima ação</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="w-[190px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.pageItems.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-semibold">
                  <Link to="/leads/$id" params={{ id: l.id }} className="hover:text-primary">
                    {l.company_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{l.contact_name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{l.phone ?? "-"}</div>
                </TableCell>
                <TableCell>{segmentName(l.segment_id)}</TableCell>
                <TableCell className="text-sm">
                  {l.street_name ?? "-"}
                  {l.number ? `, ${l.number}` : ""}
                  <div className="text-xs text-muted-foreground">{l.neighborhood_name ?? "-"}</div>
                </TableCell>
                <TableCell className="text-sm">{formatDate(l.created_at)}</TableCell>
                <TableCell className="text-sm">
                  <PendingBadge compact pending={pendingByLead.get(l.id)!} />
                  {pendingByLead.get(l.id)!.date ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pendingByLead.get(l.id)!.detail}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">{ownerName(l.created_by)}</TableCell>
                <TableCell>
                  <Select value={l.status} onValueChange={(v) => changeStatus(l.id, v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  {isLoading ? (
                    <LoadingState label="Carregando leads..." />
                  ) : (
                    <EmptyState
                      title="Nenhum lead encontrado"
                      description="Ajuste os filtros ou capte um novo lead."
                    />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        page={paged.page}
        pageCount={paged.pageCount}
        from={paged.from}
        to={paged.to}
        total={paged.total}
        onPrev={paged.prev}
        onNext={paged.next}
        label="lead(s)"
      />
    </div>
  );
}
