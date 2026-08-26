import { AlertTriangle, CalendarClock, FileText, MessageCircle, Pencil, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { leadPending, pendingClass } from "@/lib/pendings";
import type { Appointment } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da Central do Lead: identifica o lead, a situação, o responsável e a
 * próxima ação, além de concentrar as ações rápidas conforme as permissões.
 */
export function LeadHeaderCard({
  companyName,
  segmentName,
  status,
  ownerName,
  nextContactDate,
  appointments,
  phone,
  canEdit,
  onEdit,
  onNewAppointment,
  onNewDocument,
}: {
  companyName: string;
  segmentName: string;
  status: string;
  ownerName: string;
  nextContactDate: string | null;
  appointments: Appointment[];
  phone: string | null;
  canEdit: boolean;
  onEdit: () => void;
  onNewAppointment: () => void;
  onNewDocument: () => void;
}) {
  const pending = leadPending({ next_contact_date: nextContactDate }, appointments);
  const digits = phone?.replace(/\D/g, "") ?? "";
  const whatsapp = digits.length >= 10 ? `https://wa.me/55${digits}` : null;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{companyName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{segmentName}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Responsável</dt>
          <dd className="truncate text-sm font-semibold">{ownerName}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Próxima ação</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                pendingClass(pending.tone),
              )}
            >
              {pending.tone === "atrasado" ? (
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              ) : (
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
              )}
              {pending.label}
            </span>
            <span className="text-sm font-semibold">{pending.detail}</span>
          </dd>
        </div>
      </dl>

      {pending.tone === "atrasado" && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Atenção: este lead está com retorno atrasado.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {digits ? (
          <Button asChild variant="outline" className="h-11 flex-1 sm:flex-none">
            <a href={`tel:${digits}`} aria-label="Ligar para o contato do lead">
              <Phone className="h-4 w-4" /> Contatar
            </a>
          </Button>
        ) : null}
        {whatsapp ? (
          <Button asChild variant="outline" className="h-11 flex-1 sm:flex-none">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir conversa no WhatsApp"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
        ) : null}
        {canEdit && (
          <>
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onNewAppointment}>
              <CalendarClock className="h-4 w-4" /> Agendar
            </Button>
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onNewDocument}>
              <FileText className="h-4 w-4" /> Documento
            </Button>
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
