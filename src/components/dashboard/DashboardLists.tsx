import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/StatusBadge";
import { NoData } from "@/components/dashboard/DashboardKit";
import {
  appointmentStatusClass,
  appointmentStatusLabel,
  formatAppointment,
  isOverdue,
} from "@/lib/appointments";
import { docStatusClass, docStatusLabel, docTypeLabel, formatCurrency } from "@/lib/commercial";
import { formatDateOnly } from "@/lib/leads";
import type { DashLead } from "@/lib/dashboard";
import type { Appointment } from "@/lib/queries";
import type { CommercialDocument } from "@/lib/commercialQueries";
import { cn } from "@/lib/utils";

export type Naming = {
  segmentName: (id: string | null) => string;
  sellerName: (id: string | null) => string;
  typeName: (id: string | null) => string;
};

/** Relação de empresas/Leads — leva direto à Central do Lead. */
export function LeadList({
  leads,
  naming,
  emptyText,
  extra,
}: {
  leads: DashLead[];
  naming: Naming;
  emptyText?: string;
  extra?: (lead: DashLead) => string | null;
}) {
  if (!leads.length) return <NoData text={emptyText} />;
  return (
    <ul className="divide-y">
      {leads.map((l) => (
        <li key={l.id}>
          <Link
            to="/leads/$id"
            params={{ id: l.id }}
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{l.company_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[l.contact_name, l.phone, naming.segmentName(l.segment_id)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {extra?.(l) ??
                  `${
                    [l.street_name, l.neighborhood_name, l.city].filter(Boolean).join(", ") ||
                    "Sem endereço"
                  } · ${naming.sellerName(l.created_by)}`}
              </p>
            </div>
            <StatusBadge status={l.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Relação de compromissos — leva ao Lead correspondente. */
export function AppointmentList({
  appointments,
  leadById,
  naming,
  emptyText,
}: {
  appointments: Appointment[];
  leadById: Map<string, DashLead>;
  naming: Naming;
  emptyText?: string;
}) {
  if (!appointments.length) return <NoData text={emptyText} />;
  return (
    <ul className="divide-y">
      {appointments.map((a) => {
        const lead = leadById.get(a.lead_id);
        if (!lead) return null;
        const late = isOverdue(a.scheduled_at, a.status);
        return (
          <li key={a.id}>
            <Link
              to="/leads/$id"
              params={{ id: lead.id }}
              className="block min-h-14 px-3 py-3 hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{formatAppointment(a.scheduled_at)}</p>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    appointmentStatusClass(a.status),
                  )}
                >
                  {appointmentStatusLabel(a.status)}
                  {late ? " — Atrasado" : ""}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-semibold">{lead.company_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[lead.contact_name, lead.phone].filter(Boolean).join(" · ") || "Sem contato"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {naming.typeName(a.contact_type_id)} · {naming.sellerName(lead.created_by)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Relação de documentos comerciais — número, empresa, tipo, status, valor, responsável e data. */
export function DocumentList({
  documents,
  naming,
  emptyText,
}: {
  documents: CommercialDocument[];
  naming: Naming;
  emptyText?: string;
}) {
  if (!documents.length) return <NoData text={emptyText} />;
  return (
    <ul className="divide-y">
      {documents.map((d) => (
        <li key={d.id}>
          <Link
            to="/comercial/$id"
            params={{ id: d.id }}
            className="block min-h-14 px-3 py-3 hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">
                {docTypeLabel(d.doc_type)} {d.number_label}
              </p>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  docStatusClass(d.status),
                )}
              >
                {docStatusLabel(d.status)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold">{d.client_company}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatCurrency(d.total_general)} · {naming.sellerName(d.owner_id)} ·{" "}
              {formatDateOnly(d.issue_date)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
