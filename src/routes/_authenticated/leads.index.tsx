import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
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
import { LEAD_STATUSES, formatDate } from "@/lib/leads";
import { useSegments } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/leads/")({
  head: () => ({
    meta: [
      { title: "Leads — LeadField" },
      { name: "description", content: "Consulte, filtre e atualize o status dos leads captados." },
      { property: "og:title", content: "Leads — LeadField" },
      { property: "og:description", content: "Consulte, filtre e atualize o status dos leads captados." },
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
  created_at: string;
  created_by: string;
};

function LeadsList() {
  const queryClient = useQueryClient();
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

  const { data: segments = [] } = useSegments();
  const { data: products = [] } = useProducts();
  const { data: leadProducts = [] } = useAllLeadProducts();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, contact_name, phone, segment_id, street_name, number, neighborhood_name, status, created_at, created_by",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data as { id: string; full_name: string; email: string | null }[];
    },
  });

  const segmentName = (id: string | null) => segments.find((s) => s.id === id)?.name ?? "-";
  const ownerName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "-";
  };

  const neighborhoodOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.neighborhood_name).filter(Boolean) as string[])).sort(),
    [leads],
  );
  const streetOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.street_name).filter(Boolean) as string[])).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "todos" && l.status !== status) return false;
      if (segment !== "todos" && l.segment_id !== segment) return false;
      if (neighborhood !== "todos" && l.neighborhood_name !== neighborhood) return false;
      if (street !== "todos" && l.street_name !== street) return false;
      if (owner !== "todos" && l.created_by !== owner) return false;
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
    setFrom("");
    setTo("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Pesquisar empresa, contato, telefone, rua..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Segmento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os segmentos</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <SelectTrigger className="h-11"><SelectValue placeholder="Bairro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bairros</SelectItem>
              {neighborhoodOptions.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={street} onValueChange={setStreet}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Rua" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as ruas</SelectItem>
              {streetOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Solução" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as soluções</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="from">De</label>
            <Input id="from" type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="to">Até</label>
            <Input id="to" type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}


      {/* Mobile: cards */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((l) => (
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
            </Link>
            <div className="mt-3">
              <Select value={l.status} onValueChange={(v) => changeStatus(l.id, v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {!filtered.length && !isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</p>
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
              <TableHead>Responsável</TableHead>
              <TableHead className="w-[190px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
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
                <TableCell className="text-sm">{ownerName(l.created_by)}</TableCell>
                <TableCell>
                  <Select value={l.status} onValueChange={(v) => changeStatus(l.id, v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum lead encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
