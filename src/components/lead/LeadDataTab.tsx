import { Facebook, Globe, Instagram } from "lucide-react";
import { LeadInfo } from "@/components/lead/LeadInfo";
import { formatDateTime, facebookUrl, instagramUrl, websiteUrl } from "@/lib/leads";

export type LeadDataView = {
  contact_name: string | null;
  phone: string | null;
  postal_code: string | null;
  street_name: string | null;
  number: string | null;
  neighborhood_name: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  created_at: string;
};

/** Link de contato digital com rótulo acessível. */
function LinkItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Globe;
  label: string;
  value: string | null;
  href: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold">
        {href && value ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-2 text-primary underline-offset-4 hover:underline"
            title={value}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{value}</span>
          </a>
        ) : (
          "-"
        )}
      </dd>
    </div>
  );
}

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
