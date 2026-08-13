import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { docStatusClass, docStatusLabel, docTypeLabel, formatCurrency } from "@/lib/commercial";
import { useLeadDocuments } from "@/lib/commercialQueries";

export function LeadCommercialDocs({ leadId }: { leadId: string }) {
  const { data: docs = [] } = useLeadDocuments(leadId);

  return (
    <section className="space-y-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Documentos comerciais
      </h2>
      {!docs.length && (
        <p className="text-sm text-muted-foreground">
          Nenhum documento. Crie em <Link to="/comercial" className="underline">Comercial</Link>.
        </p>
      )}
      {docs.map((d) => (
        <Link
          key={d.id}
          to="/comercial/$id"
          params={{ id: d.id }}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-accent/40"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="min-w-0 truncate">
            {docTypeLabel(d.doc_type)} {d.number_label} — {formatCurrency(d.total_general)}
          </span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${docStatusClass(d.status)}`}>
            {docStatusLabel(d.status)}
          </span>
        </Link>
      ))}
    </section>
  );
}
