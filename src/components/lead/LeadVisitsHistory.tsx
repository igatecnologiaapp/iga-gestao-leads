import { Badge } from "@/components/ui/badge";
import { LeadInfo } from "@/components/lead/LeadInfo";
import { useProfiles } from "@/lib/queries";
import { formatAppointment, formatAppointmentTime } from "@/lib/appointments";
import { formatDateOnly } from "@/lib/leads";
import { useVisitsByLead, useVisitRoutes } from "@/lib/visitQueries";
import { routeLabel } from "@/lib/visitHistory";
import { visitResultLabel } from "@/lib/visits";

/**
 * Visitas comerciais do Lead exibidas na aba Histórico da Central do Lead.
 * Complementa (não substitui) o histórico de relacionamento já existente.
 */
export function LeadVisitsHistory({ leadId }: { leadId: string }) {
  const { data: visits = [] } = useVisitsByLead(leadId);
  const { data: routes = [] } = useVisitRoutes();
  const { data: profiles = [] } = useProfiles();

  if (!visits.length) return null;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-bold">Visitas comerciais</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Registros reais das visitas realizadas nos roteiros.
      </p>
      <ul className="mt-3 space-y-3">
        {visits.map((v) => {
          const route = routes.find((r) => r.id === v.route_id);
          const owner = profiles.find((p) => p.id === v.user_id)?.full_name ?? "Não identificado";
          const started = v.started_at ?? v.created_at;
          return (
            <li key={v.id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold">{formatAppointment(started)}</p>
                <Badge variant="outline">{v.finished_at ? "Concluída" : "Em andamento"}</Badge>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <LeadInfo label="Responsável" value={owner} />
                <LeadInfo label="Roteiro" value={route ? routeLabel(route) : "Sem roteiro"} />
                <LeadInfo label="Resultado" value={visitResultLabel(v.result)} />
                <LeadInfo label="Início" value={formatAppointmentTime(started)} />
                <LeadInfo
                  label="Término"
                  value={v.finished_at ? formatAppointmentTime(v.finished_at) : "—"}
                />
                <LeadInfo
                  label="Próxima ação"
                  value={v.next_contact_date ? formatDateOnly(v.next_contact_date) : "—"}
                />
              </dl>
              {v.notes ? <p className="mt-2 text-sm text-muted-foreground">{v.notes}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
