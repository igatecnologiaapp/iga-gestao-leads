import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/SearchField";
import { LoadingState, EmptyState } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewDocumentDialog } from "@/components/NewDocumentDialog";
import {
  DOC_TYPES,
  docStatusClass,
  docStatusLabel,
  docTypeLabel,
  formatCurrency,
  statusesFor,
  type DocType,
} from "@/lib/commercial";
import { formatDateOnly } from "@/lib/leads";
import { useCommercialDocuments } from "@/lib/commercialQueries";

import { useProfiles, useSegments } from "@/lib/queries";
import { PaginationBar } from "@/components/PaginationBar";
import { usePagedList } from "@/hooks/usePagedList";

export const Route = createFileRoute("/_authenticated/comercial/")({
  head: () => ({
    meta: [
      { title: "Documentos Comerciais — IGA TECNOLOGIA" },
      {
        name: "description",
        content:
          "Orçamentos, propostas e pedidos vinculados aos leads, com status, totais e histórico.",
      },
      { property: "og:title", content: "Documentos Comerciais — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content:
          "Orçamentos, propostas e pedidos vinculados aos leads, com status, totais e histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComercialList,
});

function ComercialList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading } = useCommercialDocuments();
  const { data: profiles = [] } = useProfiles();
  const { data: segments = [] } = useSegments();

  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [owner, setOwner] = useState("todos");
  const [segment, setSegment] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minValue, setMinValue] = useState("");
  const [more, setMore] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (type !== "todos" && d.doc_type !== type) return false;
      if (status !== "todos" && d.status !== status) return false;
      if (owner !== "todos" && d.owner_id !== owner) return false;
      if (segment !== "todos" && (d.client_segment ?? "") !== segment) return false;
      if (from && d.issue_date < from) return false;
      if (to && d.issue_date > to) return false;
      if (minValue && Number(d.total_general) < Number(minValue)) return false;
      if (
        q &&
        !`${d.number_label} ${d.client_company} ${d.client_contact ?? ""} ${docTypeLabel(d.doc_type)}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [docs, search, type, status, owner, segment, from, to, minValue]);

  const statusOptions = useMemo(
    () => statusesFor((type === "todos" ? "orcamento" : type) as DocType),
    [type],
  );

  const totalValue = filtered.reduce((acc, d) => acc + Number(d.total_general), 0);
  const paged = usePagedList(filtered, 25);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Documentos Comerciais"
        description={`${filtered.length} documento(s) · ${formatCurrency(totalValue)}`}
        actions={
          <Button className="h-10" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        }
      />

      <div className="space-y-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Buscar documentos"
            placeholder="Buscar por número, cliente ou contato"
          />
          <Button variant="outline" className="h-11" onClick={() => setMore((v) => !v)}>
            <Filter className="h-4 w-4" /> Mais filtros
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              setStatus("todos");
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.plural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
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
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {more && (
          <div className="grid gap-2 sm:grid-cols-4">
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os segmentos</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="h-11"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              type="date"
              className="h-11"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <Input
              type="number"
              className="h-11"
              placeholder="Valor mínimo"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState label="Carregando documentos..." />
      ) : !filtered.length ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            title="Nenhum documento encontrado"
            description="Ajuste os filtros ou crie um novo documento."
          />
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid gap-2 md:hidden">
            {paged.pageItems.map((d) => (
              <Link
                key={d.id}
                to="/comercial/$id"
                params={{ id: d.id }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {docTypeLabel(d.doc_type)} {d.number_label}
                  </p>
                  <p className="truncate font-semibold">{d.client_company}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateOnly(d.issue_date)} ·{" "}
                    {profiles.find((p) => p.id === d.owner_id)?.full_name ?? "-"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold">{formatCurrency(d.total_general)}</p>
                  <span
                    className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${docStatusClass(d.status)}`}
                  >
                    {docStatusLabel(d.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Número</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Responsável</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {paged.pageItems.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-accent/40">
                    <td className="px-3 py-2 font-medium">{d.number_label}</td>
                    <td className="px-3 py-2">{docTypeLabel(d.doc_type)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2">{d.client_company}</td>
                    <td className="px-3 py-2">{formatDateOnly(d.issue_date)}</td>
                    <td className="max-w-[160px] truncate px-3 py-2">
                      {profiles.find((p) => p.id === d.owner_id)?.full_name ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${docStatusClass(d.status)}`}
                      >
                        {docStatusLabel(d.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatCurrency(d.total_general)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/comercial/$id" params={{ id: d.id }}>
                          <FileText className="h-4 w-4" /> Abrir
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={paged.page}
            pageCount={paged.pageCount}
            from={paged.from}
            to={paged.to}
            total={paged.total}
            onPrev={paged.prev}
            onNext={paged.next}
            label="documento(s)"
          />
        </>
      )}

      <NewDocumentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={async (id) => {
          await queryClient.invalidateQueries({ queryKey: ["commercial_documents"] });
          void navigate({ to: "/comercial/$id", params: { id } });
        }}
      />
      <div className="h-10 md:hidden" />
    </div>
  );
}
