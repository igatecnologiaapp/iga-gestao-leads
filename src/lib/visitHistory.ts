import { formatAppointment, formatAppointmentTime, toLocalParts } from "@/lib/appointments";
import { visitResultLabel } from "@/lib/visits";
import type { LeadVisit } from "@/lib/visitActions";
import type { LeadLite, RouteStop, VisitRoute } from "@/lib/visitQueries";
import type { DateRange } from "@/lib/dashboard";

/**
 * Regras compartilhadas do Histórico de Visitas e da Inteligência Operacional.
 * Tudo é derivado dos dados reais já existentes (lead_visits, roteiros, paradas
 * e Leads); nada é gerado artificialmente. O RLS continua sendo a autoridade.
 */

export type VisitRow = {
  visit: LeadVisit;
  leadId: string;
  companyName: string;
  ownerId: string;
  ownerName: string;
  routeId: string | null;
  routeTitle: string;
  segmentId: string | null;
  segmentName: string;
  region: string;
  resultLabel: string;
  situation: "Concluída" | "Em andamento";
  startedLabel: string;
  finishedLabel: string;
  dateLabel: string;
  nextActionLabel: string;
};

export function routeLabel(route: VisitRoute | undefined): string {
  if (!route) return "Sem roteiro";
  return route.title?.trim() ? route.title : `Roteiro de ${route.route_date.slice(0, 10)}`;
}

export function buildVisitRows(input: {
  visits: LeadVisit[];
  leads: LeadLite[];
  routes: VisitRoute[];
  profiles: { id: string; full_name: string }[];
  segments: { id: string; name: string }[];
}): VisitRow[] {
  const leadById = new Map(input.leads.map((l) => [l.id, l]));
  const routeById = new Map(input.routes.map((r) => [r.id, r]));
  const profileById = new Map(input.profiles.map((p) => [p.id, p.full_name]));
  const segmentById = new Map(input.segments.map((s) => [s.id, s.name]));

  return input.visits.map((visit) => {
    const lead = leadById.get(visit.lead_id);
    const route = visit.route_id ? routeById.get(visit.route_id) : undefined;
    const started = visit.started_at ?? visit.created_at;
    return {
      visit,
      leadId: visit.lead_id,
      companyName: lead?.company_name ?? "Lead não acessível",
      ownerId: visit.user_id,
      ownerName: profileById.get(visit.user_id) ?? "Não identificado",
      routeId: visit.route_id,
      routeTitle: routeLabel(route),
      segmentId: lead?.segment_id ?? null,
      segmentName: lead?.segment_id
        ? (segmentById.get(lead.segment_id) ?? "Sem segmento")
        : "Sem segmento",
      region: lead?.neighborhood_name?.trim() || lead?.city?.trim() || "Sem região",
      resultLabel: visitResultLabel(visit.result),
      situation: visit.finished_at ? "Concluída" : "Em andamento",
      startedLabel: formatAppointmentTime(started),
      finishedLabel: visit.finished_at ? formatAppointmentTime(visit.finished_at) : "—",
      dateLabel: formatAppointment(started).split(" ")[0] ?? "",
      nextActionLabel: visit.next_contact_date
        ? visit.next_contact_date.split("-").reverse().join("/")
        : "—",
    };
  });
}

export type VisitFilters = {
  ownerId: string;
  segmentId: string;
  region: string;
  result: string;
  routeId: string;
};

export const EMPTY_VISIT_FILTERS: VisitFilters = {
  ownerId: "todos",
  segmentId: "todos",
  region: "todos",
  result: "todos",
  routeId: "todos",
};

/** Data local da visita (início real, ou criação quando ausente). */
export function visitDate(row: VisitRow): string {
  return toLocalParts(row.visit.started_at ?? row.visit.created_at).date;
}

export function filterVisitRows(
  rows: VisitRow[],
  range: DateRange,
  filters: VisitFilters,
): VisitRow[] {
  return rows.filter((row) => {
    const d = visitDate(row);
    if (d < range.from || d > range.to) return false;
    if (filters.ownerId !== "todos" && row.ownerId !== filters.ownerId) return false;
    if (filters.segmentId !== "todos" && (row.segmentId ?? "sem") !== filters.segmentId)
      return false;
    if (filters.region !== "todos" && row.region !== filters.region) return false;
    if (filters.result !== "todos" && row.visit.result !== filters.result) return false;
    if (filters.routeId !== "todos" && (row.routeId ?? "sem") !== filters.routeId) return false;
    return true;
  });
}

/** Paradas do período, classificadas pela situação registrada no roteiro. */
export const PENDING_STOPS = ["pendente", "em_deslocamento", "em_visita"];
export const NOT_DONE_STOPS = ["nao_visitado", "reagendado", "cancelado"];

export function stopsInRange(
  stops: RouteStop[],
  routes: VisitRoute[],
  range: DateRange,
): { stop: RouteStop; route: VisitRoute }[] {
  const routeById = new Map(routes.map((r) => [r.id, r]));
  const out: { stop: RouteStop; route: VisitRoute }[] = [];
  for (const stop of stops) {
    const route = routeById.get(stop.route_id);
    if (!route) continue;
    const d = route.route_date.slice(0, 10);
    if (d < range.from || d > range.to) continue;
    out.push({ stop, route });
  }
  return out;
}
