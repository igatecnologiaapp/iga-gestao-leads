import { Link } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/DataState";
import { docStatusClass, docStatusLabel, docTypeLabel, formatCurrency } from "@/lib/commercial";
import { useLeadDocuments } from "@/lib/commercialQueries";

export function LeadCommercialDocs({
  leadId,
  onNewDocument,
}: {
  leadId: string;
  /** Quando informado, exibe a ação de criar documento já vinculado ao lead. */
  onNewDocument?: () => void;
}) {
  const { data: docs = [] } = useLeadDocuments(leadId);

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="text-sm font-bold">Documentos comerciais</h2>
        {onNewDocument ? (
          <Button size="sm" className="h-10" onClick={onNewDocument}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        ) : null}
      </div>

      {!docs.length && (
        <EmptyState
          title="Nenhum documento comercial"
          description="Crie um orçamento, proposta ou pedido para este lead."
        />
      )}

      {docs.map((d) => (
        <Link
          key={d.id}
          to="/comercial/$id"
          params={{ id: d.id }}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-3 text-sm hover:bg-accent/40"
        >
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {docTypeLabel(d.doc_type)} {d.number_label} — {formatCurrency(d.total_general)}
          </span>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${docStatusClass(d.status)}`}
          >
            {docStatusLabel(d.status)}
          </span>
        </Link>
      ))}
    </section>
  );
}
