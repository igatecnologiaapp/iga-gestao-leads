import { LeadInfo } from "@/components/lead/LeadInfo";
import { formatDateTime } from "@/lib/leads";

export type LeadDataView = {
  contact_name: string | null;
  phone: string | null;
  postal_code: string | null;
  street_name: string | null;
  number: string | null;
  neighborhood_name: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
};

/** Área DADOS: informações cadastrais do lead (edição pelo diálogo já existente). */
export function LeadDataTab({ lead, segmentName }: { lead: LeadDataView; segmentName: string }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-bold">Dados cadastrais</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <LeadInfo label="Contato" value={lead.contact_name ?? "-"} />
        <LeadInfo label="Telefone" value={lead.phone ?? "-"} />
        <LeadInfo label="Segmento" value={segmentName} />
        <LeadInfo label="CEP" value={lead.postal_code ?? "-"} />
        <LeadInfo
          label="Rua e número"
          value={`${lead.street_name ?? "-"}${lead.number ? ", " + lead.number : ""}`}
        />
        <LeadInfo label="Bairro" value={lead.neighborhood_name ?? "-"} />
        <LeadInfo
          label="Cidade / UF"
          value={[lead.city, lead.state].filter(Boolean).join(" / ") || "-"}
        />
        <LeadInfo label="Captado em" value={formatDateTime(lead.created_at)} />
      </dl>
    </section>
  );
}
